import { buildBridge, getPolicyPath } from "../state/bridge.js";
import { getSoleBond } from "../state/store.js";

export async function policyShow(): Promise<string> {
  const bond = getSoleBond();
  const policyPath = bond?.policyPath ?? getPolicyPath();
  if (!policyPath) {
    throw new Error(
      "no policy path known; run /chio:bond or set CHIO_POLICY_PATH",
    );
  }
  const bridge = buildBridge();
  const policy = await bridge.loadPolicy(policyPath);
  const lint = await bridge.lintPolicy(policy);

  const lines: string[] = [];
  lines.push(`policy: ${policy.name ?? "(unnamed)"}  (${policyPath})`);
  lines.push(`hushspec: ${policy.hushspec}`);
  if (policy.description) lines.push(`description: ${policy.description}`);
  lines.push("");
  lines.push("rules:");
  for (const [key, value] of Object.entries(policy.rules ?? {})) {
    lines.push(`  ${key}:`);
    lines.push(indent(formatValue(value), 4));
  }
  if (policy.extensions) {
    lines.push("");
    lines.push("extensions:");
    lines.push(indent(formatValue(policy.extensions), 2));
  }
  if (lint.errors.length || lint.warnings.length) {
    lines.push("");
    lines.push("lint:");
    for (const e of lint.errors) lines.push(`  ERROR  ${e.path}: ${e.message}`);
    for (const w of lint.warnings) lines.push(`  warn   ${w.path}: ${w.message}`);
  }
  return lines.join("\n");
}

function indent(text: string, n: number): string {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((l) => (l.length ? pad + l : l))
    .join("\n");
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(empty)";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (Array.isArray(v)) {
    return v.map((x) => `- ${formatValue(x)}`).join("\n");
  }
  const obj = v as Record<string, unknown>;
  return Object.entries(obj)
    .map(([k, val]) => {
      const formatted = formatValue(val);
      if (formatted.includes("\n")) return `${k}:\n${indent(formatted, 2)}`;
      return `${k}: ${formatted}`;
    })
    .join("\n");
}
