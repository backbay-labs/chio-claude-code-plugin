# Live qualification blockers: proposed next steps

Date: 2026-10-04. Companion to the
[qualification environment report](../../acceptance/2026-10-03/qualification-environment/REPORT.md)
and the [kernel requests](./2026-10-04-kernel-requests.md). This proposes how
to clear each observed blocker. Nothing here was executed for this document;
the live VMs were not touched.

The native candidate cannot publish until `productionQualified` is true, and
that needs live evidence for every gate in
`acceptance/2026-10-03/controlled-workflows/ACCEPTANCE.json`. Plugin-side
feature work does not move these gates; each change to delivered files resets
the artifact inventory that a qualification run must bind. Batch plugin
changes, then run qualification once against the frozen candidate.

## Order

1. B1 durability syscalls (owner) — small, unblocks the core recovery gate.
2. B4 credential revalidation (kernel, K6) — needed before any restart case.
3. B5 provider 429 — needed before any live model case.
4. B2 resource tool metadata (manifest/provisioner).
5. B3 Docker resource launch (owner broker) — only if the Docker filesystem
   server is in the release scope; the native exact-file owner can qualify the
   recovery gate alone.
6. Run the recovery experiment (gate 6 of the report) on fresh state.

## B1. Native writer killed on `fsync` (syscall 74)

**Observed.** The approved native write happened once (inotify saw one
close-write with the expected 38-byte hash), then seccomp killed the writer on
`fsync` (`arch=c000003e syscall=74 sig=31`). The kernel retained
`outcome_unknown_after_dispatch` with a signed `incomplete` receipt.

**Proposal.** Allow `fsync`, `fdatasync` and, if the writer uses them,
`sync_file_range` on descriptors the cage already permits for writing, in the
native writer's seccomp profile. Do not remove `sync_all` from the writer and
do not weaken the migration stage; the gate is "authorized durability", not
"skip durability". Add the three syscalls to the cage's audit list so a denial
is reported by name.

**Verify.** Fresh disposable state: approved write → durable → verified original
result → one effect, one invocation charge. Then the forbidden-path and
inherited-descriptor probes from the report still deny.

## B2. Real tool metadata rejected by the provisioner

**Observed.** The real image lists fourteen tools with
`execution.taskSupport: "forbidden"`; the selected manifest provisioner rejects
that metadata, so launch probes used a reviewed four-tool synchronous
projection (`TOOLS-PROJECTION.json`).

**Proposal.** Teach the publisher-reviewed manifest to carry MCP execution
metadata and have the provisioner accept `taskSupport: "forbidden"` as an
explicit synchronous-only declaration (it narrows behavior; it never grants
task methods). Keep the source discovery record beside the manifest.

**Verify.** Provisioning from the unmodified `tools/list` succeeds for the
selected subset; a tool claiming task support is refused.

## B3. Docker client `SIGSYS` inside the cage

**Observed.** Provisioning and owner start succeeded; the caged static Docker
client exited on signal 31. The cage forbids socket creation and other process
facilities an ordinary Docker client needs (an inference for this specific
exit; the receipt does not name the first rejected syscall).

**Proposal.** Do not widen the cage to fit a general Docker client. Put a
narrow resource-owned broker outside the cage that exposes only the four
filesystem operations over a pre-opened descriptor or a single Unix socket the
cage may use, and qualify that broker as its own boundary.

**Verify.** The caged server performs the four operations through the broker;
any other Docker API call is refused by the broker and logged.

## B4. HTTP 401 after owner restart

See [K6](./2026-10-04-kernel-requests.md#k6-http-401-for-an-unexpired-credential-after-owner-restart).
Until the kernel defines credential behavior across restart, restart and
reconnect cases cannot pass. The plugin keeps the original unknown operation
fenced and does not issue a new execution session on its own.

## B5. Provider HTTP 429

**Observed.** Eight print-argument requests through the selected relay with a
refreshed `claude.ai` login all returned 429; host retries were stopped.

**Proposal.**
1. Re-run one request with the same login outside the relay
   (`claude -p "ping" --model claude-sonnet-5-5`) to separate account limits
   from relay behavior.
2. If only the relay path is limited, compare forwarded headers with a direct
   request: the relay forwards `anthropic-beta` values and the OAuth bearer; a
   missing or extra beta can change routing.
3. Record `retry-after` and the response's rate-limit headers in the relay's
   event log (header values only, no prompts), and stop after the first 429
   instead of letting the host retry eight times.

**Verify.** One successful conversation request through the relay with the
operator's login, recorded in `model-relay.json`.

## After the blockers

Run the report's remaining gates on fresh disposable state: full
reload/resume/branch/reconnect, original-outcome recovery with one effect and
one charge, cold activation of the exact package, and the delivered-launcher
custody cases. Record them in a new acceptance directory for the frozen
candidate; earlier records stay attributed to their artifacts.
