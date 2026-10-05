import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const casesDir = join(root, "evals/chio-lifecycle/evals");
const expected = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e",
  'import { guidanceText } from "./hooks/native/projection.ts"; process.stdout.write(guidanceText({ protectedTools: ["write_file"], scope: "isolated_kernel_mcp" }));'],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

function frontmatter(file) {
  const m = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${file} has frontmatter`);
  return m[1].split("\n");
}
function appendBlock(lines) {
  const i = lines.findIndex(l => l.startsWith("append_system_prompt:"));
  if (i < 0) return null;
  assert.equal(lines[i].trim(), "append_system_prompt: |");
  const out = [];
  for (const l of lines.slice(i + 1)) {
    if (l !== "" && !l.startsWith("  ")) break;
    out.push(l.startsWith("  ") ? l.slice(2) : l);
  }
  return out.join("\n").replace(/\n+$/, "");
}
const cases = readdirSync(casesDir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== "mocks").map(d => d.name);

test("eval cases exist for both arms", () => {
  assert.equal(cases.filter(c => c.endsWith("-guided")).length, 6);
  assert.equal(cases.filter(c => c.endsWith("-unguided")).length, 6);
});
test("guidanceText sanity", () => assert.match(expected, /Chio mediates these tools: write_file\./));
for (const name of cases) {
  test(`${name} guidance matches guidanceText`, () => {
    const block = appendBlock(frontmatter(join(casesDir, name, "prompt.md")));
    if (name.endsWith("-unguided")) assert.equal(block, null);
    else assert.equal(block, expected);
  });
}
