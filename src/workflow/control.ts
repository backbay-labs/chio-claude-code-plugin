import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { verifyBoundReceipt, verifyCompletedOutcome, type ExecutionOutcome, type AcknowledgementResult } from "@chio/bridge";
import { privatePath, type GatewayConfig, type GatewayOutcome, type StoredOperation } from "../bridge-internals/gateway.js";
import type { OperationView } from "../../types/control.js";
import type { ContinuationView, ExplanationView, WorkflowView } from "../../types/workflow.js";
import { digest, privateDirectory, privateRead, privateSave } from "./store.js";
import { projectTask, readCatalog, readTask, templateView } from "./tasks.js";
import { verifiedOriginal } from "./outcome.js";

export interface WorkflowOptions {
  taskPath?: string;
  catalogPath?: string;
  /** These callbacks are supplied only by the trusted parent using its existing transport. */
  propose?: (id: string, tool: string, args: Record<string, unknown>) => Promise<GatewayOutcome>;
  resume?: (id: string, requestId: string, tool: string, args: Record<string, unknown>) => Promise<GatewayOutcome>;
  acknowledge?: (outcome: ExecutionOutcome) => Promise<AcknowledgementResult>;
}
interface Access {
  config: GatewayConfig;
  binding: string;
  read: () => StoredOperation[];
  view: (record: StoredOperation) => OperationView;
  live: () => Promise<boolean>;
}
interface ContinuationRecord extends ContinuationView {
  schema: "chio.control.continuation.v1";
  binding: string; sessionId: string; revision: string;
  outcome?: ExecutionOutcome;
  challenge?: string;
  served?: boolean;
}
function uuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value); }
function publicContinuation(r: ContinuationRecord): ContinuationView {
  return { id: r.id, requestId: r.requestId, state: r.state, delivery: r.delivery, receiptConfirmed: r.receiptConfirmed === true || r.delivery === "confirmed", ...(r.outcomeHash ? { outcomeHash: r.outcomeHash } : {}) };
}
export function createWorkflowControl(access: Access, options: WorkflowOptions = {}, readOnly = false) {
  const directory = join(access.config.journalDir, "workflow");
  const continuations = join(directory, "continuations");
  const proposals = join(directory, "proposals");
  const taskRequests = join(directory, "task-requests");
  for (const path of [directory, continuations, proposals, taskRequests]) {
    if (!readOnly) privateDirectory(path);
    else if (existsSync(path)) privatePath(path, true);
  }
  for (const [field, path] of [["task", options.taskPath], ["catalog", options.catalogPath]] as const) {
    if (path && resolve(path) !== join(directory, field + ".json")) throw new Error("workflow file must be in this journal's private workflow directory");
  }
  const jobs = new Map<string, Promise<void>>();
  let closed = false;
  function find(requestId: unknown): StoredOperation {
    if (typeof requestId !== "string" || !requestId || requestId.length > 256) throw new Error("invalid retained operation id");
    const record = access.read().find(r => r.requestId === requestId);
    if (!record) throw new Error("no original operation for this session");
    return record;
  }
  function readContinuation(id: unknown, persist = !readOnly): ContinuationRecord {
    if (!uuid(id)) throw new Error("invalid continuation id");
    const path = join(continuations, id + ".json");
    let r = privateRead<ContinuationRecord>(path);
    if (r.schema !== "chio.control.continuation.v1" || r.id !== id || r.binding !== access.binding || r.sessionId !== access.config.sessionId
      || !["submitted", "completed", "unknown"].includes(r.state) || !["pending", "confirmed"].includes(r.delivery)
      || !/^[0-9a-f]{64}$/.test(r.revision)) throw new Error("foreign or invalid continuation");
    const original = find(r.requestId);
    const verified = verifiedOriginal(access.config, original);
    // A controller crash may interrupt its projection after the gateway has
    // durably retained the exact result. Recover that result, never its effect.
    if (r.state !== "completed" && !jobs.has(id) && verified) {
      r = { ...r, state: "completed", outcome: original.outcome as ExecutionOutcome, outcomeHash: digest(original.outcome), challenge: randomBytes(32).toString("hex") };
      if (persist) privateSave(path, r);
    }
    if (r.state === "completed") {
      if (!verified || !r.outcome || digest(r.outcome) !== digest(original.outcome) || digest(r.outcome) !== r.outcomeHash
        || !/^[0-9a-f]{64}$/.test(r.challenge ?? "")) throw new Error("continuation does not bind the verified original result");
      // Receiving native proof and kernel ACK precedes the final continuation
      // save. A restart can recognize those retained facts without another ACK.
      if (r.delivery !== "confirmed" && r.served && r.receiptConfirmed === true && original.hostDeliveryConfirmed === true && original.acknowledged === true) {
        r = { ...r, delivery: "confirmed" }; if (persist) privateSave(path, r);
      }
    }
    return r;
  }
  function retained(persist = !readOnly): ContinuationView[] {
    if (readOnly && persist) throw new Error("read-only continuation projection");
    if (!existsSync(continuations)) return [];
    const names = readdirSync(continuations).filter(n => n.endsWith(".json"));
    if (names.length > 1000) throw new Error("continuation retention requires maintenance");
    return names.map(name => publicContinuation(readContinuation(name.slice(0, -5), persist)));
  }
  async function project(): Promise<WorkflowView> {
    const task = options.taskPath ? await projectTask(readTask(options.taskPath, access.config.sessionId, access.binding)) : undefined;
    return { ...(task ? { task } : {}), templates: options.catalogPath ? readCatalog(options.catalogPath).map(templateView) : [],
      continuation: !!options.resume && !!options.acknowledge, proposals: !!options.propose };
  }
  async function startContinuation(input: Record<string, unknown>): Promise<ContinuationView> {
    if (readOnly || closed || !options.resume || !options.acknowledge || !await access.live()) throw new Error("live parent continuation transport required");
    if (Object.keys(input).some(k => !["requestId", "revision"].includes(k))) throw new Error("continuation accepts an original id and revision only");
    const record = find(input.requestId), view = access.view(record);
    if (view.state !== "awaiting_approval" || view.review?.decision !== "granted" || input.revision !== view.review.revision || !record.proposal) throw new Error("no exact accepted grant for continuation");
    // One durable claim per original operation. A crash or lost response never earns another dispatch.
    const claim = join(continuations, digest(record.requestId) + ".claim");
    privateSave(claim, { requestId: record.requestId, revision: view.review.revision }, true);
    const id = randomUUID(), path = join(continuations, id + ".json");
    const pending: ContinuationRecord = { schema: "chio.control.continuation.v1", id, sessionId: access.config.sessionId, binding: access.binding,
      requestId: record.requestId, revision: view.review.revision, state: "submitted", delivery: "pending" };
    privateSave(path, pending, true);
    const job = (async () => {
      try {
        // Read and verify again immediately before handing the retained arguments to the gateway.
        const original = find(record.requestId), current = access.view(original);
        if (readOnly || closed || !await access.live() || current.review?.decision !== "granted" || current.review.revision !== pending.revision || !original.proposal) throw new Error("grant or action changed before dispatch");
        const result = await options.resume!(id, original.requestId, original.proposal.tool_name, original.proposal.arguments);
        const stored = find(original.requestId);
        if (result.state !== "completed" || result.evidence !== "verified" || !stored.request || !verifyCompletedOutcome(result, access.config.execution, stored.request)
          || !verifiedOriginal(access.config, stored) || digest(result) !== digest(stored.outcome)) throw new Error("continuation outcome remains unresolved");
        privateSave(path, { ...pending, state: "completed", outcome: result, outcomeHash: digest(result), challenge: randomBytes(32).toString("hex") });
      } catch { privateSave(path, { ...pending, state: "unknown" }); }
    })();
    jobs.set(id, job); void job.finally(() => jobs.delete(id)).catch(() => {});
    return publicContinuation(pending);
  }
  function outcome(id: unknown) {
    if (readOnly) throw new Error("read-only continuation projection");
    const r = readContinuation(id);
    if (r.state !== "completed") return { ready: false as const, continuation: publicContinuation(r) };
    const original = find(r.requestId);
    if (!r.outcome || !original.request || !verifyCompletedOutcome(r.outcome, access.config.execution, original.request)
      || digest(r.outcome) !== r.outcomeHash || !/^[0-9a-f]{64}$/.test(r.challenge ?? "")) throw new Error("retained continuation output is invalid");
    privateSave(join(continuations, r.id + ".json"), { ...r, served: true });
    return { ready: true as const, schema: "chio.control.outcome.v1", continuation: publicContinuation(r), outcome: r.outcome, outcomeHash: r.outcomeHash!, challenge: r.challenge! };
  }
  async function acknowledge(id: unknown, input: Record<string, unknown>) {
    if (readOnly || closed || !options.acknowledge) throw new Error("parent outcome acknowledgement unavailable");
    const r = readContinuation(id);
    if (Object.keys(input).some(k => !["outcomeHash", "challenge"].includes(k)) || r.state !== "completed" || !r.served || !r.outcome
      || input.outcomeHash !== r.outcomeHash || input.challenge !== r.challenge) throw new Error("exact served native-control outcome proof required");
    const original = find(r.requestId);
    if (!original.request || !verifyCompletedOutcome(r.outcome, access.config.execution, original.request) || digest(r.outcome) !== r.outcomeHash) throw new Error("output changed before acknowledgement");
    if (r.delivery === "confirmed") return { acknowledged: true, requestId: r.requestId, channel: "native_control" };
    privateSave(join(continuations, r.id + ".ack-claim"), { requestId: r.requestId, outcomeHash: r.outcomeHash }, true);
    privateSave(join(continuations, r.id + ".json"), { ...r, receiptConfirmed: true });
    const result = await options.acknowledge(r.outcome);
    if (!result.acknowledged || result.requestId !== r.requestId) throw new Error("kernel delivery acknowledgement remains unresolved");
    privateSave(join(continuations, r.id + ".json"), { ...r, receiptConfirmed: true, delivery: "confirmed" });
    return { acknowledged: true, requestId: r.requestId, channel: "native_control" };
  }
  async function propose(input: Record<string, unknown>) {
    if (readOnly || closed || !options.propose || !await access.live() || !uuid(input.id) || typeof input.tool !== "string"
      || !input.arguments || typeof input.arguments !== "object" || Array.isArray(input.arguments)
      || Object.keys(input).some(k => !["id", "tool", "arguments"].includes(k))) throw new Error("bounded proposal requires a live parent transport");
    if (!access.config.tools.some(t => t.name === input.tool) || !access.config.approval?.requiredTools.includes(input.tool)) throw new Error("proposal tool must require exact review; no effect fallback");
    const path = join(proposals, input.id + ".json");
    const revision = digest({ sessionId: access.config.sessionId, binding: access.binding, input });
    if (existsSync(path)) {
      const prior = privateRead<{ revision: string; state: string; requestId?: string }>(path);
      if (prior.revision !== revision) throw new Error("proposal id conflicts with original arguments");
      if (!["submitted", "awaiting_approval", "unknown"].includes(prior.state)) throw new Error("corrupt retained proposal");
      return { ...prior, ...(prior.requestId ? { state: access.view(find(prior.requestId)).state } : {}), dispatchPerformed: false };
    }
    privateSave(path, { revision, state: "submitted" }, true);
    try {
      const result = await options.propose(input.id, input.tool, input.arguments as Record<string, unknown>);
      if (result.state !== "awaiting_approval" || access.view(find(result.requestId)).review?.decision !== "required") throw new Error("proposal was not retained for exact review");
      const retained = { revision, state: "awaiting_approval", requestId: result.requestId };
      privateSave(path, retained); return { ...retained, dispatchPerformed: false };
    } catch { privateSave(path, { revision, state: "unknown" }); throw new Error("proposal unresolved; inspect original id without resubmission"); }
  }
  function selectTemplate(input: Record<string, unknown>) {
    if (readOnly || !options.catalogPath || !uuid(input.id) || typeof input.templateId !== "string" || Object.keys(input).some(k => !["id", "templateId", "revision"].includes(k))) throw new Error("invalid task selection");
    const template = readCatalog(options.catalogPath).find(t => t.id === input.templateId);
    if (!template || templateView(template).revision !== input.revision) throw new Error("task template changed");
    const path = join(taskRequests, input.id + ".json");
    privateSave(path, { schema: "chio.task.request.v1", sessionId: access.config.sessionId, binding: access.binding, ...input, state: "requested", createdAt: Date.now() }, true);
    return { id: input.id, state: "requested", templateId: template.id, authorityAccepted: false, dispatchPerformed: false };
  }
  function explain(requestId: unknown): ExplanationView {
    const r = find(requestId), view = access.view(r);
    const receipt = r.outcome && "receipt" in r.outcome ? r.outcome.receipt : undefined;
    const verified = !!r.request && !!receipt && verifyBoundReceipt(receipt, { ...access.config.execution, tool: r.request.tool, parameters: r.request.arguments, requestId: r.requestId });
    const signedReason = verified ? receipt!.decision?.reason : undefined;
    return { requestId: r.requestId, state: view.state, reason: signedReason?.slice(0, 4096) ?? r.outcome?.reason?.slice(0, 4096) ?? "No structured denial reason was retained.",
      source: signedReason ? "verified_kernel_receipt" : "retained_gateway", ...(verified ? { receiptId: receipt!.id } : {}),
      policyRehearsal: "unavailable", resourcePreview: "unavailable", informationFlow: "unknown" };
  }
  return { project, retained, startContinuation, outcome, acknowledge, propose, selectTemplate, explain,
    async close() { closed = true; await Promise.allSettled([...jobs.values()]); } };
}
