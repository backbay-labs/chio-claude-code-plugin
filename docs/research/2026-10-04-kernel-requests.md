# Kernel and owner requests from the Claude Code integration

Date: 2026-10-04. This lists the kernel and resource-owner work the Claude Code
plugin needs next, with the evidence for each request. It proposes contracts;
it does not implement or qualify any of them. Paths beginning `chio/` are in
the kernel repository (`backbay-labs/chio`); they were checked on local `main`
(2026-08-03), and the gaps were re-checked against `origin/main` (2026-09-02).

## Summary

| # | Request | Unblocks in the plugin | Kernel status |
| --- | --- | --- | --- |
| K1 | Serve non-dispatch plan evaluation for a delegated session | `/chio-why` policy rehearsal; multi-operation change plans | Library and offline CLI exist; no served route |
| K2 | Operator API to settle an unknown outcome | Recovery workbench; the release blocker "one effect, one charge after recovery" | Saga states exist; no operator settlement route |
| K3 | Session budget-hold projection | "Budget impact unavailable" in review and task panes | Hold lifecycle exists; no session-scoped read |
| K4 | Parent-bound capability attenuation | Successors to the removed `/chio:budget-set` and `/chio:guard-pause`; budgeted delegation | Core types exist; sidecar route 403s, trust plane has none |
| K5 | Resumable session suspension | Suspend admission and drain | Designed, not started |
| K6 | Explain HTTP 401 for an unexpired credential after owner restart | Reconnect and credential lifecycle qualification | Observed, cause unknown |

The live-qualification blockers that sit on the resource-owner side are in
[the companion runbook](./2026-10-04-qualification-blockers.md).

## K1. Non-dispatch plan evaluation

**Need.** `/chio-why` can show only a retained reason today; the explanation
projection reports `policyRehearsal: "unavailable"`. Users and reviewers need
"would this exact call be allowed under my live grants, and if not, which guard
and which requirement" without creating a receipt, spending budget or
dispatching.

**What exists.** `ChioKernel::evaluate_plan` / `evaluate_plan_blocking`
(`chio/crates/kernel/chio-kernel/src/kernel/evaluation/evaluation_entry.rs:143`)
is pure: no receipt, no budget mutation, no dispatch, and it returns a
per-step `StepVerdict { reason, guard }`
(`chio/crates/core/chio-core-types/src/plan.rs`). `chio-http-core` has a
`handle_evaluate_plan` handler for `/evaluate-plan`, but no shipped server
mounts it. `chio check --mode preflight|full` runs a throwaway kernel against a
fixture tool, which does not answer the question for live grants.

**Request.** Mount plan evaluation on the server that already validates the
delegated session (the MCP edge or the trust plane), authenticated with the
same delegated session credential the gateway uses:

```text
POST /v1/sessions/{sessionId}/evaluate-plan
{ "steps": [{ "requestId": "...", "tool": "write_file", "serverId": "...", "arguments": { ... } }] }
→ { "schema": "chio.plan-evaluation.v1", "evaluatedAt": ..., "policyRevision": "...",
    "steps": [{ "requestId": "...", "verdict": "allow|deny|requires_approval", "reason": "...", "guard": "..." }],
    "receiptIssued": false, "budgetChanged": false, "dispatchPerformed": false }
```

**Contract the plugin will rely on.** The three `false` flags are guarantees,
not hints; a verdict is not a grant and reserves nothing; the response names
the policy revision so a later admission with a different revision is
detectable; caller identity comes from the credential, never the body.

**Acceptance.** Evaluation of an allowed, denied and approval-required call
produces no receipt, no budget change and no resource effect; a revoked
credential gets 401; a changed policy revision is reflected.

## K2. Operator settlement of an unknown outcome

**Need.** The plugin retains `unknown` operations and keeps the dispatch fence,
as it must. Nothing lets the operator resolve one with evidence. The 2026-10-03
qualification run left a real native write in `outcome_unknown_after_dispatch`
with a signed `incomplete` receipt and no path forward
(`acceptance/2026-10-03/qualification-environment/NATIVE-RESTART.json`).

**What exists.** The admission saga has `DispatchCommitted`,
`OutcomeUnknownAfterDispatch` and `CompensatedBeforeDispatch`
(`chio/.../admission_operation.rs:163`), `dispatch_fence` in `tool_outcome.rs`,
the `DispatchStatusProvider` trait and `reconcile_recoverable_admissions`.
RFC-0003 is still Draft. Only `/v1/reconcile` and
`/v1/budgets/holds/reconcile` are exposed; neither takes operator evidence.

**Request.** An operator-authenticated settlement route:

