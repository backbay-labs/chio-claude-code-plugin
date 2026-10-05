import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedModelContext, observeModelContext } from "../scripts/model-context.mjs";
const hash = "a".repeat(64), other = "b".repeat(64);
const confirmed = { id: "c1", requestId: "request-a", state: "completed", delivery: "confirmed", outcomeHash: hash };
const user = content => ({ messages: [{ role: "user", content: "earlier" }, { role: "assistant", content: "ok" }, { role: "user", content }] });
test("only the exact hash of a natively confirmed continuation is model context", () => {
  assert.deepEqual(confirmedModelContext(user(`see [chio-outcome sha256:${hash}]`), [confirmed]), ["request-a"]);
  assert.deepEqual(confirmedModelContext(user([{ type: "text", text: "x" }, { type: "text", text: `[chio-outcome sha256:${hash}]` }]), [confirmed]), ["request-a"]);
  assert.deepEqual(confirmedModelContext(user(`[chio-outcome sha256:${other}]`), [confirmed]), []);
  assert.deepEqual(confirmedModelContext(user(`[chio-outcome sha256:${hash}]`), [{ ...confirmed, delivery: "pending" }]), []);
  assert.deepEqual(confirmedModelContext(user(`chio-outcome sha256:${hash}`), [confirmed]), []);
});
test("a marker only in an earlier user message is not counted again", () => {
  const body = { messages: [{ role: "user", content: `[chio-outcome sha256:${hash}]` }, { role: "assistant", content: "ok" }, { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "x" }] }] };
  assert.deepEqual(confirmedModelContext(body, [confirmed]), []);
});
test("malformed bodies and failing journal reads never throw", () => {
  assert.deepEqual(confirmedModelContext(undefined, [confirmed]), []);
  assert.deepEqual(confirmedModelContext({ messages: "x" }, [confirmed]), []);
  const recorded = [];
  observeModelContext(user(`[chio-outcome sha256:${hash}]`), () => { throw new Error("journal unavailable"); }, id => recorded.push(id));
  assert.deepEqual(recorded, []);
  observeModelContext(user(`[chio-outcome sha256:${hash}]`), () => [confirmed], id => recorded.push(id));
  assert.deepEqual(recorded, ["request-a"]);
});
