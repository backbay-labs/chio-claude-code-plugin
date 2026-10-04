# Controlled tasks in Claude Code

Version **0.4.0-rc.3** connects task scope, artifact-bound completion evidence,
exact review and deterministic continuation to the native session interface.
The kernel admits and executes protected operations. The mod presents authorized
projections and requests; operator credentials and the authoritative execution
journal remain outside Claude.

The [recorded acceptance](../acceptance/2026-10-03/controlled-workflows/REPORT.md)
includes the selected host's event harness and real terminal fixtures. Live
kernel/resource recovery and supported deployment qualification remain open.

## Start an exact task

The operator creates a **private** catalog using
[the annotated example](../examples/controlled-task/catalog.example.json).
Copy it to an operator directory, set mode `0600`, and replace its placeholders
with the selected resource owner, capability, tools and evidence endpoints.
Templates describe resources, destinations and restrictions; these descriptions
are not a signed kernel policy projection. The kernel separately validates the
delegated session. Budget detail is unavailable in the selected bridge contract.

Create a private operator file with `endpoint`, `bearerToken`, `adminToken` and
`trustedSigners`. The bootstrap and administrator credentials must differ. They
are used by the trusted provisioner and never placed in the mod configuration.

```sh
node scripts/task.mjs list --catalog /operator/private/tasks.json

node scripts/task.mjs prepare \
  --catalog /operator/private/tasks.json \
  --template preview \
  --directory /operator/private/new-preview-task \
  --operator-file /operator/private/kernel-operator.json \
  --goal "Prepare this exact preview artifact" \
  --artifact-kind git_commit \
  --artifact-digest "$TASK_COMMIT" \
  --artifact-label "Preview commit" \
  --checkout /operator/selected-clean-checkout
```

