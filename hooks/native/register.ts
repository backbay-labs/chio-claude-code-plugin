import type { EngineInterface, PluginOptions, Register } from "claude-code";
import type { ControlStatus, IntentKind, OperationView } from "../../types/control.js";
import { operationText, outcomeRequestId, parseStatus, safeText, statusLine } from "./projection.ts";

let sessionId = "";
let status: ControlStatus | null = null;
let selectedId: string | null = null;
let showDetails = false;
let interactive = false;
let notice = "";
let generation = 0;

function endpoint(base: string): string {
  const url = new URL(base);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("exact loopback control origin required");
  return url.origin;
}
async function refresh($: EngineInterface, options: PluginOptions): Promise<ControlStatus | null> {
  const actual = await $.session.id();
  if (actual !== sessionId) {
    sessionId = actual; status = null; selectedId = null; showDetails = false; notice = ""; generation += 1;
    await $.ui.close({ id: "chio" });
  }
  const thisGeneration = ++generation;
  let stage = "configuration";
  try {
    const base = typeof options.control_url === "string" ? options.control_url : await $.env.get("CHIO_CONTROL_URL");
    const token = typeof options.control_token === "string" ? options.control_token : await $.env.get("CHIO_CONTROL_TOKEN");
    if (!base || !token || !/^[0-9a-f]{64}$/.test(token)) throw new Error("scoped control service is not configured");
    stage = "origin";
    const origin = endpoint(base);
    stage = "transport";
    const response = await $.http.fetch(`${origin}/sessions/${encodeURIComponent(actual)}/status`, { headers: { Authorization: `Bearer ${token}` } });
    stage = `http-${response.status}`;
    if (!response.ok) throw new Error("scoped control service unavailable for this session");
    stage = "projection";
    const received = parseStatus(response.text, actual);
    if (received.checkedAt > Date.now() + 5000 || Date.now() - received.checkedAt > 10_000) throw new Error("status is stale");
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
  selectedId = requestId ?? current?.operations.find(op => op.review?.decision === "required" || op.nextAction !== "none")?.requestId ?? null;
  showDetails = false;
  if (requestId && !current?.operations.some(op => op.requestId === requestId)) throw new Error("no retained operation for this session and request id");
  const operation = current?.operations.find(op => op.requestId === selectedId);
  const text = [statusLine(current, Date.now()), `Session: ${safeText(sessionId)}`, ...(operation ? [operationText(operation)] : []), ...(notice ? [notice] : [])].join("\n");
  if (interactive) await $.ui.open({ id: "chio", title: "Chio", focus: true, closeOnEscape: true });
  return text;
}
export const register: Register = (on, options) => {
  on("session.start", async ($, e, next) => {
    interactive = e.isInteractive;
    await $.command.register({ name: "chio", description: "Inspect Chio scope and retained work", immediate: true });
    await $.command.register({ name: "chio-status", description: "Read the exact session's protection and authority status", immediate: true });
    await $.command.register({ name: "chio-review", description: "Review a retained exact action", argumentHint: "[request-id]", immediate: true });
    await $.command.register({ name: "chio-evidence", description: "Inspect retained operation evidence and recovery requirements", argumentHint: "[request-id]", immediate: true });
    await $.command.register({ name: "chio-revoke", description: "Request revocation of this exact kernel session", immediate: true });
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
    if (operation) {
      rows.push(Button({ key: "details", label: showDetails ? "Hide evidence and authority details" : "Evidence and authority details", onPress: () => { showDetails = !showDetails; $.ui.invalidate("ui.render"); } }));
      if (showDetails) rows.push(Text({ children: operationText(operation) }));
    }
    rows.push(Button({ key: "refresh", label: "Refresh", onPress: async () => { await refresh($, options); } }));
    for (const [index, op] of (status?.operations ?? []).entries()) rows.push(Button({ key: `operation-${index}`, label: `${safeText(op.tool ?? "operation")} · ${op.state} · ${safeText(op.requestId.slice(-12))}`,
      onPress: () => { selectedId = op.requestId; showDetails = false; $.ui.invalidate("ui.render"); } }));
    return Box({ flexDirection: "column", children: rows });
  }).catch(($, e, next) => next(e));
};
