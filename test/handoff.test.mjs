import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandoff, verifyHandoff } from "../dist/workflow/handoff.js";
import { seed, signer } from "./workflow-fixture.mjs";

test("operator-signed handoff retains source requirements and uncertain identities without authority", () => {
  const task = { id: "task-a", sessionId: "source-a", goal: "Fix regression", artifact: { kind: "git_commit", digest: "a".repeat(40), label: "source" }, requirements: [{ id: "production", state: "outstanding" }] };
  const status = { sessionId: "source-a", operations: [{ requestId: "original-unknown", state: "unknown", nextAction: "reconcile_original" }], bearerToken: "must-not-copy", capabilityId: "must-not-copy" };
  const capsule = createHandoff(task, status, seed), verified = verifyHandoff(capsule, signer);
  assert.equal(verified.authorityTransferred, false); assert.equal(verified.snapshot.task.requirements[0].state, "outstanding");
  assert.equal(verified.snapshot.retainedOperations[0].requestId, "original-unknown");
  assert.equal(JSON.stringify(capsule).includes("must-not-copy"), false);
  assert.match(verified.next, /Recollect evidence/);
  assert.throws(() => verifyHandoff(capsule, "b".repeat(64)), /independent signer/);
  const changed = structuredClone(capsule); changed.body.task.artifact.digest = "b".repeat(40);
  assert.throws(() => verifyHandoff(changed, signer), /signature/);
  changed.body.authorityTransferred = true; assert.throws(() => verifyHandoff(changed, signer), /invalid/);
});
