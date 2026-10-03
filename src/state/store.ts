import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  /** Optional budget ceiling in USD, as of the last /chio:budget-set. */
  budgetCapUsd?: number;
  /** Guard ids that are currently paused, with their expiry timestamps. */
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
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function upsertBond(bond: SessionBond): void {
  const state = readState();
  state.bonds[bond.sessionId] = bond;
  writeState(state);
}

export function clearBond(sessionId: string): void {
  const state = readState();
  delete state.bonds[sessionId];
  writeState(state);
}

export function getBond(sessionId: string | undefined): SessionBond | undefined {
  if (!sessionId) return undefined;
  const state = readState();
  return state.bonds[sessionId];
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
  if (!bond || bond.sessionId !== sessionId) throw new Error(`no bond for session ${sessionId}`);
  return bond;
}

/**
 * Fallback: if there is exactly one bond in state, use it. Used by slash
 * commands that run outside of a hook context (no session id on stdin).
 */
export function getSoleBond(): SessionBond | undefined {
  const state = readState();
  const entries = Object.values(state.bonds);
  if (entries.length === 1) return entries[0];
  return undefined;
}

/**
 * Historical discovery helper. Never use this to select an authority control
 * or to claim that evidence belongs to the current session.
 */
export function getMostRecentBond(): SessionBond | undefined {
  const state = readState();
  const entries = Object.values(state.bonds);
  if (entries.length === 0) return undefined;
  entries.sort((a, b) => b.bondedAt.localeCompare(a.bondedAt));
  return entries[0];
}
