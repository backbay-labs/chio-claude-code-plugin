// Eval-only fixture MCP server (stdio, newline-delimited JSON-RPC). Evals run with mocks; this only declares the server.
import { createInterface } from "node:readline";
const tools = [{"name": "write_file", "description": "Protected write of a file through Chio.", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}, {"name": "chio_resume", "description": "Resume an operator-approved Chio request.", "inputSchema": {"type": "object", "properties": {"requestId": {"type": "string"}, "tool": {"type": "string"}, "arguments": {"type": "object"}}, "required": ["requestId", "tool", "arguments"]}}];
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return;
  if (msg.method === "initialize") send({ id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "chio-fixture", version: "0.0.0" } } });
  else if (msg.method === "tools/list") send({ id: msg.id, result: { tools } });
  else if (msg.method === "tools/call") send({ id: msg.id, result: { isError: true, content: [{ type: "text", text: "fixture server: use eval mocks" }] } });
  else send({ id: msg.id, error: { code: -32601, message: "method not found" } });
});
