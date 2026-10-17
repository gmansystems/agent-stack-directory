/**
 * Core data access and tool logic for the Agent Stack Directory MCP server.
 * Pure functions over the public dataset at https://agentstackdirectory.com/data.json.
 * No I/O here: callers supply a loader so the same code runs in Node (stdio) and on Cloudflare (remote).
 */

export const SITE = "https://agentstackdirectory.com";
export const DATA_URL = `${SITE}/data.json`;

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
export function assertDataset(d: unknown): Dataset {
  const x = d as Dataset;
  if (!x || typeof x !== "object" || typeof x.categories !== "object" || !Array.isArray(x.listings)) {
    throw new Error("Dataset is missing 'categories' or 'listings'.");
  }
  return x;
}

/** Wraps a loader with an in-memory cache (default 10 minutes). */
export function cachedLoader(load: DataLoader, ttlMs = 10 * 60 * 1000): DataLoader {
  let value: Dataset | undefined;
  let at = 0;
  let pending: Promise<Dataset> | undefined;
  return async () => {
    if (value && Date.now() - at < ttlMs) return value;
    if (!pending) {
      pending = load()
        .then((d) => {
          value = assertDataset(d);
          at = Date.now();
          return value;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    try {
      return await pending;
    } catch (err) {
      if (value) return value; // serve stale data rather than fail
      throw err;
    }
  };
}

/** Loader that fetches the dataset over HTTP with the global fetch. */
export function httpLoader(url = DATA_URL, init?: RequestInit): DataLoader {
  return async () => {
    const res = await fetch(url, { ...init, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
    return assertDataset(await res.json());
  };
}

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

const toolUrl = (slug: string) => `${SITE}/tools/${slug}/`;
const categoryUrl = (key: string) => `${SITE}/category/${key}/`;

function summarize(d: Dataset, x: Listing): ToolSummary {
  return {
    slug: x.slug,
    name: x.name,
    category: x.category,
    category_name: d.categories[x.category]?.name ?? x.category,
    summary: x.summary,
    open_source: Boolean(x.open_source),
    official_url: x.url,
    directory_url: toolUrl(x.slug),
    verified: x.verified,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Finds a category by key or by display name (case and punctuation insensitive). */
export function resolveCategory(d: Dataset, input: string): string | undefined {
  if (d.categories[input]) return input;
  const n = norm(input);
  for (const [k, v] of Object.entries(d.categories)) {
    if (norm(k) === n || norm(v.name) === n) return k;
  }
  return undefined;
}

/** Finds a listing by slug or by name (case and punctuation insensitive). */
export function findTool(d: Dataset, input: string): Listing | undefined {
  const raw = input.trim().toLowerCase();
  const bySlug = d.listings.find((x) => x.slug === raw);
  if (bySlug) return bySlug;
  const n = norm(input);
  return d.listings.find((x) => norm(x.name) === n || norm(x.slug) === n);
}

/** Closest slugs to an unknown input, for helpful error messages. */
export function suggest(d: Dataset, input: string, max = 5): string[] {
  const n = norm(input);
  const words = n.split(" ").filter(Boolean);
  return d.listings
    .map((x) => {
      const hay = `${norm(x.name)} ${norm(x.slug)}`;
      let s = 0;
      for (const w of words) if (hay.includes(w)) s += w.length;
      if (hay.startsWith(n.slice(0, 3))) s += 1;
      return { slug: x.slug, s };
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((r) => r.slug);
}

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
export function searchTools(d: Dataset, input: SearchInput): SearchResult {
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 10)));
  let cat: string | undefined;
  if (input.category) {
    cat = resolveCategory(d, input.category);
    if (!cat) {
      throw new Error(
        `Unknown category '${input.category}'. Valid keys: ${Object.keys(d.categories).join(", ")}.`,
      );
    }
  }
  let pool = d.listings.filter(
    (x) => (!cat || x.category === cat) && (input.open_source === undefined || Boolean(x.open_source) === input.open_source),
  );
  const q = input.query ? norm(input.query) : "";
  let ranked: Listing[];
  if (q) {
    const words = q.split(" ").filter((w) => w.length > 1 || q.length === 1);
    const scored = pool
      .map((x) => {
        const name = norm(x.name);
        const slug = norm(x.slug);
        const catName = norm(d.categories[x.category]?.name ?? "");
        const body = norm(`${x.summary} ${x.tagline ?? ""}`);
        let s = 0;
        if (name === q || slug === q) s += 100;
        else if (name.startsWith(q)) s += 40;
        for (const w of words) {
          if (name.includes(w)) s += 12;
          if (slug.includes(w)) s += 6;
          if (catName.includes(w) || norm(x.category).includes(w)) s += 5;
          const hits = body.split(w).length - 1;
          s += Math.min(hits, 3) * 2;
        }
        return { x, s };
      })
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.x.name.localeCompare(b.x.name));
    ranked = scored.map((r) => r.x);
  } else {
    ranked = [...pool].sort((a, b) => a.name.localeCompare(b.name));
  }
  pool = ranked;
  return {
    query: input.query ?? null,
    category: cat ?? null,
    open_source: input.open_source ?? null,
    total_matches: pool.length,
    results: pool.slice(0, limit).map((x) => summarize(d, x)),
  };
}

export interface ToolDetail extends ToolSummary {
  tagline?: string;
  added?: string;
  category_url: string;
  alternatives_url: string;
  alternatives: { slug: string; name: string; open_source: boolean; compare_url: string }[];
}

/** URL of the head-to-head page for two tools. Pages exist for same-category pairs. */
export function comparePageUrl(a: Listing, b: Listing): string | null {
  if (a.category !== b.category || a.slug === b.slug) return null;
  const [x, y] = [a.slug, b.slug].sort();
  return `${SITE}/compare/${x}-vs-${y}/`;
}

/** Full record for one tool plus the other tools in its category. */
export function getTool(d: Dataset, input: string): ToolDetail {
  const x = findTool(d, input);
  if (!x) {
    const s = suggest(d, input);
    throw new Error(`No tool '${input}' in Agent Stack Directory.${s.length ? ` Did you mean: ${s.join(", ")}?` : ""}`);
  }
  const alts = d.listings
    .filter((y) => y.category === x.category && y.slug !== x.slug)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    ...summarize(d, x),
    tagline: x.tagline,
    added: x.added,
    category_url: categoryUrl(x.category),
    alternatives_url: `${SITE}/alternatives/${x.slug}/`,
    alternatives: alts.map((y) => ({
      slug: y.slug,
      name: y.name,
      open_source: Boolean(y.open_source),
      compare_url: comparePageUrl(x, y) as string,
    })),
  };
}

export interface CompareResult {
  tools: (ToolSummary & { tagline?: string })[];
  same_category: boolean;
  compare_page_url: string | null;
  differences: string[];
}

/** Side-by-side facts for 2 to 4 tools. */
export function compareTools(d: Dataset, inputs: string[]): CompareResult {
  const uniq = [...new Set(inputs.map((s) => s.trim()).filter(Boolean))];
  if (uniq.length < 2 || uniq.length > 4) throw new Error("Pass between 2 and 4 distinct tools to compare.");
  const found: Listing[] = [];
  const missing: string[] = [];
  for (const s of uniq) {
    const x = findTool(d, s);
    if (x && !found.includes(x)) found.push(x);
    else if (!x) missing.push(s);
  }
  if (missing.length) {
    const hints = missing.map((m) => {
      const s = suggest(d, m, 3);
      return s.length ? `${m} (did you mean ${s.join(", ")}?)` : m;
    });
    throw new Error(`Unknown tool(s): ${hints.join("; ")}.`);
  }
  if (found.length < 2) throw new Error("Pass between 2 and 4 distinct tools to compare.");
  const sameCat = found.every((x) => x.category === found[0].category);
  const diffs: string[] = [];
  if (!sameCat) {
    diffs.push(
      "Different layers of the stack: " +
        found.map((x) => `${x.name} is ${d.categories[x.category]?.name ?? x.category}`).join(", ") +
        ". They are usually complements, not substitutes.",
    );
  }
  const oss = found.filter((x) => x.open_source).map((x) => x.name);
  const closed = found.filter((x) => !x.open_source).map((x) => x.name);
  if (oss.length && closed.length) diffs.push(`Marked open source: ${oss.join(", ")}. Not marked open source: ${closed.join(", ")}.`);
  return {
    tools: found.map((x) => ({ ...summarize(d, x), tagline: x.tagline })),
    same_category: sameCat,
    compare_page_url: found.length === 2 ? comparePageUrl(found[0], found[1]) : null,
    differences: diffs,
  };
}

export interface CategoryInfo {
  key: string;
  name: string;
  description: string;
  tool_count: number;
  open_source_count: number;
  url: string;
}

/** Every category with counts. */
export function listCategories(d: Dataset): { total_tools: number; categories: CategoryInfo[] } {
  return {
    total_tools: d.listings.length,
    categories: Object.entries(d.categories).map(([k, v]) => {
      const items = d.listings.filter((x) => x.category === k);
      return {
        key: k,
        name: v.name,
        description: v.blurb,
        tool_count: items.length,
        open_source_count: items.filter((x) => x.open_source).length,
        url: categoryUrl(k),
      };
    }),
  };
}

// ---------- plain-text renderers (what the model reads) ----------

const line = (t: ToolSummary) =>
  `- ${t.name} (slug: ${t.slug}, ${t.category_name}${t.open_source ? ", open source" : ""}): ${t.summary} Official site: ${t.official_url}`;

export function renderSearch(r: SearchResult): string {
  const filters = [r.query && `query "${r.query}"`, r.category && `category ${r.category}`, r.open_source !== null && `open_source=${r.open_source}`]
    .filter(Boolean)
    .join(", ");
  if (!r.results.length) return `No tools matched${filters ? ` (${filters})` : ""}. Try list_categories or a broader query.`;
  return [
    `${r.total_matches} match${r.total_matches === 1 ? "" : "es"}${filters ? ` for ${filters}` : ""}; showing ${r.results.length}.`,
    ...r.results.map(line),
    "",
    `Source: Agent Stack Directory (${SITE}), data CC BY 4.0.`,
  ].join("\n");
}

export function renderTool(t: ToolDetail): string {
  return [
    `${t.name} (${t.category_name})`,
    t.summary,
    t.tagline ? `In their words: "${t.tagline}"` : "",
    `Open source: ${t.open_source ? "yes" : "not marked open source"}`,
    `Official site: ${t.official_url}`,
    `Directory page: ${t.directory_url}`,
    t.verified ? `Link last checked: ${t.verified}` : "",
    t.alternatives.length
      ? `Alternatives in ${t.category_name}: ${t.alternatives.map((a) => `${a.name} (${a.slug})`).join(", ")}. All alternatives: ${t.alternatives_url}`
      : "",
    "",
    `Source: Agent Stack Directory (${SITE}), data CC BY 4.0.`,
  ]
    .filter((s, i, a) => s !== "" || i === a.length - 2)
    .join("\n");
}

export function renderCompare(c: CompareResult): string {
  const rows = c.tools.map(
    (t) =>
      `| ${t.name} | ${t.category_name} | ${t.open_source ? "yes" : "no"} | ${t.summary.replace(/\|/g, "/")} | ${t.official_url} |`,
  );
  return [
    "| Tool | Category | Open source | What it does | Official site |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    ...c.differences,
    c.compare_page_url ? `Head-to-head page: ${c.compare_page_url}` : "",
    `Source: Agent Stack Directory (${SITE}), data CC BY 4.0.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderCategories(r: ReturnType<typeof listCategories>): string {
  return [
    `${r.categories.length} categories, ${r.total_tools} tools.`,
    ...r.categories.map(
      (c) => `- ${c.name} (key: ${c.key}): ${c.tool_count} tools, ${c.open_source_count} open source. ${c.description}`,
    ),
  ].join("\n");
}
