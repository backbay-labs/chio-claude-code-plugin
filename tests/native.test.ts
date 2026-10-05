import { expect, mock, test } from "claude-code/testing";
import type { On, CommandRunInput, HttpResponse } from "claude-code";
import type { ControlStatus } from "../types/control.js";
import { transitions } from "../hooks/native/projection.ts";
import { outcomeHash, shareText } from "../hooks/native/workflow.ts";

const options = { control_url: "http://127.0.0.1:12345", control_token: "a".repeat(64) };
function command(name: string, args = ""): CommandRunInput { return { command: name, args, origin: { kind: "composer" }, presentation: { isFullscreen: false, columns: 80 } }; }
const paneProps = { title: "Chio", placement: "inline" as const, isFocused: true, bodyColumns: 80, scroll: { offset: 0, bodyRows: 24 }, view: {} };
function projection(sessionId = "session-a"): ControlStatus {
  return { schema: "chio.control.status.v1", sessionId, checkedAt: Date.now(), scope: "kernel_mcp", authority: "live", authorityExpiresAt: Math.floor(Date.now() / 1000) + 600,
    protectedTools: ["write_file"], revision: "b".repeat(64), awaitingReview: 1, unresolved: 0, fenced: true, intents: [],
    operations: [{ requestId: "request-a", tool: "write_file", state: "awaiting_approval", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "review",
      review: { revision: "c".repeat(64), purpose: "exact test write", arguments: { path: "/protected/out.txt", content: "exact payload" }, capabilityId: "cap-a", ttlSeconds: 300, restrictions: "kernel_policy", budgetImpact: "unavailable", decision: "required" } }] };
}
function stub(on: On, getSession: () => string, getStatus: () => ControlStatus, post?: (body: string) => HttpResponse) {
  on("session.id", () => ({ value: getSession() }));
  on("ui.close", () => ({ value: undefined }));
  on("command.register", ($, e) => ({ value: { command: e.name } }));
  on("session.start", ($, e) => ({ cwd: e.cwd }));
  on("prompt.context", ($, e) => ({ blocks: e.blocks }));
  on("http.fetch", ($, e) => {
    if (e.init?.method === "POST") {
      if (!post) throw new Error("unexpected intent post");
      return { value: post(e.init.body ?? "") };
    }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(getStatus()) } };
  });
}
function taskProjection(): ControlStatus {
  const value = projection();
  const scope = { resources: ["Disposable protected repository"], destinations: ["Preview only"], restrictions: ["No release"], source: "operator_template" as const, budget: "unavailable" as const };
  value.workflow = { continuation: true, proposals: true, templates: [{ id: "fix", title: "Fix regression", revision: "d".repeat(64), allowedTools: ["write_file"], ttlSeconds: 600, scope }],
    task: { id: "task-a", sessionId: value.sessionId, revision: "e".repeat(64), title: "Fix regression", goal: "Prove the exact artifact", artifact: { kind: "git_commit", digest: "f".repeat(40), label: "fixture commit" }, readiness: "outstanding", scope,
      requirements: [{ id: "local", title: "Local checks", state: "passed", evidenceClass: "trusted_collector_observation" }, { id: "hosted", title: "Hosted checks", state: "running", evidenceClass: "trusted_collector_observation" }, { id: "production", title: "Production check", state: "outstanding", evidenceClass: "none" }] } };
  return value;
}
test("completion separates local, hosted and production evidence for the exact artifact", { options }, async ($, on) => {
  stub(on, () => "session-a", () => taskProjection());
  const answer = await $.command.run(command("chio-completion"));
  expect(answer.text).toContain("Local checks · passed"); expect(answer.text).toContain("Hosted checks · running"); expect(answer.text).toContain("Production check · outstanding");
  expect(answer.text).toContain("f".repeat(40)); expect(answer.text).toContain("does not admit or perform a release");
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ type: "Text", text: "Preview only" })).toBeDefined(); expect(await ui.find({ key: "task-fix" })).toBeDefined(); await ui.unmount();
});
test("task selection sends a revision-bound request without granting authority", { options }, async ($, on) => {
  let posted: Record<string, unknown> | undefined;
  stub(on, () => "session-a", () => taskProjection(), body => { posted = JSON.parse(body); return { status: 202, ok: true, headers: {}, text: '{"state":"requested","authorityAccepted":false,"dispatchPerformed":false}' }; });
  const answer = await $.command.run(command("chio-task", "fix"));
  expect(posted?.templateId).toBe("fix"); expect(posted?.revision).toBe("d".repeat(64));
  expect(answer.text).toContain("no authority granted or action dispatched");
});
test("the typed namespace powers session status without starting a model turn", { options }, async ($, on) => {
  stub(on, () => "session-a", () => taskProjection());
  const answer = await $.command.run(command("chio-status"));
  expect(answer.text).toContain("session-a"); expect(answer.text).toContain("kernel MCP tools only");
});
test("only an exact granted action exposes deterministic continuation", { options }, async ($, on) => {
  let value = taskProjection(), posts = 0;
  const continuationId = "12345678-1234-4123-8123-123456789abc";
  stub(on, () => "session-a", () => value, body => {
    const request = JSON.parse(body); posts++;
    expect(request).toEqual({ requestId: "request-a", revision: "c".repeat(64) });
    return { status: 202, ok: true, headers: {}, text: JSON.stringify({ continuation: { id: continuationId, requestId: "request-a", state: "submitted", delivery: "pending" } }) };
  });
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ key: "continue" })).toBeUndefined();
  value.operations[0]!.review!.decision = "granted"; value.operations[0]!.nextAction = "explicit_resume";
  await $.command.run(command("chio-review", "request-a"));
  expect(await ui.find({ key: "continue" })).toBeDefined();
  await ui.press({ key: "continue" }); expect(posts).toBe(1);
  expect(await ui.find({ type: "Text", text: "Continuation submitted" })).toBeDefined(); await ui.unmount();
});
test("foreign task evidence is rejected while completion remains scoped to the host", { options }, async ($, on) => {
  const value = taskProjection(); value.workflow!.task!.sessionId = "foreign";
  stub(on, () => "session-a", () => value);
  expect((await $.command.run(command("chio-status"))).text).toContain("disconnected");
});
test("native status reports kernel MCP scope and actual session without a model", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  const answer = await $.command.run(command("chio-status"));
  expect(answer.text).toContain("kernel MCP tools only"); expect(answer.text).toContain("Session: session-a"); expect(answer.text).toContain("1 review");
});
test("doctor distinguishes denial and uncertain effects without submitting an intent", { options }, async ($, on) => {
  const value = projection();
  value.operations.push({ requestId: "uncertain", state: "unknown", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "reconcile_original" },
    { requestId: "denied", state: "denied", evidence: "verified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "linked_continuation" });
  stub(on, () => "session-a", () => value);
  const result = await $.command.run(command("chio-doctor"));
  expect(result.text).toContain("Uncertain original outcomes: 1");
  expect(result.text).toContain("Retained denials: 1");
  expect(result.text).toContain("Guest execution and storage: unchecked");
  expect(result.text).toContain("do not retry the effect");
  expect(result.text).toContain("No control intent or protected action was submitted");
});
test("doctor reports disconnection and expired authority separately", { options }, async ($, on) => {
  let value = projection("foreign"); stub(on, () => "session-a", () => value);
  const disconnected = await $.command.run(command("chio-doctor"));
  expect(disconnected.exitCode).toBe(1); expect(disconnected.text).toContain("Control infrastructure unavailable");
  value = projection(); value.authorityExpiresAt = Math.floor(Date.now() / 1000) - 1;
  const expired = await $.command.run(command("chio-doctor"));
  expect(expired.text).toContain("Authority: expired"); expect(expired.text).toContain("Control infrastructure: reachable");
});
test("clear, resume and fork rebind to the host session and discard foreign evidence", { options }, async ($, on) => {
  let session = "session-a"; stub(on, () => session, () => projection());
  on("classic.SessionStart", () => ({}));
  expect((await $.command.run(command("chio-evidence", "request-a"))).text).toContain("exact payload");
  for (const source of ["clear", "resume", "fork"] as const) {
    session = `session-${source}`;
    await $.classic.SessionStart({ source });
    const answer = await $.command.run(command("chio-status"));
    expect(answer.text).toContain(`Session: ${session}`); expect(answer.text).toContain("disconnected"); expect(answer.text).not.toContain("exact payload");
  }
});
test("compact review keeps exact payload visible and expands retained evidence on request", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: { ...paneProps, bodyColumns: 38 } });
  expect(await ui.find({ type: "Text", text: "exact payload" })).toBeDefined(); expect(await ui.find({ key: "approve" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: "Kernel acknowledgement" })).toBeUndefined();
  await ui.press({ key: "details" });
  expect(await ui.find({ type: "Text", text: "Kernel acknowledgement: unconfirmed" })).toBeDefined();
  await ui.unmount();
});
test("disconnection never claims authority or another session's evidence", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection("session-b"));
  expect((await $.command.run(command("chio-status"))).text).toContain("disconnected");
  expect((await $.command.run(command("chio-evidence", "request-a"))).exitCode).toBe(1);
});
test("revocation rejects a foreign session argument without posting intent", { options }, async ($, on) => {
  let requests = 0; stub(on, () => "session-a", () => { requests++; return projection(); });
  const result = await $.command.run(command("chio-revoke", "session-b"));
  expect(result.exitCode).toBe(1); expect(requests).toBe(0);
});
test("MCP observation failure preserves the original result without redispatch", { options }, async ($, on) => {
  let dispatched = 0;
  on("tool.call", () => { dispatched++; return { result: "original" }; });
  on("session.id", () => { throw new Error("host lookup failed"); });
  const answer = await $.tool.call({ tool: "mcp__chio__write_file", path: "/protected/out.txt", content: "exact payload" });
  expect(dispatched).toBe(1); expect(answer.result).toBe("original");
});
test("review and uncertain recovery remain usable across terminal widths and surfaces", { options }, async ($, on) => {
  let value = projection(); stub(on, () => "session-a", () => value);
  await $.command.run(command("chio-review", "request-a"));
  for (const surface of ["terminal", "desktop", "vscode", "mobile"] as const) {
    for (const bodyColumns of [72, 110, 160]) {
      const ui = await $.ui.mount({ plugin: "chio", surface, component: "Pane", requestId: "chio", props: { ...paneProps, bodyColumns } });
      expect(await ui.find({ type: "Text", text: "exact payload" })).toBeDefined();
      expect(await ui.find({ key: "approve" })).toBeDefined();
      await ui.unmount();
    }
  }
  value = { ...projection(), awaitingReview: 0, unresolved: 1, operations: [{ requestId: "request-a", state: "unknown", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "reconcile_original" }] };
  await $.command.run(command("chio-evidence", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ type: "Text", text: "dispatch fence remains intact" })).toBeDefined(); expect(await ui.find({ key: "approve" })).toBeUndefined();
  expect(await ui.find({ type: "Button", text: "Retry" })).toBeUndefined(); await ui.unmount();
});
test("review button records exact intent without claiming a grant or effect", { options }, async ($, on) => {
  let posted: unknown;
  stub(on, () => "session-a", () => projection(), body => {
    posted = JSON.parse(body);
    return { status: 202, ok: true, headers: {}, text: JSON.stringify({ intent: { id: "12345678-1234-4123-8123-123456789abc", state: "requested", sessionId: "session-a" }, authorityAccepted: false, dispatchPerformed: false }) };
  });
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  await ui.press({ key: "approve" });
  expect(posted).toEqual({ kind: "approve", requestId: "request-a", revision: "c".repeat(64) });
  expect(await ui.find({ type: "Text", text: "trusted operator confirmation required" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: "Authority granted." })).toBeUndefined();
  await ui.unmount();
});
test("changed review while its pane is open rejects the old button and never posts", { options }, async ($, on) => {
  let value = projection(); let posts = 0;
  stub(on, () => "session-a", () => value, () => { posts++; throw new Error("changed action was posted"); });
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  value = projection(); const review = value.operations[0]!.review!; review.revision = "d".repeat(64); review.arguments.content = "changed payload";
  await ui.press({ key: "approve" });
  expect(posts).toBe(0); expect(await ui.find({ type: "Text", text: "Approval unconfirmed" })).toBeDefined();
  await ui.unmount();
});
test("stale authority hides review controls and keeps the original evidence readable", { options }, async ($, on) => {
  const value = projection(); value.authorityExpiresAt = Math.floor(Date.now() / 1000) - 1;
  stub(on, () => "session-a", () => value);
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ key: "approve" })).toBeUndefined(); expect(await ui.find({ type: "Text", text: "authority unconfirmed" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: "exact payload" })).toBeDefined(); await ui.unmount();
});
test("a retained unknown decision shows its original state and cannot submit another review", { options }, async ($, on) => {
  const value = projection(); value.intents = [{ id: "12345678-1234-4123-8123-123456789abc", kind: "approve", state: "unknown", sessionId: value.sessionId, requestId: "request-a", expiresAt: Date.now() + 60_000 }];
  stub(on, () => "session-a", () => value);
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ type: "Text", text: "approve unknown" })).toBeDefined(); expect(await ui.find({ key: "approve" })).toBeUndefined();
  expect(await ui.find({ key: "decline" })).toBeUndefined(); await ui.unmount();
});

