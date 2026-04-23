import { resolve } from "node:path";
import { buildBridge } from "../state/bridge.js";
import { upsertBond } from "../state/store.js";

export async function bond(args: string[]): Promise<string> {
  const [policyArg, ttl = "4h", budgetArg] = args;
  if (!policyArg) {
    throw new Error("usage: /chio:bond <policy-path> [ttl] [budget-usd]");
  }
  const policyPath = resolve(policyArg);
  const bridge = buildBridge();

  // Wave D Bug 1: thread budgetUsd through to bridge.bond(). The
  // bridge now issues a real capability in BOTH daemon and CLI modes
  // and attenuates it to the requested cap, so the returned passport
  // already carries a non-empty capabilityId with the budget bound.
  const budgetUsd = budgetArg ? Number(budgetArg) : undefined;
  const bondArgs: Parameters<typeof bridge.bond>[0] = { policyPath, ttl };
  if (budgetUsd !== undefined && Number.isFinite(budgetUsd)) {
    bondArgs.budgetUsd = budgetUsd;
  }
  const passport = await bridge.bond(bondArgs);
  const budgetSet =
    budgetUsd !== undefined &&
    Number.isFinite(budgetUsd) &&
    typeof passport.capabilityId === "string" &&
    passport.capabilityId.length > 0;

  const sessionId = process.env.CLAUDE_SESSION_ID ?? `session-${Date.now()}`;
  const bondRecord: Parameters<typeof upsertBond>[0] = {
    sessionId,
    policyPath,
    passport,
    bondedAt: new Date().toISOString(),
  };
  if (budgetSet && budgetUsd !== undefined) {
    bondRecord.budgetCapUsd = budgetUsd;
  }
  upsertBond(bondRecord);

  return JSON.stringify(
    {
      status: budgetSet ? "bonded" : "bonded_without_budget",
      session: sessionId,
      policy: policyPath,
      passport: {
        did: passport.did,
        capabilityId: passport.capabilityId,
        issuer: passport.issuer,
        expiresAt: passport.expiresAt,
      },
      ttl,
      budgetUsd: budgetSet ? budgetUsd : null,
    },
    null,
    2,
  );
}
