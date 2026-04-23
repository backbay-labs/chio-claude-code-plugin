import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { join } from "node:path";
import { signJsonStringEd25519 } from "@chio-protocol/sdk/invariants";
import { buildBridge } from "../state/bridge.js";
import { KEYSTORE_DIR, RECEIPT_CACHE_DIR } from "../state/paths.js";

/**
 * Countersign a gated action.
 *
 * Real wiring:
 *   1. Locate the receipt by id in the local cache (PreToolUse writes them
 *      on the way through). Fall back to `ChioBridge.receipts` for lookup
 *      against the trust plane's /v1/receipts/query.
 *   2. Generate or load the operator ed25519 keypair at ~/.chio/keys/operator.json.
 *   3. Sign the canonical receipt body with @chio-protocol/sdk's
 *      `signJsonStringEd25519` — the exact same helper the chio kernel uses.
 *   4. Persist the signed bundle to ~/.claude/plugins/chio/receipts/<id>.countersign.json
 *      so it flows into the next /chio:receipt-export.
 *   5. If a trust plane URL is configured, POST the bundle to
 *      /v1/authority. Failure is non-fatal — the local bundle is the
 *      evidentiary artifact.
 *
 * The signature is genuine ed25519 over canonical JSON per RFC 8785. An
 * auditor with our public DID can verify it without running chio.
 */
export async function approve(args: string[]): Promise<string> {
  const [receiptId] = args;
  if (!receiptId) throw new Error("usage: /chio:approve <receipt-id>");

  const bridge = buildBridge();
  const receipt = await loadReceipt(bridge, receiptId);
  if (!receipt) throw new Error(`no receipt ${receiptId} in local cache or trust plane`);

  const key = ensureOperatorKey();
  const input = JSON.stringify(receipt);
  // Returns { canonical_json, public_key_hex, signature_hex } — a real
  // ed25519 signature over RFC 8785 canonical JSON.
  const sig = signJsonStringEd25519(input, key.privateKeyHex);

  const bundle = {
    receipt_id: receiptId,
    signer: key.did,
    signer_pubkey_hex: sig.public_key_hex,
    signed_canonical: sig.canonical_json,
    signature_hex: sig.signature_hex,
    signed_at: new Date().toISOString(),
  };

  mkdirSync(RECEIPT_CACHE_DIR, { recursive: true });
  const bundlePath = join(RECEIPT_CACHE_DIR, `${receiptId}.countersign.json`);
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

  let propagated: "posted" | "skipped" | "failed" = "skipped";
  let propagationError: string | undefined;
  if (process.env.CHIO_SERVICE_TOKEN || process.env.CLAUDE_PLUGIN_OPTION_SERVICE_TOKEN) {
    try {
      await postAuthority({
        receipt_id: bundle.receipt_id,
        signer: bundle.signer,
        signature_hex: bundle.signature_hex,
      });
      propagated = "posted";
    } catch (err) {
      propagated = "failed";
      propagationError = (err as Error).message;
    }
  }

  return JSON.stringify(
    {
      status: "approved",
      receipt_id: receiptId,
      signer: key.did,
      signature_hex: bundle.signature_hex,
      bundle_path: bundlePath,
      propagated,
      ...(propagationError ? { propagation_error: propagationError } : {}),
    },
    null,
    2,
  );
}

async function loadReceipt(
  bridge: ReturnType<typeof buildBridge>,
  id: string,
): Promise<unknown | undefined> {
  const cachePath = join(RECEIPT_CACHE_DIR, `${id}.json`);
  if (existsSync(cachePath)) {
    try {
      return JSON.parse(readFileSync(cachePath, "utf8"));
    } catch {
      /* fallthrough */
    }
  }
  try {
    const items = await bridge.receipts({ limit: 100 });
    return items.find((r) => r.id === id);
  } catch {
    return undefined;
  }
}

async function postAuthority(bundle: {
  receipt_id: string;
  signer: string;
  signature_hex: string;
}): Promise<void> {
  const token =
    process.env.CHIO_SERVICE_TOKEN ??
    process.env.CLAUDE_PLUGIN_OPTION_SERVICE_TOKEN;
  if (!token) return;
  const base = (
    process.env.CHIO_TRUST_URL ??
    process.env.CLAUDE_PLUGIN_OPTION_TRUST_URL ??
    "http://127.0.0.1:8940"
  ).replace(/\/$/, "");
  const res = await fetch(`${base}/v1/authority`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "receipt_countersignature",
      receipt_id: bundle.receipt_id,
      signer: bundle.signer,
      signature_hex: bundle.signature_hex,
    }),
  });
  if (!res.ok) {
    throw new Error(`authority endpoint returned HTTP ${res.status}`);
  }
}

function ensureOperatorKey(): {
  did: string;
  publicKeyHex: string;
  privateKeyHex: string;
} {
  mkdirSync(KEYSTORE_DIR, { recursive: true });
  const path = join(KEYSTORE_DIR, "operator.json");
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8")) as {
      did: string;
      publicKeyHex: string;
      privateKeyHex: string;
    };
  }
  const kp = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  }) as { publicKey: Buffer; privateKey: Buffer };
  // DER-wrapped; strip to the trailing 32 raw bytes.
  const publicRaw = kp.publicKey.subarray(-32).toString("hex");
  const privateRaw = kp.privateKey.subarray(-32).toString("hex");
  const key = {
    did: `did:chio:${publicRaw}`,
    publicKeyHex: publicRaw,
    privateKeyHex: privateRaw,
  };
  writeFileSync(path, JSON.stringify(key, null, 2), { mode: 0o600 });
  return key;
}
