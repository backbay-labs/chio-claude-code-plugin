#!/usr/bin/env node
// chio-claude: the demo, the pinned host, session preparation and protected runs behind one command.
// Every default is a pin this package already carries; explicit options always win. The restricted
// launcher still checks every pin itself.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANDIDATE_RECORD } from "../scripts/verify-native-qualification.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export class UsageError extends Error {}

export const USAGE = `chio-claude: Claude Code on the Chio kernel

  chio-claude demo [DIR]            Start a local demo: fixture kernel, real gateway, operator watch.
                                    Nothing is protected.
  chio-claude demo attach [DIR]     Open Claude Code against the running demo (second terminal).
  chio-claude host                  Download the pinned Claude Code host, checked by SHA-256.
  chio-claude prepare REQUEST.json  Prepare a kernel session from a private (mode 600) request.
  chio-claude run ["TASK"]          Run one task in restricted mode. With no task, open an
                                    interactive session with the Chio pane. Use - to read stdin.
  chio-claude control ACTION ...    Operator control: status, inbox, watch, report, confirm.

Run options:
  --gateway-config FILE    Prepared session (default: CHIO_HOME/gateway.json)
  --host FILE              Claude Code host (default: CHIO_CLAUDE_HOST if set; otherwise the
                           pinned host from chio-claude host, then a matching claude on PATH)
  --model NAME             Model (default: ${DEFAULT_MODEL}, or CHIO_MODEL)
  --model-auth MODE        claude-login or api-key (default: api-key if ANTHROPIC_API_KEY is set)
  --workspace DIR          Local workspace (default: a new empty directory for each run)
  --model-token-budget N   Stop forwarding model turns after N tokens
  --json                   Print the host's raw stream-json instead of the transcript
  --host-sha256, --gateway-sha256, --mod-sha256 HEX   Replace a recorded pin
  --                       End of options: everything after it is the task

CHIO_HOME is $CHIO_CLAUDE_HOME, or ~/.chio/claude.
`;

const RUN_OPTIONS = ["--gateway-config", "--host", "--model", "--model-auth", "--workspace", "--model-token-budget", "--host-sha256", "--gateway-sha256", "--mod-sha256"];
const OUTCOMES = {
  completed: "completed with verified evidence",
  "awaiting-approval": "waiting for operator approval (chio-claude control watch --operator-file PRIVATE_FILE)",
  unresolved: "an outcome is unresolved and stays fenced. Do not retry it; see recovery in the guide",
  "protected-work-incomplete": "protected work did not complete: denied, not dispatched or a tool error",
  "host-initialization-failed": "Claude did not start with the exact Chio tools",
  "host-failed": "Claude exited with an error",
};
const RESULT_LABELS = { completed: "verified result", awaiting_approval: "awaiting operator approval", denied: "denied", not_dispatched: "not dispatched", unknown: "outcome unknown, fenced", pending: "outcome pending, fenced" };

