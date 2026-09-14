"""Example: observe an existing Mem0 client.

Requires: pip install mem0ai
Set MEM0_API_KEY before running.
"""

import os

from mem0 import MemoryClient

from engramscope import EngramScope
from engramscope.adapters import ObservedMem0

lens = EngramScope("engramscope.db")
client = MemoryClient(api_key=os.environ["MEM0_API_KEY"])
memory = ObservedMem0(client, lens)

memory.add(
    [{"role": "user", "content": "I prefer VS Code"}],
    user_id="alice",
)
memory.search("preferred editor", user_id="alice")

for event in lens.events(provider="mem0"):
    print(event.operation, event.latency_ms, event.output_summary)
