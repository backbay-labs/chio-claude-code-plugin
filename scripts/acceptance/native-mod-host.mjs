#!/usr/bin/env node
// Real pinned Claude and macOS sandbox; stubbed kernel context and deterministic
// local model. This proves host loading/control flow, never resource qualification.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeModIdentity } from "../mod-profile.mjs";
import { signer, signedDecision, signedOutcome } from "../../test/workflow-fixture.mjs";
import { gatewayApprovalPath, gatewayBinding } from "../../dist/gateway.js";
import { privateDirectory, privateSave, digest as valueDigest } from "../../dist/workflow/store.js";
import { createTask, collectRequirement } from "../../dist/workflow/tasks.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const host = process.env.CHIO_CLAUDE_HOST;
if (process.platform !== "darwin" || !host) throw new Error("macOS and CHIO_CLAUDE_HOST are required");
const output = resolve(process.argv[2] ?? "/tmp/chio-native-host-evidence"); mkdirSync(output, { recursive: true });
const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
const results = [];
const scenarios = ["review", "native-bypass", "status-command", "native-routes", "disconnected-mod", "interactive", "interactive-clear", "interactive-workflow"];
if (process.argv[3] && !scenarios.includes(process.argv[3])) throw new Error("unknown native host scenario");
for (const scenario of process.argv[3] ? [process.argv[3]] : scenarios) {
  const interactive = scenario.startsWith("interactive");
  const workflowFixture = scenario === "interactive-workflow";
  let effects = 0, charges = 0, kernelAcks = 0;
  const runtime = mkdtempSync("/private/tmp/chio-native-host-"); mkdirSync(join(runtime, "workspace"));
  const sessionId = randomUUID(); const kernelSessionId = randomUUID(); const now = Math.floor(Date.now() / 1000);
  const credential = { schema: "chio.mcp.session-credential.v1", sessionId: kernelSessionId, subjectKey: "b".repeat(64), capabilityIds: ["fixture-capability"], serverId: "fixture-resource", endpointPath: "/mcp", allowedTools: ["write_file"], issuedAt: now, expiresAt: now + 600 };
  const methods = [];
  const kernel = createServer(async (req, res) => {
    if (workflowFixture && req.method === "GET" && req.url.startsWith("/evidence/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ artifact: "e".repeat(64), state: req.url.endsWith("local") ? "passed" : "running" })); return;
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString()); methods.push(rpc.method);
    const valid = req.headers.authorization === "Bearer delegated-fixture" && req.headers["mcp-session-id"] === kernelSessionId;
    let result = { schema: "chio.mcp.execution-context.v1", evidenceVersion: "1", deliveryAcknowledgementVersion: "1", subjectKey: credential.subjectKey,
      serverId: credential.serverId, capabilityIds: credential.capabilityIds, sessionCredential: credential };
    if (workflowFixture && valid && rpc.method === "tools/call") {
      effects++; charges++; writeFileSync(join(runtime, "protected-owner-result.txt"), rpc.params.arguments.content, { flag: "wx" });
      const outcome = signedOutcome(config, { requestId: rpc.params._meta.chioRequestId, tool: rpc.params.name, arguments: rpc.params.arguments,
        approval: { chioGovernedIntent: rpc.params._meta.chioGovernedIntent, chioApprovalToken: rpc.params._meta.chioApprovalToken } });
      result = { _meta: { chioEvidence: { schema: "chio.mcp.execution-evidence.v1", requestId: outcome.requestId, receipt: outcome.receipt, terminalState: "completed", outputKind: "value", output: outcome.result }, chioDelivery: outcome.delivery } };
    } else if (workflowFixture && valid && rpc.method === "chio/acknowledge") {
      kernelAcks++; result = { schema: "chio.mcp.delivery-ack.v1", requestId: rpc.params.requestId, receiptId: rpc.params.receiptId, acknowledged: true };
    }
    res.writeHead(valid ? 200 : 401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, ...(valid && (rpc.method === "chio/execution-context" || workflowFixture && ["tools/call", "chio/acknowledge"].includes(rpc.method)) ? { result } : { error: { code: -32601, message: "fixture dispatch is unavailable" } }) }));
  });
  await new Promise(resolveReady => kernel.listen(0, "127.0.0.1", resolveReady));
  const requests = [];
  const egressRequests = [];
  const egress = createServer((req, res) => { egressRequests.push(req.url); res.writeHead(200); res.end("fixture egress"); });
  await new Promise(resolveReady => egress.listen(0, "127.0.0.1", resolveReady));
  const localMarker = join(runtime, "workspace/bypass.txt");
  const model = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url.includes("count_tokens")) { res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"input_tokens":100}'); return; }
    const delivered = body.messages.flatMap(message => Array.isArray(message.content) ? message.content.filter(block => block.type === "tool_result") : []);
    requests.push({ toolNames: body.tools?.map(tool => tool.name), resultCount: delivered.length });
    const block = delivered.length ? { type: "text", text: "Fixture stopped. Operator review is required." }
      : scenario !== "native-bypass" ? { type: "tool_use", id: "toolu_native_review", name: "mcp__chio__write_file", input: { path: "/protected/test.txt", content: "exact fixture payload" } }
      : { type: "tool_use", id: "toolu_native_bypass", name: "Bash", input: { command: `printf bypass > ${localMarker}` } };
    const reason = block.type === "tool_use" ? "tool_use" : "end_turn";
    const message = { id: `msg_native_${requests.length}`, type: "message", role: "assistant", model: body.model, content: [block], stop_reason: reason, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 10 } };
    res.writeHead(200, { "Content-Type": body.stream ? "text/event-stream" : "application/json" });
    if (!body.stream) { res.end(JSON.stringify(message)); return; }
    const emit = (type, value) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`);
    emit("message_start", { message: { ...message, content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 0 } } });
    emit("content_block_start", { index: 0, content_block: { ...block, ...(block.type === "tool_use" ? { input: {} } : { text: "" }) } });
    emit("content_block_delta", { index: 0, delta: block.type === "tool_use" ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) } : { type: "text_delta", text: block.text } });
    emit("content_block_stop", { index: 0 }); emit("message_delta", { delta: { stop_reason: reason, stop_sequence: null }, usage: { output_tokens: 10 } }); emit("message_stop", {}); res.end();
  });
  await new Promise(resolveReady => model.listen(0, "127.0.0.1", resolveReady));
  const config = { sessionId, journalDir: join(runtime, "journal"), sessionCredential: credential,
    execution: { endpoint: `http://127.0.0.1:${kernel.address().port}`, bearerToken: "delegated-fixture", trustedSigners: workflowFixture ? [signer] : ["a".repeat(64)], subjectKey: credential.subjectKey, capabilityId: "fixture-capability", serverId: credential.serverId, sessionId: kernelSessionId, timeoutMs: 1000 },
    tools: [{ name: "write_file", description: "Retain a fixture proposal", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } }],
    approval: { requiredTools: ["write_file"], purpose: "exact fixture write", ttlSeconds: 300 } };
  if (workflowFixture) {
    const state = join(config.journalDir, "workflow"); privateDirectory(state);
    const requirements = ["local", "hosted"].map(id => ({ id, title: id === "local" ? "Local checks" : "Hosted checks", collector: { kind: "json", url: "http://127.0.0.1:" + kernel.address().port + "/evidence/" + id, artifactPointer: "/artifact", statePointer: "/state", passedValue: "passed", failedValues: ["failed"] } }));
    const template = { id: "preview", title: "Prepare exact preview", serverId: credential.serverId, expectedCapabilityId: credential.capabilityIds[0], allowedTools: credential.allowedTools, ttlSeconds: 600, approval: config.approval,
      scope: { resources: ["Disposable fixture file"], destinations: ["Fixture owner"], restrictions: ["Exact write review"], source: "operator_template", budget: "unavailable" }, requirements };
    const taskPath = join(state, "task.json"), catalogPath = join(state, "catalog.json");
    privateSave(catalogPath, { schema: "chio.task.catalog.v1", templates: [template] }, true);
    createTask(taskPath, { sessionId, binding: valueDigest(gatewayBinding(config)), title: template.title, goal: "Review and continue one exact fixture write", artifact: { kind: "sha256", digest: "e".repeat(64), label: "fixture artifact" }, template });
    await collectRequirement(taskPath, "local"); await collectRequirement(taskPath, "hosted");
    config.workflow = { taskPath, catalogPath };
  }
  const configPath = join(runtime, "config.json"); write(configPath, config);
  let candidateRoot = root;
  const routeReport = join(runtime, "profile/native-routes.json"); const escapePath = join(runtime, "outside-host.txt");
  if (["native-routes", "disconnected-mod"].includes(scenario)) {
    candidateRoot = join(runtime, "test-only-artifact"); mkdirSync(candidateRoot, { mode: 0o700 });
    for (const name of ["dist", "scripts", "hooks", "types", "docs/host-contract.json"]) { const target = join(candidateRoot, name); mkdirSync(dirname(target), { recursive: true }); cpSync(join(root, name), target, { recursive: true }); }
    if (scenario === "native-routes") {
      const modulePath = join(candidateRoot, "hooks/native/register.ts");
      const probe = `\nasync function probeRoutes($) {
        const results = {};
        try { await $.fs.read(${JSON.stringify(configPath)}); results.operatorConfigReadBlocked = false; } catch { results.operatorConfigReadBlocked = true; }
        try { await $.fs.read(${JSON.stringify(join(config.journalDir, "authority.binding"))}); results.journalReadBlocked = false; } catch { results.journalReadBlocked = true; }
        try { await $.fs.write(${JSON.stringify(escapePath)}, "fixture escape"); results.outsideWriteBlocked = false; } catch { results.outsideWriteBlocked = true; }
        try { const child = await $.process.run(["/usr/bin/touch", ${JSON.stringify(escapePath)}], { timeoutMs: 1000 }); results.processBlocked = child.exitCode !== 0; } catch { results.processBlocked = true; }
        try { await $.http.fetch("http://127.0.0.1:${egress.address().port}/probe"); results.otherPortBlocked = false; } catch { results.otherPortBlocked = true; }
        results.operatorEnvExcluded = (await $.env.get("CHIO_OPERATOR_SENTINEL")) === undefined;
        await $.fs.write(${JSON.stringify(routeReport)}, JSON.stringify(results));
      }\n`;
      const source = readFileSync(modulePath, "utf8"); const original = 'on("turn.complete", async ($, e, next) => { await refresh($, options); return next(e); })';
      if (!source.includes(original)) throw new Error("native route probe source insertion changed");
      writeFileSync(modulePath, source.replace(original, 'on("turn.complete", async ($, e, next) => { await refresh($, options); await probeRoutes($); return next(e); })') + probe);
    } else {
      const launcher = join(candidateRoot, "scripts/restricted.mjs");
      writeFileSync(launcher, readFileSync(launcher, "utf8").replace('DISABLE_TELEMETRY: "1"', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", DISABLE_TELEMETRY: "1"'));
    }
  }
  const gateway = join(candidateRoot, "dist/gateway-http.js");
  const args = [join(candidateRoot, "scripts/restricted.mjs"), "--host", host, "--host-sha256", digest(host), "--gateway-config", configPath, "--gateway-sha256", digest(gateway), "--profile", join(runtime, "profile"), "--workspace", join(runtime, "workspace"), "--model", "claude-sonnet-5-5", "--mode", interactive ? "interactive" : "mod-print", "--mod-sha256", nativeModIdentity(candidateRoot)];
  try {
    const child = spawn(interactive ? "python3" : process.execPath, interactive ? [join(root, "scripts/acceptance/pty-host.py"), process.execPath, ...args] : args,
      { cwd: candidateRoot, env: { ...process.env, TERM: "xterm-256color", CHIO_OPERATOR_SENTINEL: "parent-only-fixture", ANTHROPIC_API_KEY: "local-model-fixture", ANTHROPIC_BASE_URL: `http://127.0.0.1:${model.address().port}` }, stdio: interactive ? ["pipe", "pipe", "pipe", "pipe"] : ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", terminalStage = "starting"; const startupAnswers = new Set();
    const typeLine = value => { child.stdin.write(value); setTimeout(() => child.stdin.write("\r"), 200); };
    const plain = value => value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\r/g, "");
    const advanceTerminal = text => {
      const compact = text.replace(/\s/g, "").replace(/\x1b[78]/g, "");
      if (terminalStage === "work" && compact.includes("Operatormodelrelayrefused")) { terminalStage = "failed"; setTimeout(() => child.stdin.write("\x04"), 300); }
      for (const phrase of ["Choose the text style", "Do you want to use this API key", "Is this a project you created or one you trust", "Press Enter to continue"]) {
        if (text.includes(phrase) && !startupAnswers.has(phrase)) { startupAnswers.add(phrase); setTimeout(() => child.stdin.write("\r"), 200); }
      }
      if (terminalStage === "starting" && compact.includes("Chio·isolatedkernelMCP")) { terminalStage = "status"; setTimeout(() => typeLine("/chio-status"), 300); }
      else if (terminalStage === "status" && text.includes(sessionId)) { writeFileSync(join(output, `${scenario}.status-screen.txt`), text); terminalStage = workflowFixture ? "completion" : scenario === "interactive-clear" ? "clear" : "work";
        setTimeout(() => typeLine(workflowFixture ? "/chio-completion" : scenario === "interactive-clear" ? "/clear" : "Execute the fixed fixture once, then stop on review or refusal."), 700); }
      else if (terminalStage === "completion" && compact.includes("Localchecks·passed") && compact.includes("Hostedchecks·running")) {
        writeFileSync(join(output, scenario + ".completion-screen.txt"), text); terminalStage = "work"; child.stdin.write("\x1b");
        setTimeout(() => typeLine("Execute the fixed fixture once, then stop on review or refusal."), 600);
      }
      else if (terminalStage === "work" && requests.length > 1 && compact.includes("1review")) { terminalStage = "review"; setTimeout(() => typeLine("/chio-review"), 300); }
      else if (terminalStage === "review" && compact.includes("Requestapprovalofthisexactaction")) {
        writeFileSync(join(output, `${scenario}.review-screen.txt`), text);
        if (workflowFixture) {
          const name = readdirSync(config.journalDir).find(name => name.endsWith(".json"));
          const original = JSON.parse(readFileSync(join(config.journalDir, name)));
          privateDirectory(join(config.journalDir, "approvals")); privateSave(gatewayApprovalPath(config, original.requestId), { toolCallParams: signedDecision(config, original.proposal) }, true);
          terminalStage = "continuation"; child.stdin.write("\x1b"); setTimeout(() => typeLine("/chio-continue " + original.requestId), 500); return;
        }
        terminalStage = "done";
        // Deliberate interruption after the rendered review. This does not
        // establish natural terminal shutdown or authority confirmation.
        setTimeout(() => child.kill("SIGTERM"), 1000);
      }
      else if (terminalStage === "continuation" && compact.includes("Continuationsubmittedfororiginaloperation")) {
        const dir = join(config.journalDir, "workflow/continuations"), name = readdirSync(dir).find(name => name.endsWith(".json"));
        terminalStage = "outcome"; setTimeout(() => typeLine("/chio-outcome " + name.slice(0, -5)), 500);
      }
      else if (terminalStage === "outcome" && compact.includes("Originalresultreceivedthroughnativecontrol") && compact.includes("Onefixturewritecompleted")) {
        writeFileSync(join(output, scenario + ".outcome-screen.txt"), text); terminalStage = "done"; setTimeout(() => typeLine("/exit"), 500);
      }
    };
    child.stdout.on("data", data => { stdout += data; });
    if (interactive) {
      let frames = "";
      child.stdio[3].setEncoding("utf8"); child.stdio[3].on("data", data => {
        frames += data; let index;
        while ((index = frames.indexOf("\n")) >= 0) { const line = frames.slice(0, index); frames = frames.slice(index + 1); advanceTerminal(JSON.parse(line).screen); }
      });
    }
    child.stderr.on("data", data => stderr += data);
    if (!interactive) child.stdin.end(scenario === "status-command" ? "/chio-status" : "Execute the fixed fixture once, then stop on review or refusal.");
    const deadline = setTimeout(() => child.kill("SIGTERM"), 45_000);
    const code = await new Promise(resolveExit => child.once("close", resolveExit)); clearTimeout(deadline);
    writeFileSync(join(output, `${scenario}.stdout.jsonl`), stdout); writeFileSync(join(output, `${scenario}.stderr.txt`), stderr);
    const exit = existsSync(join(runtime, "profile/exit.json")) ? JSON.parse(readFileSync(join(runtime, "profile/exit.json"))) : null;
    if (interactive) writeFileSync(join(output, `${scenario}.terminal.txt`), plain(stdout));
    const routes = existsSync(routeReport) ? JSON.parse(readFileSync(routeReport)) : null;
    if (scenario === "native-routes" && !existsSync(join(config.journalDir, "authority.binding"))) throw new Error("missing existing journal canary; read denial would be inconclusive");
    const expected = workflowFixture ? code === 0 && effects === 1 && charges === 1 && kernelAcks === 1 && terminalStage === "done" && exit?.executionOutcome === "completed"
      : scenario === "status-command" ? code === 0 && requests.length === 0 && stdout.includes("Chio · isolated kernel MCP") && stdout.includes(sessionId)
      : scenario === "disconnected-mod" ? code === 1 && requests.length === 0 && exit?.hostInitialization.failed === true && exit?.hostInitialization.nativeStatusReads === 0
      : scenario === "interactive-clear" ? code === 1 && requests.length === 0 && exit?.hostInitialization.failed === true && exit?.hostInitialization.sessionChanged === true
      : scenario === "native-bypass" ? code === 2 && exit?.executionOutcome === "unresolved" && requests.length > 0
      : code === 4 && exit?.executionOutcome === "awaiting-approval" && requests.length > 0 && (scenario !== "interactive" || terminalStage === "done");
    const passed = expected && (workflowFixture || !methods.includes("tools/call")) && !existsSync(localMarker) && !existsSync(escapePath) && egressRequests.length === 0 && !stderr.includes("hooks module not loaded")
      && (scenario === "disconnected-mod" || exit?.hostInitialization.nativeStatusReads > 0)
      && (scenario !== "native-routes" || routes && Object.keys(routes).length === 6 && Object.values(routes).every(value => value === true));
    const result = { scenario, passed: Boolean(passed), code, claim: "actual host and sandbox with stubbed kernel context and deterministic model; no resource qualification", hostVersion: "2.1.287", hostSha256: digest(host), gatewaySha256: digest(gateway), modSha256: nativeModIdentity(candidateRoot), productionModSha256: nativeModIdentity(root), testOnlyModifiedArtifact: candidateRoot !== root,
      activation: "explicit-process-opt-in", runtime, ...(workflowFixture ? { fixtureEffects: effects, fixtureCharges: charges, fixtureAcks: kernelAcks, naturalTerminalExit: code === 0 } : {}), kernelMethods: methods, modelRequests: requests, nativeBypassEffect: existsSync(localMarker), outsideFileEffect: existsSync(escapePath), otherPortRequests: egressRequests.length, routeProbe: routes, ...(interactive ? { terminalStage, startupAnswers: [...startupAnswers], cleanup: workflowFixture ? "natural terminal exit after native-control delivery" : scenario === "interactive" ? "deliberate interruption after rendered review" : "launcher termination on host identity change" } : {}), terminal: exit };
    write(join(output, `${scenario}.json`), result); results.push(result); process.stdout.write(JSON.stringify({ scenario, passed, code, methods, requests }) + "\n");
  } finally {
    await new Promise(resolveClose => { model.close(resolveClose); model.closeAllConnections(); });
    await new Promise(resolveClose => { kernel.close(resolveClose); kernel.closeAllConnections(); });
    await new Promise(resolveClose => { egress.close(resolveClose); egress.closeAllConnections(); });
  }
}
write(join(output, "SUMMARY.json"), { passed: results.every(result => result.passed), classification: "host fixture only", cases: results });
if (results.some(result => !result.passed)) process.exitCode = 1;
