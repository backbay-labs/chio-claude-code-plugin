# Prerelease package dry-run correction

Hosted source/package run 34446857258 failed on source
`57e402f065d7bd6fe56fd89745de77218749d7d2`. Typecheck, unit tests, build,
staged packaging and cold consumer checks completed before npm rejected the
final dry-run publish check: a prerelease version requires an explicit tag.
The original hosted log is retained.

Both CI and the release build now add `--tag candidate` to their existing
`npm publish --dry-run` commands. These checks do not publish anything.
Actual publication already selects its dist-tag and remains unchanged, as do
its source, environment and provenance gates.

Using the exact pinned Node 22.19.0 and npm 11.8.0 with an empty npm user
configuration, the original command reproduced exit 1. Adding the candidate
tag returned exit 0 against the same final Claude archive
`1258385647d228ebeed32662091ed721aeda3b60450cabae480ca0d4292fbe0a`.
Both workflows pass actionlint. Runtime files and the frozen archive are
unchanged. No native-host acceptance is claimed or transferred.

Raw hosted failure, local before/after commands and output, pinned npm
installation and validation identities are retained with lossless gzip.
Confidence is high for the reproduced failure and its correction.
