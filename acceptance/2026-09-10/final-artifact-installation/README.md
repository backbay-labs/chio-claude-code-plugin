# Final Claude archive package lifecycle

Status: three binary-independent package lifecycle steps passed. No kernel was
executed. These observations do not establish real-authority recovery or full
I01-I08 acceptance. Confidence is high for the installation/file observations.

In one fresh disposable consumer, npm installed the previous 0.3.0 archive,
upgraded to final candidate 0.3.1-rc.1 archive
`8e053ba313fff434106c7e86819abbfc7e526b0c6e6b3d975aa7e892595b4966`, and
removed the package. Each command used a separate empty cache, offline mode
and disabled lifecycle scripts. Every one of the 1,227 regular files matched
the selected archive after both installation and upgrade. After removal the
launcher was absent and its entrypoint failed with `MODULE_NOT_FOUND`.

A non-authoritative text canary outside the consumer remained unchanged. It
was an installation fixture, not a substitute for a real operation journal.
Normal user profiles and the preserved native-test consumers were untouched.
The final-kernel native upgrade/removal case remains separately required.

The final native coordinator verifies archive/file identities and requires
explicit kernel path, hash and source plus fresh owner/output roots. The
storage driver now requires an explicit archive hash in place of its historical
r5 hard pin, checks every installed archive file, and refuses an existing output
directory. A small separate validator exercise rejected changed file bytes,
an escaping installed symlink, and an escaping archive path. These synthetic
validator checks are labeled as such and do not count as host acceptance.

Native/kernel tests have not been run against the forthcoming static audited
kernel. The coordinator prepares separate owners for native lifecycle,
three-call budgets, ten-second capability expiry, supplemental parallelism,
and each of the three SQLite cutpoints. Resource-counting commands run
sequentially within a volume. The source reserves ports 59221-59227 for this
program invocation. Failure, unknown outcomes and original state remain retained.

Commands, archive hashes, per-file identities and logs are in `raw`. Gzip is
lossless and each original/compressed identity appears in `manifest.json`.
