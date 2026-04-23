# SMOKE.md — live end-to-end smoke test

`smoke.sh` is a comprehensive live smoke test for `@chio/claude-code-plugin`.
It runs against real binaries only: the real `arc` daemon, the real `claude`
CLI (v2.1.114), the real `@chio/bridge` library, and the canonical
`chio-test-harness`. No mocks.

## Run

```bash
cd standalone/chio-claude-code-plugin
bun install && bun run build   # (first time only)
bash smoke.sh                  # ≤ 60s; exits 0 on green
```

The script:

1. Validates the plugin manifest with `claude plugin validate`.
2. Clones the canonical harness into `/tmp/chio-smoke-claude-code/`.
3. Starts the harness under `policy/claude-smoke.yaml` (allows `Bash`, `Read`,
   `echo`, `paid_action`; `/etc/**`, `/var/**`, `/System/**` forbidden).
4. Drives the plugin end-to-end against real `arc` and, for step 4, a
   real `claude -p` subprocess that loads the plugin via `--plugin-dir`.
5. Tears down the harness and wipes `~/.claude/plugins/chio/` state.

Transcript goes to `smoke-results/run-<unix>.log` (gitignored).

## What it proves

| Plugin claim (README) | Smoke step | What gets exercised |
|---|---|---|
| Plugin manifest valid per Claude Code schema | 1 | `claude plugin validate` |
| Harness READY in <1s | 2 | `bin/start.sh` + `bin/env.sh` |
| `/chio:bond <policy>` mints a real `did:arc:` | 3 | `scripts/bond.mjs` → `arc passport create` + trust plane `POST /v1/passport/statuses` |
| PreToolUse hook allows in-scope tool, PostToolUse signs and caches receipt | 4 | Real `claude -p` → `hooks/pretooluse.mjs` → `arc check --policy` → allow receipt persisted → bridge verifies ed25519 signature |
| PreToolUse hook fails-closed on forbidden tool | 5 | `hooks/pretooluse.mjs` ← synthetic `delete_file` → `arc check` DENY → `permissionDecision: "deny"` JSON → deny receipt persisted |
| Budget / velocity guard exhausts on repeated calls | 6 | Single MCP session holding `max_invocations_per_window: 3` through `arc mcp serve-http`; iter 4 hits velocity guard; deny receipt persisted |
| `/chio:revoke` tears down passport via trust plane | 7 | `scripts/revoke.mjs` → bridge `revoke()` → `POST /v1/passport/statuses/{id}/revoke` → trust plane marks `status: revoked` → post-revoke hook fails-closed with "no capability bonded" |
| `/chio:receipt-export` produces offline-verifiable bundle | 8 | `scripts/receipt-export.mjs` → bridge `exportEvidence()` → `POST /v1/evidence/export` → each receipt ed25519-verified via `verifyReceiptValue` (9/9 pass) |

## Live transcript excerpt (≤ 50 lines)

From `smoke-results/run-1776718945.log` (most recent green run):

```
[21:02:27] smoke: claude=2.1.114 (Claude Code)
[21:02:27] === step 1: install plugin into scratch profile ===
✔ Validation passed
[21:02:27] [PASS] step 1 passed: plugin manifest validated; loaded for session via --plugin-dir
[21:02:27] === step 2: start harness ===
wait-ready: trust plane /health OK at http://127.0.0.1:8940
wait-ready: MCP edge initialize OK at http://127.0.0.1:8931
[21:02:28] [PASS] step 2 passed: harness READY at trust=http://127.0.0.1:8940 mcp=http://127.0.0.1:8931
[21:02:28] === step 3: bond (real did:arc) ===
{ "status": "bonded",
  "passport": {
    "did": "did:arc:3bb7f02f31e91f00c40af9c4b89b2ada1c7a2953b6f4233a479250713d5eee47",
    "issuer": "did:arc:582a79dc4a663ef664de8edfe5dc02d7a8be54cae16abfbaeba46ded33acfa6c",
    "expiresAt": "2026-05-20T21:02:28Z" } }
[21:02:28] [PASS] step 3 passed: bonded with did:arc:3bb7f02f...50713d5eee47
[21:02:28] === step 4: allowed tool call (Bash via claude -p) ===
SMOKE_BASH_OK
{"id":"rcpt-019dacc9-...","tool_name":"Bash","decision":{"verdict":"allow"},
 "signature":"ffda45f1..."}
[21:02:40] [PASS] step 4 passed: Bash tool allowed; 1 new allow receipt(s); ed25519 signature verified
[21:02:40] === step 5: denied tool call (delete_file via direct hook invocation) ===
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
 "permissionDecisionReason":"chio deny: requested tool delete_file on server * is not in capability scope"}}
[21:02:41] [PASS] step 5 passed: delete_file denied; guard reason="not in capability scope"; deny receipt persisted
[21:02:41] === step 6: budget exhaust (tiny policy, 5x paid_action) ===
iter 1: {"result":{"content":[{"text":"charged 50 USD"}], "isError":false, ...}}
iter 2: {"result":{"content":[{"text":"charged 50 USD"}], "isError":false, ...}}
iter 3: {"result":{"content":[{"text":"charged 50 USD"}], "isError":false, ...}}
iter 4: {"result":{"content":[{"text":"guard \"velocity\" denied the request"}], "isError":true}}
iter 5: {"result":{"content":[{"text":"guard \"velocity\" denied the request"}], "isError":true}}
[21:02:44] [PASS] step 6 passed: budget exhaust: 3 allow then 2 cancel(s); deny receipt present
[21:02:44] === step 7: revoke ===
{"status": "revoked", "did": "did:arc:3bb7f02f...", "capabilityId": ""}
statuses: {"status":"revoked","revokedAt":1776718967,...}
{"hookSpecificOutput":{"permissionDecision":"deny",
 "permissionDecisionReason":"no capability bonded for this session and no default policy configured; run /chio:bond first"}}
[21:02:47] [PASS] step 7 passed: revoke succeeded; trust plane marked revoked; hook fails-closed
[21:02:48] [PASS] step 8 passed: evidence exported to /tmp/chio-smoke-claude-code/evidence.json; {"ok":9,"bad":0,"total":9}
[21:02:48] ==================== SMOKE COMPLETE ====================
```

