// Standalone mod namespace contract. Keep public projection fields aligned with control.d.ts and workflow.d.ts.
/** Status projects metadata. Operator credentials and journals stay outside the host; exact result receipt uses a separate bounded route. */
export type ChioOperationState = "pending" | "awaiting_approval" | "not_dispatched" | "unknown" | "denied" | "completed";
export type ChioIntentKind = "approve" | "decline" | "alternative" | "revoke";
export type ChioIntentState = "requested" | "submitted" | "granted" | "declined" | "confirmed" | "unknown" | "failed";
export interface ChioReviewView {
  revision: string;
  purpose: string;
  arguments: Record<string, unknown>;
  capabilityId: string;
  ttlSeconds: number;
  restrictions: "kernel_policy";
  budgetImpact: "unavailable";
  decision: "required" | "granted" | "declined" | "expired";
}
export interface ChioOperationView {
  requestId: string;
  state: ChioOperationState;
  evidence: "verified" | "unverified";
  tool?: string;
  receiptId?: string;
  acknowledged: boolean;
  hostDeliveryConfirmed: boolean;
  deliveryChannel?: "model_tool_result" | "native_control" | "unclassified";
  nextAction: "review" | "explicit_resume" | "linked_continuation" | "reconcile_original" | "acknowledge_delivery" | "none";
  review?: ChioReviewView;
}
export interface ChioIntentView {
  id: string;
  kind: ChioIntentKind;
  state: ChioIntentState;
  sessionId: string;
  requestId?: string;
  expiresAt: number;
}
export interface ChioControlStatus {
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
  operations: ChioOperationView[];
  intents: ChioIntentView[];
  workflow?: ChioWorkflowView;
  continuations?: ChioContinuationView[];
}
/** Authorized projections. Collector commands, credentials and paths remain outside the host. */
export interface ChioArtifactRef { kind: "git_commit" | "sha256"; digest: string; label: string }
export interface ChioRequirementView {
  id: string;
  title: string;
  state: "outstanding" | "running" | "passed" | "failed" | "stale";
  evidenceClass: "none" | "trusted_collector_observation";
  observedAt?: number;
  source?: string;
}
export interface ChioTaskView {
  id: string;
  sessionId: string;
  revision: string;
  title: string;
  goal: string;
  artifact: ChioArtifactRef;
  readiness: "ready" | "outstanding" | "failed";
  requirements: ChioRequirementView[];
  scope: { resources: string[]; destinations: string[]; restrictions: string[]; source: "operator_template"; budget: "unavailable" };
}
export interface ChioTemplateView { id: string; title: string; revision: string; allowedTools: string[]; ttlSeconds: number; scope: ChioTaskView["scope"] }
export interface ChioWorkflowView {
  task?: ChioTaskView;
  templates: ChioTemplateView[];
  requests?: { id: string; templateId: string; state: "requested" | "stale" | "expired"; createdAt: number }[];
  continuation: boolean;
  proposals: boolean;
}
export interface ChioContinuationView {
  id: string;
  requestId: string;
  state: "submitted" | "completed" | "unknown";
  delivery: "pending" | "confirmed";
  modelContext?: "confirmed";
  receiptConfirmed?: boolean;
  outcomeHash?: string;
}
export interface ChioExplanationView {
  requestId: string;
  state: string;
  reason: string;
  source: "retained_gateway" | "verified_kernel_receipt";
  receiptId?: string;
  policyRehearsal: "unavailable";
  resourcePreview: "unavailable";
  informationFlow: "unknown";
}

/** Session-scoped integration. Calls protect only operations routed through Chio.
 * No per-mod authority, direct credentials, policy rehearsal or implicit grant.
 */
export interface Chio {
  status(): Promise<ChioControlStatus>;
  task(): Promise<ChioTaskView | null>;
  explain(input: { requestId: string }): Promise<ChioExplanationView>;
  selectTask(input: { templateId: string; revision: string }): Promise<Record<string, unknown>>;
  requestReview(input: { kind: ChioIntentKind; revision: string; requestId?: string }): Promise<Record<string, unknown>>;
  propose(input: { id: string; tool: string; arguments: Record<string, unknown> }): Promise<Record<string, unknown>>;
  continueAction(input: { requestId: string; revision: string }): Promise<ChioContinuationView>;
  receiveOutcome(input: { continuationId: string }): Promise<ChioReceivedOutcome>;
}
export type ChioReceivedOutcome = { ready: false; continuation: ChioContinuationView }
  | { ready: true; requestId: string; result: unknown; receiptId: string; outcomeHash: string; channel: "native_control" };
declare module "claude-code" { interface EngineInterface { chio: Chio } }
