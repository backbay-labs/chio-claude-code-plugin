---
name: chio:bond
description: Issue an Agent Passport for this Claude Code session against a Chio policy. Real capability issuance via chio.
argument-hint: <policy-path> [ttl] [budget-usd]
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Bond result

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/bond.mjs" $ARGUMENTS`

## What just happened

If the command above returned a JSON block with `did:chio:...`, Chio has issued
an Agent Passport scoped to the policy file. Every tool call in this session
will now be mediated through the Chio kernel: the PreToolUse hook calls
`ChioBridge.check` → verdict → allow or deny. PostToolUse signs and streams
the receipt.

If the command above printed an error (missing policy, parse failure, daemon
unreachable), nothing is bonded and the next tool call will still fail-closed
through the PreToolUse hook.
