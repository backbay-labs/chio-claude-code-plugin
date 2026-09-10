# Claude authentication runbook successor

Status: documentation/build/cold-install verification passed. No native-host
acceptance transfers to this successor. Confidence is high for file identities
and the installation observation. Final kernel qualification remains pending.

The shipped runbook's early launch paragraph still called normal-profile OAuth
unqualified, despite its later native subscription procedure and retained native
observations. The launch paragraph now offers `--model-auth claude-login` with
the existing trusted operator login and explains that API-key mode remains the
default when that option is omitted. The example explicitly selects subscription
authentication. Provider credentials remain in the trusted parent, and local
fixtures remain clearly excluded from real-provider acceptance.

Adjacent qualification wording now distinguishes earlier exact-artifact native
observations from the pending acceptance of a successor archive/kernel. It no
longer implies that authenticated native workflows have never been tested.
The change does not remove any I01-I08 or public-delivery requirement.

Clean source: `16624ede65015be091e91b7c29213425d5e2517e`.

| Candidate | Archive SHA-256 |
| --- | --- |
| Previous metadata successor | `8e053ba313fff434106c7e86819abbfc7e526b0c6e6b3d975aa7e892595b4966` |
| Authentication docs successor | `1258385647d228ebeed32662091ed721aeda3b60450cabae480ca0d4292fbe0a` |

Both archives are unpublished 0.3.1-rc.1 candidates with distinct immutable
identities. Only `docs/RESTRICTED-MODE.md` differs. All 1,226 other regular files,
including all 431 JavaScript files, match the previous archive exactly.

`npm run pack:release` rebuilt from clean source. A fresh consumer installed the
result offline, with an empty cache and lifecycle scripts disabled. All 1,227
regular archive files matched installed bytes. The installed runbook contains
the corrected subscription option and historical-evidence qualifications.

The previous archives, consumers and evidence remain untouched. The final
native/lifecycle matrix must select this archive explicitly, including its
upgrade/removal cases. `manifest.json` records the frozen archive and cold
consumer paths. Raw logs, exact commands, comparisons and file identities use
lossless gzip; original/compressed hashes are retained. No credential values
were exported by the scan.
