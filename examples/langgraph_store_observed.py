"""Observe LangGraph/LangMem BaseStore operations with EngramScope.

Requires: pip install langgraph
No LLM or embedding API key is required for this example.
"""

from langgraph.store.memory import InMemoryStore

from engramscope import EngramScope
from engramscope.adapters import ObservedLangGraphStore


lens = EngramScope("engramscope-langgraph-demo.db")
store = ObservedLangGraphStore(InMemoryStore(), lens)
namespace = ("memories", "alice")

store.put(namespace, "editor", {"content": "I prefer VS Code"})
print(store.get(namespace, "editor"))
print(store.search(namespace))

print("\nObserved LangGraph events:")
for event in reversed(lens.events(provider="langgraph")):
    print(event.operation, event.namespace, event.latency_ms, event.input_summary)

# Pass `store` anywhere a LangGraph/LangMem BaseStore-compatible store is accepted.
# LangMem's memory tools use LangGraph's storage layer for persistence/search.
