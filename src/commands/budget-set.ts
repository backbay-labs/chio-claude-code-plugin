import { buildBridge } from "../state/bridge.js";
import { getSoleBond, upsertBond } from "../state/store.js";

/**
 * Post a budget attenuation to the trust plane. The bridge translates this
 * into POST /v1/capabilities/:id/attenuate with { budget: { maxUsd } }.
 */
export async function budgetSet(args: string[]): Promise<string> {
  const [usdArg] = args;
  if (!usdArg) throw new Error("usage: /chio:budget-set <usd>");
  const usd = Number(usdArg);
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`invalid budget: "${usdArg}"`);
  }

  const bond = getSoleBond();
  if (!bond) throw new Error("no active bond; run /chio:bond first");

  const bridge = buildBridge();
  const token = await bridge.attenuate(bond.passport.capabilityId, {
    budget: { maxUsd: usd },
  });

  const previous = bond.budgetCapUsd ?? null;
  bond.budgetCapUsd = usd;
  upsertBond(bond);

  return JSON.stringify(
    {
      status: "budget_set",
      previous_usd: previous,
      new_usd: usd,
      capability_id: token.id,
    },
    null,
    2,
  );
}
