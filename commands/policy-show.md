---
name: chio:policy-show
description: Render the active Chio policy for this session, parsed through the real HushSpec parser.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Active policy

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/policy-show.mjs"`
