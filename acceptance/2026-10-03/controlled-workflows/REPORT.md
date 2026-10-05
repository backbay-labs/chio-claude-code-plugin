# Controlled native workflow candidate

**Version: 0.4.0-rc.4. Production qualification: incomplete.**

The candidate joins guided task preparation, artifact-bound completion evidence,
exact review, native continuation and verified original-result receipt. The
kernel retains execution authority. Native controls use the same serialized
gateway and original operation; they do not initialize another execution session
or acquire administrator credentials.

Confidence is **high** in the recorded source and bounded host-fixture results,
**moderate** in the wider native integration, and **unknown** for production
resource recovery on this profile. The [earlier rc.1 record](../native-mods/REPORT.md)
is preserved; it does not qualify the new artifacts.
The [rc.2 report](./REPORT.rc2.md) and [rc.2 record](./ACCEPTANCE.rc2.json) remain
historical evidence. The [rc.3 report](./REPORT.rc3.md), [rc.3 record](./ACCEPTANCE.rc3.json)
and [rc.3 host fixtures](./HOST-FIXTURES.rc3.json) are also preserved.
The [code review](./CODE-REVIEW.md) records the revised candidate's fixes.
The [dedicated environment report](../qualification-environment/REPORT.md)
records shared VM recovery and the earlier live enforcing failures.
Those resource/provider experiments were not repeated or promoted by this review.

## Delivered behavior

| Capability | Candidate behavior |
| --- | --- |
| Completion evidence | Separate requirements bind the exact task revision and artifact. Changed commits, dirty checkouts and foreign reports cannot inherit passing observations. Readiness is a read-only projection. |
| Guided scopes | Private operator catalogs, exact delegated preparation, native template requests, expiry and stale-template detection. Template selection performs no grant or protected tool call. |
| Exact continuation | Accepted original grants resume through the existing queue, using retained arguments. Durable claims refuse duplicate submissions and changed, foreign or uncertain operations. |
| Original result receipt | The native client hashes the full returned result before sending the matching challenge. Trusted verification and kernel ACK preserve the original dispatch fence. |
| Delivery provenance | Native result receipt, kernel acknowledgement and model delivery remain distinct. An unconfirmed kernel ACK cannot be presented as model delivery or clear the fence. |
| Typed integration | Standalone manifest type contract and `$.chio` namespace for status, task, review intent, proposal, continuation, outcome receipt and explanation. Expanded connector deployments remain unqualified. |
| Trusted review inbox | Outside-host CLI lists review intent, exact actions and task-scope requests. A separate operator credential confirms exact signed kernel decisions. Remote review UI and reviewer-role workflows are future work. |
| Handoff | Private task state survives model context loss; an operator-signed capsule retains task requirements and original operation IDs without credentials, authority or budget transfer. |
| Decision explanation | Signed receipt reasons retain kernel provenance; gateway reasons remain gateway observations. Policy rehearsal, versioned resource previews and authoritative information lineage are unavailable. |

The native commands add `/chio-task`, `/chio-completion`, `/chio-continue`,
`/chio-outcome`, `/chio-why` and read-only `/chio-doctor`. Command registration failures are isolated, so
a name collision does not prevent later startup work and status refresh. The
complete compatibility inspector remains future work.

The completion service does not run collectors from buttons or the host API.
JSON reports are bounded and artifact-bound. Explicit operator command
collectors run outside Claude with limited environment, time and output, but
retain the operator's filesystem access; they require trusted code and a
separately qualified check environment. Protected test execution and a pure
policy rehearsal are not established by these collectors.

## Recorded checks

The selected host is **Claude Code 2.1.287**, SHA-256
`6eab8333fe2121553100d8f40bfada384a3e989b94f947e18ba6677a6fcb41ea`.
Host declarations come from that exact binary. The tested profile still needs
explicit process opt-in. Local tools were Node 25.5.0, npm 11.8.0, Python 3.11.4,
pyte 0.8.2 and wcwidth 0.9.1. Hosted CI uses its own recorded toolchain and is a
separate result.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Typecheck and build | Passed | Source, retained host declarations and self-contained runtime bundles |
| Node regressions | 88 passed | Compatibility, exact signed decisions, task provisioning, artifact changes, continuation, result proof, unconfirmed ACK, restart fences, collector cancellation and operator diagnostics |
| Native event/drawing harness | 21 passed | Actual selected harness with stubbed APIs, including task readiness, scope requests, continuation controls and session diagnosis |
| Middleware control-flow experiments | 4 passed | Actual selected harness with stubbed dispatch; failed uncaught mod hook is skipped |
| Actual host and macOS sandbox | 8 passed | Deterministic local model and stubbed kernel/resource owner, including natural workflow exit |
| Cold consumer | Exact tarball sidecar | Offline install and marketplace tree without dependencies; complete live activation remains open |
| Publication guard | Refused as required | `productionQualified` remains false |

