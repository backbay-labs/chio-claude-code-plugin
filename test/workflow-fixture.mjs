// Signed deterministic fixture. This is not a resource owner or a qualified kernel.
import { canonicalizeJson, sha256Hex, signUtf8MessageEd25519, receiptSigningBodyCanonicalJson } from "@chio-protocol/sdk/invariants";
export const seed = "a1".repeat(32);
export const signer = signUtf8MessageEd25519("identity", seed).public_key_hex;
export function signedDecision(config, proposal, decision = "approved") {
  const intent = { server_id: config.execution.serverId, tool_name: proposal.tool_name,
    body: { kind: "bound_tool_invocation", value: { capability_id: config.execution.capabilityId, parameters_hash: "0x" + sha256Hex(canonicalizeJson(proposal.arguments)) } },
    context: { mcpSessionId: config.execution.sessionId, capabilityId: config.execution.capabilityId } };
  const now = Math.floor(Date.now() / 1000);
  const token = { id: "approval-a", approver: signer, subject: config.execution.subjectKey, governed_intent_hash: sha256Hex(canonicalizeJson(intent)),
    request_id: proposal.request_id, issued_at: now, expires_at: now + 300, decision };
  token.signature = signUtf8MessageEd25519(canonicalizeJson(token), seed).signature_hex;
  return { name: proposal.tool_name, arguments: proposal.arguments, _meta: { chioRequestId: proposal.request_id, chioGovernedIntent: intent, chioApprovalToken: token } };
}
export function signedOutcome(config, request) {
  const result = { content: [{ type: "text", text: "One fixture write completed." }], isError: false };
  const receipt = { id: "", timestamp: Math.floor(Date.now() / 1000), capability_id: config.execution.capabilityId,
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
