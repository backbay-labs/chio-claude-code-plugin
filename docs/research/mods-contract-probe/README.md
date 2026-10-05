# Mod middleware contract probe

This standalone research fixture exercises Claude Code's event test harness. All tool calls receive a stubbed result. It does not start a live Claude session, call a model, contact the Chio kernel, or observe a resource effect.

On the recorded Claude Code 2.1.285 build:

```sh
claude plugin validate ./docs/research/mods-contract-probe
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test ./docs/research/mods-contract-probe
```

Validation passed with an optional author-metadata warning. Four tests passed. The default test command without the flag exited 1 because this build treated function hooks as early access. The flag is scoped to that command; it changes no settings file. Documented default-on mods require 2.1.287 or later and ignore this early-access variable.

[RESULTS.json](RESULTS.json) pins the binary and classifies the evidence; [test-output.txt](test-output.txt) retains the successful output. The tests establish the four asserted middleware behaviors only. Host omission, timeout, process death, other mods, resource confinement, and real kernel execution require separate experiments.
