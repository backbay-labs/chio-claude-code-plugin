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
  return value;
}

/** Control characters cannot turn retained input into terminal instructions. */
export function safeText(value: unknown): string { return String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "�"); }
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
  lines.push(`Kernel acknowledgement: ${operation.acknowledged ? "confirmed" : "unconfirmed"}`, `Host delivery: ${operation.hostDeliveryConfirmed ? "confirmed" : "unconfirmed"}`);
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
