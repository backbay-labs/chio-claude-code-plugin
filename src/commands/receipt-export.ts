import { resolve } from "node:path";
import { buildBridge } from "../state/bridge.js";
import { getMostRecentBond, getSoleBond } from "../state/store.js";

export async function receiptExport(args: string[]): Promise<string> {
  const [sinceArg = "session", outArg = "./chio-evidence.tar.zst"] = args;
  const outPath = resolve(outArg);
  const since = resolveSince(sinceArg);

  const bridge = buildBridge();
  const writtenPath = await bridge.exportEvidence({ since, outPath });

  return JSON.stringify(
    {
      status: "exported",
      path: writtenPath,
      since: since.toISOString(),
    },
    null,
    2,
  );
}

function resolveSince(input: string): Date {
  const now = Date.now();
  if (input === "all") return new Date(0);
  if (input === "session") {
    const bond = getSoleBond() ?? getMostRecentBond();
    if (bond) return new Date(bond.bondedAt);
    // Fall back to the last hour if we can't locate a bond.
    return new Date(now - 3600_000);
  }
  const m = input.match(/^(\d+)(s|m|h|d)$/);
  if (m && m[1] && m[2]) {
    const n = Number(m[1]);
    const unit = m[2] as "s" | "m" | "h" | "d";
    const mult: Record<typeof unit, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(now - n * mult[unit]);
  }
  const iso = new Date(input);
  if (!Number.isNaN(iso.getTime())) return iso;
  throw new Error(`unrecognized since: "${input}"`);
}