const json = path => JSON.parse(readFileSync(path, "utf8"));
const sha256 = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };
const shellQuote = value => /^[\w@%+=:,./-]+$/.test(value) ? value : `'${String(value).replaceAll("'", `'\\''`)}'`;
/** Model text is untrusted: control, format and line-separator characters cannot reach the terminal. Newline and tab stay. */
export const safeText = value => String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\p{Cf}\u2028\u2029]/gu, "\uFFFD");
export const chioHome = (env = process.env) => resolve(env.CHIO_CLAUDE_HOME || join(homedir(), ".chio", "claude"));
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").replace(/\..*$/, "") + "-" + randomBytes(3).toString("hex");

/** Named options take one value each, flags none, and `--` ends options; everything else is positional. */
export function parse(args, named, flags = []) {
  const options = {}, positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") { positional.push(...args.slice(i + 1)); break; }
    if (flags.includes(arg)) { options[arg] = true; continue; }
    if (arg.startsWith("--")) {
      if (!named.includes(arg)) throw new UsageError(`unknown option ${arg}`);
      if (Object.hasOwn(options, arg)) throw new UsageError(`${arg} given twice`);
      if (args[i + 1] === undefined) throw new UsageError(`${arg} needs a value`);
      options[arg] = args[++i];
    } else positional.push(arg);
  }
  return { options, positional };
}

/** The pins the package records: the host contract and the current candidate record, which must match this version. */
export function pins({ packageRoot = root, platform = process.platform, arch = process.arch } = {}) {
  const contract = json(join(packageRoot, "docs/host-contract.json"));
  const version = json(join(packageRoot, "package.json")).version;
  let record;
  try { record = json(join(packageRoot, CANDIDATE_RECORD)); } catch { throw new Error(`this package does not include its candidate record ${CANDIDATE_RECORD}`); }
  if (record.version !== version) throw new Error(`candidate record ${CANDIDATE_RECORD} is for ${record.version}, not ${version}; pass the pins explicitly`);
  return { hostVersion: contract.version, host: contract.platforms[`${platform}-${arch}`]?.checksum, gateway: record.gatewaySha256, mod: record.nativeModSha256 };
}

export const pinnedHostPath = (env, version) => join(chioHome(env), "host", `claude-${version}`);

/** The Claude Code host matching the pin: CHIO_CLAUDE_HOST when set (and only it), else the pinned download, then claude on PATH. */
export function findHost({ env = process.env, version, checksum }) {
  if (env.CHIO_CLAUDE_HOST) {
    const host = resolve(env.CHIO_CLAUDE_HOST);
    if (!isFile(host) || sha256(host) !== checksum) throw new UsageError(`CHIO_CLAUDE_HOST is not Claude Code ${version}: ${host}`);
    return host;
  }
  const candidates = [pinnedHostPath(env, version), ...(env.PATH ?? "").split(delimiter).filter(Boolean).map(dir => join(dir, "claude"))];
  for (const candidate of candidates) {
    if (!isFile(candidate)) continue;
    const real = realpathSync(candidate);
    if (sha256(real) === checksum) return real;
  }
  throw new UsageError(`Claude Code ${version} is required. Run: chio-claude host`);
}

/** The exact restricted-launcher invocation for `chio-claude run`, without side effects. */
export function planRun(args, { env = process.env, platform = process.platform, arch = process.arch, terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY), packageRoot = root } = {}) {
  const { options, positional } = parse(args, RUN_OPTIONS, ["--json"]);
  if (platform !== "darwin") throw new UsageError("Protected runs need macOS (sandbox-exec). chio-claude demo runs anywhere.");
  if (positional.length > 1) throw new UsageError('Quote the task as one argument: chio-claude run "TASK"');
  const task = positional[0];
  const mode = task === undefined ? "interactive" : "print";
  if (mode === "interactive" && !terminal) throw new UsageError("With no task, chio-claude run opens an interactive session and needs a terminal. Pass a task, or - to read one from stdin.");
  if (mode === "print" && options["--mod-sha256"]) throw new UsageError("--mod-sha256 applies to the interactive session only");
  if (options["--model-auth"] && !["claude-login", "api-key"].includes(options["--model-auth"])) throw new UsageError("--model-auth must be claude-login or api-key");
  const pin = pins({ packageRoot, platform, arch });
  const gatewayConfig = resolve(options["--gateway-config"] ?? join(chioHome(env), "gateway.json"));
  if (!existsSync(gatewayConfig)) throw new UsageError(`No prepared session at ${gatewayConfig}. Run: chio-claude prepare REQUEST.json`);
  const hostSha256 = options["--host-sha256"] ?? pin.host;
  if (!hostSha256) throw new UsageError(`Claude Code ${pin.hostVersion} has no pin for ${platform}-${arch}`);
  const host = options["--host"] ? resolve(options["--host"]) : findHost({ env, version: pin.hostVersion, checksum: hostSha256 });
  const runDirectory = join(chioHome(env), "runs", stamp());
  const profile = join(runDirectory, "profile");
  const workspace = options["--workspace"] ? resolve(options["--workspace"]) : join(runDirectory, "workspace");
  const launcher = [join(packageRoot, "scripts/restricted.mjs"),
    "--host", host, "--host-sha256", hostSha256,
    "--gateway-sha256", options["--gateway-sha256"] ?? pin.gateway,
    "--gateway-config", gatewayConfig,
    "--profile", profile, "--workspace", workspace,
    "--model", options["--model"] ?? env.CHIO_MODEL ?? DEFAULT_MODEL,
    "--model-auth", options["--model-auth"] ?? (env.ANTHROPIC_API_KEY ? "api-key" : "claude-login"),
    ...(mode === "interactive" ? ["--mode", "interactive", "--mod-sha256", options["--mod-sha256"] ?? pin.mod] : []),
    ...(options["--model-token-budget"] ? ["--model-token-budget", options["--model-token-budget"]] : [])];
  return { launcher, mode, task: task === "-" ? null : task, runDirectory, profile, workspace, createWorkspace: !options["--workspace"], raw: Boolean(options["--json"]) };
}

function resultLabel(part) {
  const text = Array.isArray(part.content) ? part.content.find(item => item && item.type === "text")?.text : part.content;
  let state; try { state = JSON.parse(text)?.state; } catch {}
  if (typeof state === "string") return state === "completed" && part.is_error ? "tool error" : RESULT_LABELS[state] ?? safeText(state);
  return part.is_error ? "tool error" : "result";
}

/** A readable, terminal-safe line for each host stream-json event worth showing; undefined for the rest. */
export function transcriptLine(line) {
  let event; try { event = JSON.parse(line); } catch { return undefined; }
  if (!event || typeof event !== "object" || !event.message || typeof event.message !== "object") return undefined;
  const content = Array.isArray(event.message.content) ? event.message.content.filter(part => part && typeof part === "object") : [];
  if (event.type === "assistant") return content.map(part =>
    part.type === "text" ? safeText(part.text)
      : part.type === "tool_use" ? `  → ${safeText(String(part.name).replace(/^mcp__chio__/, "chio "))} ${safeText(JSON.stringify(part.input ?? {}).slice(0, 160))}`
        : undefined).filter(Boolean).join("\n") || undefined;
  if (event.type === "user") return content.filter(part => part.type === "tool_result").map(part => `  ← ${resultLabel(part)}`).join("\n") || undefined;
  return undefined;
}

/** Run a child Node script, forwarding termination and keeping the terminal for it. */
function runNode(args, { input, env, onStdout } = {}) {
  return new Promise(done => {
    const child = spawn(process.execPath, args, { env: env ?? process.env, stdio: [input === undefined ? "inherit" : "pipe", onStdout ? "pipe" : "inherit", "inherit"] });
    // A launcher that refuses before reading stdin closes the pipe; its exit code and stderr carry the cause.
    if (input !== undefined) { child.stdin.on("error", () => {}); child.stdin.end(input); }
    if (onStdout) {
      let buffer = "";
      child.stdout.setEncoding("utf8").on("data", data => { buffer += data; let end; while ((end = buffer.indexOf("\n")) >= 0) { onStdout(buffer.slice(0, end)); buffer = buffer.slice(end + 1); } });
      child.stdout.on("end", () => { if (buffer) onStdout(buffer); buffer = ""; });
    }
    // A terminal delivers Ctrl+C and hangup to the whole process group, child included; elsewhere
    // forward them. Either way stay alive until the child has written its outcome.
    const onInt = () => { if (!process.stdin.isTTY) child.kill("SIGINT"); }, onHup = () => { if (!process.stdin.isTTY) child.kill("SIGHUP"); }, onTerm = () => child.kill("SIGTERM");
    process.on("SIGINT", onInt); process.on("SIGHUP", onHup); process.on("SIGTERM", onTerm);
    child.once("error", error => { console.error(`chio-claude: ${error.message}`); done(1); });
    child.once("close", (code, signal) => { process.off("SIGINT", onInt); process.off("SIGHUP", onHup); process.off("SIGTERM", onTerm); done(code ?? (signal ? 1 : 0)); });
  });
}

const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; } };
/** Running demos under CHIO_HOME/demos, newest last. A demo that died without cleaning up is skipped. */
function liveDemos(env) {
  const demos = join(chioHome(env), "demos");
  if (!existsSync(demos)) return [];
  return readdirSync(demos).sort().map(name => join(demos, name)).filter(dir => {
    try { const attach = json(join(dir, "attach.json")); return Number.isInteger(attach.pid) && alive(attach.pid); } catch { return false; }
  });
}

async function demo(args, env) {
  if (args[0] === "attach") {
    if (args.length > 2 || args[1]?.startsWith("-")) throw new UsageError("usage: chio-claude demo attach [DIR]");
    let directory = args[1] && resolve(args[1]);
    if (!directory) {
      const running = liveDemos(env);
      if (!running.length) throw new UsageError("No demo is running. Start one with: chio-claude demo");
      directory = running.at(-1);
      if (running.length > 1) console.error(`chio-claude: ${running.length} demos are running; attaching to the newest, ${directory}. Pass DIR to choose another.`);
    }
    const attach = json(join(directory, "attach.json"));
    const pin = pins();
    let host = "claude";
    try { host = findHost({ env, version: pin.hostVersion, checksum: pin.host }); }
    catch (error) {
      if (env.CHIO_CLAUDE_HOST) throw error;
      console.error(`chio-claude: Claude Code ${pin.hostVersion} not found; using claude on PATH. The Chio pane needs ${pin.hostVersion}: run chio-claude host.`);
    }
    return await new Promise(done => {
      const child = spawn(host, ["--plugin-dir", root, "--mcp-config", attach.mcpConfig, "--session-id", attach.sessionId], {
        stdio: "inherit", env: { ...env, CHIO_CONTROL_URL: attach.controlUrl, CHIO_CONTROL_TOKEN: attach.controlToken, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: "1" } });
      child.once("error", error => { console.error(`chio-claude: ${error.message}`); done(1); });
      child.once("close", code => done(code ?? 1));
    });
  }
  if (args[0] === "--help" || args[0] === "-h") { process.stdout.write(USAGE); return 0; }
  if (args.length > 1 || args[0]?.startsWith("-")) throw new UsageError("usage: chio-claude demo [DIR]");
  let directory = args[0] && resolve(args[0]);
  if (!directory) { mkdirSync(join(chioHome(env), "demos"), { recursive: true, mode: 0o700 }); directory = join(chioHome(env), "demos", stamp()); }
  const attach = args[0] ? `chio-claude demo attach ${shellQuote(directory)}` : "chio-claude demo attach";
  return runNode([join(root, "scripts/demo.mjs"), "--directory", directory], { env: { ...env, CHIO_DEMO_ATTACH: attach } });
}

async function host(args, env) {
  if (args.length) throw new UsageError("usage: chio-claude host");
  const pin = pins();
  if (!pin.host) throw new UsageError(`Claude Code ${pin.hostVersion} has no pin for ${process.platform}-${process.arch}`);
  const destination = pinnedHostPath(env, pin.hostVersion);
  if (existsSync(destination)) {
    if (sha256(destination) !== pin.host) throw new UsageError(`${destination} is not the pinned Claude Code ${pin.hostVersion}; remove it and run chio-claude host again`);
    console.log(`Claude Code ${pin.hostVersion} is ready: ${destination}`); return 0;
  }
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  const code = await runNode([join(root, "scripts/fetch-host.mjs"), "--output", destination], { env });
  if (code === 0) console.log(`Claude Code ${pin.hostVersion} is ready: ${destination}`);
  return code;
}

async function prepare(args, env) {
  const { options, positional } = parse(args, ["--output"]);
  if (positional.length !== 1) throw new UsageError("usage: chio-claude prepare REQUEST.json [--output NEW_FILE]");
  const request = resolve(positional[0]);
  let stat; try { stat = lstatSync(request); } catch { throw new UsageError(`No request file at ${request}`); }
  // The bridge refuses anything else without saying why.
  if (!stat.isFile() || stat.isSymbolicLink()) throw new UsageError(`${request} must be a regular file, not a link`);
  if (stat.mode & 0o077) throw new UsageError(`${request} holds operator authority and must be private. Run: chmod 600 ${shellQuote(request)}`);
  const output = resolve(options["--output"] ?? join(chioHome(env), "gateway.json"));
  if (existsSync(output)) throw new UsageError(`A prepared session already exists at ${output}. Pass --output NEW_FILE, or move it aside once its runs are finished.`);
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  const bridge = dirname(createRequire(join(root, "package.json")).resolve("@chio/bridge/package.json"));
  const code = await runNode([join(bridge, "dist/prepare-gateway.js"), request, output], { env });
  if (code === 0) console.log(`Prepared session: ${output}\nNext: chio-claude run "TASK"`);
  return code;
}

export async function run(args, env, { stdout = process.stdout, stderr = process.stderr, ...context } = {}) {
  const plan = planRun(args, { env, ...context });
  mkdirSync(plan.runDirectory, { recursive: true, mode: 0o700 });
  if (plan.createWorkspace) mkdirSync(plan.workspace, { mode: 0o700 });
  stderr.write(`chio-claude · ${plan.mode === "interactive" ? "interactive session" : "task"} · run ${plan.runDirectory}\n`);
  const input = plan.mode === "print" ? (plan.task === null ? readFileSync(0, "utf8") : plan.task + "\n") : undefined;
  const code = await runNode(plan.launcher, { env, input, onStdout: plan.mode === "print" ? line => {
    if (plan.raw) { stdout.write(line + "\n"); return; }
    const text = transcriptLine(line); if (text) stdout.write(text + "\n");
  } : undefined });
  const exit = join(plan.profile, "exit.json");
  let outcome; try { outcome = json(exit).executionOutcome; } catch {}
  stderr.write(outcome
    ? `chio-claude · ${OUTCOMES[outcome] ?? safeText(outcome)}\n  evidence: ${exit}\n`
    : `chio-claude · the launcher stopped before recording an outcome (exit ${code}); its message is above\n`);
  return code;
}

async function control(args, env) {
  if (!args.length) throw new UsageError("usage: chio-claude control status|inbox|watch|report|confirm [options]");
  const withConfig = args.includes("--gateway-config") ? args : [...args, "--gateway-config", join(chioHome(env), "gateway.json")];
  return runNode([join(root, "scripts/control.mjs"), ...withConfig], { env });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const [command, ...args] = argv;
  try {
    if (command === undefined || command === "help" || command === "--help" || command === "-h") { process.stdout.write(USAGE); return 0; }
    if (command === "--version" || command === "-v") { console.log(json(join(root, "package.json")).version); return 0; }
    const commands = { demo, host, prepare, run, control };
    if (!Object.hasOwn(commands, command)) throw new UsageError(`unknown command ${command}`);
    return await commands[command](args, env);
  } catch (error) {
    console.error(`chio-claude: ${error.message}`);
    if (error instanceof UsageError && !error.message.includes("Run:")) console.error("Run chio-claude --help for usage.");
    // 64 (EX_USAGE) keeps a usage mistake apart from the launcher's outcome codes 1-4.
    return error instanceof UsageError ? 64 : 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().then(code => { process.exitCode = code; });
