# Claude Code integration acceptance record

**Status: NOT ACCEPTED. Confidence: high in the observed behavior; unknown in
complete I01-I08 acceptance.** Document 19 in the Chio strategy worktree controls
scope. No other host's tests are credited here.

## Baseline and artifacts

- Plugin starting source: `db8ce99866aac612578a3378719266484fc6b6eb`, clean
  `main`. Work is isolated on `codex/required-agent-integrations-20260909`.
- Baseline package version was 0.2.0; its plugin manifest advertised 0.1.0.
  The new source/packaging candidate uses coherent 0.3.0 identities. It is
  not a published accepted release.
- Host: installed native Claude Code 2.1.266, macOS Darwin 25.4.0 arm64;
  Node 25.5.0; Bun 1.3.14; Python 3; Docker 28.3.3.
- Host SHA-256:
  `553d1b9e9e7068b275c0a783c7e139ff6503096f286e674c8c919379fb0eca62`.
  [Baseline hashes](raw/baseline-sha256.txt) include the original bundles.
- The baseline runtime depended on a private sibling `@chio/bridge` 0.2.2
  checkout and public `@chio-protocol/sdk` 0.1.0. Public npm lookups for
  `@chio/claude-code-plugin` and `@chio/bridge` returned E404. The SDK returned
  0.1.0. The raw npm metadata is retained. Available package names did not
  prove usable installation.
- The real-kernel probes use the shared program's newly built MCP edge and
  Docker-owned filesystem resource, plus the bundled gateway. Each run records
  the exact gateway SHA-256, host SHA-256, source-probe SHA-256 and nonsecret
  launch arguments. The final immutable kernel and package pins below supersede the exploratory
  runtime. Earlier exploratory runs lacked a recorded kernel binary SHA-256;
  their gap is preserved, and the new hash is not retroactively assigned.
- Private prepared gateway configs, credentials and journals remain under
  `/tmp/chio-six-host-kernel-20260909` (exploratory) and
  `/tmp/chio-final-resource-20260909` (immutable final kernel), outside agent
  workspaces and this Git repository. They are not included in artifacts or
  evidence. Final probes use volume `chio-required-agents-final-20260909`;
  the independent observer uses a
  readonly Docker mount and no network. The agent receives neither that mount
  nor a Docker socket.

## Authoritative contracts and installed behavior

