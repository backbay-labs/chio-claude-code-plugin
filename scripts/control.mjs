#!/usr/bin/env node
// Trusted operator entrypoint. Never run this with credentials inside Claude.
import { readFileSync, writeFileSync, unlinkSync, realpathSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readGatewayConfig, privatePath } from "../dist/gateway.js";
import { confirmControlIntent, controlStatus, startControlServer } from "../dist/control/service.js";
import { requireSessionCredential } from "./sandbox.mjs";

export async function main(args = process.argv.slice(2)) {
  const [action, ...rest] = args;
  const options = {};
  const allowed = new Set(["--gateway-config", "--credential-output", "--operator-file", "--intent"]);
  for (let i = 0; i < rest.length; i += 2) {
    if (!allowed.has(rest[i]) || !rest[i + 1] || Object.hasOwn(options, rest[i])) throw new Error("expected unique named control options");
    options[rest[i]] = rest[i + 1];
  }
  if (!options["--gateway-config"]) throw new Error("--gateway-config is required");
  const configPath = resolve(options["--gateway-config"]);
  const config = readGatewayConfig(configPath);
  if (action === "confirm") {
    if (!options["--intent"] || !options["--operator-file"] || options["--credential-output"]) throw new Error("confirm requires --intent and --operator-file");
    const path = resolve(options["--operator-file"]); privatePath(path, false);
    if (lstatSync(path).size > 1024 * 1024) throw new Error("operator credential file exceeds its bound");
    const operator = JSON.parse(readFileSync(path, "utf8"));
    process.stdout.write(JSON.stringify({ intent: await confirmControlIntent(config, operator, options["--intent"]), dispatchPerformed: false }) + "\n");
    return;
  }
  if (!["serve", "status", "inbox"].includes(action) || options["--operator-file"] || options["--intent"]) throw new Error("usage: control.mjs serve|status --gateway-config CONFIG [--credential-output NEW_FILE]; confirm --gateway-config CONFIG --intent ID --operator-file PRIVATE_FILE");
  const prepared = requireSessionCredential(JSON.parse(readFileSync(configPath, "utf8")));
  const authorityExpiresAt = prepared.sessionCredential.expiresAt;
  if (action === "inbox") {
    const status = await controlStatus({ config, authorityExpiresAt, workflow: prepared.workflow });
    console.log(JSON.stringify({ sessionId: status.sessionId, authority: status.authority, intents: status.intents.filter(i => i.state === "requested" || i.state === "submitted" || i.state === "unknown"),
      taskRequests: status.workflow?.requests ?? [], exactActions: status.operations.filter(o => o.review), dispatchPerformed: false, next: "Inspect the exact action; confirm a requested intent using a distinct trusted operator credential outside Claude." })); return;
  }
  if (action === "status") { process.stdout.write(JSON.stringify(await controlStatus({ config, authorityExpiresAt, workflow: prepared.workflow })) + "\n"); return; }
  if (!options["--credential-output"]) throw new Error("serve requires a new private --credential-output file");
  const path = resolve(options["--credential-output"]);
  const server = await startControlServer({ config, authorityExpiresAt, workflow: prepared.workflow });
  let created = false;
  try {
    writeFileSync(path, JSON.stringify({ schema: "chio.control.credential.v1", sessionId: config.sessionId, url: server.url, token: server.token, expiresAt: authorityExpiresAt }), { mode: 0o600, flag: "wx" });
    created = true;
    process.stdout.write(JSON.stringify({ status: "listening", sessionId: config.sessionId, url: server.url, credentialPath: path }) + "\n");
    await new Promise(resolveStop => { process.once("SIGINT", resolveStop); process.once("SIGTERM", resolveStop); });
  } finally { await server.close(); if (created) unlinkSync(path); }
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().catch(error => { console.error(`[chio control] ${error.message}`); process.exitCode = 1; });
