// Trusted operator terminal. It confirms only intents Claude's user already
// requested, never creates or changes a decision, and dispatches nothing.
import { confirmControlIntent, controlStatus } from "../dist/control/service.js";

const clean = value => String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "�");
export function intentCard(intent, operation, now) {
  const seconds = Math.max(0, Math.ceil((intent.expiresAt - now) / 1000));
  const lines = [`Chio review · intent ${clean(intent.id)} · expires in ${seconds}s`,
    `Requested decision: ${intent.kind === "revoke" ? "revoke this session" : clean(intent.kind)}`];
  if (operation) {
    lines.push(`Action: ${clean(operation.tool ?? "operation")} · request ${clean(operation.requestId)}`);
    if (operation.review) lines.push(`Purpose: ${clean(operation.review.purpose)}`, `Capability: ${clean(operation.review.capabilityId)} · grant TTL ${operation.review.ttlSeconds}s`, "Arguments:", clean(JSON.stringify(operation.review.arguments, null, 2)));
  }
  lines.push("Confirm this exact decision? [y] confirm  [n] skip  [q] quit", "");
  return lines.join("\n");
}
export async function watch({ statusOptions, operator, input, output, intervalMs = 1000, now = Date.now, confirm = confirmControlIntent, readStatus = controlStatus }) {
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
      const waiting = status.operations.filter(op => op.review?.decision === "required" && !status.intents.some(i => i.requestId === op.requestId && i.state === "requested")).length;
      const summary = `Chio watch · session ${clean(status.sessionId)} · authority ${status.authority} · ${waiting} action${waiting === 1 ? "" : "s"} awaiting a review request from Claude\n`;
      if (summary !== line) { output.write(summary); line = summary; }
      const pending = status.intents.filter(i => i.state === "requested" && i.expiresAt > now() && !answered.has(i.id)).sort((a, b) => a.expiresAt - b.expiresAt);
      if (!pending.length) { if (await nextKey(["q"], intervalMs) === "q") return; continue; }
      const intent = pending[0];
      output.write("\x07" + intentCard(intent, status.operations.find(op => op.requestId === intent.requestId), now()));
      const key = await nextKey(["y", "n", "q"]);
      answered.add(intent.id);
      if (key === "q") return;
      if (key === "n") { output.write("Skipped. The intent expires on its own.\n"); continue; }
      try { const result = await confirm(statusOptions.config, operator, intent.id); output.write(`Retained intent state: ${result.state}. No protected action was dispatched.\n`); }
      catch (error) { output.write(`Confirmation failed: ${clean(error.message)}. The intent is retained for inspection; do not resubmit blindly.\n`); }
      line = "";
    }
  } finally { input.off("data", onData); input.setRawMode?.(false); input.pause(); }
}
