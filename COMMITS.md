# COMMITS.md — chio-claude-code-plugin

Claude Code plugin. Bonds every session to a Chio policy, mediates
every tool call through `@<NPM_SCOPE>/bridge`. Target first ship tag:
`v0.2.0`.

---

## 1. chore: scaffold Claude Code plugin package

**Body.** `package.json` (`@chio/claude-code-plugin`),
`.claude-plugin/plugin.json` manifest, `tsconfig.json`, `LICENSE`,
`.gitignore`, `bun.lock`. Declares `commands/`, `hooks/`, and
`scripts/` in `files`. Node `>=22`, ESM-only, depends on
`@chio/bridge` via workspace. Wave 1.

**Files.**

- `package.json`, `package-lock.json`, `bun.lock`
- `tsconfig.json`
- `LICENSE`
- `.gitignore`
- `.claude-plugin/plugin.json`

---

## 2. feat: implement slash commands and fail-closed hooks against chio host

**Body.** Eight `/chio:*` slash commands wired to real
`ChioBridge` calls (`bond`, `policy-show`, `guard-pause`,
`budget-set`, `approve`, `revoke`, `receipt-last`,
`receipt-export`). Two hook scripts under `hooks/`: `pretooluse.mjs`
is the real enforcement path (exit-0 with
`{hookSpecificOutput:{permissionDecision:"deny"}}` to block; MCP
tools arriving as `mcp__<server>__<tool>` decomposed into
`(serverId, tool)`); `posttooluse.mjs` verifies the receipt
signature and persists it locally. Both fail **closed** — any
bridge error denies. Wave 1 rewrite against the host schema.

**Files.**

- `src/index.ts`
- `src/commands/*.ts` — one per slash command.
- `src/state/*.ts` — session-local bond + config cache.
- `commands/*.md` — Claude Code command manifests.
- `hooks/pretooluse.mjs`
- `hooks/posttooluse.mjs`
- `hooks/_lib.mjs`
- `examples/hedge.policy.yaml`

---

## 3. test: unit coverage and end-to-end smoke against chio-test-harness

**Body.** Unit tests cover command-arg parsing, MCP tool-name
decomposition, and the hook fail-closed paths. `smoke.sh` boots
`chio-test-harness`, bonds a passport, drives each slash command and
both hooks end-to-end, and asserts `bond`, `allow`, `deny-by-path`,
and receipt ed25519 verification against a live trust plane. From
Wave 1 test-suite + ST.2.x smoke harness spec. Covers SMOKE.md's
nine assertions.

**Files.**

- `test/*.test.ts`
- `smoke.sh`
- `SMOKE.md`
- `smoke-results/` — reference run artefacts (gitignored at ship).

---

## 4. feat: switch to chio-renamed SDK and CHIO_BIN resolution

**Body.** Re-points the plugin's bridge construction from the old
`arc-*` re-exports to `Chio*`, reads `CHIO_BIN` in cli-mode, honours
the `did:chio:*` subject format. Policy examples move `velocity` and
`human_in_loop` under `extensions.chio.*` per Wave 5.0.1 until the
arc upstream PR lands. Wave 5.0.

**Files.**

- `src/commands/guard-pause.ts` — re-export rename.
- `examples/hedge.policy.yaml` — `extensions.chio.velocity` move.

---

## 5. ci: lint, unit tests, and chio-backed smoke pass

**Body.** GitHub Actions workflow: checks out bridge, test-harness,
and arc (for `setup-chio`), installs, typechecks (non-blocking per
Wave 5.1), runs unit tests, and finally runs `smoke.sh` against a
live harness. Wave 5.1.

**Files.**

- `.github/workflows/ci.yml`

---

## 6. ci: add SLSA L3 and Sigstore-signed release workflow

**Body.** Tag-triggered publish to `@<NPM_SCOPE>/claude-code-plugin`
with native npm provenance and a SLSA L3 generic generator
attestation at job level. Consumes `publish-chio@v0.1.0` from
`chio-ci-actions`. Wave 5.5.

**Files.**

- `.github/workflows/release.yml`

---

## 7. docs: README, VERIFY, and hook contract

**Body.** README covers slash commands, hooks, config
(`userConfig` in `plugin.json` surfaces as `CLAUDE_PLUGIN_OPTION_*`
env vars), policy caveats, and the three-layer architecture
(Claude Code → hook → `@chio/bridge` → arc). `VERIFY.md` captures
the reference smoke run. Wave 5.2.

**Files.**

- `README.md`
- `VERIFY.md`
