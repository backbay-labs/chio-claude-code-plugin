import { expect, test } from "claude-code/testing";
import type { On, CommandRunInput, HttpResponse } from "claude-code";
import type { ControlStatus } from "../types/control.js";

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
  on("http.fetch", ($, e) => {
    if (e.init?.method === "POST") {
      if (!post) throw new Error("unexpected intent post");
      return { value: post(e.init.body ?? "") };
    }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(getStatus()) } };
  });
}
test("native status reports kernel MCP scope and actual session without a model", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  const answer = await $.command.run(command("chio-status"));
  expect(answer.text).toContain("kernel MCP tools only"); expect(answer.text).toContain("Session: session-a"); expect(answer.text).toContain("1 review");
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
