#!/usr/bin/env node
// Writes the fixture-level native acceptance record for the current checkout.
// Usage: record-native-acceptance.mjs <checks.json> [output ACCEPTANCE.json]
// checks.json holds the check results and gate evidence gathered by the operator.
// The record never sets productionQualified; live gates stay qualified only by live runs.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeModIdentity, NATIVE_MOD_VERSION } from "../mod-profile.mjs";
import { qualificationArtifacts } from "../verify-native-qualification.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const json = path => JSON.parse(readFileSync(path, "utf8"));

const checksPath = process.argv[2];
if (!checksPath) throw new Error("usage: record-native-acceptance.mjs <checks.json> [output]");
const input = json(resolve(checksPath));
const output = resolve(process.argv[3] ?? join(root, "acceptance/2026-10-05/rc5/ACCEPTANCE.json"));

const pkg = json(join(root, "package.json"));
if (pkg.version !== NATIVE_MOD_VERSION) throw new Error("package and native mod versions differ");
const contract = json(join(root, "docs/host-contract.json"));
const platform = contract.platforms?.["darwin-arm64"];
if (!platform?.checksum) throw new Error("host contract lacks a darwin-arm64 checksum");
const python = run("python3", ["--version"]).replace(/^Python /, "");
const pyLibs = process.env.PYTHONPATH ? { PYTHONPATH: process.env.PYTHONPATH } : {};
const pyVersion = name => run("python3", ["-c", `import importlib.metadata as m;print(m.version(${JSON.stringify(name)}))`], { env: { ...process.env, ...pyLibs } });
const status = run("git", ["status", "--short"], { cwd: root });
if (status && !input.allowDirty) throw new Error("working tree must be clean so sourceBaseline describes the files");

const record = {
  schema: "chio.claude.native-acceptance.v1",
  recordedAt: new Date().toISOString(),
  version: NATIVE_MOD_VERSION,
  productionQualified: false,
  sourceBaseline: run("git", ["rev-parse", "HEAD"], { cwd: root }),
  hostVersion: contract.version,
  hostSha256: platform.checksum,
  nativeModSha256: nativeModIdentity(root),
  gatewaySha256: sha256(join(root, "dist/gateway-http.js")),
  artifacts: qualificationArtifacts(root),
  localToolchain: {
    node: process.version,
    npm: run("npm", ["--version"]),
    python,
    platform: "darwin-arm64",
    terminalEmulator: { pyte: pyVersion("pyte"), wcwidth: pyVersion("wcwidth") },
  },
  checks: input.checks,
  gates: input.gates,
  qualificationBlockers: input.qualificationBlockers,
  featureBoundaries: input.featureBoundaries,
  review: input.review,
};
for (const key of ["checks", "gates", "qualificationBlockers", "featureBoundaries", "review"]) {
  if (record[key] === undefined) throw new Error(`checks file lacks ${key}`);
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(record, null, 2) + "\n");
console.log(`wrote ${output}`);
