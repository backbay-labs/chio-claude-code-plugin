import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Location of plugin-local state. One JSON file per Claude Code session is
 * overkill for a v0.1, so we use a single state file keyed by session id.
 */
export const STATE_DIR = join(homedir(), ".claude", "plugins", "chio");
export const STATE_PATH = join(STATE_DIR, "state.json");
export const KEYSTORE_DIR = join(homedir(), ".chio", "keys");
export const PENDING_DIR = join(STATE_DIR, "pending");
export const RECEIPT_CACHE_DIR = join(STATE_DIR, "receipts");
