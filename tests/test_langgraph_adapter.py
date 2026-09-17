from agentmemora import AgentMemora
from agentmemora.adapters import ObservedLangGraphStore

class FakeStore:
    def __init__(self): self.items = {}
    def put(self, namespace, key, value, *args, **kwargs): self.items[(tuple(namespace), key)] = value
    def search(self, namespace_prefix, *args, **kwargs):
        prefix = tuple(namespace_prefix)
        return [value for (namespace, _), value in self.items.items() if namespace[:len(prefix)] == prefix]
    def delete(self, namespace, key, *args, **kwargs): self.items.pop((tuple(namespace), key), None)

def test_langgraph_store_emits_events_without_raw_payloads(tmp_path):
    lens = AgentMemora(tmp_path / "events.db")
    store = ObservedLangGraphStore(FakeStore(), lens)
    store.put(("memories", "alice"), "pref-1", {"text":"I prefer dark mode","secret":"do-not-store"})
    assert len(store.search(("memories", "alice"), query="dark mode", limit=5)) == 1
    recall, write = lens.events(provider="langgraph")
    assert recall.query is None
    assert recall.output_summary["result_count"] == 1
    assert write.namespace == "memories/alice"
    assert "do-not-store" not in str(write.model_dump())

def test_langgraph_store_can_capture_payloads_explicitly(tmp_path):
    lens = AgentMemora(tmp_path / "events.db")
    store = ObservedLangGraphStore(FakeStore(), lens, capture_payloads=True)
    store.put(("memories", "alice"), "pref-1", {"text":"dark mode"})
    store.search(("memories", "alice"), query="dark mode")
    events = lens.events(provider="langgraph")
    assert events[0].query == "dark mode"
    assert events[1].input_summary["value"] == {"text":"dark mode"}
