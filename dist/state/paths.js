import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// src/state/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
var STATE_DIR = join(homedir(), ".claude", "plugins", "chio");
var STATE_PATH = join(STATE_DIR, "state.json");
var KEYSTORE_DIR = join(homedir(), ".chio", "keys");
var PENDING_DIR = join(STATE_DIR, "pending");
var RECEIPT_CACHE_DIR = join(STATE_DIR, "receipts");
export {
  KEYSTORE_DIR,
  PENDING_DIR,
  RECEIPT_CACHE_DIR,
  STATE_DIR,
  STATE_PATH
};
