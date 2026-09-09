#!/usr/bin/env node
// Candidate MCP-only launch mode. Resource isolation and I01-I08 acceptance
// remain mandatory at the kernel endpoint; this launcher cannot supply them.
import { readFileSync, writeFileSync, mkdirSync, realpathSync, rmSync, statSync, lstatSync, existsSync } from "node:fs";
import { resolve, join, relative, isAbsolute, dirname, basename, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function canonicalLocation(path) {
  let parent=resolve(path);
  const suffix=[];
  while (!existsSync(parent)) {
    suffix.unshift(basename(parent));
    const next=dirname(parent);
    if (next===parent) throw new Error("path has no existing filesystem ancestor");
    parent=next;
  }
  return join(realpathSync(parent),...suffix);
}
export function isWithin(workspace,path) {
  const rel=relative(workspace,canonicalLocation(path));
  return rel==="" || (!isAbsolute(rel) && rel!==".." && !rel.startsWith(`..${sep}`));
}

export function makeArguments({ settingsPath, mcpPath, model, sessionId }) {
  return ["--print", "--restricted", "--tools", "", "--strict-mcp-config", "--mcp-config", mcpPath,
    "--setting-sources", "", "--settings", settingsPath, "--disable-slash-commands", "--no-chrome",
    "--permission-mode", "dontAsk", "--allowedTools", "mcp__chio__*", "--output-format", "stream-json",
    "--verbose", "--no-session-persistence", "--session-id", sessionId, "--model", model];
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--host", "--host-sha256", "--profile", "--workspace", "--gateway-config", "--gateway-sha256", "--model"]);
  const opts = {};
  for (let i=0; i<args.length; i+=2) {
    if (!allowed.has(args[i]) || !args[i+1] || Object.hasOwn(opts,args[i])) throw new Error("expected unique --host, --host-sha256, --profile, --workspace, --gateway-config, --gateway-sha256 and --model options");
    opts[args[i]] = args[i+1];
  }
  for (const key of allowed) if (!opts[key]) throw new Error(`${key} is required`);
  if (!/^[0-9a-f]{64}$/.test(opts["--host-sha256"])) throw new Error("invalid host SHA-256");
  const host = realpathSync(opts["--host"]);
  if (createHash("sha256").update(readFileSync(host)).digest("hex") !== opts["--host-sha256"]) throw new Error("host artifact identity differs from the qualified pin");
  const gateway = realpathSync(join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "gateway.js"));
  const gatewaySha256 = createHash("sha256").update(readFileSync(gateway)).digest("hex");
  if (gatewaySha256 !== opts["--gateway-sha256"]) throw new Error("bundled gateway differs from the qualified pin");
  let configPath = resolve(opts["--gateway-config"]);
  const configStat = lstatSync(configPath);
  if (!configStat.isFile() || configStat.isSymbolicLink() || (configStat.mode & 0o077) !== 0 || configStat.size > 1024*1024) throw new Error("gateway configuration must be a private regular file");
  configPath=realpathSync(configPath);
  const config = JSON.parse(readFileSync(configPath,"utf8"));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.sessionId ?? "")) throw new Error("prepare the gateway with the exact UUID used for the host session");
  if (!config.execution?.sessionId || !config.journalDir || !Array.isArray(config.tools) || !config.tools.length) throw new Error("prepared gateway context, private journal and bounded tools are required");
  const workspace = realpathSync(opts["--workspace"]);
  if (!statSync(workspace).isDirectory()) throw new Error("workspace must be a directory");
  for (const privatePath of [configPath, resolve(config.journalDir), gateway]) {
    if (isWithin(workspace,privatePath)) throw new Error("gateway, config and journal must be outside the resource workspace");
  }
  const profile = canonicalLocation(opts["--profile"]);
  if (isWithin(workspace,profile)) throw new Error("profile must be outside the resource workspace");
  // Refuse existing profiles so user, project, plugin and resumed state cannot
  // be silently inherited. Supported restart/resume will need separate gates.
  mkdirSync(profile, { mode: 0o700 });
  const settingsPath = join(profile,"settings.json");
  const mcpPath = join(profile,"mcp-session.json");
  writeFileSync(settingsPath, JSON.stringify({ disableAllHooks:true, enabledPlugins:{}, permissions:{defaultMode:"dontAsk"} }),{mode:0o600,flag:"wx"});
  writeFileSync(mcpPath, JSON.stringify({mcpServers:{chio:{type:"stdio",command:process.execPath,args:[gateway,configPath]}}}),{mode:0o600,flag:"wx"});
  const sessionId = config.sessionId;
  writeFileSync(join(profile,"launch.json"),JSON.stringify({schema:"chio.claude.restricted-launch.v1",host,hostSha256:opts["--host-sha256"],gatewaySha256,workspace,sessionId,acceptance:"unverified"},null,2),{mode:0o600,flag:"wx"});
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("CHIO_") && !key.startsWith("CLAUDE_") && key!=="CLAUDECODE"));
  // Reuse only explicitly supplied host authentication. Never inspect or copy
  // credentials out of a normal profile or keychain.
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) env.CLAUDE_CODE_OAUTH_TOKEN=process.env.CLAUDE_CODE_OAUTH_TOKEN;
  Object.assign(env,{HOME:profile,CLAUDE_CONFIG_DIR:profile,XDG_CONFIG_HOME:profile,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:"1",DISABLE_AUTOUPDATER:"1"});
  const child=spawn(host,makeArguments({settingsPath,mcpPath,model:opts["--model"],sessionId}),{cwd:workspace,env,stdio:"inherit"});
  for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>child.kill(signal));
  child.on("error",error=>{rmSync(mcpPath,{force:true});console.error(error.message);process.exitCode=1;});
  child.on("exit",(code,signal)=>{
    rmSync(mcpPath,{force:true});
    writeFileSync(join(profile,"exit.json"),JSON.stringify({code,signal,executionOutcome:"not-verified-by-launcher",retry:"never-automatic"}),{mode:0o600});
    process.exitCode=code??1;
  });
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=>{console.error(`[chio restricted] ${error.message}`);process.exitCode=1;});
