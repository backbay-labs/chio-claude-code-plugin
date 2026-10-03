#!/usr/bin/env node
// Tag publication must not promote fixture evidence to native resource acceptance.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function verifyNativeQualification(root) {
  const record = JSON.parse(readFileSync(join(root, "acceptance/2026-10-03/native-mods/ACCEPTANCE.json"), "utf8"));
  if (record.schema !== "chio.claude.native-acceptance.v1" || record.productionQualified !== true) throw new Error("Native mod candidate lacks live production qualification; fixture checks cannot authorize publication");
  for (const name of ["hostContract", "sessionLifecycle", "kernelDecisions", "interactiveProtection", "nativeRecovery", "coldInstall"]) {
    if (record.gates?.[name]?.qualified !== true || record.gates[name].evidenceClass !== "live") throw new Error(`Native publication gate remains unqualified: ${name}`);
  }
  const pin = JSON.parse(readFileSync(join(root, "docs/host-contract.json"), "utf8"));
  if (record.hostVersion !== pin.version) throw new Error("Native host qualification changed");
  for (const path of ["hooks/native/register.ts", "hooks/native/projection.ts", "dist/control/service.js", "dist/gateway-http.js", "scripts/restricted.mjs", "scripts/model-relay.mjs", "scripts/sandbox.mjs"]) {
    const hash = createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
    if (record.artifacts?.[path] !== hash) throw new Error(`Native qualification artifact changed: ${path}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifyNativeQualification(resolve(dirname(fileURLToPath(import.meta.url)), "..")); }
  catch (error) { console.error(`[chio release] ${error.message}`); process.exitCode = 1; }
}
