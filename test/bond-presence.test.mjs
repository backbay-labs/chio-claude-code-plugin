import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const store = fileURLToPath(new URL("../dist/state/store.js", import.meta.url));

// paths.js reads CHIO_STATE_DIR at import, so each case runs in its own process.
function presence(t, contents, sessionId = "session-a") {
  const dir = mkdtempSync(join(tmpdir(), "chio-presence-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (contents !== undefined) writeFileSync(join(dir, "state.json"), contents);
  const script = `const { bondPresence } = await import(${JSON.stringify(store)}); process.stdout.write(bondPresence(${JSON.stringify(sessionId)}));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, CHIO_STATE_DIR: dir }, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
test("missing state or missing entry is absent", t => {
  assert.equal(presence(t, undefined), "absent");
  assert.equal(presence(t, JSON.stringify({ bonds: { other: { sessionId: "other" } } })), "absent");
  assert.equal(presence(t, "{}"), "absent");
});
test("an entry for the exact session is present", t => {
  assert.equal(presence(t, JSON.stringify({ bonds: { "session-a": { sessionId: "session-a" } } })), "present");
});
test("unreadable or malformed state is invalid", t => {
  assert.equal(presence(t, ""), "invalid");
  assert.equal(presence(t, "{\"bonds\":"), "invalid");
  assert.equal(presence(t, JSON.stringify({ bonds: [] })), "invalid");
  assert.equal(presence(t, JSON.stringify([])), "invalid");
});
test("a tombstoned entry is revoked", t => {
  assert.equal(presence(t, JSON.stringify({ bonds: { "session-a": { sessionId: "session-a", revokedAt: "2026-10-04T00:00:00.000Z" } } })), "revoked");
  assert.equal(presence(t, JSON.stringify({ bonds: { "session-a": { sessionId: "session-a", revokedAt: 1 } } })), "invalid");
});

test("malformed revocation markers cannot disagree with command bond selection", t => {
  for (const revokedAt of [null, false, 0, true, {}, []]) {
    assert.equal(presence(t, JSON.stringify({ bonds: { "session-a": { sessionId: "session-a", revokedAt } } })), "invalid");
  }
  assert.equal(presence(t, JSON.stringify({ bonds: { "session-a": { sessionId: "session-a", revokedAt: "" } } })), "revoked");
});
