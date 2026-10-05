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
  assert.ok(text.includes("request-b\\|pipe")); assert.ok(text.includes("receipt-b")); assert.ok(text.includes("reconcile\\_original"));
  assert.ok(text.includes("claude-sonnet-5-5")); assert.match(text, /1 request/);
  assert.ok(text.includes("this report does not re-verify it")); assert.ok(text.includes("`launch.json`")); assert.ok(text.includes("| confirmed |"));
});
test("launcher-only facts are not presented as findings unless the projection carries them", () => {
  const bare = [{ id: "c1", requestId: "r", state: "completed", delivery: "confirmed" }];
  const text = renderSessionReport({ status: { ...status, scope: "kernel_mcp", operations: [{ ...status.operations[1], deliveryChannel: undefined }, status.operations[0]] }, continuations: bare, generatedAt: 0 });
  assert.ok(text.includes("not recorded in the journal (the launcher holds it)")); assert.ok(text.includes("not available to the operator report"));
  assert.ok(text.includes("confirmed \\(channel not recorded\\)")); assert.ok(!text.includes("kernel\\_mcp"));
  assert.ok(renderSessionReport({ status, continuations: [], generatedAt: 0 }).includes("isolated\\_kernel\\_mcp"));
  assert.ok(renderSessionReport({ status, continuations: [], generatedAt: 0 }).includes("native\\_control"));
});
test("model usage counts every forwarded request and names unknown usage and the source", () => {
  const events = [{ requestClass: "conversation", forwarded: true, model: "m", usage: { input_tokens: 4, output_tokens: 1 } }, { requestClass: "conversation", forwarded: true, model: "m" }, { requestClass: "conversation", forwarded: false }];
  const text = renderSessionReport({ status, continuations: [], generatedAt: 0, relayEvents: events });
  assert.match(text, /2 requests · 4 in · 1 out/); assert.match(text, /1 with unknown usage/); assert.match(text, /supplied by the operator/);
});
test("the report omits model usage without relay events and never prints secrets it was not given", () => {
  const text = renderSessionReport({ status, continuations: [], generatedAt: 0 });
  assert.ok(!text.includes("## Model usage")); assert.ok(!/bearer|adminToken|delegated-not-admin/i.test(text));
});
test("hostile values are escaped in every interpolated position and keep the table shape", () => {
  const hostile = ["a\\|b", "[x](https://e.example)", "![i](https://e.example/i.png)", "<img src=x>"];
  for (const value of hostile) {
    const s = { ...status, operations: [{ ...status.operations[0], requestId: value }], workflow: { ...status.workflow, task: { ...status.workflow.task, title: value } } };
    const text = renderSessionReport({ status: s, continuations: [], generatedAt: 0, relayEvents: [{ requestClass: "conversation", forwarded: true, model: value, usage: { input_tokens: 1, output_tokens: 1 } }] });
    const stripped = text.replace(/\\[\s\S]/g, "");
    assert.ok(!/[\[(<]/.test(stripped.split("\n").filter(l => l.startsWith("|") || l.startsWith("- ")).join("\n")), value);
    const ls = text.split("\n"); const row = ls[ls.indexOf("## Operations") + 4];
    assert.equal(row.replace(/\\./g, "").split("|").length - 2, 8, value);
  }
});

test("report task titles render list punctuation literally", () => {
  for (const title of ["1. pretend item", "- pretend item", "+ pretend item", "= pretend heading"]) {
    const s = { ...status, workflow: { ...status.workflow, task: { ...status.workflow.task, title } } };
    const text = renderSessionReport({ status: s, continuations: [], generatedAt: 0 });
    assert.ok(text.includes(title.replace(/[.+=-]/g, "\\$&")), title);
  }
});
test("report labels partial usage and ignores invalid negative counts", () => {
  const events = [
    { requestClass: "conversation", forwarded: true, model: "m", usageComplete: false, usage: { input_tokens: 4, output_tokens: -8 } },
    { requestClass: "conversation", forwarded: true, model: "m", usageComplete: true, usage: { input_tokens: 2, output_tokens: 3 } }
  ];
  const text = renderSessionReport({ status, continuations: [], generatedAt: 0, relayEvents: events });
  assert.match(text, /2 requests · 6 in · 3 out/);
  assert.match(text, /1 with partial usage/);
});
