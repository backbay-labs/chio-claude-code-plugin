import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

// Input identifiers never become path components, even on rejected requests.
export function recordKey(sessionId, toolUseId) {
  return createHash("sha256").update(JSON.stringify([sessionId, toolUseId])).digest("hex");
}

export async function verifyAuthorization(bridge, receipt, expected) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("missing authorization receipt");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(expected.trustedKey ?? "")) {
    throw new Error("CHIO_TRUSTED_RECEIPT_KEY must pin the operator-trusted kernel key");
  }
  if (receipt.kernel_key !== expected.trustedKey || receipt.capability_id !== expected.capabilityId ||
      receipt.tool_name !== expected.tool || receipt.tool_server !== expected.serverId ||
      receipt.decision?.verdict !== "allow" ||
      !isDeepStrictEqual(receipt.action?.parameters, expected.params)) {
    throw new Error("authorization receipt does not match the trusted signer, capability, or request");
  }
  if (!(await bridge.verifyReceipt(receipt))) {
    throw new Error("authorization receipt signature or parameter hash is invalid");
  }
}
