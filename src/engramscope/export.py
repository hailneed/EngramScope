from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .service import EngramScope
    from .store import SQLiteStore


def export_events(
    store_or_lens: SQLiteStore | EngramScope,
    output: str | Path | None = None,
    format: str = "jsonl",
    provider: str | None = None,
    limit: int | None = None,
) -> str:
    """Export operation events to JSONL.

    Args:
        store_or_lens: EngramScope service instance or SQLiteStore.
        output: Optional file path to write to. If None, returns the JSONL string.
        format: Export format (currently 'jsonl').
        provider: Optional provider filter (e.g., 'mem0', 'engramscope').
        limit: Optional maximum number of events to export.

    Returns:
        JSONL formatted string.
    """
    if format.lower() != "jsonl":
        raise ValueError(f"Unsupported export format: {format!r}. Supported formats: 'jsonl'")

    if hasattr(store_or_lens, "events"):
        events = store_or_lens.events(limit=limit, provider=provider)
    else:
        events = store_or_lens.list_events(limit=limit, provider=provider)

    lines = [event.model_dump_json() for event in events]
    content = "\n".join(lines) + ("\n" if lines else "")

    if output is not None:
        out_path = Path(output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(content, encoding="utf-8")

    return content
