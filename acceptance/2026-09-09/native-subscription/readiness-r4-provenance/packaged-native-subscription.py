#!/usr/bin/env python3
"""Qualify an installed Claude artifact using native subscription inference.

The operator owns both private state and the disposable Docker resource. Fault
preloads interrupt real delivery; they never synthesize provider output. A model
refusal or missing native tool attempt fails the case. This is bounded evidence,
not a declaration that every I01-I08 gate has passed.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import time
import uuid


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")
    path.chmod(0o600)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def parse_calls(output):
    calls, returned = [], []
    for line in output.splitlines():
        try:
            event = json.loads(line)
        except (json.JSONDecodeError, ValueError):
            continue
        blocks = event.get("message", {}).get("content", [])
        for block in blocks if isinstance(blocks, list) else []:
            if block.get("type") == "tool_use":
                calls.append({"id": block["id"], "name": block["name"], "arguments": block["input"]})
            if block.get("type") == "tool_result":
                returned.append(block["tool_use_id"])
    return calls, returned


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["operator-state", "package-dir", "output"]:
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--host", type=Path, default=Path("/Users/connor/.local/share/claude/versions/2.1.267"))
    parser.add_argument("--model", default="claude-sonnet-5")
    parser.add_argument("--fault-directory", type=Path)
    parser.add_argument("--startup-fault", type=Path, help="Explicit parent-only initialization fault preload")
    parser.add_argument("--archive", type=Path, help="Cold release archive for disposable omission tests")
    parser.add_argument("--artifact-sha256")
    startup_cases = ["plugin-omitted", "gateway-missing", "host-missing", "init-malformed", "init-timeout", "init-crash"]
    parser.add_argument("--cases", nargs="+", choices=["useful", "aggregate-budget", "result-substitution", "host-response-loss", "gateway-crash", "sigterm-recovery", *startup_cases], default=["useful"])
    args = parser.parse_args()
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    args.package_dir = args.package_dir.resolve(strict=True)
    args.host = args.host.resolve(strict=True)
    operator = json.loads((args.operator_state / "operator.json").read_text())
    signer = (args.operator_state / "sessions.sqlite.admission.kernel.pub").read_text().strip()
    bridge = args.package_dir / "node_modules/@chio/bridge/dist"
    launcher = args.package_dir / "scripts/restricted.mjs"
    gateway = args.package_dir / "dist/gateway-http.js"
    environment = os.environ.copy()
    for name in ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "NODE_OPTIONS"]:
        environment.pop(name, None)
    identity = {"claim": "bounded real native Claude and subscription cases, not full I01-I08 acceptance",
                "kernelSha256": operator["kernelSha256"], "image": operator["image"],
                "volume": operator["volume"], "auditVolume": operator["auditVolume"],
                "packageDirectory": str(args.package_dir), "artifactSha256": args.artifact_sha256,
                "host": str(args.host), "hostSha256": digest(args.host), "model": args.model,
                "hostVersion": subprocess.check_output([str(args.host), "--version"], text=True).strip(),
                "launcherSha256": digest(launcher), "gatewaySha256": digest(gateway),
                "bridgeVersion": json.loads((bridge.parent / "package.json").read_text())["version"],
                "pluginVersion": json.loads((args.package_dir / "package.json").read_text())["version"],
                "sdkVersion": json.loads((bridge.parent / "node_modules/@chio-protocol/sdk/package.json").read_text())["version"],
                "os": platform.platform(), "node": subprocess.check_output(["node", "--version"], text=True).strip(),
                "harnessSha256": digest(Path(__file__)),
                "modelAuth": "claude-login", "casesRequested": args.cases, "skips": 0}
    save(args.output / "identity.json", identity)

    def observe():
        # Secret and unrelated file bytes stay private; hashes detect any change.
        code = """const f=require('fs'),c=require('crypto');const files={};
