import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTask, projectTask, collectRequirement, readTask, readCatalog } from "../dist/workflow/tasks.js";
import { privateSave, mutate } from "../dist/workflow/store.js";

export function taskTemplate(requirements) {
  return { id: "fix", title: "Fix regression", serverId: "resource-a", expectedCapabilityId: "cap-a", allowedTools: ["write_file"], ttlSeconds: 600,
    approval: { requiredTools: ["write_file"], purpose: "Exact write", ttlSeconds: 300 },
    scope: { resources: ["Disposable protected repository"], destinations: [], restrictions: ["No release"], source: "operator_template", budget: "unavailable" }, requirements };
}
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "chio-tasks-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const checkout = join(root, "checkout"); mkdirSync(checkout);
  const git = (...args) => execFileSync("/usr/bin/git", ["-C", checkout, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "task"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(checkout, "file.txt"), "original"); git("add", "file.txt"); git("commit", "-m", "fixture");
  const path = join(root, "task.json");
  const local = { id: "local", title: "Local checks", collector: { kind: "command", cwd: checkout, argv: [process.execPath, "-e", "process.exit(0)"], timeoutMs: 2000 } };
  const value = { sessionId: "session-a", binding: "b".repeat(64), title: "Fix regression", goal: "Prove the selected artifact", artifact: { kind: "git_commit", digest: git("rev-parse", "HEAD"), label: "fixture commit" }, checkout, template: taskTemplate([local]) };
  return { root, path, checkout, git, value, local };
}
test("local completion observes the exact clean artifact and becomes stale after edits", async t => {
  const f = fixture(t); createTask(f.path, f.value);
  assert.equal((await projectTask(readTask(f.path))).readiness, "outstanding");
  const result = await collectRequirement(f.path, "local"); assert.equal(result.readiness, "ready"); assert.equal(result.requirements[0].evidenceClass, "trusted_collector_observation");
  writeFileSync(join(f.checkout, "file.txt"), "changed");
  assert.equal((await projectTask(readTask(f.path))).requirements[0].state, "stale");
  await assert.rejects(collectRequirement(f.path, "local"), /artifact changed|dirty/);
  assert.throws(() => readTask(f.path, "foreign-session", f.value.binding), /foreign/);
});
test("artifact changes during collection cannot produce readiness", async t => {
  const f = fixture(t); f.local.collector.argv = [process.execPath, "-e", "require('node:fs').writeFileSync('file.txt','changed during check')"];
  createTask(f.path, f.value);
  await assert.rejects(collectRequirement(f.path, "local"), /changed during collection/);
  assert.equal(readTask(f.path).observations.length, 0);
});
test("failed checks remain failed and a newer commit does not inherit passing evidence", async t => {
  const f = fixture(t); f.local.collector.argv = [process.execPath, "-e", "process.exit(1)"];
  createTask(f.path, f.value); assert.equal((await collectRequirement(f.path, "local")).readiness, "failed");
  writeFileSync(join(f.checkout, "file.txt"), "new commit"); f.git("add", "file.txt"); f.git("commit", "-m", "new fixture artifact");
  mutate(f.path, task => ({ ...task, artifact: { ...task.artifact, digest: f.git("rev-parse", "HEAD") } }));
  const result = await projectTask(readTask(f.path)); assert.equal(result.readiness, "outstanding"); assert.equal(result.requirements[0].state, "stale");
});
test("hosted observations require the exact artifact and distinguish running, failed and passed", async t => {
  const f = fixture(t); let reported = { commit: "foreign", state: "passed" };
  const source = createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(reported)); });
  await new Promise(resolve => source.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { source.close(resolve); source.closeAllConnections(); }));
  f.value.template = taskTemplate([{ id: "hosted", title: "Hosted CI", collector: { kind: "json", url: "http://127.0.0.1:" + source.address().port + "/commits/{artifact}", artifactPointer: "/commit", statePointer: "/state", passedValue: "passed", failedValues: ["failed"] } }]);
  createTask(f.path, f.value); await assert.rejects(collectRequirement(f.path, "hosted"), /another artifact/);
  assert.equal(readTask(f.path).observations.length, 0);
  for (const state of ["running", "failed", "passed"]) {
    reported = { commit: f.value.artifact.digest, state }; const result = await collectRequirement(f.path, "hosted");
    assert.equal(result.requirements[0].state, state); assert.equal(result.readiness, state === "passed" ? "ready" : state === "failed" ? "failed" : "outstanding");
  }
});
test("catalog refuses native process authority and non-private records", t => {
  const f = fixture(t); const path = join(f.root, "catalog.json");
  privateSave(path, { schema: "chio.task.catalog.v1", templates: [f.value.template] }, true);
  assert.equal(readCatalog(path)[0].id, "fix");
  f.value.template.approval.requiredTools = ["Bash"];
  privateSave(path, { schema: "chio.task.catalog.v1", templates: [f.value.template] });
  assert.throws(() => readCatalog(path), /invalid operator task template/);
});
