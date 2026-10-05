import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { startGatewayHttp } from "../dist/gateway-http.js";
import { verifyCompletedOutcome } from "@chio/bridge";
import { signedOutcome } from "../dist/demo/fixture.js";
import { startDemo } from "../scripts/demo.mjs";
import { signerFor } from "../dist/demo/fixture.js";
import { confirmControlIntent } from "../dist/control/service.js";
async function demo(t) {
  const base = mkdtempSync(join(tmpdir(), "chio-demo-")); t.after(() => rmSync(base, { recursive: true, force: true }));
  const d = await startDemo({ directory: join(base, "demo") }); t.after(() => d.close()); return d;
}
const call = (d, path, body) => fetch(`${d.control.url}/sessions/${d.sessionId}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${d.control.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }).then(r => r.json());
test("the demo runs one reviewed write end to end with exactly one owner effect", async t => {
  const d = await demo(t);
  const proposal = await call(d, "/proposals", { id: randomUUID(), tool: "write_file", arguments: { path: "notes/hello.txt", content: "hello" } });
  assert.equal(proposal.state, "awaiting_approval"); assert.equal(existsSync(join(d.owner, "notes/hello.txt")), false); assert.equal(d.kernel.writes(), 0);
  const op = (await call(d, "/status")).operations.find(o => o.review?.decision === "required");
  assert.equal((await call(d, "/status")).scope, "demo_fixture");
  const { intent } = await call(d, "/intents", { kind: "approve", requestId: op.requestId, revision: op.review.revision });
  assert.equal((await confirmControlIntent(d.config, d.operator, intent.id)).state, "granted");
  const granted = (await call(d, "/status")).operations.find(o => o.requestId === op.requestId);
  const { continuation } = await call(d, "/continuations", { requestId: granted.requestId, revision: granted.review.revision });
  let outcome; for (let i = 0; i < 100 && !outcome?.ready; i++) { outcome = await call(d, `/continuations/${continuation.id}/outcome`); if (!outcome.ready) await new Promise(r => setTimeout(r, 20)); }
  assert.equal(outcome.ready, true);
  assert.equal((await call(d, `/continuations/${continuation.id}/ack`, { challenge: outcome.challenge, outcomeHash: outcome.outcomeHash })).acknowledged, true);
  assert.equal(readFileSync(join(d.owner, "notes/hello.txt"), "utf8"), "hello"); assert.equal(d.kernel.writes(), 1);
});
test("each demo trusts only its own run's key, keeps credentials private and refuses an existing directory", async t => {
  const a = await demo(t), b = await demo(t);
  assert.notEqual(a.config.execution.trustedSigners[0], b.config.execution.trustedSigners[0]);
  assert.equal(a.config.execution.trustedSigners[0], signerFor(JSON.parse(readFileSync(join(a.directory, "signing-seed.json"), "utf8")).seed));
  for (const name of ["gateway.json", "operator.json", "mcp.json", "signing-seed.json"]) assert.equal(statSync(join(a.directory, name)).mode & 0o077, 0, name);
  const existing = mkdtempSync(join(tmpdir(), "chio-demo-existing-")); t.after(() => rmSync(existing, { recursive: true, force: true }));
  await assert.rejects(startDemo({ directory: existing }), /already exists/);
});


test("renaming a demo config cannot authenticate it as a different server", async t => {
  const d = await demo(t), changed = structuredClone(d.config);
  changed.execution.serverId = changed.sessionCredential.serverId = "production-owner";
  await assert.rejects(startGatewayHttp(changed));
});
test("a demo receipt verifies only against the explicitly trusted per-run signer", async t => {
  const a = await demo(t), b = await demo(t);
  const seed = JSON.parse(readFileSync(join(a.directory, "signing-seed.json"), "utf8")).seed;
  const request = { requestId: "a-original", tool: "read_text_file", arguments: { path: "a.txt" }, approval: {} };
  const outcome = signedOutcome(a.config, request, seed);
  assert.equal(verifyCompletedOutcome(outcome, a.config.execution, request), true);
  assert.equal(verifyCompletedOutcome(outcome, { ...a.config.execution, trustedSigners: b.config.execution.trustedSigners }, request), false);
});
