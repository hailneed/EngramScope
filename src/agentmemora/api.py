from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse

from .models import MemoryCreate, OperationEventCreate
from .service import AgentMemora

DB_PATH = os.getenv("AGENTMEMORA_DB", "agentmemora.db")
lens = AgentMemora(DB_PATH)
app = FastAPI(title="AgentMemora", version="0.1.0", description="DevTools API for inspecting AI-agent memory writes, recalls, conflicts, timelines, latency, and provenance.")


@app.get("/health")
def health():
    return {"status": "ok", "service": "agentmemora"}


@app.post("/v1/memories")
def create_memory(payload: MemoryCreate):
    record, conflict = lens.remember(payload)
    return {"memory": record, "conflict": conflict}


@app.get("/v1/memories")
def list_memories(namespace: str = "default", limit: int = Query(100, ge=1, le=500)):
    return lens.list_memories(namespace, limit)


@app.get("/v1/memories/{memory_id}")
def get_memory(memory_id: str):
    record = lens.store.get(memory_id)
    if not record:
        raise HTTPException(status_code=404, detail="memory not found")
    return record


@app.get("/v1/recall")
def recall(q: str, namespace: str = "default", limit: int = Query(5, ge=1, le=50)):
    return lens.recall(q, namespace, limit)


@app.get("/v1/timeline")
def timeline(key: str, namespace: str = "default"):
    return lens.timeline(key, namespace)


@app.post("/v1/events")
def create_event(payload: OperationEventCreate):
    return lens.record(payload)


@app.get("/v1/events")
def list_events(limit: int = Query(100, ge=1, le=500), provider: str | None = None, operation: str | None = None):
    return lens.events(limit=limit, provider=provider, operation=operation)


@app.get("/")
def dashboard():
    return FileResponse(Path(__file__).with_name("static") / "index.html")
