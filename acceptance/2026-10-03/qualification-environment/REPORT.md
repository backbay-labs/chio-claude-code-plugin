# Dedicated qualification environment and shared VM recovery

**Candidate: 0.4.0-rc.3. Production qualification: incomplete.**

The shared VM's shell and selected image reads recovered after a controlled
restart. All six original containers, image identities and volume bindings
were retained; PostgreSQL and Redis became healthy. Separate qualification
VMs now isolate Chio experiments from those application services.

The infrastructure repair exposed concrete enforcing-runtime failures. It
did not establish the protected workflow. One approved native file write
occurred before seccomp killed its `fsync` call. The kernel and gateway retained
that original unknown operation through restart, with one observed write and
one captured invocation. A verified original result was never produced.

Confidence is **high** in these observed outcomes and the exact syscall audit,
**moderate** in Docker-client incompatibility as the cause of its separate
`SIGSYS` failure, and **unknown** in the initiating cause of the shared VM's
storage fault. Publication remains refused and PR #3 remains draft.

## Preserved shared services

The original default profile was preserved before restart using both a running
disk checkpoint and a stopped disk/configuration checkpoint. The running copy
is not application consistent. Shutdown alone does not establish consistency
of databases on a guest that was already reporting storage faults.

After restart, all six original volume archives were copied privately. Matching
PostgreSQL 16 archives and globals were restored in a separate, network-disabled
PostgreSQL 16 container. All four complete archives restored successfully,
with 32 user tables across them. The existing bootstrap `postgres` role creation
was skipped; the rest of the globals were restored. A separate network-disabled
Redis load passed its RDB integrity check and restored three keys.

These are actual restore checks. They do not establish application behavior,
cross-service consistency, or a common backup cutpoint. Private dumps, volume
archives, operator records and disk copies remain outside Git.

The original filesystem still reports ext4 errors and an offline-check
recommendation. An unmounted disk copy was inspected, its actual GPT/ext4 root
partition identified, and repair attempted only on another disposable copy.
After journal replay and repair, that disposable copy passed `e2fsck -fn`.
The shared VM's original disk was neither repaired nor replaced. Restoring the
repaired copy would require a separate application-data recovery decision.

[SHARED-VM.json](./SHARED-VM.json), [RESTORE-CHECKS.json](./RESTORE-CHECKS.json)
and [DOCTOR-SHARED.json](./DOCTOR-SHARED.json) retain sanitized observations.

## Environment and selected artifacts

| Profile | Role | Allocation | Runtime |
| --- | --- | --- | --- |
| `default` | Existing application services | Existing 60 GiB disk | ARM VZ, Docker context `colima` |
| `chio-native-qualification` | Native ARM builds, isolated restores, disk-copy inspection | 4 CPUs, 8 GiB RAM, 40 GiB disk | ARM VZ |
| `chio-native-qualification-x86` | Selected enforcing owner experiments | 4 CPUs, 8 GiB RAM, 40 GiB disk | Full-system x86_64 QEMU |

The first ARM profile proved fresh guest execution and storage access. The
selected kernel source supports native cage enforcement only on x86_64, so a
second profile uses a real x86_64 Linux kernel. Userspace emulation on an ARM
kernel would not establish that contract. The ARM builder was stopped after
its artifacts and backups were retained. The x86 qualification profile remains
available. The operator's active Docker context remains `colima`.

The installed Colima is 0.8.4 and Lima is 2.1.4. No CLI upgrade or profile deletion
was performed. Qualification profiles were created with `--activate=false` and
all host Docker calls explicitly selected their context.

The selected Rust source is
`de84fc306efbb4c8dd6de748d0ad2a8d695fd30e`. The build used pinned Rust 1.94.1,
the retained Cargo lock, native ARM cross-compilation and the `docker-release`
profile with optimization level 1, LTO off and overflow checks enabled.
Distribution package versions were inventoried rather than frozen; an arbitrary
rebuild cannot inherit these binary identities.

