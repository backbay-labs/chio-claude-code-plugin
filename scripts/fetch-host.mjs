#!/usr/bin/env node
// Download a separate, checksum-pinned host. Never replace the user's Claude.
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, linkSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pin = JSON.parse(readFileSync(join(root, "docs/host-contract.json"), "utf8"));
const selected = pin.platforms[`${process.platform}-${process.arch}`];
if (process.argv.length !== 4 || process.argv[2] !== "--output" || !selected) throw new Error("usage: fetch-host.mjs --output NEW_PATH on a pinned supported platform");
const destination = resolve(process.argv[3]);
if (existsSync(destination)) throw new Error("host output already exists; select a new path");
const source = pin.binarySource.replace("{version}", pin.version).replace("{platform}", `${process.platform}-${process.arch}`).replace("{binary}", selected.binary);
const url = new URL(source);
if (url.protocol !== "https:" || url.hostname !== "downloads.claude.ai" || url.username || url.password || url.search || url.hash) throw new Error("unexpected host origin");
const temporary = `${destination}.${randomUUID()}.part`;
const fd = openSync(temporary, "wx", 0o600);
let complete = false;
try {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(180_000) });
  if (!response.ok || !response.body) throw new Error("pinned host download failed");
  const hash = createHash("sha256"); let size = 0;
  for await (const data of response.body) {
    size += data.length; if (size > selected.size) throw new Error("host exceeds selected size");
    hash.update(data); let offset = 0;
    while (offset < data.length) offset += writeSync(fd, data, offset, data.length - offset);
  }
  if (size !== selected.size || hash.digest("hex") !== selected.checksum) throw new Error("host identity differs from the official retained pin");
  fsyncSync(fd); closeSync(fd); complete = true;
  chmodSync(temporary, 0o700);
  // Same-directory hard link atomically refuses a concurrently created output.
  linkSync(temporary, destination); unlinkSync(temporary);
  process.stdout.write(JSON.stringify({ version: pin.version, path: destination, sha256: selected.checksum, source }) + "\n");
} finally { if (!complete) closeSync(fd); if (existsSync(temporary)) unlinkSync(temporary); }
