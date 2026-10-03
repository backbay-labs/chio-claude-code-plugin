import { buildBridge } from "../state/bridge.js";
import { clearBond, requireSessionBond } from "../state/store.js";

export async function revoke(args: string[] = []): Promise<string> {
  if (args.length > 1) throw new Error("usage: /chio:revoke [session-id]");
  const bond = requireSessionBond(args[0]);
  if (!bond.passport.passportId) throw new Error("bond has no exact passport artifact id; refusing subject-based revocation");

  const bridge = buildBridge();
  // This compatibility path revokes a passport, not a kernel MCP session.
  // Native /chio-revoke requests an exact kernel session revocation instead.
  await bridge.revoke(bond.passport.passportId);
  const confirmed = await bridge.status(bond.passport.passportId);
  if (confirmed.status !== "revoked") throw new Error("revocation was submitted but the passport lifecycle has not confirmed it; bond retained");
  clearBond(bond.sessionId);

  return JSON.stringify(
    {
      status: "revoked",
      scope: "passport_lifecycle",
      passport_id: bond.passport.passportId,
      session: bond.sessionId,
      did: bond.passport.did,
      capabilityId: bond.passport.capabilityId,
    },
    null,
    2,
  );
}
