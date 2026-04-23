// End-to-end dry-run for the PreToolUse hook. Mocks @chio/bridge so we can
// drive verdicts deterministically and assert the exit-0 + stdout JSON
// contract that Claude Code actually requires.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");
const hookPath = join(pluginRoot, "hooks", "pretooluse.mjs");

/** Build a mock dist/ tree so the hook can resolve @chio/bridge + plugin state. */
function buildMockDist(verdict, opts = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "chio-pretooluse-"));
  const dist = join(tmp, "dist");
  mkdirSync(join(dist, "state"), { recursive: true });

  // Mock @chio/bridge via a local shim that bridge.js imports.
  const bridgeJs = `
    export function buildBridge() {
      return {
        check: async () => (${JSON.stringify(verdict)}),
      };
    }
    export function getPolicyPath() {
      return ${JSON.stringify(opts.policyPath ?? "/tmp/mock.policy.yaml")};
    }
  `;
  writeFileSync(join(dist, "state", "bridge.js"), bridgeJs);

  const storeJs = `
    export function getBond() { return undefined; }
    export function getSoleBond() {
      return ${opts.hasBond
        ? JSON.stringify({
            sessionId: "test",
            policyPath: opts.policyPath ?? "/tmp/mock.policy.yaml",
            passport: { did: "did:chio:abc", capabilityId: "cap_1", issuer: "did:chio:issuer", expiresAt: "2030-01-01T00:00:00Z" },
            bondedAt: "2026-04-20T00:00:00Z",
          })
        : "undefined"};
    }
    export function upsertBond() {}
    export function clearBond() {}
    export function readState() { return { bonds: {} }; }
    export function writeState() {}
  `;
  writeFileSync(join(dist, "state", "store.js"), storeJs);

  const pendingDir = join(tmp, "pending");
  mkdirSync(pendingDir, { recursive: true });
  const pathsJs = `
    export const PENDING_DIR = ${JSON.stringify(pendingDir)};
    export const RECEIPT_CACHE_DIR = ${JSON.stringify(join(tmp, "receipts"))};
    export const STATE_DIR = ${JSON.stringify(tmp)};
    export const STATE_PATH = ${JSON.stringify(join(tmp, "state.json"))};
    export const KEYSTORE_DIR = ${JSON.stringify(join(tmp, "keys"))};
  `;
  writeFileSync(join(dist, "state", "paths.js"), pathsJs);

  return { tmp, dist };
}

function runHook(stdin, distRoot) {
  // Copy the hook to a throwaway path and patch the distRoot reference.
  const hookSrc = readFileSync(hookPath, "utf8").replace(
    /join\(__dirname, "\.\.", "dist"\)/,
    JSON.stringify(distRoot),
  );
  const tmpHook = join(distRoot, "..", "pretooluse-patched.mjs");
  writeFileSync(tmpHook, hookSrc);
  const result = spawnSync(process.execPath, [tmpHook], {
    input: JSON.stringify(stdin),
    encoding: "utf8",
  });
  return result;
}

test("PreToolUse emits exit-0 deny on verdict.decision === 'deny'", () => {
  const { dist } = buildMockDist(
    { decision: "deny", reason: "blocked by egress guard", guard: "EgressAllowlistGuard" },
    { hasBond: true },
  );
  const result = runHook(
    {
      session_id: "test",
      tool_name: "Bash",
      tool_input: { command: "curl https://evil.com" },
      tool_use_id: "toolu_123",
    },
    dist,
  );
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(
    parsed.hookSpecificOutput.permissionDecisionReason,
    /chio deny:.*EgressAllowlistGuard/,
  );
});

test("PreToolUse fails closed when bridge throws (unreachable daemon)", () => {
  const { tmp, dist } = buildMockDist(null, { hasBond: true });
  // Overwrite bridge.js to throw
  writeFileSync(
    join(dist, "state", "bridge.js"),
    `
    export function buildBridge() {
      return {
        check: async () => { throw new Error("econnrefused 8940"); },
      };
    }
    export function getPolicyPath() { return "/tmp/mock.policy.yaml"; }
    `,
  );
  const result = runHook(
    {
      session_id: "test",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_use_id: "toolu_456",
    },
    dist,
  );
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /chio unavailable/);
});

test("PreToolUse fails closed when no bond and no default policy", () => {
  const { dist } = buildMockDist(
    { decision: "allow" },
    { hasBond: false, policyPath: undefined },
  );
  // Patch getPolicyPath to return undefined
  writeFileSync(
    join(dist, "state", "bridge.js"),
    `
    export function buildBridge() {
      return { check: async () => ({ decision: "allow" }) };
    }
    export function getPolicyPath() { return undefined; }
    `,
  );
  const result = runHook(
    {
      session_id: "test",
      tool_name: "Write",
      tool_input: { file_path: "/tmp/x", content: "y" },
      tool_use_id: "toolu_789",
    },
    dist,
  );
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /no capability bonded/);
});

test("PreToolUse lets allow-verdicts pass (exit 0, no override)", () => {
  const { dist } = buildMockDist(
    { decision: "allow" },
    { hasBond: true },
  );
  const result = runHook(
    {
      session_id: "test",
      tool_name: "Read",
      tool_input: { file_path: "/tmp/x" },
      tool_use_id: "toolu_allow",
    },
    dist,
  );
  assert.equal(result.status, 0);
  // On allow, we exit without writing a permissionDecision override.
  assert.equal(result.stdout, "");
});
