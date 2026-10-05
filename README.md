<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="docs/assets/readme-hero-mobile.svg" />
    <img src="docs/assets/readme-hero.svg" alt="Chio for Claude Code. Claude's reasoning. Chio's authority. Restricted mode runs every Claude tool call through the Chio kernel." width="960" />
  </picture>
</p>

<p align="center">
  <a href="#install">Install</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="#quickstart">Quickstart</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="#how-it-works">How it works</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="docs/GETTING-STARTED.md">Guide</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="https://www.chio.computer">chio.computer</a>
</p>

---

Chio for Claude Code puts [Claude Code](https://github.com/anthropics/claude-code)
on a kernel. Claude reasons and calls tools. [Chio](https://github.com/backbay-labs/chio)
decides what each call may do, performs it through an isolated resource server,
and returns a signed receipt. Claude never holds kernel or provider credentials.

- **Scoped authority.** The operator prepares the session, its capability and
  its trusted signers before launch. Claude sees the declared kernel MCP tools,
  and nothing else.
- **Signed receipts.** Every result is bound to its signer, caller, request and
  output, and verified before Claude sees it.
- **Recoverable outcomes.** An unknown outcome stays in the private journal and
  blocks new dispatch. Nothing is retried blindly.

## Install

```sh
npm install -g @chio-protocol/claude-code-plugin
```

Requires Node.js 22 or newer. Protected runs require macOS. Until the first npm
release, [build from source](docs/GETTING-STARTED.md#build-from-source).

## Quickstart

```sh
chio-claude demo
```

That starts a fixture kernel and an operator watch screen. In a second terminal:

```sh
chio-claude demo attach
```

Ask Claude to write a file with the chio tool, then approve it in the watch
screen. Nothing is protected: the demo kernel signs with a throwaway key, and
every Chio surface says DEMO.

## Run with your kernel

```sh
chio-claude host
chio-claude prepare request.json
chio-claude run "Summarize /workspace/notes.md"
```

`host` downloads the pinned Claude Code and checks its SHA-256. `prepare` turns
your kernel, policy and tools into a session. `run` starts Claude inside the
sandbox, prints the transcript and ends with the recorded outcome. With no task,
`run` opens Claude Code itself, with the Chio pane. The
[guide](docs/GETTING-STARTED.md#run-through-the-kernel) covers the request file,
the defaults and recovery.

### Inside Claude Code

The `chio` plugin adds diagnostic commands and compatibility hooks to an
ordinary session. Install it the standard way:

```text
/plugin marketplace add backbay-labs/chio-claude-code-plugin
/plugin install chio@chio
```

> [!WARNING]
> **The plugin is not a boundary.** It loads inside Claude, and real-host probes
> found hook failures that let an otherwise permitted native tool run.
> Protection comes from `chio-claude run`, which starts Claude inside the
> sandbox.

## How it works

<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="docs/assets/readme-boundary-mobile.svg" />
    <img src="docs/assets/readme-boundary.svg" alt="Claude Code, confined by sandbox-exec, calls declared kernel MCP tools. The trusted Chio launcher's gateway sends a scoped request to the Chio kernel, which checks authority and executes through the resource server. The outcome returns as a signed receipt and a verified result." width="960" />
  </picture>
</p>

`chio-claude run` starts Claude Code under `sandbox-exec`, with its native Bash,
file and web tools turned off. Claude can reach two local endpoints, both owned
by the trusted launcher: the kernel gateway and a bounded Messages relay. The
launcher holds the credentials and keeps the private journal. The kernel checks
each call against the delegated authority and dispatches it to the resource
server.

## What ships

| Entrypoint | What it is |
| --- | --- |
| `chio-claude` | The CLI: demo, pinned host, session preparation, runs and operator control |
| `scripts/restricted.mjs` | The restricted launcher behind `run`: macOS sandbox, kernel gateway, model relay and host supervisor |
| Chio pane | The native session interface: `/chio`, `/chio-status`, `/chio-review`, `/chio-why` and more, pinned by digest |
| `chio` plugin | The Claude marketplace plugin: diagnostic `/chio:*` commands and compatibility hooks |
| `@chio-protocol/claude-code-plugin` | The library behind the commands: bonds, approvals, revocation, receipts and plugin state |

## Status

`0.4.0-rc.5` is a candidate for Claude Code 2.1.287 on macOS. It is not on npm
yet.

- **Recorded.** Fixture-level acceptance: the Node and native harness suites,
  and eight actual-host scenarios against a stubbed kernel and a local model,
  in the [rc.5 record](acceptance/2026-10-05/rc5/REPORT.md).
- **Not yet.** Production qualification. Live session lifecycle, kernel
  decisions, interactive protection, native recovery and cold install remain open, and the
  publication guard refuses until they pass.
- **Open blockers.** Six, listed in the record, including the kernel source
  revision for live runs.

## Documentation

| Guide | Covers |
| --- | --- |
| [Getting started](docs/GETTING-STARTED.md) | The full walkthrough: install, the demo, prepare, run, outcomes, the boundary and recovery |
| [Native interface](docs/NATIVE-MODS.md) | The Chio pane: activation, scoped credentials and operator confirmation |
| [Controlled tasks](docs/CONTROLLED-TASKS.md) | Artifact-bound completion evidence, guided scopes and exact continuation |
| [Restricted mode](docs/RESTRICTED-MODE.md) | The operator runbook: preparation, launch, subscription login, results, failure and upgrade |
| [Release qualification](docs/RELEASE-QUALIFICATION.md) | Packaging, the documented-install check and release prerequisites |
| [Publishing](docs/PUBLISHING.md) | The npm trusted-publishing bootstrap and later releases |
| [Host contract probes](SMOKE.md) | Native hook-contract tests and the bypasses they found |

Qualification records: [rc.5 record](acceptance/2026-10-05/rc5/REPORT.md) and
the [qualification environment report](acceptance/2026-10-03/qualification-environment/REPORT.md).

## Development

```sh
git clone https://github.com/backbay-labs/chio-claude-code-plugin.git
cd chio-claude-code-plugin
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck && npm run build && npm test
npm run pack:release -- /absolute/new-candidate-directory
```

`pack:release` writes a self-contained tarball and its SHA-256. Direct
`npm pack` refuses. Build and test results do not establish real-host
acceptance.

---

<p align="center">
  <a href="LICENSE">Apache-2.0</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="https://www.chio.computer">chio.computer</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="https://github.com/backbay-labs/chio">Chio</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="https://github.com/anthropics/claude-code">Claude Code</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
  <a href="https://github.com/backbay-labs/chio-bridge">Chio bridge</a>
</p>
