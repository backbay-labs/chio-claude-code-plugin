# Native candidate correctness fixes

Date: 2026-10-04. Sub-project 1 of the 2026-10-04 progress review, which
follows the [2026-10-03 opportunity addendum](../../research/2026-10-03-claude-code-mods-feature-opportunities.md). Branch `fix/claude-native-correctness-20261004`, stacked on PR #3
(`feat/claude-native-mods-20261002`, 0.4.0-rc.4). PR #3 itself stays frozen for
qualification.

## Goal

Remove defects that a user or maintainer hits today without changing the
kernel, gateway or launcher authority contracts:

1. An ordinary session with the plugin installed denies every tool until
   `/chio:bond` runs.
2. `/chio:budget-set` and `/chio:guard-pause` cannot succeed.
3. Runtime and control code import `@chio/bridge` modules that the package does
   not export.
4. Small native-module defects: duplicated origin validation, a review request
   path that bypasses the namespace's checks, identical review and evidence
   handlers, and an unbounded operation list in the pane.
5. Repository housekeeping.

Success: every item below has a regression test or a recorded check, the
existing 88 Node, 21 native harness and 4 middleware tests still pass, and no
change alters what the protected native profile stages or what the kernel
admits.

Out of scope: moving acceptance evidence (deferred), version bump and
requalification (the publication guard keeps refusing because
`productionQualified` is false), kernel attenuation support.

## F1. Compatibility hook gate

Observed: `hooks/hooks.json` registers the compatibility `PreToolUse` and
`PostToolUse` command hooks with matcher `*` beside the native module. Without
a bond for the exact session, `hooks/pretooluse.mjs` denies every tool,
including `Read`. Each call also imports the bundled bridge before discovering
there is no bond. `PostToolUse` writes an "evidence unresolved" line for every
unbonded call.

Design: add a plugin option and resolve it before importing the bridge.

```json
"compatibility_hooks": {
  "type": "string",
  "title": "Compatibility hooks",
  "description": "bonded: check only sessions bonded with /chio:bond. always: deny unbonded sessions. off: no compatibility checks.",
  "options": ["bonded", "always", "off"],
  "default": "bonded",
  "sensitive": false
}
```

The hooks read `CLAUDE_PLUGIN_OPTION_COMPATIBILITY_HOOKS`. Unset means
`bonded`.

| Mode | Bond for exact session | `PreToolUse` | `PostToolUse` |
| --- | --- | --- | --- |
| `off` | any | exit 0, no output | exit 0, no output |
| `bonded` | absent | exit 0, no output | exit 0, no output |
| `bonded` | present | existing checks | existing checks |
| `bonded` | state unreadable or malformed | deny | stderr notice |
| `always` | any | existing checks (absent denies) | existing checks |
| invalid value | any | deny naming the option | stderr notice |

Malformed hook input (missing session, tool, tool use id or object input)
still denies in every mode except `off`.

`src/state/store.ts` gains `bondPresence(sessionId): "absent" | "present" |
"invalid"`:

- `absent`: the state file does not exist, or it has no entry for the session.
- `invalid`: the file cannot be read or parsed, or `bonds` is not an object.
- `present`: an entry exists. The enforcement path still validates it (exact
  session, expiry, policy path), so a foreign or expired entry keeps denying.

`readState()` keeps its current lenient behavior for commands.

If the pinned host's `claude plugin validate --strict` rejects `options` or
`default` on a string field, keep a plain string field and document the three
values; the hook's unset-means-`bonded` rule already covers the default.

Fast path: the hook parses input, resolves the mode and calls `bondPresence`
through `dist/state/store.js` only. It imports `dist/state/bridge.js` only
when it will enforce.

Security note: this weakens nothing the documentation claims. The compatibility
hooks are documented as an authorization precheck, not an execution boundary;
host hook crashes, timeouts and omissions already fail open. `always`
preserves the previous fail-closed behavior for operators who want it. The
protected native profile does not load these hooks (`scripts/mod-profile.mjs`
stages only the native module), and the print profile disables all hooks.

Docs: `docs/RESTRICTED-MODE.md#compatibility-hooks`, the README compatibility
section and the ordinary-session section of `docs/NATIVE-MODS.md` describe the
option.

Tests (`test/pretooluse.test.mjs`): existing enforcement tests run with a
present bond and are unchanged. New cases: `bonded`+absent and `off` produce no
output for both hooks and never import the bridge stub (the stub throws on
import); `always`+absent denies; invalid option denies; malformed state denies;
malformed input still denies in `bonded`.

## F2. Remove commands that cannot succeed

`/chio:budget-set` and `/chio:guard-pause` call `bridge.attenuate`, which the
vendored bridge refuses with `unsupported_authority_operation`
(`capabilities.js` refuses administrative issue-then-revoke as unsound). The
kernel sidecar's attenuation route returns 403 without a subject signer, and
the trust plane has no attenuation route.

