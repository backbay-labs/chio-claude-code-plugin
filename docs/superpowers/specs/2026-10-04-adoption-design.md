# Coverage view and local demo

Date: 2026-10-04. Sub-project 4 of the 2026-10-04 progress review. Branch
`feat/claude-adoption-20261004`, stacked on `feat/claude-observability-20261004`
(sub-project 3). Kernel, gateway and authority contracts do not change.

## Goal

1. In an ordinary session, show how many tool calls ran outside Chio's
   protection, so a user can see what the protected launcher would change.
2. Let a new user see the whole review loop — proposal, review, operator
   confirmation, continuation, verified result shared with Claude — in a few
   minutes on one machine, with no kernel, clearly labeled as a demo.

Success: tests at each level; the existing suites pass; nothing in the demo can
be mistaken for protection, and nothing it ships can be trusted by a real
gateway configuration.

## Decided out of scope

| Review idea | Decision |
| --- | --- |
| "Would need review" labels on native calls | Needs served non-dispatch evaluation (request K1 in `docs/research/2026-10-04-kernel-requests.md`, PR #5). |
| Blocking or prompting on native calls | Coverage view is observation only; enforcement belongs to the protected launcher. |

## A1. Coverage view

The mod observes every `tool.call` whose tool does not start with
`mcp__chio__`, after `next(e)` resolves, and only when the current projection's
scope is `kernel_mcp`. It counts calls per tool name for the current session
(reset on session change and `classic.SessionStart`). Counting is wrapped so a
failure never affects the call's result or causes a second dispatch.

- Status line, when the count is non-zero: append ` · N calls outside Chio`.
- `/chio-status` and `/chio-doctor` add one line:
  `Outside Chio protection this session (observed, not checked): Bash 4 · Edit 2 · Read 9`
  (tool names sorted by count, then name; at most 8, then `+N more`).
- `isolated_kernel_mcp` sessions never count (native tools are not available)
  and disconnected sessions show nothing.

Tests (native harness): a Bash call and two Read calls in a `kernel_mcp`
session produce the status-line suffix and the sorted line; an `mcp__chio__`
call is not counted; isolated scope counts nothing; a session change resets the
counts; a throwing counter path still returns the tool's original result once.

## A2. Local demo

`node scripts/demo.mjs --directory NEW_DIR`

Creates a new directory (refuses an existing path) and starts, in one process:

- a fixture kernel on loopback: answers `chio/execution-context`, `tools/call`
  (writes the requested content into `NEW_DIR/owner/` under the requested
  relative path, refusing `..` and absolute escapes) with a signed outcome,
  `chio/acknowledge`, and the operator approval routes
  (`/admin/approvals`, `/admin/approvals/{id}/decision`) with a signed decision;
- the existing gateway (`startGatewayHttp`) with tools `write_file` (review
  required) and `read_text_file`;
- the control service (`startControlServer`) with continuation and
  acknowledgement wired through `createControlTransport`, scope `demo_fixture`;
- the operator watch screen (`control-watch.mjs`) in the same terminal.

Signing uses a fresh random Ed25519 seed per run, written only to the demo
directory; no fixed key is shipped. The demo's gateway configuration trusts only
that run's public key. The signing helpers and the fixture kernel live in
`src/demo/fixture.ts`, bundled to `dist/demo/fixture.js` like the rest of the
runtime (a marketplace clone has no `node_modules`), with the seed as a
parameter; `test/workflow-fixture.mjs` re-exports them with its fixed test seed.
`scripts/demo.mjs` composes the bundled gateway, control service, control
transport and watch screen.

It writes `NEW_DIR/mcp.json` and prints exactly what to run in a second
terminal:

```text
Chio DEMO · fixture kernel · nothing is protected
In another terminal:
  CHIO_CONTROL_URL=http://127.0.0.1:<port> CHIO_CONTROL_TOKEN=<token> \
  CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir <plugin root> \
    --mcp-config NEW_DIR/mcp.json --session-id <uuid>
Then ask Claude: Use the chio write_file tool to write "hello" to notes/hello.txt.
Approve here when the request appears. Press q to stop the demo.
```

Scope `demo_fixture` is a new accepted projection scope. The status line reads
`Chio · DEMO fixture kernel · nothing protected · ...`; `guidanceText` adds
"This is a Chio demo with a fixture kernel; nothing is protected." The control
service accepts `demo_fixture` only from its caller (the demo); the protected
launcher and `control.mjs serve` keep their scopes.

On `q` or SIGINT the demo closes the watch, control service, gateway and kernel
and leaves the directory (journal, owner files, mcp.json) for inspection.

Tests (Node): the demo's kernel and services start in a temporary directory;
a proposal through the gateway's HTTP MCP endpoint is retained for review; a
watch confirmation grants it; a continuation through the control service writes
exactly one owner file and returns a verified outcome; a `..` path is refused;
the gateway config's trusted signer is the run's key, and two runs have
different keys; an existing directory is refused. (The Claude host is not
started by tests.)

## Verification

Typecheck, build, `npm test`, `npm run test:mods`, a manual demo start and stop
in a scratch directory, and the publication guard still refusing.
