#!/usr/bin/env node
// PostToolUse hook for Claude Code.
//
// Informational only: this hook cannot block (the tool already ran). Its
// job is to sign-verify the receipt emitted by PreToolUse and stream it
// into the local receipt store. On any error: log loudly, exit 0.

import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "dist");

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (err) {
  process.stderr.write(`[chio] PostToolUse malformed input: ${err.message}\n`);
  process.exit(0);
}

const { tool_use_id } = input;

let buildBridge, PENDING_DIR, RECEIPT_CACHE_DIR;
try {
  ({ buildBridge } = await import(join(distRoot, "state", "bridge.js")));
  ({ PENDING_DIR, RECEIPT_CACHE_DIR } = await import(
    join(distRoot, "state", "paths.js"),
  ));
} catch (err) {
  process.stderr.write(`[chio] PostToolUse: plugin not built (${err.message})\n`);
  process.exit(0);
}

if (!tool_use_id) {
  process.stderr.write("[chio] PostToolUse: no tool_use_id, skipping receipt persist\n");
  process.exit(0);
}

const pendingPath = join(PENDING_DIR, `${tool_use_id}.json`);
if (!existsSync(pendingPath)) {
  // PreToolUse didn't cache a receipt (e.g. allow path with no receipt).
  process.exit(0);
}

let receipt;
try {
  receipt = JSON.parse(readFileSync(pendingPath, "utf8"));
} catch (err) {
  process.stderr.write(`[chio] PostToolUse: could not read receipt ${pendingPath}: ${err.message}\n`);
  process.exit(0);
}

const bridge = buildBridge();
try {
  const ok = await bridge.verifyReceipt(receipt);
  if (!ok) {
    process.stderr.write(
      `[chio] receipt ${receipt.id ?? "<unknown>"} FAILED signature verification\n`,
    );
  }
} catch (err) {
  process.stderr.write(
    `[chio] receipt ${receipt.id ?? "<unknown>"} verify error: ${err.message}\n`,
  );
}

try {
  mkdirSync(RECEIPT_CACHE_DIR, { recursive: true });
  const id = receipt.id ?? tool_use_id;
  writeFileSync(join(RECEIPT_CACHE_DIR, `${id}.json`), JSON.stringify(receipt));
  unlinkSync(pendingPath);
} catch (err) {
  process.stderr.write(`[chio] could not archive receipt: ${err.message}\n`);
}

process.exit(0);
