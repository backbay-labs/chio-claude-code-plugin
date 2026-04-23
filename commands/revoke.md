---
name: chio:revoke
description: Revoke the active Agent Passport immediately. Remote propagation via the trust plane revocations endpoint.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Revocation

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/revoke.mjs"`
