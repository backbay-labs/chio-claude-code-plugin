#!/usr/bin/env python3
"""Three healthy paired native-Claude/direct-bridge reads, without a load claim.

Both routes use the same frozen bridge/kernel/resource and read-only tool scope.
Claude's native MCP interval includes dispatcher, local gateway, journal and
verified execution. Direct execute() excludes baseline reservation persistence.
Preparation, model generation, startup and subsequent delivery ACK are excluded.
"""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
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
                return {}
        elif isinstance(value, list) and len(value) == 1 and value[0].get("type") == "text":
            value = value[0]["text"]
        elif isinstance(value, dict) and "content" in value:
            value = value["content"]
        else:
            break
    return value if isinstance(value, dict) else {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["operator-state", "package-dir", "archive", "output"]:
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--resource", required=True)
    parser.add_argument("--host", type=Path, default=Path("/Users/connor/.local/share/claude/versions/2.1.267"))
    args = parser.parse_args()
    args.output.mkdir(mode=0o700, parents=True)
    args.package_dir = args.package_dir.resolve(strict=True)
    args.host = args.host.resolve(strict=True)
    operator = json.loads((args.operator_state / "operator.json").read_text())
    require(digest(args.archive) == "0dd0d906fc34b3ac7d09e3b7f6cdee9f13f511731b25ec761feca7172c9b1158", "Expected frozen r5 archive")
    require(operator["kernelSha256"] == "33dd1dea21a4ca5ecddeab4f30f6b06b0b90c513f0987aef552b0633d9da1e25" and operator["port"] == 58494, "Expected dedicated healthy frozen kernel")
    require(args.resource.startswith("/workspace/claude-qualified-") and Path(args.resource).parent.as_posix() == "/workspace", "Use the designated existing qualification file")
    bridge = args.package_dir / "node_modules/@chio/bridge"
    launcher, gateway = args.package_dir / "scripts/restricted.mjs", args.package_dir / "dist/gateway-http.js"
    signer = (args.operator_state / "sessions.sqlite.admission.kernel.pub").read_text().strip()
    (args.output / "driver-source.py").write_bytes(Path(__file__).read_bytes())
    identity = {"claim": "three bounded paired healthy reads; direct calls are performance controls, not host acceptance",
                "archiveSha256": digest(args.archive), "kernelSha256": operator["kernelSha256"], "image": operator["image"],
                "volume": operator["volume"], "auditVolume": operator["auditVolume"], "policySha256": operator["policySha256"],
                "launcherSha256": digest(launcher), "gatewaySha256": digest(gateway), "bridgeEntrySha256": digest(bridge / "dist/index.js"),
                "hostSha256": digest(args.host), "hostVersion": subprocess.check_output([str(args.host), "--version"], text=True).strip(),
                "harnessSha256": digest(Path(__file__)), "resource": args.resource, "allowedTools": ["read_text_file"], "model": "claude-sonnet-5"}
    save(args.output / "identity.json", identity)

    def observe():
        code = "const f=require('fs'),c=require('crypto'),files={};for(const n of f.readdirSync('/observe'))if(f.lstatSync('/observe/'+n).isFile())files[n]=c.createHash('sha256').update(f.readFileSync('/observe/'+n)).digest('hex');console.log(JSON.stringify({files,dispatch:f.readFileSync('/audit/dispatch.jsonl','utf8').split('\\n').filter(Boolean).map(JSON.parse)}));"
        return json.loads(subprocess.check_output(["docker", "run", "--rm", "--network", "none", "--read-only", "--mount",
            f"type=volume,src={operator['volume']},dst=/observe,readonly", "--mount", f"type=volume,src={operator['auditVolume']},dst=/audit,readonly",
            "--entrypoint", "node", operator["image"], "-e", code], text=True, timeout=30))

    def prepare(label):
        private = args.operator_state / ("claude-paired-timing-" + label + "-" + uuid.uuid4().hex)
        private.mkdir(mode=0o700)
        request = {"endpoint": f"http://127.0.0.1:{operator['port']}", "bearerToken": operator["agentToken"], "adminToken": operator["adminToken"],
                   "credentialTtlSeconds": 900, "trustedSigners": [signer], "serverId": "fs", "sessionId": str(uuid.uuid4()),
                   "journalDir": str(private / "journal"), "allowedTools": ["read_text_file"]}
        save(private / "prepare.json", request)
        config = private / "gateway.json"
        result = subprocess.run(["node", str(bridge / "dist/prepare-gateway.js"), str(private / "prepare.json"), str(config)], capture_output=True, text=True, timeout=40)
        require(result.returncode == 0, "Fresh healthy read-only authority preparation failed")
        public = json.loads(config.read_text())["sessionCredential"]
        require(public["allowedTools"] == ["read_text_file"], "Baseline/native authority scope differs from read-only selection")
        return private, config, public

    baseline = args.output / "direct-bridge.mjs"
    baseline.write_text("""import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
const [entry,configPath,resource,recordDir]=process.argv.slice(2);
const {createMcpExecutionClient}=await import(pathToFileURL(entry).href);
const config=JSON.parse(fs.readFileSync(configPath));const client=createMcpExecutionClient(config.execution);
if(!(await client.validateSession({allowedTools:['read_text_file']})).ok)throw Error('Baseline authority validation failed');
fs.mkdirSync(recordDir,{mode:0o700});
function persist(name,value){const fd=fs.openSync(recordDir+'/'+name,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}const dir=fs.openSync(recordDir,'r');try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)}}
const request={tool:'read_text_file',arguments:{path:resource},requestId:'claude-timing:'+randomUUID()};
persist('pending.json',request);
const start=process.hrtime.bigint();const outcome=await client.execute(request);const end=process.hrtime.bigint();
persist('outcome.json',outcome);
if(outcome.state!=='completed'||outcome.evidence!=='verified'||outcome.result?.isError)throw Error('Unsuccessful baseline retained; never retry automatically');
const ack=await client.acknowledge(outcome);persist('acknowledgement.json',ack);
if(!ack.acknowledged)throw Error('Baseline delivery ACK failed');
console.log(JSON.stringify({startMonotonicNs:String(start),endMonotonicNs:String(end),elapsedMs:Number(end-start)/1e6,requestId:request.requestId,state:outcome.state,evidence:outcome.evidence,acknowledged:ack.acknowledged}));
""")
    environment = os.environ.copy()
    for key in ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "NODE_OPTIONS"]:
        environment.pop(key, None)
    before = observe()
    save(args.output / "before.json", before)
    require(Path(args.resource).name in before["files"], "Designated immutable read target is absent")
    samples = []
    for index in range(1, 4):
        folder = args.output / ("pair-" + str(index))
        folder.mkdir(mode=0o700)
        direct_private, direct_config, direct_scope = prepare("direct-" + str(index))
        direct_digest = digest(direct_config)
        direct = subprocess.run(["node", str(baseline), str(bridge / "dist/index.js"), str(direct_config), args.resource,
            str(direct_private / "performance-records")], capture_output=True, text=True, timeout=60, env=environment)
        (folder / "direct.stdout.json").write_text(direct.stdout)
        (folder / "direct.stderr.txt").write_text(direct.stderr)
        require(direct.returncode == 0, "Direct bridge performance control failed; preserve state")
        direct_time = json.loads(direct.stdout)
        shutil.copytree(direct_private / "performance-records", folder / "direct-records")
        native_private, config, native_scope = prepare("native-" + str(index))
        config_digest = digest(config)
        runtime = Path("/tmp") / ("chio-claude-paired-native-" + uuid.uuid4().hex)
        runtime.mkdir(mode=0o700)
        (runtime / "workspace").mkdir(mode=0o700)
        prompt = "Call mcp__chio__read_text_file exactly once with arguments " + json.dumps({"path": args.resource}) + ". Report the returned content. Do not use another tool, change arguments, or retry."
        (folder / "prompt.txt").write_text(prompt + "\n")
        command = ["node", str(launcher), "--host", str(args.host), "--host-sha256", identity["hostSha256"], "--profile", str(runtime / "profile"),
                   "--workspace", str(runtime / "workspace"), "--gateway-config", str(config), "--gateway-sha256", identity["gatewaySha256"],
                   "--model", "claude-sonnet-5", "--model-auth", "claude-login"]
        save(folder / "native-command.json", command)
        child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=environment, start_new_session=True)
        timeout = False
        try:
            stdout, stderr = child.communicate(prompt, timeout=180)
        except subprocess.TimeoutExpired:
            timeout = True
            os.killpg(child.pid, signal.SIGTERM)
            try:
                stdout, stderr = child.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                stdout, stderr = child.communicate(timeout=10)
        (folder / "native.stdout.jsonl").write_text(stdout)
        (folder / "native.stderr.txt").write_text(stderr)
        require(not timeout and child.returncode == 0, "Native healthy read did not complete")
        for filename in ["launch.json", "exit.json"]:
            shutil.copy2(runtime / "profile" / filename, folder / filename)
        launch = json.loads((folder / "launch.json").read_text())
        terminal = json.loads((folder / "exit.json").read_text())
        require(launch["modelAuth"] == "claude-login" and terminal["hostDelivery"]["confirmed"] == 1, "Expected native provider inference with delivery ACK")
        calls, results = [], {}
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
                    results[block["tool_use_id"]] = unwrap(block["content"])
        require(len(calls) == 1 and calls[0]["name"] == "mcp__chio__read_text_file" and calls[0]["input"] == {"path": args.resource}, "Actual native tool call differs from baseline")
        require(len(results) == 1 and calls[0]["id"] in results, "Expected bound native tool result")
        returned = results[calls[0]["id"]]
        require(returned.get("state") == "completed" and returned.get("evidence") == "verified" and not returned.get("result", {}).get("isError"), "Native read did not produce verified completed evidence")
        direct_result = json.loads((folder / "direct-records/outcome.json").read_text())
        require(returned["result"] == direct_result["result"], "Native and direct resource result bytes differ")
        argv = json.loads((Path(launch["control"]) / "host-supervisor.json").read_text())["args"]
        debug = Path(argv[argv.index("--debug-file") + 1])
        starts, ends, headers = [], [], []
        for line in debug.read_text().splitlines():
            match = re.match(r'^(\S+) \[DEBUG\] MCP server "chio": (.+)$', line)
            if not match:
                continue
            stamp, message = match.groups()
            if message == "Calling MCP tool: read_text_file":
                starts.append(datetime.fromisoformat(stamp)); headers.append(line)
            elif message.startswith("Tool 'read_text_file' completed successfully in "):
                ends.append(datetime.fromisoformat(stamp)); headers.append(line)
        require(len(starts) == len(ends) == 1 and ends[0] > starts[0], "Ambiguous native MCP timing interval")
        native_ms = (ends[0] - starts[0]).total_seconds() * 1000
        records = [json.loads(path.read_text()) for path in (native_private / "journal").glob("*.json") if path.name != "authority.binding.json"]
        require(len(records) == 1 and records[0].get("acknowledged") and records[0].get("hostDeliveryConfirmed"), "Native result lacked durable acknowledgement")
        require(digest(direct_config) == direct_digest and digest(config) == config_digest, "Prepared authority changed")
        save(folder / "native-journal.json", records)
        save(folder / "native-timing.json", {"originalDebugLog": str(debug), "originalDebugSha256": digest(debug), "rawTimingHeaders": headers,
                                             "nativeMcpIntervalMs": native_ms, "timestampPrecision": "native ISO timestamps at millisecond resolution"})
        save(folder / "scopes.json", {"direct": direct_scope, "native": native_scope, "directConfigSha256": direct_digest, "nativeConfigSha256": config_digest})
        sample = {"pair": index, "order": ["direct-bridge", "native-Claude"], "directBridgeExecuteMs": direct_time["elapsedMs"],
                  "nativeClaudeMcpIntervalMs": native_ms, "pairedDifferenceMs": native_ms - direct_time["elapsedMs"],
                  "directPrivateState": str(direct_private), "nativePrivateState": str(native_private), "arguments": {"path": args.resource}}
        samples.append(sample)
        save(args.output / "samples.json", samples)
        print(json.dumps(sample), flush=True)
    after = observe()
    save(args.output / "after.json", after)
    added = after["dispatch"][len(before["dispatch"]):]
    require(before["files"] == after["files"] and len(added) == 6, "Unexpected effect or independent dispatch count")
    require(all(row["tool"] == "read_text_file" and row["path"] == args.resource for row in added), "Unrelated resource dispatch occurred")
    save(args.output / "summary.json", {"passed": True, "pairedSamples": 3, "nativeCalls": 3, "baselineOperatorCalls": 3,
        "independentReadDispatches": 6, "resourceContentUnchanged": True, "samples": samples,
        "scope": "Native Claude MCP call-to-completion versus direct frozen bridge execute-to-verified-response on the same resource and read-only tool scope. Both include kernel/resource/bridge verification. Native adds dispatcher, local HTTP gateway and journal reservation/persistence. Direct reservation persistence occurs before timing. Preparation, model inference, startup, and later ACK are excluded.",
        "limitations": "Three sequential pairs, direct first each time; separate fresh scoped sessions; native millisecond wall timestamps versus direct monotonic nanoseconds. No randomized order, load distribution, total kernel-overhead estimate, performance guarantee, or general latency claim. Direct executions are timing controls only, never native host acceptance."})


if __name__ == "__main__":
    main()
