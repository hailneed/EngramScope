from engramscope import EngramScope
from engramscope.adapters import ObservedLangGraphStore


class FakeStore:
    def __init__(self):
        self.data = {}

    def put(self, namespace, key, value, *args, **kwargs):
        self.data[(namespace, key)] = value

    def get(self, namespace, key, *args, **kwargs):
        return self.data.get((namespace, key))

    def search(self, namespace_prefix, *args, **kwargs):
        return [value for (namespace, _), value in self.data.items() if namespace[: len(namespace_prefix)] == namespace_prefix]

    def delete(self, namespace, key, *args, **kwargs):
        self.data.pop((namespace, key), None)


def test_langgraph_store_adapter_observes_memory_lifecycle(tmp_path):
    lens = EngramScope(tmp_path / "langgraph.db")
    store = ObservedLangGraphStore(FakeStore(), lens)
    namespace = ("memories", "alice")

    store.put(namespace, "editor", {"content": "VS Code", "private": "do-not-persist"})
    assert store.get(namespace, "editor")["content"] == "VS Code"
    assert store.search(namespace, query="preferred editor")
    store.delete(namespace, "editor")

    events = list(reversed(lens.events(provider="langgraph")))
    assert [event.operation for event in events] == ["write", "get", "recall", "delete"]
    assert all(event.namespace == "memories/alice" for event in events)
    assert all(event.latency_ms is not None for event in events)

    write = events[0]
    recall = events[2]
    assert write.input_summary["fields"] == ["content", "private"]
    assert "payload" not in write.input_summary
    assert "do-not-persist" not in str(write.model_dump())
    assert recall.query is None
    assert recall.input_summary["query_chars"] == len("preferred editor")
    assert "preferred editor" not in str(recall.model_dump())
