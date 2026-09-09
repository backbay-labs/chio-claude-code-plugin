# Candidate MCP-only operator runbook

Status: unaccepted. Node >=22 and the exact qualified Claude binary are
required. Gate I08 is open until the tested combination is published and the
complete installation and recovery procedures pass.

## Boundary and preparation

The trusted operator owns the kernel, resource server, capability issuance,
receipt signer pin, prepared gateway config and journal. Run protected resource
tools behind the Chio MCP edge. Keep their storage and credentials outside the
host's available filesystem and credentials. Do not mount a host-visible resource
volume or expose an unguarded second endpoint. Do not give the agent an admin
bearer token or resource credentials.

Prepare a retained MCP kernel session with the companion bridge's
`chio-prepare-gateway` command. Its operator request specifies the exact kernel
endpoint, session-scoped bearer credential, trusted signer keys, server ID,
allowed tool names, a private journal directory and a fresh UUID `sessionId`.
The UUID is also the Claude host session ID. The preparation command discovers
and pins the kernel session's subject and single capability. It executes no tool.
Keep both request and generated config private (0600). Keep the journal 0700.
Never commit these files or put them in a transcript directory.

Record the kernel source revision, binary SHA-256, policy and resource-server
identities, capability and subject identifiers, configured tools, host version,
host SHA-256, plugin artifact SHA-256 and `dist/gateway.js` SHA-256. Record the
actual published package source separately from a development checkout.

## Launch

Authenticate only through a supported explicitly supplied Claude API key or
`CLAUDE_CODE_OAUTH_TOKEN` for a designated test account. The launcher does not
read or copy credentials from the normal profile. The normal profile's OAuth
login is not available in a fresh `CLAUDE_CONFIG_DIR` on the tested machine.

```sh
node /installed/chio/scripts/restricted.mjs \
  --host /absolute/path/to/claude \
  --host-sha256 <qualified-host-sha256> \
  --gateway-sha256 <qualified-dist-gateway-sha256> \
  --gateway-config /operator/private/claude-gateway.json \
  --profile /operator/new-claude-profile \
  --workspace /operator/disposable-empty-workspace \
  --model <qualified-model> < /operator/task.txt
```

The profile must not exist. It, the gateway config and journal must be outside
the resource workspace. The launcher supplies a fixed stdio gateway and fixed
host flags. It accepts no extra host arguments. It records a nonsecret launch
manifest and process exit state in the profile. The transient MCP routing file
is removed on normal exit. The private gateway config and journal are retained.

Verify the real host initialization event: no native tools, only the expected
`mcp__chio__*` tools, no plugins, no custom skills and no additional MCP servers.
Observe the actual resource independently. A gateway result is evidence only
after its signer, caller, request and output binding verify. A model's summary
is not an observer.

## Failure and recovery

A missing or failed gateway exposes no working protected tools. Kernel loss,
malformed or forged evidence and uncertain dispatch results must produce no
new authority. An unknown operation fences the gateway against new dispatch;
never clear the journal merely to make a retry succeed.

After cancellation, timeout or crash, retain the host transcript and gateway
journal. Determine whether the resource committed the operation using its
independent record and the stored request ID. Preserve unknown outcomes until
reconciled. The launcher never retries automatically, and process exit status
makes no claim that effects did or did not happen.

Automatic resume, background sessions and handoff are unsupported in this
candidate mode. A fresh profile is not permission to redispatch an unknown
operation. Establish the outcome first, then have the trusted operator revoke
old authority and prepare a fresh capability and session.

A stale gateway lock after a process crash requires operator reconciliation
and confirmation that the old process is dead. Do not delete the lock while
a resource outcome is unknown. A user-facing automatic recovery tool has not
yet passed I07/I08.

## Upgrade and removal

Retain the old artifact and evidence. Finish or fence in-flight work, reconcile
outcomes, revoke the old session capability, and qualify the replacement against
the same resource tests. Prepare a new config and private journal bound to the
new artifact and authority. Do not reuse a journal with changed session, signer,
capability, endpoint or tool inventory.

For removal, stop the host and gateway, reconcile pending operations, revoke
session authority and close the retained kernel session through supported
operator procedures. Remove the candidate artifact and disposable profile only
after retaining required evidence. Remove a historical marketplace plugin with
`claude plugin uninstall chio@chio` in the profile where it was installed.
Normal user configuration is never a cleanup target of the test scripts.

## Current unresolved delivery requirements

A public compatible kernel and plugin combination, authenticated real-model
workflow, full adversarial native-path inventory, every authority variant,
independent result-substitution checks, crash/restart recovery and measured
upgrade/removal remain required. This runbook is a candidate procedure, not an
acceptance certificate.
