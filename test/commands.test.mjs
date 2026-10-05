import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "chio-command-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CHIO_") && !k.startsWith("CLAUDE_PLUGIN_OPTION_") && k !== "CLAUDE_SESSION_ID"));
  Object.assign(env, { CHIO_STATE_DIR: dir, CHIO_KEYSTORE_DIR: join(dir, "keys") });
  const bond = sessionId => ({ sessionId, policyPath: "/policy", bondedAt: sessionId === "a" ? "2020-01-01" : "2021-01-01", passport: { did: "did:chio:same-subject", passportId: `passport-${sessionId}`, capabilityId: `cap-${sessionId}`, expiresAt: "2099-01-01" } });
  writeFileSync(join(dir, "state.json"), JSON.stringify({ bonds: { a: bond("a"), b: bond("b") } }));
  const run = async (name, args = [], extra = {}) => {
    const child = spawn(process.execPath, [join(root, "scripts", `${name}.mjs`), ...args], { env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = ""; child.stdout.on("data", data => stdout += data); child.stderr.on("data", data => stderr += data);
    const code = await new Promise(resolve => child.once("close", resolve)); return { code, stdout, stderr };
  };
  return { dir, run };
}
test("legacy revocation refuses absent, conflicting, or unknown session identity", async t => {
  const f = fixture(t);
  for (const [args, env] of [[[], {}], [["b"], { CLAUDE_SESSION_ID: "a" }], [["foreign"], {}]]) {
    const result = await f.run("revoke", args, env); assert.equal(result.code, 1); assert.equal(Object.keys(JSON.parse(readFileSync(join(f.dir, "state.json"))).bonds).length, 2);
  }
});
test("revocation targets the exact passport and retains the bond until lifecycle confirmation", async t => {
  const f = fixture(t); let confirmed = false; const routes = [];
  const server = createServer((req, res) => { routes.push(req.url); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(req.method === "POST" ? {} : { status: confirmed ? "revoked" : "active" })); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const env = { CLAUDE_SESSION_ID: "a", CHIO_SERVICE_TOKEN: "fixture", CHIO_TRUST_URL: `http://127.0.0.1:${server.address().port}` };
  assert.equal((await f.run("revoke", [], env)).code, 1); assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(f.dir, "state.json"))).bonds, "a"), true);
  confirmed = true; const result = await f.run("revoke", [], env); assert.equal(result.code, 0, result.stderr); assert.equal(JSON.parse(result.stdout).passport_id, "passport-a");
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(f.dir, "state.json"))).bonds, "a"), false);
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(f.dir, "state.json"))).bonds, "b"), true);
  assert.equal(routes.some(route => route.includes("passport-b") || route === "/v1/passport/statuses"), false);
});
test("local countersigning reports signed intent, while HTTP acceptance reports submission only", async t => {
  const f = fixture(t); mkdirSync(join(f.dir, "receipts")); writeFileSync(join(f.dir, "receipts", "receipt-a.json"), JSON.stringify({ id: "receipt-a", action: { tool: "Write" } }));
  const local = await f.run("approve", ["receipt-a"]); assert.equal(local.code, 0, local.stderr);
  const value = JSON.parse(local.stdout); assert.equal(value.status, "signed_intent"); assert.equal(value.authority_accepted, false); assert.equal(value.execution_verified, false);
  const server = createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"status":"approved"}'); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const submitted = await f.run("approve", ["receipt-a"], { CHIO_SERVICE_TOKEN: "fixture", CHIO_TRUST_URL: `http://127.0.0.1:${server.address().port}` });
  assert.equal(JSON.parse(submitted.stdout).status, "decision_submitted"); assert.equal(JSON.parse(submitted.stdout).authority_accepted, false);
  const failed = await f.run("approve", ["receipt-a"], { CHIO_SERVICE_TOKEN: "fixture", CHIO_TRUST_URL: "http://127.0.0.1:1" });
  assert.equal(JSON.parse(failed.stdout).status, "signed_intent"); assert.equal(JSON.parse(failed.stdout).propagated, "failed");
});
test("receipt identifiers cannot escape their cache and session export cannot pick the latest bond", async t => {
  const f = fixture(t);
  assert.equal((await f.run("approve", ["../../operator"])).code, 1);
  const result = await f.run("receipt-export"); assert.equal(result.code, 1); assert.match(result.stderr, /exact session/);
});
test("attenuation commands the bridge refuses are not delivered", async () => {
  for (const path of ["commands/budget-set.md", "commands/guard-pause.md", "scripts/budget-set.mjs", "scripts/guard-pause.mjs", "src/commands/budget-set.ts", "src/commands/guard-pause.ts"]) {
    assert.equal(existsSync(join(root, path)), false, `${path} must stay removed until a parent-bound attenuation endpoint exists`);
  }
  const index = await import(join(root, "dist", "index.js"));
  assert.equal(index.budgetSet, undefined); assert.equal(index.guardPause, undefined);
});