```text
POST /admin/admissions/{admissionId}/settle
{ "outcome": "committed" | "not_committed",
  "evidence": { "kind": "resource_owner_attestation", "digest": "...", "observedAt": ..., "source": "..." },
  "chargeDecision": "capture" | "release" }
→ signed settlement receipt bound to the original request id, admission id,
  evidence digest and operator identity; the original receipt is retained
```

**Contract.** Settlement never re-dispatches; the original request id and
admission id are preserved; a second settlement for the same admission is
refused; settling `committed` returns the original result only if the owner
attestation includes it, otherwise it records "committed, result unavailable";
the fence releases only for this admission.

**Acceptance.** The plugin's fixture "commit, lose the response, restart"
case settles with one effect, one charge and one settlement receipt; a forged
evidence digest, a foreign admission and a repeated settlement are refused.

## K3. Session budget-hold projection

**Need.** Review and task panes say "budget impact unavailable". Users should
see reserved, captured, released and unresolved amounts for the current session
before and after an action.

**What exists.** `/v1/budgets/holds/{authorize,capture-spend,release,reverse,reconcile,cancel-captured}`,
`authorize-exposure`, `release-exposure`, `capture-invocation`, `reconcile-spend`,
hold states `Open/Released/Reversed/Reconciled/Expired`
(`budget_store.rs:566`), units as minor currency units plus `CostDimension`
(`chio/spec/METERING.md`). Unknown charges map to `OutcomeUnknownAfterDispatch`.

**Request.** `GET /v1/sessions/{sessionId}/budget` readable with the delegated
session credential, returning per-capability totals and per-operation holds:
`{ unit, limit, reserved, captured, released, unresolved, holds: [{ requestId, state, amount }] }`.
No write access.

**Acceptance.** Values match the hold store across authorize, capture, release
and an unknown dispatch; a foreign session's credential is refused.

## K4. Parent-bound capability attenuation

**Need.** `/chio:budget-set` and `/chio:guard-pause` were removed because the
bridge refuses administrative issue-then-revoke attenuation
(`unsupported_authority_operation`). Narrowing a capability, and later giving
a subagent a narrower child, needs a supported route.

**What exists.** `DelegationLink`, `AttenuationProof`,
`validate_delegation_chain` and `delegate()` in
`chio/crates/core/chio-core-types/src/capability/attenuation.rs`;
budget-share and family aggregate budgets in `chio/spec/PROTOCOL.md` §5. The
sidecar's `/v1/capabilities/attenuate` returns 403
`chio_attenuation_requires_subject_signer`
(`chio/crates/products/chio-api-protect/src/proxy/attenuation.rs`); the trust
plane has no attenuation route.

**Request.** A trust-plane route that accepts a delegator-signed
`AttenuationProof` and returns the child capability with its lineage, plus a
bridge method that builds the proof with the session's subject key held by the
trusted operator side (never the host).

**Acceptance.** A child can only narrow scope and budget; its budget draws
from the parent's family aggregate; revoking the parent revokes the child.

## K5. Resumable session suspension

**Need.** "Suspend protected admission and drain" lets an operator pause new
dispatch while inspecting an unexpected change, then resume, without revoking.

**What exists.** Sessions move one way `Ready → Draining → Closed`
(`chio/crates/kernel/chio-kernel/src/session.rs:1478`); chio-mcp-remote has
`/admin/sessions/{id}/drain`; kernel-wide `emergency_stop`/`emergency_resume`
exist but are not mounted. `SuspendSession`, `SuspendCapabilitySet`,
`FreezeIssuance` and `LiftOrder` are designed in
`chio/docs/superpowers/specs/2026-07-09-security-folder-design.md`
("implementation not started").

**Request.** Implement `SuspendSession` / `LiftOrder` for a session with a
defined admission linearization point, and report which operations were
admitted, dispatched, completed or uncertain at suspension.

## K6. HTTP 401 for an unexpired credential after owner restart

**Observed.** After restarting the native resource owner, a read-only
`chio/execution-context` call with an unexpired retained credential returned
401 "invalid, expired, or revoked session credential"
(`acceptance/2026-10-03/qualification-environment/NATIVE-CREDENTIAL.json`).

**Request.** Determine whether session credentials are bound to owner process
state (for example an in-memory key or session table) and document the
intended behavior across restart. The plugin needs either revalidation without
issuing a new execution session or an explicit "rebind" contract that keeps
the original unknown operation fenced.

## What the plugin does not need from the kernel

- A second policy engine or dry-run in the plugin: K1 replaces that idea.
- Model-provider accounting: the plugin's relay can meter model usage in its
  own unit; it must stay separate from K3's tool budget.
