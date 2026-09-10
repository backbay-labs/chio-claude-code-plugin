# Authentication-docs archive package lifecycle

Status: binary-independent package lifecycle passed for the exact selected
archive. Native unresolved-operation upgrade/recovery remains pending after
the Docker test environment failure. Confidence is high in the package file
identities and installation/removal observations.

A fresh consumer installed the previous 0.3.0 archive
`0dd0d906fc34b3ac7d09e3b7f6cdee9f13f511731b25ec761feca7172c9b1158`,
then upgraded to selected 0.3.1-rc.1 archive
`1258385647d228ebeed32662091ed721aeda3b60450cabae480ca0d4292fbe0a`,
then removed the integration. Both installs were offline with empty separate
caches and lifecycle scripts disabled. All 1,227 regular files in each installed
package matched the corresponding pinned archive. The removed launcher failed
with `MODULE_NOT_FOUND`; an independent non-authoritative canary stayed unchanged.
No actual operator journal or kernel resource was used by this package-only case.

The owning native driver now pins the predecessor archive explicitly and verifies
every regular archive member against the actual cold consumer before native
execution, including omission fixtures and both upgrade stages. Archive traversal,
installed symlink escape, changed file bytes and wrong archive identity are
rejected. Five small validator controls passed; they are synthetic validation of
the fixture, not native-host acceptance. Native fixture syntax/help checks passed.

The final coordinator passes the explicit predecessor pin through to the driver.
The runtime package files and selected archive remain unchanged. Historical
native evidence retains its original driver identities; the strengthened
upgrade procedure still needs its fresh real-native run.

`manifest.json` binds all retained raw files to original/compressed hashes.
Commands, stdout/stderr, installed file inventories, fixture sources, package
manifests and a toolchain snapshot are preserved. The environment snapshot was
captured after this package-only run, with no intervening toolchain changes.
