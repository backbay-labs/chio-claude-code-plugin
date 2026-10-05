#!/usr/bin/env node
// Tag publication must not promote fixture evidence to native resource acceptance.
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/** The current candidate's acceptance record: the publication gate and the CLI's default pins. */
export const CANDIDATE_RECORD = "acceptance/2026-10-05/rc5/ACCEPTANCE.json";
/** Inventory the delivered files, excluding evidence records and test drivers. */
export function qualificationArtifacts(root) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (!Array.isArray(pkg.files) || !pkg.files.length) throw new Error("explicit release file inventory required");
  const paths = new Set();
  function retain(path) {
    if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.split("/").some(p => !p || p === "." || p === "..") || /[*?\[\]{}]/.test(path)) throw new Error("unqualified release file selection");
    if (path === "acceptance" || path.startsWith("acceptance/") || path === "scripts/acceptance" || path.startsWith("scripts/acceptance/") || path === "scripts/test-mods.mjs") return;
    const stat = lstatSync(join(root, path));
    if (stat.isSymbolicLink()) throw new Error("qualification requires regular delivered paths");
    if (stat.isDirectory()) for (const name of readdirSync(join(root, path))) retain(path + "/" + name);
    else if (stat.isFile()) paths.add(path);
    else throw new Error("unqualified release file type");
  }
  for (const path of ["package.json", "README.md", "LICENSE", ...pkg.files]) retain(path);
  return Object.fromEntries([...paths].sort().map(path => [path, createHash("sha256").update(readFileSync(join(root, path))).digest("hex")]));
}
export function verifyNativeQualification(root) {
  const record = JSON.parse(readFileSync(join(root, CANDIDATE_RECORD), "utf8"));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (record.version !== pkg.version) throw new Error("Native qualification does not cover this package version");
  if (record.schema !== "chio.claude.native-acceptance.v1" || record.productionQualified !== true) throw new Error("Native mod candidate lacks live production qualification; fixture checks cannot authorize publication");
  for (const name of ["hostContract", "sessionLifecycle", "kernelDecisions", "interactiveProtection", "nativeRecovery", "coldInstall"]) {
    if (record.gates?.[name]?.qualified !== true || record.gates[name].evidenceClass !== "live") throw new Error(`Native publication gate remains unqualified: ${name}`);
  }
  const pin = JSON.parse(readFileSync(join(root, "docs/host-contract.json"), "utf8"));
  if (record.hostVersion !== pin.version || !Object.values(pin.platforms).some(platform => platform.checksum === record.hostSha256)) throw new Error("Native host qualification changed");
  const artifacts = qualificationArtifacts(root);
  if (JSON.stringify(Object.keys(record.artifacts ?? {}).sort()) !== JSON.stringify(Object.keys(artifacts))) throw new Error("Native qualification inventory changed or contains unrecorded delivered artifacts");
  for (const [path, hash] of Object.entries(artifacts)) {
    if (record.artifacts[path] !== hash) throw new Error(`Native qualification artifact changed: ${path}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifyNativeQualification(resolve(dirname(fileURLToPath(import.meta.url)), "..")); }
  catch (error) { console.error(`[chio release] ${error.message}`); process.exitCode = 1; }
}
