from engramscope import EngramScope
from engramscope.adapters import ObservedMem0


class FakeMem0Client:
    def add(self, messages, *args, **kwargs):
        return {"results": [{"id": "m1"}]}

    def search(self, query, *args, **kwargs):
        return [{"id": "m1", "memory": "secret raw memory", "score": 0.9}]


def test_mem0_adapter_records_write_and_recall_without_raw_payload(tmp_path):
    lens = EngramScope(tmp_path / "mem0.db")
    observed = ObservedMem0(FakeMem0Client(), lens)

    observed.add([{"role": "user", "content": "my secret preference"}], user_id="alice")
    observed.search("my secret query", user_id="alice")

    events = list(reversed(lens.events(provider="mem0")))
    assert [event.operation for event in events] == ["write", "recall"]
    assert all(event.namespace == "user_id:alice" for event in events)
    assert all(event.latency_ms is not None for event in events)

    write, recall = events
    assert write.input_summary == {"message_count": 1, "has_metadata": False}
    assert "payload" not in write.input_summary
    assert recall.query is None
    assert recall.input_summary["query_chars"] == len("my secret query")
    assert "my secret preference" not in str(write.model_dump())
    assert "my secret query" not in str(recall.model_dump())
