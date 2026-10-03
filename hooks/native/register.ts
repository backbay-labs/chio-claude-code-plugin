import type { EngineInterface, PluginOptions, Register } from "claude-code";
import type { ControlStatus, IntentKind, OperationView } from "../../types/control.js";
import type { Chio } from "../../types/chio.js";
import type { ExplanationView, ContinuationView } from "../../types/workflow.js";
import { controlOrigin, outcomeHash, taskText } from "./workflow.ts";
import { operationText, outcomeRequestId, parseStatus, safeText, statusLine } from "./projection.ts";

let sessionId = "";
let status: ControlStatus | null = null;
let selectedId: string | null = null;
let showDetails = false;
let interactive = false;
let notice = "";
let generation = 0;
let pane: "operations" | "task" = "operations";

function endpoint(base: string): string {
  const url = new URL(base);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("exact loopback control origin required");
  return url.origin;
}
async function refresh($: EngineInterface, options: PluginOptions): Promise<ControlStatus | null> {
  const actual = await $.session.id();
  if (actual !== sessionId) {
    sessionId = actual; pane = "operations"; status = null; selectedId = null; showDetails = false; notice = ""; generation += 1;
    await $.ui.close({ id: "chio" });
  }
  const thisGeneration = ++generation;
  let stage = "configuration";
  try {
    stage = "transport";
    const received = await $.chio.status();
    if (thisGeneration !== generation || await $.session.id() !== actual) return null;
    status = received;
  } catch {
    $.ui.log(`Chio control refresh unavailable at ${stage}`, { to: "debug" });
    if (thisGeneration === generation) { status = null; notice = "Control service disconnected. No authority decision was inferred."; }
  }
  $.ui.invalidate("ui.render");
  return thisGeneration === generation ? status : null;
}
async function request($: EngineInterface, options: PluginOptions, kind: IntentKind, operation?: OperationView): Promise<string> {
  const capturedSession = sessionId;
  const capturedRevision = kind === "revoke" ? status?.revision : operation?.review?.revision;
  const current = await refresh($, options);
  const original = operation && current?.operations.find(op => op.requestId === operation.requestId);
  if (!current || current.authority !== "live" || capturedSession !== current.sessionId || !capturedRevision
    || (kind === "revoke" ? current.revision !== capturedRevision : !original?.review || original.review.revision !== capturedRevision || original.review.decision !== "required")) throw new Error("review changed, expired, or disconnected; reopen the current action");
  const base = typeof options.control_url === "string" ? options.control_url : await $.env.get("CHIO_CONTROL_URL");
  const token = typeof options.control_token === "string" ? options.control_token : await $.env.get("CHIO_CONTROL_TOKEN");
  if (!base || !token) throw new Error("scoped control service disconnected");
  const response = await $.http.fetch(`${endpoint(base)}/sessions/${encodeURIComponent(current.sessionId)}/intents`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind, revision: capturedRevision, ...(operation ? { requestId: operation.requestId } : {}) }),
  });
  if (!response.ok || response.text.length > 4096) throw new Error("intent was not confirmed; inspect status before another request");
  const result = JSON.parse(response.text) as { intent?: { id?: string; state?: string; sessionId?: string }; authorityAccepted?: boolean; dispatchPerformed?: boolean };
  if (result.intent?.state !== "requested" || result.intent.sessionId !== capturedSession || typeof result.intent.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.intent.id) || result.authorityAccepted !== false || result.dispatchPerformed !== false) throw new Error("unexpected control acknowledgement; authority remains unconfirmed");
  if (await $.session.id() !== capturedSession) throw new Error("session changed while requesting control; inspect the original session");
  notice = `${kind} requested · ${result.intent.id} · trusted operator confirmation required`;
  await refresh($, options);
  return notice;
}
async function open($: EngineInterface, options: PluginOptions, requestId?: string): Promise<string> {
  const current = await refresh($, options);
  pane = "operations";
  selectedId = requestId ?? current?.operations.find(op => op.review?.decision === "required" || op.nextAction !== "none")?.requestId ?? null;
  showDetails = false;
  if (requestId && !current?.operations.some(op => op.requestId === requestId)) throw new Error("no retained operation for this session and request id");
  const operation = current?.operations.find(op => op.requestId === selectedId);
  const text = [statusLine(current, Date.now()), `Session: ${safeText(sessionId)}`, ...(operation ? [operationText(operation)] : []), ...(notice ? [notice] : [])].join("\n");
  if (interactive) await $.ui.open({ id: "chio", title: "Chio", focus: true, closeOnEscape: true });
  return text;
}
export const register: Register = (on, options) => {
  on("engine.create", async (_, e, next) => {
    const $ = await next(e);
    // engine.create forbids passing its built table as an argument. Namespace
    // methods close over it and spell every core call explicitly here.
    async function send(path: string, input?: unknown) {
      const session = await $.session.id();
      const base = typeof options.control_url === "string" ? options.control_url : await $.env.get("CHIO_CONTROL_URL");
      const token = typeof options.control_token === "string" ? options.control_token : await $.env.get("CHIO_CONTROL_TOKEN");
      if (!base || !token || !/^[0-9a-f]{64}$/.test(token)) throw new Error("scoped control unavailable");
      const response = await $.http.fetch(controlOrigin(base) + "/sessions/" + encodeURIComponent(session) + path, {
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        ...(input === undefined ? {} : { method: "POST", body: JSON.stringify(input) }),
      });
      if (!response.ok || response.text.length > 1024 * 1024 || await $.session.id() !== session) throw new Error("scoped control unavailable or session changed");
      return { session, value: JSON.parse(response.text) as Record<string, any> };
    }
    async function read() {
      const result = await send("/status"), current = parseStatus(JSON.stringify(result.value), result.session);
      if (current.checkedAt > Date.now() + 5000 || Date.now() - current.checkedAt > 10_000) throw new Error("stale status");
      return current;
    }
    const chio: Chio = {
      status: () => read(), task: async () => (await read()).workflow?.task ?? null,
      explain: async input => (await send("/explanations/" + encodeURIComponent(input.requestId))).value as unknown as ExplanationView,
      selectTask: async input => (await send("/task-requests", { id: crypto.randomUUID(), ...input })).value,
      requestReview: async input => (await send("/intents", input)).value,
      propose: async input => (await send("/proposals", input)).value,
      continueAction: async input => (await send("/continuations", input)).value.continuation as ContinuationView,
      receiveOutcome: async input => {
        const value = (await send("/continuations/" + encodeURIComponent(input.continuationId) + "/outcome")).value;
        if (value.ready !== true) return { ready: false as const, continuation: value.continuation as ContinuationView };
        if (value.schema !== "chio.control.outcome.v1" || value.continuation?.id !== input.continuationId || value.outcome?.state !== "completed" || value.outcome?.evidence !== "verified"
          || value.outcome.requestId !== value.continuation.requestId || !/^[0-9a-f]{64}$/.test(value.challenge) || await outcomeHash(value.outcome) !== value.outcomeHash) throw new Error("outcome changed; no acknowledgement sent");
        const ack = (await send("/continuations/" + encodeURIComponent(input.continuationId) + "/ack", { challenge: value.challenge, outcomeHash: value.outcomeHash })).value;
        if (ack.acknowledged !== true || ack.requestId !== value.outcome.requestId || ack.channel !== "native_control") throw new Error("native delivery unconfirmed");
        return { ready: true as const, requestId: value.outcome.requestId as string, result: value.outcome.result as unknown, receiptId: value.outcome.receipt.id as string, channel: "native_control" as const };
      },
    };
    return { ...$, chio };
  });
  on("session.start", async ($, e, next) => {
    interactive = e.isInteractive;
    for (const command of [
      { name: "chio", description: "Inspect Chio scope and retained work" },
      { name: "chio-status", description: "Read this session's protection and authority status" },
      { name: "chio-review", description: "Review a retained exact action", argumentHint: "[request-id]" },
      { name: "chio-evidence", description: "Inspect original operation evidence", argumentHint: "[request-id]" },
      { name: "chio-revoke", description: "Request this session's revocation" },
      { name: "chio-task", description: "Inspect the task and request an operator-defined scope", argumentHint: "[template-id]" },
      { name: "chio-completion", description: "Inspect completion evidence against the exact artifact" },
      { name: "chio-continue", description: "Continue a kernel-approved original action", argumentHint: "request-id" },
      { name: "chio-outcome", description: "Receive a retained native continuation outcome", argumentHint: "continuation-id" },
      { name: "chio-why", description: "Inspect the retained reason for an operation", argumentHint: "request-id" },
    ]) {
      try { await $.command.register({ ...command, immediate: true }); }
      catch { $.ui.log("Chio command registration unavailable: " + command.name, { to: "debug" }); }
    }
    await refresh($, options);
    if (interactive) $.clock.every(3000, () => refresh($, options));
    return next(e);
  }).catch(($, e, next) => next(e));

  on("classic.SessionStart", async ($, e, next) => {
    // /clear, resume and fork do not fire session.start; always re-resolve the host id.
    status = null; selectedId = null; showDetails = false; generation += 1;
    await refresh($, options); return next(e);
  }).catch(($, e, next) => next(e));

  on("command.run", { command: "chio" }, async ($) => ({ text: await open($, options) }))
    .catch(() => ({ text: "Chio controls unavailable. Authority remains unconfirmed.", exitCode: 1 }));
  on("command.run", { command: "chio-status" }, async ($) => {
    const current = await refresh($, options);
    return { text: `${statusLine(current, Date.now())}\nSession: ${safeText(sessionId)}${current ? `\nProtected tools: ${current.protectedTools.join(", ")}\nDispatch fence: ${current.fenced ? "retained" : "clear"}` : ""}`, exitCode: current ? 0 : 1 };
  }).catch(() => ({ text: "Chio status unavailable. Authority remains unconfirmed.", exitCode: 1 }));
  on("command.run", { command: "chio-review" }, async ($, e) => ({ text: await open($, options, e.args.trim() || undefined) }))
    .catch(() => ({ text: "Chio review unavailable for this exact session and action.", exitCode: 1 }));
  on("command.run", { command: "chio-evidence" }, async ($, e) => ({ text: await open($, options, e.args.trim() || undefined) }))
    .catch(() => ({ text: "Chio evidence unavailable for this exact session and action.", exitCode: 1 }));
  on("command.run", { command: "chio-revoke" }, async ($, e) => {
    if (e.args.trim()) return { text: "Revocation always targets the current session; arguments are refused.", exitCode: 1 };
    await refresh($, options); return { text: await request($, options, "revoke") };
  }).catch(() => ({ text: "Revocation unconfirmed. Inspect the original session's status before requesting again.", exitCode: 1 }));

  on("command.run", { command: "chio-completion" }, async ($, e) => {
    if (e.args.trim()) throw new Error("completion targets the current task");
    const current = await refresh($, options); pane = "task";
    if (interactive) await $.ui.open({ id: "chio", title: "Chio task", focus: true, closeOnEscape: true });
    return { text: taskText(current?.workflow?.task, current?.workflow?.templates) };
  }).catch(() => ({ text: "Task evidence unavailable for this session.", exitCode: 1 }));
  on("command.run", { command: "chio-task" }, async ($, e) => {
    const current = await refresh($, options); pane = "task";
    const id = e.args.trim();
    if (id) {
      const template = current?.workflow?.templates.find(t => t.id === id);
      if (!template) throw new Error("no current operator template");
      await $.chio.selectTask({ templateId: template.id, revision: template.revision });
      notice = "Task scope requested. The trusted operator prepares a new delegated session; no authority granted or action dispatched.";
    }
    if (interactive) await $.ui.open({ id: "chio", title: "Chio task", focus: true, closeOnEscape: true });
    return { text: taskText(current?.workflow?.task, current?.workflow?.templates) + (id ? "\n" + notice : "") };
  }).catch(() => ({ text: "Task request unconfirmed. Inspect the original session.", exitCode: 1 }));
  on("command.run", { command: "chio-continue" }, async ($, e) => {
    const current = await refresh($, options), operation = current?.operations.find(o => o.requestId === e.args.trim());
    if (!operation?.review) throw new Error("exact granted operation required");
    const continuation = await $.chio.continueAction({ requestId: operation.requestId, revision: operation.review.revision });
    notice = "Continuation submitted for original operation " + continuation.requestId + ". Receive its result with /chio-outcome " + continuation.id + ". No planning turn was started.";
    await refresh($, options); return { text: notice };
  }).catch(() => ({ text: "Continuation unavailable or unresolved. Inspect the original operation; do not retry its effect.", exitCode: 1 }));
  on("command.run", { command: "chio-outcome" }, async ($, e) => {
    const result = await $.chio.receiveOutcome({ continuationId: e.args.trim() });
    if (!result.ready) return { text: "Original continuation " + result.continuation.state + ". Its fence remains intact." };
    notice = "Original result received through native control. This does not claim delivery to the model.";
    await refresh($, options); return { text: notice + "\n" + safeText(JSON.stringify(result.result, null, 2)) + "\nReceipt: " + safeText(result.receiptId) };
  }).catch(() => ({ text: "Original result or its delivery remains unresolved. Inspect retained evidence; do not dispatch again.", exitCode: 1 }));
  on("command.run", { command: "chio-why" }, async ($, e) => {
    const reason = await $.chio.explain({ requestId: e.args.trim() });
    return { text: safeText(reason.reason) + "\nSource: " + reason.source + "\nPolicy rehearsal: unavailable · resource preview: unavailable · information lineage: unknown" };
  }).catch(() => ({ text: "Retained explanation unavailable for this exact operation.", exitCode: 1 }));

  on("tool.call", { tool: "mcp__chio__*" }, async ($, e, next) => {
    const result = await next(e); await refresh($, options); return result;
  }).catch(($, e, next) => next(e)); // Observation only; replay-safe preservation after next.
  on("turn.complete", async ($, e, next) => { await refresh($, options); return next(e); })
    .catch(($, e, next) => next(e));

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const existing = await next(e);
    const { Box, Text } = $.ui.resolve(e);
    return Box({ flexDirection: "column", children: [existing, Text({ dimColor: true, children: statusLine(status, Date.now()) })] });
  }).catch(($, e, next) => next(e));
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    const existing = await next(e);
    if (!e.props.tool.startsWith("mcp__chio__")) return existing;
    const requestId = outcomeRequestId(e.props.output);
    const operation = status?.operations.find(op => op.requestId === requestId);
    if (!operation) return existing;
    const { Box, Button } = $.ui.resolve(e);
    return Box({ flexDirection: "column", children: [existing, Button({ key: "chio-evidence", label: `Chio evidence · ${operation.evidence} · ${operation.state}`,
      onPress: async () => { try { await open($, options, operation.requestId); } catch { notice = "Evidence unavailable for the current session."; $.ui.invalidate("ui.render"); } } })] });
  }).catch(($, e, next) => next(e));
  on("ui.render", { component: "Pane" }, ($, e, next) => {
    if (e.requestId !== "chio") return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    if (pane === "task") {
      const rows = [Text({ children: statusLine(status, Date.now()) }), Text({ children: taskText(status?.workflow?.task, status?.workflow?.templates) }), Text({ children: safeText(notice) })];
      for (const template of status?.workflow?.templates ?? []) rows.push(Button({ key: "task-" + template.id, label: "Request scope: " + safeText(template.title), onPress: async () => {
        try { await $.chio.selectTask({ templateId: template.id, revision: template.revision }); notice = "Scope requested. Trusted operator preparation required; no authority granted."; }
        catch { notice = "Task request unconfirmed; inspect the current catalog."; }
        $.ui.invalidate("ui.render");
      } }));
      rows.push(Button({ key: "task-refresh", label: "Refresh completion evidence", onPress: async () => { await refresh($, options); } }));
      rows.push(Button({ key: "operations", label: "Retained operations", onPress: () => { pane = "operations"; $.ui.invalidate("ui.render"); } }));
      return Box({ flexDirection: "column", children: rows });
    }
    const operation = status?.operations.find(op => op.requestId === selectedId);
    const intents = (status?.intents ?? []).filter(intent => intent.requestId === operation?.requestId && operation);
    const fresh = !!status && status.authority === "live" && Date.now() - status.checkedAt <= 10_000 && Date.now() < status.authorityExpiresAt * 1000;
    const summary = operation?.review ? [
      `${safeText(operation.tool ?? "operation")} · ${operation.state}`,
      "requested → awaiting review",
      `Purpose: ${safeText(operation.review.purpose)}`,
      `Requested capability: ${safeText(operation.review.capabilityId)}`,
      `Grant TTL: ${operation.review.ttlSeconds}s · decision: ${operation.review.decision}`,
      "Kernel policy applies. Budget impact unavailable.",
      "Exact arguments:", safeText(JSON.stringify(operation.review.arguments, null, 2)),
    ].join("\n") : operation ? operationText(operation) : "No selected retained operation.";
    const rows = [Text({ children: statusLine(status, Date.now()) }), Text({ dimColor: true, children: `Session ${safeText(sessionId)}` }),
      Text({ children: summary }), Text({ children: safeText(notice) })];
    for (const intent of intents) rows.push(Text({ children: `${intent.kind} ${intent.state} · ${safeText(intent.id)}${Date.now() >= intent.expiresAt ? " · request expired; inspect its original outcome" : ""}` }));
    if (fresh && operation?.review?.decision === "required" && intents.length === 0) {
      rows.push(Text({ dimColor: true, children: "These controls request a decision. Authority requires confirmation outside Claude." }));
      rows.push(Button({ key: "approve", label: "Request approval of this exact action", onPress: async () => { try { await request($, options, "approve", operation); } catch { notice = "Approval unconfirmed; refresh the original action."; $.ui.invalidate("ui.render"); } } }));
      rows.push(Button({ key: "decline", label: "Request decline", onPress: async () => { try { await request($, options, "decline", operation); } catch { notice = "Decline unconfirmed; refresh the original action."; $.ui.invalidate("ui.render"); } } }));
      rows.push(Button({ key: "alternative", label: "Request a permitted alternative", onPress: async () => { try { await request($, options, "alternative", operation); } catch { notice = "Alternative request unconfirmed."; $.ui.invalidate("ui.render"); } } }));
    }
    const continuation = status?.continuations?.find(c => c.requestId === operation?.requestId);
    if (fresh && operation?.review?.decision === "granted" && status?.workflow?.continuation && !continuation) rows.push(Button({ key: "continue", label: "Continue this exact action", onPress: async () => {
      try { const submitted = await $.chio.continueAction({ requestId: operation.requestId, revision: operation.review!.revision }); notice = "Continuation submitted · " + submitted.id; await refresh($, options); }
      catch { notice = "Continuation unresolved; inspect the original operation without retry."; }
      $.ui.invalidate("ui.render");
    } }));
    if (continuation && continuation.state !== "unknown" && continuation.delivery !== "confirmed") rows.push(Button({ key: "outcome", label: "Receive original continuation result", onPress: async () => {
      try { const result = await $.chio.receiveOutcome({ continuationId: continuation.id }); notice = result.ready ? "Result received through native control (model delivery not claimed).\n" + safeText(JSON.stringify(result.result, null, 2)) : "Original continuation " + result.continuation.state + "; fence retained."; await refresh($, options); }
      catch { notice = "Original result delivery unresolved; do not dispatch again."; }
      $.ui.invalidate("ui.render");
    } }));
    if (operation) {
      rows.push(Button({ key: "details", label: showDetails ? "Hide evidence and authority details" : "Evidence and authority details", onPress: () => { showDetails = !showDetails; $.ui.invalidate("ui.render"); } }));
      if (showDetails) rows.push(Text({ children: operationText(operation) }));
    }
    rows.push(Button({ key: "task", label: "Task and completion evidence", onPress: () => { pane = "task"; $.ui.invalidate("ui.render"); } }));
    rows.push(Button({ key: "refresh", label: "Refresh", onPress: async () => { await refresh($, options); } }));
    for (const [index, op] of (status?.operations ?? []).entries()) rows.push(Button({ key: `operation-${index}`, label: `${safeText(op.tool ?? "operation")} · ${op.state} · ${safeText(op.requestId.slice(-12))}`,
      onPress: () => { selectedId = op.requestId; showDetails = false; $.ui.invalidate("ui.render"); } }));
    return Box({ flexDirection: "column", children: rows });
  }).catch(($, e, next) => next(e));
};
