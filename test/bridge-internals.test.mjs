// Unexported bridge modules may be reached only through the per-module seams
// src/bridge-internals/{approval,execution,gateway-operator,gateway}.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const REVIEWED_ARCHIVE = "file:vendor/chio-bridge-0.3.0-7d9e34f7408a.tgz";
const SEAM_DIR = "src/bridge-internals/";
const SYMBOLS = {
  "gateway.js": ["createGateway", "gatewayApprovalPath", "gatewayBinding", "gatewayToolResult", "operationKey", "privatePath"],
  "gateway-operator.js": ["gatewayStatus"],
  "approval.js": ["verifyApprovalToolCall"],
  "execution.js": ["createMcpExecutionClient"],
};
const MIGRATE = "bridge changed: point src/bridge-internals/* at the bridge's ./gateway, ./gateway-operator, ./approval and ./execution exports, then update this pin";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : /\.(m?js|ts)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}
test("only the seam reaches unexported bridge modules", () => {
  const offenders = ["src", "scripts", "hooks"].flatMap(dir => files(join(root, dir))).map(file => relative(root, file))
    .filter(path => !path.startsWith("scripts/acceptance/") && !path.startsWith(SEAM_DIR) && path !== "scripts/bundle.mjs")
    .filter(path => readFileSync(join(root, path), "utf8").includes("@chio/bridge/dist"));
  assert.deepEqual(offenders, []);
});
test("the seam is pinned to the reviewed bridge archive and its symbols exist", async () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(pkg.dependencies["@chio/bridge"], REVIEWED_ARCHIVE, MIGRATE);
  assert.equal(lock.packages["node_modules/@chio/bridge"].resolved, REVIEWED_ARCHIVE, MIGRATE);
  for (const [file, names] of Object.entries(SYMBOLS)) {
    const seamPath = `${SEAM_DIR}${file.replace(".js", ".ts")}`;
    const seam = readFileSync(join(root, seamPath), "utf8");
    const mod = await import(join(root, "node_modules/@chio/bridge/dist", file));
    for (const name of names) {
      assert.equal(typeof mod[name], "function", `${MIGRATE} (${file} ${name})`);
      assert.match(seam, new RegExp(`\\b${name}\\b[^;]*dist/${file.replace(".", "\\.")}`), `${seamPath} must re-export ${name} from ${file}`);
    }
  }
});
test("vendor ships only archives the lockfile resolves", () => {
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  const resolved = new Set(Object.values(lock.packages).map(p => p.resolved).filter(r => typeof r === "string" && r.startsWith("file:vendor/")).map(r => r.slice("file:".length)));
  for (const name of readdirSync(join(root, "vendor"))) assert.ok(resolved.has(`vendor/${name}`), `unreferenced vendored archive vendor/${name}`);
});
