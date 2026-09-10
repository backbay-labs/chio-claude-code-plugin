# Claude sanitized-result contract regression

Status: five bounded real-host regressions passed, zero skips. Full I01-I08
acceptance and public delivery remain unresolved. Confidence is high for the
retained artifact identities, native calls and independent resource observations.
The native model is nondeterministic; the regression filename and assertions are
fixed. These observations do not establish that every future model turn succeeds.

The original Claude 2.1.267 / Sonnet 5 subscription run stopped after a verified,
acknowledged write because its successful output masked part of the benign file
name `claude-qualified-fd7fe194274242a6.txt`. It interpreted
`redaction_mode: none` and `post_invocation.sanitized: true` as contradictory.
That run attempted one write and never attempted the requested edit/read/list.
The exact original failure is retained in `raw/original-failure`.

Those fields describe different things. The protocol defines `redaction_mode`
as redaction of receipt details; the kernel's post-invocation metadata records
output sanitization. The nine-digit substring in the filename matched the
existing compact-SSN guard. Neither the SSN detection nor signed receipt/output
bytes were changed. Source references are `spec/PROTOCOL.md:883`,
`crates/core/chio-core-types/src/receipt/kinds.rs:125`, and
`crates/kernel/chio-kernel/src/kernel/responses/finalization.rs:224` and `:301`
in kernel source `ae12bb2a6f7dbf875188ce357314654de440ddc3`.

The restricted launcher now supplies fixed production result instructions with
Claude's supported `--append-system-prompt` flag. They explain output masking,
preserve previously known user arguments, forbid reconstruction of unknown
masked data, and retain stop behavior for tool errors, unknown outcomes and
missing information needed by later work. The captured native `--help` and
actual supervisor argument array prove the installed host supports and receives
the flag. This is not a test-prompt exception: the normal native test prompt is
unchanged, including its instruction to stop on unsuccessful or uncertain results.

## Candidate identity

| Component | Selected identity |
| --- | --- |
| Plugin | `@chio/claude-code-plugin` 0.3.1-rc.1 |
| Runtime source | `7a8d4d82ffb40a66f8fb8f19e53bff58a7479009` |
| Archive SHA-256 | `28e8757429548e8fdcb1ffa3c3c665f8eafde426d7ba5f6807086123d6d07646` |
| Native host | Claude Code 2.1.267, `a681f3008f0050029aeebcab3af51bb6a55ddeb625a3af3141a4416d43cd2558` |
| Model/authentication | `claude-sonnet-5`, native Claude subscription via trusted parent relay |
| Kernel source | `ae12bb2a6f7dbf875188ce357314654de440ddc3` |
| Kernel binary | Plain release 0.1.1-rc.1, `9f7bc045c97e6c13d9c24641ac426bb61903e3ddab088203a681906ce79d7455` |
| Bridge / SDK | Bundled 0.3.0 / 0.1.1-rc.1 |
| Resource image | `sha256:188cb84d5d0bb4063d4ce5a3b9c3832445a5acda5604911cda80a9136d1850a0` |

The kernel is an unpublished plain Cargo release candidate, not the separate
cargo-auditable release artifact. Other artifacts or source revisions need their
own qualification. The archived September 9 acceptance file included in the
package describes the previous 0.3.0 candidate and remains historical.

`npm ci`, typecheck, build and 33 component tests passed with zero skips.
`npm run pack:release` staged vendored public SDK/bridge dependencies. A fresh
consumer installed the resulting archive offline with an empty npm cache and
lifecycle scripts disabled. All 1,227 regular archive files matched installed
bytes. Five archive files differ from the previous candidate: plugin/package
version metadata, launcher instructions, the runbook, and the already updated
historical acceptance record. The other 1,222 files match exactly. The gateway,
sandbox, native authentication helper, model relay and supervisor match the
previous selected archive byte for byte. `raw/provenance` retains full commands,
lock-based dependency results, file identities and archive comparisons.

## Native observations

All calls below came from the installed native host using actual subscription
inference and the real selected kernel. Read-only observer containers separately
read the resource and dispatch-audit volumes. Test fault preloads operate in the
trusted parent and never synthesize model responses.

| Case | Observed behavior | Retained result |
| --- | --- | --- |
| Fixed sanitized path | Four exact write/edit/read/list calls, four resource dispatch rows and four verified delivery ACKs. Output remains masked, original arguments remain exact, final file content is correct. | `raw/native/sanitized-path/result-contract.json.gz` |
| Completed tool error | A real edit with absent old text returns a completed, verified envelope with `isError: true`. No file bytes change, the next requested read is not dispatched, exact error delivery is acknowledged, and the launcher returns exit 3. | `raw/controls-sequential/completed-tool-error` |
| Substituted result | One real read occurs; altered delivered bytes are rejected. Same-authority restart dispatches nothing until explicit operator recovery. Export/ACK does not redispatch, and a subsequent authorized read succeeds. | `raw/controls-sequential/result-substitution` |
| Lost host response | One original effect occurs and remains retained. Restart dispatches no replacement. Explicit same-authority operator recovery releases the fence without replaying the effect. | `raw/native/host-response-loss` |
| Aggregate budget | Three separately launched native actions consume one retained three-call grant. The fourth actual native tool attempt returns denial with no fourth resource dispatch. | `raw/budget-correct-policy/aggregate-budget` |

The sanitizer regression's final model response explicitly reports masking and
explains that it retained an already-known original path. It does not derive
that path from concealed output. Raw receipts, model messages, journal records,
launch/exit records and independent before/after observations are retained.

## Retained unsuccessful harness runs

The first supplemental budget attempt used the default 64-invocation owner,
which cannot satisfy a test expecting the fourth invocation to be denied. It
failed its assertion and is retained in `raw/native/aggregate-budget`. The
corrected run used a new owner, separate volume and an explicit three-call
policy, whose bytes and digest are retained.

A supplemental tool-error control was mistakenly started concurrently with a
resource-counting result-substitution recovery case on the same observer volume.
Both observed extra dispatch rows and failed; these results are retained in
`raw/tool-error` and `raw/native/result-substitution`. They are not passes.
The corrected tool-error and result-substitution runs executed sequentially on
fresh scoped sessions, with their original state preserved. The separate budget
run used different resource/audit volumes and could not contaminate their counts.

## Reproduction and remaining work

Use a fresh disposable resource owner for `sanitized-path`, because the fixed
filename must be absent initially. Run `completed-tool-error`,
`result-substitution` and `host-response-loss` sequentially on each observer
volume. `aggregate-budget` requires a separate owner with a shared
`max_invocations: 3` grant. The default resource policy has 64 invocations and
is not the budget-test fixture. Exact owner, install and native commands are in
`raw/provenance`; the qualification drivers used by each run are retained beside
their identity records. The package contains the supported runtime/runbook;
acceptance drivers are operator fixtures and are excluded from the archive.

Private owner roots, databases, journals and volumes remain retained. No normal
Claude profile or credential was removed. No release was published and no PR
was merged. The complete applicable host matrix must be rerun on this archive
and the ultimately delivered kernel artifact. These five regressions do not
inherit or replace older artifact acceptance, and do not qualify another host.

Raw files use lossless gzip with original and compressed SHA-256 identities in
`manifest.json`. `credential-exclusion.json` records the credential scan without
exporting any credential values. `SHA256SUMS` covers every retained evidence file.
