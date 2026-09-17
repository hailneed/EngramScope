from agentmemora import AgentMemora
from agentmemora.adapters import ObservedMem0

class FakeMem0:
    def add(self, messages, *args, **kwargs): return {"results":[{"id":"mem-1"}]}
    def search(self, query, *args, **kwargs): return [{"id":"mem-1","memory":"I prefer dark mode"}]

def test_mem0_adapter_emits_events_without_raw_payloads(tmp_path):
    lens = AgentMemora(tmp_path / "mem0.db")
    memory = ObservedMem0(FakeMem0(), lens)
    secret = "sk-test-secret-value"
    memory.add([{"role":"user","content":f"I prefer dark mode; token={secret}"}], user_id="alice")
    memory.search(f"dark mode {secret}", user_id="alice")
    recall, write = lens.events(provider="mem0")
    assert recall.query is None
    assert recall.output_summary["result_count"] == 1
    assert "payload" not in write.input_summary
    assert secret not in " ".join(event.model_dump_json() for event in (recall, write))

def test_mem0_adapter_can_capture_payloads_explicitly(tmp_path):
    lens = AgentMemora(tmp_path / "mem0-capture.db")
    memory = ObservedMem0(FakeMem0(), lens, capture_payloads=True)
    messages = [{"role":"user","content":"I prefer dark mode"}]
    memory.add(messages, agent_id="assistant")
    memory.search("dark mode", agent_id="assistant")
    recall, write = lens.events(provider="mem0")
    assert recall.query == "dark mode"
    assert write.input_summary["payload"] == messages
