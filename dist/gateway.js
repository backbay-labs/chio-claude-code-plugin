#!/usr/bin/env node
import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// node_modules/@chio/bridge/dist/gateway.js
import { createHash as createHash2 } from "node:crypto";
import { constants, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
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

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/auth/static.js
function staticBearerAuth(authToken) {
  return { authToken };
}

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/client/client.js
var ChioClient = class _ChioClient {
  authToken;
  baseUrl;
  #fetchImpl;
  constructor(options) {
    this.authToken = options.authToken;
    this.baseUrl = options.baseUrl;
    this.#fetchImpl = options.fetchImpl ?? fetch;
  }
  static withStaticBearer(baseUrl, authToken, fetchImpl) {
    const options = {
      baseUrl,
      ...staticBearerAuth(authToken)
    };
    if (fetchImpl !== void 0) {
      options.fetchImpl = fetchImpl;
    }
    return new _ChioClient(options);
  }
  async initialize(options = {}) {
    const initializeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: options.protocolVersion ?? "2025-11-25",
        capabilities: options.capabilities ?? {},
        clientInfo: options.clientInfo ?? {
          name: "@chio-protocol/sdk",
          version: "0.1.1-rc.1"
        }
      }
    };
    const initializeResponse = await postRpc(this.baseUrl, this.authToken, null, null, initializeRequest, async () => {
    }, this.#fetchImpl);
    const initializeMessage = terminalMessage(initializeResponse.messages, initializeRequest.id);
    if (initializeResponse.status !== 200) {
      throw new Error(`initialize returned HTTP ${initializeResponse.status}`);
    }
    const sessionId = initializeResponse.headers["mcp-session-id"];
    if (!sessionId) {
      throw new Error("initialize response did not include MCP-Session-Id");
    }
    const initializeResult = initializeMessage.result;
    const protocolVersion = initializeResult && typeof initializeResult === "object" && "protocolVersion" in initializeResult ? initializeResult.protocolVersion : void 0;
    if (typeof protocolVersion !== "string" || protocolVersion.length === 0) {
      throw new Error("initialize response did not include protocolVersion");
    }
    const session = new ChioSession({
      authToken: this.authToken,
      baseUrl: this.baseUrl,
      handshake: null,
      sessionId,
      protocolVersion,
      fetchImpl: this.#fetchImpl
    });
    if (options.onMessage) {
      session.setMessageHandler(async (message) => {
        await options.onMessage?.(message, session);
      });
    }
    const initializedResponse = await session.notification("notifications/initialized", void 0, async (message) => {
      if (options.onMessage) {
        await options.onMessage(message, session);
      }
    });
    if (![200, 202].includes(initializedResponse.status)) {
      throw new Error(`notifications/initialized returned HTTP ${initializedResponse.status}`);
    }
    session.handshake = {
      initializeResponse,
      initializedResponse
    };
    return session;
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
function createMcpExecutionClient(options) {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))) {
    throw new ChioBridgeError("invalid_arg", "MCP endpoint requires HTTPS or loopback HTTP");
  }
  if (endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
    throw new ChioBridgeError("invalid_arg", "MCP endpoint must not contain credentials, query or fragment");
  }
  if (!options.bearerToken || !options.capabilityId || !options.serverId || !/^[a-f0-9]{64}$/i.test(options.subjectKey) || !options.trustedSigners.length || options.trustedSigners.some((key) => !/^[a-f0-9]{64}$/i.test(key))) {
    throw new ChioBridgeError("invalid_arg", "execution requires bearer, capability, server, subject and pinned signer keys");
  }
  const timeoutMs = options.timeoutMs ?? 3e4;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new ChioBridgeError("invalid_arg", "invalid execution timeout");
  const config = { ...options, trustedSigners: [...options.trustedSigners] };
  const operations = /* @__PURE__ */ new Map();
  return {
    execute(request, control = {}) {
      if (!request.requestId || request.requestId.length > 2048 || !request.tool || !request.arguments || typeof request.arguments !== "object" || Array.isArray(request.arguments)) {
        return Promise.resolve({ state: "not_dispatched", evidence: "unverified", requestId: request.requestId, reason: "invalid execution request" });
      }
      let snapshot;
      let digest;
      try {
        snapshot = JSON.parse(canonicalizeJson(request));
        digest = sha256Hex(canonicalizeJson({ tool: snapshot.tool, arguments: snapshot.arguments }));
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
      session = config.sessionId ? new ChioSession({
        baseUrl: config.endpoint,
        authToken: config.bearerToken,
        sessionId: config.sessionId,
        protocolVersion: "2025-11-25",
        fetchImpl
      }) : await ChioClient.withStaticBearer(config.endpoint, config.bearerToken, fetchImpl).initialize({
        protocolVersion: "2025-11-25",
        clientInfo: { name: "@chio/bridge", version: "0.3.0" }
      });
      const handshake = session.handshake?.initializeResponse.messages.find((message) => "result" in message);
      const feature = handshake?.result?.capabilities?.experimental?.["io.chio/execution-evidence"];
      if (!config.sessionId && feature?.version !== "1")
        return failure("kernel does not advertise execution-evidence v1; upgrade required before dispatch");
      const context = await session.requestResult("chio/execution-context");
      const authority = "result" in context ? context.result : void 0;
      if (authority?.schema !== "chio.mcp.execution-context.v1" || authority.evidenceVersion !== "1" || authority.subjectKey !== config.subjectKey || !Array.isArray(authority.capabilityIds) || !authority.capabilityIds.includes(config.capabilityId)) {
        return failure("kernel session authority does not match operator-pinned caller and capability");
      }
      if (combined.aborted)
        return failure("cancelled before dispatch");
      sent = true;
      const response = await session.requestResult("tools/call", {
        name: request.tool,
        arguments: request.arguments,
        _meta: { chioRequestId: request.requestId }
      });
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
      return { state: "completed", evidence: "verified", requestId: request.requestId, receipt, result: envelope.output };
    } catch {
      return failure(sent ? "execution outcome unknown; no automatic retry" : "kernel unavailable or malformed handshake before dispatch");
    } finally {
      try {
        if (!config.sessionId)
          await session?.close();
      } catch {
      }
    }
  }
}

