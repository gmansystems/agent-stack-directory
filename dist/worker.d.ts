import { type DataLoader } from "./core.js";
/**
 * Handles one HTTP request. Returns null for plain GET/HEAD page views so the caller can serve the
 * human-readable /mcp/ page (browsers, link-preview bots, curl). Only a GET that asks for an SSE stream
 * (Accept: text/event-stream, the Streamable HTTP listen request) gets 405, as the spec allows for
 * servers that do not offer a standalone stream.
 */
export declare function handleMcpRequest(request: Request, load: DataLoader): Promise<Response | null>;
