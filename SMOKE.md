# Claude runtime contract probes

Run `bash smoke.sh /absolute/new-evidence-directory` with Python 3, Node and
the installed Claude executable on PATH. The script creates fresh private
profiles and disposable workspaces. It uses a localhost Messages API fixture
to deterministically request tools through the actual Claude runtime, and
checks filesystem effects independently of hook output.

The fixture is not a real model, Chio kernel, signed receipt or authority
service. The explicit evidence class is
`REAL_HOST_LOCAL_MODEL_FIXTURE_NO_CHIO_KERNEL`. A successful probe script does
not establish any host as accepted.

Cases cover an observer positive control, structured deny, exit 2, hook crash,
missing script, timeout, malformed response, silent omission, unavailable native
Bash in restricted mode, and useful/denied/unavailable local MCP fixture effects.
Raw host events, model tool-result requests, MCP calls and effect observations
are retained. Probe integrity fails if the host did not actually request the
tool or if the independent observer differs from the expected result.

Claude 2.1.266 observations and I01-I08 status are recorded in
[acceptance/2026-09-09/REPORT.md](acceptance/2026-09-09/REPORT.md).

The old `smoke.sh` is preserved as
[legacy-smoke.sh.txt](acceptance/2026-09-09/legacy-smoke.sh.txt). It hardcoded
private sibling checkouts, directly invoked the deny hook and deleted
`~/.claude/plugins/chio` state. Do not execute it. Its historical transcript
cannot qualify the current plugin or host.
