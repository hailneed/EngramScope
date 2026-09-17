from engramscope import EngramScope
from engramscope.adapters import ObservedMem0


class FakeMem0:
    def __init__(self):
        self.items = []

    def add(self, messages, *args, **kwargs):
        self.items.append(messages)
        return {"results": [{"id": "mem-1"}]}

    def search(self, query, *args, **kwargs):
        return [{"id": "mem-1", "memory": "I prefer dark mode"}]


def test_mem0_adapter_emits_events_without_raw_payloads(tmp_path):
    lens = EngramScope(tmp_path / "mem0.db")
    memory = ObservedMem0(FakeMem0(), lens)

    secret = "sk-test-secret-value"
    memory.add(
        [{"role": "user", "content": f"I prefer dark mode; token={secret}"}],
        user_id="alice",
    )
    memory.search(f"dark mode {secret}", user_id="alice")

    events = lens.events(provider="mem0")
    assert [event.operation for event in events] == ["recall", "write"]
    assert all(event.namespace == "user_id:alice" for event in events)
    assert all(event.latency_ms is not None and event.latency_ms >= 0 for event in events)

    recall, write = events
    assert recall.query is None
    assert recall.input_summary["query_chars"] == len(f"dark mode {secret}")
    assert recall.output_summary["result_count"] == 1
    assert "payload" not in write.input_summary

    serialized = " ".join(event.model_dump_json() for event in events)
    assert secret not in serialized


def test_mem0_adapter_can_capture_payloads_explicitly(tmp_path):
    lens = EngramScope(tmp_path / "mem0-capture.db")
    memory = ObservedMem0(FakeMem0(), lens, capture_payloads=True)

    messages = [{"role": "user", "content": "I prefer dark mode"}]
    memory.add(messages, agent_id="assistant")
    memory.search("dark mode", agent_id="assistant")

    recall, write = lens.events(provider="mem0")
    assert recall.query == "dark mode"
    assert write.input_summary["payload"] == messages
    assert recall.namespace == "agent_id:assistant"
    assert write.namespace == "agent_id:assistant"
