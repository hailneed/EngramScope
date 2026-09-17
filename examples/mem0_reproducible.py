"""Credential-free demo of the Mem0-compatible adapter surface."""
from agentmemora import AgentMemora
from agentmemora.adapters import ObservedMem0

class DemoMem0:
    def __init__(self): self.memories = []
    def add(self, messages, **kwargs):
        self.memories.extend(message["content"] for message in messages)
        return {"results": [{"event": "ADD"}]}
    def search(self, query, **kwargs):
        terms = query.lower().split()
        return [memory for memory in self.memories if any(term in memory.lower() for term in terms)]

lens = AgentMemora("agentmemora-demo.db")
mem0 = ObservedMem0(DemoMem0(), lens)
mem0.add([{"role": "user", "content": "I prefer VS Code for Python"}], user_id="alice")
mem0.search("preferred editor", user_id="alice")
for event in reversed(lens.events(provider="mem0")):
    print(f"{event.provider:4} {event.operation:6} namespace={event.namespace} latency_ms={event.latency_ms:.3f} summary={event.output_summary}")