test("overlapping status refreshes share one read and both return the current projection", { options }, async ($, on) => {
  const clock = mock.clock(on);
  let reads = 0;
  let release!: () => void;
  const remote = new Promise<void>(resolve => { release = resolve; });
  on("session.id", () => ({ value: "session-a" }));
  on("ui.close", () => ({ value: undefined }));
  on("http.fetch", async () => {
    reads++; await remote;
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(projection()) } };
  });
  const answers = Promise.all([$.command.run(command("chio-status")), $.command.run(command("chio-status"))]);
  await clock.settle(); release();
  for (const answer of await answers) { expect(answer.exitCode).toBe(0); expect(answer.text).toContain("authority 10m"); }
  expect(reads).toBe(1);
});

test("review does not expose an alternative that has no supported continuation contract", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  await $.command.run(command("chio-review", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ key: "alternative" })).toBeUndefined();
  expect(await ui.find({ key: "approve" })).toBeDefined(); await ui.unmount();
});

test("a session change during a shared refresh cannot overwrite the new session's evidence", { options }, async ($, on) => {
  const clock = mock.clock(on); let actual = "session-a";
  let release!: () => void; const oldResponse = new Promise<void>(resolve => { release = resolve; });
  on("session.id", () => ({ value: actual })); on("ui.close", () => ({ value: undefined }));
  on("http.fetch", async ($, e) => {
    const session = e.url.includes("/sessions/session-a/") ? "session-a" : "session-b";
    if (session === "session-a") await oldResponse;
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(projection(session)) } };
  });
  const original = $.command.run(command("chio-status")); await clock.settle();
  actual = "session-b";
  const current = await $.command.run(command("chio-status")); expect(current.exitCode).toBe(0); expect(current.text).toContain("Session: session-b");
  release(); expect((await original).exitCode).toBe(1);
  const final = await $.command.run(command("chio-status")); expect(final.exitCode).toBe(0); expect(final.text).toContain("Session: session-b");
});
test("evidence opens the exact operation with evidence and authority details expanded", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  await $.command.run(command("chio-evidence", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ type: "Text", text: "Kernel acknowledgement: unconfirmed" })).toBeDefined();
  expect((await ui.find({ key: "details" }))?.props.label).toBe("Hide evidence and authority details");
  await ui.unmount();
});
function retainedOperations(count: number): ControlStatus {
  const value = projection();
  const completed = Array.from({ length: count - 1 }, (_, i) => ({ requestId: `request-done-${String(i).padStart(2, "0")}`, tool: "read_file", state: "completed" as const,
    evidence: "verified" as const, acknowledged: true, hostDeliveryConfirmed: true, nextAction: "none" as const }));
  value.operations = [...completed, value.operations[0]!];
  return value;
}
test("the pane lists actionable operations first and bounds the list", { options }, async ($, on) => {
  stub(on, () => "session-a", () => retainedOperations(30));
  await $.command.run(command("chio"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(String((await ui.find({ key: "operation-0" }))?.props.label)).toContain("awaiting_approval");
  expect(await ui.find({ key: "operation-11" })).toBeDefined();
  expect(await ui.find({ key: "operation-12" })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: "18 more retained operations not shown · the operator's control status lists every operation" })).toBeDefined();
  await ui.unmount();
});
test("exactly twelve retained operations need no overflow line", { options }, async ($, on) => {
  stub(on, () => "session-a", () => retainedOperations(12));
  await $.command.run(command("chio"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ key: "operation-11" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: "more retained operations" })).toBeUndefined();
  await ui.unmount();
});
test("lifecycle guidance joins the first-message context once, naming the protected tools", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  await $.command.run(command("chio-status"));
  const result = await $.prompt.context({ blocks: [{ name: "chio", text: "stale" }, { name: "currentDate", text: "today" }] });
  const chio = result.blocks.filter(block => block.name === "chio");
  expect(chio.length).toBe(1);
  expect(chio[0]!.text).toContain("Chio mediates these tools: write_file.");
  expect(chio[0]!.text).toContain("Never repeat the call.");
  expect(chio[0]!.text).toContain("Other tools in this session are not protected by Chio.");
  expect(result.blocks.some(block => block.name === "currentDate")).toBe(true);
});
test("disconnected status adds no guidance", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection("session-b"));
  await $.command.run(command("chio-status"));
  const result = await $.prompt.context({ blocks: [] });
  expect(result.blocks.some(block => block.name === "chio")).toBe(false);
});
test("isolated scope guidance says the session has no other tools", { options }, async ($, on) => {
  const value = projection(); value.scope = "isolated_kernel_mcp";
  stub(on, () => "session-a", () => value);
  await $.command.run(command("chio-status"));
  const text = (await $.prompt.context({ blocks: [] })).blocks.find(block => block.name === "chio")?.text ?? "";
  expect(text).toContain("This session has no other tools.");
});

