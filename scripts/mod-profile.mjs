import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
const sourceFiles = ["hooks/native/register.ts", "hooks/native/projection.ts", "hooks/native/workflow.ts", "types/control.d.ts", "types/workflow.d.ts", "types/chio.d.ts"];
const nativeManifest = { name: "chio", types: "./types/chio.d.ts", version: "0.4.0-rc.2", description: "Native Chio session interface; execution authority remains in the kernel." };
const nativeHooks = { modules: ["./native/register.ts"] };
export function nativeModIdentity(root) {
  const files = sourceFiles.map(path => {
    const file = join(root, path), stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o022) || stat.size > 1024 * 1024) throw new Error("native mod source must be a bounded protected regular file");
    return { path, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") };
  });
  return createHash("sha256").update(JSON.stringify({ manifest: nativeManifest, hooks: nativeHooks, files })).digest("hex");
}
export function stageNativeMod(root, destination, expected) {
  if (!/^[0-9a-f]{64}$/.test(expected) || nativeModIdentity(root) !== expected) throw new Error("native mod differs from the selected pin");
  mkdirSync(destination, { mode: 0o700 });
  const files = [];
  for (const path of sourceFiles) {
    const target = join(destination, path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, readFileSync(join(root, path)), { mode: 0o400, flag: "wx" }); files.push(target);
  }
  for (const [path, value] of [[".claude-plugin/plugin.json", nativeManifest], ["hooks/hooks.json", nativeHooks]]) {
    const target = join(destination, path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, JSON.stringify(value), { mode: 0o400, flag: "wx" }); files.push(target);
  }
  const typesDirectory = join(destination, ".claude-plugin/types"); mkdirSync(typesDirectory, { mode: 0o700 });
  const sha256 = nativeModIdentity(destination);
  if (sha256 !== expected) throw new Error("native mod changed while staging; launch refused");
  const directories = [destination, join(destination, ".claude-plugin"), join(destination, "hooks"), join(destination, "hooks/native"), join(destination, "types")];
  return { root: destination, files, directories, typesDirectory, sha256 };
}
