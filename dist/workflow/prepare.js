#!/usr/bin/env node
import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// node_modules/@chio/bridge/dist/prepare-gateway.js
import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync, lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/crypto.js
var ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
var ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
var P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
var P384_SPKI_PREFIX = Buffer.from("3076301006072a8648ce3d020106052b81040022036200", "hex");

// node_modules/@chio/bridge/node_modules/@chio-protocol/sdk/dist/invariants/manifest.js
var REQUIRED_PERMISSION_FIELDS = [
  "read_paths",
  "write_paths",
  "network_hosts",
  "environment_variables"
];
var REQUIRED_PERMISSION_FIELD_SET = new Set(REQUIRED_PERMISSION_FIELDS);
var U64_MAX_EXCLUSIVE = 2 ** 64;

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

// node_modules/@chio/bridge/dist/prepare-gateway.js
function sameNames(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value) => typeof value === "string") && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}
async function main() {
  const [requestPath, outputPath] = process.argv.slice(2);
  if (!requestPath || !outputPath || process.argv.length !== 4 || resolve(outputPath) !== outputPath)
    throw new Error("usage: chio-prepare-gateway operator-request.json /absolute/new-gateway-config.json");
  const stat = lstatSync(requestPath);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 63) !== 0 || stat.size > 1024 * 1024)
    throw new Error("operator request must be a private regular file");
  const input = JSON.parse(readFileSync(requestPath, "utf8"));
  const { endpoint: requestedEndpoint, bearerToken, adminToken, credentialTtlSeconds, trustedSigners, serverId, journalDir, sessionId, allowedTools } = input;
  const url = new URL(requestedEndpoint);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
    throw new Error("authenticated endpoint requires HTTPS or loopback HTTP");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("endpoint must be a bare origin without credentials, query, fragment or MCP path");
  const endpoint = url.origin;
  if (typeof bearerToken !== "string" || !bearerToken || typeof adminToken !== "string" || !adminToken || adminToken === bearerToken || !Number.isSafeInteger(credentialTtlSeconds) || credentialTtlSeconds < 1 || credentialTtlSeconds > 3600 || typeof serverId !== "string" || !serverId || typeof journalDir !== "string" || resolve(journalDir) !== journalDir || typeof sessionId !== "string" || !sessionId || !Array.isArray(allowedTools) || !allowedTools.length || new Set(allowedTools).size !== allowedTools.length || allowedTools.some((name) => typeof name !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(name)) || !Array.isArray(trustedSigners) || !trustedSigners.length || trustedSigners.some((key) => typeof key !== "string" || !/^[a-f0-9]{64}$/i.test(key))) {
    throw new Error("distinct operator and admin credentials, bounded credential TTL, explicit authority, signer, journal and tool allowlist required");
  }
  const fetchImpl = (url2, init) => fetch(url2, { ...init, signal: AbortSignal.timeout(3e4), redirect: "error" });
  const session = await ChioClient.withStaticBearer(endpoint, bearerToken, fetchImpl).initialize({ clientInfo: { name: "chio-prepare-gateway", version: "0.3.0" } });
  let retained = false;
  try {
    const contextResponse = await session.requestResult("chio/execution-context");
    const context = "result" in contextResponse ? contextResponse.result : null;
    if (context?.schema !== "chio.mcp.execution-context.v1" || context.evidenceVersion !== "1" || context.serverId !== serverId || typeof context.subjectKey !== "string" || !/^[a-f0-9]{64}$/i.test(context.subjectKey) || !Array.isArray(context.capabilityIds) || context.capabilityIds.length !== 1 || typeof context.capabilityIds[0] !== "string" || !context.capabilityIds[0]) {
      throw new Error("kernel requires supported evidence, matching server and exactly one pinned session capability");
    }
    const listing = await session.listTools();
    if (!Array.isArray(listing?.tools) || listing.nextCursor)
      throw new Error("tool inventory is missing or paginated; prepare an explicitly bounded server");
    const tools = allowedTools.map((name) => {
      const tool = listing.tools.find((tool2) => tool2.name === name);
      if (!tool?.inputSchema)
        throw new Error("operator tool not found in kernel inventory");
      return { name, description: tool.description, inputSchema: tool.inputSchema };
    });
    const issuedAfter = Math.floor(Date.now() / 1e3);
    const exchange = await fetchImpl(new URL(`/admin/sessions/${encodeURIComponent(session.sessionId)}/credential`, endpoint), {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttlSeconds: credentialTtlSeconds, allowedTools })
    });
    if (!exchange.ok)
      throw new Error("kernel requires session-credential exchange support");
    const text = await exchange.text();
    if (text.length > 1024 * 1024)
      throw new Error("credential response exceeds limit");
    const credential = JSON.parse(text);
    const now = Math.floor(Date.now() / 1e3);
    if (credential?.schema !== "chio.mcp.session-credential.v1" || credential.sessionId !== session.sessionId || credential.subjectKey !== context.subjectKey || !sameNames(credential.capabilityIds, context.capabilityIds) || credential.serverId !== serverId || credential.endpointPath !== "/mcp" || !sameNames(credential.allowedTools, allowedTools) || typeof credential.bearerToken !== "string" || !credential.bearerToken || [bearerToken, adminToken].includes(credential.bearerToken) || !Number.isSafeInteger(credential.issuedAt) || credential.issuedAt < issuedAfter - 5 || credential.issuedAt > now + 5 || !Number.isSafeInteger(credential.expiresAt) || credential.expiresAt <= now || credential.expiresAt > credential.issuedAt + credentialTtlSeconds) {
      throw new Error("credential does not match the pinned session, scope and bounded lifetime");
    }
    const delegated = new ChioSession({ baseUrl: endpoint, authToken: credential.bearerToken, sessionId: session.sessionId, protocolVersion: "2025-11-25", fetchImpl });
    const delegatedResponse = await delegated.requestResult("chio/execution-context");
    const delegatedContext = "result" in delegatedResponse ? delegatedResponse.result : null;
    const binding = delegatedContext?.sessionCredential;
    if (delegatedContext?.schema !== context.schema || delegatedContext.evidenceVersion !== "1" || delegatedContext.subjectKey !== context.subjectKey || delegatedContext.serverId !== serverId || !sameNames(delegatedContext.capabilityIds, context.capabilityIds) || binding?.schema !== credential.schema || binding.sessionId !== credential.sessionId || binding.subjectKey !== credential.subjectKey || binding.serverId !== serverId || binding.endpointPath !== "/mcp" || !sameNames(binding.capabilityIds, credential.capabilityIds) || !sameNames(binding.allowedTools, allowedTools) || binding.issuedAt !== credential.issuedAt || binding.expiresAt !== credential.expiresAt) {
      throw new Error("delegated credential context does not confirm the issued scope");
    }
    const sessionCredential = {
      schema: credential.schema,
      sessionId: credential.sessionId,
      subjectKey: credential.subjectKey,
      capabilityIds: credential.capabilityIds,
      serverId,
      endpointPath: credential.endpointPath,
      allowedTools: credential.allowedTools,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt
    };
    const config = { execution: { endpoint, bearerToken: credential.bearerToken, trustedSigners, serverId, subjectKey: context.subjectKey, capabilityId: context.capabilityIds[0], sessionId: session.sessionId }, sessionId, journalDir, tools, sessionCredential };
    const fd = openSync(outputPath, "wx", 384);
    try {
      writeFileSync(fd, JSON.stringify(config, null, 2) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const dir = openSync(dirname(outputPath), "r");
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
    retained = true;
    process.stdout.write("Prepared retained kernel session and private config with a scoped session credential; no tool was executed.\n");
  } finally {
    if (!retained)
      await session.close();
  }
}
main().catch(() => {
  process.stderr.write("Gateway preparation failed; config must not be used and no protected tool was dispatched.\n");
  process.exitCode = 1;
});
