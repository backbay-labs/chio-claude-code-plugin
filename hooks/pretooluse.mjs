#!/usr/bin/env node
// Compatibility hook. This is an authorization precheck, not an execution
// boundary. Claude command hook crashes, timeouts and omissions fail open.
// See acceptance/2026-09-09/REPORT.md before using protected resources.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { recordKey, verifyAuthorization } from "./_receipt.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "dist");

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason,
  } }));
  process.exit(0);
}

// This helps if the bridge stalls while Node remains responsive. It cannot
// make host-level hook removal, process death, or host timeouts fail closed.
const timer = setTimeout(() => deny("chio unavailable: authorization deadline exceeded"), 20_000);

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const { session_id, tool_name, tool_input, tool_use_id } = input;
  if (![session_id, tool_name, tool_use_id].every(v => typeof v === "string" && v.length > 0) ||
      !tool_input || typeof tool_input !== "object" || Array.isArray(tool_input)) {
    throw new Error("malformed hook input: session, tool, tool use id and input are required");
  }
  // check() in historical daemon bridge versions dispatches the MCP tool.
  // Calling it before the host dispatch would execute the action twice.
  if (process.env.CHIO_SERVICE_TOKEN || process.env.CLAUDE_PLUGIN_OPTION_SERVICE_TOKEN) {
    throw new Error("daemon check dispatches tools; use the kernel MCP boundary instead of this precheck");
  }
  const { buildBridge } = await import(join(distRoot, "state", "bridge.js"));
  const { getBond } = await import(join(distRoot, "state", "store.js"));
  const { PENDING_DIR } = await import(join(distRoot, "state", "paths.js"));
  const bond = getBond(session_id);
  if (!bond || bond.sessionId !== session_id) {
    throw new Error("no capability bonded for this exact session; run /chio:bond first");
  }
  const capabilityId = bond.passport?.capabilityId;
  if (typeof capabilityId !== "string" || !capabilityId ||
      !Number.isFinite(Date.parse(bond.passport?.expiresAt)) || Date.parse(bond.passport.expiresAt) <= Date.now()) {
    throw new Error("bonded capability is missing or expired");
  }
  if (!bond.policyPath) throw new Error("bonded policy path is missing");
  const match = tool_name.match(/^mcp__(.+?)__(.+)$/);
  const tool = match?.[2] ?? tool_name;
  const serverId = match?.[1] ?? "*";
  const bridge = buildBridge();
  const costUsd = await computeCostUsd(tool, tool_input, bond.budgetCapUsd);
  if (bond.budgetCapUsd !== undefined) {
    if (!Number.isFinite(bond.budgetCapUsd) || bond.budgetCapUsd < 0) throw new Error("invalid budget cap");
    process.env.CHIO_CAPABILITY_BUDGET_USD = String(bond.budgetCapUsd);
  }
  const verdict = await bridge.check(
    { tool, params: tool_input, serverId, policyPath: bond.policyPath }, { capabilityId, costUsd },
  );
  if (verdict?.decision !== "allow") {
    deny(`chio deny: ${verdict?.reason ?? "missing, unknown, pending, or negative authorization"}${verdict?.guard ? ` [guard: ${verdict.guard}]` : ""}`);
  }
  const expected = { trustedKey: process.env.CHIO_TRUSTED_RECEIPT_KEY, capabilityId, tool, serverId, params: tool_input };
  await verifyAuthorization(bridge, verdict.receipt, expected);
  // Persist authorization before admitting the host tool. This record makes
  // no claim about execution success or any externally committed result.
  mkdirSync(PENDING_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(join(PENDING_DIR, `${recordKey(session_id, tool_use_id)}.json`), JSON.stringify({
    schema: "chio.claude.authorization.v1", sessionId: session_id, toolUseId: tool_use_id,
    expected, authorizationReceipt: verdict.receipt, executionState: "not-observed",
  }), { flag: "wx", mode: 0o600 });
  clearTimeout(timer);
}

async function computeCostUsd(tool, params, budgetCapUsd) {
  const oraclePath = process.env.CHIO_COST_ORACLE_PATH;
  if (!oraclePath) {
    if (budgetCapUsd !== undefined) throw new Error("budgeted calls require a cost oracle");
    return 0;
  }
  const oracle = await import(pathToFileURL(oraclePath).href);
  if (typeof oracle.estimate !== "function") throw new Error("cost oracle must export estimate");
  const cost = await oracle.estimate(tool, params);
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) throw new Error("cost oracle returned an invalid amount");
  return cost;
}

main().catch(error => deny(`chio unavailable: ${error.message ?? error}`));
