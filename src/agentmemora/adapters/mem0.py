from __future__ import annotations

import time
from typing import Any

from agentmemora.models import OperationEventCreate
from agentmemora.service import AgentMemora


class ObservedMem0:
    """Thin proxy that records Mem0 add/search operations without requiring Mem0 at import time."""

    def __init__(self, client: Any, lens: AgentMemora, *, capture_payloads: bool = False) -> None:
        self.client = client
        self.lens = lens
        self.capture_payloads = capture_payloads

    def add(self, messages: Any, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.client.add(messages, *args, **kwargs)
        self.lens.record(OperationEventCreate(provider="mem0", operation="write", namespace=self._namespace(kwargs), latency_ms=(time.perf_counter() - started) * 1000, input_summary=self._input_summary(messages, kwargs), output_summary={"result_type": type(result).__name__}, metadata={"adapter": "ObservedMem0"}))
        return result

    def search(self, query: str, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.client.search(query, *args, **kwargs)
        result_count = len(result) if hasattr(result, "__len__") else None
        self.lens.record(OperationEventCreate(provider="mem0", operation="recall", namespace=self._namespace(kwargs), query=query if self.capture_payloads else None, latency_ms=(time.perf_counter() - started) * 1000, input_summary={"query_chars": len(query), "filters": bool(kwargs.get("filters"))}, output_summary={"result_count": result_count}, metadata={"adapter": "ObservedMem0"}))
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self.client, name)

    def _input_summary(self, messages: Any, kwargs: dict[str, Any]) -> dict[str, Any]:
        summary: dict[str, Any] = {"message_count": len(messages) if isinstance(messages, list) else 1, "has_metadata": bool(kwargs.get("metadata"))}
        if self.capture_payloads:
            summary["payload"] = messages
        return summary

    @staticmethod
    def _namespace(kwargs: dict[str, Any]) -> str:
        for key in ("user_id", "agent_id", "run_id"):
            if kwargs.get(key):
                return f"{key}:{kwargs[key]}"
        filters = kwargs.get("filters") or {}
        if isinstance(filters, dict):
            for key in ("user_id", "agent_id", "run_id"):
                if filters.get(key):
                    return f"{key}:{filters[key]}"
        return "default"
