import type { ControlStatus, OperationView } from "../../types/control.js";

/** Reject mismatched or oversized projections before exposing them in the host. */
export function parseStatus(text: string, sessionId: string): ControlStatus {
  if (text.length > 1024 * 1024) throw new Error("projection exceeds limit");
  const value = JSON.parse(text) as ControlStatus;
  if (value.schema !== "chio.control.status.v1" || value.sessionId !== sessionId
    || !["kernel_mcp", "isolated_kernel_mcp"].includes(value.scope) || !["live", "expired", "revoked", "disconnected"].includes(value.authority)
    || !Number.isSafeInteger(value.checkedAt) || !Number.isSafeInteger(value.authorityExpiresAt)
    || !Number.isSafeInteger(value.awaitingReview) || value.awaitingReview < 0 || !Number.isSafeInteger(value.unresolved) || value.unresolved < 0
    || !Array.isArray(value.operations) || value.operations.length > 1000 || !Array.isArray(value.intents) || value.intents.length > 1000
    || !Array.isArray(value.protectedTools) || value.protectedTools.some(name => typeof name !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(name))
    || typeof value.revision !== "string" || !/^[0-9a-f]{64}$/.test(value.revision) || typeof value.fenced !== "boolean") throw new Error("invalid or foreign projection");
  for (const op of value.operations) {
    if (!op || typeof op.requestId !== "string" || op.requestId.length > 256 || !["pending", "awaiting_approval", "not_dispatched", "unknown", "denied", "completed"].includes(op.state)
      || !["verified", "unverified"].includes(op.evidence) || !["review", "explicit_resume", "linked_continuation", "reconcile_original", "acknowledge_delivery", "none"].includes(op.nextAction)
      || typeof op.acknowledged !== "boolean" || typeof op.hostDeliveryConfirmed !== "boolean") throw new Error("invalid operation projection");
    if (op.review && (op.state !== "awaiting_approval" || !/^[0-9a-f]{64}$/.test(op.review.revision) || typeof op.review.purpose !== "string"
      || typeof op.review.capabilityId !== "string" || !op.review.arguments || typeof op.review.arguments !== "object" || Array.isArray(op.review.arguments)
      || !Number.isSafeInteger(op.review.ttlSeconds) || op.review.ttlSeconds < 1 || op.review.ttlSeconds > 3600
      || !["required", "granted", "declined", "expired"].includes(op.review.decision))) throw new Error("invalid exact review");
  }
  for (const intent of value.intents) {
    if (intent.sessionId !== sessionId || !/^[0-9a-f-]{36}$/.test(intent.id) || !["approve", "decline", "alternative", "revoke"].includes(intent.kind)
      || !["requested", "submitted", "granted", "declined", "confirmed", "unknown", "failed"].includes(intent.state) || !Number.isSafeInteger(intent.expiresAt)) throw new Error("invalid control intent");
  }
  if (value.workflow) {
    const w = value.workflow;
    if (!Array.isArray(w.templates) || w.templates.length > 32 || typeof w.continuation !== "boolean" || typeof w.proposals !== "boolean") throw new Error("invalid workflow projection");
    for (const t of w.templates) if (typeof t.id !== "string" || typeof t.title !== "string" || !/^[0-9a-f]{64}$/.test(t.revision)
      || !Array.isArray(t.allowedTools) || !Number.isSafeInteger(t.ttlSeconds) || !t.scope || t.scope.source !== "operator_template"
      || [t.scope.resources, t.scope.destinations, t.scope.restrictions].some(a => !Array.isArray(a) || a.some(v => typeof v !== "string"))) throw new Error("invalid task template");
    const t = w.task;
    if (t && (t.sessionId !== sessionId || typeof t.id !== "string" || typeof t.title !== "string" || typeof t.goal !== "string"
      || !/^[0-9a-f]{64}$/.test(t.revision) || !["ready", "outstanding", "failed"].includes(t.readiness)
      || !t.artifact || !["git_commit", "sha256"].includes(t.artifact.kind) || !(t.artifact.kind === "git_commit" ? /^[0-9a-f]{40}$/ : /^[0-9a-f]{64}$/).test(t.artifact.digest)
      || typeof t.artifact.label !== "string" || !Array.isArray(t.requirements) || t.requirements.length > 32
      || t.requirements.some(r => typeof r.id !== "string" || typeof r.title !== "string" || !["outstanding", "running", "passed", "failed", "stale"].includes(r.state)
        || !["none", "trusted_collector_observation"].includes(r.evidenceClass)) || !t.scope || t.scope.source !== "operator_template"
      || [t.scope.resources, t.scope.destinations, t.scope.restrictions].some(a => !Array.isArray(a) || a.some(v => typeof v !== "string")))) throw new Error("invalid task contract");
  }
  if (value.continuations && (!Array.isArray(value.continuations) || value.continuations.length > 1000 || value.continuations.some(c => !/^[0-9a-f-]{36}$/.test(c.id)
    || typeof c.requestId !== "string" || !["submitted", "completed", "unknown"].includes(c.state) || !["pending", "confirmed"].includes(c.delivery) || (c.modelContext !== undefined && c.modelContext !== "confirmed")))) throw new Error("invalid continuation projection");
  if (value.modelUsage !== undefined) {
    const u = value.modelUsage;
    if (!u || typeof u.model !== "string" || u.model.length > 128 || [u.requests, u.inputTokens, u.outputTokens, u.cacheCreationInputTokens, u.cacheReadInputTokens].some(n => !Number.isSafeInteger(n) || n < 0)
      || !(u.budget === null || Number.isSafeInteger(u.budget) && u.budget > 0) || typeof u.budgetReached !== "boolean") throw new Error("invalid model usage projection");
  }
  return value;
}

