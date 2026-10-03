// Hook fragment for a separately configured mod that depends on Chio.
// This is not loaded by the protected profile or a qualified connector.
import type { Register } from "claude-code";
export const register: Register = on => {
  on("command.run", { command: "connector-propose" }, async ($, e) => {
    const input = JSON.parse(e.args) as { id: string; tool: string; arguments: Record<string, unknown> };
    // The caller retains this id when the response is lost. A new id does not retry an uncertain effect.
    const proposal = await $.chio.propose(input);
    return { text: JSON.stringify(proposal) };
  }).catch(() => ({ text: "Proposal unconfirmed. Inspect the original session and proposal identity.", exitCode: 1 }));
};
