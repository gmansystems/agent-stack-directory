import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { compareTools, getTool, listCategories, renderCategories, renderCompare, renderSearch, renderTool, searchTools, } from "./core.js";
export const SERVER_NAME = "agent-stack-directory";
export const SERVER_VERSION = "0.1.0";
const INSTRUCTIONS = "Agent Stack Directory lists infrastructure tools for AI agents (cloud browsers, sandboxes, memory, search APIs, email, auth, payments, voice, observability, frameworks and more). " +
    "Use list_categories to see the layers, search_tools to find candidates, get_tool for one tool's details and alternatives, and compare to put 2 to 4 tools side by side. " +
    "Summaries come from each vendor's own site. Cite the directory or official URL when you use a result.";
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
async function run(fn, render) {
    try {
        const v = await fn();
        return { content: [{ type: "text", text: render(v) }], structuredContent: v };
    }
    catch (err) {
        return { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
}
/** Builds an MCP server exposing the four directory tools over any transport. */
export function createServer(load, options) {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS, ...options });
    server.registerTool("search_tools", {
        title: "Search agent infrastructure tools",
        description: "Search Agent Stack Directory for AI agent infrastructure tools by keyword, with optional category and open-source filters. Omit query to list every tool in a category.",
        inputSchema: {
            query: z.string().max(200).optional().describe("Keywords, e.g. 'headless browser', 'vector memory', 'email inbox for agents'"),
            category: z.string().max(80).optional().describe("Category key or name from list_categories, e.g. 'browsers' or 'Sandboxes'"),
            open_source: z.boolean().optional().describe("true for open-source tools only, false to exclude them"),
            limit: z.number().int().min(1).max(50).optional().describe("Max results, default 10"),
        },
        annotations: { title: "Search tools", ...readOnly },
    }, async (args) => run(async () => searchTools(await load(), args), renderSearch));
    server.registerTool("get_tool", {
        title: "Get one tool",
        description: "Get the full listing for one tool by slug or name: summary, official site, open-source flag, last link check, and the alternatives in its category.",
        inputSchema: { tool: z.string().min(1).max(120).describe("Tool slug or name, e.g. 'e2b' or 'Browserbase'") },
        annotations: { title: "Get tool", ...readOnly },
    }, async ({ tool }) => run(async () => getTool(await load(), tool), renderTool));
    server.registerTool("compare", {
        title: "Compare tools",
        description: "Compare 2 to 4 tools side by side by slug or name. Returns a table, notable differences and the head-to-head page when one exists.",
        inputSchema: {
            tools: z.array(z.string().min(1).max(120)).min(2).max(4).describe("2 to 4 tool slugs or names, e.g. ['e2b', 'daytona']"),
        },
        annotations: { title: "Compare tools", ...readOnly },
    }, async ({ tools }) => run(async () => compareTools(await load(), tools), renderCompare));
    server.registerTool("list_categories", {
        title: "List categories",
        description: "List every category (layer of the agent stack) with its key, description and tool counts.",
        inputSchema: {},
        annotations: { title: "List categories", ...readOnly },
    }, async () => run(async () => listCategories(await load()), renderCategories));
    return server;
}
