# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repo contains three independent course projects that demonstrate different Claude integration patterns:

- **`queries/`** — Claude Code hooks + Agent SDK on top of a SQLite e-commerce database (TypeScript)
- **`uigen/`** — Full-stack AI app (v0.dev clone) built with Next.js + Claude API (TypeScript)
- **`cli_project/`** — Terminal chatbot with MCP server/client, `@mention` resource injection, and `/command` prompt dispatch (Python)

Each project has its own `CLAUDE.md` with detailed guidance. Read those before working inside a sub-project.

---

## Project 1: `queries/`

### Setup & Commands

```bash
cd queries
npm run setup        # install deps + seed the SQLite DB
npm run sdk          # run sdk.ts via tsx (Agent SDK examples)
```

No test runner is configured (`npm test` exits 1 by design).

### Hook Architecture

Three Claude Code hooks fire automatically during the session — they are registered in `.claude/settings.json` inside `queries/`:

| Hook | Trigger | Behavior |
|------|---------|----------|
| `hooks/read_hook.js` | `PreToolUse:Read` | Blocks reads of `.env` (exits 2, returns error) |
| `hooks/tsc.js` | `PostToolUse:Write` | Runs `tsc --noEmit` programmatically; surfaces type errors back to Claude so it can self-correct |
| `hooks/query_hook.js` | `PreToolUse:Write` | Spawns a Claude sub-agent via `@anthropic-ai/claude-agent-sdk` to check for duplicate query functions; blocks the write if duplication is detected |

**All query functions must be written inside `src/queries/`** — the `query_hook.js` enforces this and will block writes elsewhere with an explanation.

### Schema

`src/schema.ts` defines the full SQLite schema: `customers`, `addresses`, `customer_segments`, `customer_activity_log`, `products`, `categories`, `inventory`, `warehouses`, `orders`, `order_items`, `reviews`, `promotions`, `shipping`.

---

## Project 2: `uigen/`

### Setup & Commands

```bash
cd uigen
npm run setup        # install deps + generate Prisma client + run migrations
npm run dev          # dev server with Turbopack
npm run build
npm run lint
npm test             # Vitest + jsdom + React Testing Library
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx  # single test file
npm run db:reset
npx prisma generate && npx prisma migrate dev  # after schema changes
```

> Do not run `npm audit fix` — dependencies are pinned to specific compatible versions.

### Architecture

**Request flow:**

1. User message → `ChatContext` serializes the in-memory `VirtualFileSystem` → POST `/api/chat`
2. API route calls Claude via Vercel AI SDK `streamText` with two tools: `str_replace_editor` and `file_manager`
3. `onToolCall` fires on the client for each tool result → `FileSystemContext.handleToolCall` mutates the VFS
4. `PreviewFrame` watches a `refreshTrigger` counter; on each change it transpiles all `.jsx/.tsx` via **Babel Standalone** (runs in-browser), builds an ESM import map with `esm.sh` for third-party packages, and injects the result into an iframe as `srcdoc`

**Key invariants:**
- No files are ever written to disk. The VFS is serialized client-side and sent with every request; the server is stateless.
- The AI model entry point is `src/lib/provider.ts` — it returns `MockLanguageModel` when `ANTHROPIC_API_KEY` is absent or set to `"your-api-key-here"`, enabling full UI development without API calls.
- Every generated project must have `/App.jsx` as the entry point with a default export. Generated code must use Tailwind for styling and the `@/` alias for local imports.

**State management:** Two React contexts — `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) and `ChatContext` (`src/lib/contexts/chat-context.tsx`). `ChatContext` wraps `useChat` from Vercel AI SDK.

**Auth:** JWT via `jose`, no framework. `src/lib/auth.ts` issues/verifies a 7-day `auth-token` cookie. `/api/chat` is intentionally open; only `/api/projects` and `/api/filesystem` are protected by middleware. Anonymous work is tracked in `sessionStorage` (`src/lib/anon-work-tracker.ts`).

**Database:** Prisma + SQLite (`prisma/dev.db`). Generated client lives in `src/generated/prisma/`. Two models: `User` (email + bcrypt password) and `Project` (messages and VFS state as JSON strings).

**Tests:** Vitest + jsdom. Test files live in `__tests__/` next to their source files.

---

## Project 3: `cli_project/`

### Setup & Commands

```bash
cd cli_project
uv venv && source .venv/bin/activate
uv pip install -e .

# Run the CLI app (starts with the built-in MCP doc server)
uv run main.py

# Add extra MCP servers at startup
uv run main.py path/to/extra_server.py
```

Required `.env`:
```
ANTHROPIC_API_KEY=""
CLAUDE_MODEL=""   # e.g. claude-opus-4-7
USE_UV=1          # set to 1 when running with uv
```

No test runner or linter is configured.

### Architecture

A terminal chatbot built with `prompt_toolkit` that connects to one or more MCP servers. Key classes:

| Class | File | Role |
|---|---|---|
| `Claude` | `core/claude.py` | Thin Anthropic SDK wrapper; synchronous `chat()`, optional extended thinking |
| `Chat` | `core/chat.py` | Tool-use loop; manages message history |
| `CliChat` | `core/cli_chat.py` | Extends `Chat` with `@mention` document injection and `/command` prompt dispatch |
| `CliApp` | `core/cli.py` | `prompt_toolkit` REPL with Tab completion and inline suggestions |
| `ToolManager` | `core/tools.py` | Aggregates tools from all MCP clients; dispatches tool calls to the right client |
| `MCPClient` | `mcp_client.py` | MCP stdio client; `list_prompts`, `get_prompt`, and `read_resource` are TODO stubs |

**MCP server** (`mcp_server.py`) is built with `FastMCP` and exposes a `docs` dict as a document store. It implements `read_doc_contents` and `edit_document` tools plus `docs://documents` and `docs://documents/{doc_id}` resources. Two prompts (rewrite-as-markdown, summarize) are TODO stubs.

**Input formats:**
- `@mention` — user types `@deposition.md`; `CliChat` strips `@`, fetches the doc from the MCP server, and injects `<document id="...">content</document>` XML into the prompt.
- `/command` — form `/commandName doc_id` (e.g. `/summarize deposition.md`); dispatches to `MCPClient.get_prompt` and sends the pre-built message chain to Claude.
