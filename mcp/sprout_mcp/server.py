"""FastMCP server exposing Sprout plant care tools and resources."""

import asyncio
import json
import sys
from typing import Any

from mcp.server.fastmcp import FastMCP

from sprout_mcp.client import SproutAPIError, SproutClient, SproutConfigError

mcp = FastMCP(
    name="Sprout",
    instructions=(
        "You are connected to the Sprout plant care app. "
        "Use the available tools to manage plants, care schedules, and journal entries. "
        "Always confirm before deleting plants or schedules."
    ),
)

_client: SproutClient | None = None


def get_client() -> SproutClient:
    global _client
    if _client is None:
        _client = SproutClient()
    return _client


def _err(e: SproutAPIError) -> str:
    return f"Error {e.status}: {e.detail}"


def _fmt_plant(p: dict) -> str:
    parts = [f"[{p['id']}] {p['name']}"]
    if p.get("species"):
        parts.append(f"Species: {p['species']}")
    if p.get("location"):
        parts.append(f"Location: {p['location']}")
    if p.get("notes"):
        parts.append(f"Notes: {p['notes']}")
    return " | ".join(parts)


def _fmt_schedule(s: dict) -> str:
    due = s.get("next_due_at", "unknown")
    return f"[{s['id']}] {s['task_type']} every {s['frequency_days']} days — next due: {due}"


def _fmt_journal(e: dict) -> str:
    title = f" — {e['title']}" if e.get("title") else ""
    return f"[{e['id']}] {e['entry_date']}{title}: {e.get('body', '')}"


# ---------------------------------------------------------------------------
# Resources (read-only)
# ---------------------------------------------------------------------------


@mcp.resource("plants://list")
async def resource_plants_list() -> str:
    """Overview of all plants with next-due schedule annotations."""
    client = get_client()
    try:
        plants, summary = await asyncio.gather(
            client.list_plants(),
            client.get_schedules_summary(),
        )
    except SproutAPIError as e:
        return _err(e)

    by_plant: dict[int, list[dict]] = {}
    for s in summary:
        by_plant.setdefault(s["plant_id"], []).append(s)

    lines = []
    for p in plants:
        line = _fmt_plant(p)
        schedules = by_plant.get(p["id"], [])
        if schedules:
            due_parts = [f"{s['task_type']} in {s.get('days_until', '?')}d" for s in schedules]
            line += f" | Due: {', '.join(due_parts)}"
        lines.append(line)

    return "\n".join(lines) if lines else "No plants found."


