/**
 * Core data access and tool logic for the Agent Stack Directory MCP server.
 * Pure functions over the public dataset at https://agentstackdirectory.com/data.json.
 * No I/O here: callers supply a loader so the same code runs in Node (stdio) and on Cloudflare (remote).
 */
export declare const SITE = "https://agentstackdirectory.com";
export declare const DATA_URL = "https://agentstackdirectory.com/data.json";
export interface Category {
    name: string;
    blurb: string;
}
export interface Listing {
    slug: string;
    name: string;
    url: string;
    category: string;
    summary: string;
    tagline?: string;
    open_source: boolean;
    added?: string;
    verified?: string;
    [key: string]: unknown;
}
export interface Dataset {
    categories: Record<string, Category>;
    listings: Listing[];
    [key: string]: unknown;
}
export type DataLoader = () => Promise<Dataset>;
/** Validates the shape of a fetched dataset and throws a readable error if it is wrong. */
export declare function assertDataset(d: unknown): Dataset;
/** Wraps a loader with an in-memory cache (default 10 minutes). */
export declare function cachedLoader(load: DataLoader, ttlMs?: number): DataLoader;
/** Loader that fetches the dataset over HTTP with the global fetch. */
export declare function httpLoader(url?: string, init?: RequestInit): DataLoader;
export interface ToolSummary {
    slug: string;
    name: string;
    category: string;
    category_name: string;
    summary: string;
    open_source: boolean;
    official_url: string;
    directory_url: string;
    verified?: string;
}
/** Finds a category by key or by display name (case and punctuation insensitive). */
export declare function resolveCategory(d: Dataset, input: string): string | undefined;
/** Finds a listing by slug or by name (case and punctuation insensitive). */
export declare function findTool(d: Dataset, input: string): Listing | undefined;
/** Closest slugs to an unknown input, for helpful error messages. */
export declare function suggest(d: Dataset, input: string, max?: number): string[];
export interface SearchInput {
    query?: string;
    category?: string;
    open_source?: boolean;
    limit?: number;
}
export interface SearchResult {
    query: string | null;
    category: string | null;
    open_source: boolean | null;
    total_matches: number;
    results: ToolSummary[];
}
/** Keyword search over name, slug, summary, tagline and category, with optional filters. */
export declare function searchTools(d: Dataset, input: SearchInput): SearchResult;
export interface ToolDetail extends ToolSummary {
    tagline?: string;
    added?: string;
    category_url: string;
    alternatives_url: string;
    alternatives: {
        slug: string;
        name: string;
        open_source: boolean;
        compare_url: string;
    }[];
}
/** URL of the head-to-head page for two tools. Pages exist for same-category pairs. */
export declare function comparePageUrl(a: Listing, b: Listing): string | null;
/** Full record for one tool plus the other tools in its category. */
export declare function getTool(d: Dataset, input: string): ToolDetail;
export interface CompareResult {
    tools: (ToolSummary & {
        tagline?: string;
    })[];
    same_category: boolean;
    compare_page_url: string | null;
    differences: string[];
}
/** Side-by-side facts for 2 to 4 tools. */
export declare function compareTools(d: Dataset, inputs: string[]): CompareResult;
export interface CategoryInfo {
    key: string;
    name: string;
    description: string;
    tool_count: number;
    open_source_count: number;
    url: string;
}
/** Every category with counts. */
export declare function listCategories(d: Dataset): {
    total_tools: number;
    categories: CategoryInfo[];
};
export declare function renderSearch(r: SearchResult): string;
export declare function renderTool(t: ToolDetail): string;
export declare function renderCompare(c: CompareResult): string;
export declare function renderCategories(r: ReturnType<typeof listCategories>): string;
