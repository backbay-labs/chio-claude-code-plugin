# Completion Evidence and Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect GitHub check evidence bound to the exact commit, meter model usage in the protected relay with an optional token budget, and give operators a Markdown session report.

**Architecture:** A `github` collector kind joins the private task catalog and shares one bounded-fetch helper with the JSON collector. The relay parses provider usage from responses as they stream through and enforces an optional budget on new conversation requests; the launcher surfaces totals in `exit.json` and the native status projection. A pure `renderSessionReport` renders projections into Markdown for `control.mjs report`.

**Tech Stack:** Node.js 22+ ESM, TypeScript 5.7, esbuild bundles committed in `dist/`, `node:test`, Claude Code 2.1.287 mod harness.

**Spec:** `docs/superpowers/specs/2026-10-04-observability-design.md`

## Global Constraints

- Work only in `/Users/connor/Medica/backbay/standalone/chio-claude-code-plugin/.worktrees/observability-20261004` on branch `feat/claude-observability-20261004`. Before every commit run `git rev-parse --abbrev-ref HEAD` and confirm it prints `feat/claude-observability-20261004`; otherwise stop (BLOCKED). Never run git in `/Users/connor/Medica/backbay/standalone/chio-claude-code-plugin` itself.
- Do not change the package version (`0.4.0-rc.4`), `docs/host-contract.json`, `scripts/mod-profile.mjs` or anything under `acceptance/`. New native-mod code only in `hooks/native/{register,projection,workflow}.ts`.
- Any change to `src/` runs `npm run build` and commits regenerated `dist/**/*.js` (never `.d.ts`).
- No change creates authority or dispatches an effect. Collectors run only from the operator CLI. Relay metering never alters a forwarded request or response; only the budget may refuse a new conversation request.
- Copy: "relay-metered" for model counts (provider-reported, not billing); tool budget stays "unavailable".
- Secrets (GitHub token, gateway bearer tokens, admin tokens, approval tokens) never appear in task records, projections, reports or logs.
- Native tests: `export CHIO_CLAUDE_HOST=/private/tmp/claude-501/-Users-connor-Medica-backbay-standalone-chio-claude-code-plugin/4a82632e-1483-47a2-8718-eaa293d275f8/scratchpad/host/claude-2.1.287` then `npm run test:mods`. Scratch files under `/private/tmp/claude-501/-Users-connor-Medica-backbay-standalone-chio-claude-code-plugin/4a82632e-1483-47a2-8718-eaa293d275f8/scratchpad`.
- Commit trailer: `Co-Authored-By: <your model name> <noreply@anthropic.com>`, naming the model accurately.
- Baseline: `npm test` 142 pass; `npm run test:mods` 41 native + 4 probe pass.

## Review Focus

1. A GitHub response listing a check run for a different `head_sha` must be refused as another artifact's evidence (Task 1 test).
2. An SSE `message_delta` event split across network chunks must still be counted once (Task 2 test).
3. A response without usage must record `usage: null` and never fail the request (Task 2 test).
4. A budget reached mid-turn refuses only the next conversation request, never an in-flight one, and never count-tokens requests (Task 2 test).
5. The session report must contain no secret from the gateway config (Task 3 test).

---

### Task 1: GitHub checks collector

**Files:**
- Modify: `src/workflow/tasks.ts` (collector type, catalog validation, `boundedJson` helper shared with the JSON collector, `githubState`, collection branch)
- Modify: `test/tasks.test.mjs`
- Modify: `examples/controlled-task/catalog.example.json` (one `github` requirement in the example template)
- Modify: `docs/CONTROLLED-TASKS.md` (`## Observe completion`)
- Regenerate: `dist/workflow/tasks.js` (and any other bundle that includes tasks.ts)

**Interfaces:**
- Produces: collector `{ kind: "github"; repository: string; checks?: string[]; tokenFile?: string; apiBase?: string }`; exported pure `githubState(value: unknown, digest: string, required?: string[]): { state: "running" | "failed" | "passed"; considered: { id: unknown; name: unknown; head_sha: unknown; status: unknown; conclusion: unknown }[] }`.

