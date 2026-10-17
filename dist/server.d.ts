import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { type DataLoader } from "./core.js";
export declare const SERVER_NAME = "agent-stack-directory";
export declare const SERVER_VERSION = "0.1.0";
/** Builds an MCP server exposing the four directory tools over any transport. */
export declare function createServer(load: DataLoader, options?: ServerOptions): McpServer;
