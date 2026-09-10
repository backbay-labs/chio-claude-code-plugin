#!/usr/bin/env python3
"""Run remaining Claude cases with explicit final artifacts and fresh owners.

Each group owns different Docker volumes. Within a resource-counting group,
commands are sequential. Unknown outcomes and failed observations stay retained;
this coordinator never declares complete I01-I08 acceptance.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import subprocess
import tarfile
import time
import uuid


NATIVE_CASES = [
    "sanitized-path", "completed-tool-error", "journal-before-dispatch",
    "cancel-before-dispatch", "kernel-network-refused", "journal-after-effect",
    "result-substitution", "host-response-loss", "gateway-crash", "sigterm-recovery",
    "plugin-omitted", "gateway-missing", "host-missing", "mcp-silent-omission",
    "init-malformed", "init-timeout", "init-crash", "upgrade-removal",
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")
    path.chmod(0o600)


def verify_install(archive, package):
    result = []
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            if not member.name.startswith("package/"):
                raise ValueError("unexpected archive root")
            relative = Path(member.name.removeprefix("package/"))
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError("archive path escapes package")
            path = (package / relative).resolve(strict=True)
            if not path.is_relative_to(package):
                raise ValueError("installed path escapes package")
            expected = hashlib.sha256(tar.extractfile(member).read()).hexdigest()
            if digest(path) != expected:
                raise ValueError("installed archive mismatch: " + str(relative))
            result.append({"path": str(relative), "sha256": expected})
    if not result:
        raise ValueError("empty archive")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["kernel", "archive", "package-dir", "upgrade-from", "kernel-repo",
                 "startup-fault", "owner-root", "output"]:
        parser.add_argument("--" + name, type=Path, required=True)
    for name in ["kernel-sha256", "kernel-source", "artifact-sha256", "image"]:
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--base-port", type=int, default=59221)
    parser.add_argument("--volume-prefix", default="chio-required-final-claude-20260910")
    parser.add_argument("--storage-name-prefix", default="final-claude-20260910")
    parser.add_argument("--groups", nargs="+", choices=["native", "budget", "expiry", "storage", "parallel"],
                        default=["native", "budget", "expiry", "storage", "parallel"])
    args = parser.parse_args()
    for expected in [args.kernel_sha256, args.artifact_sha256]:
        if re.fullmatch(r"[a-f0-9]{64}", expected) is None:
            raise ValueError("explicit lowercase SHA-256 required")
    if digest(args.kernel) != args.kernel_sha256 or digest(args.archive) != args.artifact_sha256:
        raise ValueError("selected artifact identity differs")
    if re.fullmatch(r"sha256:[a-f0-9]{64}", args.image) is None:
        raise ValueError("immutable resource image required")
    if not re.fullmatch(r"chio-required-[a-z0-9-]+", args.volume_prefix):
        raise ValueError("isolated volume prefix required")
    if not re.fullmatch(r"[a-z0-9-]{1,35}", args.storage_name_prefix):
        raise ValueError("short globally unique storage name prefix required")
    if not 1024 <= args.base_port <= 65525 or len(args.groups) != len(set(args.groups)):
        raise ValueError("invalid ports or repeated group")
    args.package_dir = args.package_dir.resolve(strict=True)
    args.kernel_repo = args.kernel_repo.resolve(strict=True)
    installed = verify_install(args.archive, args.package_dir)
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    args.owner_root.mkdir(mode=0o700, parents=True, exist_ok=False)
    (args.output / "driver-source.py").write_bytes(Path(__file__).read_bytes())
    save(args.output / "installed-archive-files.json", installed)
    offsets = {"native": [0], "budget": [1], "expiry": [2], "storage": [3, 4, 5], "parallel": [6]}
    for offset in sorted({offset for group in args.groups for offset in offsets[group]}):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", args.base_port + offset))
    root = Path(__file__).resolve().parent
    owner_launcher = args.kernel_repo / "integrations/required-agents/serve-filesystem.py"
    storage_helper = args.kernel_repo / "integrations/required-agents/qualification/storage_fault.py"
    bridge = args.package_dir / "node_modules/@chio/bridge"
    base_policy = args.kernel_repo / "integrations/required-agents/filesystem-policy.yaml"
    if not base_policy.is_file():
        raise FileNotFoundError("explicit owner policy source is missing")
    policy = base_policy.read_text()
    if policy.count("max_invocations: 64") != 1:
        raise ValueError("unexpected policy invocation limit")
    (args.output / "policy.yaml").write_text(policy)
    (args.output / "budget-policy.yaml").write_text(policy.replace("max_invocations: 64", "max_invocations: 3"))
    if policy.count("max_capability_ttl: 3600") != 1 or policy.count("ttl: 3600") != 2:
        raise ValueError("unexpected default capability lifetime")
    expiry_policy = policy.replace("max_capability_ttl: 3600", "max_capability_ttl: 10").replace("        ttl: 3600", "        ttl: 10")
    (args.output / "expiry-policy.yaml").write_text(expiry_policy)
    sources = {}
    for label, path in {"ownerLauncher": owner_launcher, "storageHelper": storage_helper,
                        "startupFault": args.startup_fault, "nativeDriver": root / "native-subscription.py",
                        "storageDriver": root / "native-storage.py", "parallelDriver": root / "native-parallel.py"}.items():
        sources[label] = {"path": str(path), "sha256": digest(path)}
    save(args.output / "identity.json", {"accepted": False, "kernel": str(args.kernel),
         "kernelSha256": args.kernel_sha256, "kernelSource": args.kernel_source,
         "kernelVersion": subprocess.check_output([str(args.kernel), "--version"], text=True).strip(),
         "artifact": str(args.archive), "artifactSha256": args.artifact_sha256,
         "upgradeFrom": str(args.upgrade_from), "upgradeFromSha256": digest(args.upgrade_from),
         "packageDirectory": str(args.package_dir), "image": args.image, "basePort": args.base_port,
         "volumePrefix": args.volume_prefix, "storageVolumePrefix": "chio-required-kernel-store-" + args.storage_name_prefix,
         "sources": sources, "groups": args.groups, "mainCases": NATIVE_CASES,
         "claim": "remaining bounded Claude native cases; root-owned useful/shared matrix and public delivery are separate"})

    def group(name):
        folder = args.output / name
        folder.mkdir(mode=0o700)
        records = []

        def run(label, command, timeout=1800):
            start = time.monotonic()
            with (folder / (label + ".stdout")).open("w") as stdout, (folder / (label + ".stderr")).open("w") as stderr:
                completed = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=timeout)
            record = {"case": label, "command": command, "exitCode": completed.returncode,
                      "elapsedSeconds": time.monotonic() - start}
            records.append(record)
            save(folder / "runs.json", records)
            print(json.dumps({"group": name, "case": label, "exitCode": completed.returncode}), flush=True)
            return completed.returncode

        def start_owner(label, offset, selected_policy):
            owner = args.owner_root / label
            command = ["python3", str(owner_launcher), "start", "--state-dir", str(owner),
                "--kernel", str(args.kernel), "--kernel-sha256", args.kernel_sha256,
                "--image", args.image, "--volume", args.volume_prefix + "-" + label,
                "--port", str(args.base_port + offset), "--policy", str(selected_policy)]
            if run("start-" + label, command, 90):
                raise RuntimeError("fresh owner startup failed")
            deadline = time.monotonic() + 45
            while not (owner / "sessions.sqlite.admission.kernel.pub").exists():
                if time.monotonic() >= deadline:
                    raise TimeoutError("owner signer not ready")
                time.sleep(0.1)
            return owner

        def native(owner, output, cases, extras=()):
            return ["python3", str(root / "native-subscription.py"), "--operator-state", str(owner),
                "--package-dir", str(args.package_dir), "--output", str(output), "--cases", *cases,
                "--artifact-sha256", args.artifact_sha256, "--archive", str(args.archive), *extras]

        try:
            if name == "native":
                owner = start_owner(name, 0, args.output / "policy.yaml")
                run("sanitized-path", native(owner, folder / "sanitized-path", ["sanitized-path"]))
                launch = folder / "sanitized-path/sanitized-path/workflow/launch.json"
                if not launch.is_file():
                    raise RuntimeError("supplemental boundary lacks its actual native launch prerequisite")
                run("supplemental-boundary", native(owner, folder / "supplemental-boundary", ["native-boundary"],
                    ["--boundary-launch", str(launch)]))
                run("native-cases", native(owner, folder / "cases", NATIVE_CASES[1:],
                    ["--fault-directory", str(args.kernel_repo / "scripts/acceptance"),
                     "--startup-fault", str(args.startup_fault), "--upgrade-from", str(args.upgrade_from)]), timeout=14400)
            elif name == "budget":
                owner = start_owner(name, 1, args.output / "budget-policy.yaml")
                run("budget", native(owner, folder / "case", ["aggregate-budget"]))
            elif name == "expiry":
                owner = start_owner(name, 2, args.output / "expiry-policy.yaml")
                private = owner / "short-capability"
                private.mkdir(mode=0o700)
                operator = json.loads((owner / "operator.json").read_text())
                request = {"endpoint": f"http://127.0.0.1:{operator['port']}", "bearerToken": operator["agentToken"],
                    "adminToken": operator["adminToken"], "credentialTtlSeconds": 900,
                    "trustedSigners": [(owner / "sessions.sqlite.admission.kernel.pub").read_text().strip()],
                    "serverId": "fs", "sessionId": str(uuid.uuid4()), "journalDir": str(private / "journal"),
                    "allowedTools": ["read_text_file", "write_file", "edit_file", "list_directory"]}
                save(private / "prepare.json", request)
                config = private / "gateway.json"
                if run("prepare-expiry", ["node", str(bridge / "dist/prepare-gateway.js"), str(private / "prepare.json"), str(config)], 30):
                    raise RuntimeError("short capability preparation failed")
                prepared = time.time()
                conf = json.loads(config.read_text())
                with sqlite3.connect("file:" + str(owner / "sessions.sqlite") + "?mode=ro", uri=True) as db:
                    actual = json.loads(db.execute("SELECT record_json FROM remote_active_sessions WHERE session_id=?", (conf["execution"]["sessionId"],)).fetchone()[0])
                caps = actual["issued_capabilities"]
                if len(caps) != 1:
                    raise ValueError("expected one actual owner-issued capability")
                cap = caps[0]
                if cap["id"] != conf["execution"]["capabilityId"] or cap["subject"] != conf["execution"]["subjectKey"]:
                    raise ValueError("owner capability differs from prepared caller")
                if cap["expires_at"] - cap["issued_at"] != 10 or prepared >= cap["expires_at"] or conf["sessionCredential"]["expiresAt"] != cap["expires_at"]:
                    raise ValueError("short capability was not prepared live with clamped credential")
                binding = {"kernelSha256": args.kernel_sha256, "kernelSource": args.kernel_source,
                    "policySha256": operator["policySha256"], "capability": cap,
                    "gatewayConfig": str(config), "sessionCredential": conf["sessionCredential"],
                    "credentialRequestedTtlSeconds": 900, "preparedAtEpoch": prepared,
                    "capabilitySource": "independently read resource owner SQLite record"}
                save(folder / "binding.json", binding)
                run("expired-capability", ["python3", str(args.kernel_repo / "scripts/acceptance/host-approvals.py"),
                    "--host", "claude", "--suite", "expired-capability", "--operator-state", str(owner),
                    "--package-dir", str(args.package_dir), "--existing-config", str(config),
                    "--capability-expiry-binding", str(folder / "binding.json"), "--output", str(folder / "case")])
            elif name == "parallel":
                owner = start_owner(name, 6, args.output / "policy.yaml")
                run("supplemental-parallel", ["python3", str(root / "native-parallel.py"),
                    "--operator-state", str(owner), "--package-dir", str(args.package_dir),
                    "--archive", str(args.archive), "--output", str(folder / "case")])
            else:
                for index, cutpoint in enumerate(["before-admission", "after-admission", "after-receipt"]):
                    case_name = args.storage_name_prefix + "-" + cutpoint
                    helper_out = folder / "owners"
                    create = ["python3", str(storage_helper), "--owner-root", str(args.owner_root / "storage"),
                        "--output-root", str(helper_out), "create", "--name", case_name,
                        "--kernel", str(args.kernel), "--kernel-sha256", args.kernel_sha256,
                        "--policy", str(args.output / "policy.yaml"), "--owner-launcher", str(owner_launcher),
                        "--bridge", str(bridge), "--image", args.image, "--port", str(args.base_port + 3 + index)]
                    if run(cutpoint + "-create", create, 120):
                        continue
                    run(cutpoint, ["python3", str(root / "native-storage.py"),
                        "--manifest", str(helper_out / case_name / "manifest.json"), "--helper", str(storage_helper),
                        "--package-dir", str(args.package_dir), "--archive", str(args.archive),
                        "--artifact-sha256", args.artifact_sha256, "--cutpoint", cutpoint,
                        "--output", str(folder / cutpoint)], 1200)
            result = {"group": name, "passed": bool(records) and all(record["exitCode"] == 0 for record in records),
                      "commands": len(records), "skips": 0, "accepted": False}
        except Exception as error:
            result = {"group": name, "passed": False, "errorType": type(error).__name__,
                      "error": str(error), "commands": len(records), "accepted": False,
                      "originalStateRetained": True}
        save(folder / "summary.json", result)
        return result

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(group, args.groups))
    save(args.output / "results.json", results)
    raise SystemExit(0 if all(row["passed"] for row in results) else 1)


if __name__ == "__main__":
    main()
