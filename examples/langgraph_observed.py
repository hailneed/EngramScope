"""Observe a LangGraph BaseStore. Install with: pip install langgraph"""
from langgraph.store.memory import InMemoryStore
from agentmemora import AgentMemora
from agentmemora.adapters import ObservedLangGraphStore

lens = AgentMemora("agentmemora-langgraph.db")
store = ObservedLangGraphStore(InMemoryStore(), lens)
namespace = ("memories", "alice")
store.put(namespace, "preference-1", {"text": "I prefer dark mode"})
store.search(namespace, query="theme preference", limit=5)
for event in reversed(lens.events(provider="langgraph")):
    print(f"{event.operation:6} namespace={event.namespace} latency_ms={event.latency_ms:.3f} {event.output_summary}")