/** Control characters cannot turn retained input into terminal instructions. */
export function safeText(value: unknown): string { return String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\p{Cf}\u2028\u2029]/gu, "�"); }
export function statusLine(status: ControlStatus | null, now: number): string {
  if (!status) return "Chio · disconnected · protection scope unavailable";
  const live = status.authority === "live" && now - status.checkedAt <= 10_000 && now < status.authorityExpiresAt * 1000;
  const scope = status.scope === "isolated_kernel_mcp" ? "isolated kernel MCP" : "kernel MCP tools only";
  const authority = live ? `authority ${Math.max(1, Math.ceil((status.authorityExpiresAt * 1000 - now) / 60_000))}m`
    : status.authority === "live" ? "authority unconfirmed" : `authority ${status.authority}`;
  return `Chio · ${scope} · ${authority} · ${status.awaitingReview} review · ${status.unresolved} unresolved`;
}
export function operationText(operation: OperationView): string {
  const lines = [`${safeText(operation.tool ?? "operation")} · ${safeText(operation.requestId)}`, `State: ${operation.state} · evidence: ${operation.evidence}`];
  const timeline = operation.state === "awaiting_approval" ? "requested → awaiting review"
    : operation.state === "completed" && operation.evidence === "verified" ? "requested → dispatched → verified outcome"
    : operation.state === "unknown" || operation.state === "pending" ? "requested → outcome unresolved"
    : operation.state === "denied" ? "requested → denied" : "requested → not dispatched";
  lines.push(timeline);
  if (operation.receiptId) lines.push(`Receipt: ${safeText(operation.receiptId)}`);
  lines.push(`Kernel acknowledgement: ${operation.acknowledged ? "confirmed" : "unconfirmed"}`, `Host delivery: ${operation.hostDeliveryConfirmed ? "confirmed" : "unconfirmed"}${operation.deliveryChannel ? " · " + operation.deliveryChannel : ""}`);
  if (operation.review) {
    lines.push(`Purpose: ${safeText(operation.review.purpose)}`, `Requested capability: ${safeText(operation.review.capabilityId)}`,
      `Grant TTL: ${operation.review.ttlSeconds}s · decision: ${operation.review.decision}`, "Restrictions: kernel policy applies · budget impact unavailable",
      "Exact arguments:", safeText(JSON.stringify(operation.review.arguments, null, 2)));
  }
  const next = { review: "Review the exact retained action.", explicit_resume: "Authority granted. Explicit chio_resume is required; no effect has been dispatched by this decision.",
    linked_continuation: "Create a separately authorized linked action. The original denial remains retained.", reconcile_original: "Reconcile this original operation with the trusted operator. Its dispatch fence remains intact.",
    acknowledge_delivery: "Recover the exact retained outcome and confirm delivery through the trusted operator.", none: "No control action required." };
  lines.push(next[operation.nextAction]);
  return lines.join("\n");
}

export function outcomeRequestId(output: unknown): string | null {
  try {
    const value = output as { content?: { type?: string; text?: string }[] };
    const text = typeof output === "string" ? output : value?.content?.find(block => block.type === "text")?.text;
    if (!text || text.length > 1024 * 1024) return null;
    const outcome = JSON.parse(text) as { requestId?: unknown };
    return typeof outcome.requestId === "string" && outcome.requestId.length <= 256 ? outcome.requestId : null;
  } catch { return null; }
}

