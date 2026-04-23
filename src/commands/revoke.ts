import { buildBridge } from "../state/bridge.js";
import { clearBond, getMostRecentBond, getSoleBond } from "../state/store.js";

export async function revoke(): Promise<string> {
  const bond = getSoleBond() ?? getMostRecentBond();
  if (!bond) throw new Error("no active bond to revoke");

  const bridge = buildBridge();
  // Revoke the passport (did). Arc's trust plane propagates revocations via
  // POST /v1/revocations; federation partners sync on pull.
  await bridge.revoke(bond.passport.did);
  clearBond(bond.sessionId);

  return JSON.stringify(
    {
      status: "revoked",
      session: bond.sessionId,
      did: bond.passport.did,
      capabilityId: bond.passport.capabilityId,
    },
    null,
    2,
  );
}
