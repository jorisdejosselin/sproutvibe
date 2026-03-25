# Sprout MCP Server

An MCP (Model Context Protocol) server for the [Sprout](https://sprout.example.com) plant care app. Lets AI assistants like Claude Desktop manage your plants via natural language.

## Requirements

- Python 3.11+ (only if running locally via pipx)
- Docker (preferred)

## Running with Docker

Build and run the container:

```bash
docker build -t sprout-mcp .
docker run --rm -i \
  -e SPROUT_URL=https://sprout.example.com \
  -e SPROUT_EMAIL=you@example.com \
  -e SPROUT_PASSWORD=secret \
  sprout-mcp
```

## Local install (pipx)

Only use this if you can't run Docker:

```bash
cd mcp
pipx install .
SPROUT_URL=... SPROUT_EMAIL=... SPROUT_PASSWORD=... sprout-mcp
```

## Configuration

| Variable | Description |
|---|---|
| `SPROUT_URL` | Base URL of your Sprout instance, e.g. `https://sprout.example.com` |
| `SPROUT_EMAIL` | Your Sprout account email |
| `SPROUT_PASSWORD` | Your Sprout account password |

Copy `.env.example` as a reference.

## Development / Testing

Use the MCP inspector to test tools interactively (requires `uv`):

```bash
SPROUT_URL=... SPROUT_EMAIL=... SPROUT_PASSWORD=... \
mcp dev sprout_mcp/server.py
```

Then open http://localhost:5173 in your browser.

## Claude Desktop Integration

### Option A — Docker (preferred)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sprout": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "SPROUT_URL",
        "-e", "SPROUT_EMAIL",
        "-e", "SPROUT_PASSWORD",
        "sprout-mcp"
      ],
      "env": {
        "SPROUT_URL": "https://sprout.example.com",
        "SPROUT_EMAIL": "admin@example.com",
        "SPROUT_PASSWORD": "<your password>"
      }
    }
  }
}
```

### Option B — uv run (local, no install)

```json
{
  "mcpServers": {
    "sprout": {
      "command": "uv",
      "args": ["run", "--project", "~/path/to/sprout/mcp", "sprout-mcp"],
      "env": {
        "SPROUT_URL": "https://sprout.example.com",
        "SPROUT_EMAIL": "admin@example.com",
        "SPROUT_PASSWORD": "<your password>"
      }
    }
  }
}
```

Restart Claude Desktop and ask: *"What plants do I have in Sprout?"*

## Available Tools

| Tool | Description |
|---|---|
| `list_plants` | All plants with next-due schedule annotations |
| `get_plant` | Full plant detail (schedules + last 5 journal entries) |
| `add_plant` | Create a new plant |
| `update_plant` | Edit plant details |
| `delete_plant` | Delete a plant (destructive) |
| `list_due_tasks` | All care tasks due right now |
| `mark_task_done` | Mark a task as completed |
| `add_care_schedule` | Add a recurring care schedule |
| `delete_care_schedule` | Remove a care schedule |
| `list_journal_entries` | List journal entries for a plant |
| `add_journal_entry` | Add a journal entry |
| `search_species` | Search the species database |
| `get_ai_care_suggestions` | Get AI-generated care tips |

## Resources

- `plants://list` — Overview of all plants
- `plants://{plant_id}` — Single plant with schedules
