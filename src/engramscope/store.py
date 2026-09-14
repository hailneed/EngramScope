from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .models import MemoryRecord, OperationEvent


class SQLiteStore:
    def __init__(self, path: str | Path = "engramscope.db") -> None:
        self.path = str(path)
        self._init_db()

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    namespace TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    source TEXT,
                    metadata TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    valid_from TEXT NOT NULL,
                    valid_to TEXT,
                    supersedes TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_memories_namespace_key
                    ON memories(namespace, key);
                CREATE INDEX IF NOT EXISTS idx_memories_status
                    ON memories(status);

                CREATE TABLE IF NOT EXISTS recall_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    namespace TEXT NOT NULL,
                    query TEXT NOT NULL,
                    memory_id TEXT NOT NULL,
                    score REAL NOT NULL,
                    reason TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS operation_events (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    namespace TEXT NOT NULL,
                    run_id TEXT,
                    key TEXT,
                    query TEXT,
                    memory_ids TEXT NOT NULL,
                    latency_ms REAL,
                    input_summary TEXT NOT NULL,
                    output_summary TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_operation_events_created_at
                    ON operation_events(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_operation_events_provider
                    ON operation_events(provider);
                """
            )

    @staticmethod
    def _to_record(row: sqlite3.Row) -> MemoryRecord:
        payload = dict(row)
        payload["metadata"] = json.loads(payload["metadata"] or "{}")
        return MemoryRecord.model_validate(payload)

    def insert(self, record: MemoryRecord) -> MemoryRecord:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO memories (
                    id, namespace, key, value, memory_type, confidence, source,
                    metadata, status, created_at, valid_from, valid_to, supersedes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.namespace,
                    record.key,
                    record.value,
                    record.memory_type,
                    record.confidence,
                    record.source,
                    json.dumps(record.metadata),
                    record.status,
                    record.created_at.isoformat(),
                    record.valid_from.isoformat(),
                    record.valid_to.isoformat() if record.valid_to else None,
                    record.supersedes,
                ),
            )
        return record

    def get(self, memory_id: str) -> MemoryRecord | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM memories WHERE id = ?", (memory_id,)).fetchone()
        return self._to_record(row) if row else None

    def active_for_key(self, namespace: str, key: str) -> MemoryRecord | None:
        with self.connect() as conn:
            row = conn.execute(
                """SELECT * FROM memories
                   WHERE namespace = ? AND key = ? AND status = 'active'
                   ORDER BY created_at DESC LIMIT 1""",
                (namespace, key),
            ).fetchone()
        return self._to_record(row) if row else None

    def mark_historical(self, memory_id: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as conn:
            conn.execute(
                "UPDATE memories SET status = 'historical', valid_to = ? WHERE id = ?",
                (now, memory_id),
            )

    def list(self, namespace: str = "default", limit: int = 100) -> list[MemoryRecord]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT * FROM memories WHERE namespace = ?
                   ORDER BY created_at DESC LIMIT ?""",
                (namespace, limit),
            ).fetchall()
        return [self._to_record(r) for r in rows]

    def timeline(self, namespace: str, key: str) -> list[MemoryRecord]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT * FROM memories WHERE namespace = ? AND key = ?
                   ORDER BY valid_from ASC""",
                (namespace, key),
            ).fetchall()
        return [self._to_record(r) for r in rows]

    def all_active(self, namespace: str) -> list[MemoryRecord]:
        with self.connect() as conn:
            rows = conn.execute(
                """SELECT * FROM memories
                   WHERE namespace = ? AND status = 'active'
                   ORDER BY created_at DESC""",
                (namespace,),
            ).fetchall()
        return [self._to_record(r) for r in rows]

    def log_recall(self, namespace: str, query: str, memory_id: str, score: float, reason: str) -> None:
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO recall_events(namespace, query, memory_id, score, reason, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (namespace, query, memory_id, score, reason, datetime.now(timezone.utc).isoformat()),
            )

    def insert_event(self, event: OperationEvent) -> OperationEvent:
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO operation_events(
                    id, provider, operation, namespace, run_id, key, query, memory_ids,
                    latency_ms, input_summary, output_summary, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    event.id, event.provider, event.operation, event.namespace, event.run_id,
                    event.key, event.query, json.dumps(event.memory_ids), event.latency_ms,
                    json.dumps(event.input_summary), json.dumps(event.output_summary),
                    json.dumps(event.metadata), event.created_at.isoformat(),
                ),
            )
        return event

    def list_events(self, limit: int = 100, provider: str | None = None) -> list[OperationEvent]:
        sql = "SELECT * FROM operation_events"
        params: list[object] = []
        if provider:
            sql += " WHERE provider = ?"
            params.append(provider)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self.connect() as conn:
            rows = conn.execute(sql, tuple(params)).fetchall()
        events: list[OperationEvent] = []
        for row in rows:
            payload = dict(row)
            for field in ("memory_ids", "input_summary", "output_summary", "metadata"):
                payload[field] = json.loads(payload[field] or ("[]" if field == "memory_ids" else "{}"))
            events.append(OperationEvent.model_validate(payload))
        return events
