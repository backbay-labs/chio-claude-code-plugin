# Cross-host conformance, shared code, fault injection and Linux confinement

Date: 2026-10-04. Sub-project 6 of the 2026-10-04 progress review. This is a
plan. It was not executed in this repository because each part either lives in
another repository (`chio-conformance`, `chio-test-harness`, the sibling host
plugins) or needs an environment this review did not touch (a Linux host, the
real kernel binary in CI). Evidence comes from a read-only survey of the sibling
repositories on 2026-10-04. The newer source paths below refer to Pi's
`feat/pi-full-roadmap-20261004` at `3eae77fee648547bac31d752bacf414bda492b17`
and OpenClaw's `codex/release-qualification-20260909` at
`370fb1067ada7af07126aead598b2f9c0e2fc8a8`; they are not all on the sibling
repositories' default branches.

## Why this matters for Claude Code

Each host integration (Claude Code, Codex, Cursor, OpenClaw, OpenCode, Pi)
qualifies the same kernel-gateway design separately, with its own copies of the
sandbox profile builder, model relay, executor and release scripts. Every copy
has to be qualified again on every change. Sharing the boundary code and one
conformance suite lowers the cost of the Claude plugin's next qualification and
keeps the hosts from drifting.

## P1. Conformance suite v2

**Today.** `chio-conformance` (0.1.0, last commit 2026-04-22) has 12 tests
against the old daemon bond/check/receipt API (`src/runner.ts:94`,
`ChioBridge.fromDaemon`). It tests the bridge, not host plugins, and covers no
gateway, journal or continuation behavior. `chio-test-harness` (0.2.0) starts a
trust plane, an MCP edge and a test server. CI definitions in the bridge,
Codex, Cursor, OpenClaw and OpenCode repositories reference that harness;
several use the placeholder checkout `owner/chio-test-harness`. A reference
in a workflow does not establish a working hosted run.

**Proposal.** Rebuild the suite around a per-host adapter:

```ts
interface HostAdapter {
  launch(input: { gatewayConfig: string; workspace: string; task: string }): Promise<HostRun>;
  outcome(run: HostRun): Promise<{ exitCode: number; executionOutcome: string; journal: string }>;
  kill(run: HostRun, signal: "SIGTERM" | "SIGKILL"): Promise<void>;
}
```

Cases, each against `chio-test-harness`'s kernel and a disposable resource:

| Case | Pass condition |
| --- | --- |
| allow | one effect, verified receipt, exit 0 |
| deny | no effect, signed denial, exit 3 |
| awaiting review | no effect, retained proposal, exit 4 |
| unresolved fence | a lost reply leaves the original id fenced; a second launch does not redispatch |
| receipt binding | a substituted result or signer is refused |
| revocation | a revoked session admits nothing new |
| continuation | an approved original resumes once; a duplicate is refused |
| silent tool omission | a host that drops a declared tool fails initialization |

The Claude plugin's `docs/host-contract.json` (pinned host version and
per-platform checksums) is the model for each adapter's host manifest. The exit
taxonomy the Claude launcher already uses (2 unresolved, 1 initialization
failed, 4 pending approval, 3 incomplete work) becomes the suite's contract.

**First step.** Write the Claude adapter against the existing
`scripts/restricted.mjs` and run the eight cases in `chio-test-harness` CI.

## P2. Shared boundary code in the bridge

The survey found near-duplicates:

| Code | Copies | Proposed home |
| --- | --- | --- |
| macOS sandbox profile builder (`otool` library walk + profile) | Claude `scripts/sandbox.mjs`, Pi `src/sandbox.ts`, Codex `src/cli/sandbox.ts`, Cursor `bin/protected-boundary.mjs` | `@chio/bridge/confinement` with pluggable backends (macOS sandbox, Docker, seccomp) |
| Loopback model relay skeleton (token, allowlist, event log) | Claude, Codex, Pi, OpenClaw | `@chio/bridge/relay` skeleton; Anthropic Messages and OpenAI Responses validators stay provider-specific modules |
| HTTP executor and journal | Pi `http-executor.ts`/`uncertainty.ts`, OpenClaw `native/src/http-executor.mjs`/`journal.mjs` | merge into the bridge's `execution` |
| `prep-publish.mjs` | byte-identical in six repositories | a shared release-tools package or `chio-ci-actions` |
| Python qualifiers (`qualify-http-host.py`, `qualify-kernel-storage.py`) | Codex, Pi, OpenClaw | parameterized scripts in `chio-test-harness` |

The subpath exports prepared locally in `chio-bridge`
(`feat/gateway-subpath-exports-20261004`: `./gateway`, `./gateway-operator`,
`./approval`, `./execution`) are the first step: the Claude plugin's
`src/bridge-internals/` seams switch to them once a bridge release carries them.

**Order.** Move the relay skeleton first (smallest surface, four copies, no OS
dependency), then the sandbox builder. Each move is one bridge release followed
by one adoption PR per host; a host adopts only with its own requalification.

## P3. Fault-injection resource owner

**Need.** The Claude release blocker "one effect and one charge after
recovery" is a one-off live experiment today. It should run on every candidate.

**Proposal.** A deterministic crash-point harness around gateway, kernel and
resource owner:

- enumerate every durable write on the path (gateway journal record, approval
  artifact, continuation claim, kernel admission state, owner effect, receipt,
  acknowledgement);
- for each point, run the protected write, kill the named process immediately
  after that write (and separately, immediately before it), restart, and assert
  one effect, one charge, the original request id retained and either a
  verified original result or a retained fence;
- run against the real kernel binary from `chio-test-harness`, not a stub.

OpenClaw's `native/test/kill-after-relay.mjs` and `journal-race.test.mjs` and
the Claude plugin's existing restart regressions are the starting points. The
kernel's K2 settlement route ([kernel requests](./2026-10-04-kernel-requests.md#k2-operator-settlement-of-an-unknown-outcome))
is needed to finish the "unknown" branch of each case.

## P4. Linux confinement for the Claude launcher

**Today.** The restricted launcher is macOS-only (`sandbox-exec`). Claude Code
runs on Linux in CI and cloud environments.

**Proposal.** A Linux backend for P2's confinement module, following Pi's
seccomp runner (`chio-pi-plugin/test/helpers/coding-seccomp.mjs`) and
OpenClaw's pinned Docker image: the host process gets a read-only root, a
private writable profile and temporary directory, no network except the three
loopback ports (gateway, relay, control), and no access to the operator's
gateway configuration or journal. Landlock for filesystem rules, a seccomp
filter for socket families, and a network namespace with a loopback-only
forwarder are the candidate mechanisms.

**Qualification.** It needs the same bounded escape probes the macOS profile
passed (private file, process, network) on a real Linux host, recorded in its
own acceptance directory. macOS evidence does not transfer.

## What was done in this review instead

- The bridge subpath exports (P2's first step) are committed locally in
  `chio-bridge` and not pushed.
- The Claude plugin's bridge imports go through per-module seams with a
  contract test, so adopting the exports is a one-file change per seam.
