#!/usr/bin/env node
// Exercise the real pinned loader and event harness in an isolated plugin root.
import { cpSync, mkdtempSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pin = JSON.parse(readFileSync(join(root, "docs/host-contract.json"), "utf8"));
const host = process.env.CHIO_CLAUDE_HOST;
if (!host) throw new Error("set CHIO_CLAUDE_HOST to the pinned Claude Code binary");
const checksum = pin.platforms[`${process.platform}-${process.arch}`]?.checksum;
if (!checksum || createHash("sha256").update(readFileSync(host)).digest("hex") !== checksum) throw new Error("Claude host does not match the selected contract");
const stage = mkdtempSync(join(tmpdir(), "chio-mod-tests-"));
try {
  mkdirSync(join(stage, ".claude-plugin"));
  cpSync(join(root, ".claude-plugin/plugin.json"), join(stage, ".claude-plugin/plugin.json"));
  for (const name of ["hooks", "commands", "types", "tests"]) cpSync(join(root, name), join(stage, name), { recursive: true });
  const env = { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: "1", CLAUDE_CONFIG_DIR: join(stage, "profile") };
  for (const args of [["plugin", "validate", stage, "--strict"], ["plugin", "test", stage], ["plugin", "test", join(root, "docs/research/mods-contract-probe")]]) {
    const result = spawnSync(host, args, { env, cwd: stage, encoding: "utf8", timeout: 60_000 });
    process.stdout.write(result.stdout ?? ""); process.stderr.write(result.stderr ?? "");
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
} finally { rmSync(stage, { recursive: true, force: true }); }
