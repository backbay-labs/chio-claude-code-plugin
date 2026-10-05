// Trusted operator terminal. It confirms only intents Claude's user already
// requested, never creates or changes a decision, and dispatches nothing.
import { confirmControlIntent, controlStatus } from "../dist/control/service.js";

const clean = value => String(value).replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, char => char === "\n" ? char : "\ufffd");
const confirmable = (intent, operation) => intent.kind === "revoke" || Boolean(operation?.review);
export function intentCard(intent, operation, now) {
  const seconds = Math.max(0, Math.ceil((intent.expiresAt - now) / 1000));
  const lines = [`Chio review · intent ${clean(intent.id)} · expires in ${seconds}s`,
    `Requested decision: ${intent.kind === "revoke" ? "revoke this session" : clean(intent.kind)}`];
  if (operation) {
    lines.push(`Action: ${clean(operation.tool ?? "operation")} · request ${clean(operation.requestId)}`);
    if (operation.review) lines.push(`Purpose: ${clean(operation.review.purpose)}`, `Capability: ${clean(operation.review.capabilityId)} · grant TTL ${clean(operation.review.ttlSeconds)}s`, "Arguments:", clean(JSON.stringify(operation.review.arguments, null, 2)));
  }
  lines.push(confirmable(intent, operation) ? "Confirm this exact decision? [y] confirm  [n] skip  [q] quit" : "Action unavailable in the current projection; confirmation refused. [n] skip  [q] quit", "");
  return lines.join("\n");
}
export async function watch({ statusOptions, operator, input, output, intervalMs = 1000, guardMs = 500, now = Date.now, confirm = confirmControlIntent, readStatus = controlStatus }) {
  if (!input.isTTY || !output.isTTY) throw new Error("watch requires an interactive terminal");
  input.setRawMode?.(true); input.resume();
  const keys = [];
  let wake = () => {};
  const onData = data => { for (const key of String(data)) { keys.push(key === "\u0003" ? "q" : key); } wake(); };
  input.on("data", onData);
  const nextKey = async (allowed, timeoutMs) => {
    const end = timeoutMs === undefined ? Infinity : Date.now() + timeoutMs;
    for (;;) {
      while (keys.length) { const key = keys.shift(); if (allowed.includes(key)) return key; }
      const wait = end === Infinity ? undefined : end - Date.now();
      if (wait !== undefined && wait <= 0) return undefined;
      await new Promise(resolve => { wake = resolve; if (wait !== undefined) setTimeout(resolve, wait); });
    }
  };
  const answered = new Set();
  let line = "";
  try {
    for (;;) {
      const status = await readStatus(statusOptions);
      const needing = status.operations.filter(op => op.review?.decision === "required");
      // The service refuses a second intent for the same revision, so an action with any intent cannot be requested again.
      const stuck = needing.filter(op => status.intents.some(i => i.requestId === op.requestId && i.state !== "requested")).length;
      const waiting = needing.filter(op => !status.intents.some(i => i.requestId === op.requestId)).length;
      const summary = `Chio watch · session ${clean(status.sessionId)} · authority ${clean(status.authority)} · ${waiting} action${waiting === 1 ? "" : "s"} awaiting a review request from Claude\n`
        + (stuck ? `${stuck} action${stuck === 1 ? "" : "s"} ${stuck === 1 ? "needs" : "need"} inspection: an earlier request for the same revision was skipped, expired or unresolved\n` : "");
      if (summary !== line) { output.write(summary); line = summary; }
      const pending = status.intents.filter(i => i.state === "requested" && i.expiresAt > now() && !answered.has(i.id)).sort((a, b) => a.expiresAt - b.expiresAt);
      if (!pending.length) { if (await nextKey(["q"], intervalMs) === "q") return; continue; }
      const intent = pending[0];
      const operation = status.operations.find(op => op.requestId === intent.requestId);
      keys.length = 0; // only keystrokes typed after the card is on screen count
      output.write("\x07" + intentCard(intent, operation, now()));
      // A held or doubled key must not reach a card its operator has not read: discard input for a guard interval.
      await new Promise(resolve => setTimeout(resolve, guardMs)); keys.length = 0;
      const key = await nextKey(confirmable(intent, operation) ? ["y", "n", "q"] : ["n", "q"], Math.max(0, intent.expiresAt - now()));
      answered.add(intent.id);
      if (key === undefined) { output.write("Intent expired before a decision; nothing was confirmed.\n"); line = ""; continue; }
      if (key === "q") return;
      if (key === "n") { output.write("Skipped. This exact request cannot be requested again from Claude; inspect it with control.mjs status.\n"); continue; }
      try { const result = await confirm(statusOptions.config, operator, intent.id); output.write(`Retained intent state: ${clean(result.state)}. No protected action was dispatched.\n`); }
      catch (error) { output.write(`Confirmation failed: ${clean(error.message)}. The intent is retained for inspection; do not resubmit blindly.\n`); }
      line = "";
    }
  } finally { input.off("data", onData); input.setRawMode?.(false); input.pause(); }
}
