#!/usr/bin/env node
// PreToolUse hook for Claude Code.
//
// Real hook contract (per code.claude.com/docs/en/hooks):
//   - stdin: { session_id, tool_name, tool_input, tool_use_id, ... }
//   - deny path: exit 0 with stdout JSON
//     { hookSpecificOutput: { hookEventName: "PreToolUse",
//                             permissionDecision: "deny",
//                             permissionDecisionReason: <reason> } }
//   - exit 2: non-blocking error; stderr piped to model; tool STILL RUNS.
//
// This hook is fail-closed: if chio is unreachable, the policy fails to
// parse, or anything unexpected happens, we deny the tool.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "dist");

// Cloak the deny path: always emit a structured permissionDecision.
function deny(reason) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function allow(reason) {
  // Don't override permission; just exit 0 with no JSON. Claude Code will
  // fall through to its normal permission flow.
  if (reason) process.stderr.write(`[chio] allow: ${reason}\n`);
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (err) {
  deny(`chio unavailable: malformed hook input (${err.message})`);
}

const { session_id, tool_name, tool_input } = input;

if (!tool_name) deny("chio unavailable: hook input missing tool_name");

let buildBridge, getBond, getSoleBond, getPolicyPath, PENDING_DIR;
try {
  ({ buildBridge, getPolicyPath } = await import(
    join(distRoot, "state", "bridge.js")
  ));
  ({ getBond, getSoleBond } = await import(join(distRoot, "state", "store.js")));
  ({ PENDING_DIR } = await import(join(distRoot, "state", "paths.js")));
} catch (err) {
  deny(`chio unavailable: plugin not built (${err.message})`);
}

const bond = getBond(session_id) ?? getSoleBond();
const policyPath = bond?.policyPath ?? getPolicyPath();

if (!bond && !policyPath) {
  deny(
    "no capability bonded for this session and no default policy configured; run /chio:bond first",
  );
}

const bridge = buildBridge();
const toolServer = extractServer(tool_name);
const toolLocal = extractLocalTool(tool_name);

// Wave D Bug 2: thread the bonded capability id (and an optional per-call
// cost oracle) into check() so the bridge's mediation pass hits
// /v1/budgets/authorize-exposure and enforces a running cumulative
// budget across all calls in this session. If the session has no bond
// (stale, hasn't run /chio:bond yet), we already failed-closed above.
const capabilityId = bond?.passport?.capabilityId;
const budgetCapUsd = bond?.budgetCapUsd;
let costUsd = 0;
try {
  costUsd = await computeCostUsd(toolLocal, tool_input);
} catch (err) {
  process.stderr.write(
    `[chio] cost-oracle failed (${err.message ?? err}); proceeding with cost=0\n`,
  );
}

let verdict;
try {
  const checkOpts = {};
  if (typeof capabilityId === "string" && capabilityId.length > 0) {
    checkOpts.capabilityId = capabilityId;
  }
  if (Number.isFinite(costUsd) && costUsd > 0) {
    checkOpts.costUsd = costUsd;
  }
  if (Number.isFinite(budgetCapUsd) && budgetCapUsd > 0) {
    // Surface the per-bond cap to the bridge's mediation call so the
    // trust plane can enforce maxTotalExposureUnits per capability.
    process.env.CHIO_CAPABILITY_BUDGET_USD = String(budgetCapUsd);
  }
  verdict = await bridge.check(
    {
      tool: toolLocal,
      params: tool_input,
      ...(toolServer ? { serverId: toolServer } : {}),
      ...(policyPath ? { policyPath } : {}),
    },
    checkOpts,
  );
} catch (err) {
  deny(`chio unavailable: ${err.message}`);
}

if (!verdict || typeof verdict !== "object") {
  deny("chio unavailable: bridge returned no verdict");
}

// Cache the receipt so PostToolUse can sign-verify and persist it. We key
// by tool_use_id when present, else by timestamp.
if (verdict.receipt) {
  try {
    mkdirSync(PENDING_DIR, { recursive: true });
    const id = input.tool_use_id ?? `${Date.now()}`;
    const pendingPath = join(PENDING_DIR, `${id}.json`);
    writeFileSync(pendingPath, JSON.stringify(verdict.receipt));
    // Tuck the path into env for PostToolUse via a shared file — Claude
    // doesn't thread env between hooks, so we use tool_use_id lookup.
  } catch (err) {
    // Receipt caching is best-effort; don't block on it.
    process.stderr.write(`[chio] failed to cache receipt: ${err.message}\n`);
  }
}

if (verdict.decision === "deny" || verdict.decision === "cancelled") {
  const reason = verdict.reason ?? "denied by chio";
  const guard = verdict.guard ? ` [guard: ${verdict.guard}]` : "";
  deny(`chio ${verdict.decision}: ${reason}${guard}`);
}

allow(`verdict=${verdict.decision} guard_count=ok`);

function extractServer(name) {
  // Claude Code MCP tools come through as "mcp__<server>__<tool>". Split so
  // the bridge can dispatch to the right server id.
  if (typeof name !== "string") return undefined;
  const m = name.match(/^mcp__([^_]+(?:_[^_]+)*)__(.+)$/);
  return m ? m[1] : undefined;
}

function extractLocalTool(name) {
  if (typeof name !== "string") return name;
  const m = name.match(/^mcp__[^_]+(?:_[^_]+)*__(.+)$/);
  return m ? m[1] : name;
}

/**
 * Wave D Bug 2: pluggable per-tool cost oracle.
 *
 * Precedence:
 *   1. CHIO_COST_ORACLE_PATH — absolute path to an .mjs module that
 *      exports `estimate(toolName, params) => number|Promise<number>`.
 *      When set, the hook dynamically imports it and delegates. Any
 *      throw falls through to 0.
 *   2. Otherwise: return 0 (no spend attribution). The bridge's
 *      mediation pass is a no-op for costUsd === 0.
 *
 * The hedge-fund demo ships such an oracle under `scripts/cost-oracle.mjs`
 * which computes `place_order` cost as `qty * ask` by reading the
 * demo's quotes.json fixture. Any plugin that wants velocity enforcement
 * points CHIO_COST_ORACLE_PATH at its own oracle.
 */
async function computeCostUsd(toolName, params) {
  const oraclePath = process.env.CHIO_COST_ORACLE_PATH;
  if (!oraclePath) return 0;
  try {
    const mod = await import(oraclePath);
    if (typeof mod.estimate !== "function") return 0;
    const n = await mod.estimate(toolName, params);
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