@mcp.resource("plants://{plant_id}")
async def resource_plant(plant_id: str) -> str:
    """Single plant detail with schedules."""
    client = get_client()
    pid = int(plant_id)
    try:
        plant, schedules = await asyncio.gather(
            client.get_plant(pid),
            client.list_schedules(pid),
        )
    except SproutAPIError as e:
        return _err(e)

    lines = [_fmt_plant(plant)]
    if schedules:
        lines.append("Schedules:")
        lines.extend(f"  {_fmt_schedule(s)}" for s in schedules)
    else:
        lines.append("No care schedules.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tools — Plants
# ---------------------------------------------------------------------------


@mcp.tool()
async def list_plants() -> str:
    """List all plants with their next scheduled care tasks."""
    client = get_client()
    try:
        plants, summary = await asyncio.gather(
            client.list_plants(),
            client.get_schedules_summary(),
        )
    except SproutAPIError as e:
        return _err(e)

    if not plants:
        return "You have no plants yet. Use add_plant to add one!"

    by_plant: dict[int, list[dict]] = {}
    for s in summary:
        by_plant.setdefault(s["plant_id"], []).append(s)

    lines = []
    for p in plants:
        line = _fmt_plant(p)
        schedules = by_plant.get(p["id"], [])
        if schedules:
            due_parts = [f"{s['task_type']} in {s.get('days_until', '?')}d" for s in schedules]
            line += f" | Due: {', '.join(due_parts)}"
        lines.append(line)

    return f"Your plants ({len(plants)}):\n" + "\n".join(lines)


@mcp.tool()
async def get_plant(plant_id: int) -> str:
    """Get full details for a plant including schedules and recent journal entries.

    Args:
        plant_id: The numeric ID of the plant.
    """
    client = get_client()
    try:
        plant, schedules, journal = await asyncio.gather(
            client.get_plant(plant_id),
            client.list_schedules(plant_id),
            client.list_journal(plant_id, limit=5),
        )
    except SproutAPIError as e:
        return _err(e)

    lines = [_fmt_plant(plant), ""]

    lines.append("Care schedules:")
    if schedules:
        lines.extend(f"  {_fmt_schedule(s)}" for s in schedules)
    else:
        lines.append("  None")

    lines.append("")
    lines.append("Recent journal entries:")
    if journal:
        lines.extend(f"  {_fmt_journal(e)}" for e in journal[:5])
    else:
        lines.append("  None")

    return "\n".join(lines)


@mcp.tool()
async def add_plant(
    name: str,
    species: str | None = None,
    location: str | None = None,
    notes: str | None = None,
) -> str:
    """Add a new plant to Sprout.

    Args:
        name: The plant's nickname (e.g. "Big Monstera").
        species: Common or scientific species name (optional).
        location: Where the plant lives (e.g. "Living room window").
        notes: Any extra notes about the plant.
    """
    client = get_client()
    try:
        plant = await client.create_plant(name=name, species=species, location=location, notes=notes)
    except SproutAPIError as e:
        return _err(e)
    return f"Plant added! {_fmt_plant(plant)}"


@mcp.tool()
async def update_plant(
    plant_id: int,
    name: str | None = None,
    species: str | None = None,
    location: str | None = None,
    notes: str | None = None,
) -> str:
    """Update an existing plant's details.

    Args:
        plant_id: The numeric ID of the plant to update.
        name: New nickname (optional).
        species: New species name (optional).
        location: New location (optional).
        notes: New notes (optional).
    """
    client = get_client()
    try:
        plant = await client.update_plant(
            plant_id, name=name, species=species, location=location, notes=notes
        )
    except SproutAPIError as e:
        return _err(e)
    return f"Plant updated. {_fmt_plant(plant)}"


@mcp.tool()
async def delete_plant(plant_id: int) -> str:
    """Delete a plant and all its schedules and journal entries. DESTRUCTIVE — confirm with the user first.

    Args:
        plant_id: The numeric ID of the plant to delete.
    """
    client = get_client()
    try:
        await client.delete_plant(plant_id)
    except SproutAPIError as e:
        return _err(e)
    return f"Plant {plant_id} deleted."


# ---------------------------------------------------------------------------
# Tools — Schedules
# ---------------------------------------------------------------------------


@mcp.tool()
async def list_due_tasks() -> str:
    """List all care tasks that are due right now across all plants."""
    client = get_client()
    try:
        tasks = await client.get_due_tasks()
    except SproutAPIError as e:
        return _err(e)

    if not tasks:
        return "No tasks are due right now."

    lines = [f"Due tasks ({len(tasks)}):"]
    for t in tasks:
        lines.append(f"  Plant {t.get('plant_id')} — {_fmt_schedule(t)}")
    return "\n".join(lines)


@mcp.tool()
async def mark_task_done(plant_id: int, schedule_id: int) -> str:
    """Mark a care task as completed.

    Args:
        plant_id: The numeric ID of the plant.
        schedule_id: The numeric ID of the schedule/task.
    """
    client = get_client()
    try:
        result = await client.mark_schedule_done(plant_id, schedule_id)
    except SproutAPIError as e:
        return _err(e)
    next_due = result.get("next_due_at", "unknown") if result else "unknown"
    return f"Task marked done. Next due: {next_due}"


@mcp.tool()
async def add_care_schedule(plant_id: int, task_type: str, frequency_days: int) -> str:
    """Add a recurring care schedule to a plant.

    Args:
        plant_id: The numeric ID of the plant.
        task_type: Type of care task. Common values: "water", "fertilize", "mist", "repot".
            Any custom string is also accepted (e.g. "wipe leaves", "prune", "check for pests").
        frequency_days: How often to perform this task (in days).
    """
    client = get_client()
    try:
        schedule = await client.create_schedule(plant_id, task_type, frequency_days)
    except SproutAPIError as e:
        return _err(e)
    return f"Schedule added. {_fmt_schedule(schedule)}"


@mcp.tool()
async def delete_care_schedule(plant_id: int, schedule_id: int) -> str:
    """Delete a care schedule from a plant. DESTRUCTIVE — confirm with user first.

    Args:
        plant_id: The numeric ID of the plant.
        schedule_id: The numeric ID of the schedule to delete.
    """
    client = get_client()
    try:
        await client.delete_schedule(plant_id, schedule_id)
    except SproutAPIError as e:
        return _err(e)
    return f"Schedule {schedule_id} deleted from plant {plant_id}."


# ---------------------------------------------------------------------------
# Tools — Journal
# ---------------------------------------------------------------------------


@mcp.tool()
async def list_journal_entries(plant_id: int) -> str:
    """List all journal entries for a plant.

    Args:
        plant_id: The numeric ID of the plant.
    """
    client = get_client()
    try:
        entries = await client.list_journal(plant_id)
    except SproutAPIError as e:
        return _err(e)

    if not entries:
        return f"No journal entries for plant {plant_id}."

    lines = [f"Journal entries for plant {plant_id} ({len(entries)}):"]
    lines.extend(f"  {_fmt_journal(e)}" for e in entries)
    return "\n".join(lines)


@mcp.tool()
async def add_journal_entry(
    plant_id: int,
    body: str,
    title: str | None = None,
    health: str | None = None,
    entry_date: str | None = None,
) -> str:
    """Add a journal entry for a plant.

    Args:
        plant_id: The numeric ID of the plant.
        body: The journal entry text.
        title: Optional title for the entry.
        health: Optional health status. One of: "thriving", "good", "okay", "struggling", "critical".
        entry_date: Optional date for the entry in YYYY-MM-DD format. Defaults to today.
    """
    client = get_client()
    try:
        entry = await client.create_journal_entry(
            plant_id, body=body, title=title, health=health, entry_date=entry_date
        )
    except SproutAPIError as e:
        return _err(e)
    return f"Journal entry added. {_fmt_journal(entry)}"


# ---------------------------------------------------------------------------
# Tools — Species / AI
# ---------------------------------------------------------------------------


@mcp.tool()
async def search_species(query: str) -> str:
    """Search the plant species database by name.

    Args:
        query: Common or scientific name to search for.
    """
    client = get_client()
    try:
        results = await client.search_species(query)
    except SproutAPIError as e:
        return _err(e)

    if not results:
        return f"No species found for '{query}'."

    lines = [f"Species results for '{query}':"]
    for r in results:
        line = f"  [{r.get('id', '?')}] {r.get('common_name', 'Unknown')} ({r.get('scientific_name', '?')})"
        if r.get("watering"):
            line += f" | Watering: {r['watering']}"
        if r.get("sunlight"):
            sunlight = r["sunlight"] if isinstance(r["sunlight"], str) else ", ".join(r["sunlight"])
            line += f" | Sunlight: {sunlight}"
        lines.append(line)
    return "\n".join(lines)


@mcp.tool()
async def get_ai_care_suggestions(common_name: str, scientific_name: str | None = None) -> str:
    """Get AI-generated care recommendations for a plant species.

    Args:
        common_name: Common name of the plant (e.g. "Monstera").
        scientific_name: Scientific name for more accurate results (optional).
    """
    client = get_client()
    try:
        result = await client.get_ai_care(common_name, scientific_name)
    except SproutAPIError as e:
        return _err(e)

    if not result:
        return "No care suggestions returned."

    if isinstance(result, dict):
        return json.dumps(result, indent=2)
    return str(result)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    try:
        get_client()
    except SproutConfigError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
