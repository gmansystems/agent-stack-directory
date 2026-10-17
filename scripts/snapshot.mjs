// Writes a dated snapshot of the public dataset to data/ as JSON and CSV.
// Usage: node scripts/snapshot.mjs [source]   (source: URL or local path, default https://agentstackdirectory.com/data.json)
import { readFile, writeFile, mkdir } from "node:fs/promises";

const src = process.argv[2] || "https://agentstackdirectory.com/data.json";
const raw = /^https?:/.test(src) ? await (await fetch(src)).json() : JSON.parse(await readFile(src, "utf8"));
const FIELDS = ["slug", "name", "url", "category", "summary", "tagline", "open_source", "added", "verified"];
const listings = raw.listings
  .map((x) => Object.fromEntries(FIELDS.map((f) => [f, x[f] ?? null])))
  .sort((a, b) => a.slug.localeCompare(b.slug));
const out = {
  name: "Agent Stack Directory dataset",
  source: "https://agentstackdirectory.com/data.json",
  license: "CC-BY-4.0",
  license_url: "https://creativecommons.org/licenses/by/4.0/",
  attribution: "Agent Stack Directory (https://agentstackdirectory.com)",
  snapshot_date: new Date().toISOString().slice(0, 10),
  fields: FIELDS,
  categories: raw.categories,
  listings,
};
await mkdir("data", { recursive: true });
await writeFile("data/agent-stack-directory.json", JSON.stringify(out, null, 2) + "\n");
const esc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [FIELDS.join(","), ...listings.map((x) => FIELDS.map((f) => esc(x[f])).join(","))].join("\n") + "\n";
await writeFile("data/agent-stack-directory.csv", csv);
const cats = ["key,name,description", ...Object.entries(raw.categories).map(([k, v]) => [k, v.name, v.blurb].map(esc).join(","))].join("\n") + "\n";
await writeFile("data/categories.csv", cats);
console.log(`snapshot: ${listings.length} listings, ${Object.keys(raw.categories).length} categories from ${src}`);
