// The protected relay confirms that a model request carried an exact verified
// result. Only the current prompt envelope counts, and only the outcome hash of a
// continuation already confirmed through native control. Observation never
// blocks or alters the forwarded request.
const MARKER = /\[chio-outcome sha256:([0-9a-f]{64})\]/g;
function inlineText(content) {
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.filter(block => block?.type === "text" && typeof block.text === "string").map(block => block.text).join("\n") : "";
}
function currentPromptText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const index = messages.findLastIndex(item => item?.role === "user");
  if (index < 0) return "";
  const text = [inlineText(messages[index].content)];
  // Pinned Claude 2.1.287 places prompt.submit context in a system turn
  // immediately following the user prompt for system-turn capable models.
  for (const message of messages.slice(index + 1)) {
    if (message?.role !== "system") break;
    const context = inlineText(message.content);
    const marker = "prompt.submit hook additional context: ";
    const start = context.indexOf(marker);
    if (start >= 0) text.push(context.slice(start + marker.length));
  }
  return text.join("\n");
}
export const extractMarkers = body => new Set([...currentPromptText(body).matchAll(MARKER)].map(match => match[1]));
export function confirmedModelContext(body, continuations) {
  const hashes = extractMarkers(body);
  if (!hashes.size) return [];
  return continuations.filter(c => c?.delivery === "confirmed" && typeof c.outcomeHash === "string" && hashes.has(c.outcomeHash)).map(c => c.requestId);
}
export function observeModelContext(body, read, record) {
  try { if (!extractMarkers(body).size) return; for (const requestId of confirmedModelContext(body, read())) record(requestId); }
  catch { /* Observation only: a journal read failure never refuses model work. */ }
}
