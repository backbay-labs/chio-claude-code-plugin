import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { startDemo } from "../scripts/demo.mjs";
import { confirmControlIntent } from "../dist/control/service.js";
// These drive the demo's gateway over its HTTP MCP endpoint, the way Claude does.
async function demo(t) {
  const base = mkdtempSync(join(tmpdir(), "chio-demo-mcp-")); t.after(() => rmSync(base, { recursive: true, force: true }));
  const d = await startDemo({ directory: join(base, "demo") }); t.after(() => d.close());
  let sid;
  d.rpc = async (id, method, params) => {
    const r = await fetch(d.gateway.url, { method: "POST", headers: { Authorization: "Bearer " + d.gateway.token, "Content-Type": "application/json", ...(sid ? { "mcp-session-id": sid } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
    if (!sid) sid = r.headers.get("mcp-session-id"); return r.json();
  };
  d.tool = async (name, args) => JSON.parse((await d.rpc(randomUUID(), "tools/call", { name, arguments: args })).result.content[0].text);
  await d.rpc(1, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "x", version: "1" } });
  return d;
}
const call = (d, path, body) => fetch(`${d.control.url}/sessions/${d.sessionId}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${d.control.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }).then(r => r.json());
const status = d => call(d, "/status");
async function grant(d, requestId) {
  const op = (await status(d)).operations.find(o => o.requestId === requestId);
  const { intent } = await call(d, "/intents", { kind: "approve", requestId, revision: op.review.revision });
  assert.equal((await confirmControlIntent(d.config, d.operator, intent.id)).state, "granted");
  return (await status(d)).operations.find(o => o.requestId === requestId);
}
async function approveAndContinue(d, requestId) {
  const granted = await grant(d, requestId);
  const { continuation } = await call(d, "/continuations", { requestId, revision: granted.review.revision });
  let outcome; for (let i = 0; i < 100 && !outcome?.ready; i++) { outcome = await call(d, `/continuations/${continuation.id}/outcome`); if (!outcome.ready) await new Promise(r => setTimeout(r, 20)); }
  assert.equal(outcome.ready, true);
  await call(d, `/continuations/${continuation.id}/ack`, { challenge: outcome.challenge, outcomeHash: outcome.outcomeHash });
  return outcome;
}
const writeArgs = path => ({ path, content: "hello" });
test("an unreviewed read of an earlier write completes verified and leaves no fence", async t => {
  const d = await demo(t);
  const w = await d.tool("write_file", writeArgs("notes/hello.txt")); assert.equal(w.state, "awaiting_approval");
  await approveAndContinue(d, w.requestId);
  const read = await d.tool("read_text_file", { path: "notes/hello.txt" });
  assert.equal(read.state, "completed"); assert.equal(read.evidence, "verified"); assert.equal(read.result.isError, false); assert.equal(read.result.content[0].text, "hello");
  const s = await status(d);
  assert.equal(s.fenced, false); assert.equal(s.unresolved, 0);
});
test("repeating a completed write is a completed refusal and the gateway stays unfenced", async t => {
  const d = await demo(t);
  const first = await d.tool("write_file", writeArgs("notes/hello.txt"));
  await approveAndContinue(d, first.requestId);
  const second = await d.tool("write_file", writeArgs("notes/hello.txt")); assert.equal(second.state, "awaiting_approval");
  const outcome = await approveAndContinue(d, second.requestId);
  assert.equal(outcome.outcome?.state ?? outcome.continuation?.state ?? "completed", "completed");
  const s = await status(d);
  const op = s.operations.find(o => o.requestId === second.requestId);
  assert.equal(op.state, "completed");
  assert.equal(s.fenced, false); assert.equal(s.unresolved, 0); assert.equal(d.kernel.writes(), 1);
  assert.equal(readFileSync(join(d.owner, "notes/hello.txt"), "utf8"), "hello");
  const third = await d.tool("write_file", writeArgs("notes/other.txt"));
  assert.equal(third.state, "awaiting_approval"); assert.notEqual(third.state, "not_dispatched");
});
test("chio_resume over MCP after a granted decision completes once and leaves no fence", async t => {
  const d = await demo(t);
  const w = await d.tool("write_file", writeArgs("notes/hello.txt"));
  const granted = await grant(d, w.requestId);
  const r = await d.tool("chio_resume", { requestId: granted.requestId, tool: "write_file", arguments: writeArgs("notes/hello.txt") });
  assert.equal(r.state, "completed"); assert.equal(r.evidence, "verified");
  assert.equal(d.kernel.writes(), 1); assert.equal(readFileSync(join(d.owner, "notes/hello.txt"), "utf8"), "hello");
  assert.equal((await status(d)).fenced, false);
});
test("a NUL or dot-dot path with a full approval envelope is a refusal and writes nothing", async t => {
  const d = await demo(t);
  for (const path of ["../escape.txt", "a/\u0000b"]) {
    const w = await d.tool("write_file", writeArgs(path)); assert.equal(w.state, "awaiting_approval", path);
    const granted = await grant(d, w.requestId);
    const r = await d.tool("chio_resume", { requestId: granted.requestId, tool: "write_file", arguments: writeArgs(path) });
    assert.equal(r.result.isError, true, path); assert.match(r.result.content[0].text, /^Refused: /);
  }
  assert.equal(d.kernel.writes(), 0); assert.equal(existsSync(join(d.directory, "escape.txt")), false);
  assert.deepEqual(readdirSync(d.owner), []);
  assert.equal((await status(d)).fenced, false);
});
