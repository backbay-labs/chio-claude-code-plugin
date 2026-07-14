// Bundle the plugin's runtime entrypoints into self-contained ESM so a
// marketplace install (a plain git clone with no node_modules) can run the
// hooks and command scripts. Node built-ins stay external; every other
// dependency (@chio/bridge, @chio-protocol/sdk, yaml, zod) is inlined.
//
// Runtime load map:
//   scripts/_runner.mjs      -> dist/index.js
//   hooks/pretooluse.mjs     -> dist/state/{bridge,store,paths}.js
//   hooks/posttooluse.mjs    -> dist/state/{bridge,paths}.js
//
// Each entrypoint is bundled independently (no shared chunks). Command and
// hook processes are separate, so the duplication costs disk, not correctness.

import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  absWorkingDir: root,
  entryPoints: [
    "src/index.ts",
    "src/state/bridge.ts",
    "src/state/store.ts",
    "src/state/paths.ts",
  ],
  outbase: "src",
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Some transitive CJS dependencies call require() at runtime. In an ESM
  // bundle esbuild routes those through its __require shim, which throws
  // unless a real require exists in scope. Provide one from the module url.
  banner: {
    js: [
      "import { createRequire as __chioCreateRequire } from 'node:module';",
      "const require = __chioCreateRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});
