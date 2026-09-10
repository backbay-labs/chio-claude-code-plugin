# Bounded Claude operational observations

Candidate: Claude plugin archive `0dd0d906fc34b3ac7d09e3b7f6cdee9f13f511731b25ec761feca7172c9b1158`, native Claude `2.1.267`, Sonnet 5 using the saved native subscription through the trusted parent, kernel `33dd1dea21a4ca5ecddeab4f30f6b06b0b90c513f0987aef552b0633d9da1e25`.

`operational-timing.json` retains exact native debug timing headers, source-log hashes, original launch identities, and extraction boundaries. These are observations from the accepted bounded cases, not an incremental-overhead benchmark.

| Observed route | Native call-to-result interval |
|---|---:|
| Useful workflow write | 1,772 ms |
| Useful workflow edit | 705 ms |
| Useful workflow read | 674 ms |
| Useful workflow list | 777 ms |
| Separate storage-owner positive write | 647 ms |
| Receipt-store contention after effect | 5,758 ms |
| Admission-store contention before dispatch | 5,260 ms |
| Admission-store contention after effect | 5,740 ms |

The native MCP connection took 6 ms in the useful workflow and 4-5 ms in the selected storage runs. This covers the native connection handshake, not complete launcher startup or the parent subscription authentication helper. The useful workflow harness reported 23.047 seconds; the selected storage positive reported 8.954 seconds and faults 9.009-9.962 seconds. Those harness fields include provider inference, launcher work, native processing, and the independent post-run observer. They are not precise launcher-only timings and must not be labeled Chio overhead. Provider spend was not measured.

No matched direct-resource native MCP interval is retained. The smallest missing comparison is one same-file read through the current native Chio route and one through a separately isolated read-only direct MCP baseline, using the same native host, resource image, immutable bytes, warm state, and arguments. Capture native tool-call/result timestamps and report both raw intervals and their difference. A single pair does not support a general performance estimate. No additional benchmark program is proposed.

## Interventions and retained state

- The useful write/edit/read/list workflow completed with four verified acknowledgements and no manual intervention after launch. Authentication reuse was handled by the supported trusted-parent helper.
- Cold package installation used an empty cache and the offline release archive. The retained installation command and artifact hashes are in `/tmp/chio-claude-cutpoints-r5-artifact-20260909/installation.json`.
- The earlier lifecycle cases required an explicit operator export of the retained received outcome, inspection of that exact outcome, and delivery acknowledgement before useful work resumed under the same authority. The SIGKILL case additionally required the supported dead-owner lock recovery. No unknown result was automatically acknowledged.
- Each storage case first completed a verified, acknowledged native write. The operator then introduced the explicit SQLite write lock, released that test lock with rollback, inspected retained state, and restarted exactly the same kernel owner through its supported launcher. Identical and changed actions remained fenced before and after restart. The original config, session, credential, journal, databases, and resource volumes were preserved. There was no new authority, erased journal, automatic redispatch, or claimed administrative reconciliation.
- The first three setup attempts used the shared helper's non-UUID session identifier and were rejected before any native tool call or effect. Their evidence remains in `after-receipt`, `before-admission`, and `after-admission`. The helper was repaired to generate UUIDs, and fresh `*-r2` owners were created before testing. This was preparation repair, not recovery by resetting uncertain work.
- Isolated r3-to-r5 upgrade preserved the original authority and unresolved journal; the retained outcome remained fenced until explicit recovery. Uninstall removed the isolated package entrypoint and preserved private operator state and resource observations. Evidence is in `/tmp/chio-claude-subscription-r5-lifecycle-20260909/upgrade-removal`.

The storage cases establish safe refusal and truthful retained uncertainty across faults and restart. They do not claim that unresolved work can resume without reconciliation or that these bounded observations alone close every I01-I08 gate.
