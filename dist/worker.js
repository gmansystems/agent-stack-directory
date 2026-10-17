/**
 * Remote MCP endpoint (Streamable HTTP, stateless, JSON responses) for Cloudflare Workers and Pages Functions.
 * Bundled by scripts/build-worker.mjs into the site's functions directory.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker-provider.js";
import { cachedLoader } from "./core.js";
import { createServer } from "./server.js";
const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
    "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
    "access-control-max-age": "86400",
};
function withCors(res) {
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS))
        out.headers.set(k, v);
    return out;
}
let shared;
/**
 * Handles one HTTP request. Returns null for browser page views (GET with Accept: text/html)
 * so the caller can serve the human-readable /mcp/ page instead.
 */
export async function handleMcpRequest(request, load) {
    const method = request.method.toUpperCase();
    if (method === "OPTIONS")
        return new Response(null, { status: 204, headers: CORS });
    if (method === "GET" || method === "HEAD") {
        const accept = request.headers.get("accept") ?? "";
        if (accept.includes("text/html"))
            return null;
        return withCors(new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. This stateless endpoint accepts POST (Streamable HTTP). Docs: https://agentstackdirectory.com/mcp/" }, id: null }), {
            status: 405,
            headers: { allow: "POST, OPTIONS", "content-type": "application/json" },
        }));
    }
    if (method !== "POST") {
        return withCors(new Response(null, { status: 405, headers: { allow: "POST, OPTIONS" } }));
    }
    if (!shared || shared.key !== load)
        shared = { key: load, loader: cachedLoader(load, 5 * 60 * 1000) };
    const server = createServer(shared.loader, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
        return withCors(await transport.handleRequest(request));
    }
    finally {
        void server.close();
    }
}
