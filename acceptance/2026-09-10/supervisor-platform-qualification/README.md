# Claude supervisor platform-test fulfillment

The exact test `trusted host supervisor stops its process group when the parent
lifeline closes` has `skip: process.platform !== "darwin"` at
`test/restricted.test.mjs:48`. Linux source-package CI correctly skips it.

The retained CI job 102784660550 in run 34450420952 executed synthetic merge
`102ff834b9309b4e9254b270bdb00e15b97452ce`, whose source tree equals topic source
`00a0ad130cf13fbe434ab08616fe2f2483187c77`. Its raw result is 32 pass, zero fail,
one skip. That original CI skip remains a skip.

The exact current-source test was then executed locally on macOS 26.4 arm64 with
Node v25.5.0, using a new private TMPDIR. It passed: one test, zero fail, zero skip,
exit zero, no timeout. Total driver wall time was 0.433492625 seconds. The test
launches `/usr/bin/sandbox-exec` with a disposable Node readiness/timer child,
closes the supervisor's private FD3 lifeline, and asserts supervisor exit143.
It does not launch native Claude, authenticate a model, mutate a normal profile,
or use Docker. Temporary fixture contents were removed by the test itself.

The source revision and hashes of the test, supervisor, restricted launcher,
sandbox and model-relay modules were identical before and after execution.
The selected frozen archive SHA256
`1258385647d228ebeed32662091ed721aeda3b60450cabae480ca0d4292fbe0a`
contains the exact supervisor bytes tested here. This comparison does not transfer
any other source or artifact acceptance claim.

Prior inspected outputs did not supply a local execution bound to source00a0ad1;
this retained execution directly fulfills the applicable macOS component check.
It is not a new full native-host I01-I08 acceptance run. No product source or
runtime behavior changed.

`manifest.json` retains raw source paths and hashes of original and compressed
bytes. `SHA256SUMS` binds this record. The full original CI log and source-tree
binding are retained beside the exact local TAP output, command, source hashes,
platform details and isolated fixture driver. Credential-value scanning found
no matches; credential values are not exported.
