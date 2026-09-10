# Claude local static candidate, initial run

Status: partial run, unresolved. This is not full I01-I08 or public-delivery
acceptance. Confidence is high in the retained artifact identities, resource
observations and explicit failures. Later reruns must retain this record.

The real Claude Code 2.1.267 host used its native Max subscription relay and
`claude-sonnet-5`, with fresh profiles, workspaces, authority and observer volumes.
All 1,227 installed regular archive files were checked before owner startup.
No authentication failure was observed.

| Artifact | SHA-256 or source identity |
| --- | --- |
| Local static kernel binary | `c03a8a711dbbd15da2c59655d9ab6d8f0068a20187363db7a78f4b5422ded93e` |
| Kernel source | `bafa02b06de93553cecb6f60b340f3dd8fd9b401` |
| Claude 0.3.1-rc.1 archive | `1258385647d228ebeed32662091ed721aeda3b60450cabae480ca0d4292fbe0a` |
| Archive source | `16624ede65015be091e91b7c29213425d5e2517e` |
| Native host binary | `a681f3008f0050029aeebcab3af51bb6a55ddeb625a3af3141a4416d43cd2558` |
| Resource image | `sha256:188cb84d5d0bb4063d4ce5a3b9c3832445a5acda5604911cda80a9136d1850a0` |
| Initial fixture source | `4fc210a3211ccede03e21b60a44a01d4cf8410cf` |

Exact paths, operating environment, commands, configuration hashes, raw native
transcripts, signed receipts, journal/ACK records and independent resource
snapshots are retained under `raw/`. `manifest.json` binds each lossless gzip
member to its original bytes. Private authority and credential files remain
outside this record.

Passed real-provider cases in this run:

- The fixed compact-SSN-pattern filename completed write, edit, read and list
  with four actual dispatches and four confirmed deliveries while sanitization
  remained active.
- A verified completed tool error remained an error, with no fabricated edit or
  continuation into the later requested read.
- Journal failure before dispatch, cancellation before dispatch, kernel network
  interruption and journal failure after an effect preserved truthful failure
  and prevented the tested subsequent protected effects.
- Result substitution was rejected; retained uncertainty prevented automatic
  replay and required explicit operator recovery.
- Aggregate budget allowed three calls and prevented the fourth effect.
- The real owner-issued ten-second capability expired and prevented dispatch;
  the requested 900-second credential lifetime was clamped to that capability.
- Storage failure before admission caused no effect. Storage failure after the
  retained receipt preserved one original effect. Both refused same/new work
  after unlock and owner restart, without ACKing the unknown result. Signed
  call/latch fences verified against the pinned signer and rejected a tampered
  request binding.

The exact captured native host sandbox passed 27 supplemental confinement
assertions using a local provider fixture. A separate native parallel fixture
permitted one write and fenced the second. These are real native host/OS tests,
but their fixture-produced model messages are not real-provider inference
acceptance.

Two concrete failures prevent closure:

1. The after-admission storage driver asserted the immediate restart snapshot,
   which still recorded `dispatch_committed` version 6. The same original run's
   later final snapshot recorded `outcome_unknown_after_dispatch` version 7.
   The uncertain original write remained the only fault effect; all same/new
   retries before/after restart produced zero new dispatches. The driver now
   waits at most 30 seconds for that exact asynchronous transition, retains
   every sample, and requires constant resource effects and authority. This
   fixture correction has not yet passed a fresh native rerun in this record.
2. During host-response-loss recovery, a read-only Docker observer container
   timed out after 30 seconds. A subsequent case's initial observation also
   timed out and terminated the native batch. Independent `docker info` and
   `docker ps` checks each timed out after 12 seconds. The fresh storage retry
   owner then failed preparation before any native host run. No daemon or old
   owner state was cleared.

Host-response-loss remains failed/incomplete. Ten later requested cases did not
complete: gateway-crash, sigterm-recovery, plugin-omitted, gateway-missing,
host-missing, mcp-silent-omission, init-malformed, init-timeout, init-crash, and
upgrade-removal. The coordinator's `skips: 0` field counts explicit skip branches;
it does not imply these aborted/unexecuted required cases passed. They remain
unresolved and must run after the test environment is recovered.

Owners on ports 59221-59227 and their volumes are retained. The failed fresh
storage retry attempted port 59228 under a different owner root and volume name.
The original coordinator and retry create both exited nonzero. No incomplete
case was converted into a pass.

Source CI run 34447612434 passed at fixture source `4fc210a`. Its explicit
`--tag candidate` dry-run repaired npm's prerelease dry-run requirement without
publishing or changing actual release approval/source/provenance gates. That
source CI result is separate from native acceptance and does not identify a
hosted rebuilt kernel as the local binary tested here.
