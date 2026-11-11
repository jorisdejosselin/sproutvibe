"""Smoke tests for the Sprout MCP server.

These exist because of a specific near-miss. Renovate proposed mcp 2.3.0 in
PR #80 and all five CI checks went green, even though the upgrade was a hard
break: 2.x renamed FastMCP to MCPServer and moved it from
`mcp.server.fastmcp` to `mcp.server.mcpserver`, so `sprout_mcp.server` would
not import at all. CI could not see it -- `mcp/` has no tests, no workflow
builds its image, and ruff and bandit are both scoped `files: ^backend/`.

So the point of this file is not coverage for its own sake. It is to make the
SDK contract this server depends on fail loudly in CI:

  - the server object constructs at all (catches import/class renames)
  - every tool is still registered, by name (catches silent drops and renames)
  - the resource and the resource template are still registered
  - the stdio transport actually completes an MCP handshake end to end

Nothing here touches the network. The tools are registered at import time and
only call the Sprout API when invoked, which these tests never do.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest  # noqa: F401  (asyncio_mode=auto needs the plugin loaded)

# The server reads its config at import time via get_client(), so give it
# something syntactically valid that points nowhere. No request is ever made.
_FAKE_ENV = {
    "SPROUT_URL": "http://localhost:1",
    "SPROUT_EMAIL": "smoke@example.com",
    "SPROUT_PASSWORD": "smoke",
}
os.environ.update(_FAKE_ENV)

from mcp.server.mcpserver import MCPServer  # noqa: E402
from sprout_mcp import server as sprout_server  # noqa: E402

# The tool contract. Adding a tool should be a deliberate edit here; losing
# one should fail the build rather than quietly shrink what the agent can do.
EXPECTED_TOOLS = {
    "add_care_schedule",
    "add_journal_entry",
    "add_plant",
    "delete_care_schedule",
    "delete_plant",
    "get_ai_care_suggestions",
    "get_plant",
    "list_due_tasks",
    "list_journal_entries",
    "list_plants",
    "mark_task_done",
    "search_species",
    "update_plant",
}

EXPECTED_RESOURCES = {"plants://list"}
EXPECTED_TEMPLATES = {"plants://{plant_id}"}


def test_server_object_is_an_mcpserver() -> None:
    """The guard that the 2.x upgrade would have tripped."""
    assert isinstance(sprout_server.mcp, MCPServer)


def test_entrypoint_is_callable() -> None:
    """`sprout-mcp` in [project.scripts] points at this."""
    assert callable(sprout_server.main)


async def test_every_expected_tool_is_registered() -> None:
    names = {t.name for t in await sprout_server.mcp.list_tools()}
    assert names == EXPECTED_TOOLS


async def test_tools_expose_a_description_and_input_schema() -> None:
    """A tool with no description or schema is useless to a model."""
    for tool in await sprout_server.mcp.list_tools():
        assert tool.description, f"{tool.name} has no description"
        schema = getattr(tool, "input_schema", None) or getattr(
            tool, "inputSchema", None
        )
        assert schema, f"{tool.name} has no input schema"
        assert schema.get("type") == "object", f"{tool.name} schema is not an object"


async def test_resource_and_template_are_registered() -> None:
    resources = {str(r.uri) for r in await sprout_server.mcp.list_resources()}
    assert resources == EXPECTED_RESOURCES

    templates = await sprout_server.mcp.list_resource_templates()
    uris = {
        getattr(t, "uri_template", None) or getattr(t, "uriTemplate", None)
        for t in templates
    }
    assert uris == EXPECTED_TEMPLATES


async def test_stdio_handshake_lists_tools_end_to_end() -> None:
    """Spawn the real server over stdio and complete an MCP handshake.

    This is the test that proves the transport and protocol layers work, not
    just that decorators ran at import time. It runs the installed console
    script the same way a client would.
    """
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    # Run via the interpreter rather than the console script so the test does
    # not depend on the venv's bin/ being on PATH.
    params = StdioServerParameters(
        command=sys.executable,
        args=["-c", "from sprout_mcp.server import main; main()"],
        env={**os.environ, **_FAKE_ENV},
        cwd=str(Path(__file__).resolve().parent.parent),
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.list_tools()

    assert {t.name for t in result.tools} == EXPECTED_TOOLS
