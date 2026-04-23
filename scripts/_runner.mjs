// Shared runner for command scripts. Loads a named export from the compiled
// dist/ bundle and invokes it with process.argv. Keeps each command wrapper
// to two lines.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function run(name) {
  const distIndex = join(__dirname, "..", "dist", "index.js");
  let mod;
  try {
    mod = await import(distIndex);
  } catch (err) {
    console.error(
      `[chio] plugin not built; run \`bun install && bun run build\` in ${join(
        __dirname,
        "..",
      )} (${err.message})`,
    );
    process.exit(2);
  }
  const fn = mod[name];
  if (typeof fn !== "function") {
    console.error(`[chio] no exported command "${name}"`);
    process.exit(2);
  }
  const args = process.argv.slice(2).filter((a) => a.length > 0);
  try {
    const out = await fn(args);
    if (out !== undefined && out !== null) {
      process.stdout.write(typeof out === "string" ? out : JSON.stringify(out, null, 2));
      process.stdout.write("\n");
    }
  } catch (err) {
    console.error(`[chio ${name}] ${err.message}`);
    process.exit(1);
  }
}
