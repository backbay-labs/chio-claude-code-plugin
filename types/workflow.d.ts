/** Authorized projections. Collector commands, credentials and paths remain outside the host. */
export interface ArtifactRef { kind: "git_commit" | "sha256"; digest: string; label: string }
export interface RequirementView {
  id: string;
  title: string;
  state: "outstanding" | "running" | "passed" | "failed" | "stale";
  evidenceClass: "none" | "trusted_collector_observation";
  observedAt?: number;
  source?: string;
}
export interface TaskView {
  id: string;
  sessionId: string;
  revision: string;
  title: string;
  goal: string;
  artifact: ArtifactRef;
  readiness: "ready" | "outstanding" | "failed";
  requirements: RequirementView[];
  scope: { resources: string[]; destinations: string[]; restrictions: string[]; source: "operator_template"; budget: "unavailable" };
}
export interface TemplateView { id: string; title: string; revision: string; allowedTools: string[]; ttlSeconds: number; scope: TaskView["scope"] }
export interface WorkflowView {
  task?: TaskView;
  templates: TemplateView[];
  requests?: { id: string; templateId: string; state: "requested" | "stale" | "expired"; createdAt: number }[];
  continuation: boolean;
  proposals: boolean;
}
export interface ContinuationView {
  id: string;
  requestId: string;
  state: "submitted" | "completed" | "unknown";
  delivery: "pending" | "confirmed";
  receiptConfirmed?: boolean;
  outcomeHash?: string;
}
export interface ExplanationView {
  requestId: string;
  state: string;
  reason: string;
  source: "retained_gateway" | "verified_kernel_receipt";
  receiptId?: string;
  policyRehearsal: "unavailable";
  resourcePreview: "unavailable";
  informationFlow: "unknown";
}
