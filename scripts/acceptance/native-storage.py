#!/usr/bin/env python3
"""Real Claude subscription qualification against an isolated kernel storage fault.

Use one newly created storage_fault.py owner per case. Actual SQLite contention
and a retained genuine resource reply establish the cutpoint. Provider output is
never synthesized. No authority, journal, fence, or unknown outcome is reset.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import tarfile
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


def unwrap(value):
    for _ in range(8):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                return {"text": value}
        elif isinstance(value, list) and len(value) == 1 and value[0].get("type") == "text":
            value = value[0]["text"]
        elif isinstance(value, dict) and "content" in value:
            value = value["content"]
        else:
            break
    return value if isinstance(value, dict) else {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["manifest", "helper", "package-dir", "archive", "output"]:
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--cutpoint", required=True, choices=["before-admission", "after-receipt", "after-admission"])
    parser.add_argument("--host", type=Path, default=Path("/Users/connor/.local/share/claude/versions/2.1.267"))
    parser.add_argument("--model", default="claude-sonnet-5")
    parser.add_argument("--artifact-sha256", required=True, help="Explicit immutable candidate archive SHA-256")
    args = parser.parse_args()
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    args.package_dir = args.package_dir.resolve(strict=True)
    args.host = args.host.resolve(strict=True)
    manifest = json.loads(args.manifest.read_text())
    state, shared = Path(manifest["owner"]), Path(manifest["output"])
    name = state.name
    require(not (shared / "fault-locked.json").exists(), "Storage owner already faulted; use a fresh single-use owner")
    require(digest(args.helper) == manifest["helperSha256"], "Storage helper changed after preparation")
    config = Path(manifest["gatewayConfig"])
    config_hash = digest(config)
    configuration = json.loads(config.read_text())
    journal = Path(configuration["journalDir"])
    launcher = args.package_dir / "scripts/restricted.mjs"
    gateway = args.package_dir / "dist/gateway-http.js"
    identity = {"claim": "actual native Claude, real provider, kernel SQLite fault and independent resource effects; bounded storage case only",
                "cutpoint": args.cutpoint, "archiveSha256": digest(args.archive), "launcherSha256": digest(launcher),
                "gatewaySha256": digest(gateway), "hostSha256": digest(args.host), "model": args.model,
                "hostVersion": subprocess.check_output([str(args.host), "--version"], text=True).strip(),
                "harnessSha256": digest(Path(__file__)), "ownerManifest": manifest, "configSha256": config_hash}
    require(re.fullmatch(r"[0-9a-f]{64}", args.artifact_sha256) is not None, "Explicit lowercase artifact SHA-256 required")
    require(identity["archiveSha256"] == args.artifact_sha256, "Archive differs from explicitly selected candidate")
    installed_files = []
    with tarfile.open(args.archive) as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            require(member.name.startswith("package/"), "Archive file is outside package root")
            relative = Path(member.name.removeprefix("package/"))
            require(not relative.is_absolute() and ".." not in relative.parts, "Archive file escapes package root")
            installed = (args.package_dir / relative).resolve(strict=True)
            require(installed.is_relative_to(args.package_dir), "Installed file escapes candidate package")
            expected = hashlib.sha256(archive.extractfile(member).read()).hexdigest()
            actual = digest(installed)
            require(expected == actual, "Installed candidate differs from archive: " + str(relative))
            installed_files.append({"path": str(relative), "sha256": actual})
    require(bool(installed_files), "Archive contained no regular package files")
    identity["installedArchiveFilesVerified"] = len(installed_files)
    save(args.output / "installed-archive-files.json", installed_files)
    save(args.output / "identity.json", identity)
    (args.output / "driver-source.py").write_bytes(Path(__file__).read_bytes())
    (args.output / "storage-helper.py").write_bytes(args.helper.read_bytes())
    environment = os.environ.copy()
    for key in ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "NODE_OPTIONS"]:
        environment.pop(key, None)
    helper_prefix = ["python3", str(args.helper), "--owner-root", str(state.parent), "--output-root", str(shared.parent)]

    def helper(action, *options):
        command = [*helper_prefix, action, "--name", name, *options]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=45)
        require(completed.returncode == 0, "Storage helper failed: " + action + " " + completed.stderr)
        return completed.stdout

    def snapshot(label):
        filename = "native-" + label + ".json"
        helper("snapshot", "--filename", filename)
        shutil.copy2(shared / filename, args.output / filename)
        value = json.loads((shared / filename).read_text())
        require(digest(config) == config_hash, "Original gateway authority changed")
        return value

    def effects(snapshot_value):
        observed = snapshot_value["observation"]
        return {"files": observed["files"], "dispatch": observed["dispatch"]}

    def records(label):
        value = [json.loads(path.read_text()) for path in journal.glob("*.json") if path.name != "authority.binding.json"]
        save(args.output / (label + "-journal.json"), value)
        return value

    def run(label, path, content):
        folder = args.output / label
        folder.mkdir(mode=0o700)
        runtime = Path("/tmp") / ("chio-claude-storage-runtime-" + uuid.uuid4().hex)
        runtime.mkdir(mode=0o700)
        (runtime / "workspace").mkdir(mode=0o700)
        arguments = {"path": path, "content": content}
        prompt = "I am testing the filesystem tool integration and need its actual returned result for this test case. "
        prompt += "Call mcp__chio__write_file exactly once with arguments " + json.dumps(arguments) + ". "
        prompt += "Preserve identifiers and paths exactly. Stop after the returned result, including any unsuccessful, uncertain or pending result. Do not retry or substitute another tool or arguments. Report the returned result."
        (folder / "prompt.txt").write_text(prompt + "\n")
        command = ["node", str(launcher), "--host", str(args.host), "--host-sha256", identity["hostSha256"],
                   "--profile", str(runtime / "profile"), "--workspace", str(runtime / "workspace"),
                   "--gateway-config", str(config), "--gateway-sha256", identity["gatewaySha256"],
                   "--model", args.model, "--model-auth", "claude-login"]
        save(folder / "command.json", command)
        before = snapshot(label + "-before")
        start = time.monotonic()
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, env=environment, start_new_session=True)
        timed_out = False
        try:
            stdout, stderr = process.communicate(prompt, timeout=220)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                stdout, stderr = process.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                stdout, stderr = process.communicate(timeout=10)
        (folder / "host.stdout.jsonl").write_text(stdout)
        (folder / "host.stderr.txt").write_text(stderr)
        after = snapshot(label + "-after")
        calls, outcomes = [], {}
        for line in stdout.splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            blocks = event.get("message", {}).get("content", [])
            for block in blocks if isinstance(blocks, list) else []:
                if block.get("type") == "tool_use":
                    calls.append(block)
                elif block.get("type") == "tool_result":
                    outcomes[block["tool_use_id"]] = unwrap(block["content"])
        terminal, launch = {}, {}
        for filename in ["launch.json", "exit.json"]:
            source = runtime / "profile" / filename
            if source.is_file():
                shutil.copy2(source, folder / filename)
                value = json.loads(source.read_text())
                if filename == "launch.json":
                    launch = value
                else:
                    terminal = value
        if launch:
            relay = Path(launch["control"]) / "model-relay.json"
            if relay.is_file():
                shutil.copy2(relay, folder / "model-relay.json")
        report = {"label": label, "exitCode": process.returncode, "timeout": timed_out, "elapsedSeconds": round(time.monotonic() - start, 3),
                  "newDispatches": len(after["observation"]["dispatch"]) - len(before["observation"]["dispatch"]),
                  "terminal": terminal, "calls": calls, "outcomes": outcomes}
        save(folder / "run.json", report)
        print(json.dumps({key: report[key] for key in ["label", "exitCode", "timeout", "elapsedSeconds", "newDispatches", "terminal"]}), flush=True)
        require(not timed_out, "Native host timed out; unresolved test")
        require(launch.get("modelAuth") == "claude-login" and launch.get("modelTransport") == "operator-messages-relay", "Expected native subscription provider path")
        require(len(calls) == 1 and calls[0]["name"] == "mcp__chio__write_file" and calls[0]["input"] == arguments, "Missing or unexpected actual native tool call")
        require(len(outcomes) == 1 and calls[0]["id"] in outcomes, "Missing native result for actual tool call")
        return report, before, after

    lock = None
    result = {"passed": False, "cutpoint": args.cutpoint}
    try:
        initial = snapshot("initial")
        require(not initial["observation"]["dispatch"] and not records("initial"), "Owner is not a fresh untouched session")
        positive, _, established = run("positive", "/workspace/claude-storage-positive.txt", "acknowledged Claude positive " + args.cutpoint)
        positive_outcome = next(iter(positive["outcomes"].values()))
        require(positive["exitCode"] == 0 and positive["newDispatches"] == 1 and positive["terminal"]["hostDelivery"]["confirmed"] == 1, "Useful positive was not fully delivered")
        require(positive_outcome.get("state") == "completed" and positive_outcome.get("evidence") == "verified", "Positive lacked verified completed evidence")
        positive_records = records("positive")
        require(len(positive_records) == 1 and positive_records[0].get("acknowledged") and positive_records[0].get("hostDeliveryConfirmed"), "Positive delivery was not durably acknowledged")
        with (args.output / "fault-process.stdout.txt").open("w") as stdout, (args.output / "fault-process.stderr.txt").open("w") as stderr:
            command = [*helper_prefix, "fault", "--name", name, "--cutpoint", args.cutpoint, "--wait-seconds", "600", "--hold-seconds", "600"]
            save(args.output / "fault-command.json", command)
            lock = subprocess.Popen(command, stdout=stdout, stderr=stderr)
        if args.cutpoint == "before-admission":
            deadline = time.monotonic() + 20
            while not (shared / "fault-locked.json").exists() and lock.poll() is None and time.monotonic() < deadline:
                time.sleep(0.05)
            require((shared / "fault-locked.json").exists(), "Before-admission lock was not acquired")
        path = "/workspace/before-fault.txt" if args.cutpoint == "before-admission" else "/workspace/uncertain.txt"
        content = "retain original native storage effect " + args.cutpoint
        failure, _, failed = run("fault", path, content)
        require((shared / "fault-locked.json").exists(), "Designated actual SQLite fault did not occur")
        locked = json.loads((shared / "fault-locked.json").read_text())
        require(locked["cutpoint"] == args.cutpoint and lock.poll() is None, "Wrong or already released storage fault")
        expected = 0 if args.cutpoint == "before-admission" else 1
        require(failure["exitCode"] == 2 and failure["terminal"].get("executionOutcome") == "unresolved", "Storage failure was not truthfully unresolved")
        require(failure["newDispatches"] == expected and failure["terminal"]["hostDelivery"]["confirmed"] == 0, "Wrong fault effect count or unexpected acknowledgement")
        unknown = next(iter(failure["outcomes"].values()))
        require(unknown.get("state") == "unknown", "Native host did not receive unknown outcome")
        if expected:
            require(failed["observation"]["files"].get("uncertain.txt") == content, "Actual original effect absent")
        else:
            require(effects(failed) == effects(established), "Before-admission failure produced an effect")
        fault_records = records("fault")
        retained = [record for record in fault_records if record.get("state") == "unknown"]
        require(len(retained) == 1 and not retained[0].get("acknowledged") and not retained[0].get("hostDeliveryConfirmed"), "Original unknown was not retained without ACK")
        fault_id = retained[0]["requestId"]
        helper("unlock")
        require(lock.wait(timeout=15) == 0, "Fault process failed to release SQLite lock")
        lock = None
        released = snapshot("after-unlock")
        require(effects(released) == effects(failed), "Unlock changed resource effects")
        for label, retry_path, retry_content in [("same-action-after-unlock", path, content), ("new-action-after-unlock", "/workspace/claude-storage-blocked.txt", "must not dispatch")]:
            retry, before, after = run(label, retry_path, retry_content)
            require(retry["exitCode"] == 2 and retry["newDispatches"] == 0 and effects(before) == effects(after) == effects(failed), "Same-authority retry bypassed retained uncertainty")
            require(retry["terminal"]["hostDelivery"]["confirmed"] == 0, "Unknown retry was acknowledged")
        owner_launcher = Path(manifest["ownerLauncher"])
        require(digest(owner_launcher) == manifest["ownerLauncherSha256"], "Owner restart implementation changed")
        restart_command = ["python3", str(owner_launcher), "restart", "--state-dir", str(state)]
        restart = subprocess.run(restart_command, capture_output=True, text=True, timeout=45)
        save(args.output / "restart.json", {"command": restart_command, "exitCode": restart.returncode, "stdout": restart.stdout, "stderr": restart.stderr})
        require(restart.returncode == 0, "Supported same-owner restart failed")
        restarted = snapshot("after-owner-restart")
        for label, retry_path, retry_content in [("same-action-after-restart", path, content), ("new-action-after-restart", "/workspace/claude-storage-blocked.txt", "must not dispatch")]:
            retry, before, after = run(label, retry_path, retry_content)
            require(retry["exitCode"] == 2 and retry["newDispatches"] == 0 and effects(before) == effects(after) == effects(failed), "Owner restart reopened uncertain work")
            require(retry["terminal"]["hostDelivery"]["confirmed"] == 0, "Restart acknowledged unknown result")
        # Admission recovery runs asynchronously after owner restart. Retain
        # every observed state and require the expected terminal state without
        # allowing the wait to change authority, journal truth, or effects.
        expected_state = {"before-admission": None, "after-receipt": "completed", "after-admission": "outcome_unknown_after_dispatch"}[args.cutpoint]
        reconciliation = []
        deadline = time.monotonic() + 30
        while True:
            observed = snapshot("reconciliation-" + str(len(reconciliation)))
            rows = observed["databases"]["sessions.sqlite.admission"]["admission_operations"]
            states = [row["state"] for row in rows if row["request_id"] == fault_id]
            reconciliation.append({"states": states, "observedAtEpoch": observed["observation"]["observedAtEpoch"]})
            save(args.output / "admission-reconciliation.json", reconciliation)
            require(effects(observed) == effects(failed), "Admission reconciliation changed resource effects")
            if states == ([] if expected_state is None else [expected_state]):
                break
            require(args.cutpoint == "after-admission" and states == ["dispatch_committed"], "Unexpected durable admission state during reconciliation: " + str(states))
            require(time.monotonic() < deadline, "Durable admission reconciliation did not finish within 30 seconds")
            time.sleep(0.5)
        final = snapshot("final")
        final_records = records("final")
        require(any(record.get("requestId") == fault_id and record.get("state") == "unknown" and not record.get("acknowledged") for record in final_records), "Unknown original request was replaced")
        require(len(final_records) == 2 and effects(final) == effects(failed), "Retries created operation state or resource effects")
        admission = final["databases"]["sessions.sqlite.admission"]
        fault_operations = [row for row in admission["admission_operations"] if row["request_id"] == fault_id]
        fault_outcomes = [row for row in admission["tool_outcomes"] if row["request_id"] == fault_id]
        require([row["state"] for row in fault_operations] == ([] if expected_state is None else [expected_state]), "Unexpected durable admission state after restart")
        require(len(fault_outcomes) == int(args.cutpoint == "after-receipt"), "Unexpected retained durable outcome count")
        verifier = args.output / "verify-fences.mjs"
        verifier.write_text("""import {readFileSync} from 'node:fs';
