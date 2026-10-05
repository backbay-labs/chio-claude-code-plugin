# Claude Code mods: additional Chio workflows

Research date: 2026-10-03. This is a product and architecture addendum to the
[original proposal](./2026-10-02-claude-code-mods.md), not an implementation or
production qualification record.

## Recommendation

The strongest argument against expanding the feature list is that Anthropic
already supplies a diff pane and examples of edit replay and context monitoring.
A general Claude enhancement suite would compete with the host while increasing
Chio's integration and qualification burden. The additional work should make a
controlled task easier to start, complete and independently assess.

Prioritize three connected additions: evidence-backed task completion, guided
task authority profiles, and deterministic continuation of an approved exact
operation. Then make that workflow reusable by other mods through a typed Chio
integration. Confidence is **high** in the technical opportunity and **moderate**
in this product ordering; customer demand and willingness to pay are unmeasured.

## Current baseline and research scope

The native candidate reviewed is 0.4.0-rc.1 at commit
e5919d13488bef0382efb934895f42f8d1d36106, on
feat/claude-native-mods-20261002, in draft
[PR #3](https://github.com/backbay-labs/chio-claude-code-plugin/pull/3).
Its [runbook](https://github.com/backbay-labs/chio-claude-code-plugin/blob/e5919d13488bef0382efb934895f42f8d1d36106/docs/NATIVE-MODS.md)
and [acceptance report](https://github.com/backbay-labs/chio-claude-code-plugin/blob/e5919d13488bef0382efb934895f42f8d1d36106/acceptance/2026-10-03/native-mods/REPORT.md)
establish the scope of the existing work.

Already implemented: compact scope/status, native commands, exact-argument
review, evidence and recovery requirements, scoped review intent, trusted
operator confirmation and a candidate interactive protected launcher. Existing
status and review interfaces are therefore not counted as new features here.

Concrete gaps in the inspected candidate:

- Accepted approval still requires explicit chio_resume. Approval does not
  dispatch the effect.
- Setup and trusted confirmation use operator-side configuration and a CLI.
- The public review projection reports detailed restrictions and budget impact
  as unavailable.
- Alternative requests are retained; semantic remedies are not generated.
- There is no task-level completion contract or shared API for other mods.
- The protected profile disables native tools, including Agent, and pins its MCP
  inventory. Native subagents and additional registered tools need a revised
  host contract.
- Live kernel decisions, provider behavior, full lifecycle qualification and
  one-effect/one-charge recovery remain acceptance work. This addendum does not
  qualify them.

Live official docs were reread. The two upstream repositories' HEADs were checked
with git ls-remote and still match the inspected source snapshots:

| Repository | Commit |
| --- | --- |
| anthropics/claude-code | 1c229fcd1e1e4e452e29a8f116b45fe4cfe2c528 |
| anthropics/claude-code-playground | 569c5283d9a0a7ee7938df85bb32e4f48cbb8c86 |

No new runtime experiment was run for this research pass. Source and document
inspection should not be described as end-to-end execution evidence.

## New findings that affect product design

The [overview](https://code.claude.com/docs/en/plugins/mods/overview) limits pane
rendering to the terminal and Code Desktop. VS Code chat, SDK/print and cloud
sessions do not render these panes. Remote Control displays them in the machine's
terminal. A shared review product needs a separate surface or text fallback.
The overview also says the early-access environment flag is ignored from
2.1.287 onward. The candidate's recorded exact binary required it. Investigate
that discrepancy against the pinned binary and rollout environment before
changing activation behavior.

The [interface guide](https://code.claude.com/docs/en/plugins/mods/interface)
documents a store shared across sessions with non-atomic read/change/write. It
also explains that clear, resume and branch reset session state without rerunning
session.start. Persist preferences there; keep authority and operation state in
the trusted journal and rebind explicitly after identity changes.

The [API guide](https://code.claude.com/docs/en/plugins/mods/api) provides immediate
commands, timers, model calls and session messaging. Registering a taken command
name throws and skips the rest of that startup hook. Pane-only commands can
return an empty result to avoid adding their text to model context. Model calls
use the user's plan or API key. Message delivery means queued, not accepted
authority or completed work; incoming sender names are claims.

The [reference](https://code.claude.com/docs/en/plugins/mods/reference) documents
engine.create for adding an API namespace and plugin.register for reviewing mod
inventories. The
[telemetry implementation](https://github.com/anthropics/claude-code/blob/1c229fcd1e1e4e452e29a8f116b45fe4cfe2c528/mods/telemetry/hooks/register.ts)
and its
[manifest](https://github.com/anthropics/claude-code/blob/1c229fcd1e1e4e452e29a8f116b45fe4cfe2c528/mods/telemetry/.claude-plugin/plugin.json)
demonstrate adding a typed namespace. This supports a Chio integration for other
mods; its implementation must still be checked against exact host declarations.

The [event guide](https://code.claude.com/docs/en/plugins/mods/events) documents
turn completion, middleware ordering and failed-hook skipping. A completed model
turn is a refresh trigger, not evidence that a business task succeeded. The
[organization guide](https://code.claude.com/docs/en/plugins/mods/admin) states
that managed mod policy does not sandbox mods and that privileged organizational
installation has a specific directory-marketplace contract.

## Ranked opportunities

Effort below means dependency scope, not elapsed-time estimates. All proposed
command and API names are illustrative and unimplemented.

| Priority | Addition | User value | Principal dependency |
| --- | --- | --- | --- |
| First | Evidence-backed completion | Know whether a task is actually ready | Trusted evidence collectors and artifact identity |
| First | Guided task profiles | Start useful work with precise scope | Operator provisioning and kernel authority templates |
| First | Continue an approved exact action | Finish review without another planning turn | Narrow continuation control and delivery qualification |
| Near term | Compatibility and coverage inspector | Understand why controls are unavailable | Read-only configuration and launcher projections |
| Next | Policy rehearsal and versioned previews | Understand a denial or impending change | Non-dispatch policy query and resource adapters |
| Next | Information-flow lens | See which data permits which destination | Kernel-owned labels and transformation lineage |
| Next | Trusted review inbox | Let a separate reviewer act while Claude works | Authenticated approver service and scoped projections |
| Next | Durable task handoff | Resume work without copying live authority | Trusted task/session bindings and authorized capsule |
| Later | Exact multi-operation change plans | Review a bounded workflow once | Immutable manifest and per-step lifecycle |
| Later | Chio API for other mods | Make governed connectors cheaper to build | Typed namespace, scoped transport, qualified mod set |
| Later | Delegation and budget controls | Bound a team of agents | Attenuation, child identity, authoritative accounting |
| Later | Suspend admission and drain | Contain a task while retaining its outcomes | Kernel suspension and in-flight operation semantics |

### 1. Evidence-backed task completion

An operator defines what ready means when the task starts. For a software change,
that could require a selected test suite on the exact commit, hosted CI on the
same commit, a deployment tied to that artifact, and an independent acceptance
check. A compact completion view reports which requirements have evidence and
which remain outstanding.

Illustrative display:

```text
Fix checkout regression · commit a1b2c3d
Local checks       passed · exact artifact
Hosted checks      running
Preview deployment verified · exact artifact
Production check   outstanding
Release action     requires review
```

The task contract lives outside the model transcript. Each record includes its
subject/artifact digest, collector, observation time and verification class.
Changing the commit invalidates evidence that no longer applies. A model's
summary cannot mark a requirement satisfied. Requiring evidence before an
irreversible release action is a separate kernel admission rule.

Start read-only. Collect CI and deployment facts in the trusted service, rather
than spawning project processes from a timer inside the confined host. A
turn.complete event can request a refresh without claiming completion.

Acceptance: old-commit CI, a preview deployed from a different commit, missing
production observation and an interrupted turn all leave the correct requirement
outstanding. Confidence: **high** in feasibility; **moderate** in prioritization.

### 2. Guided task authority profiles

A task-start flow replaces manual assembly of credentials and launch flags with
operator-reviewed templates. Examples: inspect a dataset, edit a specified
repository, deploy one preview artifact, or draft a customer response with an
approved destination. The user sees resource, effect scope, information
restrictions, expiry and applicable budgets before starting.

A proposed /chio-task command selects a template or asks for an allowed scope.
The trusted provisioner validates it and creates the actual session authority.
The mod cannot mint or broaden its own grant. A UI template is a convenient
description; the kernel contract determines what is allowed.

This is especially valuable for cold installation: the first successful task
should not require understanding the private gateway configuration format.
Templates must expose narrower choices when the operator cannot grant a request.

Acceptance: changing repository, target environment or expiry requires new
validated authority; a review-only task cannot write; selecting a template never
creates authority solely through the viewer credential. Confidence: **high** in
the usability gap; **moderate** in service implementation scope.

### 3. Deterministic continuation after accepted review

After the kernel accepts authority, expose Continue this exact action. The
existing candidate's explicit-resume requirement otherwise leaves the user with
a granted action that Claude must be asked to resume.

Keep the existing viewer credential intent-only. Add a separate trusted control
request bound to the original operation, its accepted decision, expiry and
current state. The gateway rechecks the binding and resumes according to its
actual lifecycle. This must not become a general tool-call endpoint.

Calling a connected MCP tool from a mod is technically possible, but it does not
by itself qualify outcome delivery through the existing model relay. The command
path needs its own evidence and acknowledgement contract. For an unknown effect,
offer reconciliation of the original operation. For a frozen denial, a permitted
change creates a linked operation. Do not give all states the same Continue path.

Acceptance: repeated button presses, a lost control response, expired authority
and a changed action cannot create another effect; retained delivery state is
correct even when no model turn follows. Confidence: **moderate** until joined
kernel and delivery behavior is qualified.

### 4. Compatibility and coverage inspector

A proposed /chio-doctor explains the actual current host and protection scope:
host version and artifact identity, native module loading, supported rendering
surface, command availability, selected MCP inventory, control freshness, session
binding and enabled launch profile. It should suggest a concrete repair for a
missing prerequisite without implying that a successful connection proves
resource confinement.

The candidate registers commands sequentially before its first refresh. A name
collision can therefore prevent later startup work. Isolate registration failures
and retain an independently visible startup result. Keep textual status commands;
pane-only commands should avoid unnecessarily appending exact review payloads to
model context when a pane already presents them.

Acceptance: a command collision, disabled module, unsupported pane surface and
foreign session each produce an accurate diagnosis. Confidence: **high**.

### 5. Policy rehearsal and versioned resource previews

Let the user inspect why an exact proposal is denied, which prerequisite is
missing and how a permitted alternative would differ. A proposed /chio-why can
show the policy clause, resource restriction and authority needed, without asking
a second model to invent the reason.

A preview comes from a resource-owner adapter against a specific immutable
version: exact file diff, message recipient and body, or bounded database change
set. The query has an explicit non-dispatch contract. Admission and commit still
recheck policy, authority, budget and resource version. If the underlying object
changes while review is open, the old preview and decision cannot silently apply
to the new object.

Dry run is not a blanket safe classification. Arbitrary migration tools and
project scripts can have effects. A hypothetical verdict is not a transferable
grant; it also does not reserve a budget unless that is an explicit contract.

Acceptance: a version change invalidates the preview; rehearsal creates neither
an effect nor an authority grant; an approved target cannot be swapped after
review. Confidence: **moderate**, dependent on actual kernel query and adapter
contracts rather than UI capability.

### 6. Information-flow lens

Attach origin and permitted-use information to a consequential operation:

```text
Private support record
  -> permitted redacted draft
  -> approved recipient and destination
```

Users should be able to see what information a message or artifact contains,
which restrictions it retains, and which trusted transformation permits its
release. Useful cases include customer support, internal research and sharing
snippets from confidential code.

The kernel and resource owner supply authoritative labels and lineage. Tool-row
correlation and heuristic secret detection can assist inspection but cannot prove
that a generated paraphrase preserves every restriction. If lineage is absent,
display unknown. A discarded or redacted model-visible result does not reverse
an already committed effect.

The pinned host's session.append contract allows some surfaces to show content
before that hook rewrites the retained transcript. Therefore source withholding
or redaction before delivery is necessary for confidential output; a transcript
rewrite cannot establish that no client saw the original.

Acceptance: a model paraphrase cannot shed a protected label; an unverified
transform or unknown lineage cannot yield an authorized-release indicator.
Confidence: **high** in value; **moderate** in feasibility of the joined flow.

### 7. Trusted review inbox and reviewer handoff

Provide an authenticated review surface outside the Claude host. A reviewer can
inspect the exact request, request a narrower alternative, approve within their
authority, or decline while Claude is occupied. This supports terminal teams and
users whose VS Code or mobile client cannot show a mod pane.

The mod shows requested, submitted and accepted states from the trusted service.
Notifications contain scoped identifiers or authorized summaries. Sending a
message to a peer session does not delegate approval authority. Reviewer identity,
expiry, action binding and any multi-person approval policy are checked by the
service and kernel. Keep operator keys out of the plugin, transcript and mod
store. An external confirmation surface can also reduce reliance on a UI that
other installed mods may restyle.

Acceptance: foreign reviewers, stale requests, reassignments and two concurrent
decisions cannot grant authority outside the chosen policy. Confidence:
**moderate**; this is an identity/service product, not just another pane.

### 8. Durable task handoff

Keep an authorized task capsule with goal, verified artifact identities,
outstanding requirements, pending review identifiers and original uncertain
operations. On compaction or a host transition, reconstruct the capsule from
trusted retained state rather than an LLM summary.

Model-facing context is advice. Session authority must be rebound or attenuated
by the service under the actual kernel lifecycle. A fork must not copy a live
credential or duplicate a parent budget. Task continuity and execution authority
are separate bindings, and unknown effects retain their original identities.

Acceptance: reload, clear, resume, branch and two concurrent sessions cannot
inherit foreign reviews or overwrite each other's retained work. Confidence:
**high** in the lifecycle requirement; **moderate** in a seamless handoff product.

### 9. Exact multi-operation change plans

Review a bounded manifest such as prepare artifact, deploy preview, verify, then
request production release. It fixes each effect's payload or artifact digest,
destination, preconditions, expiry and budget rule, with per-step operation
identities. New or altered steps need a new manifest revision and the applicable
authority decision.

The user can inspect completed, unstarted and uncertain steps separately. A
partial success is not hidden behind one failed workflow badge. An uncertainty
fence prevents dependent dispatch until the original effect is reconciled.
External services do not become one atomic transaction because their steps share
a pane. A compensating change is a newly authorized operation with its own receipt,
not an erased history or an unconditional Undo.

Acceptance: failure halfway through preserves each outcome and charge; changed
destinations invalidate review; recovery does not rerun committed steps.
Confidence: **moderate**; implement after the single-operation flow works.

### 10. A typed Chio integration for other mods

Provide a small shared namespace for resource previews, execution proposals,
authorized status and original-outcome lookup. Other mods could offer GitHub,
database, support or deployment workflows while using the same trusted gateway,
review service and kernel receipts.

The official engine.create extension pattern and manifest types make a native
integration possible. Its API names and exact result types are design work.
Collaborating mods submit proposals under scoped caller identity; they do not
receive operator credentials or infer accepted authority from a successful
transport response.

A Chio dependency only governs effects that actually use the protected boundary.
A connector retaining unrestricted direct credentials and effect routes needs
separate confinement. The current protected launcher stages a selected mod and
exact tool inventory, so adding dependencies requires pinning and qualifying the
expanded set. A minimal integration should first use existing protected tools.

Acceptance: two different connector mods share the same authority, operation
identity, review and recovery lifecycle; a missing Chio dependency cannot cause a
protected operation to fall back to an ungoverned route. Confidence: **high** in
the extension mechanism; **moderate** in its adoption potential.

### 11. Budgeted delegation as an extension of the earlier proposal

The original proposal already included cost and subagent visibility. The useful
extension is operational control: give a read-only research child a narrower
resource set, a fixed reservation and an expiry, and show its actual delegated
subject alongside observed host agent activity.

Host agent identifiers and sender names are correlation, not kernel authority.
The service must bind each child subject, enforce attenuation and retain budget
accounting across failures. Model-provider usage, subscription limits, cost
estimates and protected-tool charges need distinct units and verification labels.
Show available, reserved, committed and unresolved amounts only when the relevant
authoritative service exposes them.

The current profile has no native Agent tool. Its provider relay and tool inventory
also need qualification for child/model-fork traffic. Do not present this as a
small dashboard addition. Acceptance: siblings cannot spend one reservation
twice or gain parent authority by messaging; unknown charges remain accounted
for. Confidence: **moderate**.

### 12. Suspend protected admission and drain

An immediate control suspends new protected dispatch while the operator examines
an unexpected change. It reports whether the request was accepted and which
operations were already admitted, dispatched, completed or uncertain. It does
not disable Chio enforcement or claim to stop every native host activity.

This differs from permanent revocation and from terminating Claude. Resumption
requires an authenticated decision and current authority. Cancellation cannot
promise to reverse an irreversible in-flight effect. The kernel must define
admission linearization, suspension and drain semantics before the UI offers this
control.

Acceptance: a suspension racing with admission produces one explainable ordering;
already-dispatched work is reconciled, and no later protected admission slips
through. Confidence: **moderate**, dependent on kernel support.

## Product use cases worth demonstrating

| Workflow | Smallest convincing demonstration | Required truth |
| --- | --- | --- |
| Fix a bug and prepare a PR | Scoped repo task; exact-commit checks; ready/outstanding view | Old-commit evidence cannot satisfy the task |
| Deploy a documentation change | Preview artifact review; exact deployment provenance; separate production acceptance | A successful deployment response does not prove user-facing acceptance |
| Process a private support record | Restricted read; trusted redaction; exact recipient review; one send | Data restrictions persist; a lost reply does not produce a second send |
| Prepare an operational change | Versioned preview; exact bounded manifest; admission and drain view | Changed resource state invalidates review; partial outcomes remain visible |
| Run cooperating specialists | Distinct read-only and edit subjects; reservations; authorized handoff | Host messages do not manufacture delegation or duplicate budgets |
| Publish a third-party connector mod | A small typed Chio integration for a real protected operation | One kernel lifecycle governs admission, review and recovery |

These are proposals. The first release demonstration should still complete the
existing disposable-resource experiment and live decision/recovery gates before
promising production support, deployment or communication workflows.

## Delivery and evaluation

1. Finish the candidate's live kernel, provider, lifecycle and original-outcome
   qualification. Keep recorded fixture evidence distinct from those results.
2. Add compatibility diagnostics and read-only task completion with one exact
   artifact collector. Test with old-commit and absent evidence.
3. Join a guided task template, trusted exact review and deterministic continuation
   for one disposable protected effect. Verify one effect and one charge across
   interruption and duplicate control requests.
4. Implement one resource-owned versioned preview and one real task workflow.
5. Extract the stable integration into a typed API and test it with two connector
   mods. Add shared review and delegation when their backend contracts exist.

Measure time to first protected task, review-to-verified-outcome completion,
manual operator steps, unresolved-outcome rate, duplicate effects and the amount
of connector-specific authority code eliminated. These are proposed measures;
no adoption or conversion baseline was collected.

## Features to leave out for now

- Generic token weather, diff clones and edit replay. The
  [built-in diff](https://github.com/anthropics/claude-code/blob/1c229fcd1e1e4e452e29a8f116b45fe4cfe2c528/mods/diff/README.md)
  and [Replay Theater](https://github.com/anthropics/claude-code-playground/blob/569c5283d9a0a7ee7938df85bb32e4f48cbb8c86/claude-code/mods/replay-theater/README.md)
  already cover those interaction patterns.
- Automatic model watchers that spend the user's plan or start new work without
  an explicit product choice. Read-only service projections and timers are enough
  for status refresh.
- A model risk score that issues authority, broad approval of the next several
  commands, or retry controls that change an uncertain operation's identity.
- Preview code that starts project programs inside the confined host.
- A generic Bash proxy, universal data-loss-prevention claim or assertion that
  every installed third-party mod becomes confined by depending on Chio.

The intended addition is a reusable controlled-task workflow: explicit scope,
inspectable consequences, accepted authority, verified completion and retained
uncertainty. Confidence in that direction is **high**; the ordering of the larger
collaboration and platform features remains **moderate**.
