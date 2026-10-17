// Bundles src/worker.ts into a single ESM file that the site's Pages Function imports.
// Usage: node scripts/build-worker.mjs [outfile]
import { build } from "esbuild";

const outfile = process.argv[2] || "../site/mcp_worker/mcp-worker.js";
await build({
  entryPoints: ["src/worker.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["workerd", "worker", "browser"],
  minify: true,
  legalComments: "linked",
  outfile,
  logLevel: "info",
});
