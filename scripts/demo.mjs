#!/usr/bin/env node
// Local demo: a fixture kernel, the real gateway and control service, and the operator watch. Nothing is protected.
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signerFor, startDemoKernel } from "../dist/demo/fixture.js";
import { startGatewayHttp } from "../dist/gateway-http.js";
import { startControlServer } from "../dist/control/service.js";
import { createControlTransport } from "./control-transport.mjs";
import { watch } from "./control-watch.mjs";
import { DEMO_SERVER_ID } from "./sandbox.mjs"; // serverId "demo-owner" marks demo configs; real launchers refuse them

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shellQuote = value => `'${String(value).replaceAll("'", `'\\''`)}'`;
const privateFile = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });

export async function startDemo({ directory }) {
  const target = resolve(directory);
  if (existsSync(target)) throw new Error(`demo directory already exists: ${target}`);
  mkdirSync(target, { mode: 0o700 });
  const dir = realpathSync(target);
  const ownerPath = join(dir, "owner"), journalDir = join(dir, "journal");
  mkdirSync(ownerPath, { mode: 0o700 }); mkdirSync(journalDir, { mode: 0o700 });
  const owner = realpathSync(ownerPath);
  const seed = randomBytes(32).toString("hex");
  privateFile(join(dir, "signing-seed.json"), { seed, note: "Demo only. Trust this key nowhere else." });
  const now = Math.floor(Date.now() / 1000);
  const kernelSessionId = randomUUID(), adminToken = randomBytes(24).toString("hex"), bearerToken = randomBytes(24).toString("hex");
  const credential = { schema: "chio.mcp.session-credential.v1", sessionId: kernelSessionId, subjectKey: randomBytes(32).toString("hex"), capabilityIds: ["demo-capability"], serverId: DEMO_SERVER_ID, endpointPath: "/mcp", allowedTools: ["read_text_file", "write_file"], issuedAt: now, expiresAt: now + 3600 };
  const config = {
    sessionId: randomUUID(), journalDir, sessionCredential: credential,
    execution: { endpoint: "", bearerToken, trustedSigners: [signerFor(seed)], subjectKey: credential.subjectKey, capabilityId: "demo-capability", serverId: credential.serverId, sessionId: kernelSessionId, timeoutMs: 3000 },
    tools: [
      { name: "write_file", description: "Write a text file inside the demo owner directory (requires operator review)", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } },
      { name: "read_text_file", description: "Read a text file inside the demo owner directory", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } },
    ],
    approval: { requiredTools: ["write_file"], purpose: "Demo write to the owner directory", ttlSeconds: 300 },
  };
  const kernel = await startDemoKernel({ owner, seed, adminToken, bearerToken, credential, config: () => config });
  let gateway, control;
  try {
    config.execution.endpoint = kernel.url;
    privateFile(join(dir, "gateway.json"), config);
    const operator = { adminToken };
    privateFile(join(dir, "operator.json"), operator);
    // Only the relay-backed protected launcher can confirm host receipt, so the demo gateway does not require it.
    gateway = await startGatewayHttp(config, { requireHostAcknowledgement: false });
    control = await startControlServer({ config, authorityExpiresAt: credential.expiresAt, scope: "demo_fixture", workflow: createControlTransport(gateway, config) });
    privateFile(join(dir, "mcp.json"), { mcpServers: { chio: { type: "http", url: gateway.url, headers: { Authorization: "Bearer " + gateway.token } } } });
    // chio-claude demo attach reads this to open Claude against the demo; it is as private as the tokens above.
    // pid lets chio-claude demo attach skip a demo that died without cleaning up.
    privateFile(join(dir, "attach.json"), { pid: process.pid, sessionId: config.sessionId, mcpConfig: join(dir, "mcp.json"), controlUrl: control.url, controlToken: control.token });
    let closing;
    const close = () => closing ??= (async () => {
      try { unlinkSync(join(dir, "attach.json")); } catch {}
      for (const part of [control, gateway, kernel]) { try { await part.close(); } catch {} }
    })();
    return { directory: dir, sessionId: config.sessionId, config, operator, gateway: { url: gateway.url, token: gateway.token }, control: { url: control.url, token: control.token }, owner, kernel, close };
  } catch (error) {
    for (const part of [control, gateway, kernel]) { try { await part?.close(); } catch {} }
    throw error;
  }
}

async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== "--directory" || !args[1]) throw new Error("usage: demo.mjs --directory NEW_DIR");
  const d = await startDemo({ directory: args[1] });
  const credential = d.config.sessionCredential;
  const hostVersion = JSON.parse(readFileSync(join(root, "docs/host-contract.json"), "utf8")).version;
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  // chio-claude sets CHIO_DEMO_ATTACH to its short attach command; a source checkout prints the full one.
  const attach = process.env.CHIO_DEMO_ATTACH;
  console.log(`Chio DEMO · fixture kernel · nothing is protected
In another terminal:
${attach ? `  ${attach}
Tested with Claude Code ${hostVersion}; the control token in attach.json grants this session's view and review requests only and ends with the demo.` : `  CHIO_CONTROL_URL=${d.control.url} CHIO_CONTROL_TOKEN=${d.control.token} \\
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ${shellQuote(root)} \\
    --mcp-config ${shellQuote(join(d.directory, "mcp.json"))} --session-id ${d.sessionId}
Tested with Claude Code ${hostVersion}; the control token in this command grants this session's view and review requests only and ends with the demo.`}
Then ask Claude: Use the chio write_file tool to write "hello" to notes/hello.txt.
Approve here when the request appears. ${interactive ? "Press q to stop the demo." : "Stop the demo with Ctrl+C."}`);
  try {
    if (interactive) {
      // A closed terminal, SIGTERM or an outside SIGINT quits the watch screen the way q does, so the demo still shuts down.
      const quit = () => process.stdin.emit("data", "q");
      for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, quit);
      process.stdin.once("end", quit);
      await watch({ statusOptions: { config: d.config, authorityExpiresAt: credential.expiresAt, scope: "demo_fixture" }, operator: d.operator, input: process.stdin, output: process.stdout });
    } else {
      // on, not once: a forwarded signal can arrive twice, and the second must not cut shutdown short.
      await new Promise(stop => { process.on("SIGINT", stop); process.on("SIGTERM", stop); });
    }
  } finally { await d.close(); }
  console.log(`Demo stopped. Files remain in ${d.directory} (owner/, journal/).`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().catch(error => { console.error(`[chio demo] ${error.message}`); process.exitCode = 1; });