Preparation creates a new host UUID, initializes a kernel session, exchanges
bootstrap authority for an exact delegated tool scope and lifetime, verifies
the delegated context, checks the template's expected capability, and records
the private task contract. It performs no protected tool call. The output names
the new gateway configuration and task file; launch that configuration using the
[pinned native launcher](./NATIVE-MODS.md#protected-native-launcher-candidate).
The directory and guest profile must be new.

The bundled `dist/workflow/prepare.js` supplies the provisioner even in a
marketplace installation without `node_modules`. The operator files stay outside
the local workspace, guest profile and mod.

In an already bound session, `/chio-task` displays the current task and available
templates, including resources, destinations, restrictions, tool scope and
lifetime. `/chio-task preview` records a revision-bound preparation request.
Selecting a template grants no authority and does not replace the current
session. The operator inbox exposes the request; the operator prepares a new
session for it. The request becomes stale if its template changes and expires
after the shorter of 90 seconds and the template lifetime. Expiry of a request
does not revoke or transfer an existing authority grant.

## Observe completion

`/chio-completion` displays an exact artifact and distinct requirement states:

```text
Prepare exact preview · outstanding
Artifact: git_commit <exact commit>
Local checks       passed
Hosted checks      running
Production check   outstanding
```

Each retained observation binds the immutable task revision, artifact kind and
digest, requirement, observation time and source digest. A changed artifact or
task contract makes prior observations stale. If a checkout is selected, its
canonical path, exact HEAD and clean state are checked at collection and every
projection. Collection also checks the checkout after the collector finishes.
Dirty or changed work cannot inherit an earlier passing result.

The first version supports operator-owned JSON reports and explicit command
collectors. JSON reports must use HTTPS or exact loopback HTTP, cannot redirect,
are bounded to 1 MiB, and must name the exact artifact at the configured JSON
pointer. A report for another commit is refused. Only the configured passing
value passes; running, failed and missing results remain distinct. An observed
CI status is an observation of the configured report, not independent proof of
deployment behavior. Configure separate requirements for CI, deployment
identity, preview behavior and production behavior.

```sh
node scripts/task.mjs collect \
  --task /operator/private/new-preview-task/journal/workflow/task.json \
  --requirement hosted

node scripts/task.mjs status \
  --task /operator/private/new-preview-task/journal/workflow/task.json
```

Collectors execute only through this operator command; the host control API and
buttons do not run collectors. A command collector requires the exact clean Git
checkout and an absolute executable, uses no shell, receives a limited
environment without operator credentials, and has bounded time and output.
It still executes with the operator's filesystem access. Use command collectors
only for trusted code in a separately qualified check environment; the plugin
does not confine them or prove they have no effects. JSON reports are the
interface for checks run by a separately isolated CI or owner service. This
feature provides a read-only completion view, not protected test execution or
a non-dispatch policy-rehearsal API.

To select a newer artifact, use `task.mjs artifact --task PATH --artifact-kind
git_commit --artifact-digest COMMIT --artifact-label LABEL` and collect new
evidence. Old observations remain retained. A task is ready only when all its
current requirements passed. Readiness never grants authority or admits a
release; evidence-gated release admission requires kernel work.

## Review and continue the original operation

The existing review controls request an exact decision. The trusted reviewer
inspects the session and action outside Claude:

```sh
node scripts/control.mjs inbox \
  --gateway-config /operator/private/new-preview-task/gateway.json

node scripts/control.mjs confirm \
  --gateway-config /operator/private/new-preview-task/gateway.json \
  --intent "$EXACT_INTENT_ID" \
  --operator-file /operator/private/kernel-operator.json
```

Confirmation checks the exact revision, session, capability and original
arguments and requires the pinned SDK to verify the signed kernel decision.
The CLI inbox is the first outside-host review surface. It has no remote web or
mobile UI, reviewer assignment or organization role management yet.

After the decision is granted, **Continue this exact action** or
`/chio-continue REQUEST_ID` submits continuation into the existing gateway queue.
It does not start a planning turn. The request carries only the original ID and
revision; the parent rereads the retained arguments and rechecks live authority
and exact accepted approval immediately before resuming. A durable claim allows
one continuation submission per original operation. New, changed, stale,
foreign, ungranted and uncertain operations are refused.

The gateway's parent-only `controlCall` is an in-process capability. It shares
the existing HTTP gateway's serialization and retained authority and has no HTTP
route. The host still has one initialized MCP transport and the same bounded
tool inventory. Its source is adapted from the pinned vendored bridge; the
adaptation adds this parent capability and leaves the authority and execution
implementation in that bridge and the kernel.

Use **Receive original continuation result** or `/chio-outcome CONTINUATION_ID`
to receive the signed, request-bound original result. The client hashes the
complete returned envelope before returning its matching challenge. The trusted
service verifies the original outcome again before acknowledging receipt through
the gateway. Result receipt and kernel acknowledgement remain distinct when an
ACK is unconfirmed. The dispatch fence stays intact until the original result
and acknowledgement satisfy the gateway contract.

The native-control channel is retained separately from model tool-result
delivery. A native result does not establish that a model read it. The launcher
clears an earlier model-side awaiting-review observation only after exact native
delivery and kernel acknowledgement; its exit record reports the two channels
separately. A lost response, repeated button press or unconfirmed ACK cannot
create another protected effect. Unknown operations retain their original IDs
and require trusted resource reconciliation; no generic retry is offered.

## Explain a retained decision

`/chio-why REQUEST_ID` reads the retained reason. It labels a reason as a verified
kernel reason only when the exact signed receipt contains it; a gateway reason
retains its own provenance. It reports policy rehearsal and resource preview as
unavailable and information lineage as unknown. The selected bridge supplies no
qualified non-dispatch rehearsal or authoritative lineage contract. Tool history
and a model-written explanation cannot fill those gaps.

## Use Chio from another mod

The manifest publishes [types/chio.d.ts](../types/chio.d.ts). Its standalone
`Chio` contract is added through `engine.create` and available as `$.chio` to mods
that declare Chio as a dependency. See
[the connector fragment](../examples/controlled-task/connector.ts) and Anthropic's
[namespace reference](https://code.claude.com/docs/en/plugins/mods/reference).

The methods cover status, task, exact review intent, revision-bound task
selection, review-required proposal, accepted continuation, original native
outcome receipt and retained explanation. `propose` requires a caller-generated
UUID. Reusing that UUID with changed arguments is refused; losing the response
does not authorize a fresh proposal. Only tools configured to require review
can be proposed through this API; no direct effect fallback exists.

This is session-scoped authority shared by the participating mods. It is not
independent per-mod delegation. A connector retaining direct resource
credentials or other effect routes does not gain confinement by declaring this
dependency. The protected launcher stages only Chio; adding connector mods to
that profile requires a new pin and confinement qualification. Cross-mod
consumer/deployment qualification remains open.

## Preserve a task handoff

The task contract and observations live in the private service journal, outside
model compaction and the mod store. Clear, resume and branching do not copy them
into another host session or transfer authority. An authenticated foreign host
UUID still fences the original protected launch.

An operator can export a signed snapshot containing the goal, artifact,
requirements and original retained operation IDs:

```sh
node scripts/task.mjs handoff \
  --gateway-config /operator/private/new-preview-task/gateway.json \
  --signer-file /operator/private/handoff-signer.json \
  --output /operator/private/new-handoff.json

node scripts/task.mjs verify-handoff \
  --capsule /operator/private/new-handoff.json \
  --trusted-signer "$INDEPENDENTLY_PINNED_OPERATOR_KEY"
```

The private signer file contains an Ed25519 `seed` as 64 lowercase hexadecimal
characters. The exported snapshot contains no provisioner credential, approval
token or dispatch capability. Its signature is an operator attestation, not a
kernel receipt. The receiver must independently pin that operator's public key.
Verification produces an advisory snapshot, not live readiness or authority.
Prepare a separately bound session and recollect evidence. Reconcile uncertain
operations in their original source session; copying a task goal cannot clear
their fences or copy a parent's budget.

## Acceptance boundary

The real-terminal fixture demonstrates task evidence, signed fixture approval,
one disposable fixture write, native outcome receipt, one fixture charge and
natural terminal exit. It uses a stubbed kernel/resource owner and deterministic
local model. It does not qualify a live Chio owner or live provider.

The new restart regression proves retention of an unknown operation and refusal
to dispatch it again. It does not recover a real resource's uncertain result.
Complete the selected live kernel, custody, provider and lifecycle gates before
publication. Managed mod policy, transparent native file tools, Bash confinement,
multi-operation plans, admission suspension/drain, remote review and budgeted
delegation require their remaining kernel and deployment contracts.
