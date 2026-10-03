import type { TaskView, TemplateView } from "../../types/workflow.js";
import { safeText } from "./projection.ts";

export function controlOrigin(base: string): string {
  const url = new URL(base);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("exact loopback control origin required");
  return url.origin;
}
export function taskText(task?: TaskView, templates: TemplateView[] = []): string {
  if (!task) return "No task contract is bound to this session.\n" + templates.map(t => t.id + " · " + safeText(t.title) + " · " + t.ttlSeconds + "s · " + t.allowedTools.join(", ") + "\n  Resources: " + t.scope.resources.map(safeText).join(", ") + "\n  Destinations: " + t.scope.destinations.map(safeText).join(", ") + "\n  Restrictions: " + t.scope.restrictions.map(safeText).join("; ") + " · budget unavailable").join("\n") + "\nChoose a template to request operator preparation. Selection grants no authority.";
  return [safeText(task.title) + " · " + task.readiness, "Goal: " + safeText(task.goal),
    "Artifact: " + task.artifact.kind + " " + task.artifact.digest + " · " + safeText(task.artifact.label),
    ...task.requirements.map(r => safeText(r.title) + " · " + r.state + " · " + r.evidenceClass),
    "Resources: " + task.scope.resources.map(safeText).join(", "), "Destinations: " + task.scope.destinations.map(safeText).join(", "),
    "Restrictions: " + task.scope.restrictions.map(safeText).join("; "),
    "Scope descriptions come from the operator template. Kernel authority is checked separately. Budget detail unavailable.",
    "Readiness covers this contract's observed requirements; it does not admit or perform a release action."].join("\n");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(value);
}
export async function outcomeHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
