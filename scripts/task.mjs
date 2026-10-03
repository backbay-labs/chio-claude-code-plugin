#!/usr/bin/env node
// Operator workflow entrypoint. Its collectors and provisioning never run inside Claude.
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, realpathSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readGatewayConfig, gatewayBinding } from "../dist/gateway.js";
import { digest, mutate, privateRead, privateSave } from "../dist/workflow/store.js";
import { readCatalog, readTask, templateView, projectTask, createTask, collectRequirement, artifactValid } from "../dist/workflow/tasks.js";

import { createHandoff, verifyHandoff } from "../dist/workflow/handoff.js";
import { controlStatus } from "../dist/control/service.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function main(args = process.argv.slice(2)) {
  const [action, ...rest] = args;
  const allowed = new Set(["--catalog", "--template", "--directory", "--operator-file", "--goal", "--artifact-kind", "--artifact-digest", "--artifact-label", "--checkout", "--task", "--requirement", "--gateway-config", "--output", "--signer-file", "--capsule", "--trusted-signer"]);
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!allowed.has(rest[i]) || !rest[i + 1] || Object.hasOwn(options, rest[i])) throw new Error("expected unique named task options");
    options[rest[i]] = rest[i + 1];
  }
  function exact(keys) {
    if (Object.keys(options).some(k => !keys.includes(k))) throw new Error("option does not apply to this task command");
  }
  if (action === "verify-handoff") {
    exact(["--capsule", "--trusted-signer"]);
    if (!options["--capsule"] || !options["--trusted-signer"]) throw new Error("capsule and independently pinned signer required");
    console.log(JSON.stringify(verifyHandoff(privateRead(resolve(options["--capsule"])), options["--trusted-signer"]))); return;
  }
  if (action === "handoff") {
    exact(["--gateway-config", "--output", "--signer-file"]);
    for (const key of ["--gateway-config", "--output", "--signer-file"]) if (!options[key]) throw new Error(key + " required");
    const configPath = resolve(options["--gateway-config"]), prepared = privateRead(configPath), config = readGatewayConfig(configPath);
    if (!prepared.workflow?.taskPath || !prepared.sessionCredential?.expiresAt) throw new Error("prepared task contract required");
    const status = await controlStatus({ config, authorityExpiresAt: prepared.sessionCredential.expiresAt, workflow: prepared.workflow });
    const seed = privateRead(resolve(options["--signer-file"])).seed;
    const capsule = createHandoff(status.workflow.task, status, seed);
    const output = resolve(options["--output"]); privateSave(output, capsule, true);
    console.log(JSON.stringify({ output, signer: capsule.signer, authorityTransferred: false, dispatchPerformed: false })); return;
  }
  if (action === "list") {
    exact(["--catalog"]); if (!options["--catalog"]) throw new Error("--catalog required");
    console.log(JSON.stringify({ templates: readCatalog(resolve(options["--catalog"])).map(t => ({ ...templateView(t), scope: t.scope })) })); return;
  }
  if (["status", "collect", "artifact"].includes(action)) {
    exact(action === "status" ? ["--task"] : action === "collect" ? ["--task", "--requirement"] : ["--task", "--artifact-kind", "--artifact-digest", "--artifact-label"]);
    if (!options["--task"]) throw new Error("--task required");
    const path = resolve(options["--task"]);
    if (action === "collect") {
      if (!options["--requirement"]) throw new Error("--requirement required");
      console.log(JSON.stringify(await collectRequirement(path, options["--requirement"]))); return;
    }
    if (action === "artifact") {
      const artifact = { kind: options["--artifact-kind"], digest: options["--artifact-digest"], label: options["--artifact-label"] };
      if (!artifactValid(artifact)) throw new Error("exact artifact required");
      mutate(path, current => ({ ...current, artifact }));
    }
    console.log(JSON.stringify(await projectTask(readTask(path)))); return;
  }
  if (action !== "prepare") throw new Error("usage: task.mjs list|prepare|status|collect|artifact with named options; see docs/CONTROLLED-TASKS.md");
  exact(["--catalog", "--template", "--directory", "--operator-file", "--goal", "--artifact-kind", "--artifact-digest", "--artifact-label", "--checkout"]);
  for (const key of ["--catalog", "--template", "--directory", "--operator-file", "--goal"]) if (!options[key]) throw new Error(key + " required");
  const artifact = { kind: options["--artifact-kind"], digest: options["--artifact-digest"], label: options["--artifact-label"] };
  if (!artifactValid(artifact) || options["--goal"].length > 4096) throw new Error("bounded goal and exact artifact required");
  const templates = readCatalog(resolve(options["--catalog"])); const template = templates.find(t => t.id === options["--template"]);
  if (!template) throw new Error("template is not in the operator catalog");
  const operator = privateRead(resolve(options["--operator-file"]));
  if (typeof operator.endpoint !== "string" || typeof operator.bearerToken !== "string" || typeof operator.adminToken !== "string"
    || operator.adminToken === operator.bearerToken || !Array.isArray(operator.trustedSigners)) throw new Error("operator preparation credentials required");
  const directory = resolve(options["--directory"]); mkdirSync(directory, { mode: 0o700 });
  const journalDir = join(directory, "journal");
  const sessionId = randomUUID(); const requestPath = join(directory, "prepare-request.json"); const configPath = join(directory, "gateway.json");
  privateSave(requestPath, { endpoint: operator.endpoint, bearerToken: operator.bearerToken, adminToken: operator.adminToken,
    trustedSigners: operator.trustedSigners, serverId: template.serverId, allowedTools: template.allowedTools, credentialTtlSeconds: template.ttlSeconds, sessionId, journalDir }, true);
  try {
    const result = spawnSync(process.execPath, [join(root, "dist/workflow/prepare.js"), requestPath, configPath], { encoding: "utf8", timeout: 65_000, maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw new Error("kernel preparation failed; preserve this directory for operator inspection");
  } finally { unlinkSync(requestPath); }
  const prepared = privateRead(configPath);
  if (prepared.execution.capabilityId !== template.expectedCapabilityId || prepared.execution.serverId !== template.serverId) throw new Error("prepared capability differs from template; retained session requires operator inspection");
  prepared.approval = template.approval;
  const state = join(journalDir, "workflow"); mkdirSync(state, { recursive: true, mode: 0o700 });
  const taskPath = join(state, "task.json"), catalogPath = join(state, "catalog.json");
  privateSave(catalogPath, { schema: "chio.task.catalog.v1", templates }, true);
  const config = readGatewayConfig(configPath); config.approval = template.approval;
  const task = createTask(taskPath, { sessionId, binding: digest(gatewayBinding(config)), title: template.title, goal: options["--goal"], artifact, template,
    ...(options["--checkout"] ? { checkout: realpathSync(options["--checkout"]) } : {}) });
  prepared.workflow = { taskPath, catalogPath }; privateSave(configPath, prepared);
  console.log(JSON.stringify({ status: "prepared", authority: "kernel_delegated_session", sessionId, gatewayConfig: configPath, taskPath,
    task: await projectTask(task), dispatchPerformed: false, next: "Launch the pinned restricted host with this exact gateway configuration." }));
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().catch(error => { console.error("[chio task] " + error.message); process.exitCode = 1; });