// node_modules/@chio/bridge/dist/gateway.js
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
  return config;
}
function createGateway(config, executor = createMcpExecutionClient(config.execution)) {
  const snapshot = JSON.parse(JSON.stringify(config));
  const directory = resolve(snapshot.journalDir);
  mkdirSync(directory, { recursive: true, mode: 448 });
  privatePath(directory, true);
  const lockPath = join(directory, "gateway.lock");
  const lock = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, sessionId: snapshot.sessionId }));
  fsyncSync(lock);
  closeSync(lock);
  syncDirectory(directory);
  const binding = canonicalizeJson({
    sessionId: snapshot.sessionId,
    kernelSessionId: snapshot.execution.sessionId,
    endpoint: snapshot.execution.endpoint,
    subjectKey: snapshot.execution.subjectKey,
    capabilityId: snapshot.execution.capabilityId,
    serverId: snapshot.execution.serverId,
    trustedSigners: snapshot.execution.trustedSigners,
    tools: snapshot.tools
  });
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
  let fenced = false;
  try {
    for (const filename of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
      const path = join(directory, filename);
      privatePath(path, false);
      const record = JSON.parse(readFileSync(path, "utf8"));
      if (!record.requestId || !record.digest || !["pending", "not_dispatched", "unknown", "denied", "completed"].includes(record.state))
        throw new Error("invalid operation journal");
      if (record.state !== "pending" && (!record.outcome || record.outcome.state !== record.state || record.outcome.requestId !== record.requestId))
        throw new Error("inconsistent operation journal result");
      if (records.has(record.requestId))
        throw new Error("duplicate operation journal identity");
      records.set(record.requestId, record);
      if (!["not_dispatched", "completed"].includes(record.state))
        fenced = true;
    }
  } catch (error) {
    throw error;
  }
  let closed = false;
  let busy = false;
  const tools = new Map(snapshot.tools.map((tool) => [tool.name, tool]));
  function persist(record) {
    const key = createHash2("sha256").update(record.requestId).digest("hex");
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
  return {
    listTools: () => snapshot.tools,
    async call(id, name, args, signal) {
      const requestId = `${snapshot.sessionId}:${createHash2("sha256").update(canonicalizeJson({ id })).digest("hex")}`;
      const refused = (reason) => ({ state: "not_dispatched", evidence: "unverified", requestId, reason });
      if (closed || busy)
        return refused("gateway closed or another operation in flight");
      if (!tools.has(name))
        return refused("tool is outside the operator allowlist");
      let digest;
      try {
        digest = createHash2("sha256").update(canonicalizeJson({ name, args })).digest("hex");
      } catch {
        return refused("invalid canonical arguments");
      }
      const prior = records.get(requestId);
      if (prior) {
        if (prior.digest !== digest)
          return refused("operation identity conflicts with retained request");
        return prior.outcome ?? { state: "unknown", evidence: "unverified", requestId, reason: "interrupted dispatch requires resource reconciliation" };
      }
      if (fenced)
        return refused("an unresolved operation fences this gateway; operator reconciliation required");
      if (signal?.aborted)
        return refused("cancelled before admission");
      busy = true;
      try {
        persist({ requestId, digest, state: "pending" });
        fenced = true;
        const outcome = await executor.execute({ tool: name, arguments: args, requestId }, signal ? { signal } : {});
        persist({ requestId, digest, state: outcome.state, outcome });
        fenced = !["not_dispatched", "completed"].includes(outcome.state);
        return outcome;
      } catch {
        fenced = true;
        return { state: "unknown", evidence: "unverified", requestId, reason: "dispatch or evidence persistence interrupted; no automatic retry" };
      } finally {
        busy = false;
      }
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
  const toolError = outcome.result !== null && typeof outcome.result === "object" && outcome.result.isError === true;
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write("Chio gateway startup or persistence failed; protected tools unavailable.\n");
    process.exitCode = 1;
  });
}
export {
  createGateway,
  gatewayToolResult,
  readGatewayConfig
};
