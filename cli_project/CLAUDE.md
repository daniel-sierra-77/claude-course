# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup & Commands

```bash
# Install dependencies
uv venv && source .venv/bin/activate
uv pip install -e .

# Run the CLI app
uv run main.py

# Run with extra MCP servers (each server_script is an additional MCP server)
uv run main.py path/to/extra_server.py
```

Required `.env` variables:
```
ANTHROPIC_API_KEY=""
CLAUDE_MODEL=""        # e.g. claude-opus-4-7
USE_UV=1               # set to 1 if running with uv; defaults to python otherwise
```

No test runner or linter is configured.

## Architecture

### Request flow

1. `main.py` boots `MCPClient` connections (one per MCP server), constructs `CliChat` and `CliApp`, then runs the event loop.
2. `CliApp` (`core/cli.py`) wraps `prompt_toolkit` — handles `@resource` and `/command` autocompletion via `UnifiedCompleter` and `CommandAutoSuggest`. Typing `/` or `@` auto-triggers the completion menu via key bindings.
3. On each user turn, `CliApp` calls `CliChat.run(query)` which inherits from `Chat.run()` (`core/chat.py`).
4. `CliChat._process_query` first checks for a `/command` (loads a pre-built MCP prompt chain), then extracts `@mention` documents and injects them as `<document>` XML into the user message.
5. `Chat.run()` loops: calls `Claude.chat()`, appends the response, and if `stop_reason == "tool_use"`, executes each tool via `ToolManager.execute_tool_requests` and feeds results back until the model stops.

### Key classes

| Class | File | Role |
|---|---|---|
| `Claude` | `core/claude.py` | Thin wrapper over `anthropic.Anthropic` — synchronous `chat()`, optional extended thinking |
| `Chat` | `core/chat.py` | Tool-use loop; manages `messages` history |
| `CliChat` | `core/cli_chat.py` | Extends `Chat` with document injection (`@mentions`) and `/command` prompt dispatch |
| `CliApp` | `core/cli.py` | `prompt_toolkit` REPL with Tab completion and inline suggestions |
| `ToolManager` | `core/tools.py` | Aggregates tools from all clients; dispatches tool calls to the right `MCPClient` |
| `MCPClient` | `mcp_client.py` | MCP stdio client; `list_tools` and `call_tool` are implemented; `list_prompts`, `get_prompt`, and `read_resource` are **TODO stubs** |

### MCP server (`mcp_server.py`)

Built with `FastMCP`. Exposes a `docs` dict as the document store.

**Implemented:**
- `read_doc_contents` tool — reads a doc by `doc_id`
- `edit_document` tool — replaces a string within a doc's content
- `docs://documents` resource — returns all doc IDs as `list[str]`
- `docs://documents/{doc_id}` resource — returns the content of a single doc

**TODO stubs** (prompts not yet implemented):
- A prompt to rewrite a doc in markdown format
- A prompt to summarize a doc

These prompts are fetched by name via `MCPClient.get_prompt(name, {"doc_id": ...})` and dispatched as pre-built message chains.

### MCP resource URI scheme

The resource contract between server and client:

| URI | Returns | Used by |
|---|---|---|
| `docs://documents` | `list[str]` of all doc IDs | `CliChat.list_docs_ids()` → `@mention` autocomplete |
| `docs://documents/{doc_id}` | `str` content of one doc | `CliChat.get_doc_content(doc_id)` → document injection |

### `@mention` and `/command` input formats

- `@mention`: User types `@deposition.md` anywhere in the message. `CliChat._extract_resources` strips `@`, looks up that ID in the server, and injects `<document id="...">content</document>` XML into the prompt before sending to Claude.
- `/command`: Must be in the form `/commandName doc_id` (e.g. `/summarize deposition.md`). `CliChat._process_command` splits on whitespace — `words[0]` is the command name, `words[1]` is the `doc_id` argument passed to `get_prompt`.

### Multi-client design

`main.py` instantiates one fixed `doc_client` (always `mcp_server.py`) plus any additional clients passed as CLI args. All clients are aggregated in `clients: dict[str, MCPClient]`; `ToolManager` fans out tool discovery and dispatch across all of them. The `doc_client` is also stored separately on `CliChat` because resource and prompt operations are always routed to it specifically.
