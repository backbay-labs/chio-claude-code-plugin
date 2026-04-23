// Public entrypoint. Each command is a self-contained module.
export { bond } from "./commands/bond.js";
export { policyShow } from "./commands/policy-show.js";
export { guardPause } from "./commands/guard-pause.js";
export { budgetSet } from "./commands/budget-set.js";
export { approve } from "./commands/approve.js";
export { revoke } from "./commands/revoke.js";
export { receiptLast } from "./commands/receipt-last.js";
export { receiptExport } from "./commands/receipt-export.js";

export { buildBridge, getPolicyPath } from "./state/bridge.js";
export {
  readState,
  writeState,
  upsertBond,
  clearBond,
  getBond,
  getSoleBond,
  getMostRecentBond,
  type SessionBond,
  type PluginState,
} from "./state/store.js";
export {
  STATE_DIR,
  STATE_PATH,
  KEYSTORE_DIR,
  PENDING_DIR,
  RECEIPT_CACHE_DIR,
} from "./state/paths.js";