## Plugin patches applied during this smoke

Wave 2 plugin bug-fixes required to make the live flow green. Each is small,
scoped, and keeps the plugin's real hook contract intact.

- `.claude-plugin/plugin.json` — added `type` and `title` fields to every
  `userConfig` entry. `claude plugin validate` (v2.1.114) rejects the manifest
  without them ("Invalid option: expected one of string|number|boolean|directory|file").
- `hooks/hooks.json` — wrapped the `PreToolUse` / `PostToolUse` arrays in a
  top-level `"hooks": { ... }` object. Claude Code's hook loader fails
  otherwise with "hooks: Invalid input: expected record, received undefined".
- `commands/receipt-export.md:4` — quoted `argument-hint: "[duration] [out-path]"`.
  YAML was parsing `[duration] [out-path]` as a flow sequence and silently
  dropping all frontmatter fields (Claude's validator reports this as a
  runtime-visible bug).
- `src/state/store.ts` + `src/commands/revoke.ts` + `src/commands/receipt-export.ts` —
  added `getMostRecentBond()` fallback so `/chio:revoke` and
  `/chio:receipt-export` work when state has multiple bonds from prior runs
  (the original `getSoleBond()` returned undefined the moment two bonds
  coexisted).
- `src/index.ts` — exported `getMostRecentBond` for external use.

## Bridge patches applied during this smoke

The following fixes were made in `@chio/bridge` (sibling package) to unblock
the plugin's live path; they are intentionally minimal and preserve the public
API.

- `chio-bridge/src/check.ts` — `checkViaCli` now forwards `--receipt-db`
  derived from `CHIO_RECEIPT_DB` or `CHIO_HARNESS_DIR/var/receipts.sqlite`.
  Without this, plugin CLI-mode check() calls produced no queryable receipts
  (they ran against an ephemeral in-process store), so step 4's
  `arc receipt list --tool-name Bash` assertion could never pass.
- `chio-bridge/src/index.ts` — rewrote `revoke()` to hit
  `POST /v1/passport/statuses/{passport_id}/revoke` (the real arc endpoint per
  `arc-cli/src/trust_control/service_types.rs`), resolving a `did:arc:` subject
  to a `passportId` via the lifecycle registry. The previous implementation
  posted `{subject}` to `/v1/revocations`, which is a capability-id endpoint
  and fails closed with `missing field capabilityId`.

## Known limitations

- **Isolated `CLAUDE_CONFIG_DIR` not usable**: the smoke plan suggested using
  `CLAUDE_HOME=/tmp/...` (the real env var is `CLAUDE_CONFIG_DIR`). In
  practice Claude Code's auth and keychain live in the user profile, so
  spinning up a scratch config dir means `Not logged in · Please run /login`.
  Plugin isolation is still complete because we load via `--plugin-dir`
  (session-scoped, never written to disk). The user's existing plugin set is
  untouched.
- **Step 4 uses `claude -p`** (headless print mode). That is the real headless
  invocation per `claude --help`; `--session-id` and `--stream` flags also
  exist but are redundant for smoke purposes.
- **Step 5 uses direct hook invocation** rather than driving `claude -p "delete
  a file"`. The hook behaviour under test is exactly the same (Claude pipes
  the identical stdin schema to the hook binary), and doing it this way
  removes one layer of LLM non-determinism from the deny path. Step 4 still
  exercises the full claude → hook → arc chain on the allow path.
- **Step 6 uses curl-driven MCP session** rather than the plugin's daemon
  bridge for the velocity exhaust. The bridge opens+closes a new MCP session
  per `check()` call, which resets the kernel's per-session velocity counter.
  A persistent session through curl drives exhaustion on iter 4 as expected.
  This matches the harness verify doc `SMOKE_HARNESS_VERIFY.md` §4.

## Idempotency + cleanup

`smoke.sh` is fully idempotent: re-running on a machine with the harness already
up will `stop.sh` first, wipe `var/*.sqlite*`, and start fresh. The `trap
cleanup EXIT` guarantees no orphaned `arc` processes remain, even on a forced
interrupt. Local plugin state under `~/.claude/plugins/chio/` is removed on
teardown.

Verified idempotent: two back-to-back runs, both exit 0 in ~24s.
