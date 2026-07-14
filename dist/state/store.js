import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// src/state/store.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// src/state/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
var STATE_DIR = join(homedir(), ".claude", "plugins", "chio");
var STATE_PATH = join(STATE_DIR, "state.json");
var KEYSTORE_DIR = join(homedir(), ".chio", "keys");
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
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
function upsertBond(bond) {
  const state = readState();
  state.bonds[bond.sessionId] = bond;
  writeState(state);
}
function clearBond(sessionId) {
  const state = readState();
  delete state.bonds[sessionId];
  writeState(state);
}
function getBond(sessionId) {
  if (!sessionId) return void 0;
  const state = readState();
  return state.bonds[sessionId];
}
function getSoleBond() {
  const state = readState();
  const entries = Object.values(state.bonds);
  if (entries.length === 1) return entries[0];
  return void 0;
}
function getMostRecentBond() {
  const state = readState();
  const entries = Object.values(state.bonds);
  if (entries.length === 0) return void 0;
  entries.sort((a, b) => b.bondedAt.localeCompare(a.bondedAt));
  return entries[0];
}
export {
  clearBond,
  getBond,
  getMostRecentBond,
  getSoleBond,
  readState,
  upsertBond,
  writeState
};
