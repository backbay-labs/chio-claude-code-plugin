// Local demo fixture. Not a kernel, resource owner or qualified boundary. Keys come from each run's own seed.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { canonicalizeJson, sha256Hex, signUtf8MessageEd25519, receiptSigningBodyCanonicalJson } from "@chio-protocol/sdk/invariants";

// Gateway config and proposal shapes are loose here on purpose: this fixture only reads a few fields.
type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface ToolResult { content: { type: "text"; text: string }[]; isError: boolean }

export function signerFor(seed: string): string {
  return signUtf8MessageEd25519("identity", seed).public_key_hex;
}

export function signedDecision(config: Loose, proposal: Loose, decision: "approved" | "denied", seed: string): Loose {
  const signer = signerFor(seed);
  const intent = { server_id: config.execution.serverId, tool_name: proposal.tool_name,
    body: { kind: "bound_tool_invocation", value: { capability_id: config.execution.capabilityId, parameters_hash: "0x" + sha256Hex(canonicalizeJson(proposal.arguments)) } },
    context: { mcpSessionId: config.execution.sessionId, capabilityId: config.execution.capabilityId } };
  const now = Math.floor(Date.now() / 1000);
  const token: Loose = { id: "approval-a", approver: signer, subject: config.execution.subjectKey, governed_intent_hash: sha256Hex(canonicalizeJson(intent)),
    request_id: proposal.request_id, issued_at: now, expires_at: now + 300, decision };
  token.signature = signUtf8MessageEd25519(canonicalizeJson(token), seed).signature_hex;
  return { name: proposal.tool_name, arguments: proposal.arguments, _meta: { chioRequestId: proposal.request_id, chioGovernedIntent: intent, chioApprovalToken: token } };
}

export function signedOutcome(config: Loose, request: { requestId: string; tool: string; arguments: Loose; approval: Loose }, seed: string,
  result: ToolResult = { content: [{ type: "text", text: "One fixture write completed." }], isError: false }): Loose {
  const signer = signerFor(seed);
  const receipt: Loose = { id: "", timestamp: Math.floor(Date.now() / 1000), capability_id: config.execution.capabilityId,
    tool_server: config.execution.serverId, tool_name: request.tool, action: { parameters: request.arguments, parameter_hash: sha256Hex(canonicalizeJson(request.arguments)) },
    decision: { verdict: "allow", reason: "fixture exact grant" }, receipt_kind: "mediated_decision", boundary_class: "prevent", trust_level: "mediated",
    tool_origin: "resource", redaction_mode: "none", content_hash: sha256Hex(canonicalizeJson(result)), policy_hash: "c".repeat(64), kernel_key: signer,
    metadata: { receipt_context: { request_id: request.requestId }, attribution: { subject_key: config.execution.subjectKey },
      admission_operation: { schema: "chio.admission-receipt.v1", request_id: request.requestId, projected_state: "completed", projected_dispatch_state: "terminal", tool_outcome_id: "fixture-outcome" } } };
  receipt.id = sha256Hex(canonicalizeJson(JSON.parse(receiptSigningBodyCanonicalJson(receipt)).body));
  receipt.signature = signUtf8MessageEd25519(receiptSigningBodyCanonicalJson(receipt), seed).signature_hex;
  const params = { name: request.tool, arguments: request.arguments, _meta: { chioRequestId: request.requestId, ...request.approval } };
  return { state: "completed", evidence: "verified", requestId: request.requestId, result, receipt,
    delivery: { schema: "chio.mcp.delivery-ack.v1", requestId: request.requestId, receiptId: receipt.id, resultHash: receipt.content_hash,
      requestHash: sha256Hex(canonicalizeJson({ method: "tools/call", params })), acknowledgement: "A".repeat(43) } };
}

export interface DemoKernelOptions { owner: string; seed: string; adminToken: string; bearerToken: string; credential: Loose; config: () => Loose }
export interface DemoKernel { url: string; port: number; writes: () => number; close(): Promise<void> }

const MAX_BODY = 1024 * 1024;

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}

