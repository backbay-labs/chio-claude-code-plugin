---
name: chio:revoke
description: Revoke the passport bonded to the exact Claude session. Requires a session id.
argument-hint: [session-id]
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Revocation

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/revoke.mjs" $ARGUMENTS`