| Artifact | Selected identity |
| --- | --- |
| Kernel, reports `chio-cli 0.1.0` | `302d058f0793fe1b975229425db02105a3403830ede99877d422dc8aa35244a9` |
| Static cage init | `8167803d38b26bfa93da105e94861dddf3a27f2e3690801fdd3c59290fdbb8bf` |
| x86 Docker filesystem image | `sha256:648682c65411e9db1ef49996000501f22359910258bbbc758abe5467397952a5` |
| Separate static native writer | `ce7c20d1b72d2e0dafa0bf0187de66326f60730d41b6ea13181c2e9c3f9e6b86` |

Private kernel stores, publisher/operator material, credentials and resources
reside inside the Linux owner environment. The receipt anchors use distinct
loopback ext4 filesystems on the same VM disk. They have separate filesystem
device identities; they do not provide independent physical failure domains.

[ENVIRONMENT.json](./ENVIRONMENT.json) records profile and artifact pins.
[DOCTOR-X86.json](./DOCTOR-X86.json) establishes guest and image availability,
with filesystem integrity and protected-workflow qualification still unchecked.

## Source fixes

The companion owner launcher now requires an explicit Docker context, records
its resolved endpoint and daemon identity, and rechecks that binding before
restart. All image, volume and launch calls use the selected absolute Docker
executable and context. A changed or legacy binding fails before signaling
the existing owner; state is preserved for an explicit migration.

Live preparation also exposed a missing runtime identity binding. The kernel's
default server name differed from the signed resource manifest. The helper now
derives the exact server name and version from the pinned manifest, binds them
in the kernel command and validates them before restart. Applying those exact
arguments to the separate native owner made authenticated preparation succeed.
No signing keys, session databases or original resource were replaced.

The companion change is local commit
`cf378e457bc9714977c698457695bd466800793e`, containing only six qualification
helper, test, recipe and documentation files. The [scoped patch](./OWNER-CONTEXT.patch)
is retained here. It has not been merged into or published from the kernel
repository. Its 77 Python integration regressions passed; a whole Rust
workspace release qualification is not claimed.

The plugin adds immediate `/chio-doctor` and a separate trusted-operator
`scripts/doctor.mjs`. The native command distinguishes control availability,
authority expiry, retained denial and uncertain original outcomes. It makes
no control submission or protected dispatch. The operator probe checks the
selected guest shell, root/Docker free space, inodes, kernel storage warnings,
daemon identity and immutable image reads. It cannot repair disks or establish
workflow qualification. See [the native runbook](../../../docs/NATIVE-MODS.md).

## Live enforcing experiments

| Experiment | Actual observation | Boundary |
| --- | --- | --- |
| Docker resource discovery | Real image listed fourteen tools, with `execution.taskSupport: "forbidden"` | Selected manifest provisioner rejects that metadata; a reviewed synchronous four-tool projection was used only for launch probes |
| Docker enforcing launch | Provisioning and owner startup succeeded; caged static Docker client exited on signal 31, `SIGSYS` | Actual receipt records fully enforced Landlock and seccomp; MCP initialization failed and no protected tool ran |
| Native exact-file owner | Correct signed server identity allowed authenticated preparation | Separate resource profile; cannot qualify the Docker filesystem server |
| Missing exact approval | Signed denial, no resource write and no captured invocation | Tested with a separate negative session; its retained fence was preserved |
| Exact native review | Kernel accepted the exact decision; stale review, foreign session, wrong viewer token and repeated decision were rejected | Review confirmation did not dispatch the write |
| Deterministic continuation | One accepted continuation; duplicate continuation refused | Actual native file effect occurred once, followed by `fsync` rejection |
| Unknown outcome across restart | Same original unknown ID, signed incomplete receipt and dispatch fence; one observed write and one captured invocation remained | No verified original result; no protected request was redispatched during restart checks |
| Post-restart credential check | An unexpired retained credential received HTTP 401 on read-only `chio/execution-context` | Cause unresolved; reconnect and credential lifecycle remain unqualified |
| Live provider check | Refreshed selected Claude 2.1.287 profile reports `claude.ai` login; native credential acquisition succeeds | Actual print-argument requests reached Anthropic through the selected relay; all eight returned HTTP 429, with no successful model result |

