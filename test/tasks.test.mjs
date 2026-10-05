import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync, rmSync, mkdirSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTask, projectTask, collectRequirement, readTask, readCatalog, githubState } from "../dist/workflow/tasks.js";
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
test("a collector that exits zero after its deadline cannot pass a completion requirement", async t => {
  const f = fixture(t);
  f.local.collector.argv = [process.execPath, "-e", "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)"];
  f.local.collector.timeoutMs = 300;
  createTask(f.path, f.value);
  await assert.rejects(collectRequirement(f.path, "local"), /deadline|timed out/);
  assert.equal(readTask(f.path).observations.length, 0);
  assert.equal((await projectTask(readTask(f.path))).readiness, "outstanding");
});
test("a collector deadline also stops descendants retaining its output pipes", { timeout: 5000 }, async t => {
  const f = fixture(t);
  const descendant = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";
  f.local.collector.argv = [process.execPath, "-e", "process.on('SIGTERM',()=>process.exit(0));require('node:child_process').spawn(process.execPath,['-e'," + JSON.stringify(descendant) + "],{stdio:['ignore',1,2]});setInterval(()=>{},1000)"];
  f.local.collector.timeoutMs = 300;
  createTask(f.path, f.value);
  await assert.rejects(collectRequirement(f.path, "local"), /deadline/);
  assert.equal(readTask(f.path).observations.length, 0);
});
test("a collector deadline stops descendants even after its output pipes close", { timeout: 5000 }, async t => {
  const f = fixture(t); const pidPath = join(f.root, "descendant.pid"), latePath = join(f.root, "late-effect");
  let descendantPid;
  const descendant = "process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(" + JSON.stringify(pidPath) + ",String(process.pid));setTimeout(()=>require('node:fs').writeFileSync(" + JSON.stringify(latePath) + ",'survived deadline'),1100);setInterval(()=>{},1000)";
  t.after(() => { if (descendantPid) { try { process.kill(descendantPid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; } } });
  f.local.collector.argv = [process.execPath, "-e", "process.on('SIGTERM',()=>process.exit(0));require('node:child_process').spawn(process.execPath,['-e'," + JSON.stringify(descendant) + "],{stdio:'ignore'});setInterval(()=>{},1000)"];
  f.local.collector.timeoutMs = 400; createTask(f.path, f.value);
  await assert.rejects(collectRequirement(f.path, "local"), /deadline/);
  assert.equal(existsSync(pidPath), true, "descendant initialized before the deadline");
  descendantPid = Number(readFileSync(pidPath, "utf8"));
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal(existsSync(latePath), false, "timed-out descendant must not continue after the parent closes its pipes");
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
test("task templates reject invalid identities, empty review sets and reserved gateway tools before provisioning", t => {
  const f = fixture(t); const path = join(f.root, "catalog.json");
  for (const change of [
    template => { template.id = 42; },
    template => { template.serverId = null; },
    template => { template.allowedTools = [null]; },
    template => { template.approval.requiredTools = []; },
    template => { template.allowedTools.push("chio_resume"); },
  ]) {
    const template = structuredClone(f.value.template); change(template);
    privateSave(path, { schema: "chio.task.catalog.v1", templates: [template] });
    assert.throws(() => readCatalog(path), /invalid operator task template/);
  }
});

function githubSource(t, respond) {
  const seen = [];
  const server = createServer((req, res) => { seen.push({ url: req.url, auth: req.headers.authorization, accept: req.headers.accept, agent: req.headers["user-agent"] }); const [code, body] = respond(req.url); res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => { t.after(() => new Promise(done => { server.close(done); server.closeAllConnections(); })); resolve({ base: `http://127.0.0.1:${server.address().port}`, seen }); }));
}
const run = (name, sha, status, conclusion) => ({ id: name.length, name, head_sha: sha, status, conclusion });
test("GitHub checks bind every run to the exact commit and distinguish running, failed and passed", async t => {
  const f = fixture(t); const sha = f.value.artifact.digest; let runs = [];
  const source = await githubSource(t, () => [200, { total_count: runs.length, check_runs: runs }]);
  f.value.template = taskTemplate([{ id: "ci", title: "GitHub CI", collector: { kind: "github", repository: "owner/name", checks: ["build", "test"], apiBase: source.base } }]);
  createTask(f.path, f.value);
  runs = [run("build", sha, "completed", "success")];
  assert.equal((await collectRequirement(f.path, "ci")).requirements[0].state, "running");
  runs = [run("build", sha, "completed", "success"), run("test", sha, "in_progress", null)];
  assert.equal((await collectRequirement(f.path, "ci")).requirements[0].state, "running");
  runs = [run("build", sha, "completed", "success"), run("test", sha, "completed", "failure")];
  assert.equal((await collectRequirement(f.path, "ci")).requirements[0].state, "failed");
  runs = [run("build", sha, "completed", "success"), run("test", sha, "completed", "success"), run("lint", sha, "completed", "failure")];
  const passed = await collectRequirement(f.path, "ci");
  assert.equal(passed.requirements[0].state, "passed"); assert.equal(passed.readiness, "ready");
  assert.match(passed.requirements[0].source, /^github check-runs · owner\/name · 2 checks · /);
  assert.equal(source.seen.at(-1).url, `/repos/owner/name/commits/${sha}/check-runs?per_page=100`);
  assert.equal(source.seen.at(-1).accept, "application/vnd.github+json"); assert.ok(source.seen.at(-1).agent);
});
test("GitHub evidence for another commit or too many runs is refused and records nothing", async t => {
  const f = fixture(t); const sha = f.value.artifact.digest; let body;
  const source = await githubSource(t, () => [200, body]);
  f.value.template = taskTemplate([{ id: "ci", title: "GitHub CI", collector: { kind: "github", repository: "owner/name", apiBase: source.base } }]);
  createTask(f.path, f.value);
  body = { total_count: 1, check_runs: [run("build", "0".repeat(40), "completed", "success")] };
  await assert.rejects(collectRequirement(f.path, "ci"), /another artifact/);
  body = { total_count: 101, check_runs: [] };
  await assert.rejects(collectRequirement(f.path, "ci"), /name the required checks/);
  assert.equal(readTask(f.path).observations.length, 0);
});
test("GitHub checks without named checks pass only when every run succeeded, was neutral or skipped, and one succeeded", () => {
  const sha = "a".repeat(40);
  assert.equal(githubState({ total_count: 0, check_runs: [] }, sha).state, "running");
  assert.equal(githubState({ total_count: 2, check_runs: [run("a", sha, "completed", "skipped"), run("b", sha, "completed", "neutral")] }, sha).state, "failed");
  assert.equal(githubState({ total_count: 2, check_runs: [run("a", sha, "completed", "success"), run("b", sha, "completed", "skipped")] }, sha).state, "passed");
  assert.equal(githubState({ total_count: 1, check_runs: [run("a", sha, "completed", "timed_out")] }, sha).state, "failed");
  assert.equal(githubState({ total_count: 1, check_runs: [run("build", sha, "completed", "neutral")] }, sha, ["build"]).state, "failed");
});
test("a GitHub token is sent as a bearer header from a private file and never stored", async t => {
  const f = fixture(t); const sha = f.value.artifact.digest;
  const source = await githubSource(t, () => [200, { total_count: 1, check_runs: [run("build", sha, "completed", "success")] }]);
  const tokenFile = join(f.root, "github-token.json"); writeFileSync(tokenFile, JSON.stringify({ token: "ghs_fixture_secret" }), { mode: 0o600 });
  f.value.template = taskTemplate([{ id: "ci", title: "GitHub CI", collector: { kind: "github", repository: "owner/name", tokenFile, apiBase: source.base } }]);
  createTask(f.path, f.value); await collectRequirement(f.path, "ci");
  assert.equal(source.seen.at(-1).auth, "Bearer ghs_fixture_secret");
  assert.equal(readFileSync(f.path, "utf8").includes("ghs_fixture_secret"), false);
  writeFileSync(tokenFile, JSON.stringify({ token: "ghs_fixture_secret" }), { mode: 0o644 }); chmodSync(tokenFile, 0o644);
  await assert.rejects(collectRequirement(f.path, "ci"));
});
test("GitHub evidence requires a git commit artifact and a valid collector", async t => {
  const f = fixture(t);
  for (const collector of [{ kind: "github", repository: "not a repo" }, { kind: "github", repository: "o/r", apiBase: "http://example.com" }, { kind: "github", repository: "o/r", checks: [] }, { kind: "github", repository: "o/r", tokenFile: "relative.json" }]) {
    assert.throws(() => createTask(join(f.root, `bad-${Math.random()}.json`), { ...f.value, template: taskTemplate([{ id: "ci", title: "CI", collector }]) }), /invalid GitHub collector/);
  }
  const value = { ...f.value, checkout: undefined, artifact: { kind: "sha256", digest: "b".repeat(64), label: "blob" }, template: taskTemplate([{ id: "ci", title: "CI", collector: { kind: "github", repository: "o/r" } }]) };
  const path = join(f.root, "sha-task.json"); createTask(path, value);
  await assert.rejects(collectRequirement(path, "ci"), /git commit artifact/);
});
