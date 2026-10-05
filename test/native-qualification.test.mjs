import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { verifyNativeQualification } from "../scripts/verify-native-qualification.mjs";

const source = fileURLToPath(new URL("../", import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "chio-publication-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pkg = JSON.parse(readFileSync(join(source, "package.json")));
  for (const path of ["package.json", "README.md", "LICENSE", ...pkg.files.filter(path => !path.startsWith("acceptance/"))]) {
    mkdirSync(dirname(join(root, path)), { recursive: true }); cpSync(join(source, path), join(root, path), { recursive: true });
  }
  // Only this disposable fixture claims live gates, to exercise artifact checks.
  const record = JSON.parse(readFileSync(join(source, "acceptance/2026-10-05/rc5/ACCEPTANCE.json")));
  record.productionQualified = true;
  for (const gate of Object.values(record.gates)) { gate.qualified = true; gate.evidenceClass = "live"; }
  record.artifacts = {};
  function retain(path) {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const child = path ? path + "/" + entry.name : entry.name;
      if (child.startsWith("scripts/acceptance") || child === "scripts/test-mods.mjs") continue;
      if (entry.isDirectory()) retain(child);
      else record.artifacts[child] = createHash("sha256").update(readFileSync(join(root, child))).digest("hex");
    }
  }
  retain("");
  const path = join(root, "acceptance/2026-10-05/rc5/ACCEPTANCE.json");
  mkdirSync(dirname(path), { recursive: true });
  const save = () => writeFileSync(path, JSON.stringify(record)); save();
  return { root, record, save };
}
test("publication rejects changed executable files outside the former partial allowlist", t => {
  const f = fixture(t); verifyNativeQualification(f.root);
  writeFileSync(join(f.root, "scripts/host-supervisor.mjs"), "// altered host custody\n");
  assert.throws(() => verifyNativeQualification(f.root), /artifact changed/);
});
test("publication rejects newly delivered runtime code without matching qualification", t => {
  const f = fixture(t); verifyNativeQualification(f.root);
  writeFileSync(join(f.root, "scripts/added-effect-route.mjs"), "// newly delivered code\n");
  assert.throws(() => verifyNativeQualification(f.root), /artifact changed|unrecorded/);
});
test("the actual candidate remains blocked by its unqualified live gates", () => {
  assert.throws(() => verifyNativeQualification(source), /lacks live production qualification/);
});
