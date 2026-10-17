import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchTools, getTool, compareTools, listCategories, resolveCategory, findTool, comparePageUrl, cachedLoader, renderSearch, renderTool, renderCompare, renderCategories } from "../dist/core.js";

const data = JSON.parse(readFileSync(new URL("../data/agent-stack-directory.json", import.meta.url), "utf8"));
const first = data.listings[0];
const catKey = first.category;

test("dataset snapshot has listings and categories", () => {
  assert.ok(data.listings.length >= 10);
  assert.ok(Object.keys(data.categories).length >= 5);
  for (const x of data.listings) {
    assert.ok(data.categories[x.category], `unknown category for ${x.slug}`);
    assert.match(x.url, /^https:\/\//);
  }
});

test("list_categories counts add up", () => {
  const r = listCategories(data);
  assert.equal(r.total_tools, data.listings.length);
  assert.equal(r.categories.reduce((s, c) => s + c.tool_count, 0), data.listings.length);
  assert.match(renderCategories(r), /categories/);
});

test("resolveCategory accepts key and display name", () => {
  assert.equal(resolveCategory(data, catKey), catKey);
  assert.equal(resolveCategory(data, data.categories[catKey].name.toUpperCase()), catKey);
  assert.equal(resolveCategory(data, "definitely not a category"), undefined);
});

test("search by exact name ranks that tool first", () => {
  const r = searchTools(data, { query: first.name });
  assert.equal(r.results[0].slug, first.slug);
  assert.match(renderSearch(r), new RegExp(first.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("search filters by category and open source, respects limit", () => {
  const r = searchTools(data, { category: catKey, limit: 50 });
  assert.equal(r.total_matches, data.listings.filter((x) => x.category === catKey).length);
  assert.ok(r.results.every((x) => x.category === catKey));
  const oss = searchTools(data, { open_source: true, limit: 50 });
  assert.ok(oss.results.every((x) => x.open_source));
  assert.equal(searchTools(data, { limit: 3 }).results.length, 3);
});

test("search with unknown category throws a helpful error", () => {
  assert.throws(() => searchTools(data, { category: "nope" }), /Valid keys/);
});

test("search with no hits renders a hint", () => {
  const r = searchTools(data, { query: "zzqqxx-nothing" });
  assert.equal(r.results.length, 0);
  assert.match(renderSearch(r), /No tools matched/);
});

test("get_tool by slug and by name, with alternatives", () => {
  const t = getTool(data, first.slug);
  assert.equal(t.name, first.name);
  assert.equal(getTool(data, first.name.toLowerCase()).slug, first.slug);
  assert.ok(t.alternatives.every((a) => a.slug !== first.slug && a.compare_url.includes("/compare/")));
  assert.match(renderTool(t), /Official site/);
});

test("get_tool unknown slug suggests close matches", () => {
  assert.throws(() => getTool(data, first.slug + "x"), /Did you mean/);
});

test("compare two same-category tools links the head-to-head page", () => {
  const pair = data.listings.filter((x) => x.category === catKey).slice(0, 2);
  const c = compareTools(data, pair.map((x) => x.slug));
  assert.equal(c.same_category, true);
  assert.equal(c.compare_page_url, comparePageUrl(findTool(data, pair[0].slug), findTool(data, pair[1].slug)));
  assert.match(renderCompare(c), /\| Tool \|/);
});

test("compare across categories flags complements", () => {
  const a = data.listings[0];
  const b = data.listings.find((x) => x.category !== a.category);
  const c = compareTools(data, [a.slug, b.name]);
  assert.equal(c.same_category, false);
  assert.equal(c.compare_page_url, null);
  assert.match(c.differences[0], /complements/);
});

test("compare validates count and unknown tools", () => {
  assert.throws(() => compareTools(data, [first.slug]), /between 2 and 4/);
  assert.throws(() => compareTools(data, [first.slug, "no-such-tool-xyz"]), /Unknown tool/);
});

test("cachedLoader caches and serves stale data on failure", async () => {
  let calls = 0;
  let fail = false;
  const load = cachedLoader(async () => {
    calls++;
    if (fail) throw new Error("down");
    return data;
  }, 0);
  await load();
  fail = true;
  const d = await load();
  assert.equal(d, data);
  assert.equal(calls, 2);
});
