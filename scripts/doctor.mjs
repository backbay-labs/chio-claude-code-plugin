#!/usr/bin/env node
// Trusted operator diagnostics. This program performs no protected dispatch or repair.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i], value = args[i + 1];
    if (!["--profile", "--docker-context", "--image"].includes(name) || !value || Object.hasOwn(options, name)) throw new Error("expected unique --profile, --docker-context and --image options");
    options[name] = value;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(options["--profile"] ?? "") || !/^sha256:[0-9a-f]{64}$/.test(options["--image"] ?? "")) throw new Error("select a Colima profile and immutable resource image ID");
  const context = options["--profile"] === "default" ? "colima" : "colima-" + options["--profile"];
  if (options["--docker-context"] !== context) throw new Error("Docker context must correspond to the selected Colima profile");
  return options;
}
function storage(text) {
  const rows = text.trim().split("\n").slice(1).map(line => line.trim().split(/\s+/));
  if (rows.length !== 2 || rows.some(fields => fields.length < 6 || fields.slice(1, 4).some(v => !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))))) throw new Error("unrecognized guest storage response");
  return { available: Math.min(...rows.map(fields => Number(fields[3]))), utilization: rows.map(fields => fields[4]) };
}
export function diagnose(options, execute = spawnSync) {
  const checks = [];
  function check(name, command, args, project) {
    const result = execute(command, args, { encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024, env: process.env });
    if (result.error || result.status !== 0) { checks.push({ name, state: "unavailable", reason: result.error?.code === "ETIMEDOUT" ? "bounded probe timed out" : "probe failed; inspect the trusted environment", exitCode: result.status }); return null; }
    try { const detail = project(result.stdout); checks.push({ name, state: "passed", ...detail }); return detail; }
    catch { checks.push({ name, state: "unavailable", reason: "probe returned invalid or insufficient evidence" }); return null; }
  }
  const context = options["--docker-context"], profile = options["--profile"], image = options["--image"];
  const docker = ["--context", context];
  check("docker-endpoint", "docker", [...docker, "context", "inspect", context, "--format", "{{json .Endpoints.docker}}"], text => {
    const e = JSON.parse(text); if (typeof e.Host !== "string" || !e.Host) throw new Error();
    const endpoint = new URL(e.Host); if (endpoint.username || endpoint.password) throw new Error();
    return { endpoint: e.Host, skipTlsVerify: e.SkipTLSVerify === true };
  });
  check("docker-daemon", "docker", [...docker, "info", "--format", "{{json .}}"], text => {
    const d = JSON.parse(text); if (!d.ID || d.OSType !== "linux") throw new Error();
    return { daemonId: d.ID, architecture: d.Architecture, kernel: d.KernelVersion };
  });
  check("guest-execution", "colima", ["--profile", profile, "ssh", "--", "/bin/sh", "-c", "true"], () => ({}));
  check("guest-storage", "colima", ["--profile", profile, "ssh", "--", "df", "-Pk", "/", "/var/lib/docker"], text => {
    const s = storage(text); if (s.available < 128 * 1024) throw new Error();
    return { rootAndDockerReported: true, availableKiB: s.available, utilization: s.utilization };
  });
  check("guest-inodes", "colima", ["--profile", profile, "ssh", "--", "df", "-Pi", "/", "/var/lib/docker"], text => {
    const s = storage(text); if (s.available < 1024) throw new Error();
    return { availableInodes: s.available, utilization: s.utilization };
  });
  check("guest-storage-errors", "colima", ["--profile", profile, "ssh", "--", "sudo", "dmesg", "--level=err,warn"], text => {
    const warnings = text.split("\n").filter(line => /I\/O error|IO failure|filesystem check|mounting fs with errors|e2fsck is recommended|Some data may be corrupt/i.test(line)).length;
    return { ...(warnings ? { state: "attention" } : {}), retainedStorageWarnings: warnings,
      filesystemIntegrity: warnings ? "offline_check_recommended" : "unchecked" };
  });
  check("resource-image-read", "docker", [...docker, "image", "inspect", image, "--format", "{{json .}}"], text => {
    const d = JSON.parse(text); if (d.Id !== image || d.Os !== "linux") throw new Error();
    return { imageId: d.Id, architecture: d.Architecture };
  });
  return { schema: "chio.infrastructure.diagnosis.v1", checkedAt: new Date().toISOString(), profile, dockerContext: context,
    state: checks.some(c => c.state === "unavailable") ? "unavailable" : checks.some(c => c.state === "attention") ? "degraded" : "available", checks,
    protectedDispatchPerformed: false, repairPerformed: false, filesystemIntegrity: checks.find(c => c.name === "guest-storage-errors")?.filesystemIntegrity ?? "unchecked",
    qualification: "unchecked", next: "Use /chio-doctor in the exact host session for authority and original-outcome diagnosis. Infrastructure availability does not establish filesystem integrity or protected-workflow qualification." };
}
export function main(args = process.argv.slice(2)) {
  const result = diagnose(parseOptions(args));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.state !== "available") process.exitCode = 1;
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { main(); } catch (error) { console.error("[chio doctor] " + error.message); process.exitCode = 1; }
}
