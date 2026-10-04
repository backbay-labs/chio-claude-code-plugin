import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalizeJson } from "@chio-protocol/sdk/invariants";
import { createMcpExecutionClient } from "@chio/bridge";
// Internal bridge contracts are pinned by the vendored archive and bundled at release.
import { gatewayApprovalPath, gatewayBinding, operationKey, privatePath, type GatewayConfig, type StoredOperation } from "../../node_modules/@chio/bridge/dist/gateway.js";
import { gatewayStatus } from "../../node_modules/@chio/bridge/dist/gateway-operator.js";
import { verifyApprovalToolCall } from "../../node_modules/@chio/bridge/dist/approval.js";
import type { ControlStatus, IntentKind, IntentState, IntentView, OperationView } from "../../types/control.js";

import { createWorkflowControl, type WorkflowOptions } from "../workflow/control.js";
import { projectTask, readCatalog, readTask, templateView } from "../workflow/tasks.js";
import { verifiedOriginal } from "../workflow/outcome.js";

const LIMIT = 1024 * 1024;
const kinds: IntentKind[] = ["approve", "decline", "revoke"];
interface IntentRecord extends IntentView { schema: "chio.control.intent.v1"; binding: string; revision: string; createdAt: number }
export interface ControlOptions {
  config: GatewayConfig;
  workflow?: WorkflowOptions;
  /** Launcher observations of exact model tool results; never inferred from ACK alone. */
  modelDeliveryConfirmed?: (requestId: string) => boolean;
  authorityExpiresAt: number;
  scope?: ControlStatus["scope"];
  /** Test seam. Production uses the kernel's delegated-session validation. */
  validateAuthority?: () => Promise<boolean>;
  /** Protected launchers terminate their transport on an authenticated foreign host id. */
  onSessionMismatch?: () => void;
}
function hash(value: unknown): string { return createHash("sha256").update(canonicalizeJson(value)).digest("hex"); }
function privateJson<T>(path: string): T {
  privatePath(path, false);
  if (lstatSync(path).size > LIMIT) throw new Error("private record exceeds projection limit");
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
function syncDirectory(path: string): void { const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
function save(path: string, value: unknown, exclusive = false): void {
  const output = exclusive ? path : `${path}.${randomUUID()}.tmp`;
  const fd = openSync(output, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  if (!exclusive) renameSync(output, path);
  syncDirectory(resolve(path, ".."));
}
function intentDirectory(config: GatewayConfig): string {
  const path = join(config.journalDir, "control-intents");
  mkdirSync(path, { recursive: true, mode: 0o700 }); privatePath(path, true); return path;
}
function intentRecords(config: GatewayConfig): IntentRecord[] {
  const dir = intentDirectory(config);
  const names = readdirSync(dir).filter(name => name.endsWith(".json"));
  if (names.length > 1000) throw new Error("control intent retention requires operator maintenance");
  return names.map(name => {
    const r = privateJson<IntentRecord>(join(dir, name));
    if (r.schema !== "chio.control.intent.v1" || r.sessionId !== config.sessionId || r.binding !== hash(gatewayBinding(config))) throw new Error("control intent binding changed");
    return r;
  });
}
function publicIntent({ id, kind, state, sessionId, requestId, expiresAt }: IntentRecord): IntentView {
  return { id, kind, state, sessionId, ...(requestId ? { requestId } : {}), expiresAt };
}
function records(config: GatewayConfig): StoredOperation[] {
  gatewayStatus(config); // Also checks private paths and the frozen authority binding.
  const names = readdirSync(config.journalDir).filter(name => name.endsWith(".json"));
  if (names.length > 1000) throw new Error("operation projection bound exceeded");
  return names.sort().map(name => {
    const r = privateJson<StoredOperation>(join(config.journalDir, name));
    if (name !== `${operationKey(r.requestId)}.json` || !r.digest) throw new Error("operation identity changed");
    return r;
  });
}
function approval(config: GatewayConfig, record: StoredOperation) {
  if (!record.proposal) return undefined;
  const path = gatewayApprovalPath(config, record.requestId);
  if (!readdirSync(resolve(path, "..")).includes(`${operationKey(record.requestId)}.json`)) return undefined;
  const artifact = privateJson<{ toolCallParams?: unknown }>(path);
  return verifyApprovalToolCall(artifact.toolCallParams, { ...config.execution, sessionId: config.execution.sessionId, requestId: record.requestId,
    tool: record.proposal.tool_name, arguments: record.proposal.arguments });
}
function reviewRevision(config: GatewayConfig, record: StoredOperation): string {
  return hash({ binding: gatewayBinding(config), requestId: record.requestId, digest: record.digest, state: record.state, proposal: record.proposal ?? null });
}
function project(config: GatewayConfig, record: StoredOperation): OperationView {
  const verified = verifiedOriginal(config, record);
  const state = record.state === "completed" && !verified ? "unknown" : record.state;
  let decision: "required" | "granted" | "declined" | "expired" = "required";
  if (record.proposal) {
    mkdirSync(join(config.journalDir, "approvals"), { recursive: true, mode: 0o700 });
    const approved = approval(config, record);
    if (approved) decision = approved.decision === "approved" ? "granted" : "declined";
    else if (readdirSync(join(config.journalDir, "approvals")).includes(`${operationKey(record.requestId)}.json`)) decision = "expired";
  }
  const nextAction = state === "pending" || state === "unknown" ? "reconcile_original"
    : state === "denied" ? "linked_continuation"
    : state === "awaiting_approval" ? decision === "granted" ? "explicit_resume" : decision === "required" ? "review" : "linked_continuation"
    : state === "completed" && (!record.acknowledged || record.hostDeliveryRequired !== false && !record.hostDeliveryConfirmed) ? "acknowledge_delivery" : "none";
  const view: OperationView = { requestId: record.requestId, state, evidence: verified ? "verified" : "unverified",
    acknowledged: verified && record.acknowledged === true, hostDeliveryConfirmed: verified && record.hostDeliveryConfirmed === true, nextAction,
    ...(record.request?.tool || record.proposal?.tool_name ? { tool: record.request?.tool ?? record.proposal!.tool_name } : {}),
    ...(verified && record.outcome?.state === "completed" && record.outcome.receipt ? { receiptId: record.outcome.receipt.id } : {}) };
  if (record.proposal && state === "awaiting_approval") {
    if (record.proposal.session_id !== config.execution.sessionId || record.proposal.capability_id !== config.execution.capabilityId
      || record.digest !== operationKey(canonicalizeJson({ name: record.proposal.tool_name, args: record.proposal.arguments }))) throw new Error("proposal does not bind the retained action");
    view.review = { revision: reviewRevision(config, record), purpose: record.proposal.purpose, arguments: record.proposal.arguments,
      capabilityId: record.proposal.capability_id, ttlSeconds: record.proposal.ttl_seconds, restrictions: "kernel_policy", budgetImpact: "unavailable", decision };
  }
  return view;
}
export async function controlStatus(options: ControlOptions): Promise<ControlStatus> {
  const config = options.config;
  const operations = records(config).map(record => project(config, record));
  const intents = intentRecords(config).map(publicIntent);
  let authority: ControlStatus["authority"] = "disconnected";
  if (options.authorityExpiresAt <= Math.floor(Date.now() / 1000)) authority = "expired";
  else if (intents.some(intent => intent.kind === "revoke" && intent.state === "confirmed")) authority = "revoked";
  else {
    try {
      const valid = options.validateAuthority ? await options.validateAuthority() : (await createMcpExecutionClient({ ...config.execution, timeoutMs: Math.min(config.execution.timeoutMs ?? 3000, 3000) }).validateSession({ allowedTools: config.tools.map(tool => tool.name) })).ok;
      if (valid) authority = "live";
    } catch { /* Retain evidence while the kernel is unreachable. */ }
  }
  const workflow = options.workflow;
  for (const [field, path] of [["task", workflow?.taskPath], ["catalog", workflow?.catalogPath]] as const) {
    if (path && resolve(path) !== join(config.journalDir, "workflow", field + ".json")) throw new Error("foreign workflow path");
  }
  const task = workflow?.taskPath ? await projectTask(readTask(workflow.taskPath, config.sessionId, hash(gatewayBinding(config)))) : undefined;
  const templates = workflow?.catalogPath ? readCatalog(workflow.catalogPath).map(templateView) : [];
  const taskRequestDir = join(config.journalDir, "workflow", "task-requests");
  const requestNames = existsSync(taskRequestDir) ? readdirSync(taskRequestDir).filter(name => name.endsWith(".json")) : [];
  if (requestNames.length > 1000) throw new Error("task request retention requires maintenance");
  const requests = requestNames.map(name => {
    const r = privateJson<{ schema: string; id: string; sessionId: string; binding: string; templateId: string; revision: string; createdAt: number }>(join(taskRequestDir, name));
    if (r.schema !== "chio.task.request.v1" || name !== r.id + ".json" || !/^[0-9a-f-]{36}$/.test(r.id) || r.sessionId !== config.sessionId
      || r.binding !== hash(gatewayBinding(config)) || typeof r.templateId !== "string" || !/^[0-9a-f]{64}$/.test(r.revision) || !Number.isSafeInteger(r.createdAt) || r.createdAt > Date.now() + 5000) throw new Error("invalid or foreign task request");
    const template = templates.find(t => t.id === r.templateId);
    const state = !template || template.revision !== r.revision ? "stale" as const : Date.now() >= r.createdAt + Math.min(90_000, template.ttlSeconds * 1000) ? "expired" as const : "requested" as const;
    return { id: r.id, templateId: r.templateId, state, createdAt: r.createdAt };
  });
  const unresolved = operations.filter(op => op.state === "pending" || op.state === "unknown" || op.state === "completed" && op.nextAction !== "none").length;
  return { schema: "chio.control.status.v1", sessionId: config.sessionId, checkedAt: Date.now(), scope: options.scope ?? "kernel_mcp", authority,
    authorityExpiresAt: options.authorityExpiresAt, protectedTools: config.tools.map(tool => tool.name), revision: hash(gatewayBinding(config)),
    awaitingReview: operations.filter(op => op.review?.decision === "required").length, unresolved,
    fenced: gatewayStatus(config).fenced || operations.some(op => op.state === "pending" || op.state === "unknown"), operations, intents,
    workflow: { ...(task ? { task } : {}), templates, requests, continuation: !!workflow?.resume && !!workflow?.acknowledge, proposals: !!workflow?.propose } };
}
function requestIntent(options: ControlOptions, input: Record<string, unknown>): IntentView {
  const config = options.config;
  const kind = input.kind as IntentKind;
  if (!kinds.includes(kind) || typeof input.revision !== "string" || Object.keys(input).some(key => !["kind", "revision", "requestId"].includes(key))) throw new Error("invalid review intent");
  if (options.authorityExpiresAt <= Math.floor(Date.now() / 1000)) throw new Error("authority expired");
  if (kind === "revoke") {
    if (input.requestId !== undefined || input.revision !== hash(gatewayBinding(config))) throw new Error("revocation binding changed");
  } else {
    if (typeof input.requestId !== "string" || input.requestId.length > 256) throw new Error("exact operation required");
    const record = records(config).find(record => record.requestId === input.requestId);
    if (!record || record.state !== "awaiting_approval" || project(config, record).review?.decision !== "required" || reviewRevision(config, record) !== input.revision) throw new Error("review is stale, already decided, or belongs to another action");
  }
  const existing = intentRecords(config);
  if (existing.some(intent => intent.kind !== "alternative" && intent.requestId === input.requestId && intent.revision === input.revision)) throw new Error("review intent already recorded; inspect its original outcome");
  const record: IntentRecord = { schema: "chio.control.intent.v1", id: randomUUID(), kind, state: "requested", sessionId: config.sessionId,
    ...(typeof input.requestId === "string" ? { requestId: input.requestId } : {}), revision: input.revision, binding: hash(gatewayBinding(config)),
    createdAt: Date.now(), expiresAt: Math.min(Date.now() + 90_000, options.authorityExpiresAt * 1000) };
  save(join(intentDirectory(config), `${record.id}.json`), record, true);
  return publicIntent(record);
}
function reply(response: ServerResponse, code: number, value: unknown): void {
  response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(JSON.stringify(value));
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"] !== "application/json") throw new Error("JSON required");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 4096) throw new Error("intent body too large"); chunks.push(chunk); }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("intent object required");
  return value as Record<string, unknown>;
}
export async function startControlServer(options: ControlOptions) {
  // Freeze all authority selection before exposing a host credential.
  const pinned: ControlOptions = { ...options, config: JSON.parse(JSON.stringify(options.config)) as GatewayConfig };
  records(pinned.config);
  const workflow = createWorkflowControl({ config: pinned.config, binding: hash(gatewayBinding(pinned.config)),
    read: () => records(pinned.config), view: record => project(pinned.config, record),
    live: async () => (await controlStatus(pinned)).authority === "live" }, pinned.workflow);
  const token = randomBytes(32).toString("hex");
  let statusReads = 0;
  let sessionMismatch = false;
  let closing: Promise<void> | undefined;
  const server = createServer((request, response) => { void (async () => {
    const got = Buffer.from(request.headers.authorization ?? ""); const expected = Buffer.from(`Bearer ${token}`);
    if (request.headers.origin || got.length !== expected.length || !timingSafeEqual(got, expected)) return reply(response, 401, { error: "unauthorized" });
    if (pinned.authorityExpiresAt <= Math.floor(Date.now() / 1000)) return reply(response, 401, { error: "scoped credential expired" });
    const root = `/sessions/${encodeURIComponent(pinned.config.sessionId)}`;
    if (pinned.onSessionMismatch && /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//.test(request.url ?? "") && !request.url?.startsWith(root + "/")) {
      if (!sessionMismatch) { sessionMismatch = true; pinned.onSessionMismatch(); }
      return reply(response, 404, { error: "host session changed; original transport remains fenced" });
    }
    if (sessionMismatch) return reply(response, 409, { error: "host session changed; launch a newly bound host" });
    if (request.method === "GET" && request.url === root + "/status") {
      const status = await controlStatus(pinned); statusReads += 1;
      const continuations = workflow.retained();
      for (const operation of status.operations) {
        if (operation.hostDeliveryConfirmed) operation.deliveryChannel = continuations.some(c => c.requestId === operation.requestId && c.receiptConfirmed === true) ? "native_control" : pinned.modelDeliveryConfirmed?.(operation.requestId) ? "model_tool_result" : "unclassified";
      }
      return reply(response, 200, { ...status, continuations });
    }
    if (request.method === "POST" && request.url === root + "/intents") return reply(response, 202, { intent: requestIntent(pinned, await body(request)), authorityAccepted: false, dispatchPerformed: false });
    if (request.method === "POST" && request.url === root + "/continuations") return reply(response, 202, { continuation: await workflow.startContinuation(await body(request)) });
    if (request.method === "POST" && request.url === root + "/proposals") return reply(response, 202, await workflow.propose(await body(request)));
    if (request.method === "POST" && request.url === root + "/task-requests") return reply(response, 202, workflow.selectTemplate(await body(request)));
    const continuationRoute = request.url?.startsWith(root + "/continuations/") ? request.url.slice((root + "/continuations/").length).split("/") : [];
    if (continuationRoute.length === 2 && request.method === "GET" && continuationRoute[1] === "outcome") {
      let result = workflow.outcome(continuationRoute[0]);
      if (!result.ready && result.continuation.state === "submitted") {
        await new Promise(resolveWait => setTimeout(resolveWait, 200));
        result = workflow.outcome(continuationRoute[0]);
      }
      return reply(response, result.ready ? 200 : 202, result);
    }
    if (continuationRoute.length === 2 && request.method === "POST" && continuationRoute[1] === "ack") return reply(response, 200, await workflow.acknowledge(continuationRoute[0], await body(request)));
    if (request.method === "GET" && request.url?.startsWith(root + "/explanations/")) return reply(response, 200, workflow.explain(decodeURIComponent(request.url.slice((root + "/explanations/").length))));
    return reply(response, 404, { error: "no route for this session" });
  })().catch(() => reply(response, 409, { error: "control request unavailable, stale, or unresolved; inspect the original operation without automatic retry" })); });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.timeout = 5000;
  await new Promise<void>((resolveReady, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveReady); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("missing control listener");
  return { url: `http://127.0.0.1:${address.port}`, port: address.port, token,
    get statusReads() { return statusReads; },
    get sessionMismatch() { return sessionMismatch; },
    close: () => closing ??= (async () => { await workflow.close(); await new Promise<void>((resolveClose, reject) => { server.close(error => error ? reject(error) : resolveClose()); server.closeAllConnections(); }); })() };
}

/** Called only by the trusted operator CLI, never by the host-facing listener. */
export async function confirmControlIntent(config: GatewayConfig, operator: { adminToken: string }, id: string): Promise<IntentView> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("invalid intent id");
  records(config);
  const path = join(intentDirectory(config), `${id}.json`);
  const intent = privateJson<IntentRecord>(path);
  if (intent.id !== id || intent.schema !== "chio.control.intent.v1" || intent.sessionId !== config.sessionId || intent.binding !== hash(gatewayBinding(config))
    || intent.state !== "requested" || intent.expiresAt <= Date.now() || intent.kind === "alternative") throw new Error("intent cannot be confirmed; inspect the original or create a permitted linked action");
  if (!operator.adminToken || operator.adminToken === config.execution.bearerToken) throw new Error("distinct operator-only credential required");
  const endpoint = new URL(config.execution.endpoint);
  if (endpoint.pathname !== "/" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1"))) throw new Error("invalid authority endpoint");
  const lockPath = join(intentDirectory(config), `${id}.lock`);
  const lock = openSync(lockPath, "wx", 0o600); closeSync(lock); // Retained even on failure: no blind resubmission.
  const record = intent.requestId ? records(config).find(record => record.requestId === intent.requestId) : undefined;
  if (intent.kind === "revoke" ? intent.revision !== hash(gatewayBinding(config)) : !record || record.state !== "awaiting_approval" || reviewRevision(config, record) !== intent.revision || project(config, record).review?.decision !== "required") throw new Error("intent action changed after review");
  intent.state = "submitted"; save(path, intent);
  const post = async (route: string, value?: unknown): Promise<Record<string, any>> => {
    const response = await fetch(new URL(route, endpoint), { method: "POST", headers: { Authorization: `Bearer ${operator.adminToken}`, "Content-Type": "application/json" },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }), redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("kernel rejected operator decision");
    const text = await response.text(); if (text.length > LIMIT) throw new Error("authority response exceeds limit");
    return JSON.parse(text) as Record<string, any>;
  };
  try {
    if (intent.kind === "revoke") {
      const result = await post(`/admin/sessions/${encodeURIComponent(config.execution.sessionId)}/trust`);
      if (result.sessionId !== config.execution.sessionId || result.revoked !== true || !Array.isArray(result.capabilities)
        || !result.capabilities.some((cap: any) => cap.capabilityId === config.execution.capabilityId && cap.revoked === true)) throw new Error("kernel did not confirm this session's capability revocation");
      intent.state = "confirmed";
    } else {
      const proposal = record!.proposal!;
      const submitted = await post("/admin/approvals", proposal);
      const binds = (value: Record<string, any>) => value.dispatchPerformedByThisEndpoint === false && value.record?.request_id === record!.requestId
        && value.record?.session_id === config.execution.sessionId && value.record?.capability_id === config.execution.capabilityId && typeof value.record?.id === "string";
      if (!binds(submitted)) throw new Error("kernel proposal acknowledgement changed the authority binding");
      const artifact = await post(`/admin/approvals/${encodeURIComponent(submitted.record.id)}/decision`, { decision: intent.kind === "approve" ? "approved" : "denied" });
      const verified = verifyApprovalToolCall(artifact.toolCallParams, { ...config.execution, sessionId: config.execution.sessionId, requestId: record!.requestId, tool: proposal.tool_name, arguments: proposal.arguments });
      if (!binds(artifact) || !verified || verified.decision !== (intent.kind === "approve" ? "approved" : "denied")) throw new Error("kernel decision lacks the exact trusted signature");
      if (reviewRevision(config, records(config).find(r => r.requestId === record!.requestId)!) !== intent.revision) throw new Error("operation changed while authority was submitted");
      mkdirSync(join(config.journalDir, "approvals"), { recursive: true, mode: 0o700 });
      save(gatewayApprovalPath(config, record!.requestId), artifact, true);
      intent.state = intent.kind === "approve" ? "granted" : "declined";
    }
    save(path, intent); return publicIntent(intent);
  } catch (error) { intent.state = "unknown"; save(path, intent); throw error; }
}
