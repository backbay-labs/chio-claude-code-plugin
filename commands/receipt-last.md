---
name: chio:receipt-last
description: Pretty-print the most recent ArcReceipt from this session, with ed25519 signature verification status.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Last receipt

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/receipt-last.mjs"`
