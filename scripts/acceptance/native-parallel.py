#!/usr/bin/env python3
"""Supplemental real Claude/kernel parallel batch with an explicit local model fixture.

No provider credentials or normal profile are used. This does not qualify real
model inference. It verifies native dispatch, kernel serialization/fencing,
observed effects, delivery acknowledgement, and truthful launcher exit status.
"""
import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import uuid


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")
    path.chmod(0o600)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def outcome(value):
    for _ in range(6):
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
    parser.add_argument("--host", type=Path, default=Path("/Users/connor/.local/share/claude/versions/2.1.267"))
    args = parser.parse_args()
    args.output.mkdir(mode=0o700, parents=True)
    (args.output / "driver-source.py").write_bytes(Path(__file__).read_bytes())
    operator = json.loads((args.operator_state / "operator.json").read_text())
    private = args.operator_state / ("claude-parallel-" + uuid.uuid4().hex)
    private.mkdir(mode=0o700)
    bridge = args.package_dir / "node_modules/@chio/bridge/dist"
    config = private / "gateway.json"
    save(private / "prepare.json", {"endpoint": f"http://127.0.0.1:{operator['port']}", "bearerToken": operator["agentToken"], "adminToken": operator["adminToken"],
        "credentialTtlSeconds": 900, "trustedSigners": [(args.operator_state / "sessions.sqlite.admission.kernel.pub").read_text().strip()],
        "serverId": "fs", "sessionId": str(uuid.uuid4()), "journalDir": str(private / "journal"), "allowedTools": ["read_text_file", "write_file", "edit_file", "list_directory"]})
    prepared = subprocess.run(["node", str(bridge / "prepare-gateway.js"), str(private / "prepare.json"), str(config)], capture_output=True, text=True, timeout=40)
    require(prepared.returncode == 0, "Private session preparation failed: " + prepared.stderr)
    config_hash = digest(config)
    calls = [{"type": "tool_use", "id": "toolu_parallel_" + letter, "name": "mcp__chio__write_file", "input": {"path": "/workspace/claude-parallel-" + uuid.uuid4().hex + ".txt", "content": "parallel native fixture " + letter}} for letter in ["a", "b"]]
    requests = []

    def observe():
        code = "const f=require('fs'),c=require('crypto');const files={};for(const n of f.readdirSync('/observe'))if(f.lstatSync('/observe/'+n).isFile())files[n]=c.createHash('sha256').update(f.readFileSync('/observe/'+n)).digest('hex');const p='/audit/dispatch.jsonl';console.log(JSON.stringify({files,dispatch:f.existsSync(p)?f.readFileSync(p,'utf8').split('\\n').filter(Boolean).map(JSON.parse):[]}));"
        return json.loads(subprocess.check_output(["docker", "run", "--rm", "--network", "none", "--read-only", "--mount", f"type=volume,src={operator['volume']},dst=/observe,readonly", "--mount", f"type=volume,src={operator['auditVolume']},dst=/audit,readonly", "--entrypoint", "node", operator["image"], "-e", code], text=True, timeout=30))

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            blocks = [block for message in body.get("messages", []) if isinstance(message.get("content"), list) for block in message["content"] if block.get("type") == "tool_result"]
            requests.append({"path": self.path, "tools": [tool["name"] for tool in body.get("tools", [])], "toolResults": blocks})
            save(args.output / "fixture-requests.json", requests)
            content = calls if len(requests) == 1 else [{"type": "text", "text": "Local parallel fixture finished. Inspect the actual recorded outcomes."}]
            stop = "tool_use" if len(requests) == 1 else "end_turn"
            message = {"id": "msg_parallel_" + str(len(requests)), "type": "message", "role": "assistant", "model": body["model"], "content": content, "stop_reason": stop, "stop_sequence": None, "usage": {"input_tokens": 1, "output_tokens": 1}}
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream" if body.get("stream") else "application/json")
            self.end_headers()
            if not body.get("stream"):
                self.wfile.write(json.dumps(message).encode())
                return
            frames = [("message_start", {"message": dict(message, content=[], stop_reason=None)})]
            for index, block in enumerate(content):
                initial = dict(block, **({"input": {}} if block["type"] == "tool_use" else {"text": ""}))
                delta = {"type": "input_json_delta", "partial_json": json.dumps(block["input"])} if block["type"] == "tool_use" else {"type": "text_delta", "text": block["text"]}
                frames += [("content_block_start", {"index": index, "content_block": initial}), ("content_block_delta", {"index": index, "delta": delta}), ("content_block_stop", {"index": index})]
            frames += [("message_delta", {"delta": {"stop_reason": stop, "stop_sequence": None}, "usage": {"output_tokens": 1}}), ("message_stop", {})]
            self.wfile.write("".join(f"event: {kind}\ndata: {json.dumps(dict(type=kind, **value))}\n\n" for kind, value in frames).encode())

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    runtime = Path("/tmp") / ("chio-claude-parallel-runtime-" + uuid.uuid4().hex)
    runtime.mkdir(mode=0o700)
    (runtime / "workspace").mkdir(mode=0o700)
    injector = args.output / "observe-kernel.mjs"
    injector.write_text("""// Read-only request ordering observer, loaded only in trusted parent.
import {appendFileSync} from 'node:fs';
const original=globalThis.fetch;
const record=value=>appendFileSync(process.env.CHIO_PARALLEL_LOG,JSON.stringify({...value,time:process.hrtime.bigint().toString()})+'\\n',{mode:0o600});
globalThis.fetch=async function(input,init){
 let call;try{const body=JSON.parse(init?.body);if(String(input)===process.env.CHIO_PARALLEL_ENDPOINT&&body.method==='tools/call')call={rpcId:body.id,path:body.params.arguments.path};}catch{}
 if(call)record({phase:'start',...call});
 const response=await original.call(this,input,init);
 if(call)record({phase:'response',...call,status:response.status});
 return response;
};
""")
    env = os.environ.copy()
    for key in ["ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "NODE_OPTIONS"]:
        env.pop(key, None)
    env.update(ANTHROPIC_API_KEY="LOCAL_PARALLEL_FIXTURE_NOT_A_CREDENTIAL", ANTHROPIC_BASE_URL=f"http://127.0.0.1:{server.server_port}", NODE_OPTIONS="--import=" + str(injector.resolve()), CHIO_PARALLEL_LOG=str((args.output / "kernel-order.jsonl").resolve()), CHIO_PARALLEL_ENDPOINT=f"http://127.0.0.1:{operator['port']}/mcp")
    gateway = args.package_dir / "dist/gateway-http.js"
    command = ["node", str(args.package_dir / "scripts/restricted.mjs"), "--host", str(args.host), "--host-sha256", digest(args.host), "--profile", str(runtime / "profile"), "--workspace", str(runtime / "workspace"), "--gateway-config", str(config), "--gateway-sha256", digest(gateway), "--model", "claude-sonnet-5", "--model-auth", "api-key"]
    save(args.output / "identity.json", {"claim": "supplemental local model fixture with actual native Claude, real kernel, and independent effects; not provider inference acceptance", "archiveSha256": digest(args.archive), "hostSha256": digest(args.host), "gatewaySha256": digest(gateway), "launcherSha256": digest(args.package_dir / "scripts/restricted.mjs"), "kernelSha256": operator["kernelSha256"], "image": operator["image"], "volume": operator["volume"], "auditVolume": operator["auditVolume"], "harnessSha256": digest(Path(__file__)), "privateState": str(private), "calls": calls, "operatorIntervention": "Two declared tool calls in one fixed model response; kernel transport bytes unchanged"})
    before = observe()
    save(args.output / "before.json", before)
    try:
        run = subprocess.run(command, input="Execute the designated parallel fixture batch and report the actual returned outcomes. Never retry an unsuccessful or uncertain effect.", text=True, capture_output=True, timeout=90, env=env)
        (args.output / "host.stdout.jsonl").write_text(run.stdout)
        (args.output / "host.stderr.txt").write_text(run.stderr)
        after = observe()
        save(args.output / "after.json", after)
        for name in ["launch.json", "exit.json"]:
            shutil.copy2(runtime / "profile" / name, args.output / name)
        terminal = json.loads((args.output / "exit.json").read_text())
        events = [json.loads(line) for line in run.stdout.splitlines() if line.startswith("{")]
        native_calls, returned = [], {}
        for event in events:
            blocks = event.get("message", {}).get("content", [])
            for block in blocks if isinstance(blocks, list) else []:
                if block.get("type") == "tool_use":
                    native_calls.append(block)
                if block.get("type") == "tool_result":
                    returned[block["tool_use_id"]] = outcome(block["content"])
        rows = after["dispatch"][len(before["dispatch"]):]
        states = [returned.get(call["id"], {}).get("state") for call in calls]
        ordering = [json.loads(line) for line in (args.output / "kernel-order.jsonl").read_text().splitlines()]
        second_start = next((int(item["time"]) for item in ordering if item["phase"] == "start" and item["path"] == calls[1]["input"]["path"]), None)
        first_response = next((int(item["time"]) for item in ordering if item["phase"] == "response" and item["path"] == calls[0]["input"]["path"]), None)
        serialized = second_start is not None and first_response is not None and second_start > first_response
        rejected = states == ["completed", "not_dispatched"]
        completed = states == ["completed", "completed"]
        effects_match = True
        for call, state in zip(calls, states):
            actual = after["files"].get(call["input"]["path"].rsplit("/", 1)[1])
            expected = hashlib.sha256(call["input"]["content"].encode()).hexdigest() if state == "completed" else None
            effects_match &= actual == expected and sum(row["path"] == call["input"]["path"] for row in rows) == int(state == "completed")
            if state == "completed":
                effects_match &= returned[call["id"]].get("evidence") == "verified"
        passed = native_calls == calls and len(returned) == 2 and effects_match and len(rows) == states.count("completed") and terminal.get("hostDelivery", {}).get("confirmed") == states.count("completed") and digest(config) == config_hash
        passed &= rejected and run.returncode == 3 or completed and serialized and run.returncode == 0
        summary = {"passed": bool(passed), "supplementalOnly": True, "exitCode": run.returncode, "states": states, "kernelSerialized": serialized, "secondBlocked": rejected, "newDispatchRows": len(rows), "effectsMatch": effects_match, "terminal": terminal, "nativeCalls": native_calls, "outcomes": returned}
        save(args.output / "summary.json", summary)
        print(json.dumps({key: summary[key] for key in ["passed", "supplementalOnly", "exitCode", "states", "kernelSerialized", "secondBlocked", "newDispatchRows", "effectsMatch", "terminal"]}), flush=True)
        require(passed, "Parallel native batch outcome was not truthful or fenced")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