function uncertain(value: ControlStatus): ControlStatus {
  value.operations = [{ requestId: "request-u", tool: "write_file", state: "unknown", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "reconcile_original" }];
  value.awaitingReview = 0; value.unresolved = 1; return value;
}
test("transitions are silent for a first projection or a reconnect", () => {
  const state = { authorityWarned: false };
  expect(transitions(null, projection(), Date.now(), state)).toEqual([]);
  expect(transitions(projection(), null, Date.now(), state)).toEqual([]);
});
test("transitions announce new reviews, new uncertain outcomes, near expiry once, and ready results", () => {
  const now = Date.now(), state = { authorityWarned: false };
  const quiet = projection(); quiet.awaitingReview = 0; quiet.operations = []; quiet.authorityExpiresAt = Math.floor(now / 1000) + 3600;
  const review = projection(); review.authorityExpiresAt = quiet.authorityExpiresAt;
  expect(transitions(quiet, review, now, state)).toEqual(["Chio · 1 action awaiting review · /chio-review"]);
  const unknown = uncertain(projection()); unknown.authorityExpiresAt = quiet.authorityExpiresAt;
  expect(transitions(quiet, unknown, now, state)).toEqual(["Chio · original outcome unresolved · /chio-doctor"]);
  const expiring = projection(); expiring.awaitingReview = 0; expiring.operations = []; expiring.authorityExpiresAt = Math.floor(now / 1000) + 240;
  expect(transitions(quiet, expiring, now, state)).toEqual(["Chio · authority expires in 4m"]);
  expect(transitions(quiet, expiring, now, state)).toEqual([]);
  const id = "12345678-1234-4123-8123-123456789abc";
  const submitted = projection(); submitted.authorityExpiresAt = quiet.authorityExpiresAt; submitted.continuations = [{ id, requestId: "request-a", state: "submitted", delivery: "pending" }];
  const completed = projection(); completed.authorityExpiresAt = quiet.authorityExpiresAt; completed.continuations = [{ id, requestId: "request-a", state: "completed", delivery: "pending" }];
  expect(transitions(submitted, completed, now, { authorityWarned: true })).toEqual([`Chio · original result ready · /chio-outcome ${id}`]);
});
for (const interactive of [true, false]) {
  test(`a new review ${interactive ? "shows" : "does not show"} a toast`, { options }, async ($, on) => {
    const toasts: string[] = []; let value = projection(); value.awaitingReview = 0; value.operations = [];
    stub(on, () => "session-a", () => value);
    on("ui.toast", ($, e) => { toasts.push(e.text); return { value: undefined }; });
    await $.session.start({ cwd: "/tmp", surface: null, isInteractive: interactive });
    await $.command.run(command("chio-status"));
    value = projection();
    await $.command.run(command("chio-status"));
    expect(toasts).toEqual(interactive ? ["Chio · 1 action awaiting review · /chio-review"] : []);
  });
}
const submit = (text: string) => ({ text, wait: false, origin: { kind: "composer" as const } });
const continuationId = "12345678-1234-4123-8123-123456789abc";
async function readyOutcome(result: unknown) {
  const outcome = { state: "completed", evidence: "verified", requestId: "request-a", result, receipt: { id: "receipt-a" } };
  return { schema: "chio.control.outcome.v1", ready: true, continuation: { id: continuationId, requestId: "request-a", state: "completed", delivery: "pending" }, outcome, outcomeHash: await outcomeHash(outcome), challenge: "c".repeat(64) };
}
function outcomeStub(on: On, getSession: () => string, ready: Record<string, unknown>, onAck?: () => void) {
  const value = projection(); value.continuations = [{ id: continuationId, requestId: "request-a", state: "completed", delivery: "pending" }];
  on("session.id", () => ({ value: getSession() }));
  on("ui.close", () => ({ value: undefined }));
  on("command.register", ($, e) => ({ value: { command: e.name } }));
  on("prompt.submit", ($, e) => ({ text: e.text, ...(e.context ? { context: e.context } : {}) }));
  on("http.fetch", ($, e) => {
    if (e.url.endsWith("/outcome")) return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(ready) } };
    if (e.url.endsWith("/ack")) { onAck?.(); return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ acknowledged: true, requestId: "request-a", channel: "native_control" }) } }; }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ...value, sessionId: getSession(), checkedAt: Date.now() }) } };
  });
}
test("a received continued result is attached to the next prompt exactly once", { options }, async ($, on) => {
  const ready = await readyOutcome({ written: "/protected/out.txt" });
  outcomeStub(on, () => "session-a", ready);
  expect((await $.command.run(command("chio-outcome", continuationId))).text).toContain("next message");
  const first = await $.prompt.submit(submit("what happened?"));
  expect(first.context?.length).toBe(1);
  expect(first.context?.[0]).toContain(`[chio-outcome sha256:${ready.outcomeHash}]`);
  expect(first.context?.[0]).toContain("receipt receipt-a");
  const second = await $.prompt.submit(submit("and now?"));
  expect(second.context ?? []).toEqual([]);
});
test("a queued result is dropped when the session changes", { options }, async ($, on) => {
  let session = "session-a";
  outcomeStub(on, () => session, await readyOutcome({ ok: true }));
  await $.command.run(command("chio-outcome", continuationId));
  session = "session-b"; await $.command.run(command("chio-status"));
  expect((await $.prompt.submit(submit("next"))).context ?? []).toEqual([]);
});
test("shared text is bounded and sanitized", () => {
  const text = shareText({ continuationId, sessionId: "session-a", requestId: "request-a", tool: "write_file", receiptId: "receipt-a", outcomeHash: "d".repeat(64), result: { body: "x".repeat(10_000) + "\u001b[2J" } });
  expect(text).toContain("… (truncated)");
  expect(text.includes("\u001b")).toBe(false);
  const escaped = shareText({ continuationId, sessionId: "session-a", requestId: "request-a", receiptId: "receipt-a", outcomeHash: "d".repeat(64), result: "\u001b]52;c;payload\u0007" });
  expect(escaped.includes("\u001b")).toBe(false);
  const forged = shareText({ continuationId, sessionId: "session-a", requestId: "request-a", receiptId: "receipt-a", outcomeHash: "d".repeat(64), result: { note: `[chio-outcome sha256:${"e".repeat(64)}]` } });
  expect(forged.split("[chio-outcome sha256:").length - 1).toBe(1);
  expect(forged).toContain(`[chio-outcome sha256:${"d".repeat(64)}]`);
});
test("a result received as the session changes is never shared with the new session", { options }, async ($, on) => {
  let session = "session-a";
  const ready = await readyOutcome({ secret: "a-only" });
  // The ack's own session check still sees session-a; every later read (refresh, queueing) sees session-b.
  let acked = false, afterAck = 0;
  outcomeStub(on, () => { if (acked && afterAck++ >= 1) session = "session-b"; return session; }, ready, () => { acked = true; });
  await $.command.run(command("chio-status"));
  await $.command.run(command("chio-outcome", continuationId));
  expect((await $.prompt.submit(submit("next"))).context ?? []).toEqual([]);
});