The Docker-client receipt does not identify its first rejected syscall. Source
inspection shows the selected cage forbids socket creation and other process
facilities used by an ordinary Docker client; that explanation remains an
inference for this specific exit. A statically linked client removes dynamic
linkage ambiguity and does not solve its effect-route contract. The client was
obtained through [Docker's documented binary distribution](https://docs.docker.com/engine/install/binaries/);
the daemon and shared services were not replaced.

The native writer's rejected syscall is confirmed by the Linux audit:
`arch=c000003e syscall=74 sig=31`. The
[Linux x86_64 syscall table](https://raw.githubusercontent.com/torvalds/linux/v6.8/arch/x86/entry/syscalls/syscall_64.tbl)
maps 74 to `fsync`. The writer calls `write_all` followed by `sync_all`.
The independent read-only inotify observer recorded one close-write and the
expected 38-byte file hash. This establishes an observed effect; the failed
durability barrier cannot establish a stable-storage commit.

The kernel retained `outcome_unknown_after_dispatch`, and the verified signed
receipt's verdict is `incomplete`. Before and after restart, the grant recorded
one captured invocation, no reserved invocation and no monetary spend.
The original result was never returned, acknowledged or reconciled. This is
useful negative acceptance evidence, not a passing recovery demonstration.

Sanitized records:
[Docker launch](./DOCKER-LAUNCH.json),
[tool projection](./TOOLS-PROJECTION.json),
[native enforcement](./NATIVE-OWNER.json),
[exact decisions](./NATIVE-DECISIONS.json),
[syscall audit](./NATIVE-SYSCALL.json),
[retained unknown operation](./NATIVE-RESTART.json),
[credential revalidation](./NATIVE-CREDENTIAL.json),
[provider preflight](./PROVIDER.json).

The user's login correction was checked live and supersedes the earlier
logged-out observation. The provider test used empty tools and the delivered
print argument builder, with a 90-second deadline. Host retries received eight
HTTP 429 responses; the probe was terminated and no further retry campaign
continued. A separate safe-mode probe was refused before provider forwarding
because it included an unsupported `safeguards` field. These observations do
not establish provider behavior for the joined protected workflow.

## Next qualification gates

1. Bind the actual MCP tool inventory, including its execution metadata, in a
   publisher-reviewed manifest contract. Preserve the source discovery record.
2. Define an enforcing resource launch contract. Prefer a narrow resource-owned
   broker over letting an ordinary Docker CLI exercise a broad daemon socket
   inside the cage. Qualify that new boundary independently.
3. Qualify native file durability, including authorized `fsync` and `fdatasync`
   semantics, inherited descriptors and forbidden paths. Removing `sync_all`
   or changing to a weaker migration stage cannot satisfy this gate.
4. Resolve retained credential revalidation after owner restart without issuing
   a new execution session, duplicating authority or clearing the unknown fence.
5. Resolve the observed provider HTTP 429 condition, then run actual provider,
   full reload/resume/branch/reconnect and delivered-launcher custody cases
   using the now-authenticated operator profile.
6. On fresh disposable state, commit a durable approved effect, lose the real
   response, restart and recover its verified original result with one effect
   and one invocation charge. Preserve this original unknown operation separately.
7. Complete cold activation of the exact package against the qualified owner.

The [current acceptance record](../controlled-workflows/ACCEPTANCE.json) retains
`productionQualified: false`. Local regressions, selected-host fixtures and
offline package checks cannot promote these open gates into production evidence.
