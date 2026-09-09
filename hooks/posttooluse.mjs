#!/usr/bin/env node
// PostToolUse is an untrusted host observation after an effect. It cannot
// turn an authorization receipt into a signed execution-result receipt.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { recordKey, verifyAuthorization } from "./_receipt.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "dist");

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (![input.session_id, input.tool_use_id, input.tool_name].every(v => typeof v === "string" && v)) {
    throw new Error("missing host event identity");
  }
  const { buildBridge } = await import(join(distRoot, "state", "bridge.js"));
  const { PENDING_DIR, RECEIPT_CACHE_DIR } = await import(join(distRoot, "state", "paths.js"));
  const key = recordKey(input.session_id, input.tool_use_id);
  const pendingPath = join(PENDING_DIR, `${key}.json`);
  const pending = JSON.parse(readFileSync(pendingPath, "utf8"));
  const match = input.tool_name.match(/^mcp__(.+?)__(.+)$/);
  if (pending.schema !== "chio.claude.authorization.v1" || pending.sessionId !== input.session_id ||
      pending.toolUseId !== input.tool_use_id || pending.expected.tool !== (match?.[2] ?? input.tool_name) ||
      pending.expected.serverId !== (match?.[1] ?? "*") || !isDeepStrictEqual(pending.expected.params, input.tool_input)) {
    throw new Error("post-tool event does not match pending authorization");
  }
  await verifyAuthorization(buildBridge(), pending.authorizationReceipt,
    { ...pending.expected, trustedKey: process.env.CHIO_TRUSTED_RECEIPT_KEY });
  mkdirSync(RECEIPT_CACHE_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(join(RECEIPT_CACHE_DIR, `${key}.json`), JSON.stringify({
    ...pending, executionState: "host-reported-success-unverified", hostObservation: input.tool_response,
  }), { flag: "wx", mode: 0o600 });
  // Retain the authorization as a consumed-identity marker. Deleting it
  // would let a replay of the same host operation pass PreToolUse again.
}
main().catch(error => { process.stderr.write(`[chio] post-tool evidence unresolved: ${error.message ?? error}\n`); });
