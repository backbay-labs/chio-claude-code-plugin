// The protected relay confirms that a model request carried an exact verified
// result. Only the last user message counts, and only the outcome hash of a
// continuation already confirmed through native control. Observation never
// blocks or alters the forwarded request.
const MARKER = /\[chio-outcome sha256:([0-9a-f]{64})\]/g;
function lastUserText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const message = messages.findLast(item => item?.role === "user");
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  return Array.isArray(message.content) ? message.content.filter(block => block?.type === "text" && typeof block.text === "string").map(block => block.text).join("\n") : "";
}
export function confirmedModelContext(body, continuations) {
  const hashes = new Set([...lastUserText(body).matchAll(MARKER)].map(match => match[1]));
  if (!hashes.size) return [];
  return continuations.filter(c => c?.delivery === "confirmed" && typeof c.outcomeHash === "string" && hashes.has(c.outcomeHash)).map(c => c.requestId);
}
export function observeModelContext(body, read, record) {
  try { for (const requestId of confirmedModelContext(body, read())) record(requestId); }
  catch { /* Observation only: a journal read failure never refuses model work. */ }
}
