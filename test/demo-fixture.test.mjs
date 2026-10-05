import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { signerFor, startDemoKernel } from "../dist/demo/fixture.js";
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "chio-demo-kernel-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const seed = randomBytes(32).toString("hex"), now = Math.floor(Date.now() / 1000), kernelSessionId = randomUUID();
  const credential = { schema: "chio.mcp.session-credential.v1", sessionId: kernelSessionId, subjectKey: "b".repeat(64), capabilityIds: ["demo-capability"], serverId: "demo-owner", endpointPath: "/mcp", allowedTools: ["read_text_file", "write_file"], issuedAt: now, expiresAt: now + 600 };
  const config = { sessionId: randomUUID(), journalDir: join(root, "journal"), sessionCredential: credential, execution: { endpoint: "", bearerToken: "demo-bearer", trustedSigners: [signerFor(seed)], subjectKey: credential.subjectKey, capabilityId: "demo-capability", serverId: "demo-owner", sessionId: kernelSessionId, timeoutMs: 3000 }, tools: [], approval: { requiredTools: ["write_file"], purpose: "Demo write", ttlSeconds: 300 } };
  return { root, seed, credential, config };
}
const rpc = (url, method, params, headers) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
test("signing keys differ per seed", () => { assert.notEqual(signerFor(randomBytes(32).toString("hex")), signerFor(randomBytes(32).toString("hex"))); });
test("the fixture kernel answers execution context only for the demo credential", async t => {
  const f = setup(t); const owner = join(f.root, "owner");
  const kernel = await startDemoKernel({ owner, seed: f.seed, adminToken: "demo-admin", bearerToken: "demo-bearer", credential: f.credential, config: () => f.config });
  t.after(() => kernel.close());
  const ok = await rpc(kernel.url, "chio/execution-context", {}, { Authorization: "Bearer demo-bearer", "mcp-session-id": f.credential.sessionId });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).result.sessionCredential.sessionId, f.credential.sessionId);
  assert.equal((await rpc(kernel.url, "chio/execution-context", {}, { Authorization: "Bearer wrong", "mcp-session-id": f.credential.sessionId })).status, 401);
});
const ENVELOPE = { chioGovernedIntent: { a: 1 }, chioApprovalToken: { b: 2 } };
const refused = async (response, pattern) => {
  const body = await response.json(); assert.equal(body.error, undefined); assert.equal(body.result._meta.chioEvidence.output.isError, true);
  assert.match(body.result._meta.chioEvidence.output.content[0].text, /^Refused: /); if (pattern) assert.match(body.result._meta.chioEvidence.output.content[0].text, pattern);
};
test("writes are confined to the owner directory", async t => {
  const f = setup(t); const owner = join(f.root, "owner");
  const kernel = await startDemoKernel({ owner, seed: f.seed, adminToken: "demo-admin", bearerToken: "demo-bearer", credential: f.credential, config: () => f.config });
  t.after(() => kernel.close());
  const headers = { Authorization: "Bearer demo-bearer", "mcp-session-id": f.credential.sessionId };
  for (const path of ["../escape.txt", "/etc/escape", "a/\u0000b"]) {
    const response = await rpc(kernel.url, "tools/call", { name: "write_file", arguments: { path, content: "x" }, _meta: { chioRequestId: "r-" + path.length, ...ENVELOPE } }, headers);
    await refused(response, /outside the owner directory/);
  }
  assert.equal(kernel.writes(), 0); assert.equal(existsSync(join(f.root, "escape.txt")), false);
});
const REFUSAL = /outside the owner directory|Refused/;
async function boot(t) {
  const f = setup(t); f.owner = join(f.root, "owner");
  f.kernel = await startDemoKernel({ owner: f.owner, seed: f.seed, adminToken: "demo-admin", bearerToken: "demo-bearer", credential: f.credential, config: () => f.config });
  t.after(() => f.kernel.close());
  f.headers = { Authorization: "Bearer demo-bearer", "mcp-session-id": f.credential.sessionId };
  f.call = async (name, args, meta = ENVELOPE) => (await rpc(f.kernel.url, "tools/call", { name, arguments: args, _meta: { chioRequestId: "r-1", ...meta } }, f.headers)).json();
  f.refusal = async (name, args, meta) => { const body = await f.call(name, args, meta); assert.equal(body.error, undefined); const out = body.result._meta.chioEvidence.output; assert.equal(out.isError, true); assert.match(out.content[0].text, /^Refused: /); return out.content[0].text; };
  return f;
}
test("a valid write creates exactly the file and a repeat is refused", async t => {
  const f = await boot(t);
  const first = await f.call("write_file", { path: "sub/a.txt", content: "one" });
  assert.ok(first.result._meta.chioEvidence); assert.equal(f.kernel.writes(), 1);
  assert.equal(readFileSync(join(f.owner, "sub/a.txt"), "utf8"), "one");
  const second = await f.call("write_file", { path: "sub/a.txt", content: "two" });
  assert.match(second.result._meta.chioEvidence.output.content[0].text, /Refused: .*exists/); assert.equal(second.result._meta.chioEvidence.output.isError, true); assert.equal(f.kernel.writes(), 1);
  assert.equal(readFileSync(join(f.owner, "sub/a.txt"), "utf8"), "one");
  const read = await f.call("read_text_file", { path: "sub/a.txt" });
  assert.equal(read.result._meta.chioEvidence.output.content[0].text, "one");
  assert.match(await f.refusal("write_file", { path: "x.txt" }), REFUSAL);
  assert.match(await f.refusal("write_file", undefined), REFUSAL);
});
test("symlinks inside the owner directory cannot escape it", async t => {
  const f = await boot(t); const outside = join(f.root, "outside");
  mkdirSync(outside); writeFileSync(join(outside, "secret.txt"), "secret");
  symlinkSync(outside, join(f.owner, "link")); symlinkSync(join(outside, "secret.txt"), join(f.owner, "leaf.txt"));
  assert.match(await f.refusal("write_file", { path: "link/x.txt", content: "x" }), REFUSAL);
  assert.match(await f.refusal("write_file", { path: "link/new/x.txt", content: "x" }), REFUSAL);
  assert.match(await f.refusal("read_text_file", { path: "link/secret.txt" }), REFUSAL);
  assert.match(await f.refusal("read_text_file", { path: "leaf.txt" }), REFUSAL);
  assert.match(await f.refusal("write_file", { path: "leaf.txt", content: "x" }), REFUSAL);
  assert.deepEqual(readdirSync(outside), ["secret.txt"]); assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "secret");
  assert.equal(f.kernel.writes(), 0);
  for (const path of ["../escape.txt", "/etc/escape"]) assert.match(await f.refusal("write_file", { path, content: "x" }), REFUSAL);
});
test("names that merely begin with two dots are allowed", async t => {
  const f = await boot(t);
  assert.ok((await f.call("write_file", { path: "..notes/x.txt", content: "ok" })).result);
  assert.equal(readFileSync(join(f.owner, "..notes/x.txt"), "utf8"), "ok");
});
test("admin routes require the admin token and mint signed decisions and revocation", async t => {
  const f = await boot(t); const admin = { Authorization: "Bearer demo-admin" };
  const post = (path, body, headers = admin) => fetch(f.kernel.url + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.ok([401, 403].includes((await post("/admin/approvals", {}, {})).status));
  assert.ok([401, 403].includes((await post("/admin/approvals", {}, { Authorization: "Bearer demo-bearer" })).status));
  assert.equal((await post("/admin/approvals", [1])).status, 400);
  const proposal = { request_id: "req-1", tool_name: "write_file", arguments: { path: "a.txt", content: "x" } };
  const created = await (await post("/admin/approvals", proposal)).json();
  assert.equal(created.dispatchPerformedByThisEndpoint, false);
  const decided = await (await post(`/admin/approvals/${created.record.id}/decision`, { decision: "approved" })).json();
  assert.equal(decided.dispatchPerformedByThisEndpoint, false);
  assert.equal(decided.record.request_id, "req-1"); assert.equal(decided.record.session_id, f.config.execution.sessionId); assert.equal(decided.record.capability_id, "demo-capability");
  assert.equal(decided.toolCallParams._meta.chioApprovalToken.approver, signerFor(f.seed));
  const ctx = () => rpc(f.kernel.url, "chio/execution-context", {}, f.headers);
  assert.equal((await ctx()).status, 200);
  const revoked = await (await post(`/admin/sessions/${f.config.execution.sessionId}/trust`, {})).json();
  assert.equal(revoked.revoked, true); assert.equal(revoked.capabilities[0].capabilityId, "demo-capability");
  assert.equal((await ctx()).status, 401);
});
test("oversize and invalid bodies get a 400 JSON-RPC error and the server keeps answering", async t => {
  const f = await boot(t);
  const raw = body => fetch(f.kernel.url, { method: "POST", headers: { "Content-Type": "application/json", ...f.headers }, body });
  for (const body of ["{not json", JSON.stringify({ pad: "x".repeat(1024 * 1024 + 10) })]) {
    const response = await raw(body); assert.equal(response.status, 400); assert.ok((await response.json()).error);
  }
  assert.equal((await rpc(f.kernel.url, "chio/execution-context", {}, f.headers)).status, 200);
});
