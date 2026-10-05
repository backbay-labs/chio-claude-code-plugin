import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGateway, gatewayApprovalPath, operationKey } from "../dist/gateway.js";
import { verifyCompletedOutcome } from "@chio/bridge";
import { startControlServer, controlStatus, controlReport } from "../dist/control/service.js";
import { privateSave, privateDirectory } from "../dist/workflow/store.js";
import { signer, signedDecision, signedOutcome } from "./workflow-fixture.mjs";

async function fixture(t, mode = "completed") {
  const root = mkdtempSync(join(tmpdir(), "chio-continuation-"));
  const config = { sessionId: randomUUID(), journalDir: join(root, "journal"), tools: [{ name: "write_file", inputSchema: { type: "object" } }],
    execution: { endpoint: "http://127.0.0.1:1", bearerToken: "delegated-fixture", trustedSigners: [signer], subjectKey: "b2".repeat(32), capabilityId: "cap-a", serverId: "resource-a", sessionId: "kernel-session-a" },
    approval: { requiredTools: ["write_file"], purpose: "Exact fixture write", ttlSeconds: 300 } };
  let effects = 0, charges = 0, acks = 0, live = true, modelContext = () => false;
  let gateway = createGateway(config, {
    execute: async request => {
      effects++; charges++;
      if (mode === "unknown") return { state: "unknown", evidence: "unverified", requestId: request.requestId, reason: "fixture lost response after effect" };
      const result = signedOutcome(config, request); assert.equal(verifyCompletedOutcome(result, config.execution, request), true);
      return result;
    },
    acknowledge: async result => { acks++; return mode === "ack_unknown" ? { acknowledged: false, reason: "fixture lost kernel ACK response" } : { acknowledged: true, requestId: result.requestId }; },
  }, { requireHostAcknowledgement: true });
  const proposal = await gateway.call("fixture-original", "write_file", { path: "/protected/out.txt", content: "Exact payload" });
  let control = await startControlServer({ config, authorityExpiresAt: Math.floor(Date.now() / 1000) + 600, validateAuthority: async () => live, modelContextConfirmed: id => modelContext(id),
    workflow: { propose: (id, tool, args) => gateway.call("control:" + id, tool, args),
      resume: (id, requestId, tool, args) => gateway.call("control:" + id, "chio_resume", { requestId, tool, arguments: args }),
      acknowledge: result => gateway.acknowledgeReceivedOutcome(result) } });
  t.after(async () => { await control.close(); gateway.close(); rmSync(root, { recursive: true, force: true }); });
  const headers = { Authorization: "Bearer " + control.token, "Content-Type": "application/json" };
  const request = (path, value) => fetch(control.url + "/sessions/" + config.sessionId + path, { headers, ...(value === undefined ? {} : { method: "POST", body: JSON.stringify(value) }) });
  const approve = () => { privateDirectory(join(config.journalDir, "approvals")); privateSave(gatewayApprovalPath(config, proposal.requestId), { toolCallParams: signedDecision(config, proposal.proposal) }, true); };
  const status = async () => (await request("/status")).json();
  const restart = async () => {
    await control.close(); gateway.close();
    gateway = createGateway(config, { execute: async request => { effects++; charges++; return signedOutcome(config, request); }, acknowledge: async result => { acks++; return { acknowledged: true, requestId: result.requestId }; } }, { requireHostAcknowledgement: true });
    control = await startControlServer({ config, authorityExpiresAt: Math.floor(Date.now() / 1000) + 600, validateAuthority: async () => live, modelContextConfirmed: id => modelContext(id),
      workflow: { resume: (id, requestId, tool, args) => gateway.call("control:" + id, "chio_resume", { requestId, tool, arguments: args }), acknowledge: result => gateway.acknowledgeReceivedOutcome(result) } });
    headers.Authorization = "Bearer " + control.token;
  };
  return { root, config, gateway, proposal, approve, request, status, restart, setLive: value => { live = value; }, setModelContext: value => { modelContext = value; }, retained: () => control.retainedContinuations(), counts: () => ({ effects, charges, acks }) };
}
test("exact native continuation retains one operation, effect, charge and proven delivery", async t => {
  const f = await fixture(t); f.approve();
  const op = (await f.status()).operations[0]; assert.equal(op.review.decision, "granted");
  const input = { requestId: op.requestId, revision: op.review.revision };
  const response = await f.request("/continuations", input); assert.equal(response.status, 202);
  const { continuation } = await response.json();
  assert.equal((await f.request("/continuations", input)).status, 409);
  let outcome;
  for (let i = 0; i < 5; i++) { outcome = await (await f.request("/continuations/" + continuation.id + "/outcome")).json(); if (outcome.ready) break; }
  assert.equal(outcome.ready, true); assert.equal(outcome.outcome.requestId, f.proposal.requestId);
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 0 });
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { outcomeHash: "0".repeat(64), challenge: outcome.challenge })).status, 409);
  const proof = { outcomeHash: outcome.outcomeHash, challenge: outcome.challenge };
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", proof)).status, 200);
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", proof)).status, 200);
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 1 });
  const current = await f.status(); assert.equal(current.fenced, false); assert.equal(current.operations[0].deliveryChannel, "native_control");
  assert.equal(current.operations[0].acknowledged, true); assert.equal(current.continuations[0].delivery, "confirmed");
  assert.equal(JSON.stringify(current).includes(outcome.challenge), false);
});
test("continuation refuses absent, stale, changed, foreign and disconnected grants", async t => {
  const f = await fixture(t); let op = (await f.status()).operations[0];
  assert.equal((await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).status, 409);
  f.approve(); op = (await f.status()).operations[0];
  for (const input of [
    { requestId: op.requestId, revision: "0".repeat(64) },
    { requestId: "foreign", revision: op.review.revision },
    { requestId: op.requestId, revision: op.review.revision, arguments: { content: "changed" } },
  ]) assert.equal((await f.request("/continuations", input)).status, 409);
  f.setLive(false); assert.equal((await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).status, 409);
  assert.deepEqual(f.counts(), { effects: 0, charges: 0, acks: 0 });
});
test("lost response after an effect remains unknown and repeated controls cannot redispatch", async t => {
  const f = await fixture(t, "unknown"); f.approve(); const op = (await f.status()).operations[0];
  const input = { requestId: op.requestId, revision: op.review.revision };
  const { continuation } = await (await f.request("/continuations", input)).json();
  const result = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  assert.equal(result.ready, false); assert.equal(result.continuation.state, "unknown");
  assert.equal((await f.request("/continuations", input)).status, 409);
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { challenge: "a".repeat(64), outcomeHash: "b".repeat(64) })).status, 409);
  assert.equal((await f.status()).fenced, true); assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 0 });
});
test("read-only status and an unserved outcome cannot confirm native delivery", async t => {
  const f = await fixture(t); f.approve(); const op = (await f.status()).operations[0];
  const { continuation } = await (await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).json();
  const current = await f.status(); assert.equal(current.continuations[0].delivery, "pending");
  const record = JSON.parse(readFileSync(join(f.config.journalDir, "workflow/continuations", continuation.id + ".json")));
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { challenge: record.challenge, outcomeHash: record.outcomeHash })).status, 409);
  assert.equal((await f.status()).fenced, true); assert.equal(f.counts().acks, 0);
});
test("connector proposals only retain reviewed tools and reuse the original transport identity", async t => {
  const f = await fixture(t); const id = randomUUID();
  const bad = { id, tool: "Bash", arguments: { command: "touch /protected/bypass" } };
  assert.equal((await f.request("/proposals", bad)).status, 409);
  // The existing review fence blocks a different proposal, without a second effect.
  assert.equal((await f.request("/proposals", { ...bad, tool: "write_file", arguments: { path: "/protected/other.txt", content: "Different" } })).status, 409);
  assert.equal((await f.request("/proposals", { ...bad, tool: "write_file", arguments: { path: "/protected/changed.txt", content: "Changed" } })).status, 409);
  assert.deepEqual(f.counts(), { effects: 0, charges: 0, acks: 0 });
  const explanation = await (await f.request("/explanations/" + encodeURIComponent(f.proposal.requestId))).json();
  assert.equal(explanation.policyRehearsal, "unavailable"); assert.equal(explanation.informationFlow, "unknown");
  assert.equal(explanation.source, "retained_gateway");
});