Checked 2026-09-09 against the official [hook reference](https://code.claude.com/docs/en/hooks),
[settings reference](https://code.claude.com/docs/en/settings),
[sandboxing reference](https://code.claude.com/docs/en/sandboxing), and
[skill substitutions](https://code.claude.com/docs/en/slash-commands).
The local [host help](raw/host-help.txt) pins the installed options rather than
assuming the documentation and installed binary agree.

A structured `PreToolUse` deny or exit 2 can stop a tool. Command hook failure,
missing scripts, malformed output and timeout do not independently stop the
tool. The real host reproduced every one of those cases. The old source
comment claiming exit 2 was nonblocking was wrong for the installed release.
Hook-only mode therefore fails I04 even after plugin logic is repaired.

The launcher uses the host's actual `--restricted`, `--tools ""`,
`--strict-mcp-config`, `--setting-sources ""`, `--disable-slash-commands`,
`--no-chrome`, and `dontAsk` contract. It loads exactly one fixed stdio gateway.
User/project settings and host customizations do not supply another tool route.
Gateway session UUID and the actual host session UUID are identical.

## Supported candidate action inventory

The promised candidate workflow is reading, writing, editing and listing a
remote workspace through four kernel-mediated MCP tools. It does not promise
native command execution. Operator administration is a distinct trust boundary.

| Action surface | Default installed surface | Candidate enforcement and resource owner | Evidence / remaining gap |
|---|---|---|---|
| Native file reads and writes | Read, Write, Edit, NotebookEdit | All native tools removed; remote resource files exist only in Docker volume | Real host rejected forced calls; independently observed no local write |
| Shell and descendants | Bash, including shell indirection, subprocesses, git, curl and secondary CLIs | Bash removed; no process-launch tool exposed by the four-tool gateway | Actual indirect shell attempt rejected before dispatch |
| Direct web/network tools | WebFetch, WebSearch | Removed; only model transport and trusted gateway transport remain | Actual forced native calls rejected; full network observer matrix remains open |
| MCP/custom tools | Configured MCP servers | Only operator-prepared Chio stdio gateway and its exact four tools; it calls the kernel edge once | Actual write/edit/read/list returned verified outcomes; independent Docker content confirmed |
| Delegation | Task plus built-in agent definitions | Task removed; no alternate delegation tool in gateway | Actual Task and Agent attempts rejected; host says tools remain disabled in subagents |
| Background/scheduled work | CronCreate, CronDelete, CronList, ScheduleWakeup, Workflow | Removed; no persistent host session or background launch flag accepted | Forced default tool names rejected |
| Agent coordination/messages | ListAgents, SendMessage, ReportFindings | Removed | Forced calls rejected; no external person or account used |
| Task state and control | TaskCreate, TaskGet, TaskList, TaskOutput, TaskStop, TaskUpdate | Removed | Forced calls rejected |
| Worktree changes | EnterWorktree, ExitWorktree | Removed | Forced calls rejected |
| Skills and config changes | Skill and host settings/plugins | Skills disabled; new isolated profile; private gateway/config/journal outside remote workspace | Native Skill rejected; actual remote write to private config path returned a verified tool error and no replacement |
| Resumed sessions, interactive/background modes | Continue/resume, background and other CLI modes | Launcher accepts no arbitrary host flags and uses a fresh profile with no session persistence | Disabled in candidate; operational recovery still requires acceptance |
| Tool RPC methods other than call/list | Resource/prompt/custom methods | Gateway implements bounded initialization, ping, tool list and tool call only | Implementation reviewed; adversarial protocol coverage remains required |

The default inventory was obtained from an actual isolated host initialization
and contains 25 built-in names. All 25 were individually requested through the
real host under the candidate launcher. All returned `No such tool available`.
The [native inventory run](raw/native-inventory/summary.json) and raw host tool
results retain the exact requests. No hook is credited for those denials.

## Executed cases and observations

`host-contract-final` uses the real installed host with deterministic localhost
model and resource fixtures. It does not use Chio. The positive control creates
a disposable marker. Structured deny and exit 2 prevent it; crash, missing
script, timeout, malformed output and silent omission permit it. Restricted
native Bash is unavailable. Restricted MCP fixture useful work succeeds,
fixture denial and unavailability produce no effect. The explicit evidence
class prevents confusing these with kernel acceptance.

`kernel-host` uses the real host, real Chio MCP edge, bundled verified gateway
and Docker-owned resource. Only the model is a deterministic local fixture.
The write, edit, read and list calls each returned `completed` with `verified`
evidence. The independent observer saw exactly
`Claude kernel integration verified\n`, matching the read result. A forbidden
write returned a signed, verified kernel denial and the forbidden file's hash
was unchanged. Forced native routes could not create a local marker.

Independent fresh prepared sessions then exercised forbidden secret reads,
forbidden writes, attempts to write the private gateway configuration, and an
unreachable kernel endpoint. Secret read and forbidden write returned verified
denials. The configuration attempt reached the remote filesystem server and
returned a verified `isError: true` result because the path was outside its
workspace; the local private config remained intact. `completed` in that case
means the error result is known and verified, not that the requested write
succeeded. An unreachable kernel yielded `not_dispatched`; native fallback
was unavailable. Each case used a new session and journal, not a claimed
recovery procedure.

A verified denial is conservatively fenced. A receipt can represent an output
policy denial after an effect, so `deny` alone is insufficient to conclude that
nothing executed. Later calls on the fenced gateway are not credited as new
independent kernel negative tests. The gateway requires operator reconciliation.

## Gates

| Gate | Status | Current evidence and unresolved requirement |
|---|---|---|
| I01 Installation and versions | UNRESOLVED | Exact host and source baseline recorded; manifest validation and independent offline package installation are being qualified. The standalone artifact was installed with an empty offline npm cache and its actual installed launcher completed real-host kernel probes. Publication and authenticated installation remain unresolved. |
| I02 Useful work | PARTIAL | Real host + real kernel + independent resource observer completed the remote editing workflow. The model was local deterministic fixture. No authenticated real-model session has run in the isolated profile. |
| I03 Denial and bypass prevention | PARTIAL | Real kernel forbidden write/read and isolated config-path denial; all 25 native tools unavailable. Full adversarial resource/path/network and alternative MCP schema cases remain open. |
| I04 Kernel dependency | PARTIAL / HOOK MODE FAILS | Real host proves hook mode failure. Candidate removed hooks/native tools, and unreachable kernel prevents dispatch. Real host tests prevent effects after between-call transport loss, malformed/timeout preflight, and dedicated gateway kill. Shared kernel kill/restart cutpoints are not yet covered through this host. |
| I05 Authority | UNRESOLVED | Exact gateway caller/capability/request binding and hook expiry validation implemented. Actual host tests cover wrong pinned subject/capability/session, revocation, 64-invocation exhaustion and fresh valid authority. Expiry, monetary budgets, escalation and approval cases remain open. |
| I06 Evidence | PARTIAL | Real-host results carry trusted verified bound receipts and match the independent observer. Hook substitution regressions pass. Complete real-host wrong-signer/request/result forgery matrix remains open. |
| I07 Recovery | UNRESOLVED | Stable gateway request IDs, durable journal, conservative unknown/denial fences and no automatic retry implemented. Full cancellation, concurrent calls, crash/restart/resume and resource reconciliation still require host-specific evidence. |
| I08 Delivery and operation | UNRESOLVED | Candidate runbook and independent packaging path exist. No published accepted combination, real-model install, upgrade, recovery/removal acceptance, complete overhead measurements or intervention record yet. |

Required tests that have not run are unresolved, not skipped passes. There is
no six-host or three-host completion claim in this record.

## Repairs completed

- Exact-session bonds replace the sole-bond and random-session fallbacks.
- Unknown, pending and malformed bridge decisions deny; bridge constructor
  errors are caught; failing or missing budget oracles never turn into zero
  spend. Budget zero is retained as a real bound.
- Compatibility hooks reject historical daemon `check` because it dispatches
  tools before the host dispatch and could duplicate effects.
- A trusted signer, capability, exact tool/server/parameters and successful
  receipt signature verification are required before admission. Receipt files
  use hashed session/tool identifiers and exclusive creation to reject replay.
  Authorization records remain after post-tool archiving as consumed-identity
  markers, so a completed operation cannot reopen its admission slot.
- Authorization persistence happens before allow. Post-tool events are bound
  to the original request and remain explicitly unverified host observations.
  Bad signatures are not archived as successful.
- Plugin state follows `CHIO_STATE_DIR` or isolated `CLAUDE_CONFIG_DIR`.
- Private-path checks canonicalize symlink ancestors and reject workspace
  descendants with names such as `..private`.
- The launcher pins the installed host and bundled gateway hashes and accepts
  only a prepared private gateway config and fixed host flags.
- The legacy destructive smoke script is inert text. The replacement creates
  disposable workspaces/profiles and never cleans up normal plugin state.

The 28 hook and launcher regression tests pass without skips. They use explicit bridge
fixtures and establish unit behavior only. Build/typecheck/package tests do not
replace any host gate.

## Exact external blockers

The normal local Claude profile is authenticated, but a fresh isolated profile
reports `loggedIn: false`. No `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or
`CLAUDE_CODE_OAUTH_TOKEN` is provided. No credentials were copied from the normal
profile or keychain. A designated supported authentication method is required
for authenticated real-model acceptance. Publication of the qualified kernel,
SDK, bridge and plugin combination is also pending shared release gates.

Independent implementation, real-host deterministic probes and real-kernel
resource checks continue despite these blockers. Auth absence is not a reason
to substitute unit tests for a completed integration.

## Source and package CI

The source workflow now installs the vendored dependencies directly, requires
typecheck/build/unit success, stages the candidate and validates installation
using a new empty offline npm cache. It no longer clones placeholder sibling
repositories or turns a missing authenticated host into a green smoke step.
This workflow is source/package validation only. The separate historical
release workflow still depends on a placeholder `owner/chio-ci-actions` action;
publication remains unresolved and its provenance requirement is retained.

## Immutable kernel and installed artifact rerun

The final runtime source is `04b7d366d62c886c39bc202f58ef0d44e8f5aee7`.
Kernel binary SHA-256 is
`e7539855906bd5eb7b4eb2e5a12ca0533889cf61ced3bf4adf5850b792aa6447`.
Policy SHA-256 is
`8c2c732d9115799b13150f7924da0e68fc1f9b2d42a2618912511d407035cc66`.
The policy is snapshotted and grants at most 64 invocations per capability.
The resource image is
`sha256:0106edcb15a1c0d12d914ea0504f0e63ec85f5e6fdd3825b4d7a0d1367af3991`.
[Public provenance](final-kernel-provenance.json) records the signer and volume.

The candidate tarball
`ceb271110be042c317128b94bbdc2fe7edb66757bc60a77cf404ed268105c7b5`
was installed using an empty offline npm cache. Real-host probes used its
installed launcher and bundled gateway
`1af105d6ed8b3c03b17407ebec14e1ee746d9bfc1c935236c7e2f087e36c2e93`.
A later shared gateway startup fix for symlinked entry paths supersedes this
artifact for delivery; its replacement requires a further host rerun. Neither
artifact is described as an accepted release.

The `raw/final-*` runs establish these bounded observations:

- The useful remote workflow succeeded with verified results and the exact
  independently observed file content. The observed fixture run took 4.081 s
  including process launch and resource observation; this is not real-model
  latency or production overhead.
- All 25 default native tools were unavailable. Independent forbidden secret
  reads and writes were denied. Attempts to overwrite private configuration
  returned a verified filesystem error; the private file hash stayed unchanged.
- An unreachable kernel, malformed preflight and timed-out preflight prevented
  dispatch. A per-session proxy cut the kernel transport between two calls:
  the first file committed, the second did not. No shared kernel was killed.
- Killing only the selected stdio gateway after the first verified result
  preserved that result, prevented the second write and left a retained journal
  lock. Native fallback remained unavailable.
- Incorrect pinned subject, capability or kernel session produced no dispatch.
  A real capability allowed exactly 64 verified reads and denied the 65th.
  Separately prepared valid authority completed a legitimate read. An operator
  revoked only a dedicated Claude capability; the actual host could not use it
  to write a new resource.
- A proxy discarded the response after a real write committed. The gateway
  reported `unknown`, then rejected a host-driven retry of the same operation
  and a different write. The independent observer retained the first effect and
  no second effect; the proxy forwarded exactly one tool dispatch. Unknown
  execution was never reported as a verified success.

Earlier `loss-between-calls*` failures are retained. Their proxy routed to the
wrong path and received HTTP 404 before dispatch; they did not establish the
intended cutpoint. The corrected final proxy and immutable runtime passed. A
separate old-runtime initialization failure came from the operator changing
its unsnapshotted policy to a field unsupported by that old binary. The final
launcher uses a policy snapshot. Neither issue is attributed to missing access.

## Additional evidence and unresolved reruns

The revoked-capability real-host probe passed; only its dedicated capability
was revoked by the operator helper. A post-revocation fresh-session preparation
then failed, so that specific restoration sequence remains unresolved. A
separate earlier fresh-capability read passed, and is kept distinct.

The real-host wrong-signer probe altered an execution receipt after a known
resource commit. The gateway rejected the evidence, reported an unknown outcome
and fenced subsequent calls. An independent observer retained the original
effect and no second effect. Valid-other-request receipt replay and substituted
result probes were attempted, but the later runtime stopped returning preflight
context promptly; those probes never reached their mutation cutpoint and failed
probe integrity. Their failures remain in `CASE-INDEX.json`. They do not count
as successful evidence-substitution checks.

Three probe attempts also started before their dependent preparation completed.
They failed before starting the host because the private config was absent.
Those local coordination failures are retained as preflight records; none are
credited as acceptance.

The final artifact cascade remains open for shared gateway entrypoint and
session-credential changes. Tests tied to older gateway digests remain bounded
historical evidence until rerun against the final package and credential
contract. Source/package CI is blocking but hosted execution and release
provenance have not been claimed.


## Retained journal restart observation

A new actual Claude process attempted the exact private gateway configuration
retained by `final-unknown-outcome`, with the earlier independently observed
`UNKNOWN_FIRST_COMMIT` resource still present. The new host had no working MCP
tools because a `gateway.lock` remained with a dead PID. The journal preserved
its `unknown` record. The resource stayed unchanged and no second file appeared.
This is a failed recovery probe, retained in `raw/historical-restart-fenced`:
no-effect behavior alone does not establish usable restart or outcome recovery.
The operator did not erase the lock or journal. This run used historical gateway
`1af105d6...` and made no claim of a new kernel dispatch.

The probe now also requires the intended attested denial or explicit failure
outcome for each negative case, so generic gateway unavailability cannot satisfy
a capability or receipt-rejection check. An actual-host interruption after the
resource commit is implemented as a separate `cancel-after-dispatch` scenario;
it remains unexecuted until the shared current runtime and artifact are ready.
The separate `parallel-calls` scenario emits two tool calls together and requires
distinct verified request identities plus both independent resource effects;
it is likewise unexecuted pending that current runtime.


## Process boundary and read-observation limits

The fixed launcher successfully removes all observed model-callable native
tools. It does not apply operating-system confinement between the Claude host
and its stdio gateway, which share a user. Configuration and journal paths
outside the workspace do not defend against arbitrary code execution inside
the host process. Session-limited credentials alone do not prevent that code
from rewriting a local uncertainty ledger or sending a fresh permitted request
directly to the kernel. The stronger process-compromise boundary remains open
pending an operator-external gateway/journal or equivalent resource-owner
mechanism. No arbitrary-process isolation is credited to the native-tool tests.

The independent file observer proves absence of forbidden file mutations. For
a forbidden read, unchanged file hashes do not establish absence of the read
itself. The probe has a verified denial and no secret returned to the model;
an independent backend dispatch/access record is still needed to establish
prevention at that read boundary. That requirement is not removed from I03.
