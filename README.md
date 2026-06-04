# Claude Code AI Courses

Three hands-on projects that teach how to build with Claude Code and the Claude API — from automating developer workflows to shipping a full-stack AI application to building a terminal chatbot with MCP.

---

## What This Course Teaches

### Core Theme
Claude is not just a chat assistant — it is a programmable layer you can embed directly into your development workflow and your products. These three projects cover that idea from different angles: automated quality gates, a full AI-powered web app, and a custom MCP-backed CLI.

---

## Project 1 — `queries/` (Claude Code Hooks + Agent SDK)

**What it is:** An e-commerce data utility layer backed by SQLite and TypeScript. The database schema covers customers, products, orders, inventory, promotions, reviews, and shipping.

**What it teaches:**

### Claude Code Hooks as Automated Quality Gates
Hooks are shell scripts or Node programs that Claude Code runs automatically at specific points in its tool-use lifecycle. This project shows three concrete hooks:

- **`hooks/read_hook.js`** — Intercepts every file read. If Claude tries to read `.env`, the hook exits with code `2`, which blocks the action and returns an error message. This demonstrates how to enforce security constraints on what Claude can access.

- **`hooks/tsc.js`** — Runs after Claude writes a TypeScript file. It invokes the TypeScript compiler programmatically (no shell call, no `tsc` binary needed) with `noEmit: true` and surfaces any type errors back to Claude before the session continues. The key lesson: Claude can self-correct if you give it immediate feedback — a type error caught at write-time is cheaper than a broken build.

- **`hooks/query_hook.js`** — The most advanced hook. Uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) to spawn a sub-agent that reviews every proposed query file change for duplication against the existing `src/queries/` directory. If the new function duplicates existing functionality, the hook blocks the write and returns specific feedback about which existing function to use instead. This demonstrates **agentic hooks**: using AI inside a hook to make intelligent, context-aware decisions rather than simple pattern matching.

### Real Task: Cron + Slack Integration (`task.md`)
The practical exercise is to extend the project with a Slack integration and a daily cron job that queries for orders pending more than 3 days and posts alerts to `#order-alerts`. This exercises: reading the schema, writing queries in the correct directory (enforced by hooks), and wiring up an external integration.

**Stack:** Node.js, TypeScript, SQLite (`better-sqlite3`)

---

## Project 2 — `uigen/` (Full-Stack AI Application with Claude API)

**What it is:** A working clone of v0.dev — a chat interface where users describe a React component and Claude generates, previews, and iteratively edits it in real time.

**What it teaches:**

### Streaming Tool Use with the Vercel AI SDK
The API route (`src/app/api/chat/route.ts`) calls Claude via `streamText` with two custom tools: `str_replace_editor` (create/view/replace/insert) and `file_manager` (rename/delete/list). Claude decides which tool to call, streams the result back, and the client applies each tool call immediately via `onToolCall` — so the UI updates as Claude types. This is the core pattern for any AI app that needs to take actions, not just produce text.

### Virtual File System
No files are ever written to disk. `src/lib/file-system.ts` implements an in-memory tree (`VirtualFileSystem`). Before each API call the client serializes it to JSON and sends it with the message. The API route deserializes it, runs tool calls against it, and returns the mutated state. The client merges the result. This pattern — treating the file system as serializable client state — makes the app stateless at the server level and trivially scalable.

### Live Preview via Babel in the Browser
`src/lib/transform/jsx-transformer.ts` transpiles every `.jsx`/`.tsx` file in the virtual file system using Babel Standalone (runs entirely in the browser). It builds a Blob URL per file, constructs an ESM import map, and sets it as the iframe's `srcdoc`. Third-party packages resolve from `esm.sh` at runtime. No bundler, no server round-trip. The lesson: you can run a full transpile pipeline client-side for sandboxed preview use cases.

