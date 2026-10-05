import type { ControlStatus } from "../../types/control.js";
import type { ContinuationView } from "../../types/workflow.js";

export interface ReportInput { status: ControlStatus; continuations: ContinuationView[]; generatedAt: number; relayEvents?: unknown }
const clean = (value: unknown) => String(value ?? "").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ");
const md = (value: unknown) => clean(value).replace(/[\\`*_\[\]()<>!#|&~]/g, "\\$&");
const escapeList = (value: string) => value.replace(/^(\d+)\.(?=\s)/, "$1\\.").replace(/^[+=-]/, "\\$&");
const cell = (value: unknown) => md(value) || "—";
const time = (ms: number) => new Date(ms).toISOString();
function table(headers: string[], rows: unknown[][]): string[] {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.map(cell).join(" | ")} |`)];
}
/** Markdown from authorized projections only. It references receipts by id and verifies nothing. */
export function renderSessionReport({ status, continuations, generatedAt, relayEvents }: ReportInput): string {
  const lines = ["# Chio session report", "", ...(status.scope === "demo_fixture" ? ["DEMO fixture kernel · nothing protected", ""] : []),
    `- Session: ${md(status.sessionId)}`, `- Scope: ${["isolated_kernel_mcp", "demo_fixture"].includes(status.scope) ? md(status.scope) : "not recorded in the journal (the launcher holds it)"}`,
    `- Authority: ${md(status.authority)} · expires ${time(status.authorityExpiresAt * 1000)}`,
    `- Projection revision: ${md(status.revision)}`, `- Dispatch fence: ${status.fenced ? "retained" : "clear"}`,
    `- Generated: ${time(generatedAt)}`, "",
    "## Operations", "", ...table(["Request", "Tool", "State", "Evidence", "Next action", "Receipt", "Kernel ACK", "Delivery"],
      status.operations.map(op => [op.requestId, op.tool, op.state, op.evidence, op.nextAction, op.receiptId, op.acknowledged ? "confirmed" : "unconfirmed",
        op.hostDeliveryConfirmed ? op.deliveryChannel ?? "confirmed (channel not recorded)" : "unconfirmed"])), "",
    status.scope === "demo_fixture" ? "DEMO evidence: signatures match only this demo run’s fixture key; no protected kernel or resource is established." : "Evidence: verified means the gateway checked the receipt signature against the session's pinned signers; this report does not re-verify it.", "",
    "## Decisions", "", ...(status.intents.length ? table(["Intent", "Kind", "State", "Request", "Expires"], status.intents.map(i => [i.id, i.kind, i.state, i.requestId, time(i.expiresAt)])) : ["No review intents retained."]), "",
    "## Continuations", "", ...(continuations.length ? table(["Continuation", "Original request", "State", "Delivery", "Model context"], continuations.map(c => [c.id, c.requestId, c.state, c.delivery, c.modelContext ?? "not available to the operator report"])) : ["No continuations retained."]), ""];
  const task = status.workflow?.task;
  lines.push("## Task", "");
  if (task) lines.push(`- ${escapeList(md(task.title))} · ${md(task.readiness)}`, `- Artifact: ${md(task.artifact.kind)} ${md(task.artifact.digest)} · ${md(task.artifact.label)}`, "",
    ...table(["Requirement", "State", "Evidence class", "Source", "Observed"], task.requirements.map(r => [r.title, r.state, r.evidenceClass, r.source, r.observedAt ? time(r.observedAt) : undefined])));
  else lines.push("No task contract is bound to this session.");
  lines.push("");
  if (Array.isArray(relayEvents)) {
    const forwarded = relayEvents.filter((e: any) => e?.requestClass === "conversation" && e.forwarded);
    const unknown = forwarded.filter((e: any) => !e.usage).length;
    const partial = forwarded.filter((e: any) => e.usage && e.usageComplete !== true).length;
    const sum = (key: string) => forwarded.reduce((total: number, e: any) => total + (Number.isSafeInteger(e.usage?.[key]) && e.usage[key] >= 0 ? e.usage[key] : 0), 0);
    const models = [...new Set(forwarded.map((e: any) => md(e.model)))];
    lines.push("## Model usage", "", `- Relay-metered: ${forwarded.length} request${forwarded.length === 1 ? "" : "s"} · ${sum("input_tokens")} in · ${sum("output_tokens")} out · ${sum("cache_read_input_tokens")} cache read · ${sum("cache_creation_input_tokens")} cache write tokens${unknown ? ` · ${unknown} with unknown usage` : ""}${partial ? ` · ${partial} with partial usage; completion not confirmed` : ""}`,
      `- Models: ${models.join(", ") || "—"}`, "- Provider-reported counts, not billing records.", "- Source: the relay events file supplied by the operator; this report does not authenticate it.", "");
  }
  lines.push("## What this report is", "",
    "Generated from the operator's private journal and the session's authorized projection. Receipts are referenced by id; this report does not verify them. Verify receipts with the kernel's evidence tools. Launcher-held facts (scope, relay model context, budget refusals) appear in the launch profile's `launch.json` and `exit.json`. It contains no credentials, approval tokens or raw resource results.", "");
  return lines.join("\n");
}