/** Read-only diagnosis keeps infrastructure, authority and uncertain effects distinct. */
export function diagnosticText(status: ControlStatus | null, sessionId: string, now: number): string {
  const lines = [`Session: ${safeText(sessionId)}`, statusLine(status, now)];
  if (!status) return [...lines, "Control infrastructure unavailable or session binding refused.",
    "Authority: unconfirmed. Check the trusted control service and exact session binding.",
    "Guest execution and storage: unchecked. Run the operator doctor outside Claude.",
    "Preserve retained operations; reconnect does not authorize redispatch."].join("\n");
  const fresh = now - status.checkedAt <= 10_000 && status.checkedAt <= now + 5000;
  const live = fresh && status.authority === "live" && now < status.authorityExpiresAt * 1000;
  lines.push("Control infrastructure: reachable for this exact session.",
    `Authority: ${live ? "live" : !fresh ? "stale, unconfirmed" : status.authority === "live" ? "expired" : status.authority}.`,
    "Guest execution and storage: unchecked. The operator doctor checks those separately.");
  const uncertain = status.operations.filter(op => op.state === "unknown" || op.state === "pending");
  const denied = status.operations.filter(op => op.state === "denied");
  const review = status.operations.filter(op => op.nextAction === "review");
  lines.push(`Uncertain original outcomes: ${uncertain.length}.`, `Retained denials: ${denied.length}.`, `Actions awaiting review: ${review.length}.`);
  if (uncertain.length) lines.push("Reconcile original outcomes with the trusted operator. Keep dispatch fences intact; do not retry the effect.");
  if (denied.length) lines.push("Inspect /chio-why REQUEST_ID. A denial is an authority decision, not evidence of infrastructure failure.");
  if (review.length) lines.push("Inspect /chio-review REQUEST_ID. Review intent requires trusted operator confirmation.");
  if (!live) lines.push("Obtain a confirmed current authority binding before new protected effects. Preserve the original session's uncertain work.");
  lines.push(`Dispatch fence: ${status.fenced ? "retained" : "clear"}. No control intent or protected action was submitted by this check.`);
  return lines.join("\n");
}

/** What Claude reads with the first message. Null without a projection or protected tools. */
export function guidanceText(status: ControlStatus | null): string | null {
  if (!status || !status.protectedTools.length) return null;
  return [
    `Chio mediates these tools: ${status.protectedTools.map(safeText).join(", ")}.`,
    "Each result is a JSON outcome with a state and a requestId.",
    "- awaiting_approval: the action was kept without running. Stop and tell the user it needs review (/chio-review REQUEST_ID). Do not call chio_resume unless the user says the operator granted it.",
    "- denied: an authority decision. Do not repeat the same call; explain the reason or propose a different permitted action.",
    "- pending or unknown: the effect may have happened. Never repeat the call. Tell the user to reconcile it (/chio-evidence REQUEST_ID).",
    "- completed with evidence \"verified\": the result is bound to a signed receipt.",
    status.scope === "isolated_kernel_mcp" ? "This session has no other tools." : "Other tools in this session are not protected by Chio.",
  ].join("\n");
}

export interface NoticeState { authorityWarned: boolean; uncertain?: number; uncertainIds?: string[] }
function uncertainIds(status: ControlStatus, ignorePending = false): string[] { return status.operations.filter(op => op.state === "unknown" || (!ignorePending && op.state === "pending")).map(op => op.requestId); }
/** Notices for changes between two projections of one session. A first projection or reconnect is a silent baseline.
 * `ignorePending` is set while a protected call is in flight: the gateway records every dispatch as pending until the kernel answers. */
export function transitions(previous: ControlStatus | null, next: ControlStatus | null, now: number, state: NoticeState, ignorePending = false): string[] {
  if (next) {
    const ids = uncertainIds(next, ignorePending);
    const before = new Set(state.uncertainIds ?? (previous && previous.sessionId === next.sessionId ? uncertainIds(previous, ignorePending) : ids));
    state.uncertain = ids.length; state.uncertainIds = ids;
    if (!previous || previous.sessionId !== next.sessionId) return [];
    return diff(previous, next, now, state, ids.some(id => !before.has(id)));
  }
  return [];
}
function diff(previous: ControlStatus, next: ControlStatus, now: number, state: NoticeState, moreUncertain: boolean): string[] {
  const notices: string[] = [];
  const priorReviews = new Set(previous.operations.filter(op => op.nextAction === "review").map(op => op.requestId));
  if (next.operations.some(op => op.nextAction === "review" && !priorReviews.has(op.requestId))) notices.push(`Chio · ${next.awaitingReview} action${next.awaitingReview === 1 ? "" : "s"} awaiting review · /chio-review`);
  if (moreUncertain) notices.push("Chio · original outcome unresolved · /chio-doctor");
  const remaining = next.authorityExpiresAt * 1000 - now;
  if (!state.authorityWarned && next.authority === "live" && remaining > 0 && remaining <= 5 * 60_000) {
    state.authorityWarned = true; notices.push(`Chio · authority expires in ${Math.max(1, Math.ceil(remaining / 60_000))}m`);
  }
  for (const continuation of next.continuations ?? []) {
    const before = previous.continuations?.find(prior => prior.id === continuation.id);
    if (continuation.state === "completed" && continuation.delivery === "pending" && before?.state !== "completed") notices.push(`Chio · original result ready · /chio-outcome ${safeText(continuation.id)}`);
  }
  return notices;
}
