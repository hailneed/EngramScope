from __future__ import annotations

import time
from typing import Any

from agentmemora.models import OperationEventCreate
from agentmemora.service import AgentMemora


class ObservedLangGraphStore:
    """Proxy a LangGraph BaseStore and emit provider-neutral AgentMemora events."""

    def __init__(self, store: Any, lens: AgentMemora, *, capture_payloads: bool = False) -> None:
        self.store = store
        self.lens = lens
        self.capture_payloads = capture_payloads

    def put(self, namespace: tuple[str, ...], key: str, value: dict[str, Any], *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.put(namespace, key, value, *args, **kwargs)
        self._record("write", namespace, started, key=key, input_summary=self._value_summary(value))
        return result

    def search(self, namespace_prefix: tuple[str, ...], *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.search(namespace_prefix, *args, **kwargs)
        query = kwargs.get("query")
        result_count = len(result) if hasattr(result, "__len__") else None
        self._record("recall", namespace_prefix, started, query=query if self.capture_payloads else None, input_summary={"query_chars": len(query) if isinstance(query, str) else 0, "has_filter": bool(kwargs.get("filter")), "limit": kwargs.get("limit")}, output_summary={"result_count": result_count})
        return result

    def delete(self, namespace: tuple[str, ...], key: str, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.delete(namespace, key, *args, **kwargs)
        self._record("delete", namespace, started, key=key)
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self.store, name)

    def _record(self, operation: str, namespace: tuple[str, ...], started: float, *, key: str | None = None, query: str | None = None, input_summary: dict[str, Any] | None = None, output_summary: dict[str, Any] | None = None) -> None:
        self.lens.record(OperationEventCreate(provider="langgraph", operation=operation, namespace="/".join(str(part) for part in namespace), key=key, query=query, latency_ms=(time.perf_counter() - started) * 1000, input_summary=input_summary or {}, output_summary=output_summary or {}, metadata={"adapter": "ObservedLangGraphStore"}))

    def _value_summary(self, value: dict[str, Any]) -> dict[str, Any]:
        summary: dict[str, Any] = {"value_keys": sorted(str(key) for key in value.keys())}
        if self.capture_payloads:
            summary["value"] = value
        return summary
