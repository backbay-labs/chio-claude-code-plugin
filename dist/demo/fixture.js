import { createRequire as __chioCreateRequire } from 'node:module';
const require = __chioCreateRequire(import.meta.url);

// src/demo/fixture.ts
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";

// src/demo/owner-files.ts
import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
var worker = String.raw`
import { constants as C, lstatSync, statSync, mkdirSync, openSync, closeSync, fstatSync, readSync, writeFileSync, readFileSync } from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8')), limit=1024*1024;
const identity=s=>[s.dev.toString(),s.ino.toString()];
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
let fd;
try {
  if(!same(identity(statSync('.',{bigint:true})),input.identity)) throw Error();
  const parts=input.path.split('/');
  for(const segment of parts.slice(0,-1)) {
    let before;
    try { before=lstatSync(segment,{bigint:true}); }
    catch(error) { if(error.code!=='ENOENT'||input.action!=='write') throw error; mkdirSync(segment,{mode:0o700}); before=lstatSync(segment,{bigint:true}); }
    if(!before.isDirectory()||before.isSymbolicLink()) throw Error();
    process.chdir(segment);
    // If an ancestor changed between lstat and chdir, do no file operation.
    if(!same(identity(statSync('.',{bigint:true})),identity(before))) throw Error();
  }
  const leaf=parts.at(-1);
  if(input.action==='write') {
    fd=openSync(leaf,C.O_WRONLY|C.O_CREAT|C.O_EXCL|C.O_NOFOLLOW,0o600);
    writeFileSync(fd,input.content);
    process.stdout.write(JSON.stringify({ok:true}));
  } else {
    fd=openSync(leaf,C.O_RDONLY|C.O_NOFOLLOW|C.O_NONBLOCK);
    const s=fstatSync(fd);
    if(!s.isFile()||s.nlink!==1||s.size>limit) throw Error();
    const buffer=Buffer.alloc(limit+1); let size=0,n;
    while(size<buffer.length&&(n=readSync(fd,buffer,size,buffer.length-size,null))>0) size+=n;
    if(size>limit) throw Error();
    process.stdout.write(JSON.stringify({ok:true,text:buffer.subarray(0,size).toString('utf8')}));
  }
} catch(error) { process.stdout.write(JSON.stringify({ok:false,exists:error.code==='EEXIST'})); }
finally { if(fd!==undefined) closeSync(fd); }
`;
function createOwnerFiles(owner) {
  const root = lstatSync(owner, { bigint: true });
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("demo owner must be a real directory");
  const identity = [root.dev.toString(), root.ino.toString()];
  return (action, path, content) => {
    if (typeof path !== "string" || !path || path.length > 4096 || path.includes("\0") || path.includes("\\") || path.split("/").length > 64 || path.split("/").some((p) => !p || p === "." || p === "..")) return { ok: false };
    if (action === "write" && (typeof content !== "string" || Buffer.byteLength(content) > 1024 * 1024)) return { ok: false };
    try {
      const result = execFileSync(process.execPath, ["--input-type=module", "-e", worker], {
        cwd: owner,
        input: JSON.stringify({ action, path, content, identity }),
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        timeout: 5e3,
        // An inherited preload must not turn a bounded file helper into arbitrary code.
        env: {},
        stdio: ["pipe", "pipe", "pipe"]
      });
      return JSON.parse(result);
    } catch {
      return { ok: false };
    }
  };
}

// src/demo/fixture.ts
import { resolve } from "node:path";

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
  let size = 0, tooLarge = false;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      tooLarge = true;
      chunks.length = 0;
      continue;
    }
    if (!tooLarge) chunks.push(chunk);
  }
  if (tooLarge) throw new Error("body too large");
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}
var Refusal = class extends Error {
};
async function startDemoKernel(options) {
  const { owner, seed, adminToken, bearerToken, credential } = options;
  const ownerRoot = resolve(owner);
  const proposals = /* @__PURE__ */ new Map();
  let counter = 0, writes = 0, revoked = false;
  const send = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  mkdirSync(ownerRoot, { recursive: true });
  const ownerFile = createOwnerFiles(ownerRoot);
  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, { jsonrpc: "2.0", id: null, error: { code: -32603, message: "internal error" } });
      else res.end();
    });
  });
  const handle = async (req, res) => {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "invalid request body" } });
      return;
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "request body must be an object" } });
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
      let text, isError = false;
      try {
        const args = params.arguments, meta2 = params._meta ?? {};
        if (args === null || typeof args !== "object" || Array.isArray(args)) throw new Refusal("arguments are required");
        if (!meta2.chioRequestId) throw new Refusal("request id is required");
        if (config.approval?.requiredTools?.includes(params.name) && (!meta2.chioGovernedIntent || !meta2.chioApprovalToken)) throw new Refusal("approval envelope is required");
        if (params.name === "write_file") {
          if (typeof args.content !== "string") throw new Refusal("content must be a string");
          const result = ownerFile("write", args.path, args.content);
          if (!result.ok) throw new Refusal(result.exists ? "target already exists" : "path is outside the owner directory or file limit");
          writes++;
          text = `Wrote ${args.path} in the demo owner directory.`;
        } else {
          const result = ownerFile("read", args.path);
          if (!result.ok) throw new Refusal("not a bounded regular file inside the owner directory");
          text = result.text;
        }
      } catch (error) {
        text = `Refused: ${error instanceof Refusal ? error.message : "tool call failed"}`;
        isError = true;
      }
      const meta = params._meta ?? {};
      const outcome = signedOutcome(
        config,
        {
          requestId: meta.chioRequestId ?? "",
          tool: params.name,
          arguments: params.arguments ?? {},
          approval: { ...meta.chioGovernedIntent ? { chioGovernedIntent: meta.chioGovernedIntent } : {}, ...meta.chioApprovalToken ? { chioApprovalToken: meta.chioApprovalToken } : {} }
        },
        seed,
        { content: [{ type: "text", text }], isError }
      );
      ok({ _meta: { chioEvidence: { schema: "chio.mcp.execution-evidence.v1", requestId: outcome.requestId, receipt: outcome.receipt, terminalState: "completed", outputKind: "value", output: outcome.result }, chioDelivery: outcome.delivery } });
      return;
    }
    if (body?.method === "chio/acknowledge") {
      ok({ schema: "chio.mcp.delivery-ack.v1", requestId: params.requestId, receiptId: params.receiptId, acknowledged: true });
      return;
    }
    send(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: "method is not available in the demo fixture" } });
  };
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
