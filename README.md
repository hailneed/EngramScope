# ◉ EngramScope

**Open-source DevTools for AI agent memory.**

> See what your agents remember, why they remember it, and when memory goes wrong.

<p align="center">
  <img src="docs/EngramScope-demo.gif" alt="EngramScope demo — memory write, conflict detection, timeline, and recall trace" width="100%" />
</p>

<p align="center"><strong>Write → Update → Detect conflict → Recall → Explain</strong></p>

EngramScope gives AI-agent developers a local, framework-agnostic way to inspect **memory writes, recall traces, conflicts, timelines, latency, and provenance**. It is designed to sit beside memory systems such as Mem0, Graphiti, Cognee, LangMem, and Hindsight — not replace them.

**The core idea:** memory is application state. It should be observable, testable, and debuggable.

## Why EngramScope?

When an agent produces a wrong answer, the failure may be the model, prompt, RAG pipeline, tool output — or **bad memory**. Memory systems increasingly need the same observability that application code already gets from logs and traces.

EngramScope makes questions like these inspectable:

- What did the agent store?
- Where did this memory come from?
- Which memories were recalled for this response?
- Why did this memory rank highly?
- Did a new fact contradict an old one?
- What did the agent believe last week vs. today?

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
engramscope serve
```

Open `http://127.0.0.1:8765`.

Then write `project.database = PostgreSQL` and update it to `project.database = MongoDB`. EngramScope detects the conflict, marks PostgreSQL as historical, creates a timeline, and shows why the active memory is recalled instead of silently overwriting context.

## Python SDK

```python
from engramscope import EngramScope

lens = EngramScope("engramscope.db")
lens.remember(key="project.database", value="PostgreSQL", source="conversation#23", confidence=0.94)
lens.remember(key="project.database", value="MongoDB", source="conversation#41")

for hit in lens.recall("what database does the project use?"):
    print(hit.memory.value, hit.score, hit.reason)
```

## Observe existing memory systems

EngramScope records provider-neutral operation events around existing memory systems. **Raw memory payloads and search queries are not persisted by default.** Enable payload capture only when you explicitly need it in a safe development environment.

### Mem0

Wrap an already configured Mem0 client:

```python
from mem0 import MemoryClient
from engramscope import EngramScope
from engramscope.adapters import ObservedMem0

lens = EngramScope("engramscope.db")
mem0 = ObservedMem0(MemoryClient(api_key="..."), lens)
mem0.add([{"role": "user", "content": "I prefer VS Code"}], user_id="alice")
mem0.search("preferred editor", user_id="alice")
```

No Mem0 credentials yet? Run `python examples/mem0_reproducible.py` for a deterministic, credential-free demonstration of the same adapter path.

### LangGraph / LangMem

LangMem's persistent memory tools use LangGraph's store interface. EngramScope can proxy that store so writes, searches and deletes emit observability events while the underlying store remains authoritative.

```python
from langgraph.store.memory import InMemoryStore
from engramscope import EngramScope
from engramscope.adapters import ObservedLangGraphStore

lens = EngramScope("engramscope.db")
store = ObservedLangGraphStore(InMemoryStore(), lens)

store.put(("memories", "alice"), "pref-1", {"text": "I prefer dark mode"})
store.search(("memories", "alice"), query="theme preference", limit=5)
```

See `examples/langgraph_observed.py` for the runnable store example. The wrapper intentionally uses the BaseStore-style interface instead of coupling EngramScope to a specific LangMem agent implementation.

You can also POST provider-neutral events directly to `/v1/events`, making it possible to instrument custom memory stacks without adopting the reference store.

## What v0.1 includes

- **Memory Inspector** — browse agent memories and status.
- **Conflict Detection** — old facts become historical when the same key changes.
- **Timeline** — inspect how a fact changed over time.
- **Recall Trace** — see which memories were selected and the retrieval reason.
- **Provenance** — attach source information to every memory.
- **Provider-neutral Events API** — record writes/recalls from any memory backend.
- **Mem0 Adapter** — capture write/recall operations and latency without changing your Mem0 setup.
- **LangGraph Store Adapter** — observe store writes/searches/deletes used by LangGraph/LangMem memory flows.
- **REST API** — integrate any agent or framework.
- **Zero-build Dashboard** — one Python command, no frontend build step.

## API

```bash
curl -X POST http://127.0.0.1:8765/v1/memories \
  -H 'content-type: application/json' \
  -d '{
    "key": "user.editor",
    "value": "VS Code",
    "source": "conversation#12",
    "memory_type": "preference",
    "confidence": 0.97
  }'

curl 'http://127.0.0.1:8765/v1/recall?q=editor'
```

## Architecture

```text
Agent / App
    |
    +--> Mem0 ------------------+
    |                           |
    +--> LangGraph / LangMem ---+--> EngramScope operation events
    |                           |        |
    +--> Custom memory ---------+        +--> latency / namespace / result summaries
                                         +--> DevTools UI / API

EngramScope reference store ---> conflicts / timeline / recall trace
```

## Where this is going

EngramScope aims to become a **vendor-neutral observability + evaluation layer for agent memory** — closer to “DevTools for memory” than another memory database.

Planned adapters and capabilities include Graphiti, Cognee, Hindsight and other agent-memory stacks; memory benchmarks; temporal-consistency evaluation; latency/cost tracing; PII and poisoning checks; and regression tests in CI.

See [ROADMAP.md](docs/ROADMAP.md).

## Contributing

This project is intentionally early. If you build agent memory systems, your edge cases are valuable.

Good first contributions include provider adapters, real memory failure cases, benchmark scenarios, dashboard improvements, and conflict / temporal reasoning improvements.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Philosophy

**Memory should be observable, testable, and reversible.**

If agent memory becomes part of application state, developers need to debug it with the same rigor as databases, APIs, and code.

## License

MIT
