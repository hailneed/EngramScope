# ◉ AgentMemora

**Run one command. See what your AI agents remember locally.**

> Inspect agent memory/context, provenance, duplicates, conflicts, and runtime recall behavior — without replacing your memory provider.

<p align="center"><img src="docs/AgentMemora-preview.svg" alt="AgentMemora — memory inspector and observability" width="100%" /></p>

AgentMemora is a **local-first DevTools inspector for AI agent memory and context**. The zero-integration scanner discovers supported instruction/memory surfaces used by coding agents, while the Python SDK/adapters observe live memory systems such as Mem0 and LangGraph/LangMem.

**Memory is application state. It should be observable, testable, and debuggable.**

## One-command inspector

Prerequisite: Node.js 20+.

After the npm alpha is published, the primary command is:

```bash
npx -y agentmemora@latest
```

Until the npm release is published, run the package directly from GitHub:

```bash
npx --yes --package=github:hailneed/agentmemora agentmemora
```

AgentMemora scans the current workspace plus a small allowlist of supported agent locations in your home directory, starts a dashboard on `127.0.0.1:8765`, and opens it in your browser.

Useful commands:

```bash
agentmemora scan --path C:\work\project
agentmemora scan --no-home
agentmemora scan --port 8877
agentmemora doctor
```

### What it discovers today

- `AGENTS.md`
- `CLAUDE.md` and `.claude/CLAUDE.md`
- `GEMINI.md`
- `MEMORY.md`-style explicit memory files
- `.github/copilot-instructions.md`
- `.github/instructions/**/*.instructions.md`
- `$HOME/.copilot/copilot-instructions.md`
- `$HOME/.copilot/instructions/**/*.instructions.md`
- `.cursor/rules/**`
- selected `.codex/**` Markdown/text context

AgentMemora does **not** blindly crawl your PC. It does not scan `.env`, SSH keys, browser credential stores, keychains, or arbitrary documents. Discovery is read-only, the dashboard binds to localhost, and there is no telemetry by default.

Cloud-only vendor memory cannot be discovered from disk unless that provider exposes an official/local integration surface.

## What the dashboard shows

- detected provider/source
- exact provenance path
- searchable instruction/memory content
- source size and modification metadata
- duplicate/overlapping instructions across agents
- provider counts and scan scope

Next iterations add semantic conflict detection, more tested provider-specific local adapters, and richer cross-agent timelines.

## Live memory observability

The existing Python SDK remains the advanced instrumentation layer for observing memory while an agent runs.

```python
from agentmemora import AgentMemora

lens = AgentMemora("agentmemora.db")
lens.remember(key="project.database", value="PostgreSQL", source="conversation#23", confidence=0.94)
lens.remember(key="project.database", value="MongoDB", source="conversation#41")

for hit in lens.recall("what database does the project use?"):
    print(hit.memory.value, hit.score, hit.reason)
```

### Mem0

```python
from mem0 import MemoryClient
from agentmemora import AgentMemora
from agentmemora.adapters import ObservedMem0

lens = AgentMemora("agentmemora.db")
mem0 = ObservedMem0(MemoryClient(api_key="..."), lens)
mem0.add([{"role": "user", "content": "I prefer VS Code"}], user_id="alice")
mem0.search("preferred editor", user_id="alice")
```

### LangGraph / LangMem

```python
from langgraph.store.memory import InMemoryStore
from agentmemora import AgentMemora
from agentmemora.adapters import ObservedLangGraphStore

lens = AgentMemora("agentmemora.db")
store = ObservedLangGraphStore(InMemoryStore(), lens)
store.put(("memories", "alice"), "pref-1", {"text": "I prefer dark mode"})
store.search(("memories", "alice"), query="theme preference", limit=5)
```

Raw external-provider memory payloads and search queries are not persisted by default. Payload capture is explicit opt-in for controlled development environments.

## Architecture

```text
Local discovery                         Runtime observability
AGENTS.md / CLAUDE.md / Copilot        Mem0 / LangGraph / custom memory
            |                                      |
            +------------------+-------------------+
                               |
                     provider-neutral view
                               |
                    AgentMemora DevTools UI
```

AgentMemora is **not another shared-memory database**. It is the DevTools layer beside the memory systems and context files your agents already use.

## Development

Node inspector:

```bash
npm run test:node
node ./bin/agentmemora.js --no-open
```

Python SDK:

```bash
python -m venv .venv
pip install -e '.[dev]'
pytest -q
agentmemora serve
```

## Roadmap

Next: semantic conflict detection, Graphiti/OpenAI Agents adapters, memory diff/rollback, temporal benchmarks, JSONL export, PII/secret hooks, poisoning signals, and memory regression checks.

See [ROADMAP.md](docs/ROADMAP.md).

## Contributing

Real agent-memory failure cases, discovery adapters, provider adapters, benchmark scenarios, dashboard improvements, and security checks are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
