import { type DataLoader } from "./core.js";
/**
 * Handles one HTTP request. Returns null for browser page views (GET with Accept: text/html)
 * so the caller can serve the human-readable /mcp/ page instead.
 */
export declare function handleMcpRequest(request: Request, load: DataLoader): Promise<Response | null>;
