"""Observe a LangGraph BaseStore without changing the agent-memory architecture.

Install LangGraph to run this example:
    pip install langgraph
"""

from langgraph.store.memory import InMemoryStore

from engramscope import EngramScope
from engramscope.adapters import ObservedLangGraphStore


lens = EngramScope("engramscope-langgraph.db")
store = ObservedLangGraphStore(InMemoryStore(), lens)
namespace = ("memories", "alice")

store.put(namespace, "preference-1", {"text": "I prefer dark mode"})
store.search(namespace, query="theme preference", limit=5)

for event in reversed(lens.events(provider="langgraph")):
    print(
        f"{event.operation:6} namespace={event.namespace} "
        f"latency_ms={event.latency_ms:.3f} {event.output_summary}"
    )
