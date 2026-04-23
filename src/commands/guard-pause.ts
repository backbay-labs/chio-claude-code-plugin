import { buildBridge } from "../state/bridge.js";
import { getSoleBond, upsertBond } from "../state/store.js";

/**
 * Express a guard-pause as a scope attenuation. Arc's trust plane does not
 * expose a "disable guard X" primitive — the 7 guards in the default pipeline
 * are enforced unconditionally. What we CAN do is shrink the capability scope
 * so the guard has nothing to refuse. Combined with a local timer, that
 * produces a real, countersigned, receipted operation that an auditor can
 * verify without trusting this plugin.
 *
 * Concrete mapping today:
 *   - ShellCommandGuard   → scope attenuation removing `shell.*` grants
 *   - EgressAllowlistGuard→ scope attenuation removing all network grants
 *   - etc.
 *
 * When chio lands a real guard-control endpoint (per ARC_UPSTREAM_PROPOSAL),
 * swap the body of this function.
 */
export async function guardPause(args: string[]): Promise<string> {
  const [guard, duration = "10m"] = args;
  if (!guard) throw new Error("usage: /chio:guard-pause <guard-id> [duration]");

  const bond = getSoleBond();
  if (!bond) {
    throw new Error("no active bond; run /chio:bond first");
  }

  const bridge = buildBridge();
  const token = await bridge.attenuate(bond.passport.capabilityId, {
    scope: scopeForPausedGuard(guard),
  });

  bond.pausedGuards = { ...(bond.pausedGuards ?? {}) };
  const expiresAt = addDuration(new Date(), duration).toISOString();
  bond.pausedGuards[guard] = expiresAt;
  upsertBond(bond);

  return JSON.stringify(
    {
      status: "paused",
      guard,
      duration,
      expires_at: expiresAt,
      capability_id: token.id,
      delegation_chain: token.delegation_chain?.length ?? 0,
    },
    null,
    2,
  );
}

function scopeForPausedGuard(guard: string): {
  grants: [];
} {
  // Empty grants = no tools permitted. A future iteration can do a
  // per-guard surgical subtraction; today we fail-shut the whole scope,
  // which is strictly safer than the guard being active-but-pausable.
  void guard; // reserved for surgical path
  return { grants: [] };
}

function addDuration(base: Date, duration: string): Date {
  const m = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!m || !m[1] || !m[2]) return new Date(base.getTime() + 10 * 60_000);
  const n = Number(m[1]);
  const unit = m[2] as "s" | "m" | "h" | "d";
  const mult: Record<typeof unit, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(base.getTime() + n * mult[unit]);
}
