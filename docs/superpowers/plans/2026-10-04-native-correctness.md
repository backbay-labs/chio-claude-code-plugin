# Native Candidate Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the defects found in the 2026-10-04 review of the 0.4.0-rc.4 candidate without changing kernel, gateway or launcher authority contracts.

**Architecture:** Compatibility command hooks gain an explicit mode resolved before the bridge loads. Dead attenuation commands are removed. Unexported bridge modules go through one seam guarded by a contract test, with matching subpath exports prepared in a local `chio-bridge` branch. The native module drops duplicated helpers and bounds its pane list.

**Tech Stack:** Node.js 22+ ESM, TypeScript 5.7, esbuild bundles committed in `dist/`, `node:test`, Claude Code 2.1.287 mod test harness (`claude-code/testing`).

**Spec:** `docs/superpowers/specs/2026-10-04-native-correctness-design.md`

## Global Constraints

- Work in `/Users/connor/Medica/backbay/standalone/chio-claude-code-plugin/.worktrees/native-correctness-20261004` on branch `fix/claude-native-correctness-20261004` (Task 4 uses a `chio-bridge` worktree).
- Do not change the package version (`0.4.0-rc.4`), `docs/host-contract.json`, any `acceptance/` file, kernel/gateway authority logic or `scripts/mod-profile.mjs`.
- Any task that changes `src/` or `scripts/gateway-http.mjs` runs `npm run build` and commits the regenerated `dist/**/*.js`.
- Pinned host for native tests: `export CHIO_CLAUDE_HOST=/private/tmp/claude-501/-Users-connor-Medica-backbay-standalone-chio-claude-code-plugin/4a82632e-1483-47a2-8718-eaa293d275f8/scratchpad/host/claude-2.1.287` (SHA-256 `6eab8333fe2121553100d8f40bfada384a3e989b94f947e18ba6677a6fcb41ea`) before any `npm run test:mods` or `plugin validate` command.
- Scratch files go under `/private/tmp/claude-501/-Users-connor-Medica-backbay-standalone-chio-claude-code-plugin/4a82632e-1483-47a2-8718-eaa293d275f8/scratchpad`, not `/tmp`.
- Copy style: short, exact statements. Never say a grant, approval or effect happened unless the code verified it.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Baseline before Task 1: `npm test` 88 pass; `npm run test:mods` 21 native + 4 probe pass.

## Review Focus

1. A hook that exits before reading stdin while Claude still writes the event: every mode must drain stdin first (Task 1 test: `off` mode with a full event exits 0, empty stdout).
2. The 20-second deny timer keeping an early-returning hook alive, which would turn a pass-through into a late deny: pass-through runs must finish well under the fixture's 5-second spawn timeout (Task 1 asserts `status === 0` and empty stdout for every pass-through case).
3. Option values typed by hand with different case or spaces (`Off`, ` bonded`): treated as invalid and denied with a message naming the option (Task 1 test).
4. An empty or truncated `state.json` from an interrupted write: `bondPresence` returns `invalid`, and `bonded` mode denies instead of passing through (Task 1 store test).
5. Exactly 12 retained operations: all 12 buttons and no overflow line (Task 5 test).

---

### Task 1: Compatibility hook mode gate

**Files:**
- Modify: `src/state/store.ts` (add `bondPresence` after `getBond`)
- Modify: `hooks/pretooluse.mjs` (mode resolution and fast path in `main`, final promise handler)
- Modify: `hooks/posttooluse.mjs` (mode resolution in `main`)
- Modify: `.claude-plugin/plugin.json` (`userConfig.compatibility_hooks`)
- Modify: `docs/RESTRICTED-MODE.md` (section `## Compatibility hooks`), `README.md` (section `### Compatibility plugin`), `docs/NATIVE-MODS.md` (section `## Operator service and ordinary sessions`)
- Modify: `test/pretooluse.test.mjs` (fixture stub and new cases)
- Create: `test/bond-presence.test.mjs`
- Regenerate: `dist/state/store.js`, `dist/index.js`

**Interfaces:**
- Produces: `bondPresence(sessionId: string): "absent" | "present" | "invalid"` exported from `src/state/store.ts` and bundled into `dist/state/store.js`.
- Produces: env contract `CLAUDE_PLUGIN_OPTION_COMPATIBILITY_HOOKS` ∈ `bonded` (default when unset or empty) | `always` | `off`.

- [ ] **Step 1: Write the failing store test**

Create `test/bond-presence.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/bond-presence.test.mjs`
Expected: FAIL; `bondPresence` is not a function.

- [ ] **Step 3: Implement `bondPresence`**

In `src/state/store.ts`, after `getBond`:

