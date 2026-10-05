import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL, findHost, parse, pins, planRun, run, transcriptLine, UsageError } from "../cli/chio-claude.mjs";
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
  assert.equal(transcriptLine(JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", is_error: false }] } })), "  ← result");
  assert.equal(transcriptLine(JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", is_error: true }] } })), "  ← tool error");
  assert.equal(transcriptLine(JSON.stringify({ type: "system", subtype: "init" })), undefined);
  assert.equal(transcriptLine("not json"), undefined);
});

test("prepare and control refuse before touching a session", t => {
  const h = home(t);
  const request = join(h.dir, "request.json"); writeFileSync(request, "{}\n", { mode: 0o600 });
  const existing = spawnSync(process.execPath, [cli, "prepare", request], { env: { ...process.env, CHIO_CLAUDE_HOME: h.dir }, encoding: "utf8" });
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

test("the package ships the candidate record the CLI reads its pins from", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json")));
  assert.ok(pkg.files.some(entry => CANDIDATE_RECORD === entry || CANDIDATE_RECORD.startsWith(entry + "/")), `${CANDIDATE_RECORD} is not in package.json files`);
});

function stubPackage(t, { version = "9.9.9", recordVersion = version, record = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "chio-cli-pkg-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const host = join(dir, "claude-host"); writeFileSync(host, "host\n");
  mkdirSync(join(dir, "docs")); mkdirSync(join(dir, "scripts"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version }));
  writeFileSync(join(dir, "docs/host-contract.json"), JSON.stringify({ version: "1.0.0", platforms: { "darwin-arm64": { checksum: sha(host) } } }));
  if (record) { mkdirSync(join(dir, CANDIDATE_RECORD, ".."), { recursive: true }); writeFileSync(join(dir, CANDIDATE_RECORD), JSON.stringify({ version: recordVersion, gatewaySha256: "a".repeat(64), nativeModSha256: "b".repeat(64) })); }
  // A launcher stand-in: records argv and stdin in its new profile, prints one host event and writes exit.json.
  writeFileSync(join(dir, "scripts/restricted.mjs"), `import { mkdirSync, readFileSync, writeFileSync } from "node:fs"; import { join } from "node:path";
const args = process.argv.slice(2), profile = args[args.indexOf("--profile") + 1];
mkdirSync(profile, { mode: 0o700 });
writeFileSync(join(profile, "argv.json"), JSON.stringify(args)); writeFileSync(join(profile, "stdin.txt"), readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "done" }] } }));
if (process.env.STUB_OUTCOME) writeFileSync(join(profile, "exit.json"), JSON.stringify({ executionOutcome: process.env.STUB_OUTCOME }));
process.exitCode = Number(process.env.STUB_CODE ?? 0);
`);
  return { dir, host };
}
const sink = () => { const s = { text: "", write: chunk => { s.text += chunk; return true; } }; return s; };

test("pins refuse a missing record or one for another version", t => {
  assert.throws(() => pins({ packageRoot: stubPackage(t, { record: false }).dir }), /does not include its candidate record/);
  assert.throws(() => pins({ packageRoot: stubPackage(t, { recordVersion: "1.2.3" }).dir }), /is for 1\.2\.3, not 9\.9\.9/);
});

test("run delivers the task on stdin, renders the transcript and reports the recorded outcome", async t => {
  const pkg = stubPackage(t), h = home(t);
  const env = { ...h.env, CHIO_CLAUDE_HOST: pkg.host, STUB_OUTCOME: "awaiting-approval", STUB_CODE: "4" };
  const stdout = sink(), stderr = sink();
  const code = await run(["Write a note"], env, { stdout, stderr, platform: "darwin", arch: "arm64", terminal: false, packageRoot: pkg.dir });
  assert.equal(code, 4);
  assert.equal(stdout.text, "done\n");
  assert.match(stderr.text, /waiting for operator approval \(chio-claude control watch --operator-file PRIVATE_FILE\)/);
  const [id] = readdirSync(join(h.dir, "runs"));
  const runDir = join(h.dir, "runs", id);
  assert.equal(readFileSync(join(runDir, "profile/stdin.txt"), "utf8"), "Write a note\n");
  const argv = JSON.parse(readFileSync(join(runDir, "profile/argv.json"), "utf8"));
  assert.equal(value(argv, "--gateway-sha256"), "a".repeat(64)); assert.equal(value(argv, "--host"), pkg.host);
  assert.equal(statSync(join(runDir, "workspace")).mode & 0o777, 0o700);
  assert.match(stderr.text, new RegExp(`evidence: ${join(runDir, "profile/exit.json").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  const refused = sink();
  assert.equal(await run(["x"], { ...env, STUB_OUTCOME: "", STUB_CODE: "1" }, { stdout: sink(), stderr: refused, platform: "darwin", arch: "arm64", terminal: false, packageRoot: pkg.dir }), 1);
  assert.match(refused.text, /stopped before recording an outcome \(exit 1\)/); assert.doesNotMatch(refused.text, /evidence:/);
});

test("CHIO_CLAUDE_HOST, when set, is the only host considered", t => {
  const h = home(t);
  const pathDir = join(h.dir, "path"); mkdirSync(pathDir);
  const onPath = join(pathDir, "claude"); writeFileSync(onPath, "#!/bin/sh\n"); // same bytes as h.host
  assert.equal(findHost({ env: { CHIO_CLAUDE_HOST: h.host, PATH: pathDir }, version: "1", checksum: sha(h.host) }), h.host);
  const other = join(h.dir, "other"); writeFileSync(other, "different\n");
  assert.throws(() => findHost({ env: { CHIO_CLAUDE_HOST: other, PATH: pathDir }, version: "1", checksum: sha(h.host) }), /CHIO_CLAUDE_HOST is not Claude Code/);
});

test("model text cannot reach the terminal as control sequences", () => {
  const esc = String.fromCharCode(0x1b), csi = String.fromCharCode(0x9b), rlo = String.fromCharCode(0x202e), ls = String.fromCharCode(0x2028);
  const line = transcriptLine(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: `ok${esc}[8m hidden${csi}2J ${rlo}txt.exe${ls}\nnext\tcol` }, { type: "tool_use", name: `mcp__chio__x${esc}]52;c;`, input: { p: `${csi}` } }] } }));
  for (const bad of [esc, csi, rlo, ls]) assert.ok(!line.includes(bad), `leaked U+${bad.charCodeAt(0).toString(16)}`);
  assert.ok(line.includes("\nnext\tcol"));
  assert.equal(transcriptLine("null"), undefined); assert.equal(transcriptLine("7"), undefined);
  assert.equal(transcriptLine(JSON.stringify({ type: "assistant", message: { content: [null, { type: "text", text: "kept" }] } })), "kept");
  const result = state => transcriptLine(JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", is_error: state !== "completed", content: [{ type: "text", text: JSON.stringify({ state }) }] }] } }));
  assert.equal(result("completed"), "  ← verified result");
  assert.equal(result("awaiting_approval"), "  ← awaiting operator approval");
  assert.equal(result("not_dispatched"), "  ← not dispatched");
  assert.equal(result(`odd${esc}`), `  ← odd�`);
});

test("-- ends options so a task may start with dashes", () => {
  assert.deepEqual(parse(["--a", "1", "--", "--fix it", "--a"], ["--a"]).positional, ["--fix it", "--a"]);
});

test("demo attach opens Claude against the newest live demo with the control environment", t => {
  const h = home(t);
  const bin = join(h.dir, "fakebin"); mkdirSync(bin);
  writeFileSync(join(bin, "claude"), '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$OUT_DIR/args.txt"\nprintf \'%s\\n\' "$CHIO_CONTROL_URL" "$CHIO_CONTROL_TOKEN" "$CLAUDE_CODE_ENABLE_FUNCTION_HOOKS" > "$OUT_DIR/env.txt"\n'); chmodSync(join(bin, "claude"), 0o755);
  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  const demo = (name, pid) => { const dir = join(h.dir, "demos", name); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "attach.json"), JSON.stringify({ pid, sessionId: `session-${name}`, mcpConfig: join(dir, "mcp.json"), controlUrl: `http://127.0.0.1:1/${name}`, controlToken: `token-${name}` })); };
  const env = { PATH: bin, HOME: h.dir, CHIO_CLAUDE_HOME: h.dir, OUT_DIR: h.dir };
  const none = spawnSync(process.execPath, [cli, "demo", "attach"], { env, encoding: "utf8" });
  assert.equal(none.status, 64); assert.match(none.stderr, /No demo is running/);
  demo("1-old", process.pid); demo("2-live", process.pid); demo("3-dead", dead);
  const attached = spawnSync(process.execPath, [cli, "demo", "attach"], { env, encoding: "utf8" });
  assert.equal(attached.status, 0, attached.stderr);
  assert.match(attached.stderr, /2 demos are running; attaching to the newest/);
  const args = readFileSync(join(h.dir, "args.txt"), "utf8").trim().split("\n");
  assert.deepEqual(args.slice(2), ["--mcp-config", join(h.dir, "demos/2-live/mcp.json"), "--session-id", "session-2-live"]);
  assert.deepEqual(readFileSync(join(h.dir, "env.txt"), "utf8").trim().split("\n"), ["http://127.0.0.1:1/2-live", "token-2-live", "1"]);
  const mismatched = spawnSync(process.execPath, [cli, "demo", "attach"], { env: { ...env, CHIO_CLAUDE_HOST: join(bin, "claude") }, encoding: "utf8" });
  assert.equal(mismatched.status, 64); assert.match(mismatched.stderr, /CHIO_CLAUDE_HOST is not Claude Code/);
});

test("demo rejects option-like directories and prints help", t => {
  const h = home(t);
  const help = spawnSync(process.execPath, [cli, "demo", "--help"], { env: { ...process.env, CHIO_CLAUDE_HOME: h.dir }, encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /chio-claude demo attach/);
  assert.equal(spawnSync(process.execPath, [cli, "demo", "-x"], { env: { ...process.env, CHIO_CLAUDE_HOME: h.dir }, encoding: "utf8" }).status, 64);
  assert.equal(existsSync(join(process.cwd(), "--help")), false);
});

test("prepare refuses a request that is not private, saying how to fix it", t => {
  const h = home(t);
  const env = { ...process.env, CHIO_CLAUDE_HOME: join(h.dir, "fresh") };
  const request = join(h.dir, "request.json"); writeFileSync(request, "{}\n", { mode: 0o644 }); chmodSync(request, 0o644);
  const open = spawnSync(process.execPath, [cli, "prepare", request], { env, encoding: "utf8" });
  assert.equal(open.status, 64); assert.match(open.stderr, /chmod 600/);
  const link = join(h.dir, "link.json"); symlinkSync(request, link);
  assert.match(spawnSync(process.execPath, [cli, "prepare", link], { env, encoding: "utf8" }).stderr, /regular file, not a link/);
  assert.equal(existsSync(join(h.dir, "fresh", "gateway.json")), false);
});

test("control passes the default prepared session unless one is given", t => {
  const h = home(t); rmSync(join(h.dir, "gateway.json"));
  const env = { ...process.env, CHIO_CLAUDE_HOME: h.dir };
  assert.ok(spawnSync(process.execPath, [cli, "control", "status"], { env, encoding: "utf8" }).stderr.includes(join(h.dir, "gateway.json")));
  const explicit = join(h.dir, "elsewhere.json");
  assert.ok(spawnSync(process.execPath, [cli, "control", "status", "--gateway-config", explicit], { env, encoding: "utf8" }).stderr.includes(explicit));
});
