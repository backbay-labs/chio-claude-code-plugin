# Claude local static candidate, continuation

Status: the remaining eleven production native-mode cases, three paired reads
and the fresh after-admission storage rerun passed. Together with the retained
initial run, these cover 23 bounded production-mode cases. This is not complete
I01-I08 or public-delivery acceptance. Confidence is high in the exact artifacts,
observed effects, retained outcomes and stated test boundaries.

| Artifact | Identity |
| --- | --- |
| Local static kernel binary SHA-256 | `c03a8a711dbbd15da2c59655d9ab6d8f0068a20187363db7a78f4b5422ded93e` |
| Kernel source | `bafa02b06de93553cecb6f60b340f3dd8fd9b401` |
| Claude 0.3.1-rc.1 archive SHA-256 | `1258385647d228ebeed32662091ed721aeda3b60450cabae480ca0d4292fbe0a` |
| Archive source | `16624ede65015be091e91b7c29213425d5e2517e` |
| Native Claude 2.1.267 binary SHA-256 | `a681f3008f0050029aeebcab3af51bb6a55ddeb625a3af3141a4416d43cd2558` |
| Resource image | `sha256:188cb84d5d0bb4063d4ce5a3b9c3832445a5acda5604911cda80a9136d1850a0` |
| Fixture source | `675f862e90dad6e8456b64fd9737a50c95de75ab` |

Real subscription inference uses `claude-sonnet-5` through the production trusted
parent relay. Startup failure and expired-authority preflight cases intentionally
stop before model inference, sometimes before native host startup. They are not
claimed as provider-inference cases. The expired-capability preflight is not an
in-flight expiry test. Supplemental boundary/parallel cases use labeled local
provider fixtures and retain that separate evidence classification.

The initial timing assertion failure, Docker observer failures, incomplete cases
and failed owner creation remain in [the initial record](../final-static-initial/README.md).
No old state was reused or cleared. The coordinator released a serial lane after
stopping completed resource owners. This run records Docker 28.3.3, two guest CPUs,
4,095,369,216 bytes guest memory, Ubuntu 24.04.2 LTS, aarch64 and overlayfs.
The capacity hold is excluded from the paired latency measurements.

| Continuation case | Observed result |
| --- | --- |
| host-response-loss | One original effect retained without delivery ACK; restart fenced; explicit operator export/ACK then verified read; no replay |
| gateway-crash | Same safe retained-result recovery, including explicit dead-owner lock recovery |
| sigterm-recovery | Interrupted original effect retained, restart refused, explicit recovery restored read |
| plugin-omitted | Missing enforcement component prevented supported-mode startup and effects |
| gateway-missing | Missing gateway prevented supported-mode startup and effects |
| host-missing | Missing pinned native host prevented startup and effects |
| mcp-silent-omission | Omitted Chio MCP configuration prevented usable protected startup and effects |
| init-malformed | Malformed native MCP initialization prevented effects |
| init-timeout | Missing timely native MCP initialization prevented effects |
| init-crash | Initialization crash prevented effects |
| upgrade-removal | Upgrade preserved the original unresolved operation and authority; restart stayed fenced; explicit recovery restored read; removal preserved state and prevented startup |

The upgrade case first ran the pinned 0.3.0 predecessor
`0dd0d906fc34b3ac7d09e3b7f6cdee9f13f511731b25ec761feca7172c9b1158`,
then installed the selected successor into the actual cold consumer. All 1,227
regular files were verified at each stage. The surviving original result was
not automatically replayed. Package removal left the operator state unchanged,
and the removed entrypoint failed with `MODULE_NOT_FOUND`.

The fresh storage rerun used port 59228 and a new `r2` owner/volume. One healthy
positive write was acknowledged. Actual SQLite contention after admission then
left one uncertain original write, zero retained tool outcomes for that request,
and no delivery ACK. Same and new actions after unlock and owner restart each
produced zero dispatches. The final admission state was
`outcome_unknown_after_dispatch`; both signed call/latch fences verified against
the pinned kernel signer and rejected a modified request binding. Every resource
effect and original authority remained preserved. The fixture now reads the final
state after bounded asynchronous reconciliation; the original immediate snapshot
failure is retained. No kernel or plugin runtime code changed for this repair.

| Pair | Direct bridge execute (ms) | Native Claude MCP interval (ms) | Difference (ms) |
| --- | ---: | ---: | ---: |
| 1 | 582.341 | 683 | 100.659 |
| 2 | 422.171750 | 532 | 109.828250 |
| 3 | 423.247291 | 504 | 80.752709 |

These are three sequential pairs against the same existing file and kernel, with
separate fresh read-only scoped authority. Six independently observed reads left
all files unchanged. Each native result matched its direct control and was
verified and acknowledged. The native interval includes dispatcher, gateway and
journal work; both routes include the kernel and bridge verification. Preparation,
model inference, startup and subsequent ACK are excluded. Direct controls always
ran first; native timestamps have millisecond precision. This is not a general
latency, total kernel overhead, distribution or performance guarantee.

One timing command-preparation attempt selected the summary JSON instead of its
separate call inventory and raised `KeyError: calls` before any process launch.
The failure is retained; the corrected command derives the resource from the
actual retained call and checks the independent final observation.

The completed continuation owner on 59229 was stopped with 73 protected files
unchanged and its resource/audit volumes retained. The completed storage test
owner on 59228 was then stopped with seven protected files unchanged. A new
read-only snapshot confirmed that resource effects and exact signed remote
call/latch fences remained unchanged. No labeled container remains for either
owner. No unknown journal was cleared or acknowledged during cleanup. Earlier
failed owners were left untouched.

`coverage.json` maps the 23 bounded production-mode cases to their exact retained
results. The 27 supplemental native confinement assertions, one parallel fixture
and three paired-read observations remain separately labeled. The coordinator's
shared host/kernel matrix and publication/usable-delivery requirements are still
separate acceptance gates. These local binary observations do not transfer to a
differently hashed hosted rebuild.

Raw transcripts, signed evidence, independent observations, exact commands,
operator interventions, fixture identities and installation inventories are
preserved with original/compressed SHA-256 values. Only installed package copies
and npm cache directories are excluded from the export; they remain at their
original paths and their archive/file inventories are retained. Source CI run
34449339809 passed at fixture source `675f862`; it is not host acceptance.
