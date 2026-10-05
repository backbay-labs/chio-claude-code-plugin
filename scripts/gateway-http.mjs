// Adapted from @chio/bridge 0.3.0 (vendored archive 7d9e34f7408a), Apache-2.0.
// The HTTP protocol is retained. The added controlCall is an in-process parent
// capability sharing the same queue and gateway; it has no HTTP route or token.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { isDemoConfig } from "./sandbox.mjs";
import { createGateway, gatewayToolResult } from "../src/bridge-internals/gateway.ts";
import { createMcpExecutionClient } from "../src/bridge-internals/execution.ts";
/** Launcher-owned transport. The guest receives only this ephemeral local token.
 * Run this server in the launcher process, outside the guest sandbox. Closing or
 * killing that process removes the guest's only route to the retained gateway.
 * The guest must have no direct kernel egress or access to the owner config.
 * Host acknowledgement is required by default: only a relay-backed protected launcher
 * can confirm that the host received a result. The local demo has no relay and opts out.
 */
export async function startGatewayHttp(config, { requireHostAcknowledgement = true } = {}) {
    const demo = isDemoConfig(config);
    let demoCalls = 0;
    const admitDemoCall = name => { if (!demo || name === "chio_resume") return true; if (demoCalls >= 128) return false; demoCalls++; return true; };
    const displayResult = outcome => gatewayToolResult(demo ? { ...outcome, scope: "demo_fixture", notice: "DEMO fixture kernel · nothing protected" } : outcome);
    const executor = createMcpExecutionClient(config.execution);
    const validation = await executor.validateSession({ allowedTools: config.tools.map(tool => tool.name) });
    if (!validation.ok)
        throw new Error(validation.reason);
    const gateway = createGateway(config, executor, { requireHostAcknowledgement });
    const token = randomBytes(32).toString("base64url");
    const session = randomBytes(32).toString("base64url");
    let initialized = false;
    let closed = false;
    let queued = Promise.resolve();
    let port = 0;
    const active = new Map();
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
        if (closed || request.url !== "/mcp" || request.headers.host !== `127.0.0.1:${port}` || request.headers.origin
            || !authorized(request.headers.authorization)) {
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
        }
        catch {
            json(response, 400, { error: "invalid JSON" });
            return;
        }
        if (!message || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
            json(response, 400, { error: "invalid MCP request" });
            return;
        }
        const notification = message.id === undefined;
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
            reply({ protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"].includes(offered) ? offered : "2025-11-25", capabilities: { tools: {}, experimental: { chioDeliveryAcknowledgement: { version: "1" } } }, serverInfo: { name: demo ? "chio-demo-fixture-gateway" : "chio-protected-gateway", version: "0.3.0" } });
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
        if (!admitDemoCall(message.params.name)) { fail(-32600, "demo call limit reached; start a new demo after inspecting retained work"); return; }
        const key = JSON.stringify(message.id);
        if (active.has(key)) {
            fail(-32600, "request already in flight");
            return;
        }
        const controller = new AbortController();
        active.set(key, controller);
        response.once("close", () => { if (!response.writableEnded)
            controller.abort(); });
        queued = queued.then(async () => {
            if (closed) {
                fail(-32603, "transport closed before dispatch");
                return;
            }
            // A new host transport may restart its numeric RPC counter. Namespace it
            // without changing retained kernel authority or clearing journal fences.
            reply(displayResult(await gateway.call(`${session}:${JSON.stringify(message.id)}`, message.params.name, args, controller.signal)));
        }).catch(() => fail(-32603, "gateway failed; no automatic retry")).finally(() => { active.delete(key); });
        await queued;
    }
    try {
        await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
        const address = server.address();
        if (!address || typeof address === "string")
            throw new Error("missing local transport address");
        port = address.port;
    }
    catch (error) {
        gateway.close();
        throw error;
    }
    return {
        url: `http://127.0.0.1:${port}/mcp`, port, token,
        controlCall(id, tool, args) {
            if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id) || typeof tool !== "string" || !args || typeof args !== "object" || Array.isArray(args)
                || Buffer.byteLength(JSON.stringify(args)) > 4096) return Promise.reject(new Error("bounded parent control call required"));
            if (!admitDemoCall(tool)) return Promise.reject(new Error("demo call limit reached; inspect retained work"));
            const result = queued.then(async () => {
                if (closed) throw new Error("parent transport closed; original operation remains fenced");
                return gateway.call("native-control:" + id, tool, args);
            });
            queued = result.then(() => undefined, () => undefined);
            return result;
        },
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
            await new Promise(resolve => server.close(() => resolve()));
            await queued;
            gateway.close();
        },
    };
}
