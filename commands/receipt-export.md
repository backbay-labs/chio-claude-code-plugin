---
name: chio:receipt-export
description: Export a signed, offline-verifiable evidence bundle of receipts for any slice of this session.
argument-hint: "[duration] [out-path]"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Evidence bundle

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/receipt-export.mjs" $ARGUMENTS`
