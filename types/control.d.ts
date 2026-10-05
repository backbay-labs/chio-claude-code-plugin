import type { WorkflowView, ContinuationView } from "./workflow.js";
/** Status projects metadata. Operator credentials and journals stay outside the host; exact result receipt uses a separate bounded route. */
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
  deliveryChannel?: "model_tool_result" | "native_control" | "unclassified";
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
  workflow?: WorkflowView;
  continuations?: ContinuationView[];
  modelUsage?: ModelUsageView;
}
/** Provider-reported counts totalled by the launcher relay; not billing records. */
export interface ModelUsageView { model: string; requests: number; inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number; budget: number | null; budgetReached: boolean }

