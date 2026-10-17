// Live check of a deployed endpoint with the official MCP client.
// Usage: node scripts/remote-check.mjs [url]   (default https://agentstackdirectory.com/mcp)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.argv[2] || "https://agentstackdirectory.com/mcp");
const client = new Client({ name: "asd-remote-check", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(url));
const info = client.getServerVersion();
const tools = (await client.listTools()).tools.map((t) => t.name).sort();
const cats = await client.callTool({ name: "list_categories", arguments: {} });
const search = await client.callTool({ name: "search_tools", arguments: { query: "sandbox", limit: 3 } });
const first = search.structuredContent.results[0];
const tool = await client.callTool({ name: "get_tool", arguments: { tool: first.slug } });
const alt = tool.structuredContent.alternatives[0];
const cmp = await client.callTool({ name: "compare", arguments: { tools: [first.slug, alt.slug] } });
await client.close();
const ok = tools.join() === "compare,get_tool,list_categories,search_tools" && !cats.isError && !search.isError && !tool.isError && !cmp.isError;
console.log(JSON.stringify({
  url: url.href, server: info, tools,
  categories: cats.structuredContent.categories.length, total_tools: cats.structuredContent.total_tools,
  search_top3: search.structuredContent.results.map((r) => r.slug),
  get_tool: tool.structuredContent.name, compare: cmp.structuredContent.tools.map((t) => t.slug), compare_page: cmp.structuredContent.compare_page_url,
  ok,
}, null, 2));
process.exit(ok ? 0 : 1);
