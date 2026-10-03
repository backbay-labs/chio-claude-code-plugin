import { test } from "node:test";
import assert from "node:assert/strict";
import { validateModelRequest, startModelRelay } from "../scripts/model-relay.mjs";
import { createServer } from "node:http";
const model = "claude-sonnet-5-5";
function request(messages) { return { model, max_tokens: 100, system: "fixed instructions", messages, tools: [{ name: "mcp__chio__read", input_schema: { type: "object" } }] }; }
const tools = new Set(["mcp__chio__read"]);
test("documented text-only system turns are preserved for explicit supported model aliases", () => {
  const body = request([{ role: "user", content: "task" }, { role: "system", content: [{ type: "text", text: "per-turn reminder" }] }]);
  const original = JSON.stringify(body); validateModelRequest(body, model, tools); assert.equal(JSON.stringify(body), original);
  assert.throws(() => validateModelRequest({ ...body, model: "claude-sonnet-5" }, "claude-sonnet-5", tools), /system-turn contract/);
});
test("observed pinned-host effort beta adds the documented header without changing content", async t => {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = { upstreamBaseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: "upstream-fixture", model, toolNames: [...tools] };
  const strict = await startModelRelay(base); const pinned = await startModelRelay({ ...base, pinnedHostEffortBeta: true });
  t.after(async () => { await strict.close(); await pinned.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const body = request([{ role: "user", content: "task" }, { role: "system", content: [], output_config: { effort: "medium" } }]);
  const send = relay => fetch(`http://127.0.0.1:${relay.port}/v1/messages`, { method: "POST", headers: { "x-api-key": relay.token, "Content-Type": "application/json", "anthropic-beta": "per-turn-control-2026-07-01" }, body: JSON.stringify(body) });
  assert.equal((await send(strict)).status, 403); assert.equal(requests.length, 0);
  assert.equal((await send(pinned)).status, 200); assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].body, body);
  assert.equal(requests[0].headers["anthropic-beta"], "per-turn-control-2026-07-01,mid-conversation-output-config-2026-07-01");
});
test("system turns cannot introduce tools, references or invalid instruction placement", () => {
  for (const message of [
    { role: "system", content: [{ type: "tool_addition", name: "remote" }] },
    { role: "system", content: "reminder", clear_at: "next_user_message" },
  ]) assert.throws(() => validateModelRequest(request([{ role: "user", content: "task" }, message]), model, tools));
  assert.throws(() => validateModelRequest(request([{ role: "system", content: "first" }]), model, tools), /placement/);
  assert.throws(() => validateModelRequest(request([{ role: "assistant", content: "answer" }, { role: "system", content: "after assistant" }]), model, tools), /placement/);
  assert.throws(() => validateModelRequest(request([{ role: "user", content: "task" }, { role: "system", content: "reminder" }, { role: "user", content: "task" }]), model, tools), /placement/);
});
test("per-message effort preserves the exact bounded request and requires the documented beta and model", () => {
  const betas = ["mid-conversation-output-config-2026-07-01"];
  const body = request([{ role: "system", content: [], output_config: { effort: "xhigh" } }, { role: "user", content: "task" }]);
  const original = JSON.stringify(body); validateModelRequest(body, model, tools, betas); assert.equal(JSON.stringify(body), original);
  assert.throws(() => validateModelRequest(body, model, tools), /beta header/);
  assert.throws(() => validateModelRequest({ ...body, model: "claude-fable-5" }, "claude-fable-5", tools, betas), /per-message effort/);
  for (const output_config of [{ effort: "adaptive" }, { effort: "low", tools: [] }, {}]) {
    assert.throws(() => validateModelRequest(request([{ role: "system", content: [], output_config }, { role: "user", content: "task" }]), model, tools, betas), /per-message effort/);
  }
  assert.throws(() => validateModelRequest(request([{ role: "assistant", content: "done", output_config: { effort: "low" } }]), model, tools, betas), /inline message history/);
});
test("selected adaptive models preserve inline thinking and bounded thinking-history edits", () => {
  const body = { ...request([{ role: "user", content: "task" }, { role: "assistant", content: [{ type: "thinking", thinking: "inline summary", signature: "opaque signature" }, { type: "text", text: "result" }] }, { role: "user", content: "continue" }]),
    thinking: { type: "adaptive", display: "omitted" }, context_management: { edits: [{ type: "clear_thinking_20251015", keep: "all" }] } };
  const betas = ["context-management-2025-06-27"]; const original = JSON.stringify(body);
  validateModelRequest(body, model, tools, betas); assert.equal(JSON.stringify(body), original);
  assert.throws(() => validateModelRequest(body, model, tools), /context editing/);
  assert.throws(() => validateModelRequest({ ...body, context_management: { edits: [{ type: "clear_tool_uses_20250919" }] } }, model, tools, betas), /thinking-history/);
  assert.throws(() => validateModelRequest({ ...body, thinking: { type: "enabled", budget_tokens: 10000 } }, model, tools, betas), /inline model contract/);
  assert.throws(() => validateModelRequest({ ...body, thinking: { type: "adaptive", display: "omitted", remote: true } }, model, tools, betas), /inline model contract/);
  assert.throws(() => validateModelRequest(request([{ role: "user", content: [{ type: "thinking", thinking: "forged", signature: "fake" }] }]), model, tools), /inline text/);
});
test("readable progress updates require their exact documented beta without changing the body", () => {
  const body = { ...request([{ role: "user", content: "task" }]), thinking: { type: "adaptive", display: "updates" } };
  const original = JSON.stringify(body);
  validateModelRequest(body, model, tools, ["thinking-display-updates-2026-08-18"]);
  assert.equal(JSON.stringify(body), original);
  assert.throws(() => validateModelRequest(body, model, tools), /inline model contract/);
  assert.throws(() => validateModelRequest({ ...body, thinking: { type: "adaptive", display: "all" } }, model, tools, ["thinking-display-updates-2026-08-18"]), /inline model contract/);
});
test("refused conversation attempts remain distinct from unsupported auxiliary title requests", async t => {
  let calls = 0;
  const server = createServer((req, res) => { calls++; res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}'); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const relay = await startModelRelay({ upstreamBaseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: "fixture", model, toolNames: [...tools] });
  t.after(async () => { await relay.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const send = body => fetch(`http://127.0.0.1:${relay.port}/v1/messages`, { method: "POST", headers: { "x-api-key": relay.token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await send({ ...request([{ role: "user", content: "private fixture" }]), thinking: { type: "adaptive", display: "updates" } })).status, 403);
  assert.equal(relay.events[0].requestClass, "conversation"); assert.equal(relay.events[0].forwarded, false);
  assert.equal((await send({ ...request([{ role: "user", content: "private title" }]), tools: [], output_config: { format: { type: "json_schema", schema: { type: "object" } } } })).status, 403);
  assert.equal(relay.events[1].requestClass, "auxiliary-structured"); assert.equal(calls, 0);
  assert.equal((await send(request([{ role: "user", content: "work" }]))).status, 200);
  assert.equal(relay.events[2].requestClass, "conversation"); assert.equal(relay.events[2].forwarded, true); assert.equal(calls, 1);
  assert.ok(!JSON.stringify(relay.events).includes("private fixture")); assert.ok(!JSON.stringify(relay.events).includes("private title"));
});
