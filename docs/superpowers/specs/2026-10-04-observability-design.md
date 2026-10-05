# Completion evidence and observability

Date: 2026-10-04. Sub-project 3 of the 2026-10-04 progress review. Branch
`feat/claude-observability-20261004`, stacked on
`feat/claude-review-loop-20261004` (sub-project 2). Kernel, gateway and
authority contracts do not change.

## Goal

1. Collect hosted CI evidence directly from GitHub, bound to the task's exact
   commit, without an operator-run JSON bridge service.
2. Meter model usage in the protected launcher's relay, record which model did
   the work, and optionally stop new model work at an operator token budget.
3. Give the operator a single Markdown report of a session: authority,
   operations, decisions, receipts, continuations, task evidence and model
   usage.

Success: each has Node tests; the existing suites pass; no change creates
authority or dispatches an effect.

## Decided out of scope

| Review idea | Decision |
| --- | --- |
| Budget impact in review and task panes | Needs the kernel's session budget-hold projection (request K3 in `docs/research/2026-10-04-kernel-requests.md`, PR #5). The panes keep saying "unavailable". |
| Deployment adapters | Not now. A deployment's served commit needs a per-provider contract; the JSON collector already covers an operator-run deployment check. |
| HTML report | Not now. Markdown renders on GitHub and in terminals; HTML adds a second renderer to keep accurate. |

## O1. GitHub checks collector

A new collector kind in the private task catalog:

```json
{ "kind": "github", "repository": "owner/name", "checks": ["build", "test"], "tokenFile": "/operator/private/github-token.json", "apiBase": "https://api.github.com" }
```

- `repository` matches `^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$`.
- `checks` is optional; when present, each named check run must exist and
  conclude `success`. When absent, at least one check run must exist and every
  check run must conclude `success`, `neutral` or `skipped`.
- `tokenFile` is optional; when present it must be an absolute path to a
  private JSON file `{ "token": "..." }` (read with the same private-file rule
  as other operator files), read at collection time, never stored in the task
  record or projection.
- `apiBase` defaults to `https://api.github.com`; it must be HTTPS or exact
  loopback HTTP (tests).
- Collection requires a `git_commit` artifact (the catalog does not know the
  artifact; collection refuses a `sha256` artifact).

Collection requests
`GET {apiBase}/repos/{repository}/commits/{digest}/check-runs?per_page=100`
with `Accept: application/vnd.github+json`, a `User-Agent`, and the bearer
token when configured; no redirects; 5-second timeout; 1 MiB bound (shared with
the JSON collector through one bounded-fetch helper). Every returned check
run's `head_sha` must equal the artifact digest, otherwise the evidence is
refused as belonging to another artifact. `total_count` over 100 is refused
("name the required checks").

State: any required check missing, or any considered check not `completed` →
`running`; any considered conclusion in `failure`, `timed_out`, `cancelled`,
`action_required`, `startup_failure` or `stale` → `failed`; otherwise
`passed`. Source: `github check-runs · owner/name · <n> checks · <digest of the
considered runs>`.

Tests: loopback server returning check-runs for the exact commit (passed,
running, failed, missing named check), a run for a different `head_sha`
(refused), `total_count` over 100 (refused), a `sha256` artifact (refused at
collection), a non-private token file (refused) and a token that is
sent as a bearer header but never appears in the task record.

## O2. Relay model metering

The relay already logs each request's class and status in `model-relay.json`.
It now also records, for forwarded `/v1/messages` requests, `model` and
`usage` — `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
`cache_read_input_tokens` — read from the response without altering it:
streamed responses are parsed from `message_start` and `message_delta` SSE
events as bytes pass through; JSON responses from the `usage` field.
Malformed or missing usage records `usage: null`; it never fails the request.

An optional launcher flag `--model-token-budget N` (positive integer) sets a
budget over the sum of all four counts. Once totals reach it, the relay refuses
new conversation requests with the relay's existing permission-error shape and
message "Operator model token budget reached"; count-token and auxiliary
requests are not refused. `exit.json` gains `modelUsage: { model, requests,
inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens,
budget, budgetReached }`. The native status projection gains an optional
`modelUsage` with the same fields from a `ControlOptions.modelUsage()` callback;
`/chio-status` prints one line `Model usage (relay-metered): <requests>
requests · <in> in · <out> out tokens` when present. Ordinary sessions have no
relay and print nothing.

These are provider-reported counts, not billing records, and they are separate
from kernel tool budgets. Copy says "relay-metered".

Tests: SSE and JSON usage extraction (including split chunks and missing
usage), budget refusal after the threshold, and status parsing of the optional
field.

## O3. Operator session report

`node scripts/control.mjs report --gateway-config CONFIG [--relay-events PATH] --output NEW_FILE.md`

Writes a new Markdown file (refuses an existing path, mode 0600) with:

- header: session id, scope, authority state and expiry, projection revision,
  generated time;
- operations table: request id, tool, state, evidence, next action, receipt id,
  kernel acknowledgement, delivery channel;
- decisions: intents with kind, state and expiry;
- continuations: id, original request, state, delivery, model context;
- task: title, artifact, readiness, requirements with state, evidence class,
  source and observation time;
- model usage from `--relay-events` (`model-relay.json`) when given;
- a closing "What this report is" paragraph: generated from the private journal
  and projections; receipts are referenced by id, not verified by this report;
  verify them with the kernel's evidence tools.

The report never includes credentials, raw resource results, approval tokens
or private paths beyond the journal's own identity. `renderSessionReport(status,
options)` is a pure function in `src/control/report.ts`, exported through the
control service bundle.

Tests: a fixture projection renders every section; secrets in the gateway
config never appear; an existing output path is refused.

## Verification

Typecheck, build (dist regenerated), `npm test`, `npm run test:mods`, and the
publication guard still refusing.
