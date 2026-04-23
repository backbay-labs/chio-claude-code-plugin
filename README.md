# @chio/claude-code-plugin

Bond any Claude Code session to a Chio policy. Every tool Claude reaches for — Bash, Write, Edit, Read, and any MCP server — is mediated through the chio kernel, metered, and receipt-signed.

> The runtime binary is `chio`; the SDK package is `@chio-protocol/sdk`; this plugin talks to chio via the shared `@chio/bridge` library.

## Install

```bash
# 1. Build the plugin (installs @chio/bridge and @chio-protocol/sdk via workspace)
cd standalone/chio-claude-code-plugin
bun install
bun run build

# 2. Point Claude Code at it
claude --plugin-dir ./ # for dev
# or
claude plugin install chio@<marketplace>
```

## Slash commands

| Command | What it does | Real work |
|---|---|---|
| `/chio:bond <policy> [ttl] [usd]` | Issue an Agent Passport | `ChioBridge.bond` → `chio passport create` / `/v1/capabilities/issue` |
| `/chio:policy-show` | Pretty-print the active ruleset | `ChioBridge.loadPolicy` + `lintPolicy` |
| `/chio:guard-pause <guard> [ttl]` | Disable a named guard for a TTL | `ChioBridge.attenuate({ pauseGuards })` |
| `/chio:budget-set <usd>` | Adjust the session spend ceiling | `ChioBridge.attenuate({ budget })` → `POST /v1/budgets/increment` |
| `/chio:approve <receipt-id>` | Countersign a gated action | `signJsonStringEd25519` + `ChioBridge.countersign` |
| `/chio:revoke` | Tear down the active passport | `ChioBridge.revoke` → `POST /v1/revocations` |
| `/chio:receipt-last` | Print the most recent receipt | `ChioBridge.receipts` + `verifyReceipt` |
| `/chio:receipt-export [since] [out]` | Export a signed evidence bundle | `ChioBridge.exportEvidence` |

## Hooks

| Event | Script | Contract |
|---|---|---|
| `PreToolUse` | `hooks/pretooluse.mjs` | Exit-0 with `{hookSpecificOutput: {permissionDecision: "deny", permissionDecisionReason}}` to block. **Fail-closed** on any bridge error. |
| `PostToolUse` | `hooks/posttooluse.mjs` | Informational; verifies the receipt signature and persists it locally. Always exits 0. |

The PreToolUse hook calls `ChioBridge.check({tool, params, serverId, policyPath})`. Its stdin follows the real Claude Code hook schema (`tool_name`, `tool_input`, `session_id`, `tool_use_id`). MCP tools arriving as `mcp__<server>__<tool>` are decomposed into `(serverId, tool)` before the check.

## Config

Driven by `userConfig` in `plugin.json`. Claude Code prompts on first enable and exposes the values as `CLAUDE_PLUGIN_OPTION_*` env vars to hooks and scripts:

| Key | Purpose |
|---|---|
| `policy_path` | Default policy for the PreToolUse hook if no `/chio:bond` has run |
| `chio_binary` | Path to `chio` (CLI mode) |
| `trust_url` | Trust-control plane URL (default `http://127.0.0.1:8940`) |
| `service_token` | Bearer token for the trust plane; enables daemon mode |

## Policy

See `examples/hedge.policy.yaml`. Uses real HushSpec 0.1.0 keys under `rules:` and puts plugin-only controls (`velocity`, `human_in_loop`) under `extensions.chio.*`. chio's `deny_unknown_fields` would reject them under `rules:` today.

## Architecture

```
Claude Code
  └─ PreToolUse hook
      └─ node hooks/pretooluse.mjs
          └─ import @chio/bridge
              ├─ daemon mode: ChioClient / ReceiptQueryClient over HTTP
              └─ cli mode:    `chio check --policy ... --tool ... --params ...`
```

## License

Apache-2.0

## CI

[![ci](https://github.com/owner/chio-claude-code-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/owner/chio-claude-code-plugin/actions/workflows/ci.yml)

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Runs lint/typecheck (non-blocking in Wave 5.1), unit tests, and a chio-backed smoke pass. Swap `owner/...` once the GitHub org is live.
