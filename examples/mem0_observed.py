"""Observe an existing Mem0 client. Requires mem0ai and MEM0_API_KEY."""
import os
from mem0 import MemoryClient
from agentmemora import AgentMemora
from agentmemora.adapters import ObservedMem0

lens = AgentMemora("agentmemora.db")
client = MemoryClient(api_key=os.environ["MEM0_API_KEY"])
memory = ObservedMem0(client, lens)
memory.add([{"role": "user", "content": "I prefer VS Code"}], user_id="alice")
memory.search("preferred editor", user_id="alice")
for event in lens.events(provider="mem0"):
    print(event.operation, event.latency_ms, event.output_summary)
