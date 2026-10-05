import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";
import { startDemo } from "../scripts/demo.mjs";
import { main as controlMain } from "../scripts/control.mjs";
import { watch } from "../scripts/control-watch.mjs";
const script = name => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
async function demo(t) {
  const base = mkdtempSync(join(tmpdir(), "chio-demo-guard-")); t.after(() => rmSync(base, { recursive: true, force: true }));
  const d = await startDemo({ directory: join(base, "demo") }); t.after(() => d.close()); d.base = base; return d;
}
test("the protected launcher refuses a demo configuration", async t => {
  const d = await demo(t); const workspace = join(d.base, "ws"); mkdirSync(workspace);
  const result = spawnSync(process.execPath, [script("restricted.mjs"), "--host", process.execPath, "--host-sha256", sha(process.execPath), "--profile", join(d.base, "profile"), "--workspace", workspace,
    "--gateway-config", join(d.directory, "gateway.json"), "--gateway-sha256", sha(script("../dist/gateway-http.js")), "--model", "m"], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.match(result.stderr, /demo configuration; run scripts\/demo\.mjs instead/);
});
test("control.mjs serve refuses a demo configuration", async t => {
  const d = await demo(t);
  await assert.rejects(controlMain(["serve", "--gateway-config", join(d.directory, "gateway.json"), "--credential-output", join(d.base, "cred.json")]), /demo configuration; run scripts\/demo\.mjs instead/);
});
test("control.mjs status and report keep a demo configuration labeled", async t => {
  const d = await demo(t); const config = join(d.directory, "gateway.json");
  const out = spawnSync(process.execPath, [script("control.mjs"), "status", "--gateway-config", config], { encoding: "utf8" });
  assert.equal(JSON.parse(out.stdout).scope, "demo_fixture");
  const inbox = spawnSync(process.execPath, [script("control.mjs"), "inbox", "--gateway-config", config], { encoding: "utf8" }); assert.equal(inbox.status, 0, inbox.stderr);
  const report = join(d.base, "r.md");
  assert.equal(spawnSync(process.execPath, [script("control.mjs"), "report", "--gateway-config", config, "--output", report], { encoding: "utf8" }).status, 0);
  assert.match(readFileSync(report, "utf8"), /Scope: demo\\?_fixture/);
});
function terminal() {
  const input = new PassThrough(); input.isTTY = true; input.setRawMode = () => input;
  const output = new PassThrough(); output.isTTY = true; let text = ""; output.on("data", data => { text += data; });
  return { input, output, read: () => text };
}
async function until(predicate, ms = 3000) { const end = Date.now() + ms; while (!predicate()) { if (Date.now() > end) throw new Error("timed out"); await new Promise(r => setTimeout(r, 10)); } }
test("the watch screen says DEMO on the summary line and the card header in demo scope", async () => {
  const PREFIX = "DEMO fixture kernel · nothing protected · ";
  const intent = { id: "12345678-1234-4123-8123-123456789abc", kind: "approve", state: "requested", requestId: "req-1", expiresAt: Date.now() + 60_000 };
  const op = { requestId: "req-1", tool: "write_file", review: { decision: "required", purpose: "p", capabilityId: "c", ttlSeconds: 60, arguments: { n: 1 } } };
  for (const scope of ["demo_fixture", "isolated_kernel_mcp"]) {
    const tty = terminal();
    const running = watch({ statusOptions: { config: {} }, operator: {}, input: tty.input, output: tty.output, intervalMs: 20, guardMs: 10,
      readStatus: async () => ({ sessionId: "s", authority: "live", scope, operations: [op], intents: [intent] }) });
    await until(() => tty.read().includes("Confirm this exact decision?"));
    await new Promise(r => setTimeout(r, 60)); tty.input.write("q"); await running;
    const lines = tty.read().split("\n");
    const summary = lines.find(l => l.includes("Chio watch")), header = lines.find(l => l.includes("Chio review"));
    if (scope === "demo_fixture") { assert.ok(summary.startsWith(PREFIX + "Chio watch"), summary); assert.ok(header.replace("\x07", "").startsWith(PREFIX + "Chio review"), header); }
    else { assert.ok(!tty.read().includes("DEMO")); }
  }
});
test("the printed demo command quotes paths and tells a non-terminal how to stop", async t => {
  const { spawn } = await import("node:child_process");
  const base = mkdtempSync(join(tmpdir(), "chio-demo-print-")); t.after(() => rmSync(base, { recursive: true, force: true }));
  const child = spawn(process.execPath, [script("demo.mjs"), "--directory", join(base, "demo it's")], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  let out = ""; child.stdout.on("data", data => { out += data; });
  await until(() => out.includes("Stop the demo with Ctrl+C."), 10000);
  assert.match(out, /--plugin-dir '[^']+'/); assert.ok(out.includes("--mcp-config '") && out.includes(`demo it'\\''s/mcp.json'`));
  assert.ok(!out.includes("Press q")); assert.match(out, /Tested with Claude Code 2\.1\.287; the control token in this command grants this session's view and review requests only and ends with the demo\./);
  const closed = new Promise(resolve => child.once("close", resolve)); child.kill("SIGINT"); await closed;
});
