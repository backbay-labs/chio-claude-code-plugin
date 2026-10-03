import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { nativeModIdentity, stageNativeMod } from "../scripts/mod-profile.mjs";
import { makeModArguments } from "../scripts/restricted.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
test("protected native profile contains pinned mod files and omits executable compatibility hooks", t => {
  const dir = mkdtempSync(join(tmpdir(), "chio-mod-profile-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sha256 = nativeModIdentity(root); const staged = stageNativeMod(root, join(dir, "mod"), sha256);
  assert.equal(staged.sha256, sha256); assert.deepEqual(JSON.parse(readFileSync(join(staged.root, "hooks/hooks.json"))), { modules: ["./native/register.ts"] });
  assert.throws(() => stageNativeMod(root, join(dir, "substituted"), "0".repeat(64)), /selected pin/);
  const file = join(staged.root, "hooks/native/register.ts");
  assert.throws(() => writeFileSync(file, "modified"), /EACCES/);
  chmodSync(file, 0o600); writeFileSync(file, "modified"); assert.notEqual(nativeModIdentity(staged.root), sha256);
});
test("interactive arguments activate the native profile while keeping a bounded MCP-only tool contract", () => {
  const args = makeModArguments({ settingsPath: "/private/settings", mcpPath: "/private/mcp", model: "model", sessionId: "session", pluginPath: "/private/mod" });
  assert.equal(args.includes("--bare"), false); assert.equal(args.includes("--disable-slash-commands"), false); assert.equal(args.includes("--print"), false);
  assert.equal(args[args.indexOf("--tools") + 1], ""); assert.equal(args[args.indexOf("--plugin-dir") + 1], "/private/mod");
  assert.equal(args[args.indexOf("--setting-sources") + 1], ""); assert.equal(args[args.indexOf("--allowedTools") + 1], "mcp__chio__*");
  assert.equal(args.includes("--strict-mcp-config"), true);
  assert.equal(args.includes("--no-session-persistence"), false);
  const headless = makeModArguments({ settingsPath: "/private/settings", mcpPath: "/private/mcp", model: "model", sessionId: "session", pluginPath: "/private/mod", headless: true });
  assert.equal(headless.includes("--print"), true); assert.equal(headless.includes("--no-session-persistence"), true);
});
