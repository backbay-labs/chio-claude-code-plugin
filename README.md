# Chio for Claude Code

The current candidate adds an MCP-only launcher and repairs the historical
compatibility hooks. **Claude Code is not yet accepted against gates I01-I08.**
The current record is [acceptance/2026-09-09/REPORT.md](acceptance/2026-09-09/REPORT.md).

Real Claude Code 2.1.266 tests demonstrate that a command hook which crashes,
is missing, times out, emits malformed JSON, or silently omits a decision lets
an otherwise permitted native tool execute. A working deny hook prevents the
same disposable write. Consequently, installing the hook plugin does not
establish complete mediation.

## Candidate protected mode

Use the [operator runbook](docs/RESTRICTED-MODE.md). The launcher removes all
native tools and exposes only the bundled Chio MCP gateway. The gateway checks
signed kernel evidence, binds requests to its prepared session and scoped
authority, and retains uncertain operations in its private journal. The resource
server and its credentials must be inaccessible to host-native paths. A local
permission precheck followed by unrestricted execution does not provide that
boundary.

This mode is intended for useful remote workspace tools selected by the
operator. Native Bash, file tools, direct web tools, delegation, background
jobs, skills, hooks, arbitrary MCP servers and resumed sessions are unavailable.
Do not broaden the mode without running the corresponding acceptance cases.

The runtime includes bundled JavaScript under `dist/`; the launcher itself uses
only Node built-ins. Follow the version and artifact pins in the operator
record. No accepted release is claimed by this repository.

## Compatibility hooks

The historical plugin remains available for bounded compatibility testing:

```sh
claude plugin marketplace add backbay-labs/chio-claude-code-plugin
claude plugin install chio@chio
```

That marketplace installation has not been qualified as protected mode.
`PreToolUse` now requires an exact session bond, a nonexpired capability, an
explicit allow decision, a receipt matching the request and capability, and an
operator-pinned `CHIO_TRUSTED_RECEIPT_KEY`. Budgeted calls require a cost oracle;
oracle errors deny. Authorization evidence is persisted before native admission.
The historical bridge daemon path is rejected because it dispatched an MCP
tool during a precheck and could cause duplicate effects.

`PostToolUse` keeps host-reported outcomes explicitly unverified. It does not
turn a signed authorization into a signed execution result. Invalid or
substituted evidence is not archived as successful.

`CHIO_STATE_DIR` selects isolated plugin state. Otherwise state follows
`CLAUDE_CONFIG_DIR`, then the normal Claude directory. `/chio:bond` passes the
actual host session ID; a random session fallback is no longer accepted.
These repairs do not fix host-level hook failure or precheck gaps.

## Verification

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run pack:release -- /absolute/output-directory
bash smoke.sh /absolute/new-evidence-directory
```

The release packaging command stages bundled production dependencies and verifies
that the package can install with an empty offline cache. Direct `npm pack`
refuses an unbundled candidate. A successful local package still requires the
release and host acceptance gates before publication.

`smoke.sh` uses the real installed host with local deterministic model and
resource fixtures. It observes actual disposable file effects and never uses
the normal host profile. Its passing result means the recorded host contract
was reproduced, including demonstrated hook bypasses. It does not mean the
integration passed kernel acceptance.

See [SMOKE.md](SMOKE.md) for exact scope and unresolved tests. The old script
is retained as inert historical text because it deleted normal plugin state.

## License

Apache-2.0
