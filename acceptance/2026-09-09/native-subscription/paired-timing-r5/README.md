# Three paired healthy Claude reads

Frozen plugin archive: `0dd0d906fc34b3ac7d09e3b7f6cdee9f13f511731b25ec761feca7172c9b1158`. Kernel: `33dd1dea21a4ca5ecddeab4f30f6b06b0b90c513f0987aef552b0633d9da1e25`. Actual native Claude 2.1.267 used Sonnet 5 through supported saved-login authentication.

Each pair reads the same existing immutable file with identical arguments and read-only tool scope. Direct control and native host use fresh scoped sessions on the same healthy owner (58494), frozen bridge, kernel, policy, resource image and volume. Exactly six independently audited reads occurred. File hashes remained unchanged. All six outcomes were verified and acknowledged; acknowledgements occur outside the measured intervals.

| Pair | Direct bridge execute (ms) | Native Claude MCP interval (ms) | Native minus direct (ms) |
|---|---:|---:|---:|
| 1 | 736.938 | 862.000 | +125.062 |
| 2 | 819.712 | 857.000 | +37.288 |
| 3 | 850.477 | 720.000 | -130.477 |

The direct interval starts immediately before bundled `createMcpExecutionClient.execute()` and ends when its verified response returns. The direct reservation write, authority preparation, process startup, persistence of the received outcome, and ACK are outside that interval.

The native interval uses Claude debug timestamps at `Calling MCP tool: read_text_file` and its matching successful completion. It includes native dispatch, the local HTTP gateway, parent journal reservation/persistence, bridge verification, kernel, and resource work. Model inference, parent login, startup, session preparation, and later ACK are excluded. The difference compares the additional native/gateway/journal route over direct bridge execution. It is not total kernel overhead.

All three raw pairs are retained, including the negative difference. Direct ran first in every pair; the sequence was not randomized. Native timestamps have millisecond wall-clock precision; direct timing uses monotonic nanoseconds. Separate fresh sessions share the same selected read-only scope. Three observations do not establish a latency distribution, general overhead estimate, performance guarantee, or performance improvement. No load benchmark or adoption claim is made.

`before.json` and `after.json` hold independent read-only Docker observations. Each pair retains native output, exact commands, scope metadata, raw timing headers, direct pending/outcome/ACK records, and the acknowledged native journal. `identity.json` binds runtime files and source hashes. The direct calls are performance controls only and are not substituted for native host acceptance.

Reproduction uses `scripts/acceptance/native-paired-timing.py` with the explicit healthy operator state, frozen installed package/archive, and the designated existing file. It creates new scoped sessions for each control and native request. It never resets uncertain state or touches the three fenced storage owners.