- [ ] **Step 1: Write the failing tests**

Append to `test/tasks.test.mjs`:

```js
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
```

Add `githubState` to the `../dist/workflow/tasks.js` import and `chmodSync` to the `node:fs` import. If `createTask` does not validate templates (check `src/workflow/tasks.ts`), assert the `invalid GitHub collector` error through whichever exported function validates a template (`readCatalog` on a written catalog file) instead, keeping the four invalid collectors.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run build && node --test test/tasks.test.mjs`
Expected: FAIL — `githubState` is not exported; collection reports `unsupported evidence collector`.

- [ ] **Step 3: Implement**

In `src/workflow/tasks.ts`:

```ts
interface GithubCollector { kind: "github"; repository: string; checks?: string[]; tokenFile?: string; apiBase?: string }
export type Collector = CommandCollector | JsonCollector | GithubCollector;
```

In the template validation loop, before the final `else throw`, add:

```ts
    } else if (c?.kind === "github") {
      let base: URL | undefined;
      try { base = new URL(c.apiBase ?? "https://api.github.com"); } catch { base = undefined; }
      if (!base || typeof c.repository !== "string" || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(c.repository)
        || (base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "127.0.0.1")) || base.username || base.password || base.search || base.hash
        || c.checks !== undefined && (!Array.isArray(c.checks) || !c.checks.length || c.checks.length > 64 || c.checks.some(name => typeof name !== "string" || !name || name.length > 256))
        || c.tokenFile !== undefined && (typeof c.tokenFile !== "string" || resolve(c.tokenFile) !== c.tokenFile)) throw new Error("invalid GitHub collector");
```

Add above `collectRequirement`:

```ts
async function boundedJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("evidence source unavailable");
  const reader = response.body?.getReader(); if (!reader) throw new Error("missing evidence response");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > 1024 * 1024) throw new Error("evidence response exceeds limit"); chunks.push(r.value); }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString());
}
const GITHUB_FAILED = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
/** Check runs bound to one commit. Missing or incomplete runs are running; any failed conclusion fails. */
export function githubState(value: unknown, commit: string, required?: string[]) {
  const v = value as { total_count?: unknown; check_runs?: unknown };
  if (!v || typeof v.total_count !== "number" || !Array.isArray(v.check_runs)) throw new Error("invalid GitHub check-runs response");
  if (v.total_count > 100 || v.check_runs.length !== v.total_count) throw new Error("too many check runs; name the required checks");
  const runs = (v.check_runs as Record<string, unknown>[]).map(r => ({ id: r?.id, name: r?.name, head_sha: r?.head_sha, status: r?.status, conclusion: r?.conclusion }));
  if (runs.some(r => r.head_sha !== commit)) throw new Error("source evidence belongs to another artifact");
  const considered = required ? runs.filter(r => required.includes(String(r.name))) : runs;
  const missing = required ? required.some(name => !runs.some(r => r.name === name)) : !runs.length;
  let state: "running" | "failed" | "passed";
  if (missing || considered.some(r => r.status !== "completed")) state = "running";
  else if (considered.some(r => GITHUB_FAILED.has(String(r.conclusion)))) state = "failed";
  else if (required) state = considered.every(r => r.conclusion === "success") ? "passed" : "failed";
  else state = considered.every(r => ["success", "neutral", "skipped"].includes(String(r.conclusion))) && considered.some(r => r.conclusion === "success") ? "passed" : "failed";
  return { state, considered };
}
```

In `collectRequirement`, replace the JSON branch's inline fetch with `const value = await boundedJson(c.url.replaceAll("{artifact}", task.artifact.digest));` (keep its pointer logic), and make the branch `} else if (c.kind === "json") {`. Add before it:

```ts
  } else if (c.kind === "github") {
    if (task.artifact.kind !== "git_commit") throw new Error("GitHub evidence requires a git commit artifact");
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "chio-claude-code-plugin", "X-GitHub-Api-Version": "2022-11-28" };
    if (c.tokenFile) {
      const token = privateRead<{ token?: unknown }>(c.tokenFile).token;
      if (typeof token !== "string" || !token) throw new Error("invalid GitHub token file");
      headers.Authorization = "Bearer " + token;
    }
    const base = (c.apiBase ?? "https://api.github.com").replace(/\/$/, "");
    const result = githubState(await boundedJson(`${base}/repos/${c.repository}/commits/${task.artifact.digest}/check-runs?per_page=100`, headers), task.artifact.digest, c.checks);
    state = result.state; source = `github check-runs · ${c.repository} · ${result.considered.length} checks · ${digest(result.considered)}`;
