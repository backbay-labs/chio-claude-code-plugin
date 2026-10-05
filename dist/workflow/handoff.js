import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// node_modules/@chio-protocol/sdk/dist/invariants/errors.js
var ChioInvariantError = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "ChioInvariantError";
    this.code = code;
  }
};

// node_modules/@chio-protocol/sdk/dist/invariants/json.js
function compareUtf16(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
function canonicalizeString(value) {
  return JSON.stringify(value);
}
function canonicalizeJson(value) {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new ChioInvariantError("canonical_json", "canonical JSON does not support non-finite numbers");
      }
      return JSON.stringify(value);
    case "string":
      return canonicalizeString(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
      }
      const entries = Object.entries(value);
      for (const [, entryValue] of entries) {
        if (entryValue === void 0) {
          throw new ChioInvariantError("canonical_json", "canonical JSON does not support undefined object fields");
        }
      }
      return `{${entries.sort(([left], [right]) => compareUtf16(left, right)).map(([key, entryValue]) => `${canonicalizeString(key)}:${canonicalizeJson(entryValue)}`).join(",")}}`;
    default:
      throw new ChioInvariantError("canonical_json", `canonical JSON does not support values of type ${typeof value}`);
  }
}

// node_modules/@chio-protocol/sdk/dist/invariants/crypto.js
import { createHash, createPrivateKey, createPublicKey, sign as signMessage, verify as verifySignature } from "node:crypto";
var ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
var ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
var P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
var P384_SPKI_PREFIX = Buffer.from("3076301006072a8648ce3d020106052b81040022036200", "hex");
function normalizeHex(hex) {
  return hex.startsWith("0x") ? hex.slice(2).toLowerCase() : hex.toLowerCase();
}
function hexToBuffer(hex, expectedBytes, code) {
  const normalized = normalizeHex(hex);
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    throw new ChioInvariantError(code, "value is not valid hexadecimal");
  }
  if (normalized.length !== expectedBytes * 2) {
    throw new ChioInvariantError(code, `expected ${expectedBytes} bytes of hex, got ${normalized.length / 2}`);
  }
  return Buffer.from(normalized, "hex");
}
function createEd25519PrivateKey(seedHex) {
  try {
    return createPrivateKey({
      key: Buffer.concat([ED25519_PKCS8_PREFIX, hexToBuffer(seedHex, 32, "invalid_hex")]),
      format: "der",
      type: "pkcs8"
    });
  } catch (cause) {
    if (cause instanceof ChioInvariantError) {
      throw cause;
    }
    throw new ChioInvariantError("invalid_hex", "value is not a valid Ed25519 seed", { cause });
  }
}
function createEd25519PublicKey(publicKeyHex) {
  try {
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, hexToBuffer(publicKeyHex, 32, "invalid_public_key")]),
      format: "der",
      type: "spki"
    });
  } catch (cause) {
    if (cause instanceof ChioInvariantError) {
      throw cause;
    }
    throw new ChioInvariantError("invalid_public_key", "value is not a valid Ed25519 public key", { cause });
  }
}
function publicKeyHexFromSeedHex(seedHex) {
  const privateKey = createEd25519PrivateKey(seedHex);
  const publicKeyDer = createPublicKey(privateKey).export({
    format: "der",
    type: "spki"
  });
  return Buffer.from(publicKeyDer).subarray(ED25519_SPKI_PREFIX.length).toString("hex");
}
function signEd25519Message(message, seedHex) {
  const privateKey = createEd25519PrivateKey(seedHex);
  const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message, "utf8");
  return {
    public_key_hex: publicKeyHexFromSeedHex(seedHex),
    signature_hex: Buffer.from(signMessage(null, messageBuffer, privateKey)).toString("hex")
  };
}
function verifyEd25519Signature(message, publicKeyHex, signatureHex) {
  const signatureBytes = hexToBuffer(signatureHex, 64, "invalid_signature");
  const key = createEd25519PublicKey(publicKeyHex);
  return verifySignature(null, Buffer.isBuffer(message) ? message : Buffer.from(message, "utf8"), key, signatureBytes);
}

// node_modules/@chio-protocol/sdk/dist/invariants/manifest.js
var REQUIRED_PERMISSION_FIELDS = [
  "read_paths",
  "write_paths",
  "network_hosts",
  "environment_variables"
];
var REQUIRED_PERMISSION_FIELD_SET = new Set(REQUIRED_PERMISSION_FIELDS);
var U64_MAX_EXCLUSIVE = 2 ** 64;

// node_modules/@chio-protocol/sdk/dist/invariants/signing.js
function signUtf8MessageEd25519(input, seedHex) {
  return signEd25519Message(input, seedHex);
}
function verifyUtf8MessageEd25519(input, publicKeyHex, signatureHex) {
  return verifyEd25519Signature(input, publicKeyHex, signatureHex);
}

// src/workflow/handoff.ts
function createHandoff(task, status, seed) {
  if (!/^[0-9a-f]{64}$/.test(seed) || task.sessionId !== status.sessionId) throw new Error("operator signing key and exact source session required");
  const body = {
    schema: "chio.task.handoff.v1",
    capturedAt: Date.now(),
    sourceSessionId: status.sessionId,
    task,
    retainedOperations: status.operations.map((o) => ({ requestId: o.requestId, state: o.state, nextAction: o.nextAction, ...o.receiptId ? { receiptId: o.receiptId } : {} })),
    authorityTransferred: false
  };
  const signed = signUtf8MessageEd25519(canonicalizeJson(body), seed);
  return { body, signer: signed.public_key_hex, signature: signed.signature_hex };
}
function verifyHandoff(capsule, trustedSigner) {
  const body = capsule?.body;
  if (!/^[0-9a-f]{64}$/.test(trustedSigner) || capsule?.signer !== trustedSigner || !body || body.schema !== "chio.task.handoff.v1" || body.authorityTransferred !== false || body.sourceSessionId !== body.task?.sessionId || typeof body.task?.goal !== "string" || body.task.goal.length > 4096 || !Number.isSafeInteger(body.capturedAt) || body.capturedAt > Date.now() + 5e3 || !Array.isArray(body.retainedOperations) || body.retainedOperations.length > 1e3 || JSON.stringify(capsule).length > 1024 * 1024 || !verifyUtf8MessageEd25519(canonicalizeJson(body), trustedSigner, capsule.signature)) throw new Error("handoff signature, source binding or independent signer pin is invalid");
  return { verified: true, snapshot: body, authorityTransferred: false, next: "Prepare separately bound authority. Recollect evidence for the target task; reconcile original uncertain operations in their source session." };
}
export {
  createHandoff,
  verifyHandoff
};
