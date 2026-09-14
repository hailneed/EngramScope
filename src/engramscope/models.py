from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

MemoryType = Literal["semantic", "episodic", "preference", "procedural", "temporal", "other"]
MemoryStatus = Literal["active", "historical", "deleted"]
OperationType = Literal["write", "recall", "read", "update", "delete", "conflict", "other"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MemoryCreate(BaseModel):
    namespace: str = "default"
    key: str = Field(min_length=1)
    value: str = Field(min_length=1)
    memory_type: MemoryType = "semantic"
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryRecord(MemoryCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    status: MemoryStatus = "active"
    created_at: datetime = Field(default_factory=utcnow)
    valid_from: datetime = Field(default_factory=utcnow)
    valid_to: datetime | None = None
    supersedes: str | None = None


class RecallHit(BaseModel):
    memory: MemoryRecord
    score: float
    reason: str


class ConflictEvent(BaseModel):
    previous: MemoryRecord
    current: MemoryRecord
    reason: str = "same key received a different active value"


class OperationEventCreate(BaseModel):
    provider: str = "custom"
    operation: OperationType
    namespace: str = "default"
    run_id: str | None = None
    key: str | None = None
    query: str | None = None
    memory_ids: list[str] = Field(default_factory=list)
    latency_ms: float | None = Field(default=None, ge=0)
    input_summary: dict[str, Any] = Field(default_factory=dict)
    output_summary: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class OperationEvent(OperationEventCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utcnow)
