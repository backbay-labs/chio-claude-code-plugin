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

The macOS candidate launcher applies a default-deny process sandbox. The retained
gateway, journal and kernel credential stay in the operator launcher process.
Claude receives only an ephemeral local HTTP MCP token. Its network access is
limited to that transport and the operator's bounded Messages relay. It cannot
read the kernel config or journal, contact the kernel directly, spawn descendant
processes, or write configuration/code. Closing or killing the launcher removes
the local transport. Per-host lifecycle and sandbox acceptance remain required;
the older stdio evidence does not qualify this new boundary.

Prepare a retained MCP kernel session with the companion bridge's
`chio-prepare-gateway` command. The operator request specifies the exact kernel
origin, bootstrap `bearerToken`, a distinct `adminToken`, `credentialTtlSeconds`
(an integer from 1 to 3600), trusted signer keys, server ID, allowed tool names,
a private journal directory and a fresh UUID `sessionId`. The UUID is also the
Claude host session ID. The bootstrap and admin credentials remain outside the
host-readable process boundary; never give the operator request to Claude.

```sh
node /installed/chio/node_modules/@chio/bridge/dist/prepare-gateway.js \
  /operator/private/claude-prepare.json \
  /operator/private/new-claude-gateway.json
```

The command discovers and pins the kernel session's subject and single
capability, then exchanges the operator authority for a credential restricted
to that retained session, server and exact tool allowlist. Only the delegated
bearer is written to the gateway config. The separate `sessionCredential`
metadata records its scope and expiry. Preparation executes no protected tool.
An older kernel without this exchange is incompatible and preparation fails.
Keep both request and generated config private (0600). Keep the journal 0700.
Never commit these files or put them in a transcript directory.

Record the kernel source revision, binary SHA-256, policy and resource-server
identities, capability and subject identifiers, configured tools, host version,
host SHA-256, plugin artifact SHA-256 and `dist/gateway-http.js` SHA-256. Record the
actual published package source separately from a development checkout.

## Launch

Use `--model-auth claude-login` with the operator's existing Claude subscription
login, following the procedure below. For the default API-key mode, omit that
option and supply `ANTHROPIC_API_KEY` to the operator launcher. Provider
credentials stay in the trusted parent; the sandboxed host receives a temporary
relay token. Native subscription requests use the fixed official Anthropic
Messages origin. Local fixtures are supported for labeled tests and do not
establish real-provider acceptance.

```sh
node /installed/chio/scripts/restricted.mjs \
  --host /absolute/path/to/claude \
  --host-sha256 <qualified-host-sha256> \
  --gateway-sha256 <qualified-dist-gateway-sha256> \
  --gateway-config /operator/private/claude-gateway.json \
  --profile /operator/new-claude-profile \
  --workspace /operator/disposable-empty-workspace \
  --model-auth claude-login \
  --model <qualified-model> < /operator/task.txt
```

The profile must not exist. It, the gateway config and journal must be outside
the resource workspace. The launcher supplies a fixed HTTP gateway and fixed
host flags. It accepts no extra host arguments. It records a nonsecret launch
manifest and process exit state in the profile. The transient MCP routing file
is removed on normal exit. The private gateway config and journal are retained.

Verify the real host initialization event: no native tools, only the expected
`mcp__chio__*` tools, no plugins, no custom skills and no additional MCP servers.
Observe the actual resource independently. A gateway result is evidence only
after its signer, caller, request and output binding verify. A model's summary
is not an observer.

## Result semantics

The launcher supplies the native host with fixed result-contract instructions
using Claude's `--append-system-prompt` option. `state: completed` with verified
evidence and `result.isError: false` records a successful tool result, including
when the output sanitizer masks a path or identifier. It does not establish
unredacted output bytes. `receipt.redaction_mode` describes receipt-detail
redaction; `receipt.metadata.post_invocation.sanitized` describes output
sanitization. These fields can truthfully be `none` and `true` together.

Later authorized actions retain original arguments already known from the user.
The host must not copy a masked display into a path, reconstruct unknown redacted
data, or retry an uncertain outcome. If a later action needs information available
only through masked output, it must stop and report the missing information.
Tool errors, denials, approvals and unknown
outcomes retain their existing stop and recovery behavior. These instructions
grant no authority and do not alter signed evidence, verification, delivery
acknowledgements, journals or process isolation.

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

Automatic retries, background sessions and handoff are unsupported in this
candidate mode. A fresh profile is not permission to redispatch an unknown
operation. Preserve the same retained kernel authority and journal for controlled
restart after known completion. New transports namespace host RPC counters so
reset numeric IDs cannot conflict with earlier completed operations. Unknown
operations still fence the shared journal and owner, regardless of a new profile.

A stale lock after a crash can be inspected with `chio-gateway-operator status`
and recovered with `chio-gateway-operator recover-lock`, supplying the absolute
gateway config path. This checks dead process ownership and preserves unknown
operation records. It is not resource-outcome reconciliation. Earlier artifacts
have bounded real Claude crash/restart observations; full acceptance remains
specific to the selected delivered combination.

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

Earlier pinned artifacts have retained real native authenticated workflows,
prevention, authority, result-substitution, crash/restart and upgrade/removal
observations. Each record remains bound to its exact source and artifact hashes.
The selected kernel/plugin combination must complete every applicable I01-I08
case and compatible public delivery; required missing or skipped cases remain
unresolved. This runbook is a candidate procedure, not an acceptance certificate.

## Existing Claude subscription login

Add `--model-auth claude-login` to use the operator's existing `claude auth login` session. The trusted parent briefly starts the pinned native Claude executable with safe mode, no tools, no MCP, no settings sources and no session persistence. Its base URL points to a temporary local authentication observer. Native Claude handles Keychain access and token refresh; the observer accepts one Messages authorization header, refuses inference, terminates the helper and keeps the credential only in parent memory. No provider credential is copied into the protected host, evidence or bundle. Explicit API-key mode remains available as the default.

The parent then forwards only the already bounded Messages requests from the actual sandboxed Claude host. It replaces the temporary relay key with native OAuth authentication and retains the OAuth beta capability required by [Claude's gateway protocol](https://code.claude.com/docs/en/llm-gateway-protocol). The destination remains the fixed Anthropic origin; alternate routes and hosted tools remain refused. See [subscription gateway behavior](https://code.claude.com/docs/en/llm-gateway#subscriptions-and-gateways).

Run `claude auth status` in the trusted operator profile first. If login has expired, run `claude auth login` there and complete any browser/MFA step. Then launch new work with the subscription option. Authentication renewal never reconciles unknown protected outcomes. Do not use `--bare` for the trusted authentication helper because it disables native OAuth; the sandboxed agent retains bare mode and a temporary relay credential.

The 2026-09-09 native subscription run used Claude Code 2.1.267 and claude-sonnet-5. Actual kernel write/read calls succeeded, while the forbidden write was denied. These bounded observations belong to the recorded September 9 artifacts. They do not establish complete I01-I08 acceptance for a successor archive or kernel.
