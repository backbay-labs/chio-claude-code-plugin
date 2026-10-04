import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { ArtifactRef, RequirementView, TaskView, TemplateView } from "../../types/workflow.js";
import { digest, mutate, privateRead, privateSave } from "./store.js";

interface CommandCollector { kind: "command"; cwd: string; argv: string[]; timeoutMs: number }
interface JsonCollector { kind: "json"; url: string; artifactPointer: string; statePointer: string; passedValue: string; failedValues: string[] }
export type Collector = CommandCollector | JsonCollector;
export interface Requirement { id: string; title: string; collector: Collector }
export interface Template {
  id: string; title: string; serverId: string; expectedCapabilityId: string;
  allowedTools: string[]; ttlSeconds: number;
  approval: { requiredTools: string[]; purpose: string; ttlSeconds: number };
  scope: TaskView["scope"];
  requirements: Requirement[];
}
export interface TaskRecord {
  schema: "chio.task.v1"; id: string; sessionId: string; binding: string;
  title: string; goal: string; artifact: ArtifactRef; template: Template;
  /** Optional operator-owned checkout. Its current commit is checked on every projection. */
  checkout?: string;
  observations: { requirementId: string; revision: string; artifact: ArtifactRef; state: RequirementView["state"]; observedAt: number; source: string }[];
}
const token = /^[a-zA-Z0-9_.-]{1,128}$/;
function identifier(value: unknown): value is string { return typeof value === "string" && token.test(value); }
export function artifactValid(value: ArtifactRef): boolean {
  return !!value && typeof value.label === "string" && value.label.length <= 256
    && (value.kind === "git_commit" ? /^[0-9a-f]{40}$/.test(value.digest) : value.kind === "sha256" && /^[0-9a-f]{64}$/.test(value.digest));
}
export function validateTemplate(value: Template): Template {
  if (!value || !identifier(value.id) || typeof value.title !== "string" || value.title.length > 256
    || !identifier(value.serverId) || typeof value.expectedCapabilityId !== "string" || !value.expectedCapabilityId || value.expectedCapabilityId.length > 512
    || !Array.isArray(value.allowedTools) || !value.allowedTools.length || value.allowedTools.length > 64
    || value.allowedTools.some(v => !identifier(v) || v === "chio_resume") || new Set(value.allowedTools).size !== value.allowedTools.length
    || !Number.isSafeInteger(value.ttlSeconds) || value.ttlSeconds < 1 || value.ttlSeconds > 3600
    || !value.approval || !Array.isArray(value.approval.requiredTools) || !value.approval.requiredTools.length || value.approval.requiredTools.some(v => !value.allowedTools.includes(v))
    || typeof value.approval.purpose !== "string" || value.approval.purpose.length > 1024
    || !Number.isSafeInteger(value.approval.ttlSeconds) || value.approval.ttlSeconds < 1 || value.approval.ttlSeconds > value.ttlSeconds
    || !value.scope || value.scope.source !== "operator_template" || value.scope.budget !== "unavailable"
    || [value.scope.resources, value.scope.destinations, value.scope.restrictions].some(a => !Array.isArray(a) || a.length > 64 || a.some(s => typeof s !== "string" || s.length > 1024))
    || !Array.isArray(value.requirements) || !value.requirements.length || value.requirements.length > 32
    || new Set(value.requirements.map(r => r.id)).size !== value.requirements.length) throw new Error("invalid operator task template");
  for (const r of value.requirements) {
    if (!r || !identifier(r.id) || typeof r.title !== "string" || r.title.length > 256) throw new Error("invalid completion requirement");
    const c = r.collector;
    if (c?.kind === "command") {
      if (typeof c.cwd !== "string" || resolve(c.cwd) !== c.cwd || !Array.isArray(c.argv) || !c.argv.length || c.argv.length > 64
        || c.argv.some(a => typeof a !== "string" || a.length > 4096) || !c.argv[0]?.startsWith("/")
        || !Number.isSafeInteger(c.timeoutMs) || c.timeoutMs < 1 || c.timeoutMs > 60_000) throw new Error("invalid operator command collector");
    } else if (c?.kind === "json") {
      const url = new URL(c.url);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) throw new Error("collector requires HTTPS or exact loopback");
      if (url.username || url.password || url.hash || url.search || !c.artifactPointer.startsWith("/") || !c.statePointer.startsWith("/")
        || typeof c.passedValue !== "string" || !Array.isArray(c.failedValues) || c.failedValues.some(v => typeof v !== "string")) throw new Error("invalid JSON collector");
    } else throw new Error("unsupported evidence collector");
  }
  return value;
}
export function readCatalog(path: string): Template[] {
  const value = privateRead<{ schema: string; templates: Template[] }>(path);
  if (value.schema !== "chio.task.catalog.v1" || !Array.isArray(value.templates) || !value.templates.length || value.templates.length > 32
    || new Set(value.templates.map(t => t.id)).size !== value.templates.length) throw new Error("invalid operator catalog");
  return value.templates.map(validateTemplate);
}
export function templateView(value: Template): TemplateView {
  return { id: value.id, title: value.title, revision: digest(value), allowedTools: value.allowedTools, ttlSeconds: value.ttlSeconds, scope: value.scope };
}
export function taskRevision(task: TaskRecord): string {
  return digest({ id: task.id, sessionId: task.sessionId, binding: task.binding, title: task.title, goal: task.goal,
    artifact: task.artifact, template: task.template, checkout: task.checkout ?? null });
}
export function readTask(path: string, sessionId?: string, binding?: string): TaskRecord {
  const task = privateRead<TaskRecord>(path);
  if (task.schema !== "chio.task.v1" || typeof task.id !== "string" || !/^[0-9a-f-]{36}$/.test(task.id)
    || typeof task.sessionId !== "string" || !/^[0-9a-f]{64}$/.test(task.binding)
    || typeof task.title !== "string" || task.title.length > 256 || typeof task.goal !== "string" || task.goal.length > 4096
    || !artifactValid(task.artifact) || !Array.isArray(task.observations) || task.observations.length > 1024
    || (sessionId !== undefined && task.sessionId !== sessionId) || (binding !== undefined && task.binding !== binding)
    || (task.checkout !== undefined && (typeof task.checkout !== "string" || resolve(task.checkout) !== task.checkout))) throw new Error("task has invalid or foreign binding");
  validateTemplate(task.template);
  if (task.observations.some(o => !o || !task.template.requirements.some(r => r.id === o.requirementId)
    || !/^[0-9a-f]{64}$/.test(o.revision) || !artifactValid(o.artifact) || !["outstanding", "running", "passed", "failed"].includes(o.state)
    || !Number.isSafeInteger(o.observedAt) || o.observedAt > Date.now() + 5000 || typeof o.source !== "string" || o.source.length > 1024)) throw new Error("invalid retained evidence observation");
  return task;
}
export function createTask(path: string, value: Omit<TaskRecord, "schema" | "id" | "observations">): TaskRecord {
  validateTemplate(value.template);
  if (!artifactValid(value.artifact)) throw new Error("invalid task artifact");
  const task: TaskRecord = { ...value, schema: "chio.task.v1", id: randomUUID(), observations: [] };
  privateSave(path, task, true); return readTask(path);
}
async function run(argv: string[], cwd: string, timeoutMs: number): Promise<{ code: number; stdout: string }> {
  const grouped = process.platform !== "win32";
  const child = spawn(argv[0]!, argv.slice(1), { cwd, shell: false, detached: grouped, env: { PATH: process.env.PATH ?? "", LANG: "C.UTF-8", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", size = 0, overflow = false, timedOut = false;
  let kill: ReturnType<typeof setTimeout> | undefined;
  const signal = (value: NodeJS.Signals) => {
    if (!child.pid) return;
    try { if (grouped) process.kill(-child.pid, value); else child.kill(value); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  };
  const stop = () => { signal("SIGTERM"); kill ??= setTimeout(() => signal("SIGKILL"), 1000); };
  const capture = (data: Buffer) => { size += data.length; if (size > 1024 * 1024 && !overflow) { overflow = true; stop(); } };
  child.stdout.on("data", (data: Buffer) => { capture(data); if (!overflow) stdout += data.toString(); });
  child.stderr.on("data", capture);
  const timeout = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  try {
    const code = await new Promise<number>((done, reject) => { child.once("error", reject); child.once("close", code => done(code ?? -1)); });
    if (overflow) throw new Error("collector output exceeds limit");
    if (timedOut) throw new Error("collector deadline exceeded; no completion evidence recorded");
    return { code, stdout };
  } finally {
    clearTimeout(timeout);
    // Closing the parent's pipes does not mean its process group is gone.
    // Finish cancellation even when a descendant has redirected its output.
    if (kill) { clearTimeout(kill); signal("SIGKILL"); }
  }
}
async function checkoutMatches(task: TaskRecord, requireClean: boolean): Promise<boolean> {
  if (!task.checkout) return true;
  if (task.artifact.kind !== "git_commit" || realpathSync(task.checkout) !== task.checkout) return false;
  const head = await run(["/usr/bin/git", "-C", task.checkout, "rev-parse", "--verify", "HEAD"], task.checkout, 3000);
  if (head.code !== 0 || head.stdout.trim() !== task.artifact.digest) return false;
  if (!requireClean) return true;
  const status = await run(["/usr/bin/git", "-C", task.checkout, "status", "--porcelain", "--untracked-files=all"], task.checkout, 3000);
  return status.code === 0 && status.stdout.trim() === "";
}
export async function projectTask(task: TaskRecord): Promise<TaskView> {
  const revision = taskRevision(task);
  const matches = await checkoutMatches(task, true);
  const requirements = task.template.requirements.map(r => {
    const observation = task.observations.filter(o => o.requirementId === r.id).at(-1);
    const fresh = observation?.revision === revision && digest(observation.artifact) === digest(task.artifact) && matches;
    const state = !matches || observation && !fresh ? "stale" : observation?.state ?? "outstanding";
    return { id: r.id, title: r.title, state, evidenceClass: observation && fresh ? "trusted_collector_observation" : "none",
      ...(observation ? { observedAt: observation.observedAt, source: observation.source } : {}) } as RequirementView;
  });
  const readiness = requirements.every(r => r.state === "passed") ? "ready" : requirements.some(r => r.state === "failed") ? "failed" : "outstanding";
  return { id: task.id, sessionId: task.sessionId, revision, title: task.title, goal: task.goal, artifact: task.artifact, readiness, requirements, scope: task.template.scope };
}
function pointer(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.slice(1).split("/")) {
    const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!current || typeof current !== "object" || !Object.hasOwn(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
export async function collectRequirement(path: string, id: string): Promise<TaskView> {
  const task = readTask(path); const revision = taskRevision(task);
  const requirement = task.template.requirements.find(r => r.id === id);
  if (!requirement) throw new Error("unknown completion requirement");
  if (!await checkoutMatches(task, true)) throw new Error("artifact changed or checkout is dirty");
  const c = requirement.collector; let state: RequirementView["state"], source: string;
  if (c.kind === "command") {
    if (!task.checkout || realpathSync(c.cwd) !== task.checkout) throw new Error("command evidence requires the exact clean task checkout");
    const result = await run(c.argv, c.cwd, c.timeoutMs); state = result.code === 0 ? "passed" : "failed";
    source = "operator command · " + digest({ argv: c.argv, stdout: result.stdout, code: result.code });
  } else {
    const response = await fetch(c.url.replaceAll("{artifact}", task.artifact.digest), { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("evidence source unavailable");
    const reader = response.body?.getReader(); if (!reader) throw new Error("missing evidence response");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > 1024 * 1024) throw new Error("evidence response exceeds limit"); chunks.push(r.value); }
    } finally { await reader.cancel(); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString());
    if (pointer(value, c.artifactPointer) !== task.artifact.digest) throw new Error("source evidence belongs to another artifact");
    const reported = pointer(value, c.statePointer);
    state = reported === c.passedValue ? "passed" : c.failedValues.includes(String(reported)) ? "failed" : reported === "running" ? "running" : "outstanding";
    source = new URL(c.url).origin + " · " + digest(value);
  }
  if (!await checkoutMatches(task, true)) throw new Error("artifact changed during collection");
  mutate<TaskRecord>(path, current => {
    if (taskRevision(current) !== revision || current.observations.length >= 1024) throw new Error("task changed or evidence retention requires maintenance");
    return { ...current, observations: [...current.observations, { requirementId: id, revision, artifact: task.artifact, state, observedAt: Date.now(), source }] };
  });
  return projectTask(readTask(path));
}
