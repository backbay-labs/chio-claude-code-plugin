import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startGatewayHttp } from "../dist/gateway-http.js";
import { gatewayApprovalPath } from "../dist/gateway.js";
import { privateSave, privateDirectory } from "../dist/workflow/store.js";
import { createControlTransport } from "../scripts/control-transport.mjs";
import { signer, signedDecision, signedOutcome } from "./workflow-fixture.mjs";

test("native parent and initialized MCP host share one serialized gateway and original operation", async t => {
  const root = mkdtempSync(join(tmpdir(), "chio-parent-transport-"));
  let effects = 0, acks = 0, transport;
  const now = Math.floor(Date.now() / 1000);
  const credential = { schema: "chio.mcp.session-credential.v1", sessionId: "kernel-session-a", subjectKey: "b2".repeat(32), capabilityIds: ["cap-a"], serverId: "resource-a", endpointPath: "/mcp", allowedTools: ["write_file"], issuedAt: now, expiresAt: now + 600 };
  const kernel = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString()); let result;
    if (rpc.method === "chio/execution-context") result = { schema: "chio.mcp.execution-context.v1", evidenceVersion: "1", deliveryAcknowledgementVersion: "1", subjectKey: credential.subjectKey, serverId: "resource-a", capabilityIds: ["cap-a"], sessionCredential: credential };
    else if (rpc.method === "tools/call") {
      effects++;
      const outcome = signedOutcome(config, { requestId: rpc.params._meta.chioRequestId, tool: rpc.params.name, arguments: rpc.params.arguments,
        approval: { chioGovernedIntent: rpc.params._meta.chioGovernedIntent, chioApprovalToken: rpc.params._meta.chioApprovalToken } });
      result = { _meta: { chioEvidence: { schema: "chio.mcp.execution-evidence.v1", requestId: outcome.requestId, receipt: outcome.receipt, terminalState: "completed", outputKind: "value", output: outcome.result }, chioDelivery: outcome.delivery } };
    } else if (rpc.method === "chio/acknowledge") { acks++; result = { schema: "chio.mcp.delivery-ack.v1", requestId: rpc.params.requestId, receiptId: rpc.params.receiptId, acknowledged: true }; }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });
  await new Promise(resolve => kernel.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await transport?.close(); await new Promise(resolve => { kernel.close(resolve); kernel.closeAllConnections(); }); rmSync(root, { recursive: true, force: true }); });
  const config = { sessionId: randomUUID(), journalDir: join(root, "journal"), tools: [{ name: "write_file", inputSchema: { type: "object" } }],
    execution: { endpoint: "http://127.0.0.1:" + kernel.address().port, bearerToken: "delegated", trustedSigners: [signer], subjectKey: credential.subjectKey, capabilityId: "cap-a", serverId: "resource-a", sessionId: credential.sessionId },
    approval: { requiredTools: ["write_file"], purpose: "Exact fixture write", ttlSeconds: 300 } };
  transport = await startGatewayHttp(config); const parent = createControlTransport(transport, config);
  let session;
  const rpc = async (id, method, params) => {
    const response = await fetch(transport.url, { method: "POST", headers: { Authorization: "Bearer " + transport.token, "Content-Type": "application/json", ...(session ? { "mcp-session-id": session } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
    session ??= response.headers.get("mcp-session-id"); return response.json();
  };
  assert.equal((await rpc(1, "initialize", { protocolVersion: "2025-11-25" })).result.serverInfo.name, "chio-protected-gateway");
  const proposal = await parent.propose(randomUUID(), "write_file", { path: "/protected/out.txt", content: "exact" });
  assert.equal(proposal.state, "awaiting_approval"); assert.equal(effects, 0);
  privateDirectory(join(config.journalDir, "approvals")); privateSave(gatewayApprovalPath(config, proposal.requestId), { toolCallParams: signedDecision(config, proposal.proposal) }, true);
  const outcome = await parent.resume(randomUUID(), proposal.requestId, "write_file", proposal.proposal.arguments);
  assert.equal(outcome.state, "completed"); assert.equal(outcome.evidence, "verified"); assert.equal(outcome.requestId, proposal.requestId); assert.equal(effects, 1); assert.equal(acks, 0);
  assert.equal((await parent.acknowledge(outcome)).acknowledged, true); assert.equal(acks, 1);
  const duplicate = await parent.resume(randomUUID(), proposal.requestId, "write_file", proposal.proposal.arguments);
  assert.equal(duplicate.requestId, proposal.requestId); assert.equal(effects, 1);
  const inventory = await rpc(2, "tools/list", {}); assert.deepEqual(inventory.result.tools.map(t => t.name), ["write_file", "chio_resume"]);
  assert.equal((await rpc(3, "chio/controlCall", { tool: "write_file" })).error.code, -32601);
  await assert.rejects(parent.propose(randomUUID(), "Bash", { command: "touch /tmp/out" }), /unreviewed tool/);
});
