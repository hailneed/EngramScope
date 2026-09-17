from __future__ import annotations

import time
from typing import Any

from engramscope.models import OperationEventCreate
from engramscope.service import EngramScope


class ObservedLangGraphStore:
    """Proxy a LangGraph BaseStore-compatible object and emit EngramScope events.

    The adapter deliberately uses duck typing so importing EngramScope does not require
    LangGraph. It observes sync ``put``, ``get``, ``search`` and ``delete`` calls used by
    LangGraph/LangMem stores. Raw values and queries are not persisted by default.
    """

    def __init__(self, store: Any, lens: EngramScope, *, capture_payloads: bool = False) -> None:
        self.store = store
        self.lens = lens
        self.capture_payloads = capture_payloads

    def put(self, namespace: tuple[str, ...], key: str, value: Any, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.put(namespace, key, value, *args, **kwargs)
        self._record(
            operation="write",
            namespace=namespace,
            key=key,
            latency_ms=self._elapsed(started),
            input_summary=self._value_summary(value),
            output_summary={"result_type": type(result).__name__},
        )
        return result

    def get(self, namespace: tuple[str, ...], key: str, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.get(namespace, key, *args, **kwargs)
        self._record(
            operation="get",
            namespace=namespace,
            key=key,
            latency_ms=self._elapsed(started),
            output_summary={"found": result is not None},
        )
        return result

    def search(self, namespace_prefix: tuple[str, ...], *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.search(namespace_prefix, *args, **kwargs)
        query = kwargs.get("query")
        self._record(
            operation="recall",
            namespace=namespace_prefix,
            query=query if self.capture_payloads else None,
            latency_ms=self._elapsed(started),
            input_summary={
                "query_chars": len(query) if isinstance(query, str) else 0,
                "has_filter": bool(kwargs.get("filter")),
                "limit": kwargs.get("limit"),
            },
            output_summary={"result_count": len(result) if hasattr(result, "__len__") else None},
        )
        return result

    def delete(self, namespace: tuple[str, ...], key: str, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        result = self.store.delete(namespace, key, *args, **kwargs)
        self._record(
            operation="delete",
            namespace=namespace,
            key=key,
            latency_ms=self._elapsed(started),
            output_summary={"result_type": type(result).__name__},
        )
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self.store, name)

    def _record(
        self,
        *,
        operation: str,
        namespace: tuple[str, ...],
        latency_ms: float,
        key: str | None = None,
        query: str | None = None,
        input_summary: dict[str, Any] | None = None,
        output_summary: dict[str, Any] | None = None,
    ) -> None:
        self.lens.record(
            OperationEventCreate(
                provider="langgraph",
                operation=operation,
                namespace=self._namespace(namespace),
                key=key,
                query=query,
                latency_ms=latency_ms,
                input_summary=input_summary or {},
                output_summary=output_summary or {},
                metadata={"adapter": "ObservedLangGraphStore"},
            )
        )

    def _value_summary(self, value: Any) -> dict[str, Any]:
        summary: dict[str, Any] = {"value_type": type(value).__name__}
        if isinstance(value, dict):
            summary["field_count"] = len(value)
            summary["fields"] = sorted(str(key) for key in value.keys())
        if self.capture_payloads:
            summary["payload"] = value
        return summary

    @staticmethod
    def _namespace(namespace: tuple[str, ...]) -> str:
        return "/".join(str(part) for part in namespace)

    @staticmethod
    def _elapsed(started: float) -> float:
        return (time.perf_counter() - started) * 1000
