#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertDataset, cachedLoader, DATA_URL, httpLoader } from "./core.js";
import { createServer, SERVER_VERSION } from "./server.js";
const file = process.env.AGENT_STACK_DATA_FILE;
const url = process.env.AGENT_STACK_DATA_URL || DATA_URL;
const base = file
    ? async () => assertDataset(JSON.parse(await readFile(file, "utf8")))
    : httpLoader(url, { headers: { "user-agent": `agent-stack-directory-mcp/${SERVER_VERSION}` } });
const server = createServer(cachedLoader(base));
await server.connect(new StdioServerTransport());
console.error(`agent-stack-directory MCP ${SERVER_VERSION} on stdio, data from ${file ?? url}`);
