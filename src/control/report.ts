import type { ControlStatus } from "../../types/control.js";
import type { ContinuationView } from "../../types/workflow.js";

export interface ReportInput { status: ControlStatus; continuations: ContinuationView[]; generatedAt: number; relayEvents?: unknown }
const clean = (value: unknown) => String(value ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
const cell = (value: unknown) => clean(value).replace(/\|/g, "\\|") || "—";
const time = (ms: number) => new Date(ms).toISOString();
function table(headers: string[], rows: unknown[][]): string[] {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.map(cell).join(" | ")} |`)];
}
/** Markdown from authorized projections only. It references receipts by id and verifies nothing. */
export function renderSessionReport({ status, continuations, generatedAt, relayEvents }: ReportInput): string {
  const lines = ["# Chio session report", "",
    `- Session: ${clean(status.sessionId)}`, `- Scope: ${clean(status.scope)}`,
    `- Authority: ${clean(status.authority)} · expires ${time(status.authorityExpiresAt * 1000)}`,
    `- Projection revision: ${clean(status.revision)}`, `- Dispatch fence: ${status.fenced ? "retained" : "clear"}`,
    `- Generated: ${time(generatedAt)}`, "",
    "## Operations", "", ...table(["Request", "Tool", "State", "Evidence", "Next action", "Receipt", "Kernel ACK", "Delivery"],
      status.operations.map(op => [op.requestId, op.tool, op.state, op.evidence, op.nextAction, op.receiptId, op.acknowledged ? "confirmed" : "unconfirmed",
        op.hostDeliveryConfirmed ? op.deliveryChannel ?? "confirmed" : "unconfirmed"])), "",
    "## Decisions", "", ...(status.intents.length ? table(["Intent", "Kind", "State", "Request", "Expires"], status.intents.map(i => [i.id, i.kind, i.state, i.requestId, time(i.expiresAt)])) : ["No review intents retained."]), "",
    "## Continuations", "", ...(continuations.length ? table(["Continuation", "Original request", "State", "Delivery", "Model context"], continuations.map(c => [c.id, c.requestId, c.state, c.delivery, c.modelContext ?? "not confirmed"])) : ["No continuations retained."]), ""];
  const task = status.workflow?.task;
  lines.push("## Task", "");
  if (task) lines.push(`- ${clean(task.title)} · ${clean(task.readiness)}`, `- Artifact: ${clean(task.artifact.kind)} ${clean(task.artifact.digest)} · ${clean(task.artifact.label)}`, "",
    ...table(["Requirement", "State", "Evidence class", "Source", "Observed"], task.requirements.map(r => [r.title, r.state, r.evidenceClass, r.source, r.observedAt ? time(r.observedAt) : undefined])));
  else lines.push("No task contract is bound to this session.");
  lines.push("");
  if (Array.isArray(relayEvents)) {
    const forwarded = relayEvents.filter((e: any) => e?.requestClass === "conversation" && e.forwarded && e.usage);
    const sum = (key: string) => forwarded.reduce((total: number, e: any) => total + (Number.isSafeInteger(e.usage[key]) ? e.usage[key] : 0), 0);
    const models = [...new Set(forwarded.map((e: any) => clean(e.model)))];
    lines.push("## Model usage", "", `- Relay-metered: ${forwarded.length} request${forwarded.length === 1 ? "" : "s"} · ${sum("input_tokens")} in · ${sum("output_tokens")} out · ${sum("cache_read_input_tokens")} cache read · ${sum("cache_creation_input_tokens")} cache write tokens`,
      `- Models: ${models.join(", ") || "—"}`, "- Provider-reported counts, not billing records.", "");
  }
  lines.push("## What this report is", "",
    "Generated from the operator's private journal and the session's authorized projection. Receipts are referenced by id; this report does not verify them. Verify receipts with the kernel's evidence tools. It contains no credentials, approval tokens or raw resource results.", "");
  return lines.join("\n");
}
