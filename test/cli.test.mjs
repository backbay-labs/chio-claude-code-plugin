import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL, findHost, parse, pins, planRun, transcriptLine, UsageError } from "../cli/chio-claude.mjs";
import { CANDIDATE_RECORD } from "../scripts/verify-native-qualification.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "cli/chio-claude.mjs");
const record = JSON.parse(readFileSync(join(root, CANDIDATE_RECORD), "utf8"));
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
function home(t) {
  const dir = mkdtempSync(join(tmpdir(), "chio-cli-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const host = join(dir, "fake-claude"); writeFileSync(host, "#!/bin/sh\n"); chmodSync(host, 0o755);
  writeFileSync(join(dir, "gateway.json"), "{}\n", { mode: 0o600 });
  return { dir, host, env: { CHIO_CLAUDE_HOME: dir, CHIO_CLAUDE_HOST: host, PATH: "" }, hostPin: ["--host-sha256", sha(host)] };
}
const value = (argv, flag) => argv[argv.indexOf(flag) + 1];
const darwin = { platform: "darwin", arch: "arm64" };

test("help, version and unknown commands", () => {
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /chio-claude demo \[DIR\]/); assert.match(help.stdout, /chio-claude run \["TASK"\]/);
  const version = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.equal(version.stdout.trim(), JSON.parse(readFileSync(join(root, "package.json"))).version);
  const unknown = spawnSync(process.execPath, [cli, "launch"], { encoding: "utf8" });
  assert.equal(unknown.status, 64); assert.match(unknown.stderr, /unknown command launch/);
});

test("the CLI ships as an npm bin outside the plugin's bin directory", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json")));
  assert.deepEqual(pkg.bin, { "chio-claude": "cli/chio-claude.mjs" });
  assert.ok(pkg.files.includes("cli"));
  // A plugin's bin/ joins Claude's own Bash PATH; operator commands must never be there.
  assert.equal(existsSync(join(root, "bin")), false);
  assert.match(readFileSync(cli, "utf8"), /^#!\/usr\/bin\/env node\n/);
  assert.ok(statSync(cli).mode & 0o100);
});

test("a task runs in print mode with the recorded pins and private per-run directories", t => {
  const h = home(t);
  const plan = planRun([...h.hostPin, "Summarize notes.md"], { env: h.env, ...darwin, terminal: false });
  assert.equal(plan.mode, "print"); assert.equal(plan.task, "Summarize notes.md");
  assert.equal(plan.launcher[0], join(root, "scripts/restricted.mjs"));
  assert.equal(value(plan.launcher, "--host"), h.host);
  assert.equal(value(plan.launcher, "--gateway-sha256"), record.gatewaySha256);
  assert.equal(value(plan.launcher, "--gateway-config"), join(h.dir, "gateway.json"));
  assert.equal(value(plan.launcher, "--model"), DEFAULT_MODEL);
  assert.equal(value(plan.launcher, "--model-auth"), "claude-login");
  assert.ok(!plan.launcher.includes("--mode") && !plan.launcher.includes("--mod-sha256"));
  assert.ok(plan.runDirectory.startsWith(join(h.dir, "runs") + "/"));
  assert.equal(value(plan.launcher, "--profile"), join(plan.runDirectory, "profile"));
  assert.equal(value(plan.launcher, "--workspace"), join(plan.runDirectory, "workspace"));
  assert.equal(plan.createWorkspace, true);
});

test("no task opens the interactive session with the recorded native mod pin", t => {
  const h = home(t);
  const plan = planRun(h.hostPin, { env: h.env, ...darwin, terminal: true });
  assert.equal(plan.mode, "interactive");
  assert.equal(value(plan.launcher, "--mode"), "interactive");
  assert.equal(value(plan.launcher, "--mod-sha256"), record.nativeModSha256);
  assert.throws(() => planRun(h.hostPin, { env: h.env, ...darwin, terminal: false }), /needs a terminal/);
});

test("explicit options replace defaults", t => {
  const h = home(t);
  const workspace = join(h.dir, "mine"); mkdirSync(workspace);
  const plan = planRun([...h.hostPin, "--model", "claude-opus-5-5", "--model-auth", "api-key", "--workspace", workspace, "--model-token-budget", "5000", "--json", "-"], { env: h.env, ...darwin, terminal: false });
  assert.equal(value(plan.launcher, "--model"), "claude-opus-5-5");
  assert.equal(value(plan.launcher, "--model-auth"), "api-key");
  assert.equal(value(plan.launcher, "--workspace"), workspace); assert.equal(plan.createWorkspace, false);
  assert.equal(value(plan.launcher, "--model-token-budget"), "5000");
  assert.equal(plan.task, null); assert.equal(plan.raw, true);
  const apiKey = planRun([...h.hostPin, "task"], { env: { ...h.env, ANTHROPIC_API_KEY: "x" }, ...darwin, terminal: false });
  assert.equal(value(apiKey.launcher, "--model-auth"), "api-key");
});

test("run refuses with the next command to type", t => {
  const h = home(t);
  assert.throws(() => planRun(["task"], { env: h.env, platform: "linux", arch: "x64" }), /need macOS/);
  rmSync(join(h.dir, "gateway.json"));
  assert.throws(() => planRun([...h.hostPin, "task"], { env: h.env, ...darwin }), /Run: chio-claude prepare/);
  writeFileSync(join(h.dir, "gateway.json"), "{}\n");
  assert.throws(() => planRun([...h.hostPin, "a", "b"], { env: h.env, ...darwin }), /Quote the task/);
  assert.throws(() => planRun([...h.hostPin, "--mod-sha256", "0".repeat(64), "task"], { env: h.env, ...darwin }), /interactive session only/);
  assert.throws(() => planRun([...h.hostPin, "--model-auth", "token", "task"], { env: h.env, ...darwin }), /claude-login or api-key/);
  assert.throws(() => planRun(["task"], { env: h.env, ...darwin }), /CHIO_CLAUDE_HOST is not Claude Code/);
});

test("the host is the first candidate matching the pin", t => {
  const h = home(t);
  const pathDir = join(h.dir, "path"); mkdirSync(pathDir);
  const other = join(pathDir, "claude"); writeFileSync(other, "other\n");
  const env = { CHIO_CLAUDE_HOME: h.dir, PATH: pathDir };
  assert.throws(() => findHost({ env, version: "9.9.9", checksum: sha(h.host) }), /Claude Code 9.9.9 is required. Run: chio-claude host/);
  assert.equal(findHost({ env, version: "9.9.9", checksum: sha(other) }), realpathSync(other));
  const pinned = join(h.dir, "host", "claude-9.9.9"); mkdirSync(join(h.dir, "host")); writeFileSync(pinned, "other\n");
  assert.equal(findHost({ env, version: "9.9.9", checksum: sha(other) }), realpathSync(pinned));
});

test("pins come from the host contract and the candidate record", () => {
  const contract = JSON.parse(readFileSync(join(root, "docs/host-contract.json")));
  const p = pins({ platform: "darwin", arch: "arm64" });
  assert.deepEqual(p, { hostVersion: contract.version, host: contract.platforms["darwin-arm64"].checksum, gateway: record.gatewaySha256, mod: record.nativeModSha256 });
  assert.equal(pins({ platform: "sunos", arch: "sparc" }).host, undefined);
});

test("parse refuses unknown, repeated and valueless options", () => {
  assert.throws(() => parse(["--nope", "x"], ["--a"]), UsageError);
  assert.throws(() => parse(["--a", "1", "--a", "2"], ["--a"]), /given twice/);
  assert.throws(() => parse(["--a"], ["--a"]), /needs a value/);
  assert.deepEqual(parse(["x", "--a", "1", "--f"], ["--a"], ["--f"]), { options: { "--a": "1", "--f": true }, positional: ["x"] });
});

test("the transcript shows text, Chio tool calls and verified results", () => {
  const assistant = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Writing it." }, { type: "tool_use", name: "mcp__chio__write_file", input: { path: "a.txt" } }] } });
  assert.equal(transcriptLine(assistant), 'Writing it.\n  → chio write_file {"path":"a.txt"}');
  assert.equal(transcriptLine(JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", is_error: false }] } })), "  ← verified result");
  assert.equal(transcriptLine(JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", is_error: true }] } })), "  ← tool error");
  assert.equal(transcriptLine(JSON.stringify({ type: "system", subtype: "init" })), undefined);
  assert.equal(transcriptLine("not json"), undefined);
});

test("prepare and control refuse before touching a session", t => {
  const h = home(t);
  const existing = spawnSync(process.execPath, [cli, "prepare", join(h.dir, "request.json")], { env: { ...process.env, CHIO_CLAUDE_HOME: h.dir }, encoding: "utf8" });
  assert.equal(existing.status, 64); assert.match(existing.stderr, /already exists/);
  assert.equal(spawnSync(process.execPath, [cli, "prepare"], { encoding: "utf8" }).status, 64);
  assert.equal(spawnSync(process.execPath, [cli, "control"], { encoding: "utf8" }).status, 64);
});

test("chio-claude demo prints the short attach command and removes attach.json when stopped", async t => {
  const h = home(t);
  const child = spawn(process.execPath, [cli, "demo"], { env: { ...process.env, CHIO_CLAUDE_HOME: h.dir }, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  let out = ""; child.stdout.on("data", data => { out += data; });
  const deadline = Date.now() + 10000;
  while (!out.includes("Stop the demo with Ctrl+C.") && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  assert.match(out, /In another terminal:\n  chio-claude demo attach\n/);
  assert.ok(!out.includes("CHIO_CONTROL_TOKEN="));
  const [name] = readdirSync(join(h.dir, "demos"));
  const attach = join(h.dir, "demos", name, "attach.json");
  assert.equal(statSync(attach).mode & 0o777, 0o600);
  const saved = JSON.parse(readFileSync(attach, "utf8"));
  assert.match(saved.controlUrl, /^http:\/\/127\.0\.0\.1:\d+/); assert.ok(saved.controlToken && saved.sessionId && saved.mcpConfig.endsWith("mcp.json"));
  const closed = new Promise(resolve => child.once("close", resolve)); child.kill("SIGTERM"); await closed;
  assert.equal(existsSync(attach), false);
});