test("unknown original outcomes and their continuation fences survive a controller restart", async t => {
  const f = await fixture(t, "unknown"); f.approve(); const op = (await f.status()).operations[0];
  const input = { requestId: op.requestId, revision: op.review.revision };
  const { continuation } = await (await f.request("/continuations", input)).json();
  assert.equal((await (await f.request("/continuations/" + continuation.id + "/outcome")).json()).continuation.state, "unknown");
  await f.restart();
  const current = await f.status(); assert.equal(current.operations[0].requestId, op.requestId); assert.equal(current.operations[0].state, "unknown");
  assert.equal(current.fenced, true); assert.equal(current.continuations[0].id, continuation.id);
  assert.equal((await f.request("/continuations", input)).status, 409);
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 0 });
});

test("native receipt remains distinct from an unconfirmed kernel acknowledgement", async t => {
  const f = await fixture(t, "ack_unknown"); f.approve(); const op = (await f.status()).operations[0];
  const { continuation } = await (await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).json();
  const original = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { outcomeHash: original.outcomeHash, challenge: original.challenge })).status, 409);
  const current = await f.status(); assert.equal(current.operations[0].deliveryChannel, "native_control");
  assert.equal(current.operations[0].hostDeliveryConfirmed, true); assert.equal(current.operations[0].acknowledged, false);
  assert.equal(current.continuations[0].receiptConfirmed, true); assert.equal(current.continuations[0].delivery, "pending"); assert.equal(current.fenced, true);
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 1 });
});

