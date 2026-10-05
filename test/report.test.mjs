import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSessionReport } from "../dist/control/service.js";
const status = { schema: "chio.control.status.v1", sessionId: "host-session-a", checkedAt: 1_000, scope: "isolated_kernel_mcp", authority: "live", authorityExpiresAt: 2_000, protectedTools: ["write_file"],
  revision: "b".repeat(64), awaitingReview: 1, unresolved: 1, fenced: true,
  operations: [
    { requestId: "request-a", tool: "write_file", state: "awaiting_approval", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "review" },
    { requestId: "request-b|pipe", tool: "write_file", state: "completed", evidence: "verified", receiptId: "receipt-b", acknowledged: true, hostDeliveryConfirmed: true, deliveryChannel: "native_control", nextAction: "none" },
    { requestId: "request-c", tool: "write_file", state: "unknown", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "reconcile_original" }],
  intents: [{ id: "12345678-1234-4123-8123-123456789abc", kind: "approve", state: "granted", sessionId: "host-session-a", requestId: "request-b|pipe", expiresAt: 1_500 }],
  workflow: { templates: [], continuation: true, proposals: false, task: { id: "task-a", sessionId: "host-session-a", revision: "e".repeat(64), title: "Fix regression", goal: "Prove the artifact",
    artifact: { kind: "git_commit", digest: "f".repeat(40), label: "fixture" }, readiness: "outstanding",
    requirements: [{ id: "ci", title: "GitHub CI", state: "running", evidenceClass: "trusted_collector_observation", observedAt: 1_200, source: "github check-runs · o/r · 2 checks · abc" }],
    scope: { resources: [], destinations: [], restrictions: [], source: "operator_template", budget: "unavailable" } } } };
const continuations = [{ id: "c1", requestId: "request-b|pipe", state: "completed", delivery: "confirmed", modelContext: "confirmed" }];
test("the report renders every section and escapes table cells", () => {
  const relayEvents = [{ requestClass: "conversation", forwarded: true, model: "claude-sonnet-5-5", usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 2 } }];
  const text = renderSessionReport({ status, continuations, generatedAt: Date.UTC(2026, 9, 4), relayEvents });
  for (const heading of ["# Chio session report", "## Operations", "## Decisions", "## Continuations", "## Task", "## Model usage", "## What this report is"]) assert.ok(text.includes(heading), heading);
  assert.ok(text.includes("request-b\\|pipe")); assert.ok(text.includes("receipt-b")); assert.ok(text.includes("reconcile_original"));
  assert.ok(text.includes("claude-sonnet-5-5")); assert.match(text, /1 request/);
});
test("the report omits model usage without relay events and never prints secrets it was not given", () => {
  const text = renderSessionReport({ status, continuations: [], generatedAt: 0 });
  assert.ok(!text.includes("## Model usage")); assert.ok(!/bearer|adminToken|delegated-not-admin/i.test(text));
});