import {createPublicKey,verify,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [snapshot,publicKeyPath,canonicalPath,sessionId,subjectKey,requestId]=process.argv.slice(2);
const {canonicalizeJson}=await import(pathToFileURL(canonicalPath).href);
const raw=readFileSync(publicKeyPath,'utf8').trim();
if(!/^[0-9a-f]{64}$/i.test(raw))throw Error('Unexpected pinned signer format');
const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(raw,'hex')]),format:'der',type:'spki'});
const data=JSON.parse(readFileSync(snapshot,'utf8')),results=[];
for(const table of ['remote_session_credential_calls','remote_session_credential_latches']){
 const rows=data.databases['sessions.sqlite'][table].filter(row=>row.request_id===requestId);
 if(rows.length!==1)throw Error('Expected one retained original fence');
 const row=rows[0],body=JSON.parse(row.record_json);
 if(body.schema!=='chio.mcp.session-credential-call.v1'||body.state!=='fenced'||body.sessionId!==sessionId||body.subjectKey!==subjectKey||body.requestId!==requestId||row.session_id!==sessionId)throw Error('Fence identity mismatch');
 const preimage=Buffer.from(canonicalizeJson(body));
 if(!verify(null,preimage,key,Buffer.from(row.signature,'hex')))throw Error('Fence signature rejected');
 if(verify(null,Buffer.from(canonicalizeJson({...body,requestId:requestId+'-tampered'})),key,Buffer.from(row.signature,'hex')))throw Error('Tampered fence unexpectedly verified');
 results.push({table,requestId,state:body.state,signatureVerifiedAgainstPinnedKernel:true,tamperedRequestRejected:true,canonicalPreimageSha256:createHash('sha256').update(preimage).digest('hex')});
}
console.log(JSON.stringify(results));
""")
        canonical = args.package_dir / "node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/json.js"
        verified = subprocess.run(["node", str(verifier), str(args.output / "native-final.json"),
            str(state / "sessions.sqlite.admission.kernel.pub"), str(canonical),
            manifest["sessionCredential"]["sessionId"], manifest["sessionCredential"]["subjectKey"], fault_id],
            capture_output=True, text=True, timeout=15)
        require(verified.returncode == 0, "Retained fence signature or binding invalid: " + verified.stderr)
        fences = json.loads(verified.stdout)
        save(args.output / "fence-verification.json", {"canonicalizerSha256": digest(canonical), "rows": fences})
        result.update(passed=True, originalRequestId=fault_id, positiveDispatches=1, faultDispatches=expected,
                      dispatchesAfterRetriesAndRestart=len(final["observation"]["dispatch"]), unknownAcknowledged=False,
                      originalAuthorityPreserved=digest(config) == config_hash, ownerRestarted=True,
                      admissionState=expected_state, retainedToolOutcomes=len(fault_outcomes), ownerFences=fences,
                      recoveryClaim="safe refusal with retained uncertainty; no new authority or automatic reconciliation")
    except Exception as error:
        result["error"] = str(error)
    finally:
        if lock is not None and lock.poll() is None:
            helper("unlock")
            try:
                lock.wait(timeout=15)
            except subprocess.TimeoutExpired:
                # A failed native attempt can leave the helper waiting for a
                # resource reply that never occurred. Stop only our helper.
                lock.terminate()
                lock.wait(timeout=10)
                result["faultHelperStoppedBeforeCompletion"] = True
        for filename in ["fault-locked.json", "fault-released.json", "effect-before-fault.json", "resource-replied.json"]:
            if (shared / filename).exists():
                shutil.copy2(shared / filename, args.output / filename)
        save(args.output / "result.json", result)
        print(json.dumps(result), flush=True)
    require(result["passed"], "Storage qualification failed: " + result.get("error", "unknown"))


if __name__ == "__main__":
    main()
