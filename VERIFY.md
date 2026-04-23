# Verification transcript

## Manifest (schema-legal per code.claude.com/docs/en/plugins-reference)

- Location: `.claude-plugin/plugin.json` (not repo root). ✓
- Keys used: `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `commands`, `hooks`, `userConfig`. All listed in the reference schema. ✓
- Dropped invented keys: `runtime`, `config`, `bind`. ✓
- Hooks reference external file `./hooks/hooks.json` using the real
  `{event: [{matcher, hooks: [{type, command}]}]}` shape. ✓

## Typecheck + build

```
$ npx tsc --noEmit        # (no output, clean)
$ npx tsc                 # emits dist/
$ ls dist dist/commands dist/state
# dist/{index.js,index.d.ts} + commands/*.js + state/*.js all present
```

## End-to-end hook test

```
$ node --test ./test/pretooluse.test.mjs
✔ PreToolUse emits exit-0 deny on verdict.decision === 'deny'
✔ PreToolUse fails closed when bridge throws (unreachable daemon)
✔ PreToolUse fails closed when no bond and no default policy
✔ PreToolUse lets allow-verdicts pass (exit 0, no override)
pass 4, fail 0
```

Deny stdout (asserted in test 1):
```
{"hookSpecificOutput":{"hookEventName":"PreToolUse",
 "permissionDecision":"deny",
 "permissionDecisionReason":"chio deny: blocked by egress guard [guard: EgressAllowlistGuard]"}}
```

## Policy parser

```
$ node -e 'import("@chio/bridge").then(({loadPolicy,lintPolicy})=>...)'
{ "name":"tiny-hedge-fund","hushspec":"0.1.0",
  "rule_keys":["tool_access","egress","shell_commands"],
  "extensions":["chio"],"errors":0,"warnings":0 }
```