```

(If TypeScript narrowing of `c` needs it, order the branches `command`, `github`, then `json`.)

In `examples/controlled-task/catalog.example.json`, replace the `hosted` requirement's collector with:

```json
"collector": { "kind": "github", "repository": "replace-owner/replace-repo", "checks": ["build", "test"], "tokenFile": "/operator/private/github-token.json" }
```

In `docs/CONTROLLED-TASKS.md` `## Observe completion`, after the paragraph about JSON reports, add:

```markdown
A `github` collector reads GitHub check runs for the task's exact commit:
`{ "kind": "github", "repository": "owner/name", "checks": ["build", "test"], "tokenFile": "/operator/private/github-token.json" }`.
Every returned run must name the exact commit. Named checks must each conclude
`success`; without `checks`, every run must conclude `success`, `neutral` or
`skipped` and at least one must succeed. Missing or unfinished runs are
`running`. The optional token file is a private JSON file `{ "token": "..." }`
read only at collection; the token is never stored in the task record. Only
`git_commit` artifacts can use this collector.
```

- [ ] **Step 4: Rebuild and run all checks**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass. The existing JSON-collector tests still pass with the shared helper.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print feat/claude-observability-20261004
git add src/workflow/tasks.ts test/tasks.test.mjs examples/controlled-task/catalog.example.json docs/CONTROLLED-TASKS.md dist
git commit -m "feat(tasks): collect GitHub check runs bound to the exact commit

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 2: Relay model metering and token budget

**Files:**
- Modify: `scripts/model-relay.mjs` (`usageMeter`, totals, budget, `usage()`)
- Modify: `scripts/restricted.mjs` (`--model-token-budget` option; pass budget; control-server `modelUsage`; `exit.json`)
- Modify: `src/control/service.ts` (`ControlOptions.modelUsage`; status projection)
- Modify: `types/control.d.ts`, `types/chio.d.ts` (`ModelUsageView` / `ChioModelUsageView`; optional `modelUsage` on the status)
- Modify: `hooks/native/projection.ts` (`parseStatus` validates `modelUsage`), `hooks/native/register.ts` (`/chio-status` line)
- Modify: `test/model-relay.test.mjs`, `tests/native.test.ts`
- Modify: `docs/NATIVE-MODS.md` (`## Protected native launcher candidate`)
- Regenerate: `dist/control/service.js`

**Interfaces:**
- Produces: `usageMeter(contentType: string | null): { feed(chunk: Uint8Array | string): void; end(): Usage | null }` exported from `scripts/model-relay.mjs`; `startModelRelay({ ..., tokenBudget? })` result gains `usage(): ModelUsageView`; `ModelUsageView = { model: string; requests: number; inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number; budget: number | null; budgetReached: boolean }`.

- [ ] **Step 1: Write the failing tests**

Append to `test/model-relay.test.mjs` (add `usageMeter` to the import):