for (const interruptedState of ["submitted", "unknown"]) test("restart recovers an original verified result after continuation persistence was interrupted: " + interruptedState, async t => {
  const f = await fixture(t); f.approve(); const op = (await f.status()).operations[0];
  const input = { requestId: op.requestId, revision: op.review.revision };
  const { continuation } = await (await f.request("/continuations", input)).json();
  const original = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  assert.equal(original.ready, true);
  const path = join(f.config.journalDir, "workflow/continuations", continuation.id + ".json");
  const record = JSON.parse(readFileSync(path));
  delete record.outcome; delete record.outcomeHash; delete record.challenge; delete record.served;
  record.state = interruptedState; privateSave(path, record);
  await f.restart();
  const recovered = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  assert.equal(recovered.ready, true); assert.equal(recovered.outcome.requestId, op.requestId);
  assert.deepEqual(recovered.outcome, original.outcome); assert.equal((await f.status()).fenced, true);
  assert.equal((await f.request("/continuations", input)).status, 409);
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { outcomeHash: recovered.outcomeHash, challenge: recovered.challenge })).status, 200);
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 1 });
});

test("restart recognizes an already retained kernel ACK without sending a second acknowledgement", async t => {
  const f = await fixture(t); f.approve(); const op = (await f.status()).operations[0];
  const { continuation } = await (await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).json();
  const original = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  const proof = { outcomeHash: original.outcomeHash, challenge: original.challenge };
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", proof)).status, 200);
  const path = join(f.config.journalDir, "workflow/continuations", continuation.id + ".json");
  const record = JSON.parse(readFileSync(path)); record.delivery = "pending"; privateSave(path, record);
  await f.restart();
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", proof)).status, 200);
  assert.equal((await f.status()).continuations[0].delivery, "confirmed");
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 1 });
});

test("a signed completion cannot be projected as evidence for a different retained operation", async t => {
  const f = await fixture(t); f.approve(); const op = (await f.status()).operations[0];
  const { continuation } = await (await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).json();
  await f.request("/continuations/" + continuation.id + "/outcome");
  const path = join(f.config.journalDir, operationKey(op.requestId) + ".json");
  const record = JSON.parse(readFileSync(path)); record.requestId = "substituted-operation"; record.acknowledged = true; record.hostDeliveryConfirmed = true;
  privateSave(path, record); renameSync(path, join(f.config.journalDir, operationKey(record.requestId) + ".json"));
  const status = await controlStatus({ config: f.config, authorityExpiresAt: Math.floor(Date.now() / 1000) + 600, validateAuthority: async () => true });
  assert.equal(status.operations[0].state, "unknown"); assert.equal(status.operations[0].evidence, "unverified");
  assert.equal(status.operations[0].receiptId, undefined); assert.equal(status.fenced, true);
  assert.equal(status.operations[0].acknowledged, false); assert.equal(status.operations[0].hostDeliveryConfirmed, false);
});

