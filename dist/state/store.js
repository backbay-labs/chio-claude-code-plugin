import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// src/state/store.ts
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// src/state/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
var STATE_DIR = process.env.CHIO_STATE_DIR ?? join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "plugins", "chio");
var STATE_PATH = join(STATE_DIR, "state.json");
var KEYSTORE_DIR = process.env.CHIO_KEYSTORE_DIR ?? join(homedir(), ".chio", "keys");
var PENDING_DIR = join(STATE_DIR, "pending");
var RECEIPT_CACHE_DIR = join(STATE_DIR, "receipts");

// src/state/store.ts
function readState() {
  try {
    const raw = readFileSync(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { bonds: parsed.bonds ?? {} };
  } catch {
    return { bonds: {} };
  }
}
function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 384 });
  renameSync(tmp, STATE_PATH);
}
function upsertBond(bond) {
  const state = readState();
  state.bonds[bond.sessionId] = bond;
  writeState(state);
}
function markRevoked(sessionId) {
  const state = readState();
  const entry = state.bonds[sessionId];
  if (!entry) return;
  state.bonds[sessionId] = { ...entry, revokedAt: (/* @__PURE__ */ new Date()).toISOString() };
  writeState(state);
}
function getBond(sessionId) {
  if (!sessionId) return void 0;
  const state = readState();
  return state.bonds[sessionId];
}
function bondPresence(sessionId) {
  let raw;
  try {
    raw = readFileSync(STATE_PATH, "utf8");
  } catch (error) {
    return error.code === "ENOENT" ? "absent" : "invalid";
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "invalid";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
  const bonds = parsed.bonds;
  if (bonds === void 0) return "absent";
  if (!bonds || typeof bonds !== "object" || Array.isArray(bonds)) return "invalid";
  if (!Object.hasOwn(bonds, sessionId)) return "absent";
  const entry = bonds[sessionId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "invalid";
  if (!Object.hasOwn(entry, "revokedAt")) return "present";
  return typeof entry.revokedAt === "string" ? "revoked" : "invalid";
}
function requireSessionBond(explicitSessionId) {
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
function getSoleBond() {
  const state = readState();
  const entries = Object.values(state.bonds).filter((b) => b && typeof b === "object" && !Object.hasOwn(b, "revokedAt"));
  if (entries.length === 1) return entries[0];
  return void 0;
}
function getMostRecentBond() {
  const state = readState();
  const entries = Object.values(state.bonds).filter((b) => b && typeof b === "object" && !Object.hasOwn(b, "revokedAt"));
  if (entries.length === 0) return void 0;
  entries.sort((a, b) => b.bondedAt.localeCompare(a.bondedAt));
  return entries[0];
}
export {
  bondPresence,
  getBond,
  getMostRecentBond,
  getSoleBond,
  markRevoked,
  readState,
  requireSessionBond,
  upsertBond,
  writeState
};
