---
name: chio:budget-set
description: Adjust the session spend ceiling. Posts a budget increment to the trust plane. Emits a receipt.
argument-hint: <usd>
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Budget update

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/budget-set.mjs" $ARGUMENTS`
