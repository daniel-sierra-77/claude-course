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
2. `CliApp` (`core/cli.py`) wraps `prompt_toolkit` — handles `@resource` and `/command` autocompletion via `UnifiedCompleter` and `CommandAutoSuggest`.
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
| `MCPClient` | `mcp_client.py` | MCP stdio client; all `list_tools`, `call_tool`, `list_prompts`, `get_prompt`, `read_resource` methods are **TODO stubs** |

### MCP server (`mcp_server.py`)

Built with `FastMCP`. Currently holds only a `docs` dict. All tools, resources, and prompts are **TODO stubs** — this is the primary surface for course exercises.

- Add documents to `docs` dict.
- Implement the six TODO items (tools, resources, prompts) to enable `@mention` and `/command` features.

### Multi-client design

`main.py` instantiates one fixed `doc_client` (always `mcp_server.py`) plus any additional clients passed as CLI args. All clients are aggregated in `clients: dict[str, MCPClient]`; `ToolManager` fans out tool discovery and dispatch across all of them.
