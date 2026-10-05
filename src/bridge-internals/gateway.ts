// Seam for the unexported @chio/bridge dist/gateway.js; pinned by test/bridge-internals.test.mjs.
// When a bridge release exports ./gateway, ./gateway-operator, ./approval and ./execution, point this at that subpath.
export { createGateway, gatewayApprovalPath, gatewayBinding, gatewayToolResult, operationKey, privatePath } from "../../node_modules/@chio/bridge/dist/gateway.js";
export type { GatewayConfig, GatewayOutcome, StoredOperation } from "../../node_modules/@chio/bridge/dist/gateway.js";
