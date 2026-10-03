import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { privateSave } from "../dist/workflow/store.js";
import { readTask } from "../dist/workflow/tasks.js";
import { signer } from "./workflow-fixture.mjs";

test("guided preparation delegates a new exact scope, retains no operator key and performs no effect", async t => {
  const root = mkdtempSync(join(tmpdir(), "chio-task-prepare-")); const methods = [], auth = [];
  let credential;
  const kernel = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString(); const input = body ? JSON.parse(body) : {};
    auth.push(req.headers.authorization);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/admin/sessions/kernel-prepared/credential") {
      methods.push("credential"); const now = Math.floor(Date.now() / 1000);
      assert.equal(req.headers.authorization, "Bearer admin-fixture"); assert.deepEqual(input.allowedTools, ["write_file"]);
      credential = { schema: "chio.mcp.session-credential.v1", sessionId: "kernel-prepared", subjectKey: "b2".repeat(32), capabilityIds: ["cap-a"], serverId: "resource-a", endpointPath: "/mcp", allowedTools: input.allowedTools, issuedAt: now, expiresAt: now + input.ttlSeconds };
      res.end(JSON.stringify({ ...credential, bearerToken: "delegated-fixture" })); return;
    }
    const rpc = input; methods.push(rpc.method); let result;
    if (rpc.method === "initialize") { res.setHeader("Mcp-Session-Id", "kernel-prepared"); result = { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "signed fixture", version: "1" } }; }
    else if (rpc.method === "chio/execution-context") result = { schema: "chio.mcp.execution-context.v1", evidenceVersion: "1", deliveryAcknowledgementVersion: "1", subjectKey: "b2".repeat(32), serverId: "resource-a", capabilityIds: ["cap-a"], ...(credential ? { sessionCredential: credential } : {}) };
    else if (rpc.method === "tools/list") result = { tools: [{ name: "write_file", inputSchema: { type: "object" } }] };
    if (rpc.id === undefined) { res.writeHead(202); res.end(); } else res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });
  await new Promise(resolve => kernel.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise(resolve => { kernel.close(resolve); kernel.closeAllConnections(); }); rmSync(root, { recursive: true, force: true }); });
  const catalog = join(root, "catalog.json"), operator = join(root, "operator.json"), destination = join(root, "prepared");
  const template = { id: "preview", title: "Prepare exact preview", serverId: "resource-a", expectedCapabilityId: "cap-a", allowedTools: ["write_file"], ttlSeconds: 600,
    approval: { requiredTools: ["write_file"], purpose: "Exact preview", ttlSeconds: 300 },
    scope: { resources: ["Disposable fixture"], destinations: ["Fixture only"], restrictions: ["Review writes"], source: "operator_template", budget: "unavailable" },
    requirements: [{ id: "hosted", title: "Hosted checks", collector: { kind: "json", url: "http://127.0.0.1:1/evidence/{artifact}", artifactPointer: "/artifact", statePointer: "/state", passedValue: "passed", failedValues: ["failed"] } }] };
  privateSave(catalog, { schema: "chio.task.catalog.v1", templates: [template] }, true);
  privateSave(operator, { endpoint: "http://127.0.0.1:" + kernel.address().port, bearerToken: "bootstrap-fixture", adminToken: "admin-fixture", trustedSigners: [signer] }, true);
  const args = [fileURLToPath(new URL("../scripts/task.mjs", import.meta.url)), "prepare", "--catalog", catalog, "--template", "preview", "--directory", destination, "--operator-file", operator, "--goal", "Prove the exact preview", "--artifact-kind", "sha256", "--artifact-digest", "e".repeat(64), "--artifact-label", "fixture artifact"];
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] }); let stdout = "", stderr = "";
  child.stdout.on("data", data => { stdout += data; }); child.stderr.on("data", data => { stderr += data; });
  const code = await new Promise(resolve => child.once("close", resolve)); assert.equal(code, 0, stderr);
  const result = JSON.parse(stdout); assert.equal(result.status, "prepared"); assert.equal(result.dispatchPerformed, false);
  const prepared = JSON.parse(readFileSync(result.gatewayConfig)); assert.equal(prepared.execution.bearerToken, "delegated-fixture");
  assert.equal(JSON.stringify(prepared).includes("admin-fixture"), false); assert.equal(JSON.stringify(prepared).includes("bootstrap-fixture"), false);
  assert.deepEqual(prepared.tools.map(t => t.name), ["write_file"]); assert.deepEqual(prepared.approval, template.approval);
  assert.equal(readTask(result.taskPath).sessionId, result.sessionId); assert.equal(existsSync(join(destination, "prepare-request.json")), false);
  assert.equal(methods.includes("tools/call"), false); assert.ok(auth.includes("Bearer delegated-fixture"));
});
