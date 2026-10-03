// Parent-only adapter into the existing serialized gateway. No second MCP
// initialization, kernel session, HTTP route, or resource credential is added.
export function createControlTransport(transport, config, onNativeDelivery = () => {}) {
  if (typeof transport.controlCall !== "function") throw new Error("selected gateway lacks the pinned native control contract");
  return {
    propose: async (id, tool, args) => {
      if (!config.approval?.requiredTools.includes(tool)) throw new Error("proposal cannot dispatch an unreviewed tool");
      return transport.controlCall(id, tool, args);
    },
    resume: (id, requestId, tool, args) => transport.controlCall(id, "chio_resume", { requestId, tool, arguments: args }),
    // This proof establishes result receipt by the scoped native control client.
    // The separate retained channel does not claim the model read the result.
    acknowledge: async outcome => {
      const result = await transport.acknowledgeReceivedOutcome(outcome);
      if (result.acknowledged && result.requestId === outcome.requestId) onNativeDelivery(outcome);
      return result;
    },
  };
}
