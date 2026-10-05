import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import type { Passport } from "@chio/bridge";
import { STATE_PATH } from "./paths.js";

export interface SessionBond {
  sessionId: string;
  policyPath: string;
  passport: Passport;
  bondedAt: string;
  /** Absolute path of the most recent receipt JSON dumped by PreToolUse,
   *  so PostToolUse can stream it to the local store. */
  lastReceiptPath?: string;
  /** Budget ceiling in USD from `/chio:bond POLICY TTL BUDGET`. */
  budgetCapUsd?: number;
  /** Set by /chio:revoke. The entry stays so the compatibility hooks keep denying the session until /chio:bond replaces it. */
  revokedAt?: string;
  /** Legacy field from the removed /chio:guard-pause; retained so old state parses. */
  pausedGuards?: Record<string, string>;
}

export interface PluginState {
  bonds: Record<string, SessionBond>;
}

export function readState(): PluginState {
  try {
    const raw = readFileSync(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PluginState>;
    return { bonds: parsed.bonds ?? {} };
  } catch {
    return { bonds: {} };
  }
}

export function writeState(state: PluginState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  // Atomic replace: a concurrent hook never reads a half-written file.
  const tmp = `${STATE_PATH}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600, flag: "wx" });
    renameSync(tmp, STATE_PATH);
  } finally { rmSync(tmp, { force: true }); }
}

export function upsertBond(bond: SessionBond): void {
  const state = readState();
  state.bonds[bond.sessionId] = bond;
  writeState(state);
}

export function markRevoked(sessionId: string): void {
  const state = readState();
  const entry = state.bonds[sessionId];
  if (!entry) return;
  state.bonds[sessionId] = { ...entry, revokedAt: new Date().toISOString() };
  writeState(state);
}

export function getBond(sessionId: string | undefined): SessionBond | undefined {
  if (!sessionId) return undefined;
  const state = readState();
  return state.bonds[sessionId];
}

/**
 * Compatibility-hook fast path. Separates "no bond" from unreadable state
 * without loading the bridge. The enforcement path still validates a present
 * entry's session, expiry and policy.
 */
export function bondPresence(sessionId: string): "absent" | "present" | "revoked" | "invalid" {
  let raw: string;
  try { raw = readFileSync(STATE_PATH, "utf8"); }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "invalid"; }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return "invalid"; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
  const bonds = (parsed as { bonds?: unknown }).bonds;
  if (bonds === undefined) return "absent";
  if (!bonds || typeof bonds !== "object" || Array.isArray(bonds)) return "invalid";
  if (!Object.hasOwn(bonds, sessionId)) return "absent";
  const entry = (bonds as Record<string, unknown>)[sessionId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "invalid";
  if (!Object.hasOwn(entry, "revokedAt")) return "present";
  return typeof (entry as { revokedAt?: unknown }).revokedAt === "string" ? "revoked" : "invalid";
}

/** Controls must name a session, even when only one bond is retained. */
export function requireSessionBond(explicitSessionId?: string): SessionBond {
  const hostSessionId = process.env.CLAUDE_SESSION_ID;
  if (explicitSessionId && hostSessionId && explicitSessionId !== hostSessionId) {
    throw new Error("requested session differs from the current Claude session");
  }
  const sessionId = hostSessionId ?? explicitSessionId;
  if (!sessionId) throw new Error("an exact session id is required; set CLAUDE_SESSION_ID or pass the session explicitly");
  const bond = getBond(sessionId);
  if (!bond || Object.hasOwn(bond, "revokedAt") || bond.sessionId !== sessionId) throw new Error(`no bond for session ${sessionId}`);
  return bond;
}

/**
 * Fallback: if there is exactly one bond in state, use it. Used by slash
 * commands that run outside of a hook context (no session id on stdin).
 */
export function getSoleBond(): SessionBond | undefined {
  const state = readState();
  const entries = Object.values(state.bonds).filter(b => b && typeof b === "object" && !Object.hasOwn(b, "revokedAt"));
  if (entries.length === 1) return entries[0];
  return undefined;
}

/**
 * Historical discovery helper. Never use this to select an authority control
 * or to claim that evidence belongs to the current session.
 */
export function getMostRecentBond(): SessionBond | undefined {
  const state = readState();
  const entries = Object.values(state.bonds).filter(b => b && typeof b === "object" && !Object.hasOwn(b, "revokedAt"));
  if (entries.length === 0) return undefined;
  entries.sort((a, b) => b.bondedAt.localeCompare(a.bondedAt));
  return entries[0];
}