### Auth Without a Framework
JWT sessions via `jose` — no NextAuth, no Clerk. `src/lib/auth.ts` issues and verifies a 7-day `auth-token` cookie. The Next.js middleware (`src/middleware.ts`) protects only the project persistence routes; the chat route is intentionally open so anonymous users can generate without signing up. Anonymous work is tracked in `sessionStorage` (`src/lib/anon-work-tracker.ts`) and offered for migration on sign-up. This shows the minimum viable auth pattern for an AI app where you want low friction to first use.

### Provider Abstraction for Local Development
`src/lib/provider.ts` returns `MockLanguageModel` if `ANTHROPIC_API_KEY` is missing or set to the placeholder value, and `anthropic("claude-haiku-4-5")` otherwise. This means the app runs and tests pass with no API key. The mock returns canned responses so UI development is fast and free.

### Persistence with Prisma + SQLite
Two models: `User` (email + bcrypt password) and `Project` (messages and file-system state both stored as JSON strings). The generated Prisma client outputs to `src/generated/prisma/` so it is version-controlled and does not require a `postinstall` step in CI.

**Stack:** Next.js 15, TypeScript, Tailwind CSS, Prisma, SQLite, Vercel AI SDK, `@ai-sdk/anthropic`, Babel Standalone, Vitest, React Testing Library

---

## Project 3 — `cli_project/` (MCP Client + Terminal Chatbot)

**What it is:** A `prompt_toolkit` REPL that connects to one or more MCP servers, lets users inject documents via `@mention`, and dispatch pre-built prompt chains via `/command`.

**What it teaches:**

### Building an MCP Client from Scratch
`mcp_client.py` implements the MCP stdio transport — `list_tools`, `call_tool`, `list_prompts`, `get_prompt`, and `read_resource`. `ToolManager` fans out tool discovery and dispatch across all connected clients. This is the low-level picture of how any MCP host (including Claude Code itself) talks to servers.

### MCP Server with FastMCP
`mcp_server.py` exposes a `docs` dict as a document store via two tools (`read_doc_contents`, `edit_document`) and two resource URIs (`docs://documents`, `docs://documents/{doc_id}`). The gap between what the server exposes and what the client consumes is intentional — the TODO prompt stubs (rewrite-as-markdown, summarize) are left as exercises.

### Context Injection Patterns
Two patterns for enriching Claude's context without the user writing raw prompts:
- **`@mention`** — strips the `@`, fetches the document from the MCP resource endpoint, and injects it as `<document>` XML before the message is sent.
- **`/command`** — maps a command name to an MCP prompt, fetches the pre-built message chain, and sends it directly to Claude.

**Stack:** Python, `prompt_toolkit`, `FastMCP`, Anthropic SDK (`anthropic`)

---

## Repository Structure

```
.
├── queries/          # Project 1 — Claude Code hooks + Agent SDK
│   ├── hooks/        # query_hook.js, read_hook.js, tsc.js
│   └── src/queries/  # All DB query modules (enforced by hooks)
├── uigen/            # Project 2 — Full-stack AI app
│   ├── src/app/      # Next.js app router
│   ├── src/lib/      # File system, auth, tools, contexts, prompts
│   └── prisma/       # Schema + migrations
└── cli_project/      # Project 3 — MCP client + terminal chatbot
    ├── core/         # claude.py, chat.py, cli_chat.py, cli.py, tools.py
    ├── mcp_client.py # MCP stdio client
    └── mcp_server.py # FastMCP document store server
```

---

## Prerequisites

- Node.js 18+
- Python 3.11+ with `uv` (for `cli_project/`)
- An Anthropic API key (optional for `uigen/` — mock mode works without one)

```bash
# queries
cd queries && npm run setup

# uigen
cd uigen && npm run setup   # installs deps, generates Prisma client, runs migrations
npm run dev

# cli_project
cd cli_project && uv venv && source .venv/bin/activate && uv pip install -e .
uv run main.py
```