```js
const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
test("usage is read from streamed and JSON responses without changing them", () => {
  const stream = sse([{ type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 } } }, { type: "content_block_delta", delta: { text: "hi" } }, { type: "message_delta", usage: { output_tokens: 25 } }, { type: "message_stop" }]);
  const meter = usageMeter("text/event-stream; charset=utf-8");
  for (let i = 0; i < stream.length; i += 7) meter.feed(Buffer.from(stream.slice(i, i + 7)));
  assert.deepEqual(meter.end(), { input_tokens: 10, output_tokens: 25, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 });
  const json = usageMeter("application/json"); json.feed(JSON.stringify({ usage: { input_tokens: 5, output_tokens: 6 } }));
  assert.deepEqual(json.end(), { input_tokens: 5, output_tokens: 6, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
  const none = usageMeter("text/event-stream"); none.feed(sse([{ type: "message_stop" }])); assert.equal(none.end(), null);
  const broken = usageMeter("application/json"); broken.feed("{not json"); assert.equal(broken.end(), null);
});
test("the relay meters forwarded conversations and stops new ones at the token budget", async t => {
  let responses = 0;
  const server = createServer(async (req, res) => {
    for await (const chunk of req) void chunk; responses++;
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ usage: { input_tokens: 60, output_tokens: 50 } }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const relay = await startModelRelay({ upstreamBaseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: "upstream-fixture", model, toolNames: [...tools], tokenBudget: 100 });
  t.after(async () => { await relay.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const send = (path = "/v1/messages") => fetch(`http://127.0.0.1:${relay.port}${path}`, { method: "POST", headers: { "x-api-key": relay.token, "Content-Type": "application/json" }, body: JSON.stringify(request([{ role: "user", content: "task" }])) });
  assert.equal((await send()).status, 200);
  assert.deepEqual(relay.usage(), { model, requests: 1, inputTokens: 60, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, budget: 100, budgetReached: true });
  const refused = await send(); assert.equal(refused.status, 403);
  assert.match((await refused.json()).error.message, /token budget reached/);
  assert.equal(responses, 1);
  assert.equal((await send("/v1/messages/count_tokens")).status, 200);
  assert.equal(relay.events.find(e => e.forwarded && e.requestClass === "conversation").usage.input_tokens, 60);
});
```

Append a native test to `tests/native.test.ts`:

```ts
test("status prints relay-metered model usage when the projection carries it", { options }, async ($, on) => {
  const value = projection();
  value.modelUsage = { model: "claude-sonnet-5-5", requests: 3, inputTokens: 1200, outputTokens: 340, cacheCreationInputTokens: 0, cacheReadInputTokens: 800, budget: null, budgetReached: false };
  stub(on, () => "session-a", () => value);
  expect((await $.command.run(command("chio-status"))).text).toContain("Model usage (relay-metered): 3 requests · 1200 in · 340 out tokens");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/model-relay.test.mjs && npm run test:mods`
Expected: FAIL — `usageMeter` not exported; no usage line.

- [ ] **Step 3: Implement**

In `scripts/model-relay.mjs`, add:

```js
const usageKeys=["input_tokens","output_tokens","cache_creation_input_tokens","cache_read_input_tokens"];
/** Provider-reported usage read as response bytes pass through. Never changes the response. */
export function usageMeter(contentType) {
  const streaming=/text\/event-stream/.test(contentType??"");
  const decoder=new TextDecoder();
  let pending="",body="",overflow=false,seen=false;
  const usage=Object.fromEntries(usageKeys.map(key=>[key,0]));
  const take=source=>{ if(!object(source)) return; for(const key of usageKeys) if(Number.isSafeInteger(source[key])&&source[key]>=0){usage[key]=source[key];seen=true;} };
  const line=text=>{ if(!text.startsWith("data:")) return; try { const event=JSON.parse(text.slice(5).trim()); if(event?.type==="message_start") take(event.message?.usage); else if(event?.type==="message_delta") take(event.usage); } catch { /* not usage */ } };
  return {
    feed(chunk){
      const text=typeof chunk==="string"?chunk:decoder.decode(chunk,{stream:true});
      if(streaming){ pending+=text; let end; while((end=pending.indexOf("\n"))>=0){ line(pending.slice(0,end).replace(/\r$/,"")); pending=pending.slice(end+1); } }
      else if(!overflow){ body+=text; if(body.length>8*1024*1024){ overflow=true; body=""; } }
    },
    end(){
      if(streaming){ if(pending) line(pending); }
      else if(!overflow){ try { take(JSON.parse(body)?.usage); } catch { /* no usage */ } }
      return seen?usage:null;
    },
  };
}
```

In `startModelRelay`, accept `tokenBudget` in the options object. Validate: `if (tokenBudget!==undefined && (!Number.isSafeInteger(tokenBudget) || tokenBudget<1)) throw new Error("token budget must be a positive integer");`. Add `const totals={requests:0,input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0};` and `const spent=()=>usageKeys.reduce((sum,key)=>sum+totals[key],0);`.

Immediately after `validateModelRequest(...)` add:

```js
      if (tokenBudget!==undefined && event.requestClass==="conversation" && spent()>=tokenBudget) { const error=new Error("Operator model token budget reached"); error.budget=true; throw error; }
```

Replace the response streaming lines with:

```js
      const meter=target.pathname==="/v1/messages"&&event.requestClass==="conversation"?usageMeter(result.headers.get("content-type")):null;
      response.writeHead(result.status,{"content-type":result.headers.get("content-type")??"application/json"});
      if(result.body) for await(const data of result.body){ response.write(data); meter?.feed(data); }
      response.end();
      if(meter){ event.model=body.model; event.usage=meter.end(); totals.requests++; if(event.usage) for(const key of usageKeys) totals[key]+=event.usage[key]; }
```

In the `catch`, use the budget message when set: `message: error.budget ? "Operator model token budget reached" : "Operator model relay refused or failed"`.

Return `usage(){ return { model, requests: totals.requests, inputTokens: totals.input_tokens, outputTokens: totals.output_tokens, cacheCreationInputTokens: totals.cache_creation_input_tokens, cacheReadInputTokens: totals.cache_read_input_tokens, budget: tokenBudget ?? null, budgetReached: tokenBudget !== undefined && spent() >= tokenBudget }; }` alongside `port`, `token`, `events`, `fixture`, `close`.

`types/control.d.ts`: add

```ts
export interface ModelUsageView { model: string; requests: number; inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number; budget: number | null; budgetReached: boolean }
```

and `modelUsage?: ModelUsageView;` in `ControlStatus`. Mirror in `types/chio.d.ts` as `ChioModelUsageView` and `modelUsage?: ChioModelUsageView;` in `ChioControlStatus`.

`src/control/service.ts`: `ControlOptions` gains `/** Relay-metered model usage for protected launches. Provider-reported counts, not billing. */ modelUsage?: () => ModelUsageView;` (import the type). In the `GET .../status` reply add `...(pinned.modelUsage ? { modelUsage: pinned.modelUsage() } : {})`.

`scripts/restricted.mjs`: add `"--model-token-budget"` to `optional`; parse `const tokenBudget = opts["--model-token-budget"] === undefined ? undefined : Number(opts["--model-token-budget"]);` and refuse anything but a positive safe integer with `--model-token-budget must be a positive integer`; pass `tokenBudget` into `startModelRelay({...})`; pass `modelUsage: () => relay.usage()` into `startControlServer({...})`; add `modelUsage: relay.usage()` to the `exit.json` object.

`hooks/native/projection.ts` `parseStatus`: after the continuations check add:

```ts
  if (value.modelUsage !== undefined) {
    const u = value.modelUsage;
    if (!u || typeof u.model !== "string" || u.model.length > 128 || [u.requests, u.inputTokens, u.outputTokens, u.cacheCreationInputTokens, u.cacheReadInputTokens].some(n => !Number.isSafeInteger(n) || n < 0)
      || !(u.budget === null || Number.isSafeInteger(u.budget) && u.budget > 0) || typeof u.budgetReached !== "boolean") throw new Error("invalid model usage projection");
  }
```

`hooks/native/register.ts` `/chio-status`: when `current?.modelUsage` exists, append a line:

```ts
`\nModel usage (relay-metered): ${u.requests} requests · ${u.inputTokens} in · ${u.outputTokens} out tokens${u.budget !== null ? ` · budget ${u.budget}${u.budgetReached ? " reached" : ""}` : ""}`
```

`docs/NATIVE-MODS.md`, in `## Protected native launcher candidate`, add:

```markdown
The parent relay records each forwarded conversation's model and
provider-reported token usage in `model-relay.json` and totals in `exit.json`
(`modelUsage`); `/chio-status` shows the totals as "relay-metered". These are
the provider's reported counts, not billing records, and are separate from
kernel tool budgets. `--model-token-budget N` stops new conversation requests
once input, output and cache tokens together reach N; requests already in
flight finish, and token-count requests are not refused.
```

- [ ] **Step 4: Rebuild and run all checks**

Run: `npm run typecheck && npm run build && npm test && npm run test:mods`
Expected: all pass; `git diff --stat dist` shows only `dist/control/service.js`.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print feat/claude-observability-20261004
git add scripts/model-relay.mjs scripts/restricted.mjs src/control/service.ts types/control.d.ts types/chio.d.ts hooks/native/projection.ts hooks/native/register.ts test/model-relay.test.mjs tests/native.test.ts docs/NATIVE-MODS.md dist
git commit -m "feat(relay): meter provider-reported model usage and honor an operator token budget

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 3: Operator session report

**Files:**
- Create: `src/control/report.ts`
- Modify: `src/control/service.ts` (export `renderSessionReport`; add `controlReport(options)`)
- Modify: `scripts/control.mjs` (`report` action with `--output` and optional `--relay-events`)
- Create: `test/report.test.mjs`
- Modify: `docs/NATIVE-MODS.md` (`## Confirm a decision outside Claude`, one paragraph)
- Regenerate: `dist/control/service.js`

**Interfaces:**
- Produces: `renderSessionReport(input: { status: ControlStatus; continuations: ContinuationView[]; generatedAt: number; relayEvents?: unknown }): string` and `controlReport(options: ControlOptions): Promise<{ status: ControlStatus; continuations: ContinuationView[] }>`, both exported from `dist/control/service.js`.

- [ ] **Step 1: Write the failing tests**

Create `test/report.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSessionReport } from "../dist/control/service.js";
const status = { schema: "chio.control.status.v1", sessionId: "host-session-a", checkedAt: 1_000, scope: "isolated_kernel_mcp", authority: "live", authorityExpiresAt: 2_000, protectedTools: ["write_file"],
  revision: "b".repeat(64), awaitingReview: 1, unresolved: 1, fenced: true,
  operations: [
    { requestId: "request-a", tool: "write_file", state: "awaiting_approval", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "review" },
    { requestId: "request-b|pipe", tool: "write_file", state: "completed", evidence: "verified", receiptId: "receipt-b", acknowledged: true, hostDeliveryConfirmed: true, deliveryChannel: "native_control", nextAction: "none" },
    { requestId: "request-c", tool: "write_file", state: "unknown", evidence: "unverified", acknowledged: false, hostDeliveryConfirmed: false, nextAction: "reconcile_original" }],
  intents: [{ id: "12345678-1234-4123-8123-123456789abc", kind: "approve", state: "granted", sessionId: "host-session-a", requestId: "request-b|pipe", expiresAt: 1_500 }],
  workflow: { templates: [], continuation: true, proposals: false, task: { id: "task-a", sessionId: "host-session-a", revision: "e".repeat(64), title: "Fix regression", goal: "Prove the artifact",
    artifact: { kind: "git_commit", digest: "f".repeat(40), label: "fixture" }, readiness: "outstanding",
    requirements: [{ id: "ci", title: "GitHub CI", state: "running", evidenceClass: "trusted_collector_observation", observedAt: 1_200, source: "github check-runs · o/r · 2 checks · abc" }],
    scope: { resources: [], destinations: [], restrictions: [], source: "operator_template", budget: "unavailable" } } } };
const continuations = [{ id: "c1", requestId: "request-b|pipe", state: "completed", delivery: "confirmed", modelContext: "confirmed" }];
test("the report renders every section and escapes table cells", () => {
  const relayEvents = [{ requestClass: "conversation", forwarded: true, model: "claude-sonnet-5-5", usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 2 } }];
  const text = renderSessionReport({ status, continuations, generatedAt: Date.UTC(2026, 9, 4), relayEvents });
  for (const heading of ["# Chio session report", "## Operations", "## Decisions", "## Continuations", "## Task", "## Model usage", "## What this report is"]) assert.ok(text.includes(heading), heading);
  assert.ok(text.includes("request-b\\|pipe")); assert.ok(text.includes("receipt-b")); assert.ok(text.includes("reconcile_original"));
  assert.ok(text.includes("claude-sonnet-5-5")); assert.match(text, /1 request/);
});
test("the report omits model usage without relay events and never prints secrets it was not given", () => {
  const text = renderSessionReport({ status, continuations: [], generatedAt: 0 });
  assert.ok(!text.includes("## Model usage")); assert.ok(!/bearer|adminToken|delegated-not-admin/i.test(text));
});
```

In `test/control.test.mjs`, add a CLI case near the existing `operatorMain(["serve", ...])` test, reusing its way of writing a gateway config file: run `operatorMain(["report", "--gateway-config", configPath, "--output", outPath])`, assert the file exists with mode `0o600`, contains `# Chio session report` and the session id, and does not contain the config's `bearerToken` value; a second run with the same `--output` rejects with `EEXIST`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run build && node --test test/report.test.mjs test/control.test.mjs`
Expected: FAIL — `renderSessionReport` is not exported; `report` is an unknown action.

- [ ] **Step 3: Implement**

Create `src/control/report.ts`:

```ts
import type { ControlStatus } from "../../types/control.js";
import type { ContinuationView } from "../../types/workflow.js";

export interface ReportInput { status: ControlStatus; continuations: ContinuationView[]; generatedAt: number; relayEvents?: unknown }
const clean = (value: unknown) => String(value ?? "").replace(/[\u0000-\u001f\u007f-\u009f  ]/g, " ");
const cell = (value: unknown) => clean(value).replace(/\|/g, "\\|") || "—";
const time = (ms: number) => new Date(ms).toISOString();
function table(headers: string[], rows: unknown[][]): string[] {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.map(cell).join(" | ")} |`)];
}
/** Markdown from authorized projections only. It references receipts by id and verifies nothing. */
export function renderSessionReport({ status, continuations, generatedAt, relayEvents }: ReportInput): string {
  const lines = ["# Chio session report", "",
    `- Session: ${clean(status.sessionId)}`, `- Scope: ${clean(status.scope)}`,
    `- Authority: ${clean(status.authority)} · expires ${time(status.authorityExpiresAt * 1000)}`,
    `- Projection revision: ${clean(status.revision)}`, `- Dispatch fence: ${status.fenced ? "retained" : "clear"}`,
    `- Generated: ${time(generatedAt)}`, "",
    "## Operations", "", ...table(["Request", "Tool", "State", "Evidence", "Next action", "Receipt", "Kernel ACK", "Delivery"],
      status.operations.map(op => [op.requestId, op.tool, op.state, op.evidence, op.nextAction, op.receiptId, op.acknowledged ? "confirmed" : "unconfirmed",
        op.hostDeliveryConfirmed ? op.deliveryChannel ?? "confirmed" : "unconfirmed"])), "",
    "## Decisions", "", ...(status.intents.length ? table(["Intent", "Kind", "State", "Request", "Expires"], status.intents.map(i => [i.id, i.kind, i.state, i.requestId, time(i.expiresAt)])) : ["No review intents retained."]), "",
    "## Continuations", "", ...(continuations.length ? table(["Continuation", "Original request", "State", "Delivery", "Model context"], continuations.map(c => [c.id, c.requestId, c.state, c.delivery, c.modelContext ?? "not confirmed"])) : ["No continuations retained."]), ""];
  const task = status.workflow?.task;
  lines.push("## Task", "");
  if (task) lines.push(`- ${clean(task.title)} · ${clean(task.readiness)}`, `- Artifact: ${clean(task.artifact.kind)} ${clean(task.artifact.digest)} · ${clean(task.artifact.label)}`, "",
    ...table(["Requirement", "State", "Evidence class", "Source", "Observed"], task.requirements.map(r => [r.title, r.state, r.evidenceClass, r.source, r.observedAt ? time(r.observedAt) : undefined])));
  else lines.push("No task contract is bound to this session.");
  lines.push("");
  if (Array.isArray(relayEvents)) {
    const forwarded = relayEvents.filter((e: any) => e?.requestClass === "conversation" && e.forwarded && e.usage);
    const sum = (key: string) => forwarded.reduce((total: number, e: any) => total + (Number.isSafeInteger(e.usage[key]) ? e.usage[key] : 0), 0);
    const models = [...new Set(forwarded.map((e: any) => clean(e.model)))];
    lines.push("## Model usage", "", `- Relay-metered: ${forwarded.length} request${forwarded.length === 1 ? "" : "s"} · ${sum("input_tokens")} in · ${sum("output_tokens")} out · ${sum("cache_read_input_tokens")} cache read · ${sum("cache_creation_input_tokens")} cache write tokens`,
      `- Models: ${models.join(", ") || "—"}`, "- Provider-reported counts, not billing records.", "");
  }
  lines.push("## What this report is", "",
    "Generated from the operator's private journal and the session's authorized projection. Receipts are referenced by id; this report does not verify them. Verify receipts with the kernel's evidence tools. It contains no credentials, approval tokens or raw resource results.", "");
  return lines.join("\n");
}
```

`src/control/service.ts`: `export { renderSessionReport } from "./report.js";` and add:

```ts
/** Operator-side projection for the session report: status plus retained continuations. */
export async function controlReport(options: ControlOptions): Promise<{ status: ControlStatus; continuations: ContinuationView[] }> {
  const status = await controlStatus(options);
  const config = options.config;
  const workflow = createWorkflowControl({ config, binding: hash(gatewayBinding(config)), read: () => records(config), view: record => project(config, record), live: async () => false }, options.workflow);
  try { return { status, continuations: workflow.retained() }; } finally { await workflow.close(); }
}
```

(import `ContinuationView` from `../../types/workflow.js` if not already imported.)

`scripts/control.mjs`: add `"--output"` and `"--relay-events"` to the `allowed` option set; add `"report"` to the action list in the check (operator file still refused for it); import `controlReport` and `renderSessionReport` from `../dist/control/service.js`; and after `const authorityExpiresAt = ...` add:

```js
  if (action === "report") {
    if (!options["--output"]) throw new Error("report requires a new --output file");
    const result = await controlReport({ config, authorityExpiresAt, workflow: prepared.workflow });
    const relayEvents = options["--relay-events"] ? JSON.parse(readFileSync(resolve(options["--relay-events"]), "utf8")) : undefined;
    writeFileSync(resolve(options["--output"]), renderSessionReport({ ...result, generatedAt: Date.now(), relayEvents }), { mode: 0o600, flag: "wx" });
    process.stdout.write(JSON.stringify({ report: resolve(options["--output"]), dispatchPerformed: false }) + "\n");
    return;
  }
```

Update the usage text to include `report --gateway-config CONFIG --output NEW_FILE.md [--relay-events model-relay.json]`. Make sure `--output`/`--relay-events` are refused for other actions (extend the existing action check so they are accepted only with `report`).

`docs/NATIVE-MODS.md`, at the end of `## Confirm a decision outside Claude`:

```markdown
`node scripts/control.mjs report --gateway-config CONFIG --output NEW_FILE.md`
writes a Markdown report of the session: authority, operations, decisions,
continuations, task evidence and, with `--relay-events PROFILE/control/model-relay.json`,
relay-metered model usage. It references receipts by id and does not verify
them, and it never includes credentials or raw resource results.
```

- [ ] **Step 4: Rebuild and run all checks**

Run: `npm run typecheck && npm run build && npm test && npm run test:mods`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print feat/claude-observability-20261004
git add src/control/report.ts src/control/service.ts scripts/control.mjs test/report.test.mjs test/control.test.mjs docs/NATIVE-MODS.md dist
git commit -m "feat(control): write an operator Markdown report of a session

Co-Authored-By: <model> <noreply@anthropic.com>"
```
