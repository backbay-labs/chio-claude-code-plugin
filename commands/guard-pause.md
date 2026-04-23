---
name: chio:guard-pause
description: Temporarily disable a named Chio guard for this session. Issues an attenuation delta; countersigned receipt.
argument-hint: <guard-id> [duration]
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Guard pause

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/guard-pause.mjs" $ARGUMENTS`