[ACCEPTANCE.json](./ACCEPTANCE.json) pins the source/runtime artifacts and records
the remaining release gates. [HOST-FIXTURES.json](./HOST-FIXTURES.json) retains
public case evidence. Raw profiles, scoped credentials and host debug logs remain
outside the repository.

## Actual terminal workflow

The new fixture launches the delivered native profile on the selected actual
host and macOS sandbox. It observes:

1. A completion pane with one passing local observation, running hosted checks
   and the exact selected artifact; no model request is needed to inspect it.
2. A model-created exact write proposal retained without resource dispatch.
3. An exact signed fixture decision saved by the trusted outside-host fixture.
4. `/chio-continue` resuming the original operation without a planning turn.
5. One disposable fixture file effect and one fixture charge.
6. `/chio-outcome` receiving the verified original bytes and confirming their
   receipt through the native-control challenge and one kernel-fixture ACK.
7. Natural `/exit`, host exit 0 and launcher execution outcome `completed`.

The last model request predates approval. The final exit record reports
**zero model-result deliveries and one native-control delivery**. This proves
the stated delivery channel in this fixture; it does not imply that a model read
the continued result or that the business task is ready. Its hosted requirement
remains running.

Retained terminal screens:

- [Completion](./interactive-workflow.completion-screen.txt)
- [Exact review](./interactive-workflow.review-screen.txt)
- [Verified result receipt](./interactive-workflow.outcome-screen.txt)

The original seven fixture cases also pass on this candidate: held write,
unadvertised Bash refusal, immediate status, private-file/process/network route
probes, disconnected-mod initialization refusal, exact interactive review, and
authenticated session change after clear. The route/disconnection probes use
separately identified test-modified copies. The drawing harness's additional
surfaces are component tests, not actual mobile or VS Code pane support.

## Recovery and remaining gates

The new controller restart checks recover a gateway-retained verified completion
and recognize a retained ACK after interrupted projection writes, without a second
effect, charge or ACK. A substituted journal operation cannot inherit another
request's signed completion, delivery flags or a clear fence.

The uncertain-resource restart regression commits a simulated effect, loses its response, closes
and reopens the controller/gateway, then confirms that the original unknown ID
and continuation remain fenced with one effect and one charge. It does **not**
reconcile a real resource's original result. That separate acceptance experiment
still requires a qualified Chio owner.

[OWNER-PREFLIGHT.json](./OWNER-PREFLIGHT.json) preserves the earlier containerd
and guest-shell I/O failure. The shared VM recovered availability after preserved
checkpoints and a controlled restart; all six services and volume bindings were
retained. Its original filesystem still needs offline inspection. Database and
Redis backups were restored independently without network access.

The dedicated x86 Linux owner now provides actual negative qualification
evidence. An exact kernel-confirmed native write occurred once, then seccomp
killed the writer's `fsync` before a result returned. Restart retained the
original unknown operation and one captured invocation without redispatch.
The Docker resource profile separately fails enforcing MCP initialization.
These experiments do not establish verified original-outcome recovery. The
selected provider's login and bounded live check are recorded separately from
protected-resource qualification. See [the complete follow-up](../qualification-environment/REPORT.md).

Live kernel decisions, resource custody, provider behavior, complete
reload/resume/branch/reconnect lifecycle, original-outcome recovery and supported
deployment activation remain open. No tag, npm publication, merge or production
qualification is established by this report.

Managed mod policy, authoritative information-flow lineage, non-dispatch policy
rehearsal, versioned owner previews, multi-operation plans, budgeted delegation
and admission suspension/drain require additional kernel/deployment work. The
operator CLI inbox and signed handoff are initial surfaces; they do not establish
remote reviewer identity, assignment or automatic cross-session authority.

Reproduction and operator instructions are in
[CONTROLLED-TASKS.md](../../../docs/CONTROLLED-TASKS.md). The original feature
proposal is preserved in
[the opportunity addendum](../../../docs/research/2026-10-03-claude-code-mods-feature-opportunities.md).