export async function startDemoKernel(options: DemoKernelOptions): Promise<DemoKernel> {
  const { owner, seed, adminToken, bearerToken, credential } = options;
  const ownerRoot = resolve(owner);
  const proposals = new Map<string, Loose>();
  let counter = 0, writes = 0, revoked = false;
  const send = (res: ServerResponse, status: number, body: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

  // Returns the confined absolute path, or throws.
  const confine = (path: unknown): string => {
    if (typeof path !== "string" || path === "" || path.includes("\u0000") || isAbsolute(path)) throw new Error("path is not allowed");
    const full = resolve(ownerRoot, path);
    const rel = relative(ownerRoot, full);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("path escapes the owner directory");
    return full;
  };

  const server = createServer(async (req, res) => {
    let body: any;
    try { body = await readBody(req); } catch { send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "invalid request body" } }); return; }
    const path = (req.url ?? "").split("?")[0] ?? "";
    const config = options.config();
    if (path.startsWith("/admin/")) {
      if (req.headers.authorization !== `Bearer ${adminToken}`) { send(res, 401, { error: "unauthorized" }); return; }
      const record = (id: string, proposal: Loose) => ({ id, request_id: proposal.request_id, session_id: config.execution.sessionId, capability_id: config.execution.capabilityId });
      if (req.method === "POST" && path === "/admin/approvals") {
        const id = `approval-${++counter}`; proposals.set(id, body);
        send(res, 200, { dispatchPerformedByThisEndpoint: false, record: record(id, body) }); return;
      }
      const decision = /^\/admin\/approvals\/([^/]+)\/decision$/.exec(path);
      if (req.method === "POST" && decision) {
        const id = decodeURIComponent(decision[1] ?? ""); const proposal = proposals.get(id);
        if (!proposal || (body.decision !== "approved" && body.decision !== "denied")) { send(res, 404, { error: "unknown approval or decision" }); return; }
        send(res, 200, { dispatchPerformedByThisEndpoint: false, record: record(id, proposal), toolCallParams: signedDecision(config, proposal, body.decision, seed) }); return;
      }
      if (req.method === "POST" && path === `/admin/sessions/${encodeURIComponent(config.execution.sessionId)}/trust`) {
        revoked = true;
        send(res, 200, { sessionId: config.execution.sessionId, revoked: true, capabilities: [{ capabilityId: config.execution.capabilityId, revoked: true }] }); return;
      }
      send(res, 404, { error: "not found" }); return;
    }
    if (req.headers.authorization !== `Bearer ${bearerToken}` || req.headers["mcp-session-id"] !== credential.sessionId || revoked) {
      send(res, 401, { jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32001, message: "unauthorized" } }); return;
    }
    const id = body?.id ?? null;
    const fail = (message: string) => send(res, 200, { jsonrpc: "2.0", id, error: { code: -32602, message } });
    const ok = (result: unknown) => send(res, 200, { jsonrpc: "2.0", id, result });
    const params = body?.params ?? {};
    if (body?.method === "chio/execution-context") {
      ok({ schema: "chio.mcp.execution-context.v1", evidenceVersion: "1", deliveryAcknowledgementVersion: "1", subjectKey: credential.subjectKey,
        serverId: credential.serverId, capabilityIds: credential.capabilityIds, sessionCredential: credential }); return;
    }
    if (body?.method === "tools/call" && (params.name === "write_file" || params.name === "read_text_file")) {
      let text: string;
      try {
        const full = confine(params.arguments?.path);
        if (params.name === "write_file") {
          if (typeof params.arguments.content !== "string") throw new Error("content must be a string");
          mkdirSync(dirname(full), { recursive: true });
          writeFileSync(full, params.arguments.content, { flag: "wx" });
          writes++; text = `Wrote ${params.arguments.path} in the demo owner directory.`;
        } else text = readFileSync(full, "utf8");
      } catch (error) { fail(error instanceof Error ? error.message : "tool call refused"); return; }
      const outcome = signedOutcome(config, { requestId: params._meta?.chioRequestId, tool: params.name, arguments: params.arguments,
        approval: { chioGovernedIntent: params._meta?.chioGovernedIntent, chioApprovalToken: params._meta?.chioApprovalToken } }, seed,
        { content: [{ type: "text", text }], isError: false });
      ok({ _meta: { chioEvidence: { schema: "chio.mcp.execution-evidence.v1", requestId: outcome.requestId, receipt: outcome.receipt, terminalState: "completed", outputKind: "value", output: outcome.result }, chioDelivery: outcome.delivery } }); return;
    }
    if (body?.method === "chio/acknowledge") {
      ok({ schema: "chio.mcp.delivery-ack.v1", requestId: params.requestId, receiptId: params.receiptId, acknowledged: true }); return;
    }
    send(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "method is not available in the demo fixture" } });
  });
  await new Promise<void>(ready => server.listen(0, "127.0.0.1", ready));
  const address = server.address(); const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, port, writes: () => writes,
    close: () => new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }) };
}
