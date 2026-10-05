import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGateway, operationKey } from "../dist/gateway.js";
import { startControlServer, controlStatus, confirmControlIntent } from "../dist/control/service.js";
import { canonicalizeJson, sha256Hex, signUtf8MessageEd25519 } from "@chio-protocol/sdk/invariants";
import { main as operatorMain } from "../scripts/control.mjs";
import { PassThrough } from "node:stream";
import { watch, intentCard } from "../scripts/control-watch.mjs";

const seed = "a1".repeat(32);
const signer = signUtf8MessageEd25519("identity", seed).public_key_hex;
async function fixture(t, kernelHandler) {
  const root = mkdtempSync(join(tmpdir(), "chio-control-"));
  let gateway, control;
  const kernel = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const result = await kernelHandler?.(req.url, body ? JSON.parse(body) : undefined, req.headers.authorization);
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(result ?? {}));
  });
  await new Promise(resolve => kernel.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await control?.close(); gateway?.close();
    await new Promise(resolve => { kernel.close(resolve); kernel.closeAllConnections(); });
    rmSync(root, { recursive: true, force: true });
  });
  const config = { sessionId: "host-session-a", journalDir: join(root, "journal"), tools: [{ name: "write_file", inputSchema: { type: "object" } }],
    execution: { endpoint: `http://127.0.0.1:${kernel.address().port}`, bearerToken: "delegated-not-admin", trustedSigners: [signer], subjectKey: "b2".repeat(32), capabilityId: "cap-a", serverId: "resource-a", sessionId: "kernel-session-a" },
    approval: { requiredTools: ["write_file"], purpose: "exact disposable write", ttlSeconds: 300 } };
  let effects = 0;
  gateway = createGateway(config, { execute: async () => { effects++; return { state: "unknown", evidence: "unverified", requestId: "unexpected" }; } });
  await gateway.call("request-a", "write_file", { path: "/protected/out.txt", content: "exact payload" });
  const options = { config, authorityExpiresAt: Math.floor(Date.now() / 1000) + 600, validateAuthority: async () => true };
  control = await startControlServer(options);
  const headers = { Authorization: `Bearer ${control.token}`, "Content-Type": "application/json" };
  const get = (session = config.sessionId) => fetch(`${control.url}/sessions/${session}/status`, { headers });
  const post = value => fetch(`${control.url}/sessions/${config.sessionId}/intents`, { method: "POST", headers, body: JSON.stringify(value) });
  return { root, config, options, control, headers, get, post, effects: () => effects };
}
function signedDecision(config, proposal, decision) {
  const intent = { server_id: config.execution.serverId, tool_name: proposal.tool_name,
    body: { kind: "bound_tool_invocation", value: { capability_id: config.execution.capabilityId, parameters_hash: "0x" + sha256Hex(canonicalizeJson(proposal.arguments)) } },
    context: { mcpSessionId: config.execution.sessionId, capabilityId: config.execution.capabilityId } };
  const now = Math.floor(Date.now() / 1000);
  const token = { id: "approval-a", approver: signer, subject: config.execution.subjectKey, governed_intent_hash: sha256Hex(canonicalizeJson(intent)),
    request_id: proposal.request_id, issued_at: now, expires_at: now + 300, decision };
  token.signature = signUtf8MessageEd25519(canonicalizeJson(token), seed).signature_hex;
  return { name: proposal.tool_name, arguments: proposal.arguments, _meta: { chioRequestId: proposal.request_id, chioGovernedIntent: intent, chioApprovalToken: token } };
}
test("scoped listener exposes exact review and rejects absent, foreign and browser credentials", async t => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.control.url}/sessions/host-session-a/status`)).status, 401);
  assert.equal((await f.get("host-session-b")).status, 404);
  assert.equal((await fetch(`${f.control.url}/sessions/host-session-a/status`, { headers: { ...f.headers, Origin: "https://foreign.example" } })).status, 401);
  const status = await (await f.get()).json();
  assert.equal(status.awaitingReview, 1); assert.equal(status.authority, "live"); assert.equal(status.scope, "kernel_mcp");
  assert.deepEqual(status.operations[0].review.arguments, { content: "exact payload", path: "/protected/out.txt" });
  assert.equal(JSON.stringify(status).includes("delegated-not-admin"), false);
  assert.equal(f.effects(), 0);
});
test("stale and changed exact review, duplicate intent and foreign operation never submit authority", async t => {
  const f = await fixture(t); const status = await (await f.get()).json(); const op = status.operations[0];
  assert.equal((await f.post({ kind: "approve", requestId: "foreign", revision: op.review.revision })).status, 409);
  assert.equal((await f.post({ kind: "approve", requestId: op.requestId, revision: "0".repeat(64) })).status, 409);
  const input = { kind: "approve", requestId: op.requestId, revision: op.review.revision };
  const response = await f.post(input); assert.equal(response.status, 202);
  const accepted = await response.json(); assert.equal(accepted.intent.state, "requested"); assert.equal(accepted.authorityAccepted, false); assert.equal(accepted.dispatchPerformed, false);
  assert.equal((await f.post(input)).status, 409);
  const path = join(f.config.journalDir, operationKey(op.requestId) + ".json"); const record = JSON.parse(readFileSync(path));
  record.proposal.arguments.content = "substituted"; writeFileSync(path, JSON.stringify(record), { mode: 0o600 });
  await assert.rejects(confirmControlIntent(f.config, { adminToken: "operator" }, accepted.intent.id), /bind|changed/);
  assert.equal(f.effects(), 0);
});
test("only exact signed kernel acceptance becomes granted; no decision dispatches the effect", async t => {
  let config, proposal; const calls = [];
  const f = await fixture(t, (path, body, auth) => {
    calls.push(path); assert.equal(auth, "Bearer operator");
    if (path === "/admin/approvals") proposal = body;
    return { dispatchPerformedByThisEndpoint: false, record: { id: "approval-a", request_id: proposal.request_id, session_id: config.execution.sessionId, capability_id: config.execution.capabilityId },
      ...(path.endsWith("/decision") ? { toolCallParams: signedDecision(config, proposal, body.decision) } : {}) };
  }); config = f.config;
  const op = (await (await f.get()).json()).operations[0];
  const intent = (await (await f.post({ kind: "approve", requestId: op.requestId, revision: op.review.revision })).json()).intent;
  const accepted = await confirmControlIntent(config, { adminToken: "operator" }, intent.id);
  assert.equal(accepted.state, "granted"); assert.equal(f.effects(), 0);
  const status = await (await f.get()).json(); assert.equal(status.operations[0].nextAction, "explicit_resume"); assert.equal(status.awaitingReview, 0);
  await assert.rejects(confirmControlIntent(config, { adminToken: "operator" }, intent.id), /cannot be confirmed/);
  assert.deepEqual(calls, ["/admin/approvals", "/admin/approvals/approval-a/decision"]);
});
test("HTTP success without trusted authority is unknown and never resubmitted", async t => {
  let calls = 0; const f = await fixture(t, () => { calls++; return { status: "approved" }; });
  const op = (await (await f.get()).json()).operations[0];
  const intent = (await (await f.post({ kind: "approve", requestId: op.requestId, revision: op.review.revision })).json()).intent;
  await assert.rejects(confirmControlIntent(f.config, { adminToken: "operator" }, intent.id), /binding/);
  assert.equal((await controlStatus(f.options)).intents[0].state, "unknown");
  await assert.rejects(confirmControlIntent(f.config, { adminToken: "operator" }, intent.id)); assert.equal(calls, 1); assert.equal(f.effects(), 0);
});
test("revocation confirms the exact kernel session and capability, keeping host requests separate", async t => {
  let calls = 0; const f = await fixture(t, path => {
    calls++; assert.equal(path, "/admin/sessions/kernel-session-a/trust");
    return { sessionId: "kernel-session-a", revoked: true, capabilities: [{ capabilityId: "cap-a", revoked: true }] };
  });
  const status = await (await f.get()).json();
  const intent = (await (await f.post({ kind: "revoke", revision: status.revision })).json()).intent;
  assert.equal(calls, 0); assert.equal((await controlStatus(f.options)).authority, "live");
  assert.equal((await confirmControlIntent(f.config, { adminToken: "operator" }, intent.id)).state, "confirmed");
  assert.equal((await controlStatus(f.options)).authority, "revoked"); assert.equal(calls, 1);
});
test("unreachable authority and uncertain operation retain evidence and the original dispatch fence", async t => {
  const f = await fixture(t); const requestId = (await (await f.get()).json()).operations[0].requestId; const file = join(f.config.journalDir, operationKey(requestId) + ".json");
  const record = JSON.parse(readFileSync(file)); record.state = "unknown"; record.outcome = { state: "unknown", evidence: "unverified", requestId: record.requestId }; delete record.proposal;
  writeFileSync(file, JSON.stringify(record), { mode: 0o600 });
  const status = await controlStatus({ ...f.options, validateAuthority: async () => { throw new Error("offline"); } });
  assert.equal(status.authority, "disconnected"); assert.equal(status.unresolved, 1); assert.equal(status.fenced, true); assert.equal(status.operations[0].nextAction, "reconcile_original");
  assert.equal(readdirSync(f.config.journalDir).some(name => name === operationKey(requestId) + ".json"), true); assert.equal(f.effects(), 0);
});
test("expired scoped credential and expired decision intent refuse controls", async t => {
  const f = await fixture(t); const status = await (await f.get()).json();
  const intent = (await (await f.post({ kind: "revoke", revision: status.revision })).json()).intent;
  const path = join(f.config.journalDir, "control-intents", intent.id + ".json"); const r = JSON.parse(readFileSync(path)); r.expiresAt = Date.now() - 1; writeFileSync(path, JSON.stringify(r), { mode: 0o600 });
  await assert.rejects(confirmControlIntent(f.config, { adminToken: "operator" }, intent.id), /cannot be confirmed/);
  const expired = await startControlServer({ ...f.options, authorityExpiresAt: 1 }); t.after(() => expired.close());
  const response = await fetch(expired.url + "/sessions/host-session-a/status", { headers: { Authorization: `Bearer ${expired.token}` } }); assert.equal(response.status, 401);
});

test("unsupported alternatives cannot consume the original exact review", async t => {
  const f = await fixture(t); const op = (await (await f.get()).json()).operations[0];
  const input = { requestId: op.requestId, revision: op.review.revision };
  assert.equal((await f.post({ ...input, kind: "alternative" })).status, 409);
  assert.equal((await (await f.get()).json()).intents.length, 0);
  assert.equal((await f.post({ ...input, kind: "approve" })).status, 202); assert.equal(f.effects(), 0);
});
test("control server refuses an existing credential output without deleting its owner's file", async t => {
  const f = await fixture(t); const now = Math.floor(Date.now() / 1000);
  const prepared = { ...f.config, sessionCredential: { schema: "chio.mcp.session-credential.v1", sessionId: f.config.execution.sessionId,
    subjectKey: f.config.execution.subjectKey, capabilityIds: [f.config.execution.capabilityId], serverId: f.config.execution.serverId,
    endpointPath: "/mcp", allowedTools: ["write_file"], issuedAt: now, expiresAt: now + 600 } };
  const configPath = join(f.root, "prepared.json"); const outputPath = join(f.root, "owner-credential.json");
  writeFileSync(configPath, JSON.stringify(prepared), { mode: 0o600 }); writeFileSync(outputPath, "preserve owner credential", { mode: 0o600 });
  await assert.rejects(operatorMain(["serve", "--gateway-config", configPath, "--credential-output", outputPath]), /EEXIST/);
  assert.equal(readFileSync(outputPath, "utf8"), "preserve owner credential");
});
test("a protected launch fences its original transport when the authenticated host session changes", async t => {
  const f = await fixture(t); let fenced = 0;
  const control = await startControlServer({ ...f.options, onSessionMismatch: () => { fenced++; } }); t.after(() => control.close());
  const url = control.url + "/sessions/4f63a5fb-993e-4ea9-9a2f-7db2ec9fe281/status";
  assert.equal((await fetch(url)).status, 401); assert.equal(fenced, 0);
  const headers = { Authorization: `Bearer ${control.token}` };
  assert.equal((await fetch(control.url + "/sessions/host-session-a/status", { headers })).status, 200); assert.equal(control.statusReads, 1);
  assert.equal((await fetch(url, { headers })).status, 404); assert.equal(fenced, 1); assert.equal(control.sessionMismatch, true);
  assert.equal((await fetch(control.url + "/sessions/host-session-a/status", { headers })).status, 409);
  assert.equal((await fetch(url, { headers })).status, 404); assert.equal(fenced, 1); assert.equal(f.effects(), 0);
});

function terminal() {
  const input = new PassThrough(); input.isTTY = true; input.setRawMode = () => input;
  const output = new PassThrough(); output.isTTY = true; let text = ""; output.on("data", data => { text += data; });
  return { input, output, read: () => text };
}
async function until(predicate, ms = 3000) { const end = Date.now() + ms; while (!predicate()) { if (Date.now() > end) throw new Error("timed out"); await new Promise(r => setTimeout(r, 10)); } }
test("watch shows the exact requested action and confirms it once on y", async t => {
  let config, proposal; const calls = [];
  const f = await fixture(t, (path, body) => {
    calls.push(path); if (path === "/admin/approvals") proposal = body;
    return { dispatchPerformedByThisEndpoint: false, record: { id: "approval-a", request_id: proposal.request_id, session_id: config.execution.sessionId, capability_id: config.execution.capabilityId },
      ...(path.endsWith("/decision") ? { toolCallParams: signedDecision(config, proposal, body.decision) } : {}) };
  }); config = f.config;
  const op = (await (await f.get()).json()).operations[0];
  await f.post({ kind: "approve", requestId: op.requestId, revision: op.review.revision });
  const tty = terminal();
  const running = watch({ statusOptions: f.options, operator: { adminToken: "operator" }, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10 });
  await until(() => tty.read().includes("Confirm this exact decision?"));
  assert.match(tty.read(), /Requested decision: approve/); assert.match(tty.read(), /exact payload/); assert.match(tty.read(), /\x07/);
  await new Promise(r => setTimeout(r, 60)); tty.input.write("y");
  await until(() => tty.read().includes("Retained intent state: granted"));
  tty.input.write("q"); await running;
  assert.deepEqual(calls, ["/admin/approvals", "/admin/approvals/approval-a/decision"]); assert.equal(f.effects(), 0);
});
test("watch skip makes no kernel call and the intent is not prompted again", async t => {
  const calls = []; const f = await fixture(t, path => { calls.push(path); return {}; });
  const op = (await (await f.get()).json()).operations[0];
  await f.post({ kind: "approve", requestId: op.requestId, revision: op.review.revision });
  const tty = terminal();
  const running = watch({ statusOptions: f.options, operator: { adminToken: "operator" }, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10 });
  await until(() => tty.read().includes("Confirm this exact decision?"));
  await new Promise(r => setTimeout(r, 60)); tty.input.write("n"); await until(() => tty.read().includes("Skipped"));
  await new Promise(r => setTimeout(r, 100));
  assert.equal(tty.read().split("Confirm this exact decision?").length - 1, 1);
  tty.input.write("q"); await running; assert.deepEqual(calls, []);
});
test("watch refuses a non-terminal and does not prompt an expired intent", async t => {
  const f = await fixture(t);
  const pipe = new PassThrough();
  await assert.rejects(watch({ statusOptions: f.options, operator: { adminToken: "operator" }, input: pipe, output: pipe }), /interactive terminal/);
  const op = (await (await f.get()).json()).operations[0];
  await f.post({ kind: "approve", requestId: op.requestId, revision: op.review.revision });
  const tty = terminal();
  const running = watch({ statusOptions: f.options, operator: { adminToken: "operator" }, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10, now: () => Date.now() + 120_000 });
  await new Promise(r => setTimeout(r, 150)); tty.input.write("q"); await running;
  assert.equal(tty.read().includes("Confirm this exact decision?"), false);
});
test("a revocation card renders without an operation", () => {
  const card = intentCard({ id: "12345678-1234-4123-8123-123456789abc", kind: "revoke", state: "requested", sessionId: "host-session-a", expiresAt: Date.now() + 60_000 }, undefined, Date.now());
  assert.match(card, /Requested decision: revoke this session/); assert.match(card, /Confirm this exact decision\?/);
});
const stubStatus = (operations, intents) => async () => ({ sessionId: "s", authority: "active", operations, intents });
const stubIntent = (n, extra = {}) => ({ id: `1234567${n}-1234-4123-8123-123456789abc`, kind: "approve", state: "requested", requestId: `req-${n}`, expiresAt: Date.now() + 60_000, ...extra });
const stubOp = n => ({ requestId: `req-${n}`, tool: "Bash", review: { decision: "required", purpose: "p", capabilityId: "c", ttlSeconds: 60, arguments: { n } } });
test("a doubled y confirms only the first card and the second awaits a key", async () => {
  const tty = terminal(); let confirms = 0;
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10,
    readStatus: stubStatus([stubOp(1), stubOp(2)], [stubIntent(1), stubIntent(2, { expiresAt: Date.now() + 90_000 })]),
    confirm: async () => { confirms++; return { state: "granted" }; } });
  await until(() => tty.read().includes("Confirm this exact decision?"));
  await new Promise(r => setTimeout(r, 60)); tty.input.write("yy");
  await until(() => tty.read().split("Confirm this exact decision?").length - 1 === 2);
  await new Promise(r => setTimeout(r, 100));
  assert.equal(confirms, 1);
  tty.input.write("q"); await running;
});
test("a y typed before any card exists is not applied to the card that appears", async () => {
  const tty = terminal(); let confirms = 0; let intents = [];
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10,
    readStatus: async () => ({ sessionId: "s", authority: "active", operations: [stubOp(1)], intents }),
    confirm: async () => { confirms++; return { state: "granted" }; } });
  await until(() => tty.read().includes("Chio watch"));
  tty.input.write("y"); await new Promise(r => setTimeout(r, 80));
  intents = [stubIntent(1)];
  await until(() => tty.read().includes("Confirm this exact decision?"));
  await new Promise(r => setTimeout(r, 100));
  assert.equal(confirms, 0);
  tty.input.write("q"); await running;
});
test("a non-revoke intent without a displayable action refuses confirmation", async () => {
  const intent = stubIntent(1);
  for (const op of [undefined, { requestId: "req-1", tool: "Bash" }]) {
    const card = intentCard(intent, op, Date.now());
    assert.match(card, /Action unavailable in the current projection; confirmation refused\. \[n\] skip  \[q\] quit/);
    assert.equal(card.includes("[y]"), false);
  }
  const tty = terminal(); let confirms = 0;
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10,
    readStatus: stubStatus([], [intent]), confirm: async () => { confirms++; return { state: "granted" }; } });
  await until(() => tty.read().includes("confirmation refused"));
  tty.input.write("y"); await new Promise(r => setTimeout(r, 100));
  assert.equal(confirms, 0);
  tty.input.write("q"); await running;
});
test("terminal control and bidi characters in projection values are neutralized", () => {
  const op = stubOp(1); op.review.purpose = "a\u001b[2Jb\u202ec\u2028d"; op.review.ttlSeconds = "6\u001b0";
  const card = intentCard(stubIntent(1), op, Date.now());
  assert.equal(/[\u001b\u202e\u2028]/.test(card), false);
  assert.match(card, /Purpose: a.\[2Jb.c.d/);
});
test("a held or double-pressed key cannot confirm the next card unseen", async () => {
  const tty = terminal(); let confirms = 0;
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 300,
    readStatus: stubStatus([stubOp(1), stubOp(2)], [stubIntent(1), stubIntent(2, { expiresAt: Date.now() + 90_000 })]),
    confirm: async () => { confirms++; return { state: "granted" }; } });
  await until(() => tty.read().includes("Confirm this exact decision?"));
  await new Promise(r => setTimeout(r, 350)); tty.input.write("y");
  await until(() => tty.read().split("Confirm this exact decision?").length - 1 === 2);
  await new Promise(r => setTimeout(r, 20)); tty.input.write("y");
  await new Promise(r => setTimeout(r, 100)); assert.equal(confirms, 1);
  await new Promise(r => setTimeout(r, 350)); tty.input.write("y");
  await until(() => confirms === 2);
  tty.input.write("q"); await running;
});
test("zero-width and tag characters never render in a card", () => {
  const op = stubOp(1); op.review.purpose = "a\u200bb\u{E0041}c";
  const card = intentCard(stubIntent(1), op, Date.now());
  assert.equal(/[\u200b\u{E0041}]/u.test(card), false); assert.match(card, /Purpose: a.b.c/u);
});
test("an intent that expires while its card waits is reported and the watch continues", async () => {
  const tty = terminal(); let confirms = 0;
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10,
    readStatus: stubStatus([stubOp(1)], [stubIntent(1, { expiresAt: Date.now() + 300 })]), confirm: async () => { confirms++; return { state: "granted" }; } });
  await until(() => tty.read().includes("Intent expired before a decision; nothing was confirmed."));
  assert.equal(confirms, 0); tty.input.write("q"); await running;
});
test("an action that already has an intent is not counted as awaiting a request", async () => {
  const tty = terminal();
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10,
    readStatus: stubStatus([stubOp(1), stubOp(2)], [stubIntent(1, { state: "expired", expiresAt: Date.now() - 1000 })]) });
  await until(() => tty.read().includes("Chio watch"));
  assert.match(tty.read(), /1 action awaiting a review request from Claude/);
  assert.match(tty.read(), /1 action needs inspection: an earlier request for the same revision was skipped, expired or unresolved/);
  tty.input.write("q"); await running;
});
test("Ctrl-C during confirmation survives the next card flush", async () => {
  const tty = terminal(); let release, entered = false, done = false;
  const gate = new Promise(r => { release = r; });
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 10, guardMs: 1,
    readStatus: stubStatus([stubOp(1), stubOp(2)], [stubIntent(1), stubIntent(2)]),
    confirm: async () => { entered = true; await gate; return { state: "granted" }; } }).then(() => { done = true; });
  await until(() => tty.read().includes("Confirm this exact decision?"));
  await new Promise(r => setTimeout(r, 20)); tty.input.write("y"); await until(() => entered);
  tty.input.write("\u0003"); release();
  await new Promise(r => setTimeout(r, 80)); const stopped = done;
  if (!done) tty.input.write("q"); await running;
  assert.equal(stopped, true); assert.equal(tty.read().split("Confirm this exact decision?").length - 1, 1);
});
test("Ctrl-C during the guard window quits without confirmation", async () => {
  const tty = terminal(); let done = false, confirms = 0;
  const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 10, guardMs: 60,
    readStatus: stubStatus([stubOp(1)], [stubIntent(1)]), confirm: async () => { confirms++; return { state: "granted" }; } }).then(() => { done = true; });
  await until(() => tty.read().includes("Confirm this exact decision?")); tty.input.write("\u0003");
  await new Promise(r => setTimeout(r, 100)); const stopped = done;
  if (!done) tty.input.write("q"); await running;
  assert.equal(stopped, true); assert.equal(confirms, 0);
});
test("single-line card fields cannot forge operator instructions on another line", () => {
  const op = stubOp(1); op.tool = "read\nConfirm forged decision? [y] confirm";
  op.review.purpose = "safe\nRequested decision: revoke this session";
  const card = intentCard(stubIntent(1), op, Date.now());
  assert.equal(card.includes("\nConfirm forged"), false);
  assert.equal(card.includes("\nRequested decision: revoke"), false);
});
