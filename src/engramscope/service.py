from __future__ import annotations

import re
from pathlib import Path

from .models import (
    ConflictEvent,
    MemoryCreate,
    MemoryRecord,
    OperationEvent,
    OperationEventCreate,
    RecallHit,
)
from .store import SQLiteStore


class EngramScope:
    """Framework-agnostic observability + reference memory service."""

    def __init__(self, db_path: str | Path = "engramscope.db") -> None:
        self.store = SQLiteStore(db_path)

    def record(self, event: OperationEventCreate | None = None, **kwargs) -> OperationEvent:
        payload = event or OperationEventCreate(**kwargs)
        created = OperationEvent(**payload.model_dump())
        return self.store.insert_event(created)

    def events(self, limit: int = 100, provider: str | None = None) -> list[OperationEvent]:
        return self.store.list_events(limit=limit, provider=provider)

    def remember(self, memory: MemoryCreate | None = None, **kwargs) -> tuple[MemoryRecord, ConflictEvent | None]:
        """Reference write path used by the demo and by apps without a memory backend."""
        payload = memory or MemoryCreate(**kwargs)
        previous = self.store.active_for_key(payload.namespace, payload.key)
        conflict = None
        supersedes = None

        if previous and previous.value.strip() != payload.value.strip():
            self.store.mark_historical(previous.id)
            supersedes = previous.id

        record = MemoryRecord(**payload.model_dump(), supersedes=supersedes)
        self.store.insert(record)
        self.record(
            provider="engramscope",
            operation="write",
            namespace=record.namespace,
            key=record.key,
            memory_ids=[record.id],
            input_summary={"memory_type": record.memory_type, "source": record.source},
            output_summary={"status": record.status, "conflict": bool(supersedes)},
        )

        if previous and supersedes:
            refreshed_previous = self.store.get(previous.id) or previous
            conflict = ConflictEvent(previous=refreshed_previous, current=record)
            self.record(
                provider="engramscope",
                operation="conflict",
                namespace=record.namespace,
                key=record.key,
                memory_ids=[previous.id, record.id],
                input_summary={"previous": previous.value, "current": record.value},
                output_summary={"resolution": "previous_marked_historical"},
            )
        return record, conflict

    def recall(self, query: str, namespace: str = "default", limit: int = 5) -> list[RecallHit]:
        """Reference lexical recall path. External providers should use adapters/event recording."""
        query_terms = self._terms(query)
        hits: list[RecallHit] = []

        for memory in self.store.all_active(namespace):
            memory_terms = self._terms(f"{memory.key} {memory.value}")
            overlap = len(query_terms & memory_terms)
            union = max(1, len(query_terms | memory_terms))
            lexical = overlap / union
            exact_key_bonus = 0.35 if memory.key.lower() in query.lower() else 0.0
            score = min(1.0, lexical * 0.65 + exact_key_bonus + memory.confidence * 0.15)
            if score <= 0.05:
                continue
            reason = f"lexical_overlap={overlap}; confidence={memory.confidence:.2f}"
            hits.append(RecallHit(memory=memory, score=round(score, 4), reason=reason))

        hits.sort(key=lambda item: item.score, reverse=True)
        hits = hits[:limit]
        for hit in hits:
            self.store.log_recall(namespace, query, hit.memory.id, hit.score, hit.reason)

        self.record(
            provider="engramscope",
            operation="recall",
            namespace=namespace,
            query=query,
            memory_ids=[hit.memory.id for hit in hits],
            input_summary={"limit": limit},
            output_summary={"result_count": len(hits), "scores": [hit.score for hit in hits]},
        )
        return hits

    def timeline(self, key: str, namespace: str = "default") -> list[MemoryRecord]:
        return self.store.timeline(namespace, key)

    def list_memories(self, namespace: str = "default", limit: int = 100) -> list[MemoryRecord]:
        return self.store.list(namespace, limit)

    @staticmethod
    def _terms(text: str) -> set[str]:
        return set(re.findall(r"[a-zA-Z0-9_\-]+", text.lower()))