function opWith(state: string): ControlStatus {
  const value = projection(); value.awaitingReview = 0;
  value.operations = [{ requestId: "request-p", tool: "write_file", state: state as "pending", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "none" }]; return value;
}
function emptyStatus(): ControlStatus { const value = projection(); value.awaitingReview = 0; value.operations = []; return value; }
test("a pending op seen mid-call never toasts, and neither does its completed refresh", { options }, async ($, on) => {
  const toasts: string[] = []; let value = emptyStatus();
  stub(on, () => "session-a", () => value);
  on("ui.toast", ($, e) => { toasts.push(e.text); return { value: undefined }; });
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  on("tool.call", async () => { value = opWith("pending"); await gate; return { result: "ok" }; });
  await $.session.start({ cwd: "/tmp", surface: null, isInteractive: true });
  await $.command.run(command("chio-status"));
  const call = $.tool.call({ tool: "mcp__chio__write_file", path: "/protected/out.txt" });
  for (let i = 0; i < 200 && value.operations[0]?.state !== "pending"; i++) await Promise.resolve();
  await $.command.run(command("chio-status")); expect(toasts).toEqual([]);
  value = opWith("completed"); release(); expect((await call).result).toBe("ok");
  expect(toasts).toEqual([]);
  value = opWith("completed"); await $.command.run(command("chio-status"));
  expect(toasts).toEqual([]);
});
test("a pending op that remains after the call toasts once on the next refresh", { options }, async ($, on) => {
  const toasts: string[] = []; let value = emptyStatus();
  stub(on, () => "session-a", () => value);
  on("ui.toast", ($, e) => { toasts.push(e.text); return { value: undefined }; });
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  on("tool.call", async () => { value = opWith("pending"); await gate; return { result: "ok" }; });
  await $.session.start({ cwd: "/tmp", surface: null, isInteractive: true });
  await $.command.run(command("chio-status"));
  const call = $.tool.call({ tool: "mcp__chio__write_file", path: "/protected/out.txt" });
  for (let i = 0; i < 200 && value.operations[0]?.state !== "pending"; i++) await Promise.resolve();
  await $.command.run(command("chio-status")); expect(toasts).toEqual([]);
  release(); await call;
  await $.command.run(command("chio-status"));
  expect(toasts).toEqual(["Chio · original outcome unresolved · /chio-doctor"]);
});
test("transitions can ignore pending ops and remember the stored uncertain count", () => {
  const now = Date.now(), quiet = emptyStatus(), pending = opWith("pending"), unknown = opWith("unknown");
  const state: { authorityWarned: boolean; uncertain?: number } = { authorityWarned: true };
  expect(transitions(quiet, pending, now, state, true)).toEqual([]); expect(state.uncertain).toBe(0);
  expect(transitions(pending, pending, now, state)).toEqual(["Chio · original outcome unresolved · /chio-doctor"]); expect(state.uncertain).toBe(1);
  expect(transitions(pending, pending, now, state)).toEqual([]);
  expect(transitions(null, unknown, now, state)).toEqual([]); expect(state.uncertain).toBe(1);
  expect(transitions(quiet, unknown, now, { authorityWarned: true })).toEqual(["Chio · original outcome unresolved · /chio-doctor"]);
});
test("a throwing toast never nulls live status", { options }, async ($, on) => {
  let value = emptyStatus();
  stub(on, () => "session-a", () => value);
  on("ui.toast", () => { throw new Error("toast failed"); });
  await $.session.start({ cwd: "/tmp", surface: null, isInteractive: true });
  await $.command.run(command("chio-status"));
  value = projection();
  const answer = await $.command.run(command("chio-status"));
  expect(answer.text).not.toContain("disconnected"); expect(answer.exitCode).toBe(0);
});
test("a compact SessionStart keeps a queued share while clear drops it", { options }, async ($, on) => {
  outcomeStub(on, () => "session-a", await readyOutcome({ ok: true }));
  on("classic.SessionStart", () => ({}));
  await $.command.run(command("chio-outcome", continuationId));
  await $.classic.SessionStart({ source: "compact" });
  const kept = await $.prompt.submit(submit("next"));
  expect(kept.context?.length).toBe(1);
  await $.command.run(command("chio-outcome", continuationId));
  await $.classic.SessionStart({ source: "clear" });
  expect((await $.prompt.submit(submit("later"))).context ?? []).toEqual([]);
});
test("attaching a share replaces the not-yet-confirmed notice", { options }, async ($, on) => {
  outcomeStub(on, () => "session-a", await readyOutcome({ ok: true }));
  await $.command.run(command("chio-outcome", continuationId));
  await $.prompt.submit(submit("next"));
  const text = (await $.command.run(command("chio", ""))).text;
  expect(text).toContain("Original result attached to your message for Claude."); expect(text).not.toContain("not yet confirmed");
});
test("status prints relay-metered model usage when the projection carries it", { options }, async ($, on) => {
  const value = projection();
  value.modelUsage = { model: "claude-sonnet-5-5", requests: 3, inputTokens: 1200, outputTokens: 340, cacheCreationInputTokens: 0, cacheReadInputTokens: 800, budget: null, budgetReached: false };
  stub(on, () => "session-a", () => value);
  expect((await $.command.run(command("chio-status"))).text).toContain("Model usage (relay-metered): 3 requests · 1200 in · 340 out · 800 cache read · 0 cache write tokens");
});

test("status rejects a malformed model usage projection", { options }, async ($, on) => {
  const value = projection();
  (value as any).modelUsage = { model: "m", requests: -1, inputTokens: 1, outputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, budget: null, budgetReached: false };
  stub(on, () => "session-a", () => value);
  const text = (await $.command.run(command("chio-status"))).text;
  expect(text).not.toContain("Model usage");
});
