"""Reproducible Mem0-compatible observability demo with no API key.

This intentionally tiny fake client implements the two methods ObservedMem0 wraps.
Swap FakeMem0Client for mem0.MemoryClient or mem0.Memory in a real application.
"""

from engramscope import EngramScope
from engramscope.adapters import ObservedMem0


class FakeMem0Client:
    def __init__(self) -> None:
        self.memories: list[dict] = []

    def add(self, messages, *args, **kwargs):
        self.memories.extend(messages if isinstance(messages, list) else [messages])
        return {"results": [{"id": "demo-memory-1", "event": "ADD"}]}

    def search(self, query: str, *args, **kwargs):
        return [{"id": "demo-memory-1", "memory": "I prefer VS Code", "score": 0.93}]


lens = EngramScope("engramscope-mem0-demo.db")
mem0 = ObservedMem0(FakeMem0Client(), lens)

mem0.add(
    [{"role": "user", "content": "I prefer VS Code"}],
    user_id="alice",
)
mem0.search("preferred editor", user_id="alice")

print("Observed provider events:")
for event in reversed(lens.events(provider="mem0")):
    print(
        f"- {event.operation:6} namespace={event.namespace} "
        f"latency_ms={event.latency_ms:.3f} input={event.input_summary} "
        f"output={event.output_summary}"
    )
