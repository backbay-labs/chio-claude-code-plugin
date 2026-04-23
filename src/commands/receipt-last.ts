import { buildBridge } from "../state/bridge.js";

export async function receiptLast(): Promise<string> {
  const bridge = buildBridge();
  const items = await bridge.receipts({ limit: 1 });
  const receipt = items[0];
  if (!receipt) return JSON.stringify({ status: "empty" }, null, 2);

  let signatureValid: boolean | string = "unchecked";
  try {
    signatureValid = await bridge.verifyReceipt(receipt);
  } catch (err) {
    signatureValid = `error: ${(err as Error).message}`;
  }

  return JSON.stringify(
    {
      id: receipt.id,
      timestamp: receipt.timestamp,
      tool_server: receipt.tool_server,
      tool_name: receipt.tool_name,
      decision: receipt.decision,
      policy_hash: receipt.policy_hash,
      content_hash: receipt.content_hash,
      signature_valid: signatureValid,
      signature: receipt.signature,
    },
    null,
    2,
  );
}
