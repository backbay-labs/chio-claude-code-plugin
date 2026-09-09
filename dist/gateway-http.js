import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// node_modules/@chio/bridge/dist/gateway-http.js
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

// node_modules/@chio/bridge/dist/gateway.js
import { createHash as createHash2 } from "node:crypto";
import { constants, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/errors.js
var ChioInvariantError = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "ChioInvariantError";
    this.code = code;
  }
};

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/json.js
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

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/crypto.js
import { createHash, createPrivateKey, createPublicKey, sign as signMessage, verify as verifySignature } from "node:crypto";
var ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
var ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
var P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
var P384_SPKI_PREFIX = Buffer.from("3076301006072a8648ce3d020106052b81040022036200", "hex");
var P256_RAW_POINT_BYTES = 65;
var P384_RAW_POINT_BYTES = 97;
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
function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}
function publicKeyHexMatches(left, right) {
  return normalizeHex(left) === normalizeHex(right);
}
function verifyEd25519Signature(message, publicKeyHex, signatureHex) {
  const signatureBytes = hexToBuffer(signatureHex, 64, "invalid_signature");
  const key = createEd25519PublicKey(publicKeyHex);
  return verifySignature(null, Buffer.isBuffer(message) ? message : Buffer.from(message, "utf8"), key, signatureBytes);
}
function hexBodyToBuffer(hexBody) {
  if (hexBody.length === 0 || hexBody.length % 2 !== 0) {
    throw new ChioInvariantError("invalid_signature", "signature hex body must be a non-empty even-length string");
  }
  if (!/^[0-9a-f]+$/i.test(hexBody)) {
    throw new ChioInvariantError("invalid_signature", "signature hex body is not valid hexadecimal");
  }
  return Buffer.from(hexBody, "hex");
}
function createEcdsaPublicKey(publicKeyHex, curve) {
  const rawHex = normalizeHex(publicKeyHex);
  if (!/^[0-9a-f]+$/i.test(rawHex)) {
    throw new ChioInvariantError("invalid_public_key", "public key is not valid hexadecimal");
  }
  const rawBytes = Buffer.from(rawHex, "hex");
  const expectedRawLen = curve === "P-256" ? P256_RAW_POINT_BYTES : P384_RAW_POINT_BYTES;
  const prefix = curve === "P-256" ? P256_SPKI_PREFIX : P384_SPKI_PREFIX;
  let spki;
  if (rawBytes.length === expectedRawLen && rawBytes[0] === 4) {
    spki = Buffer.concat([prefix, rawBytes]);
  } else if (rawBytes.length > expectedRawLen) {
    spki = rawBytes;
  } else {
    throw new ChioInvariantError("invalid_public_key", `value is not a valid ${curve} public key (expected ${expectedRawLen} raw bytes or SPKI DER)`);
  }
  try {
    return createPublicKey({
      key: spki,
      format: "der",
      type: "spki"
    });
  } catch (cause) {
    throw new ChioInvariantError("invalid_public_key", `value is not a valid ${curve} public key`, { cause });
  }
}
function verifyEcdsaSignature(message, publicKeyHex, signatureHexBody, curve) {
  const hashAlgorithm = curve === "P-256" ? "sha256" : "sha384";
  const signatureDer = hexBodyToBuffer(signatureHexBody);
  const key = createEcdsaPublicKey(publicKeyHex, curve);
  try {
    return verifySignature(hashAlgorithm, message, { key, dsaEncoding: "der" }, signatureDer);
  } catch (cause) {
    throw new ChioInvariantError("invalid_signature", `value is not a valid ${curve} signature`, { cause });
  }
}
function verifyChioSignature(signedBytes, signature, publicKey) {
  const message = Buffer.isBuffer(signedBytes) ? signedBytes : Buffer.from(signedBytes, "utf8");
  if (signature.startsWith("p256:")) {
    return verifyEcdsaSignature(message, publicKey, signature.slice("p256:".length), "P-256");
  }
  if (signature.startsWith("p384:")) {
    return verifyEcdsaSignature(message, publicKey, signature.slice("p384:".length), "P-384");
  }
  if (signature.startsWith("hybrid:")) {
    throw new ChioInvariantError("invalid_signature", "hybrid post-quantum signatures are not supported by this SDK build");
  }
  return verifyEd25519Signature(message, publicKey, signature);
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/receipt.js
function safeVerifyReceiptSignature(signedBytes, signature, publicKey) {
  try {
    return verifyChioSignature(signedBytes, signature, publicKey);
  } catch (error) {
    if (error instanceof ChioInvariantError) {
      return false;
    }
    throw error;
  }
}
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
function contentAddressedReceiptId(receipt) {
  return sha256Hex(canonicalizeJson(receiptIdInput(receipt)));
}
function receiptSigningBodyCanonicalJson(receipt) {
  return canonicalizeJson({
    id: receipt.id,
    body: receiptIdInput(receipt)
  });
}
function receiptSemantics(receipt) {
  return { receipt_kind: receipt.receipt_kind, boundary_class: receipt.boundary_class };
}
function resultLabel(receiptKind, boundaryClass, decision) {
  if (receiptKind === "mediated_decision" && boundaryClass === "prevent" && decision === "allow") {
    return "Authorized";
  }
  if (receiptKind === "trace_observation") {
    return "Observed";
  }
  if (receiptKind === "advisory_evaluation") {
    return "Advisory";
  }
  switch (decision) {
    case "allow":
      return "Allowed";
    case "deny":
      return "Denied";
    case "cancelled":
      return "Cancelled";
    case "incomplete":
      return "Incomplete";
    case "none":
      return "Invalid";
  }
}
function validObservationOutcome(value) {
  return value === "observed" || value === "evaluated" || value === "dropped";
}
function semanticallySignable(receipt, decision) {
  if (receipt.receipt_kind === "mediated_decision") {
    return receipt.boundary_class === "prevent" && receipt.trust_level === "mediated" && decision !== "none" && receipt.observation_outcome === void 0;
  }
  if (receipt.receipt_kind === "trace_observation") {
    return receipt.boundary_class === "detect_only" && receipt.trust_level === "verified" && decision === "none" && validObservationOutcome(receipt.observation_outcome);
  }
  if (receipt.receipt_kind === "advisory_evaluation") {
    return receipt.boundary_class === "advisory_only" && receipt.trust_level === "advisory" && decision === "none" && validObservationOutcome(receipt.observation_outcome);
  }
  return false;
}
function verifyReceipt(receipt, trustedSigners = []) {
  const signingBodyCanonicalJson = receiptSigningBodyCanonicalJson(receipt);
  const parameterCanonicalJson = canonicalizeJson(receipt.action.parameters);
  const decision = receipt.decision?.verdict ?? "none";
  const semantics = receiptSemantics(receipt);
  const semanticAuthorized = semantics.receipt_kind === "mediated_decision" && semantics.boundary_class === "prevent" && decision === "allow";
  const signerTrusted = trustedSigners.length > 0 && trustedSigners.some((signer) => publicKeyHexMatches(signer, receipt.kernel_key));
  const receiptIdValid = receipt.id === contentAddressedReceiptId(receipt);
  const signatureValid = receiptIdValid && semanticallySignable(receipt, decision) && safeVerifyReceiptSignature(signingBodyCanonicalJson, receipt.signature, receipt.kernel_key);
  const parameterHashValid = receipt.action.parameter_hash === sha256Hex(parameterCanonicalJson);
  const authorized = semanticAuthorized && signatureValid && parameterHashValid && receiptIdValid && signerTrusted;
  return {
    signature_valid: signatureValid,
    parameter_hash_valid: parameterHashValid,
    receipt_id_valid: receiptIdValid,
    decision,
    receipt_kind: semantics.receipt_kind,
    boundary_class: semantics.boundary_class,
    trust_level: receipt.trust_level,
    result: resultLabel(semantics.receipt_kind, semantics.boundary_class, decision),
    authorized,
    signer_key_hex: receipt.kernel_key,
    signer_trusted: signerTrusted,
    ok: signatureValid && parameterHashValid && receiptIdValid && signerTrusted
  };
}
function verifyReceiptWithTrustedSigners(receipt, trustedSigners) {
  return verifyReceipt(receipt, trustedSigners);
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/manifest.js
var REQUIRED_PERMISSION_FIELDS = [
  "read_paths",
  "write_paths",
  "network_hosts",
  "environment_variables"
];
var REQUIRED_PERMISSION_FIELD_SET = new Set(REQUIRED_PERMISSION_FIELDS);
var U64_MAX_EXCLUSIVE = 2 ** 64;

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/signing.js
function verifyUtf8MessageEd25519(input, publicKeyHex, signatureHex) {
  return verifyEd25519Signature(input, publicKeyHex, signatureHex);
}

// node_modules/@chio/bridge/dist/approval.js
function verifyApprovalToolCall(input, expected) {
  try {
    const params = input;
    const intent = params?._meta?.chioGovernedIntent;
    const token = params?._meta?.chioApprovalToken;
    const now = Math.floor(Date.now() / 1e3);
    if (params?.name !== expected.tool || canonicalizeJson(params.arguments) !== canonicalizeJson(expected.arguments) || params?._meta?.chioRequestId !== expected.requestId || intent?.server_id !== expected.serverId || intent.tool_name !== expected.tool || intent?.body?.kind !== "bound_tool_invocation" || intent.body.value?.capability_id !== expected.capabilityId || intent.body.value.parameters_hash !== "0x" + sha256Hex(canonicalizeJson(expected.arguments)) || intent.context?.mcpSessionId !== expected.sessionId || intent.context?.capabilityId !== expected.capabilityId || !token || !["approved", "denied"].includes(token.decision) || token.subject !== expected.subjectKey || token.request_id !== expected.requestId || typeof token.approver !== "string" || !expected.trustedSigners.some((key) => key.toLowerCase() === token.approver.toLowerCase()) || token.governed_intent_hash !== sha256Hex(canonicalizeJson(intent)) || typeof token.id !== "string" || !token.id || !Number.isSafeInteger(token.issued_at) || !Number.isSafeInteger(token.expires_at) || token.issued_at > now + 5 || token.expires_at <= now || token.expires_at <= token.issued_at || token.expires_at - token.issued_at > 3600 || token.algorithm !== void 0 || token.threshold_proposal_hash !== void 0)
      return void 0;
    const body = {
      id: token.id,
      approver: token.approver,
      subject: token.subject,
      governed_intent_hash: token.governed_intent_hash,
      request_id: token.request_id,
      issued_at: token.issued_at,
      expires_at: token.expires_at,
      decision: token.decision
    };
    if (!verifyUtf8MessageEd25519(canonicalizeJson(body), token.approver, token.signature))
      return void 0;
    return { decision: token.decision, params: JSON.parse(canonicalizeJson(params)) };
  } catch {
    return void 0;
  }
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/transport/messages.js
function rpcIdsEqual(left, right) {
  return left === right;
}
function parseJsonRpcMessage(input) {
  return JSON.parse(input);
}
function parseRpcMessages(rawBody) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const messages = [];
  let buffer = [];
  for (const line of rawBody.split(/\r?\n/)) {
    if (!line.trim()) {
      if (buffer.length > 0) {
        messages.push(parseJsonRpcMessage(buffer.join("\n")));
        buffer = [];
      }
      continue;
    }
    if (line.startsWith("data:")) {
      buffer.push(line.slice(5).trimStart());
    }
  }
  if (buffer.length > 0) {
    messages.push(parseJsonRpcMessage(buffer.join("\n")));
  }
  return messages;
}
function isTerminalMessage(message, expectedId) {
  return expectedId !== void 0 && rpcIdsEqual(message.id, expectedId) && !message.method;
}
async function readRpcMessagesUntilTerminal(response, expectedId, onMessage = async () => {
}) {
  if (!response.body) {
    const parsedMessages = parseRpcMessages(await response.text());
    const messages2 = [];
    for (const message of parsedMessages) {
      messages2.push(message);
      if (isTerminalMessage(message, expectedId)) {
        break;
      }
      await onMessage(message);
    }
    return messages2;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const messages = [];
  const eventData = [];
  let rawBody = "";
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      rawBody += decoder.decode();
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    rawBody += chunk;
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        if (eventData.length > 0) {
          const message = parseJsonRpcMessage(eventData.join("\n"));
          messages.push(message);
          if (isTerminalMessage(message, expectedId)) {
            await reader.cancel();
            return messages;
          }
          await onMessage(message);
          eventData.length = 0;
        }
        continue;
      }
      if (line.startsWith("data:")) {
        eventData.push(line.slice(5).trimStart());
      }
    }
  }
  if (buffer.trim()) {
    if (buffer.startsWith("data:")) {
      eventData.push(buffer.slice(5).trimStart());
    }
  }
  if (eventData.length > 0) {
    const message = parseJsonRpcMessage(eventData.join("\n"));
    messages.push(message);
    if (!isTerminalMessage(message, expectedId)) {
      await onMessage(message);
    }
  }
  if (messages.length === 0) {
    const parsedMessages = parseRpcMessages(rawBody);
    for (const message of parsedMessages) {
      messages.push(message);
      if (isTerminalMessage(message, expectedId)) {
        return messages;
      }
      await onMessage(message);
    }
  }
  return messages;
}
function terminalMessage(messages, expectedId) {
  const match = messages.find((message) => rpcIdsEqual(message.id, expectedId) && !message.method);
  if (!match) {
    throw new Error(`no terminal response for JSON-RPC id ${expectedId}`);
  }
  const error = match.error;
  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : `JSON-RPC error for id ${expectedId}`;
    throw new Error(message);
  }
  return match;
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/transport/session.js
function responseHeaders(response) {
  return Object.fromEntries(response.headers.entries());
}
function buildRpcHeaders(authToken, sessionId, protocolVersion) {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json"
  };
  if (sessionId) {
    headers["MCP-Session-Id"] = sessionId;
  }
  if (protocolVersion) {
    headers["MCP-Protocol-Version"] = protocolVersion;
  }
  return headers;
}
function buildSessionDeleteHeaders(authToken, sessionId) {
  return {
    Authorization: `Bearer ${authToken}`,
    "MCP-Session-Id": sessionId
  };
}
async function postRpc(baseUrl, authToken, sessionId, protocolVersion, body, onMessage = async () => {
}, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/mcp`, {
    method: "POST",
    headers: buildRpcHeaders(authToken, sessionId, protocolVersion),
    body: JSON.stringify(body)
  });
  return {
    request: body,
    status: response.status,
    headers: responseHeaders(response),
    messages: await readRpcMessagesUntilTerminal(response, body.id, onMessage)
  };
}
async function postNotification(baseUrl, authToken, sessionId, protocolVersion, body, onMessage = async () => {
}, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/mcp`, {
    method: "POST",
    headers: buildRpcHeaders(authToken, sessionId, protocolVersion),
    body: JSON.stringify(body)
  });
  return {
    request: body,
    status: response.status,
    headers: responseHeaders(response),
    messages: await readRpcMessagesUntilTerminal(response, void 0, onMessage)
  };
}
async function deleteSession(baseUrl, authToken, sessionId, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/mcp`, {
    method: "DELETE",
    headers: buildSessionDeleteHeaders(authToken, sessionId)
  });
  return {
    status: response.status,
    headers: responseHeaders(response)
  };
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/types.js
function isJsonRpcFailure(message) {
  return "error" in message;
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/session/session.js
var ChioSession = class {
  authToken;
  baseUrl;
  handshake;
  protocolVersion;
  sessionId;
  #fetchImpl;
  #nextRequestId;
  #onMessage;
  constructor(options) {
    this.authToken = options.authToken;
    this.baseUrl = options.baseUrl;
    this.handshake = options.handshake ?? null;
    this.protocolVersion = options.protocolVersion;
    this.sessionId = options.sessionId;
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#nextRequestId = 2;
    this.#onMessage = options.onMessage ?? (async () => {
    });
  }
  setMessageHandler(onMessage) {
    this.#onMessage = onMessage;
  }
  async request(method, params, onMessage = this.#onMessage) {
    const request = {
      jsonrpc: "2.0",
      id: this.#nextId(),
      method
    };
    if (params !== void 0) {
      request.params = params;
    }
    return postRpc(this.baseUrl, this.authToken, this.sessionId, this.protocolVersion, request, onMessage, this.#fetchImpl);
  }
  async sendEnvelope(body, onMessage = this.#onMessage) {
    return postRpc(this.baseUrl, this.authToken, this.sessionId, this.protocolVersion, body, onMessage, this.#fetchImpl);
  }
  async requestResult(method, params, onMessage = this.#onMessage) {
    const exchange = await this.request(method, params, onMessage);
    return terminalMessage(exchange.messages, exchange.request.id);
  }
  async notification(method, params, onMessage = this.#onMessage) {
    const notification = {
      jsonrpc: "2.0",
      method
    };
    if (params !== void 0) {
      notification.params = params;
    }
    return postNotification(this.baseUrl, this.authToken, this.sessionId, this.protocolVersion, notification, onMessage, this.#fetchImpl);
  }
  async listTools(params = {}) {
    return this.#result("tools/list", params);
  }
  async callTool(name, args = {}) {
    return this.#result("tools/call", {
      name,
      arguments: args
    });
  }
  async listResources(params = {}) {
    return this.#result("resources/list", params);
  }
  async readResource(uri) {
    return this.#result("resources/read", { uri });
  }
  async subscribeResource(uri) {
    return this.#result("resources/subscribe", { uri });
  }
  async unsubscribeResource(uri) {
    return this.#result("resources/unsubscribe", { uri });
  }
  async listResourceTemplates(params = {}) {
    return this.#result("resources/templates/list", params);
  }
  async listPrompts(params = {}) {
    return this.#result("prompts/list", params);
  }
  async getPrompt(name, args) {
    const params = { name };
    if (args) {
      params.arguments = args;
    }
    return this.#result("prompts/get", params);
  }
  async complete(params) {
    return this.#result("completion/complete", params);
  }
  async setLogLevel(level) {
    return this.notification("logging/setLevel", { level });
  }
  async listTasks(params = {}) {
    return this.#result("tasks/list", params);
  }
  async getTask(taskId) {
    return this.#result("tasks/get", { taskId });
  }
  async getTaskResult(taskId) {
    return this.#result("tasks/result", { taskId });
  }
  async cancelTask(taskId) {
    return this.#result("tasks/cancel", { taskId });
  }
  async close() {
    return deleteSession(this.baseUrl, this.authToken, this.sessionId, this.#fetchImpl);
  }
  #nextId() {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return id;
  }
  async #result(method, params) {
    const response = await this.requestResult(method, params);
    if (isJsonRpcFailure(response)) {
      throw new Error(response.error.message);
    }
    return response.result;
  }
};

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/finding.js
var BPS = 10000n;
var BPS_DENOMINATOR = BPS * BPS * BPS;

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/cognition_market.js
var PURCHASE_DOMAIN = Buffer.from("chio.finding.public-purchase-request.v1\0", "utf8");
var VERIFIED_FIX_SUBMISSION_DOMAIN = Buffer.from("chio.finding.verified-fix-submission-id.v1\0", "utf8");
var VOLUNTARY_RETRACTION_DOMAIN = Buffer.from("chio.finding.voluntary-retraction-request-id.v1\0", "utf8");
var PROOF_RESPONSE_MAX_BYTES = 24 * 1024 * 1024;
var PURCHASE_RESULT_MAX_BYTES = 16 * 1024 * 1024;
var JSON_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;

// node_modules/@chio/bridge/dist/errors.js
var ChioBridgeError = class extends Error {
  code;
  detail;
  constructor(code, message, detail) {
    super(message);
    this.name = "ChioBridgeError";
    this.code = code;
    this.detail = detail;
  }
};

// node_modules/@chio/bridge/dist/execution.js
function validateContext(authority, config, requiredTools) {
  const denied = () => ({ ok: false, reason: "authenticated session credential does not match the retained caller, capability, resource owner, tool scope or lifetime" });
  const binding = authority?.sessionCredential;
  const now = Math.floor(Date.now() / 1e3);
  if (authority?.schema !== "chio.mcp.execution-context.v1" || authority.evidenceVersion !== "1" || authority.deliveryAcknowledgementVersion !== "1" || authority.subjectKey !== config.subjectKey || authority.serverId !== config.serverId || !Array.isArray(authority.capabilityIds) || authority.capabilityIds.length !== 1 || authority.capabilityIds[0] !== config.capabilityId || binding?.schema !== "chio.mcp.session-credential.v1" || binding.sessionId !== config.sessionId || binding.subjectKey !== config.subjectKey || binding.serverId !== config.serverId || binding.endpointPath !== "/mcp" || !Array.isArray(binding.capabilityIds) || binding.capabilityIds.length !== 1 || binding.capabilityIds[0] !== config.capabilityId || !Array.isArray(binding.allowedTools) || !binding.allowedTools.length || binding.allowedTools.some((name) => typeof name !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(name)) || new Set(binding.allowedTools).size !== binding.allowedTools.length || !Number.isSafeInteger(binding.issuedAt) || binding.issuedAt > now + 5 || !Number.isSafeInteger(binding.expiresAt) || binding.expiresAt <= now || binding.expiresAt <= binding.issuedAt || binding.expiresAt - binding.issuedAt > 3600)
    return denied();
  if (requiredTools && (requiredTools.length !== binding.allowedTools.length || [...requiredTools].sort().some((name, index) => name !== [...binding.allowedTools].sort()[index])))
    return denied();
  return { ok: true, sessionCredential: JSON.parse(JSON.stringify(binding)) };
}
function verifyBoundReceipt(input, expected) {
  try {
    if (!input || typeof input !== "object" || !expected.trustedSigners.length)
      return false;
    const receipt = input;
    const verification = verifyReceiptWithTrustedSigners(receipt, expected.trustedSigners);
    const metadata = receipt.metadata;
    return verification.ok && receipt.receipt_kind === "mediated_decision" && receipt.boundary_class === "prevent" && receipt.trust_level === "mediated" && receipt.capability_id === expected.capabilityId && receipt.tool_server === expected.serverId && receipt.tool_name === expected.tool && metadata?.receipt_context?.request_id === expected.requestId && metadata?.attribution?.subject_key === expected.subjectKey && canonicalizeJson(receipt.action.parameters) === canonicalizeJson(expected.parameters);
  } catch {
    return false;
  }
}
function verifyReceivedOutcome(outcome, expected) {
  try {
    const receipt = outcome.receipt;
    const delivery = outcome.delivery;
    if (outcome.state !== "completed" || outcome.evidence !== "verified" || !receipt || !delivery || outcome.requestId !== expected.requestId || !verifyBoundReceipt(receipt, expected))
      return false;
    const admission = receipt.metadata?.admission_operation;
    return receipt.decision?.verdict === "allow" && admission?.schema === "chio.admission-receipt.v1" && admission.request_id === expected.requestId && admission.projected_state === "completed" && admission.projected_dispatch_state === "terminal" && typeof admission.tool_outcome_id === "string" && outcome.result !== void 0 && receipt.content_hash === sha256Hex(canonicalizeJson(outcome.result)) && delivery.schema === "chio.mcp.delivery-ack.v1" && delivery.requestId === expected.requestId && delivery.receiptId === receipt.id && delivery.resultHash === receipt.content_hash && /^[a-f0-9]{64}$/.test(delivery.requestHash) && typeof delivery.acknowledgement === "string" && /^[A-Za-z0-9_-]{43}$/.test(delivery.acknowledgement);
  } catch {
    return false;
  }
}
function verifyCompletedOutcome(outcome, config, request) {
  try {
    const params = { name: request.tool, arguments: request.arguments, _meta: { chioRequestId: request.requestId, ...request.approval } };
    return verifyReceivedOutcome(outcome, { ...config, tool: request.tool, parameters: request.arguments, requestId: request.requestId }) && outcome.delivery.requestHash === sha256Hex(canonicalizeJson({ method: "tools/call", params }));
  } catch {
    return false;
  }
}
function createMcpExecutionClient(options) {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))) {
    throw new ChioBridgeError("invalid_arg", "MCP endpoint requires HTTPS or loopback HTTP");
  }
  if (endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
    throw new ChioBridgeError("invalid_arg", "MCP endpoint must not contain credentials, query or fragment");
  }
  if (!options.sessionId || !options.bearerToken || !options.capabilityId || !options.serverId || !/^[a-f0-9]{64}$/i.test(options.subjectKey) || !options.trustedSigners.length || options.trustedSigners.some((key) => !/^[a-f0-9]{64}$/i.test(key))) {
    throw new ChioBridgeError("invalid_arg", "execution requires a retained session, delegated bearer, capability, server, subject and pinned signer keys");
  }
  const timeoutMs = options.timeoutMs ?? 3e4;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new ChioBridgeError("invalid_arg", "invalid execution timeout");
  const config = { ...options, trustedSigners: [...options.trustedSigners] };
  const operations = /* @__PURE__ */ new Map();
  return {
    /** Run in the trusted launcher before making credentials readable to an agent. */
    async validateSession(control = {}) {
      const deadline = AbortSignal.timeout(timeoutMs);
      const signal = control.signal ? AbortSignal.any([deadline, control.signal]) : deadline;
      const fetchImpl = (input, init) => (config.fetchImpl ?? fetch)(input, { ...init, signal, redirect: "error" });
      try {
        const session = new ChioSession({ baseUrl: config.endpoint, authToken: config.bearerToken, sessionId: config.sessionId, protocolVersion: "2025-11-25", fetchImpl });
        const response = await session.requestResult("chio/execution-context");
        return validateContext("result" in response ? response.result : void 0, config, control.allowedTools);
      } catch {
        return { ok: false, reason: "delegated session validation failed before dispatch" };
      }
    },
    /** The durable owner must save the verified outcome before invoking this method. */
    async acknowledge(outcome) {
      const delivery = outcome?.delivery;
      const receipt = outcome?.receipt;
      try {
        if (outcome.state !== "completed" || outcome.evidence !== "verified" || !delivery || !receipt || delivery.schema !== "chio.mcp.delivery-ack.v1" || delivery.requestId !== outcome.requestId || delivery.receiptId !== receipt.id || delivery.resultHash !== receipt.content_hash || delivery.resultHash !== sha256Hex(canonicalizeJson(outcome.result)) || !verifyBoundReceipt(receipt, { ...config, tool: receipt.tool_name, parameters: receipt.action.parameters, requestId: outcome.requestId })) {
          return { acknowledged: false, reason: "only an exact verified completed result can be acknowledged" };
        }
      } catch {
        return { acknowledged: false, reason: "malformed durable outcome cannot be acknowledged" };
      }
      const signal = AbortSignal.timeout(timeoutMs);
      const fetchImpl = (input, init) => (config.fetchImpl ?? fetch)(input, { ...init, signal, redirect: "error" });
      try {
        const session = new ChioSession({ baseUrl: config.endpoint, authToken: config.bearerToken, sessionId: config.sessionId, protocolVersion: "2025-11-25", fetchImpl });
        const response = await session.requestResult("chio/acknowledge", delivery);
        const result = "result" in response ? response.result : void 0;
        if (result?.schema !== delivery.schema || result.requestId !== delivery.requestId || result.receiptId !== delivery.receiptId || result.acknowledged !== true)
          throw new Error("invalid acknowledgement response");
        return { acknowledged: true, requestId: delivery.requestId, receiptId: delivery.receiptId };
      } catch {
        return { acknowledged: false, reason: "acknowledgement not confirmed; retain durable result and retry only acknowledgement" };
      }
    },
    execute(request, control = {}) {
      if (!request.requestId || request.requestId.length > 2048 || !request.tool || !request.arguments || typeof request.arguments !== "object" || Array.isArray(request.arguments)) {
        return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: request.requestId, reason: "invalid execution request" });
      }
      let snapshot;
      let digest;
      try {
        snapshot = JSON.parse(canonicalizeJson(request));
        digest = sha256Hex(canonicalizeJson({ tool: snapshot.tool, arguments: snapshot.arguments, ...snapshot.approval ? { approval: snapshot.approval } : {} }));
      } catch {
        return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: request.requestId, reason: "request is not canonical JSON" });
      }
      const prior = operations.get(snapshot.requestId);
      if (prior) {
        if (prior.digest !== digest)
          return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: snapshot.requestId, reason: "request ID reused with different arguments" });
        return prior.outcome;
      }
      const outcome = dispatch(snapshot, control.signal);
      operations.set(snapshot.requestId, { digest, outcome });
      return outcome;
    }
  };
  async function dispatch(request, signal) {
    let sent = false;
    const failure = (reason) => ({
      state: sent ? "unknown" : "not_dispatched",
      evidence: "unverified",
      requestId: request.requestId,
      reason
    });
    if (signal?.aborted)
      return failure("cancelled before admission");
    const deadline = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const fetchImpl = (input, init) => (config.fetchImpl ?? fetch)(input, { ...init, signal: combined, redirect: "error" });
    let session;
    try {
      session = new ChioSession({
        baseUrl: config.endpoint,
        authToken: config.bearerToken,
        sessionId: config.sessionId,
        protocolVersion: "2025-11-25",
        fetchImpl
      });
      const context = await session.requestResult("chio/execution-context");
      const authority = validateContext("result" in context ? context.result : void 0, config);
      if (!authority.ok)
        return failure(authority.reason);
      if (!authority.sessionCredential.allowedTools.includes(request.tool))
        return failure("tool is outside the authenticated session credential scope");
      const params = { name: request.tool, arguments: request.arguments, _meta: { chioRequestId: request.requestId, ...request.approval } };
      if (request.approval && verifyApprovalToolCall(params, { ...config, sessionId: config.sessionId, tool: request.tool, arguments: request.arguments, requestId: request.requestId })?.decision !== "approved")
        return failure("approval does not authorize the exact retained action");
      if (combined.aborted)
        return failure("cancelled before dispatch");
      sent = true;
      const response = await session.requestResult("tools/call", params);
      if (!("result" in response))
        return failure("kernel RPC error after dispatch; reconcile the resource before retry");
      const result = response.result;
      const envelope = result?._meta?.chioEvidence;
      if (envelope?.schema !== "chio.mcp.execution-evidence.v1" || envelope.requestId !== request.requestId)
        return failure("missing or substituted execution evidence");
      if (!verifyBoundReceipt(envelope.receipt, { ...config, tool: request.tool, parameters: request.arguments, requestId: request.requestId }))
        return failure("execution receipt failed trusted request verification");
      const receipt = envelope.receipt;
      if (receipt.decision?.verdict === "deny") {
        if (receipt.decision.guard === "kernel" && receipt.decision.reason?.startsWith("durable admission failed:")) {
          return {
            state: "unknown",
            evidence: "verified",
            requestId: request.requestId,
            receipt,
            reason: "durable admission rejected this attempt; the original operation requires reconciliation"
          };
        }
        return { state: "denied", evidence: "verified", requestId: request.requestId, receipt, reason: receipt.decision.reason };
      }
      const admission = receipt.metadata?.admission_operation;
      if (receipt.decision?.verdict !== "allow" || admission?.schema !== "chio.admission-receipt.v1" || admission.request_id !== request.requestId || admission.projected_state !== "completed" || admission.projected_dispatch_state !== "terminal" || typeof admission.tool_outcome_id !== "string" || envelope.terminalState !== "completed" || envelope.outputKind !== "value" || envelope.output === void 0 || receipt.content_hash !== sha256Hex(canonicalizeJson(envelope.output))) {
        return { state: "unknown", evidence: "verified", requestId: request.requestId, receipt, reason: "no verified completed result; preserve the operation fence" };
      }
      const delivery = result?._meta?.chioDelivery;
      if (!delivery || delivery.schema !== "chio.mcp.delivery-ack.v1" || delivery.requestId !== request.requestId || delivery.receiptId !== receipt.id || delivery.resultHash !== receipt.content_hash || delivery.requestHash !== sha256Hex(canonicalizeJson({ method: "tools/call", params })) || typeof delivery.acknowledgement !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(delivery.acknowledgement)) {
        return { state: "unknown", evidence: "verified", requestId: request.requestId, receipt, reason: "verified result lacks exact retained delivery acknowledgement; preserve operation fence" };
      }
      return { state: "completed", evidence: "verified", requestId: request.requestId, receipt, result: envelope.output, delivery };
    } catch {
      return failure(sent ? "execution outcome unknown; no automatic retry" : "kernel unavailable or malformed handshake before dispatch");
    }
  }
}

// node_modules/@chio/bridge/dist/gateway.js
function operationKey(requestId) {
  return createHash2("sha256").update(requestId).digest("hex");
}
function gatewayApprovalPath(config, requestId) {
  return join(resolve(config.journalDir), "approvals", `${operationKey(requestId)}.json`);
}
function gatewayBinding(config) {
  return canonicalizeJson({
    sessionId: config.sessionId,
    kernelSessionId: config.execution.sessionId,
    endpoint: config.execution.endpoint,
    subjectKey: config.execution.subjectKey,
    capabilityId: config.execution.capabilityId,
    serverId: config.execution.serverId,
    trustedSigners: config.execution.trustedSigners,
    tools: config.tools,
    ...config.approval ? { approval: config.approval } : {}
  });
}
function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function privatePath(path, directory) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (stat.mode & 63) !== 0) {
    throw new Error("operator config and journal must be private regular paths");
  }
}
function readGatewayConfig(path) {
  privatePath(path, false);
  if (lstatSync(path).size > 1024 * 1024)
    throw new Error("gateway config exceeds size limit");
  const config = JSON.parse(readFileSync(path, "utf8"));
  if (!config?.execution?.sessionId || !config.sessionId || !config.journalDir || !Array.isArray(config.tools) || !config.tools.length) {
    throw new Error("gateway requires an operator-established kernel session, journal and explicit tools");
  }
  if (config.execution.fetchImpl !== void 0)
    throw new Error("config cannot provide executable transport");
  const names = /* @__PURE__ */ new Set();
  for (const tool of config.tools) {
    if (!tool || typeof tool.name !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name) || names.has(tool.name) || !tool.inputSchema || typeof tool.inputSchema !== "object" || Array.isArray(tool.inputSchema))
      throw new Error("invalid or duplicate operator tool");
    names.add(tool.name);
  }
  if (config.approval && (!Array.isArray(config.approval.requiredTools) || !config.approval.requiredTools.length || config.approval.requiredTools.some((name) => !names.has(name)) || !config.approval.purpose || !Number.isSafeInteger(config.approval.ttlSeconds) || config.approval.ttlSeconds < 1 || config.approval.ttlSeconds > 3600))
    throw new Error("invalid approval configuration");
  if (names.has("chio_resume"))
    throw new Error("chio_resume is reserved for explicit gateway resumption");
  return config;
}
function createGateway(config, executor = createMcpExecutionClient(config.execution), delivery = {}) {
  const snapshot = JSON.parse(JSON.stringify(config));
  const directory = resolve(snapshot.journalDir);
  mkdirSync(directory, { recursive: true, mode: 448 });
  privatePath(directory, true);
  if (readdirSync(directory).includes("recovery.lock"))
    throw new Error("operator recovery is active");
  const lockPath = join(directory, "gateway.lock");
  const lock = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, hostname: hostname(), sessionId: snapshot.sessionId }));
  fsyncSync(lock);
  closeSync(lock);
  syncDirectory(directory);
  const binding = gatewayBinding(snapshot);
  const bindingPath = join(directory, "authority.binding");
  if (readdirSync(directory).includes("authority.binding")) {
    privatePath(bindingPath, false);
    if (readFileSync(bindingPath, "utf8") !== binding)
      throw new Error("journal belongs to a different authority or configuration");
  } else {
    if (readdirSync(directory).some((name) => name.endsWith(".json")))
      throw new Error("operation journal is missing its authority binding");
    const fd = openSync(bindingPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
    try {
      writeFileSync(fd, binding);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    syncDirectory(directory);
  }
  const records = /* @__PURE__ */ new Map();
  for (const filename of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    const path = join(directory, filename);
    privatePath(path, false);
    const record = JSON.parse(readFileSync(path, "utf8"));
    if (!record.requestId || !record.digest || !["awaiting_approval", "pending", "not_dispatched", "unknown", "denied", "completed"].includes(record.state))
      throw new Error("invalid operation journal");
    if (record.state !== "pending" && (!record.outcome || record.outcome.state !== record.state || record.outcome.requestId !== record.requestId))
      throw new Error("inconsistent operation journal result");
    if (record.state === "awaiting_approval" && (!record.proposal || record.proposal.request_id !== record.requestId))
      throw new Error("missing approval proposal");
    if (record.state === "completed" && (!record.request || !record.outcome || record.requestId !== record.request.requestId || record.digest !== operationKey(canonicalizeJson({ name: record.request.tool, args: record.request.arguments })) || !verifyCompletedOutcome(record.outcome, snapshot.execution, record.request))) {
      throw new Error("cached completion does not bind a trusted original request and result");
    }
    if (records.has(record.requestId))
      throw new Error("duplicate operation journal identity");
    records.set(record.requestId, record);
  }
  let closed = false;
  let busy = false;
  const tools = new Map(snapshot.tools.map((tool) => [tool.name, tool]));
  const fenced = () => [...records.values()].some((record) => record.state !== "not_dispatched" && !(record.state === "completed" && record.acknowledged === true && (!delivery.requireHostAcknowledgement || record.hostDeliveryConfirmed === true)));
  function persist(record) {
    const key = operationKey(record.requestId);
    const path = join(directory, `${key}.json`);
    const temp = join(directory, `${key}.${process.pid}.tmp`);
    const fd = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
    try {
      writeFileSync(fd, JSON.stringify(record));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temp, path);
    syncDirectory(directory);
    records.set(record.requestId, record);
  }
  async function confirmDelivery(record) {
    const outcome = record.outcome;
    if (outcome.state === "completed" && !record.acknowledged && executor.acknowledge && (!delivery.requireHostAcknowledgement || record.hostDeliveryConfirmed === true)) {
      const acknowledgement = await executor.acknowledge(outcome);
      if (acknowledgement.acknowledged)
        persist({ ...record, acknowledged: true });
    }
    return outcome;
  }
  async function dispatch(record, request, signal) {
    busy = true;
    try {
      persist({ ...record, state: "pending", outcome: void 0, request });
      let outcome = await executor.execute(request, signal ? { signal } : {});
      if (outcome.state === "completed" && !verifyCompletedOutcome(outcome, snapshot.execution, request)) {
        outcome = { state: "unknown", evidence: "unverified", requestId: request.requestId, reason: "completed result failed durable request verification" };
      }
      const completed = { ...record, state: outcome.state, outcome, acknowledged: false, hostDeliveryRequired: delivery.requireHostAcknowledgement === true, request };
      persist(completed);
      return await confirmDelivery(completed);
    } catch {
      return { state: "unknown", evidence: "unverified", requestId: record.requestId, reason: "dispatch or persistence interrupted; no automatic retry" };
    } finally {
      busy = false;
    }
  }
  const resumeTool = { name: "chio_resume", description: "Explicitly resume one exact operator-approved proposal, retaining its original request identity. Never retries an unknown effect.", inputSchema: { type: "object", properties: { requestId: { type: "string" }, tool: { type: "string" }, arguments: { type: "object" } }, required: ["requestId", "tool", "arguments"], additionalProperties: false } };
  return {
    /** Trusted launcher observed this exact result in native host history. */
    async acknowledgeReceivedOutcome(input) {
      try {
        const outcome = input;
        const record = records.get(outcome?.requestId);
        if (!record?.request || !verifyCompletedOutcome(outcome, snapshot.execution, record.request))
          throw new Error("host result differs from retained request or signed output");
        return await this.acknowledgeDelivery(outcome.delivery);
      } catch {
        return { acknowledged: false, reason: "host-received result is not the exact verified terminal outcome" };
      }
    },
    /** Proof of receiving the exact retained result. This never dispatches a tool. */
    async acknowledgeDelivery(proof) {
      try {
        const requestId = proof?.requestId;
        if (closed || typeof requestId !== "string")
          throw new Error("invalid delivery proof");
        const record = records.get(requestId);
        if (!record || record.state !== "completed" || !record.request || record.outcome?.state !== "completed" || !verifyCompletedOutcome(record.outcome, snapshot.execution, record.request) || canonicalizeJson(proof) !== canonicalizeJson(record.outcome.delivery))
          throw new Error("delivery proof does not match retained outcome");
        const confirmed = { ...record, hostDeliveryConfirmed: true };
        persist(confirmed);
        await confirmDelivery(confirmed);
        if (!records.get(requestId)?.acknowledged)
          throw new Error("kernel acknowledgement not confirmed");
        return { acknowledged: true, requestId, receiptId: record.outcome.receipt.id };
      } catch {
        return { acknowledged: false, reason: "host delivery proof or kernel acknowledgement is unresolved; preserve the operation" };
      }
    },
    listTools: () => snapshot.approval ? [...snapshot.tools, resumeTool] : snapshot.tools,
    async call(id, name, args, signal) {
      const requestId = name === "chio_resume" ? String(args.requestId ?? "") : `${snapshot.sessionId}:${createHash2("sha256").update(canonicalizeJson({ id })).digest("hex")}`;
      const refused = (reason) => ({ state: "not_dispatched", evidence: "unverified", requestId, reason });
      if (closed || busy)
        return refused("gateway closed or another operation in flight");
      const resuming = name === "chio_resume";
      if (resuming && !snapshot.approval)
        return refused("explicit approval resumption is not configured");
      const tool = resuming ? String(args.tool ?? "") : name;
      const parameters = resuming ? args.arguments : args;
      if (!tools.has(tool) || !parameters || typeof parameters !== "object" || Array.isArray(parameters))
        return refused("tool or arguments are outside the operator allowlist");
      let digest;
      try {
        digest = operationKey(canonicalizeJson({ name: tool, args: parameters }));
      } catch {
        return refused("invalid canonical arguments");
      }
      const prior = records.get(requestId);
      if (prior) {
        if (prior.digest !== digest)
          return refused("operation identity conflicts with retained request");
        if (prior.state !== "awaiting_approval")
          return prior.outcome ? confirmDelivery(prior) : { state: "unknown", evidence: "unverified", requestId, reason: "interrupted dispatch requires resource reconciliation" };
        if (!resuming)
          return prior.outcome;
        if (signal?.aborted)
          return refused("cancelled before approval resumption");
        let approved;
        try {
          const path = gatewayApprovalPath(snapshot, requestId);
          privatePath(path, false);
          if (lstatSync(path).size > 1024 * 1024)
            throw new Error("oversized artifact");
          const artifact = JSON.parse(readFileSync(path, "utf8"));
          approved = verifyApprovalToolCall(artifact.toolCallParams, { ...snapshot.execution, sessionId: snapshot.execution.sessionId, tool, arguments: parameters, requestId });
        } catch {
        }
        if (!approved)
          return { ...prior.outcome, reason: "approval missing, expired, substituted or untrusted; proposal remains undispatched" };
        if (approved.decision === "denied") {
          const outcome = refused("operator denied the proposal before dispatch");
          persist({ ...prior, state: "not_dispatched", outcome });
          return outcome;
        }
        return dispatch(prior, { tool, arguments: parameters, requestId, approval: { chioGovernedIntent: approved.params._meta.chioGovernedIntent, chioApprovalToken: approved.params._meta.chioApprovalToken } }, signal);
      }
      if (resuming)
        return refused("no retained proposal matches this request");
      if (fenced())
        return refused("an unresolved operation fences this gateway; operator reconciliation required");
      if (signal?.aborted)
        return refused("cancelled before admission");
      if (snapshot.approval?.requiredTools.includes(tool)) {
        const proposal = { session_id: snapshot.execution.sessionId, capability_id: snapshot.execution.capabilityId, request_id: requestId, tool_name: tool, arguments: JSON.parse(canonicalizeJson(parameters)), purpose: snapshot.approval.purpose, ttl_seconds: snapshot.approval.ttlSeconds };
        const outcome = { state: "awaiting_approval", evidence: "unverified", requestId, proposal, reason: "proposal retained without dispatch; operator decision and explicit chio_resume are required" };
        persist({ requestId, digest, state: "awaiting_approval", proposal, outcome });
        return outcome;
      }
      return dispatch({ requestId, digest, state: "pending" }, { tool, arguments: parameters, requestId }, signal);
    },
    close() {
      if (!closed) {
        closed = true;
        unlinkSync(lockPath);
        syncDirectory(directory);
      }
    }
  };
}
function gatewayToolResult(outcome) {
  const toolError = "result" in outcome && outcome.result !== null && typeof outcome.result === "object" && outcome.result.isError === true;
  return {
    isError: outcome.state !== "completed" || toolError,
    content: [{ type: "text", text: JSON.stringify(outcome) }]
  };
}
async function main() {
  if (process.argv.length !== 3)
    throw new Error("usage: chio-mcp-gateway /absolute/operator-config.json");
  const configPath = process.argv[2];
  if (resolve(configPath) !== configPath)
    throw new Error("config path must be absolute");
  const gateway = createGateway(readGatewayConfig(configPath));
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const active = /* @__PURE__ */ new Map();
  let initialized = false;
  let queued = Promise.resolve();
  const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
  reader.on("line", (line) => {
    if (Buffer.byteLength(line) > 1024 * 1024) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "request exceeds size limit" } });
      return;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "invalid JSON" } });
      return;
    }
    if (message?.method === "notifications/cancelled") {
      active.get(JSON.stringify(message.params?.requestId))?.abort();
      return;
    }
    if (message?.method === "notifications/initialized") {
      initialized = true;
      return;
    }
    if (message?.id === void 0)
      return;
    const key = JSON.stringify(message.id);
    const controller = message.method === "tools/call" ? new AbortController() : void 0;
    if (controller) {
      if (active.has(key)) {
        send({ jsonrpc: "2.0", id: message.id, error: { code: -32600, message: "request ID is already in flight" } });
        return;
      }
      active.set(key, controller);
    }
    queued = queued.then(async () => {
      const error = (code, text) => send({ jsonrpc: "2.0", id: message.id, error: { code, message: text } });
      const result = (value) => send({ jsonrpc: "2.0", id: message.id, result: value });
      if (message.jsonrpc !== "2.0" || !["string", "number"].includes(typeof message.id)) {
        error(-32600, "invalid request");
        return;
      }
      if (message.method === "initialize") {
        result({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "chio-mcp-gateway", version: "0.3.0" } });
        return;
      }
      if (message.method === "ping") {
        result({});
        return;
      }
      if (!initialized) {
        error(-32600, "session not initialized");
        return;
      }
      if (message.method === "tools/list") {
        result({ tools: gateway.listTools() });
        return;
      }
      if (message.method !== "tools/call") {
        error(-32601, "unsupported method");
        return;
      }
      const args = message.params?.arguments;
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        error(-32602, "tool arguments must be an object");
        return;
      }
      const outcome = await gateway.call(message.id, message.params.name, args, controller?.signal);
      result(gatewayToolResult(outcome));
    }).catch(() => {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "gateway failed; no automatic retry" } });
    }).finally(() => {
      if (controller)
        active.delete(key);
    });
  });
  await new Promise((done) => reader.on("close", done));
  await queued;
  gateway.close();
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(() => {
    process.stderr.write("Chio gateway startup or persistence failed; protected tools unavailable.\n");
    process.exitCode = 1;
  });
}

// node_modules/@chio/bridge/dist/gateway-http.js
async function startGatewayHttp(config) {
  const executor = createMcpExecutionClient(config.execution);
  const validation = await executor.validateSession({ allowedTools: config.tools.map((tool) => tool.name) });
  if (!validation.ok)
    throw new Error(validation.reason);
  const gateway = createGateway(config, executor, { requireHostAcknowledgement: true });
  const token = randomBytes(32).toString("base64url");
  const session = randomBytes(32).toString("base64url");
  let initialized = false;
  let closed = false;
  let queued = Promise.resolve();
  let port = 0;
  const active = /* @__PURE__ */ new Map();
  const authorized = (value) => {
    const expected = Buffer.from(`Bearer ${token}`);
    const actual = Buffer.from(value ?? "");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  const json = (response, status, value) => {
    if (!response.destroyed)
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(value));
  };
  const server = createServer((request, response) => {
    void handle(request, response).catch(() => json(response, 500, { error: "gateway transport failed; retain original operation identity" }));
  });
  async function handle(request, response) {
    if (closed || request.url !== "/mcp" || request.headers.host !== `127.0.0.1:${port}` || request.headers.origin || !authorized(request.headers.authorization)) {
      json(response, 403, { error: "restricted transport" });
      return;
    }
    if (request.method !== "POST") {
      json(response, 405, { error: "only bounded MCP POST is supported" });
      return;
    }
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      json(response, 415, { error: "JSON required" });
      return;
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.length;
      if (length > 1024 * 1024) {
        json(response, 413, { error: "request too large" });
        return;
      }
      chunks.push(bytes);
    }
    let message;
    try {
      message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      json(response, 400, { error: "invalid JSON" });
      return;
    }
    if (!message || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      json(response, 400, { error: "invalid MCP request" });
      return;
    }
    const notification = message.id === void 0;
    if (!notification && !(typeof message.id === "string" || Number.isSafeInteger(message.id))) {
      json(response, 400, { error: "invalid request identity" });
      return;
    }
    const reply = (result) => json(response, 200, { jsonrpc: "2.0", id: message.id, result });
    const fail = (code, text) => json(response, 200, { jsonrpc: "2.0", id: message.id, error: { code, message: text } });
    if (message.method === "initialize") {
      if (notification || initialized || request.headers["mcp-session-id"]) {
        json(response, 409, { error: "transport already initialized or invalid initialize" });
        return;
      }
      initialized = true;
      response.setHeader("Mcp-Session-Id", session);
      const offered = message.params?.protocolVersion;
      reply({ protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"].includes(offered) ? offered : "2025-11-25", capabilities: { tools: {}, experimental: { chioDeliveryAcknowledgement: { version: "1" } } }, serverInfo: { name: "chio-protected-gateway", version: "0.3.0" } });
      return;
    }
    if (!initialized || request.headers["mcp-session-id"] !== session) {
      json(response, 403, { error: "exact transport session required" });
      return;
    }
    if (notification) {
      if (message.method === "notifications/cancelled")
        active.get(JSON.stringify(message.params?.requestId))?.abort();
      else if (message.method !== "notifications/initialized") {
        json(response, 403, { error: "unsupported notification" });
        return;
      }
      response.writeHead(202).end();
      return;
    }
    if (message.method === "ping") {
      reply({});
      return;
    }
    if (message.method === "chio/acknowledge") {
      const result = await gateway.acknowledgeDelivery(message.params);
      if (result.acknowledged)
        reply({ schema: "chio.mcp.delivery-ack.v1", ...result });
      else
        fail(-32603, result.reason);
      return;
    }
    if (message.method === "tools/list") {
      reply({ tools: gateway.listTools() });
      return;
    }
    if (message.method !== "tools/call") {
      fail(-32601, "unsupported method");
      return;
    }
    const args = message.params?.arguments;
    if (typeof message.params?.name !== "string" || !args || typeof args !== "object" || Array.isArray(args)) {
      fail(-32602, "invalid tool arguments");
      return;
    }
    const key = JSON.stringify(message.id);
    if (active.has(key)) {
      fail(-32600, "request already in flight");
      return;
    }
    const controller = new AbortController();
    active.set(key, controller);
    response.once("close", () => {
      if (!response.writableEnded)
        controller.abort();
    });
    queued = queued.then(async () => {
      if (closed) {
        fail(-32603, "transport closed before dispatch");
        return;
      }
      reply(gatewayToolResult(await gateway.call(`${session}:${JSON.stringify(message.id)}`, message.params.name, args, controller.signal)));
    }).catch(() => fail(-32603, "gateway failed; no automatic retry")).finally(() => {
      active.delete(key);
    });
    await queued;
  }
  try {
    await new Promise((resolve2, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve2);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("missing local transport address");
    port = address.port;
  } catch (error) {
    gateway.close();
    throw error;
  }
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    port,
    token,
    /** Call only with proof received from the real host's completed tool result. */
    acknowledgeDelivery: gateway.acknowledgeDelivery,
    /** Only call after observing the native host's tool result, before its next model turn. */
    acknowledgeReceivedOutcome: gateway.acknowledgeReceivedOutcome.bind(gateway),
    async close() {
      if (closed)
        return;
      closed = true;
      for (const controller of active.values())
        controller.abort();
      server.closeAllConnections();
      await new Promise((resolve2) => server.close(() => resolve2()));
      await queued;
      gateway.close();
    }
  };
}
export {
  startGatewayHttp
};
