# Claude candidate metadata successor

Status: metadata/build/cold-install verification passed. Full I01-I08 acceptance
remains unresolved. No native-host gate result is transferred to this successor.
Confidence is high for the retained file identities and installation observation.

The normal Claude plugin manifest still claimed mediation of every tool call.
Its marketplace entry repeated that claim, while the marketplace description
also implied unqualified policy mediation. Normal plugin installation does not
establish the separately launched restricted boundary. All three descriptions
now say:

> Chio diagnostics for Claude Code. Kernel MCP access requires the separate
> restricted launcher; integration acceptance pending.

Only `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` changed.
Source commit: `c725c628c8ad9465f6746908924e0dd14c56c33f`.

The clean source was rebuilt with `npm run pack:release`. A fresh consumer
installed the staged archive offline with an empty npm cache and lifecycle
scripts disabled. All 1,227 regular archive files matched installed bytes, and
the installed descriptions matched the corrected source metadata.

| Identity | SHA-256 |
| --- | --- |
| Previous 0.3.1-rc.1 archive | `28e8757429548e8fdcb1ffa3c3c665f8eafde426d7ba5f6807086123d6d07646` |
| Metadata successor 0.3.1-rc.1 archive | `8e053ba313fff434106c7e86819abbfc7e526b0c6e6b3d975aa7e892595b4966` |

Both archives are unpublished candidates with distinct immutable identities.
The older archive, installation and native evidence remain preserved. Exact
archive comparison found only the two JSON files above changed; all 1,225
other regular files, including every one of the 431 JavaScript files, matched.
The restricted launcher, gateway, relay, supervisor, sandbox and authentication
code therefore retain their exact previous bytes. This supports the bounded
metadata-only classification and does not replace final host/kernel testing.

`manifest.json` records the frozen archive and cold consumer paths. The raw
build/install logs, exact commands, clean source identity, every installed file
hash and complete archive comparison are retained with lossless gzip. The
credential scan includes decompressed contents and exports no credential values.
The final kernel/native matrix must explicitly select this successor hash.
