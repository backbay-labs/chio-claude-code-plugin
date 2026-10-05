#!/usr/bin/env node
// Qualify the README's install and quickstart against a packed archive: one global npm install,
// then chio-claude --version, --help and a demo that starts, prints its attach command and stops.
// The archive replaces the registry name; everything else is the documented command.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [archiveArgument, cacheArgument] = process.argv.slice(2);
if (!archiveArgument || process.argv.length > 4) throw new Error("usage: documented-install.mjs ARCHIVE.tgz [EMPTY_CACHE_DIR]");
const archive = realpathSync(archiveArgument);
const scratch = mkdtempSync(join(tmpdir(), "chio-documented-install-"));
const prefix = join(scratch, "prefix"), cache = cacheArgument ? resolve(cacheArgument) : join(scratch, "cache"), home = join(scratch, "chio-home");
const fail = message => { throw new Error(`documented install: ${message}`); };
let stopDemo = () => {};
try {
  const install = spawnSync("npm", ["install", "--global", "--prefix", prefix, "--offline", "--no-audit", "--no-fund", "--cache", cache, archive], { encoding: "utf8", timeout: 300_000 });
  if (install.status !== 0) fail(`npm install --global failed: ${install.stderr}`);
  const lib = join(prefix, "lib", "node_modules");
  const [scope] = readdirSync(lib).filter(name => name.startsWith("@"));
  const [name] = scope ? readdirSync(join(lib, scope)) : [];
  const root = scope && name ? join(lib, scope, name) : fail("no scoped package installed");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (process.env.PACKAGE_NAME && pkg.name !== process.env.PACKAGE_NAME) fail(`installed ${pkg.name}, expected ${process.env.PACKAGE_NAME}`);
  const bin = join(prefix, "bin", "chio-claude");
  if (!existsSync(bin)) fail("chio-claude is not on the global bin path");
  const target = relative(realpathSync(root), realpathSync(bin));
  if (target.startsWith("..") || isAbsolute(target)) fail("chio-claude resolves outside the installed package");
  const env = { ...process.env, CHIO_CLAUDE_HOME: home, PATH: `${join(prefix, "bin")}:${process.env.PATH}` };
  const version = spawnSync("chio-claude", ["--version"], { env, encoding: "utf8" });
  if (version.status !== 0 || version.stdout.trim() !== pkg.version) fail(`--version printed ${JSON.stringify(version.stdout)} for ${pkg.version}`);
  const help = spawnSync("chio-claude", ["--help"], { env, encoding: "utf8" });
  if (help.status !== 0 || !help.stdout.includes("chio-claude demo") || !help.stdout.includes("chio-claude run")) fail("--help is incomplete");
  // run, host and demo attach read their default pins from the installed package's candidate record.
  const { pins } = await import(pathToFileURL(join(root, "cli/chio-claude.mjs")).href);
  const installedPins = pins({ packageRoot: root, platform: "darwin", arch: "arm64" });
  if (!Object.values(installedPins).slice(1).every(pin => /^[0-9a-f]{64}$/.test(pin ?? ""))) fail(`installed pins are incomplete: ${JSON.stringify(installedPins)}`);
  // An empty private request reaches the bundled bridge, which refuses it: the installed CLI resolves its dependency.
  const request = join(scratch, "empty-request.json"); writeFileSync(request, "{}\n", { mode: 0o600 });
  const prepare = spawnSync("chio-claude", ["prepare", request], { env, encoding: "utf8" });
  if (prepare.status !== 1 || !prepare.stderr.includes("Gateway preparation failed") || existsSync(join(home, "gateway.json"))) fail(`prepare did not reach the bundled bridge: ${prepare.stderr}`);
  // Its own process group, so every exit path stops the demo under the CLI as well.
  const demo = spawn("chio-claude", ["demo"], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const stop = signal => { try { process.kill(-demo.pid, signal); } catch {} };
  stopDemo = () => stop("SIGKILL");
  let out = "", err = "";
  demo.stdout.on("data", data => { out += data; }); demo.stderr.on("data", data => { err += data; });
  const closed = new Promise(done => demo.once("close", code => done(code)));
  const deadline = Date.now() + 30_000;
  while (!out.includes("Stop the demo with Ctrl+C.") && Date.now() < deadline && demo.exitCode === null) await new Promise(done => setTimeout(done, 100));
  if (!out.includes("chio-claude demo attach") || !out.includes("nothing is protected")) fail(`demo did not start: ${out}${err}`);
  const [demoName] = readdirSync(join(home, "demos"));
  const attach = join(home, "demos", demoName, "attach.json");
  if (!existsSync(attach)) fail("demo did not write attach.json");
  demo.kill("SIGTERM");
  const stopped = await Promise.race([closed.then(() => true), new Promise(done => setTimeout(() => done(false), 15_000))]);
  if (!stopped) fail("demo did not stop within 15 s of SIGTERM");
  if (existsSync(attach)) fail("demo left attach.json after stopping");
  console.log(JSON.stringify({ package: pkg.name, version: pkg.version, command: `npm install -g ${pkg.name}`, archive, bin: "chio-claude", pins: "resolved from the installed record", prepare: "reached the bundled bridge", demo: "started and stopped" }));
} finally {
  stopDemo();
  rmSync(scratch, { recursive: true, force: true });
}
