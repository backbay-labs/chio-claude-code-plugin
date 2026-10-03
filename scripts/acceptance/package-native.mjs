#!/usr/bin/env node
// Offline consumer plus a marketplace-style tree with no node_modules.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const artifact = resolve(process.argv[2]); const evidence = resolve(process.argv[3]);
if (!process.env.CHIO_CLAUDE_HOST || !process.argv[2] || !process.argv[3]) throw new Error("usage: CHIO_CLAUDE_HOST=PINNED node package-native.mjs ARTIFACT NEW_EVIDENCE_DIR");
mkdirSync(evidence, { mode: 0o700 });
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const expected = readFileSync(`${artifact}.sha256`, "utf8").split(/\s+/)[0]; assert.equal(hash(artifact), expected);
const runtime = mkdtempSync(join(tmpdir(), "chio-cold-consumer-")); const cache = join(runtime, "empty-cache");
mkdirSync(cache); writeFileSync(join(runtime, "package.json"), '{"private":true}\n');
function run(command, args, cwd = runtime, env = process.env, expectedCode = 0) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 60_000 });
  if (result.status !== expectedCode) throw new Error(`${command} failed (${result.status}): ${result.stdout}\n${result.stderr}`);
  return { stdout: result.stdout, stderr: result.stderr, code: result.status };
}
const installation = run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", cache, artifact]);
writeFileSync(join(evidence, "install.txt"), installation.stdout + installation.stderr);
const installed = join(runtime, "node_modules/@chio/claude-code-plugin"); const pkg = JSON.parse(readFileSync(join(installed, "package.json")));
assert.equal(pkg.version, "0.4.0-rc.2"); assert.equal(pkg.scripts, undefined);
for (const version of Object.values(pkg.dependencies ?? {})) assert.equal(/^(file:|link:|workspace:)/.test(version), false);
await import(pathToFileURL(join(installed, pkg.main)).href);
for (const path of ["dist/control/service.js", "scripts/control.mjs", "scripts/restricted.mjs", "scripts/mod-profile.mjs", "scripts/fetch-host.mjs", "scripts/task.mjs", "scripts/control-transport.mjs", "dist/workflow/tasks.js", "dist/workflow/handoff.js", "dist/workflow/prepare.js"]) run(process.execPath, ["--check", join(installed, path)]);
for (const path of ["hooks/native/register.ts", "hooks/native/projection.ts", "types/control.d.ts", "types/host/PROVENANCE.json", "docs/host-contract.json", "docs/NATIVE-MODS.md", "docs/CONTROLLED-TASKS.md", "hooks/native/workflow.ts", "types/workflow.d.ts", "types/chio.d.ts"]) assert.equal(existsSync(join(installed, path)), true);
const pin = JSON.parse(readFileSync(join(installed, "docs/host-contract.json"))); assert.equal(hash(process.env.CHIO_CLAUDE_HOST), pin.platforms[`${process.platform}-${process.arch}`].checksum);
const clone = join(runtime, "marketplace-tree"); mkdirSync(join(clone, ".claude-plugin"), { recursive: true });
cpSync(join(installed, ".claude-plugin/plugin.json"), join(clone, ".claude-plugin/plugin.json"));
for (const path of ["hooks", "commands", "scripts", "dist", "types", "docs", "package.json"]) cpSync(join(installed, path), join(clone, path), { recursive: true });
assert.equal(existsSync(join(clone, "node_modules")), false); await import(pathToFileURL(join(clone, "dist/index.js")).href);
for (const [module, method] of [["tasks", "collectRequirement"], ["handoff", "verifyHandoff"], ["store", "privateSave"]]) {
  assert.equal(typeof (await import(pathToFileURL(join(clone, "dist/workflow/" + module + ".js")).href))[method], "function");
}
const catalog = join(runtime, "operator-catalog.json");
writeFileSync(catalog, readFileSync(join(installed, "examples/controlled-task/catalog.example.json")), { mode: 0o600, flag: "wx" });
const templates = run(process.execPath, [join(clone, "scripts/task.mjs"), "list", "--catalog", catalog], clone);
assert.equal(JSON.parse(templates.stdout).templates[0].id, "preview");
writeFileSync(join(evidence, "task-catalog.txt"), templates.stdout);
const control = await import(pathToFileURL(join(clone, "dist/control/service.js")).href); assert.equal(typeof control.startControlServer, "function");
const env = { PATH: process.env.PATH, LANG: "en_US.UTF-8", HOME: runtime, CLAUDE_CONFIG_DIR: join(runtime, "claude-profile"), CHIO_HOME: join(runtime, "chio-state"), CHIO_KEYSTORE_DIR: join(runtime, "keystore"),
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: "1", DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", ANTHROPIC_API_KEY: "unused-control-command-fixture" };
const validation = run(process.env.CHIO_CLAUDE_HOST, ["plugin", "validate", clone, "--strict"], clone, env); writeFileSync(join(evidence, "validation.txt"), validation.stdout + validation.stderr);
const command = run(process.env.CHIO_CLAUDE_HOST, ["--print", "/chio-status", "--plugin-dir", clone, "--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--setting-sources", "", "--no-session-persistence", "--no-chrome"], clone, env, 1);
assert.match(command.stdout, /Chio · disconnected · protection scope unavailable/); writeFileSync(join(evidence, "status-command.txt"), command.stdout + command.stderr);
const summary = { schema: "chio.claude.native-package-check.v1", passed: true, artifactSha256: hash(artifact), version: pkg.version,
  classification: "offline install and disconnected native command; no kernel resource qualification", dependencyFreeMarketplaceRuntime: true, pinnedHostVersion: pin.version, statusCommandExitCode: command.code, runtime };
writeFileSync(join(evidence, "SUMMARY.json"), JSON.stringify(summary, null, 2) + "\n"); process.stdout.write(JSON.stringify(summary) + "\n");
