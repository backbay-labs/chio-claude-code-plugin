import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NATIVE_MOD_VERSION } from "../scripts/mod-profile.mjs";

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

test("package, lockfile, plugin manifest and native mod share one version", () => {
  const pkg = read("package.json");
  const lock = read("package-lock.json");
  const plugin = read(".claude-plugin/plugin.json");
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.equal(plugin.version, pkg.version);
  assert.equal(NATIVE_MOD_VERSION, pkg.version);
});
