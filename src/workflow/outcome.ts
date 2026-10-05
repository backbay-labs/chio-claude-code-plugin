import { verifyCompletedOutcome } from "@chio/bridge";
import type { GatewayConfig, StoredOperation } from "../bridge-internals/gateway.js";
import { digest } from "./store.js";

/** Bind the journal identity as well as the signed request and result. */
export function verifiedOriginal(config: GatewayConfig, record: StoredOperation): boolean {
  return record.state === "completed" && !!record.request && record.request.requestId === record.requestId
    && record.outcome?.state === "completed" && record.outcome.requestId === record.requestId
    && record.digest === digest({ name: record.request.tool, args: record.request.arguments })
    && verifyCompletedOutcome(record.outcome, config.execution, record.request);
}