```ts
/**
 * Compatibility-hook fast path. Separates "no bond" from unreadable state
 * without loading the bridge. The enforcement path still validates a present
 * entry's session, expiry and policy.
 */
export function bondPresence(sessionId: string): "absent" | "present" | "invalid" {
  let raw: string;
  try { raw = readFileSync(STATE_PATH, "utf8"); }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "invalid"; }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return "invalid"; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "invalid";
  const bonds = (parsed as { bonds?: unknown }).bonds;
  if (bonds === undefined) return "absent";
  if (!bonds || typeof bonds !== "object" || Array.isArray(bonds)) return "invalid";
  return Object.hasOwn(bonds, sessionId) ? "present" : "absent";
}
```

Also export it from `src/index.ts` next to `getBond` in the `./state/store.js` export list.

Run: `npm run build && node --test test/bond-presence.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 4: Write the failing hook tests**

In `test/pretooluse.test.mjs`, change the fixture's store stub and bridge stub. Replace the `bridge.js` and `store.js` `writeFileSync` lines in `fixture()` with:

```js
  const verdict = Object.hasOwn(opts, "verdict") ? opts.verdict : { decision: "allow", receipt };
  const bridgeBody = `export function buildBridge() { ${opts.buildThrow ? "throw new Error('build failure');" : ""} return { check: async () => { ${opts.checkThrow ? "throw new Error('connection refused');" : ""} return ${JSON.stringify(verdict)}; }, verifyReceipt: async () => ${opts.verify !== false} }; }`;
  // bridgeImportThrows proves a pass-through never loads the bridge.
  writeFileSync(join(tmp, "dist", "state", "bridge.js"), (opts.bridgeImportThrows ? "throw new Error('bridge imported');\n" : "") + bridgeBody);
  const retained = Object.hasOwn(opts, "bond") ? opts.bond : bond;
  const presence = opts.presence ?? (retained ? "present" : "absent");
  writeFileSync(join(tmp, "dist", "state", "store.js"), `export function getBond(id) { return ${JSON.stringify(retained)}; } export function getSoleBond() { return ${JSON.stringify(bond)}; } export function bondPresence(id) { return ${JSON.stringify(presence)}; }`);
