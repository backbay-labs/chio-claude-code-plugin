import { canonicalizeJson, signUtf8MessageEd25519, verifyUtf8MessageEd25519 } from "@chio-protocol/sdk/invariants";
import type { TaskView } from "../../types/workflow.js";
import type { ControlStatus } from "../../types/control.js";
interface CapsuleBody {
  schema: "chio.task.handoff.v1";
  capturedAt: number;
  sourceSessionId: string;
  task: TaskView;
  retainedOperations: { requestId: string; state: string; nextAction: string; receiptId?: string }[];
  authorityTransferred: false;
}
export interface HandoffCapsule { body: CapsuleBody; signer: string; signature: string }
/** The operator attests this snapshot. It is not a kernel receipt or an authority grant. */
export function createHandoff(task: TaskView, status: ControlStatus, seed: string): HandoffCapsule {
  if (!/^[0-9a-f]{64}$/.test(seed) || task.sessionId !== status.sessionId) throw new Error("operator signing key and exact source session required");
  const body: CapsuleBody = { schema: "chio.task.handoff.v1", capturedAt: Date.now(), sourceSessionId: status.sessionId, task,
    retainedOperations: status.operations.map(o => ({ requestId: o.requestId, state: o.state, nextAction: o.nextAction, ...(o.receiptId ? { receiptId: o.receiptId } : {}) })), authorityTransferred: false };
  const signed = signUtf8MessageEd25519(canonicalizeJson(body), seed);
  return { body, signer: signed.public_key_hex, signature: signed.signature_hex };
}
export function verifyHandoff(capsule: HandoffCapsule, trustedSigner: string) {
  const body = capsule?.body;
  if (!/^[0-9a-f]{64}$/.test(trustedSigner) || capsule?.signer !== trustedSigner || !body || body.schema !== "chio.task.handoff.v1"
    || body.authorityTransferred !== false || body.sourceSessionId !== body.task?.sessionId || typeof body.task?.goal !== "string"
    || body.task.goal.length > 4096 || !Number.isSafeInteger(body.capturedAt) || body.capturedAt > Date.now() + 5000
    || !Array.isArray(body.retainedOperations) || body.retainedOperations.length > 1000 || JSON.stringify(capsule).length > 1024 * 1024
    || !verifyUtf8MessageEd25519(canonicalizeJson(body), trustedSigner, capsule.signature)) throw new Error("handoff signature, source binding or independent signer pin is invalid");
  return { verified: true, snapshot: body, authorityTransferred: false, next: "Prepare separately bound authority. Recollect evidence for the target task; reconcile original uncertain operations in their source session." };
}
