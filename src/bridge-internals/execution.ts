// Seam for the unexported @chio/bridge dist/execution.js; pinned by test/bridge-internals.test.mjs.
// When a bridge release exports ./gateway, ./gateway-operator, ./approval and ./execution, point this at that subpath.
export { createMcpExecutionClient } from "../../node_modules/@chio/bridge/dist/execution.js";
