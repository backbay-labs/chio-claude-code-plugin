import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from "node:fs";
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
test("writes are confined to the owner directory", async t => {
  const f = setup(t); const owner = join(f.root, "owner");
  const kernel = await startDemoKernel({ owner, seed: f.seed, adminToken: "demo-admin", bearerToken: "demo-bearer", credential: f.credential, config: () => f.config });
  t.after(() => kernel.close());
  const headers = { Authorization: "Bearer demo-bearer", "mcp-session-id": f.credential.sessionId };
  for (const path of ["../escape.txt", "/etc/escape", "a/\u0000b"]) {
    const response = await rpc(kernel.url, "tools/call", { name: "write_file", arguments: { path, content: "x" }, _meta: { chioRequestId: "r-" + path.length } }, headers);
    assert.ok((await response.json()).error, path);
  }
  assert.equal(kernel.writes(), 0); assert.equal(existsSync(join(f.root, "escape.txt")), false);
});