```

Remove `{bond:null}` from the `failure denies` options array, then append these tests at the end of the file:

```js
const mode = value => ({ CLAUDE_PLUGIN_OPTION_COMPATIBILITY_HOOKS: value });
function passed(result) { assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, ""); }
test("bonded mode passes an unbonded session through without loading the bridge", t => {
  for (const env of [{}, mode(""), mode("bonded")]) {
    const f = fixture(t, { bond: null, bridgeImportThrows: true, env });
    passed(f.run()); const post = f.run({ ...input, tool_response: "ok" }, "posttooluse"); passed(post); assert.equal(post.stderr, "");
  }
});
test("off mode drains the event and makes no decision even for a bonded session", t => {
  const f = fixture(t, { bridgeImportThrows: true, env: mode("off") });
  passed(f.run()); passed(f.run({ ...input, tool_response: "ok" }, "posttooluse"));
});
test("always mode keeps denying an unbonded session", t => denied(fixture(t, { bond: null, env: mode("always") }).run(), /no capability bonded/));
test("bonded mode still enforces a bonded session", t => {
  const f = fixture(t, { env: mode("bonded") }); assert.equal(f.run().stdout, ""); assert.equal(readdirSync(join(f.tmp, "pending")).length, 1);
});
for (const value of ["Off", " bonded", "enforce"]) {
  test(`invalid option ${JSON.stringify(value)} denies and names the option`, t => denied(fixture(t, { bond: null, env: mode(value) }).run(), /compatibility_hooks/));
}
test("unreadable bond state denies in bonded mode", t => denied(fixture(t, { bond: null, presence: "invalid", bridgeImportThrows: true }).run(), /bond state is unreadable/));
test("malformed hook input still denies in bonded mode", t => denied(fixture(t, { bond: null }).run({ ...input, session_id: undefined })));
```

- [ ] **Step 5: Run them to verify they fail**

Run: `node --test test/pretooluse.test.mjs`
Expected: FAIL. The bonded pass-through cases deny with `no capability bonded` (or `bridge imported`), and the invalid-option cases do not mention `compatibility_hooks`.

- [ ] **Step 6: Implement the hook modes**

In `hooks/pretooluse.mjs`, add after the `distRoot` line:

```js
const MODES = new Set(["bonded", "always", "off"]);
/** Unset means bonded. Invalid values fail closed with the option named. */
function compatibilityMode() {
  const value = process.env.CLAUDE_PLUGIN_OPTION_COMPATIBILITY_HOOKS || "bonded";
  if (!MODES.has(value)) throw new Error(`invalid compatibility_hooks option ${JSON.stringify(value)}; use bonded, always or off`);
  return value;
}
```

Replace the start of `main()` up to and including the `CHIO_SERVICE_TOKEN` check with:

```js
async function main() {
  // Drain the event first so Claude never writes into a closed pipe.
  const input = JSON.parse(readFileSync(0, "utf8"));
  const mode = compatibilityMode();
  if (mode === "off") return;
  const { session_id, tool_name, tool_input, tool_use_id } = input;
  if (![session_id, tool_name, tool_use_id].every(v => typeof v === "string" && v.length > 0) ||
      !tool_input || typeof tool_input !== "object" || Array.isArray(tool_input)) {
    throw new Error("malformed hook input: session, tool, tool use id and input are required");
  }
  const { bondPresence, getBond } = await import(join(distRoot, "state", "store.js"));
  if (mode === "bonded") {
    const presence = bondPresence(session_id);
    // The compatibility hook is a precheck, not a boundary; sessions without a bond are not checked.
    if (presence === "absent") return;
    if (presence !== "present") throw new Error("compatibility bond state is unreadable; repair it or set compatibility_hooks to off");
  }
  // check() in historical daemon bridge versions dispatches the MCP tool.
  // Calling it before the host dispatch would execute the action twice.
  if (process.env.CHIO_SERVICE_TOKEN || process.env.CLAUDE_PLUGIN_OPTION_SERVICE_TOKEN) {
    throw new Error("daemon check dispatches tools; use the kernel MCP boundary instead of this precheck");
  }
  const { buildBridge } = await import(join(distRoot, "state", "bridge.js"));
  const { PENDING_DIR } = await import(join(distRoot, "state", "paths.js"));
```

Delete the three old `await import(...)` lines for `bridge.js`, `store.js` and `paths.js` that followed the service-token check (the block above replaces them), and keep the rest of `main()` unchanged from `const bond = getBond(session_id);` onward. Replace the last line of the file with:

```js
// Clearing the deadline lets an early pass-through exit instead of denying late.
main().then(() => clearTimeout(timer), error => deny(`chio unavailable: ${error.message ?? error}`));
```

In `hooks/posttooluse.mjs`, replace the beginning of `main()` through the identity check with:

```js
async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const mode = process.env.CLAUDE_PLUGIN_OPTION_COMPATIBILITY_HOOKS || "bonded";
  if (mode === "off") return;
  if (mode !== "bonded" && mode !== "always") throw new Error(`invalid compatibility_hooks option ${JSON.stringify(mode)}`);
  if (![input.session_id, input.tool_use_id, input.tool_name].every(v => typeof v === "string" && v)) {
    throw new Error("missing host event identity");
  }
  if (mode === "bonded") {
    const { bondPresence } = await import(join(distRoot, "state", "store.js"));
    const presence = bondPresence(input.session_id);
    if (presence === "absent") return;
    if (presence !== "present") throw new Error("compatibility bond state is unreadable");
  }
```

Keep everything after that unchanged.

- [ ] **Step 7: Run the hook tests**

Run: `npm run build && node --test test/pretooluse.test.mjs test/bond-presence.test.mjs`
Expected: PASS, including every pre-existing case.

- [ ] **Step 8: Declare the option and document it**

In `.claude-plugin/plugin.json`, add as the first `userConfig` entry:

```json
    "compatibility_hooks": {
      "type": "string",
      "title": "Compatibility hooks",
      "description": "bonded: check only sessions bonded with /chio:bond. always: deny tools in unbonded sessions. off: no compatibility checks. These hooks are a precheck, not an execution boundary.",
      "options": ["bonded", "always", "off"],
      "default": "bonded",
      "sensitive": false
    },
```

Validate: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 CLAUDE_CONFIG_DIR=$(mktemp -d) "$CHIO_CLAUDE_HOST" plugin validate . --strict`
Expected: `Validation passed`. If it rejects `options` or `default`, delete those two keys, re-run, and note it in the commit message (the hook's unset-means-`bonded` rule keeps the default).

In `docs/RESTRICTED-MODE.md`, insert after the code block in `## Compatibility hooks`:

```markdown
The `compatibility_hooks` option selects when these hooks check a tool call.
`bonded` (default) checks only sessions that `/chio:bond` bonded; other sessions
run without a compatibility decision. `always` denies tools in unbonded sessions,
the behavior of 0.4.0-rc.4 and earlier. `off` disables both hooks. Unreadable bond state
denies in `bonded` mode, and an unknown option value denies in every mode except
`off`.
```

In `README.md`, append to the paragraph after the install block in `### Compatibility plugin`:

```markdown
By default the hooks check only sessions bonded with `/chio:bond`; set the plugin's `compatibility_hooks` option to `always` to deny tools in unbonded sessions, or `off` to disable them.
```

In `docs/NATIVE-MODS.md`, append to the paragraph that starts "An ordinary interactive session reports **kernel MCP tools only**.":

```markdown
The compatibility hooks stay inactive in a session that `/chio:bond` has not
bonded, so loading the plugin does not deny native tools; see
[compatibility hooks](./RESTRICTED-MODE.md#compatibility-hooks).
```

- [ ] **Step 9: Full checks and commit**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass (88 previous + new cases).

```bash
git add src/state/store.ts src/index.ts hooks/pretooluse.mjs hooks/posttooluse.mjs .claude-plugin/plugin.json docs/RESTRICTED-MODE.md README.md docs/NATIVE-MODS.md test/pretooluse.test.mjs test/bond-presence.test.mjs dist
git commit -m "fix(hooks): check only bonded sessions unless compatibility_hooks says otherwise

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Remove attenuation commands that cannot succeed

**Files:**
- Delete: `commands/budget-set.md`, `commands/guard-pause.md`, `scripts/budget-set.mjs`, `scripts/guard-pause.mjs`, `src/commands/budget-set.ts`, `src/commands/guard-pause.ts`
- Modify: `src/index.ts` (remove two exports), `src/state/store.ts` (field comments), `docs/RESTRICTED-MODE.md`
- Modify: `test/commands.test.mjs`
- Regenerate: `dist/index.js`

**Interfaces:**
- Consumes: nothing from Task 1 beyond its committed tree.
- Produces: `dist/index.js` without `budgetSet` or `guardPause` exports.

- [ ] **Step 1: Write the failing test**

Append to `test/commands.test.mjs` (add `existsSync` to its `node:fs` import):

```js
test("attenuation commands the bridge refuses are not delivered", async () => {
  for (const path of ["commands/budget-set.md", "commands/guard-pause.md", "scripts/budget-set.mjs", "scripts/guard-pause.mjs", "src/commands/budget-set.ts", "src/commands/guard-pause.ts"]) {
    assert.equal(existsSync(join(root, path)), false, `${path} must stay removed until a parent-bound attenuation endpoint exists`);
  }
  const index = await import(join(root, "dist", "index.js"));
  assert.equal(index.budgetSet, undefined); assert.equal(index.guardPause, undefined);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/commands.test.mjs`
Expected: FAIL on `commands/budget-set.md must stay removed`.

- [ ] **Step 3: Remove the commands**

```bash
git rm -q commands/budget-set.md commands/guard-pause.md scripts/budget-set.mjs scripts/guard-pause.mjs src/commands/budget-set.ts src/commands/guard-pause.ts
```

In `src/index.ts`, delete:

```ts
export { guardPause } from "./commands/guard-pause.js";
export { budgetSet } from "./commands/budget-set.js";
```

In `src/state/store.ts`, replace the two field comments:

```ts
  /** Budget ceiling in USD from `/chio:bond POLICY TTL BUDGET`. */
  budgetCapUsd?: number;
  /** Legacy field from the removed /chio:guard-pause; retained so old state parses. */
  pausedGuards?: Record<string, string>;
```

In `docs/RESTRICTED-MODE.md`, append to `## Compatibility hooks`:

```markdown
`/chio:budget-set` and `/chio:guard-pause` were removed after 0.4.0-rc.4. Both
narrowed an existing capability, which the bridge refuses without a
parent-bound kernel attenuation endpoint; the kernel does not provide one.
Set a budget when bonding with `/chio:bond POLICY TTL BUDGET`, which issues a
new capability instead of attenuating one.
```

- [ ] **Step 4: Rebuild and run tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: PASS, including the new test.

- [ ] **Step 5: Commit**

```bash
git add -A src/index.ts src/state/store.ts docs/RESTRICTED-MODE.md test/commands.test.mjs dist commands scripts src/commands
git commit -m "fix(commands): remove budget-set and guard-pause, which the bridge always refuses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bridge internals seam, contract test and vendor cleanup

**Files:**
- Create: `src/bridge-internals.ts`
- Modify: `src/control/service.ts:8-10`, `src/workflow/control.ts:5`, `src/workflow/outcome.ts:2`, `src/workflow/store.ts:5`, `scripts/gateway-http.mjs:6-7`
- Delete: `vendor/chio-bridge-0.3.0-b7785282b4f4.tgz`, `vendor/chio-bridge-0.3.0-c22c8dd094e3.tgz`, `vendor/chio-bridge-0.3.0-ed680ff9d987.tgz`
- Create: `test/bridge-internals.test.mjs`
- Regenerate: `dist/control/service.js`, `dist/gateway-http.js`, `dist/workflow/*.js`

**Interfaces:**
- Produces: `src/bridge-internals.ts` exporting `createGateway`, `gatewayApprovalPath`, `gatewayBinding`, `gatewayToolResult`, `operationKey`, `privatePath` (from `gateway.js`), `gatewayStatus` (from `gateway-operator.js`), `verifyApprovalToolCall` (from `approval.js`), `createMcpExecutionClient` (from `execution.js`), and types `GatewayConfig`, `GatewayOutcome`, `StoredOperation`.

- [ ] **Step 1: Write the failing contract test**

Create `test/bridge-internals.test.mjs`:

```js
// Unexported bridge modules may be reached only through src/bridge-internals.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const REVIEWED_ARCHIVE = "file:vendor/chio-bridge-0.3.0-7d9e34f7408a.tgz";
const SEAM = "src/bridge-internals.ts";
const SYMBOLS = {
  "gateway.js": ["createGateway", "gatewayApprovalPath", "gatewayBinding", "gatewayToolResult", "operationKey", "privatePath"],
  "gateway-operator.js": ["gatewayStatus"],
  "approval.js": ["verifyApprovalToolCall"],
  "execution.js": ["createMcpExecutionClient"],
};
const MIGRATE = "bridge changed: point src/bridge-internals.ts at the bridge's ./gateway, ./gateway-operator, ./approval and ./execution exports, then update this pin";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : /\.(m?js|ts)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}
test("only the seam reaches unexported bridge modules", () => {
  const offenders = ["src", "scripts", "hooks"].flatMap(dir => files(join(root, dir))).map(file => relative(root, file))
    .filter(path => !path.startsWith("scripts/acceptance/") && path !== SEAM && path !== "scripts/bundle.mjs")
    .filter(path => readFileSync(join(root, path), "utf8").includes("@chio/bridge/dist"));
  assert.deepEqual(offenders, []);
});
test("the seam is pinned to the reviewed bridge archive and its symbols exist", async () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(pkg.dependencies["@chio/bridge"], REVIEWED_ARCHIVE, MIGRATE);
  assert.equal(lock.packages["node_modules/@chio/bridge"].resolved, REVIEWED_ARCHIVE, MIGRATE);
  const seam = readFileSync(join(root, SEAM), "utf8");
  for (const [file, names] of Object.entries(SYMBOLS)) {
    const mod = await import(join(root, "node_modules/@chio/bridge/dist", file));
    for (const name of names) {
      assert.equal(typeof mod[name], "function", `${MIGRATE} (${file} ${name})`);
      assert.match(seam, new RegExp(`\\b${name}\\b[^;]*dist/${file.replace(".", "\\.")}`), `${SEAM} must re-export ${name} from ${file}`);
    }
  }
});
test("vendor ships only archives the lockfile resolves", () => {
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  const resolved = new Set(Object.values(lock.packages).map(p => p.resolved).filter(r => typeof r === "string" && r.startsWith("file:vendor/")).map(r => r.slice("file:".length)));
  for (const name of readdirSync(join(root, "vendor"))) assert.ok(resolved.has(`vendor/${name}`), `unreferenced vendored archive vendor/${name}`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/bridge-internals.test.mjs`
Expected: FAIL. The first test lists `scripts/gateway-http.mjs`, `src/control/service.ts`, `src/workflow/control.ts`, `src/workflow/outcome.ts`, `src/workflow/store.ts`; the third names `vendor/chio-bridge-0.3.0-b7785282b4f4.tgz`.

- [ ] **Step 3: Create the seam and switch imports**

Create `src/bridge-internals.ts`:

```ts
// The one seam for @chio/bridge modules that the vendored 0.3.0 archive does not
// export. test/bridge-internals.test.mjs pins the archive and these names. When a
// bridge release exports ./gateway, ./gateway-operator, ./approval and ./execution,
// point these re-exports at those subpaths and delete the deep paths.
// execution.js stays on its own path so the gateway bundle does not pull the root
// index's policy and passport modules.
export { createGateway, gatewayApprovalPath, gatewayBinding, gatewayToolResult, operationKey, privatePath } from "../node_modules/@chio/bridge/dist/gateway.js";
export type { GatewayConfig, GatewayOutcome, StoredOperation } from "../node_modules/@chio/bridge/dist/gateway.js";
export { gatewayStatus } from "../node_modules/@chio/bridge/dist/gateway-operator.js";
export { verifyApprovalToolCall } from "../node_modules/@chio/bridge/dist/approval.js";
export { createMcpExecutionClient } from "../node_modules/@chio/bridge/dist/execution.js";
```

Replace imports:

- `src/control/service.ts` lines 8-10 →
  ```ts
  import { gatewayApprovalPath, gatewayBinding, gatewayStatus, operationKey, privatePath, verifyApprovalToolCall, type GatewayConfig, type StoredOperation } from "../bridge-internals.js";
  ```
- `src/workflow/control.ts` line 5 → `import type { GatewayConfig, GatewayOutcome, StoredOperation } from "../bridge-internals.js";`
- `src/workflow/outcome.ts` line 2 → `import type { GatewayConfig, StoredOperation } from "../bridge-internals.js";`
- `src/workflow/store.ts` line 5 → `import { privatePath } from "../bridge-internals.js";`
- `scripts/gateway-http.mjs` lines 6-7 →
  ```js
  import { createGateway, createMcpExecutionClient, gatewayToolResult } from "../src/bridge-internals.ts";
  ```

Remove the orphaned archives:

```bash
git rm -q vendor/chio-bridge-0.3.0-b7785282b4f4.tgz vendor/chio-bridge-0.3.0-c22c8dd094e3.tgz vendor/chio-bridge-0.3.0-ed680ff9d987.tgz
```

- [ ] **Step 4: Rebuild and run all tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: PASS. `node --test test/control-transport.test.mjs` exercises the rebuilt `dist/gateway-http.js`.

Check the gateway bundle did not grow: `git diff --stat dist/gateway-http.js` shows only small import-order changes, not thousands of added lines.

- [ ] **Step 5: Commit**

```bash
git add -A src scripts/gateway-http.mjs test/bridge-internals.test.mjs vendor dist
git commit -m "refactor(bridge): route unexported bridge modules through one pinned seam

Remove three vendored bridge archives the lockfile does not resolve.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bridge subpath exports (chio-bridge, local branch)

**Files (repository `/Users/connor/Medica/backbay/standalone/chio-bridge`, worktree `.worktrees/gateway-subpath-exports-20261004`, branch `feat/gateway-subpath-exports-20261004` from `origin/main`):**
- Modify: `package.json` (`exports`)
- Create: `test/subpath-exports.test.ts`
- Modify: `README.md` (export list, if it documents exports)

**Interfaces:**
- Produces: package subpaths `@chio/bridge/gateway`, `@chio/bridge/gateway-operator`, `@chio/bridge/approval`, `@chio/bridge/execution`, each `{ "types": "./dist/<name>.d.ts", "import": "./dist/<name>.js" }`.

- [ ] **Step 1: Create the worktree**

```bash
cd /Users/connor/Medica/backbay/standalone/chio-bridge
git check-ignore -q .worktrees || echo ".worktrees/" >> "$(git rev-parse --git-common-dir)/info/exclude"
git fetch -q origin main
git worktree add .worktrees/gateway-subpath-exports-20261004 -b feat/gateway-subpath-exports-20261004 origin/main
cd .worktrees/gateway-subpath-exports-20261004 && npm ci --ignore-scripts --no-audit --no-fund && npm test
```

Expected: baseline tests pass. If `npm ci` cannot resolve dependencies offline or from the registry, stop and report the error; do not change dependency versions.

- [ ] **Step 2: Write the failing test**

Create `test/subpath-exports.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

// Host integrations (the Claude plugin's control service and gateway) use these
// modules; package exports make them a supported contract instead of deep paths.
const expected: Record<string, string[]> = {
  "@chio/bridge/gateway": ["createGateway", "gatewayApprovalPath", "gatewayBinding", "gatewayToolResult", "operationKey", "privatePath"],
  "@chio/bridge/gateway-operator": ["gatewayStatus"],
  "@chio/bridge/approval": ["verifyApprovalToolCall"],
  "@chio/bridge/execution": ["createMcpExecutionClient"],
};
test("gateway integration subpaths resolve by package name", async () => {
  for (const [specifier, names] of Object.entries(expected)) {
    const mod = await import(specifier);
    for (const name of names) assert.equal(typeof mod[name], "function", `${specifier} ${name}`);
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run build && node --experimental-strip-types --test test/subpath-exports.test.ts`
Expected: FAIL with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

- [ ] **Step 4: Add the exports**

In `package.json` `exports`, before `"./package.json"`:

```json
    "./gateway": { "types": "./dist/gateway.d.ts", "import": "./dist/gateway.js" },
    "./gateway-operator": { "types": "./dist/gateway-operator.d.ts", "import": "./dist/gateway-operator.js" },
    "./approval": { "types": "./dist/approval.d.ts", "import": "./dist/approval.js" },
    "./execution": { "types": "./dist/execution.d.ts", "import": "./dist/execution.js" },
```

If `README.md` lists the package's entry points, add the four subpaths there with one line: "Gateway, operator status, approval verification and execution client used by host integrations."

- [ ] **Step 5: Run tests and commit (do not push)**

Run: `npm run typecheck && npm test`
Expected: PASS.

```bash
git add package.json test/subpath-exports.test.ts README.md
git commit -m "feat: export gateway, operator, approval and execution subpaths

Host integrations import these modules today through dist paths.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Native module cleanups

**Files:**
- Modify: `hooks/native/register.ts` (remove `endpoint()`, rewrite `request()`, `open()` details flag, `/chio-evidence` handler, pane operation list)
- Modify: `tests/native.test.ts`

**Interfaces:**
- Consumes: `controlOrigin` (already imported from `./workflow.ts`), `$.chio.requestReview(input: { kind: ChioIntentKind; revision: string; requestId?: string }): Promise<Record<string, unknown>>`.

- [ ] **Step 1: Write the failing native tests**

Append to `tests/native.test.ts`:

```ts
test("evidence opens the exact operation with evidence and authority details expanded", { options }, async ($, on) => {
  stub(on, () => "session-a", () => projection());
  await $.command.run(command("chio-evidence", "request-a"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ type: "Text", text: "Kernel acknowledgement: unconfirmed" })).toBeDefined();
  expect((await ui.find({ key: "details" }))?.props.label).toBe("Hide evidence and authority details");
  await ui.unmount();
});
function retainedOperations(count: number): ControlStatus {
  const value = projection();
  const completed = Array.from({ length: count - 1 }, (_, i) => ({ requestId: `request-done-${String(i).padStart(2, "0")}`, tool: "read_file", state: "completed" as const,
    evidence: "verified" as const, acknowledged: true, hostDeliveryConfirmed: true, nextAction: "none" as const }));
  value.operations = [...completed, value.operations[0]!];
  return value;
}
test("the pane lists actionable operations first and bounds the list", { options }, async ($, on) => {
  stub(on, () => "session-a", () => retainedOperations(30));
  await $.command.run(command("chio"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(String((await ui.find({ key: "operation-0" }))?.props.label)).toContain("awaiting_approval");
  expect(await ui.find({ key: "operation-11" })).toBeDefined();
  expect(await ui.find({ key: "operation-12" })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: "18 more retained operations" })).toBeDefined();
  await ui.unmount();
});
test("exactly twelve retained operations need no overflow line", { options }, async ($, on) => {
  stub(on, () => "session-a", () => retainedOperations(12));
  await $.command.run(command("chio"));
  const ui = await $.ui.mount({ plugin: "chio", surface: "terminal", component: "Pane", requestId: "chio", props: paneProps });
  expect(await ui.find({ key: "operation-11" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: "more retained operations" })).toBeUndefined();
  await ui.unmount();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:mods`
Expected: the evidence test fails (details collapsed), the bounded-list test fails (`operation-12` exists, first button is a completed operation); existing tests pass.

- [ ] **Step 3: Implement the cleanups**

In `hooks/native/register.ts`:

1. Delete `function endpoint(base: string) { ... }` (lines 18-22). `controlOrigin` is already imported.
2. Add after the module-level `let` declarations: `const PANE_OPERATIONS = 12;`
3. Replace `request()` with:

```ts
async function request($: EngineInterface, options: PluginOptions, kind: IntentKind, operation?: OperationView): Promise<string> {
  const capturedSession = sessionId;
  const capturedRevision = kind === "revoke" ? status?.revision : operation?.review?.revision;
  const current = await refresh($, options);
  const original = operation && current?.operations.find(op => op.requestId === operation.requestId);
  if (!current || current.authority !== "live" || capturedSession !== current.sessionId || !capturedRevision
    || (kind === "revoke" ? current.revision !== capturedRevision : !original?.review || original.review.revision !== capturedRevision || original.review.decision !== "required")) throw new Error("review changed, expired, or disconnected; reopen the current action");
  // The namespace binds the session, checks the scoped token and rejects a session change during the request.
  const result = await $.chio.requestReview({ kind, revision: capturedRevision, ...(operation ? { requestId: operation.requestId } : {}) }) as { intent?: { id?: string; state?: string; sessionId?: string }; authorityAccepted?: boolean; dispatchPerformed?: boolean };
  if (result.intent?.state !== "requested" || result.intent.sessionId !== capturedSession || typeof result.intent.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.intent.id) || result.authorityAccepted !== false || result.dispatchPerformed !== false) throw new Error("unexpected control acknowledgement; authority remains unconfirmed");
  if (await $.session.id() !== capturedSession) throw new Error("session changed while requesting control; inspect the original session");
  notice = `${kind} requested · ${result.intent.id} · trusted operator confirmation required`;
  await refresh($, options);
  return notice;
}
```

4. Change `open()`'s signature and its `showDetails` assignment:

```ts
async function open($: EngineInterface, options: PluginOptions, requestId?: string, details = false): Promise<string> {
```

and replace `showDetails = false;` inside `open()` with `showDetails = details;`.

5. Replace the `chio-evidence` handler's body: `async ($, e) => ({ text: await open($, options, e.args.trim() || undefined, true) })`.

6. In the `Pane` renderer, replace the final `for (const [index, op] of (status?.operations ?? []).entries()) rows.push(...)` statement with:

```ts
    const retained = status?.operations ?? [];
    const ordered = [...retained.filter(op => op.nextAction !== "none"), ...retained.filter(op => op.nextAction === "none")];
    for (const [index, op] of ordered.slice(0, PANE_OPERATIONS).entries()) rows.push(Button({ key: `operation-${index}`, label: `${safeText(op.tool ?? "operation")} · ${op.state} · ${safeText(op.requestId.slice(-12))}`,
      onPress: () => { selectedId = op.requestId; showDetails = false; $.ui.invalidate("ui.render"); } }));
    if (ordered.length > PANE_OPERATIONS) rows.push(Text({ dimColor: true, children: `${ordered.length - PANE_OPERATIONS} more retained operations · /chio-evidence REQUEST_ID` }));
```

- [ ] **Step 4: Run all checks**

Run: `npm run typecheck && npm run test:mods && npm test`
Expected: 24 native tests and 4 probes pass; Node tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/native/register.ts tests/native.test.ts
git commit -m "fix(mods): reuse namespace review requests, expand evidence and bound the pane list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Housekeeping and branch verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore local worktrees**

Append to `.gitignore`:

```
.worktrees/
```

```bash
git add .gitignore
git commit -m "chore: ignore local worktrees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Remove the stale local worktree and prune (local only)**

```bash
cd /Users/connor/Medica/backbay/standalone/chio-claude-code-plugin
test -z "$(git -C .worktrees/release-qualification-20260909 status --porcelain)" && test -z "$(git cherry main codex/release-qualification-20260909 | grep '^+')" && git worktree remove .worktrees/release-qualification-20260909
git worktree prune && git worktree list
git -C /Users/connor/Medica/backbay/standalone/chio-bridge worktree prune && git -C /Users/connor/Medica/backbay/standalone/chio-bridge worktree list
```

Expected: the release-qualification worktree is gone, its branch still exists (`git branch --list codex/release-qualification-20260909`), and no `prunable` entries remain.

- [ ] **Step 3: Package and guard checks**

```bash
cd /Users/connor/Medica/backbay/standalone/chio-claude-code-plugin/.worktrees/native-correctness-20261004
OUT=$(mktemp -d)/release && npm run pack:release -- "$OUT"
tar -tzf "$OUT"/*.tgz | grep -E 'budget-set|guard-pause|b7785282b4f4|c22c8dd094e3|ed680ff9d987' && echo "UNEXPECTED" || echo "removed files absent"
node scripts/verify-native-qualification.mjs; echo "guard exit=$?"
```

Expected: `removed files absent`; the guard prints a refusal and exits 1 (version or live-qualification gate).

- [ ] **Step 4: Measure the unbonded hook (informational)**

```bash
SCRATCH=/private/tmp/claude-501/-Users-connor-Medica-backbay-standalone-chio-claude-code-plugin/4a82632e-1483-47a2-8718-eaa293d275f8/scratchpad
EVENT='{"session_id":"s","tool_name":"Read","tool_input":{"file_path":"/tmp/x"},"tool_use_id":"t"}'
HOME_DIR=$(mktemp -d "$SCRATCH/hook-home.XXXXXX")
bench() { (cd "$1" && time (for i in 1 2 3 4 5 6 7 8 9 10; do echo "$EVENT" | env -i PATH="$PATH" HOME="$HOME_DIR" node hooks/pretooluse.mjs >/dev/null; done)); }
bench "$PWD"
git worktree add -q "$SCRATCH/hook-base" feat/claude-native-mods-20261002 && bench "$SCRATCH/hook-base"; git worktree remove --force "$SCRATCH/hook-base"
```

Expected: the branch run is faster (it never loads the bridge and makes no decision); the base run denies each call. Record both timings for the PR description.