Remove `commands/{budget-set,guard-pause}.md`,
`scripts/{budget-set,guard-pause}.mjs`, `src/commands/{budget-set,guard-pause}.ts`
and their exports from `src/index.ts`; rebuild `dist/`. Keep
`SessionBond.budgetCapUsd` and `pausedGuards` as legacy fields so existing
state still parses, and keep `PreToolUse`'s budget handling for bonds created
with `/chio:bond POLICY TTL BUDGET`, which issues a new capability and does not
attenuate. Record the removal and the kernel prerequisite (a parent-bound
attenuation endpoint) in `docs/RESTRICTED-MODE.md`.

Test: a regression asserts neither command file, runner script nor export
exists, so a future revert is deliberate.

## F3. Bridge internals seam and contract

The plugin deep-imports `node_modules/@chio/bridge/dist/{gateway,gateway-operator,approval,execution}.js`
from `src/control/service.ts`, `src/workflow/{control,outcome,store}.ts` and
`scripts/gateway-http.mjs`; `scripts/bundle.mjs` also uses bridge `dist` files
as bundle entry points. The bridge only exports `.`, `./errors`, `./types` and
`./doctor`.

Plugin changes:

- `src/bridge-internals.ts` is the one seam for unexported bridge modules. The
  four TypeScript files import from it. `scripts/gateway-http.mjs` imports it
  too (it only runs bundled; esbuild resolves the `.ts` import).
  `createMcpExecutionClient` comes from the public root export.
- `test/bridge-internals.test.mjs` scans `src/`, `scripts/` (excluding
  `scripts/acceptance/`) and `hooks/` for `@chio/bridge/dist` references and
  fails on any reference outside the seam and `scripts/bundle.mjs`. It checks
  the lockfile resolves `@chio/bridge` to the reviewed archive name and that
  every module and symbol the seam re-exports exists in the installed bridge.
  A bridge bump therefore fails with an explicit "migrate to the bridge's
  subpath exports" message.
- Remove the three vendored bridge archives the lockfile does not use
  (`b7785282b4f4`, `c22c8dd094e3`, `ed680ff9d987`). They ship in the npm package
  because `files` includes `vendor`. Historical acceptance records keep their
  hashes, and the bytes stay in git history.

Bridge changes (local branch in `chio-bridge`, from `origin/main`, not pushed
by this sub-project): add `./gateway`, `./gateway-operator`, `./approval` and
`./execution` subpath exports with types, plus a test that resolves each
subpath by package self-reference and checks the symbols the Claude plugin
uses. Migrating the plugin's seam to those subpaths waits for a bridge release
that includes them; vendoring a rebuilt bridge now would change the runtime
bytes under qualification.

## F4. Native module cleanups

In `hooks/native/register.ts`:

- Replace `endpoint()` with the existing `controlOrigin()` from
  `hooks/native/workflow.ts`.
- `request()` calls `$.chio.requestReview({ kind, revision, requestId })`
  instead of its own fetch. It keeps its result-shape checks (state
  `requested`, matching session, UUID id, `authorityAccepted: false`,
  `dispatchPerformed: false`) and its session-change check. The namespace path
  adds the 64-hex token check and post-fetch session check the hand-rolled
  path lacked.
- `/chio-evidence` opens the selected operation with evidence details
  expanded; `/chio-review` keeps the compact review. `open()` takes a
  `details` flag.
- The operations pane renders actionable operations (`nextAction !== "none"`)
  first, then the rest, at most 12 buttons. When more exist it shows
  `N more retained operations · /chio-evidence REQUEST_ID`.

Tests (`tests/native.test.ts`, pinned host harness): evidence opens expanded;
review stays compact; a non-hex control token cannot post review intent; a
projection with 30 operations renders 12 operation buttons, actionable first,
and the overflow line.

`scripts/mod-profile.mjs` computes the native mod identity from these sources,
so the operator's `--mod-sha256` pin changes. That is expected for any native
source change.

## F5. Housekeeping

- Add `.worktrees/` to `.gitignore`.
- Local only, not committed: remove the clean `release-qualification-20260909`
  worktree (all five commits are patch-equivalent on `main`; the branch is
  kept) and prune worktree entries whose directories no longer exist, in this
  repository and in `chio-bridge`.

## Verification

- `npm run typecheck`, `npm run build` (committed `dist/` regenerated),
  `npm test`, `CHIO_CLAUDE_HOST=<pinned 2.1.287> npm run test:mods` (includes
  `claude plugin validate --strict` of the new option).
- `npm run pack:release` to a scratch directory; the staged package contains no
  removed command or orphaned archive.
- Informational: unbonded `PreToolUse` wall time before and after F1.
- The publication guard still refuses the candidate.
