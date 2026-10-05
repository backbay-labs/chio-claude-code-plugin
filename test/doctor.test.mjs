import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnose, parseOptions } from "../scripts/doctor.mjs";
const image = "sha256:" + "a".repeat(64);
const options = parseOptions(["--profile", "qualification", "--docker-context", "colima-qualification", "--image", image]);
function fixture(overrides = {}) {
  return (command, args, settings) => {
    assert.equal(settings.timeout, 15_000);
    assert.equal(settings.maxBuffer, 1024 * 1024);
    if (command === "docker") assert.deepEqual(args.slice(0, 2), ["--context", "colima-qualification"]);
    else assert.deepEqual(args.slice(0, 3), ["--profile", "qualification", "ssh"]);
    const key = args.includes("inspect") ? (args.includes("image") ? "image" : "endpoint") : args.includes("info") ? "info" : args.includes("df") ? args.includes("-Pi") ? "inodes" : "storage" : args.includes("dmesg") ? "warnings" : "execution";
    const defaults = { image: JSON.stringify({ Id: image, Os: "linux", Architecture: "amd64" }), endpoint: JSON.stringify({ Host: "unix:///selected.sock" }), info: JSON.stringify({ ID: "selected-daemon", Architecture: "x86_64", OSType: "linux", KernelVersion: "6.8" }),
      storage: "Filesystem 1024-blocks Used Available Capacity Mounted on\nroot 4000000 1000000 3000000 25% /\nroot 4000000 1000000 3000000 25% /\n",
      inodes: "Filesystem Inodes IUsed IFree IUse% Mounted on\nroot 100000 1000 99000 1% /\nroot 100000 1000 99000 1% /\n", warnings: "", execution: "" };
    return overrides[key] ?? { status: 0, stdout: defaults[key] };
  };
}
test("doctor selects every endpoint explicitly and establishes availability only", () => {
  const result = diagnose(options, fixture());
  assert.equal(result.state, "available"); assert.equal(result.checks.length, 7);
  assert.equal(result.filesystemIntegrity, "unchecked"); assert.equal(result.qualification, "unchecked");
  assert.equal(result.protectedDispatchPerformed, false); assert.equal(result.repairPerformed, false);
});
test("a healthy daemon cannot hide a failed guest executable or image read", () => {
  for (const key of ["execution", "image"]) {
    const result = diagnose(options, fixture({ [key]: { status: 1, stdout: "", stderr: "private server detail" } }));
    assert.equal(result.state, "unavailable"); assert.doesNotMatch(JSON.stringify(result), /private server detail/);
  }
});
test("diagnostics refuse credential-bearing endpoints without printing them", () => {
  const result = diagnose(options, fixture({ endpoint: { status: 0, stdout: JSON.stringify({ Host: "tcp://private-user:private-password@127.0.0.1:2376" }) } }));
  assert.equal(result.state, "unavailable"); assert.doesNotMatch(JSON.stringify(result), /private-user|private-password/);
});
test("root exhaustion fails even when the Docker filesystem has space", () => {
  const result = diagnose(options, fixture({ storage: { status: 0, stdout: "Filesystem 1024-blocks Used Available Capacity Mounted on\nroot 4000000 4000000 0 100% /\ndata 4000000 1000000 3000000 25% /var/lib/docker\n" } }));
  assert.equal(result.state, "unavailable");
});
test("retained filesystem warnings require attention without claiming corruption repaired", () => {
  const result = diagnose(options, fixture({ warnings: { status: 0, stdout: "EXT4-fs: warning: mounting fs with errors, running e2fsck is recommended\n" } }));
  assert.equal(result.state, "degraded"); assert.equal(result.filesystemIntegrity, "offline_check_recommended");
});
test("context mismatch, unpinned images and duplicate options are refused", () => {
  for (const args of [["--profile", "qualification", "--docker-context", "colima", "--image", image], ["--profile", "qualification", "--docker-context", "colima-qualification", "--image", "latest"], ["--profile", "qualification", "--profile", "default"]]) assert.throws(() => parseOptions(args));
});