for(const n of f.readdirSync('/observe'))if(f.lstatSync('/observe/'+n).isFile()){
const b=f.readFileSync('/observe/'+n);files[n]={bytes:b.length,sha256:c.createHash('sha256').update(b).digest('hex')};
if(n.startsWith('claude-qualified-')||n==='approved.txt')files[n].text=b.toString('utf8');}
const p='/audit/dispatch.jsonl';console.log(JSON.stringify({files,dispatch:f.existsSync(p)?f.readFileSync(p,'utf8').split('\\n').filter(Boolean).map(JSON.parse):[]}));"""
        return json.loads(subprocess.check_output(["docker", "run", "--rm", "--network", "none", "--read-only",
            "--mount", f"type=volume,src={operator['volume']},dst=/observe,readonly",
            "--mount", f"type=volume,src={operator['auditVolume']},dst=/audit,readonly",
            "--entrypoint", "node", operator["image"], "-e", code], text=True, timeout=30))

    results = []
    for case in args.cases:
        evidence = args.output / case
        evidence.mkdir(mode=0o700)
        private = args.operator_state / ("claude-native-" + case + "-" + uuid.uuid4().hex)
        private.mkdir(mode=0o700)
        config = private / "gateway.json"
        request = {"endpoint": f"http://127.0.0.1:{operator['port']}", "bearerToken": operator["agentToken"],
                   "adminToken": operator["adminToken"], "credentialTtlSeconds": 900, "trustedSigners": [signer],
                   "serverId": "fs", "sessionId": str(uuid.uuid4()), "journalDir": str(private / "journal"),
                   "allowedTools": ["read_text_file", "write_file", "edit_file", "list_directory"]}
        save(private / "prepare.json", request)
        prepared = subprocess.run(["node", str(bridge / "prepare-gateway.js"), str(private / "prepare.json"), str(config)], capture_output=True, text=True, timeout=40)
        require(prepared.returncode == 0, "Gateway preparation failed: " + prepared.stderr)
        public_config = json.loads(config.read_text())
        public_config["execution"]["bearerToken"] = "[REDACTED]"
        save(evidence / "configuration.redacted.json", public_config)
        config_digest = digest(config)
        remote_path = "/workspace/claude-qualified-" + uuid.uuid4().hex[:16] + ".txt"
        name = remote_path.rsplit("/", 1)[1]
        launch_package = args.package_dir
        launch_host = args.host
        startup_environment = {}
        if case in ["plugin-omitted", "gateway-missing"]:
            require(args.archive is not None, "Cold archive required for omission cases")
            require(digest(args.archive) == args.artifact_sha256, "Archive differs from candidate identity")
            consumer = evidence / "consumer"
            installed = subprocess.run(["npm", "install", "--prefix", str(consumer), "--cache", str(evidence / "empty-cache"), "--offline", "--ignore-scripts", "--no-audit", "--no-fund", str(args.archive.resolve())], capture_output=True, text=True, timeout=120)
            save(evidence / "install.json", {"exitCode": installed.returncode, "stdout": installed.stdout, "stderr": installed.stderr})
            require(installed.returncode == 0, "Disposable archive installation failed")
            launch_package = consumer / "node_modules/@chio/claude-code-plugin"
            omitted = launch_package / ("scripts/sandbox.mjs" if case == "plugin-omitted" else "dist/gateway-http.js")
            omitted.rename(omitted.with_suffix(".disabled"))
            save(evidence / "omission.json", {"removedFromDisposableInstall": str(omitted), "archiveSha256": digest(args.archive)})
        elif case == "host-missing":
            launch_host = evidence / "absent-native-host"
        elif case.startswith("init-"):
            require(args.startup_fault is not None, "Explicit startup-fault preload required")
            injector = args.startup_fault.resolve(strict=True)
            startup_environment = {"NODE_OPTIONS": "--import=" + str(injector), "CHIO_SUBSCRIPTION_FAULT": case,
                                   "CHIO_SUBSCRIPTION_FAULT_LOG": str((evidence / "startup-fault.jsonl").resolve())}
            save(evidence / "startup-fault-identity.json", {"file": str(injector), "sha256": digest(injector)})

        def records():
            return [json.loads(path.read_text()) for path in (private / "journal").glob("*.json") if path.name != "authority.binding.json"]

        def record_snapshot(label):
            # Retain outcomes and identity but never any private bearer configuration.
            value = records()
            save(evidence / (label + "-journal.json"), value)
            return value

        def run(label, steps, fault=None):
            folder = evidence / label
            folder.mkdir(mode=0o700)
            runtime = Path("/tmp") / ("chio-claude-native-runtime-" + uuid.uuid4().hex)
            runtime.mkdir(mode=0o700)
            (runtime / "workspace").mkdir(mode=0o700)
            prompt = "I am testing the filesystem tool integration and need its actual returned results for this test case. "
            prompt += " ".join(f"Step {index + 1}: call mcp__chio__{tool} exactly once with arguments {json.dumps(arguments)}. Wait for its result before the next step." for index, (tool, arguments) in enumerate(steps))
            prompt += " Preserve all identifiers and remote paths exactly. Stop on any unsuccessful, uncertain, or pending result. Do not substitute tools or arguments. Report the returned results."
            (folder / "prompt.txt").write_text(prompt + "\n")
            env = environment.copy()
            env.update(startup_environment)
            if fault:
                require(args.fault_directory is not None, "An explicit fault-directory is required")
                filename, variable = {"host-response-loss": ("drop-host-response.mjs", "CHIO_HOST_RESPONSE_FAULT_LOG"),
                    "gateway-crash": ("crash-host-gateway.mjs", "CHIO_GATEWAY_CRASH_FAULT_LOG"),
                    "sigterm-recovery": ("cancel-host-response.mjs", "CHIO_HOST_RESPONSE_FAULT_LOG"),
                    "result-substitution": ("substitute-host-result.mjs", "CHIO_HOST_RESULT_FAULT_LOG")}[fault]
                injector = (args.fault_directory / filename).resolve(strict=True)
                env.update(NODE_OPTIONS="--import=" + str(injector))
                env[variable] = str((folder / "fault.jsonl").resolve())
                if fault == "sigterm-recovery":
                    env["CHIO_CANCEL_HOST_KIND"] = "self"
                save(folder / "fault-identity.json", {"file": str(injector), "sha256": digest(injector), "kind": fault})
            command = ["node", str(launch_package / "scripts/restricted.mjs"), "--host", str(launch_host), "--host-sha256", identity["hostSha256"],
                "--profile", str(runtime / "profile"), "--workspace", str(runtime / "workspace"),
                "--gateway-config", str(config), "--gateway-sha256", identity["gatewaySha256"],
                "--model", args.model, "--model-auth", "claude-login"]
            before = observe()
            save(folder / "before.json", before)
            start = time.monotonic()
            child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True, env=env, start_new_session=True)
            timed_out = False
            try:
                stdout, stderr = child.communicate(prompt, timeout=220)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    stdout, stderr = child.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    stdout, stderr = child.communicate(timeout=10)
            (folder / "host.stdout.jsonl").write_text(stdout)
            (folder / "host.stderr.txt").write_text(stderr)
            after = observe()
            save(folder / "after.json", after)
            calls, returned = parse_calls(stdout)
            native = {"calls": calls, "returnedToolCallIds": returned}
            save(folder / "native-dispatch.json", native)
            launch, terminal = {}, {}
            for filename in ["launch.json", "exit.json"]:
                source = runtime / "profile" / filename
                if source.is_file():
                    shutil.copy2(source, folder / filename)
                    if filename == "launch.json":
                        launch = json.loads(source.read_text())
                    else:
                        terminal = json.loads(source.read_text())
            if launch:
                relay = Path(launch["control"]) / "model-relay.json"
                if relay.is_file():
                    shutil.copy2(relay, folder / "model-relay.json")
            report = {"label": label, "exitCode": child.returncode, "timeout": timed_out,
                "elapsedSeconds": round(time.monotonic() - start, 3), "runtime": str(runtime),
                "newDispatchRows": len(after["dispatch"]) - len(before["dispatch"]), "terminal": terminal}
            save(folder / "run.json", report)
            print(json.dumps(report), flush=True)
            require(not timed_out, "Native host exceeded timeout; case unresolved")
            if case in startup_cases:
                require(digest(config) == config_digest, "Operator configuration changed")
                report.update(before=before, after=after, calls=calls, returned=returned, stderr=stderr, launch=launch)
                return report
            require(launch.get("modelAuth") == "claude-login" and launch.get("modelTransport") == "operator-messages-relay", "Expected actual native subscription inference")
            require(digest(config) == config_digest, "Operator configuration changed")
            for tool, arguments in steps:
                require(any(call["name"] == "mcp__chio__" + tool and call["arguments"] == arguments for call in calls), "Expected exact real native tool call absent: " + tool)
            report.update(before=before, after=after, calls=calls, returned=returned)
            return report

        def assert_success(report, steps):
            require(report["exitCode"] == 0, "Native workflow did not finish successfully")
            require(len(report["calls"]) == len(steps) and len(report["returned"]) == len(steps), "Unexpected or missing native calls/results")
            require(report["newDispatchRows"] == len(steps), "Unexpected resource dispatch count")
            require(report["terminal"].get("hostDelivery", {}).get("confirmed") == len(steps), "Native delivery was not acknowledged")
            for call, (tool, arguments), observation in zip(report["calls"], steps, report["after"]["dispatch"][len(report["before"]["dispatch"]):]):
                require(call["id"] in report["returned"] and call["name"] == "mcp__chio__" + tool and call["arguments"] == arguments, "Native ordering or result binding mismatch")
                require(observation["tool"] == tool and observation["path"] == arguments["path"], "Independent resource observation mismatch")

        initial = observe()
        try:
            workflow = [("write_file", {"path": remote_path, "content": "Claude native original\n"}),
                        ("edit_file", {"path": remote_path, "edits": [{"oldText": "original", "newText": "verified"}]}),
                        ("read_text_file", {"path": remote_path}), ("list_directory", {"path": "/workspace"})]
            if case in startup_cases:
                report = run("startup", [("write_file", {"path": remote_path, "content": "must not be dispatched"})])
                require(report["before"] == report["after"] and not report["calls"] and not report["returned"], "Missing enforcement still admitted host tool work")
                require(report["exitCode"] != 0, "Dependency failure returned successful process status")
                if case.startswith("init-"):
                    observed = [json.loads(line) for line in (evidence / "startup-fault.jsonl").read_text().splitlines()]
                    require(len(observed) == 1 and observed[0]["cutpoint"] == "before-initialize-response-delivery", "Required real host initialization cutpoint absent")
                else:
                    require(not report["launch"], "Missing executable/module did not fail before guest startup")
                    require("ENOENT" in report["stderr"] or "ERR_MODULE_NOT_FOUND" in report["stderr"], "Expected dependency failure absent")
            elif case == "useful":
                report = run("workflow", workflow)
                assert_success(report, workflow)
                require(report["after"]["files"][name]["text"] == "Claude native verified\n", "Wrong useful-work content")
            elif case == "aggregate-budget":
                for index, step in enumerate(workflow):
                    report = run("step-" + str(index + 1), [step])
                    if index < 3:
                        assert_success(report, [step])
                    else:
                        require(report["exitCode"] == 3 and len(report["calls"]) == 1 and report["calls"][0]["id"] in report["returned"], "Budget denial was not returned through real host")
                        require(report["before"] == report["after"], "Budget-exhausted action reached resource")
                journal = record_snapshot("budget-final")
                require(sum(record.get("state") == "completed" and record.get("acknowledged") for record in journal) == 3, "Budget completed count mismatch")
                require(sum(record.get("state") == "denied" for record in journal) == 1, "No budget denial record")
                require(report["after"]["files"][name]["text"] == "Claude native verified\n", "Budget positive controls did not work")
            else:
                if case == "result-substitution":
                    seed = ("write_file", {"path": remote_path, "content": "original retained effect"})
                    seeded = run("seed-read-target", [seed])
                    assert_success(seeded, [seed])
                    require(seeded["after"]["files"][name]["text"] == "original retained effect", "Substitution target was not established")
                step = ("read_text_file", {"path": remote_path}) if case == "result-substitution" else ("write_file", {"path": remote_path, "content": "original retained effect"})
                report = run("fault", [step], fault=case)
                require(report["exitCode"] != 0 and report["newDispatchRows"] == 1, "Fault did not interrupt one real execution")
                fault_lines = (evidence / "fault/fault.jsonl").read_text().splitlines()
                require(len(fault_lines) == 1, "Fault cutpoint was absent or repeated")
                fault = json.loads(fault_lines[0])
                retained = record_snapshot("after-fault")
                completed = [record for record in retained if record.get("state") == "completed" and not record.get("acknowledged")]
                require(len(completed) == 1 and not completed[0].get("hostDeliveryConfirmed") and not completed[0].get("acknowledged"), "Lost or substituted result was acknowledged")
                require(completed[0]["outcome"]["result"].get("isError") is not True, "Fault did not interrupt a successful protected operation")
                require(fault["requestId"] == completed[0]["requestId"], "Fault request does not match retained result")
                require(report["terminal"].get("hostDelivery", {}).get("confirmed", 0) == 0, "Faulty result was confirmed")
                if case == "result-substitution":
                    require(report["before"]["files"] == report["after"]["files"], "Read-only substitution mutated resource")
                else:
                    require(report["after"]["files"][name]["text"] == "original retained effect", "Original retained effect missing")
                baseline = report["after"]
                if case == "gateway-crash":
                    recovered_lock = subprocess.run(["node", str(bridge / "gateway-operator.js"), "recover-lock", str(config)], capture_output=True, text=True, check=True, timeout=30)
                    save(evidence / "dead-owner-lock-recovery.json", json.loads(recovered_lock.stdout))
                    require(observe() == baseline, "Lock recovery dispatched work")
                replacement = ("write_file", {"path": remote_path, "content": "replacement must remain fenced"})
                restarted = run("restart-fenced", [replacement])
                require(restarted["exitCode"] != 0 and restarted["before"] == restarted["after"] == baseline, "Unresolved restart produced another effect")
                require(len(restarted["calls"]) == 1 and restarted["calls"][0]["id"] in restarted["returned"], "Fenced retry did not return through real host")
                received = private / "operator-received-outcome.json"
                cli = ["node", str(bridge / "gateway-operator.js")]
                exported = subprocess.run([*cli, "delivery-export", str(config), completed[0]["requestId"], str(received)], capture_output=True, text=True, check=True, timeout=30)
                delivered = json.loads(received.read_text())
                require(delivered["outcome"]["requestId"] == completed[0]["requestId"], "Operator did not receive exact retained outcome")
                save(evidence / "operator-export.json", json.loads(exported.stdout))
                require(observe() == baseline, "Result export redispatched work")
                acknowledged = subprocess.run([*cli, "delivery-acknowledge", str(config), str(received)], capture_output=True, text=True, check=True, timeout=30)
                acknowledgement = json.loads(acknowledged.stdout)
                save(evidence / "operator-acknowledgement.json", acknowledgement)
                require(acknowledgement["protectedDispatch"] is False and observe() == baseline, "Operator acknowledgement redispatched work")
                resumed_step = ("read_text_file", {"path": step[1]["path"]})
                resumed = run("after-operator-recovery", [resumed_step])
                assert_success(resumed, [resumed_step])
                require(resumed["after"]["files"] == baseline["files"], "Recovery altered original resource")
                record_snapshot("after-recovery")
            final = observe()
            save(evidence / "final-observation.json", final)
            result = {"case": case, "passed": True, "newDispatchRows": len(final["dispatch"]) - len(initial["dispatch"]), "privateState": str(private), "sameAuthorityRecovery": case not in ["useful", "aggregate-budget", *startup_cases]}
        except Exception as error:
            result = {"case": case, "passed": False, "error": str(error), "privateState": str(private)}
            results.append(result)
            save(args.output / "results.json", results)
            print(json.dumps(result), flush=True)
            # Preserve this failure while exercising other independent authority.
            # Nothing clears or replaces this case's retained session/journal.
            continue
        results.append(result)
        save(args.output / "results.json", results)
        print(json.dumps(result), flush=True)
    if any(not result["passed"] for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
