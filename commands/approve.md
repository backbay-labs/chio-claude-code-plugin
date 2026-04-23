---
name: chio:approve
description: Countersign a gated tool call. Signs the receipt with your operator ed25519 key (generated on first use).
argument-hint: <receipt-id>
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Countersignature

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/approve.mjs" $ARGUMENTS`
