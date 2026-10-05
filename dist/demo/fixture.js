import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// src/demo/fixture.ts
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

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
function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
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

// node_modules/@chio-protocol/sdk/dist/invariants/receipt.js
function receiptIdInput(receipt) {
  const input = {
    action: receipt.action,
    capability_id: receipt.capability_id,
    content_hash: receipt.content_hash,
    receipt_kind: receipt.receipt_kind,
    boundary_class: receipt.boundary_class,
    tool_origin: receipt.tool_origin,
    redaction_mode: receipt.redaction_mode,
    kernel_key: receipt.kernel_key,
    policy_hash: receipt.policy_hash,
    timestamp: receipt.timestamp,
    tool_name: receipt.tool_name,
    tool_server: receipt.tool_server
  };
  if (receipt.evidence !== void 0 && receipt.evidence.length > 0) {
    input.evidence = receipt.evidence;
  }
  if (receipt.decision !== void 0) {
    input.decision = receipt.decision;
  }
  if (receipt.observation_outcome !== void 0) {
    input.observation_outcome = receipt.observation_outcome;
  }
  if (receipt.actor_chain !== void 0 && receipt.actor_chain.length > 0) {
    input.actor_chain = receipt.actor_chain;
  }
  if (receipt.metadata !== void 0 && receipt.metadata !== null) {
    input.metadata = receipt.metadata;
  }
  input.trust_level = receipt.trust_level;
  if (receipt.tenant_id !== void 0) {
    input.tenant_id = receipt.tenant_id;
  }
  return input;
}
function receiptSigningBodyCanonicalJson(receipt) {
  return canonicalizeJson({
    id: receipt.id,
    body: receiptIdInput(receipt)
  });
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

// src/demo/fixture.ts
function signerFor(seed) {
  return signUtf8MessageEd25519("identity", seed).public_key_hex;
}
function signedDecision(config, proposal, decision, seed) {
  const signer = signerFor(seed);
  const intent = {
    server_id: config.execution.serverId,
    tool_name: proposal.tool_name,
    body: { kind: "bound_tool_invocation", value: { capability_id: config.execution.capabilityId, parameters_hash: "0x" + sha256Hex(canonicalizeJson(proposal.arguments)) } },
    context: { mcpSessionId: config.execution.sessionId, capabilityId: config.execution.capabilityId }
  };
  const now = Math.floor(Date.now() / 1e3);
  const token = {
    id: "approval-a",
    approver: signer,
    subject: config.execution.subjectKey,
    governed_intent_hash: sha256Hex(canonicalizeJson(intent)),
    request_id: proposal.request_id,
    issued_at: now,
    expires_at: now + 300,
    decision
  };
  token.signature = signUtf8MessageEd25519(canonicalizeJson(token), seed).signature_hex;
  return { name: proposal.tool_name, arguments: proposal.arguments, _meta: { chioRequestId: proposal.request_id, chioGovernedIntent: intent, chioApprovalToken: token } };
}
function signedOutcome(config, request, seed, result = { content: [{ type: "text", text: "One fixture write completed." }], isError: false }) {
  const signer = signerFor(seed);
  const receipt = {
    id: "",
    timestamp: Math.floor(Date.now() / 1e3),
    capability_id: config.execution.capabilityId,
    tool_server: config.execution.serverId,
    tool_name: request.tool,
    action: { parameters: request.arguments, parameter_hash: sha256Hex(canonicalizeJson(request.arguments)) },
    decision: { verdict: "allow", reason: "fixture exact grant" },
    receipt_kind: "mediated_decision",
    boundary_class: "prevent",
    trust_level: "mediated",
    tool_origin: "resource",
    redaction_mode: "none",
    content_hash: sha256Hex(canonicalizeJson(result)),
    policy_hash: "c".repeat(64),
    kernel_key: signer,
    metadata: {
      receipt_context: { request_id: request.requestId },
      attribution: { subject_key: config.execution.subjectKey },
      admission_operation: { schema: "chio.admission-receipt.v1", request_id: request.requestId, projected_state: "completed", projected_dispatch_state: "terminal", tool_outcome_id: "fixture-outcome" }
    }
  };
  receipt.id = sha256Hex(canonicalizeJson(JSON.parse(receiptSigningBodyCanonicalJson(receipt)).body));
  receipt.signature = signUtf8MessageEd25519(receiptSigningBodyCanonicalJson(receipt), seed).signature_hex;
  const params = { name: request.tool, arguments: request.arguments, _meta: { chioRequestId: request.requestId, ...request.approval } };
  return {
    state: "completed",
    evidence: "verified",
    requestId: request.requestId,
    result,
    receipt,
    delivery: {
      schema: "chio.mcp.delivery-ack.v1",
      requestId: request.requestId,
      receiptId: receipt.id,
      resultHash: receipt.content_hash,
      requestHash: sha256Hex(canonicalizeJson({ method: "tools/call", params })),
      acknowledgement: "A".repeat(43)
    }
  };
}
var MAX_BODY = 1024 * 1024;
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}
async function startDemoKernel(options) {
  const { owner, seed, adminToken, bearerToken, credential } = options;
  const ownerRoot = resolve(owner);
  const proposals = /* @__PURE__ */ new Map();
  let counter = 0, writes = 0, revoked = false;
  const send = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const confine = (path) => {
    if (typeof path !== "string" || path === "" || path.includes("\0") || isAbsolute(path)) throw new Error("path is not allowed");
    const full = resolve(ownerRoot, path);
    const rel = relative(ownerRoot, full);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("path escapes the owner directory");
    return full;
  };
  const server = createServer(async (req, res) => {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "invalid request body" } });
      return;
    }
    const path = (req.url ?? "").split("?")[0] ?? "";
    const config = options.config();
    if (path.startsWith("/admin/")) {
      if (req.headers.authorization !== `Bearer ${adminToken}`) {
        send(res, 401, { error: "unauthorized" });
        return;
      }
      const record = (id2, proposal) => ({ id: id2, request_id: proposal.request_id, session_id: config.execution.sessionId, capability_id: config.execution.capabilityId });
      if (req.method === "POST" && path === "/admin/approvals") {
        const id2 = `approval-${++counter}`;
        proposals.set(id2, body);
        send(res, 200, { dispatchPerformedByThisEndpoint: false, record: record(id2, body) });
        return;
      }
      const decision = /^\/admin\/approvals\/([^/]+)\/decision$/.exec(path);
      if (req.method === "POST" && decision) {
        const id2 = decodeURIComponent(decision[1] ?? "");
        const proposal = proposals.get(id2);
        if (!proposal || body.decision !== "approved" && body.decision !== "denied") {
          send(res, 404, { error: "unknown approval or decision" });
          return;
        }
        send(res, 200, { dispatchPerformedByThisEndpoint: false, record: record(id2, proposal), toolCallParams: signedDecision(config, proposal, body.decision, seed) });
        return;
      }
      if (req.method === "POST" && path === `/admin/sessions/${encodeURIComponent(config.execution.sessionId)}/trust`) {
        revoked = true;
        send(res, 200, { sessionId: config.execution.sessionId, revoked: true, capabilities: [{ capabilityId: config.execution.capabilityId, revoked: true }] });
        return;
      }
      send(res, 404, { error: "not found" });
      return;
    }
    if (req.headers.authorization !== `Bearer ${bearerToken}` || req.headers["mcp-session-id"] !== credential.sessionId || revoked) {
      send(res, 401, { jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32001, message: "unauthorized" } });
      return;
    }
    const id = body?.id ?? null;
    const fail = (message) => send(res, 200, { jsonrpc: "2.0", id, error: { code: -32602, message } });
    const ok = (result) => send(res, 200, { jsonrpc: "2.0", id, result });
    const params = body?.params ?? {};
    if (body?.method === "chio/execution-context") {
      ok({
        schema: "chio.mcp.execution-context.v1",
        evidenceVersion: "1",
        deliveryAcknowledgementVersion: "1",
        subjectKey: credential.subjectKey,
        serverId: credential.serverId,
        capabilityIds: credential.capabilityIds,
        sessionCredential: credential
      });
      return;
    }
    if (body?.method === "tools/call" && (params.name === "write_file" || params.name === "read_text_file")) {
      let text;
      try {
        const full = confine(params.arguments?.path);
        if (params.name === "write_file") {
          if (typeof params.arguments.content !== "string") throw new Error("content must be a string");
          mkdirSync(dirname(full), { recursive: true });
          writeFileSync(full, params.arguments.content, { flag: "wx" });
          writes++;
          text = `Wrote ${params.arguments.path} in the demo owner directory.`;
        } else text = readFileSync(full, "utf8");
      } catch (error) {
        fail(error instanceof Error ? error.message : "tool call refused");
        return;
      }
      const outcome = signedOutcome(
        config,
        {
          requestId: params._meta?.chioRequestId,
          tool: params.name,
          arguments: params.arguments,
          approval: { chioGovernedIntent: params._meta?.chioGovernedIntent, chioApprovalToken: params._meta?.chioApprovalToken }
        },
        seed,
        { content: [{ type: "text", text }], isError: false }
      );
      ok({ _meta: { chioEvidence: { schema: "chio.mcp.execution-evidence.v1", requestId: outcome.requestId, receipt: outcome.receipt, terminalState: "completed", outputKind: "value", output: outcome.result }, chioDelivery: outcome.delivery } });
      return;
    }
    if (body?.method === "chio/acknowledge") {
      ok({ schema: "chio.mcp.delivery-ack.v1", requestId: params.requestId, receiptId: params.receiptId, acknowledged: true });
      return;
    }
    send(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "method is not available in the demo fixture" } });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    writes: () => writes,
    close: () => new Promise((done) => {
      server.close(() => done());
      server.closeAllConnections();
    })
  };
}
export {
  signedDecision,
  signedOutcome,
  signerFor,
  startDemoKernel
};
