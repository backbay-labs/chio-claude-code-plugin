import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const store = new URL("../dist/state/store.js", import.meta.url).href;
function run(t, script) {
  const dir = mkdtempSync(join(tmpdir(), "chio-state-write-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `import { writeState } from ${JSON.stringify(store)}; import assert from 'node:assert/strict'; import * as fs from 'node:fs'; const dir=process.env.CHIO_STATE_DIR; ${script}`], { env: { ...process.env, CHIO_STATE_DIR: dir }, encoding: "utf8", timeout: 5000 });
  assert.equal(r.status, 0, r.stderr);
}
test("a failed state replacement cleans its private temporary file", t => run(t, `
  fs.mkdirSync(dir+'/state.json');
  assert.throws(() => writeState({bonds:{}}));
  assert.deepEqual(fs.readdirSync(dir), ['state.json']);
`));
test("state writes do not follow a pre-existing predictable temporary symlink", t => run(t, `
  fs.writeFileSync(dir+'/sentinel', 'keep');
  fs.symlinkSync(dir+'/sentinel', dir+'/state.json.'+process.pid+'.tmp');
  writeState({bonds:{}});
  assert.equal(fs.readFileSync(dir+'/sentinel', 'utf8'), 'keep');
  assert.equal(fs.statSync(dir+'/state.json').mode & 0o777, 0o600);
`));
