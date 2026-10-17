# Agent Stack Directory: MCP server and open dataset

An open dataset of infrastructure tools for AI agents (cloud browsers, sandboxes, memory, search APIs, email,
integrations, payments, voice, observability, frameworks and auth) plus a small MCP server so AI coding tools can
query it while you build.

- Remote endpoint: `https://agentstackdirectory.com/mcp` (Streamable HTTP, stateless, read-only, no key)
- Live data: https://agentstackdirectory.com/data.json
- Snapshot in this repo: [`data/`](data/) (JSON and CSV)
- Website: https://agentstackdirectory.com/mcp/

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `search_tools` | `query?`, `category?`, `open_source?`, `limit?` (1 to 50, default 10) | Matching tools ranked by keyword match |
| `get_tool` | `tool` (slug or name) | Summary, official site, open-source flag, last link check, alternatives in the same category |
| `compare` | `tools` (2 to 4 slugs or names) | Side-by-side table, notable differences, head-to-head page URL when one exists |
| `list_categories` | none | Every category with key, description and tool counts |

Every tool is read-only. Results come back as readable text plus `structuredContent` JSON.

Example prompts:

- "Which sandboxes for running agent code are open source?"
- "Compare E2B and Daytona."
- "What are the alternatives to Browserbase?"

## Install (remote, nothing to run locally)

### Claude Code

```sh
claude mcp add --transport http agent-stack-directory https://agentstackdirectory.com/mcp
```

### Cursor

`.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` for all projects:

```json
{
  "mcpServers": {
    "agent-stack-directory": {
      "url": "https://agentstackdirectory.com/mcp"
    }
  }
}
```

### VS Code

`.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "agent-stack-directory": {
      "type": "http",
      "url": "https://agentstackdirectory.com/mcp"
    }
  }
}
```

Or from a terminal:

```sh
code --add-mcp '{"name":"agent-stack-directory","type":"http","url":"https://agentstackdirectory.com/mcp"}'
```

## Install (local, stdio)

Needs Node 18 or newer. `npx` builds the server from this repository on first run.

### Claude Code

```sh
claude mcp add agent-stack-directory -- npx -y github:gmansystems/agent-stack-directory
```

### Cursor

```json
{
  "mcpServers": {
    "agent-stack-directory": {
      "command": "npx",
      "args": ["-y", "github:gmansystems/agent-stack-directory"]
    }
  }
}
```

### VS Code

```json
{
  "servers": {
    "agent-stack-directory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:gmansystems/agent-stack-directory"]
    }
  }
}
```

### From a clone

```sh
git clone https://github.com/gmansystems/agent-stack-directory
cd agent-stack-directory
npm install
node dist/stdio.js
```

Environment variables (optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_STACK_DATA_URL` | `https://agentstackdirectory.com/data.json` | Where to fetch the dataset |
| `AGENT_STACK_DATA_FILE` | unset | Read a local JSON file instead, for offline use, e.g. `data/agent-stack-directory.json` |

The stdio server caches the dataset in memory for 10 minutes and keeps serving the last good copy if a refresh fails.

## Dataset

`data/agent-stack-directory.json` holds `categories` and `listings`. Each listing has:

| Field | Meaning |
| --- | --- |
| `slug` | Stable identifier, used in directory URLs |
| `name` | Product name |
| `url` | Official site |
| `category` | Category key (see `categories`) |
| `summary` | One plain sentence on what it does, written from the vendor's own site |
| `tagline` | The vendor's own tagline |
| `open_source` | `true` when the product is marked open source |
| `added` | Date added to the directory |
| `verified` | Date the official link was last checked |

CSV copies: `data/agent-stack-directory.csv` and `data/categories.csv`. Refresh the snapshot with `npm run snapshot`.

Sponsorship never changes the data or the search ranking. The dataset has no sponsored fields.

## Development

```sh
npm install
npm test                 # unit tests plus MCP client tests over stdio and Streamable HTTP
npm run test:remote      # live check of https://agentstackdirectory.com/mcp with the MCP client
npm run build:worker     # bundle src/worker.ts for the Cloudflare Pages Function
```

Layout:

- `src/core.ts`: data loading and the tool logic, no I/O
- `src/server.ts`: MCP server definition (official TypeScript SDK)
- `src/stdio.ts`: stdio entry point (`agent-stack-directory-mcp` bin)
- `src/worker.ts`: stateless Streamable HTTP handler for Cloudflare Workers or Pages Functions

To host your own remote copy on Cloudflare, bundle `src/worker.ts` and call `handleMcpRequest(request, loader)` from a Worker.

## License

- Code: MIT, see [`LICENSE`](LICENSE).
- Data: CC BY 4.0, see [`DATA-LICENSE.md`](DATA-LICENSE.md). Please credit Agent Stack Directory with a link to https://agentstackdirectory.com.

Corrections and new tools: https://agentstackdirectory.com/submit/ or open an issue.