test("relay-observed model context is projected only for natively confirmed continuations", async t => {
  const f = await fixture(t); f.approve(); const op = (await f.status()).operations[0];
  const { continuation } = await (await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).json();
  const original = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  f.setModelContext(id => id === op.requestId);
  assert.equal((await f.status()).continuations[0].modelContext, undefined);
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { outcomeHash: original.outcomeHash, challenge: original.challenge })).status, 200);
  const current = await f.status(); assert.equal(current.continuations[0].delivery, "confirmed"); assert.equal(current.continuations[0].modelContext, "confirmed");
  assert.deepEqual(f.retained().map(c => c.id), current.continuations.map(c => c.id));
  await f.restart();
  assert.equal((await f.status()).continuations[0].modelContext, "confirmed");
  assert.deepEqual(f.counts(), { effects: 1, charges: 1, acks: 1 });
  f.setModelContext(() => false);
  assert.equal("modelContext" in (await f.status()).continuations[0], false);
});
test("the operator report projects a recoverable continuation without writing the journal", async t => {
  const f = await fixture(t); f.approve(); const op = (await f.status()).operations[0];
  const { continuation } = await (await f.request("/continuations", { requestId: op.requestId, revision: op.review.revision })).json();
  let outcome; for (let i = 0; i < 5; i++) { outcome = await (await f.request("/continuations/" + continuation.id + "/outcome")).json(); if (outcome.ready) break; }
  const path = join(f.config.journalDir, "workflow/continuations", continuation.id + ".json");
  const record = JSON.parse(readFileSync(path));
  delete record.outcome; delete record.outcomeHash; delete record.challenge; delete record.served; record.state = "submitted"; privateSave(path, record);
  const before = readFileSync(path);
  const report = await controlReport({ config: f.config, authorityExpiresAt: Math.floor(Date.now() / 1000) + 600 });
  assert.equal(report.continuations.find(c => c.id === continuation.id).state, "completed");
  assert.deepEqual(readFileSync(path), before);
  const recovered = await (await f.request("/continuations/" + continuation.id + "/outcome")).json();
  assert.equal(recovered.ready, true);
  assert.equal((await f.request("/continuations/" + continuation.id + "/ack", { outcomeHash: recovered.outcomeHash, challenge: recovered.challenge })).status, 200);
});
test("a report on an unused workflow never creates journal directories", async t => {
  const f = await fixture(t);
  for (const dir of ["workflow", "control-intents", "approvals"]) rmSync(join(f.config.journalDir, dir), { recursive: true, force: true });
  const before = readdirSync(f.config.journalDir).sort();
  const report = await controlReport({ config: f.config, authorityExpiresAt: 0 });
  assert.deepEqual(report.continuations, []);
  assert.deepEqual(readdirSync(f.config.journalDir).sort(), before);
});

test("full proposal retention refuses a new host request before writing another record", async t => {
  const f = await fixture(t), directory = join(f.config.journalDir, "workflow", "proposals");
  for (let i = 0; i < 1000; i++) writeFileSync(join(directory, randomUUID() + ".json"), "{}", { mode: 0o600 });
  assert.equal((await f.request("/proposals", { id: randomUUID(), tool: "write_file", arguments: { path: "blocked", content: "x" } })).status, 409);
  assert.equal(readdirSync(directory).length, 1000);
  assert.deepEqual(f.counts(), { effects: 0, charges: 0, acks: 0 });
});
test("new workflow records stop at capacity while retained records and acknowledgements remain writable", async t => {
  const root = mkdtempSync(join(tmpdir(), "chio-workflow-quota-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (let i = 0; i < 1000; i++) writeFileSync(join(root, i + ".json"), "{}", { mode: 0o600 });
  assert.throws(() => privateSave(join(root, "overflow.json"), {}, true), /retention/);
  privateSave(join(root, "0.json"), { retained: true });
  privateSave(join(root, "0.ack-claim"), { proof: true }, true);
  assert.equal(JSON.parse(readFileSync(join(root, "0.json"), "utf8")).retained, true);
  assert.equal(readdirSync(root).filter(n => n.endsWith(".json")).length, 1000);
});
