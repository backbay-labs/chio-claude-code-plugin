/** Public projection only. Operator credentials, raw results and journals never cross this contract. */
export type OperationState = "pending" | "awaiting_approval" | "not_dispatched" | "unknown" | "denied" | "completed";
export type IntentKind = "approve" | "decline" | "alternative" | "revoke";
export type IntentState = "requested" | "submitted" | "granted" | "declined" | "confirmed" | "unknown" | "failed";
export interface ReviewView {
  revision: string;
  purpose: string;
  arguments: Record<string, unknown>;
  capabilityId: string;
  ttlSeconds: number;
  restrictions: "kernel_policy";
  budgetImpact: "unavailable";
  decision: "required" | "granted" | "declined" | "expired";
}
export interface OperationView {
  requestId: string;
  state: OperationState;
  evidence: "verified" | "unverified";
  tool?: string;
  receiptId?: string;
  acknowledged: boolean;
  hostDeliveryConfirmed: boolean;
  nextAction: "review" | "explicit_resume" | "linked_continuation" | "reconcile_original" | "acknowledge_delivery" | "none";
  review?: ReviewView;
}
export interface IntentView {
  id: string;
  kind: IntentKind;
  state: IntentState;
  sessionId: string;
  requestId?: string;
  expiresAt: number;
}
export interface ControlStatus {
  schema: "chio.control.status.v1";
  sessionId: string;
  checkedAt: number;
  scope: "kernel_mcp" | "isolated_kernel_mcp";
  authority: "live" | "expired" | "revoked" | "disconnected";
  authorityExpiresAt: number;
  protectedTools: string[];
  revision: string;
  awaitingReview: number;
  unresolved: number;
  fenced: boolean;
  operations: OperationView[];
  intents: IntentView[];
}
