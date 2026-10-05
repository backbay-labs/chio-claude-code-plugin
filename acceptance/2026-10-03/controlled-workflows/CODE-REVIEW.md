# PR 3 code review

Review started at `73ff3a8b5e98b176630ecdc1daa0e5102b67c44b` against
`main` at `65ac8390c57a5292c055fba50caa1aafbd915848`. The review covers the
whole PR: native module, trusted control service, continuation and evidence,
task preparation and collectors, compatibility command changes, launcher and
transport, packaging, and release gates. Generated bundles were rebuilt from
the reviewed sources. The revised candidate is **0.4.0-rc.4**.

## Findings repaired

| Severity | Problem and trigger | Repair and verification |
| --- | --- | --- |
| P1 | A valid signed completion could be projected under a substituted journal operation ID. Delivery flags could also leave the projection claiming a clear fence. | Verify the journal ID, request ID, exact argument digest and signed outcome together. Invalid completions project as unknown with unconfirmed delivery and a retained fence. The substitution regression failed before this fix. |
| P1 | Publication checked a partial artifact list. A changed host supervisor or newly delivered executable could retain old live qualification. | Inventory all delivered files from package selection, including manifests, provisioning, supervisor, runtime dependencies, instructions and types. Reject changed, added, removed or symbolic paths; bind the selected host checksum too. Tests demonstrated both former bypasses. Evidence records and excluded test drivers stay outside the inventory. |
| P2 | A controller crash after the gateway retained a verified result or ACK could strand native continuation permanently. | Reconstruct only the verified original completion, and recognize an already retained native receipt and kernel ACK without resubmission. Both completion persistence states and the ACK crash window are tested with one effect and one charge. Unknown resource outcomes remain fenced. |
| P2 | A collector catching SIGTERM and exiting zero after its deadline could mark a requirement passed. Descendants could retain its pipes or continue after closing them. | Cancellation records no completion observation and terminates the POSIX process group, escalating after one second or when the parent's pipes close. Zero-exit cancellation, inherited-pipe and closed-pipe descendant regressions pass. Collectors still require trusted code and are not an execution confinement boundary. |
| P2 | Overlapping status refreshes invalidated each other's valid reads, producing false disconnection and possible polling starvation. | Coalesce reads within the same session generation. A session transition rejects the old result and preserves the new session's evidence. Both overlap and in-flight rebinding are tested in the pinned host harness. |
| P2 | The alternative button consumed the original exact review even though no alternative confirmation or linked-action implementation existed. | Hide the unsupported control and refuse new alternative requests before recording intent. Historical alternative requests cannot block supported approval or decline. Service and pane regressions cover the refusal. |
| P2 | Malformed template identifiers, empty review sets and reserved gateway tools passed catalog validation and could fail only after provisioning began. | Validate real string identifiers, a nonempty review set and reserved names before contacting the provisioner. Invalid-template regressions cover each case. |
| P2 | Bundled guides referenced omitted files, including the new research/acceptance crosswalk. | Deliver source and guide dependencies, and link the older full resource report to its immutable source revision. Check local document targets in the cold installed artifact. |

## Review result and evidence

The revised source was reviewed again after the repairs. No remaining P0, P1
or P2 finding was identified within this PR's reviewed code. This is a local
code review; GitHub's review decision and exact-head CI are reported separately.

- Typecheck and bundle build passed.
- 88 Node regressions passed, including the new failure reproductions.
- 21 native event/drawing tests and four middleware experiments passed in the
  exact Claude Code 2.1.287 host.
- All eight actual-host/macOS sandbox fixtures passed using the deterministic
  local model and stubbed kernel/resource owner.
- Cold package installation and package document checks are retained in the
  external artifact sidecar; they do not qualify live resource execution.
- The publication guard still refuses the actual candidate because
  `productionQualified` is false.

[The current acceptance record](./ACCEPTANCE.json) pins the delivered file
inventory. [The host fixtures](./HOST-FIXTURES.json) identify the original and
test-modified module cases. The prior rc.3 record, report and host fixture
summary are retained unchanged.

The [live qualification blockers](../qualification-environment/REPORT.md)
remain: actual resource metadata incompatibility, Docker cage SIGSYS, the
native writer's failed durability syscall, unqualified credential restart
behavior and provider HTTP 429 responses. Recovering an already verified
gateway result does not manufacture a result for that real unknown write.
The PR remains draft; no release, merge or production qualification is claimed.
