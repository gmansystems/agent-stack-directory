// End-to-end tests with the official MCP client over stdio and over Streamable HTTP (worker handler in-process).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleMcpRequest } from "../dist/worker.js";

const dataFile = fileURLToPath(new URL("../data/agent-stack-directory.json", import.meta.url));
const data = JSON.parse(readFileSync(dataFile, "utf8"));
const EXPECTED = ["compare", "get_tool", "list_categories", "search_tools"];

async function exercise(client) {
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(tools, EXPECTED);
  const cats = await client.callTool({ name: "list_categories", arguments: {} });
  assert.equal(cats.structuredContent.total_tools, data.listings.length);
  const s = await client.callTool({ name: "search_tools", arguments: { query: data.listings[0].name, limit: 3 } });
  assert.equal(s.structuredContent.results[0].slug, data.listings[0].slug);
  const g = await client.callTool({ name: "get_tool", arguments: { tool: data.listings[1].slug } });
  assert.equal(g.structuredContent.slug, data.listings[1].slug);
  const pair = data.listings.filter((x) => x.category === data.listings[0].category).slice(0, 2).map((x) => x.slug);
  const c = await client.callTool({ name: "compare", arguments: { tools: pair } });
  assert.equal(c.structuredContent.tools.length, 2);
  const bad = await client.callTool({ name: "get_tool", arguments: { tool: "no-such-tool-xyz" } });
  assert.equal(bad.isError, true);
}

test("stdio server works with the MCP client", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/stdio.js", import.meta.url))],
    env: { ...process.env, AGENT_STACK_DATA_FILE: dataFile },
    stderr: "ignore",
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  assert.equal(client.getServerVersion().name, "agent-stack-directory");
  await exercise(client);
  await client.close();
});

test("Streamable HTTP handler works with the MCP client", async () => {
  const loader = async () => data;
  const fetchImpl = async (url, init) => (await handleMcpRequest(new Request(url, init), loader)) ?? new Response("page", { status: 200 });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("https://example.test/mcp"), { fetch: fetchImpl }));
  await exercise(client);
  await client.close();
});

test("HTTP handler: page GETs fall through, SSE GET is 405, OPTIONS is CORS", async () => {
  const loader = async () => data;
  assert.equal(await handleMcpRequest(new Request("https://x/mcp", { headers: { accept: "text/html" } }), loader), null);
  assert.equal(await handleMcpRequest(new Request("https://x/mcp"), loader), null);
  assert.equal(await handleMcpRequest(new Request("https://x/mcp", { headers: { accept: "*/*" } }), loader), null);
  assert.equal(await handleMcpRequest(new Request("https://x/mcp", { method: "HEAD" }), loader), null);
  const g = await handleMcpRequest(new Request("https://x/mcp", { headers: { accept: "text/event-stream" } }), loader);
  assert.equal(g.status, 405);
  const o = await handleMcpRequest(new Request("https://x/mcp", { method: "OPTIONS" }), loader);
  assert.equal(o.status, 204);
  assert.equal(o.headers.get("access-control-allow-origin"), "*");
});
