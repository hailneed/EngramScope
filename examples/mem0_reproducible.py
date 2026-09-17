"""Credential-free demo of the Mem0 adapter surface.

This deliberately tiny client implements the same add/search calls EngramScope wraps.
Swap DemoMem0 for mem0.MemoryClient or mem0.Memory to observe a real backend.
"""

from engramscope import EngramScope
from engramscope.adapters import ObservedMem0


class DemoMem0:
    def __init__(self) -> None:
        self.memories: list[str] = []

    def add(self, messages, **kwargs):
        for message in messages:
            self.memories.append(message["content"])
        return {"results": [{"event": "ADD"}]}

    def search(self, query: str, **kwargs):
        terms = query.lower().split()
        return [memory for memory in self.memories if any(term in memory.lower() for term in terms)]


lens = EngramScope("engramscope-demo.db")
mem0 = ObservedMem0(DemoMem0(), lens)

mem0.add([{"role": "user", "content": "I prefer VS Code for Python"}], user_id="alice")
mem0.search("preferred editor", user_id="alice")

for event in reversed(lens.events(provider="mem0")):
    print(
        f"{event.provider:4} {event.operation:6} "
        f"namespace={event.namespace} latency_ms={event.latency_ms:.3f} "
        f"summary={event.output_summary}"
    )
