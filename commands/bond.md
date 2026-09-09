---
name: chio:bond
description: Issue an Agent Passport for this Claude Code session against a Chio policy. Real capability issuance via chio.
argument-hint: <policy-path> [ttl] [budget-usd]
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Bond result

!`CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" node "${CLAUDE_PLUGIN_ROOT}/scripts/bond.mjs" $ARGUMENTS`

## What just happened

If the command above returned a JSON block with `did:chio:...`, Chio has issued
an Agent Passport scoped to the policy file. The compatibility hook requires this exact session identity and a trusted
kernel receipt key. It performs an authorization precheck; it does not establish
complete mediation or a verified execution result. See the acceptance record.

If the command above printed an error (missing policy, parse failure, daemon
unreachable), nothing is bonded. A functioning PreToolUse hook denies unbonded calls.
The host does not guarantee denial when a command hook is missing or crashes.
