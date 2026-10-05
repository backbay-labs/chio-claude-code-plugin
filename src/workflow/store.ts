import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalizeJson } from "@chio-protocol/sdk/invariants";
import { privatePath } from "../bridge-internals/gateway.js";

export function digest(value: unknown): string { return createHash("sha256").update(canonicalizeJson(value)).digest("hex"); }
export function privateRead<T>(path: string): T {
  privatePath(path, false);
  if (lstatSync(path).size > 1024 * 1024) throw new Error("private workflow record exceeds limit");
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
export function privateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 }); privatePath(path, true);
}
export function assertRecordCapacity(directory: string): void {
  if (readdirSync(directory).filter(name => name.endsWith(".json")).length >= 1000) throw new Error("workflow retention requires operator maintenance");
}
/** Replace only in the operator tree. Flush contents and the rename before reporting success. */
export function privateSave(path: string, value: unknown, exclusive = false): void {
  privatePath(dirname(path), true);
  if (exclusive && path.endsWith(".json")) assertRecordCapacity(dirname(path));
  const contents = JSON.stringify(value);
  if (Buffer.byteLength(contents) > 1024 * 1024) throw new Error("workflow record exceeds limit");
  const temporary = exclusive ? path : path + "." + randomUUID() + ".tmp";
  const fd = openSync(temporary, "wx", 0o600);
  try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
  if (!exclusive) renameSync(temporary, path);
  const directory = openSync(dirname(path), "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
/** A crash leaves this lock for operator inspection; reads remain available. */
export function mutate<T>(path: string, update: (value: T) => T): T {
  const lock = path + ".lock";
  const fd = openSync(lock, "wx", 0o600); closeSync(fd);
  try { const value = update(privateRead<T>(path)); privateSave(path, value); return value; }
  finally { unlinkSync(lock); }
}
