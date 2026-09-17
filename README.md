# ◉ AgentMemora

**Run one command. See what your AI coding agents have been doing locally.**

> Turn local agent session logs, memory files, instructions, and runtime memory events into a readable DevTools view.

<p align="center"><img src="docs/AgentMemora-preview.svg" alt="AgentMemora — local agent session, memory, and observability inspector" width="100%" /></p>

AgentMemora is a **local-first DevTools inspector for AI agent sessions, memory, and context**. Its zero-integration scanner inventories Claude Code JSONL transcripts and supported local memory/instruction surfaces; the Python SDK/adapters observe live memory systems such as Mem0 and LangGraph/LangMem.

AgentMemora deliberately distinguishes **session history** from **curated memory**. A Claude Code `~/.claude/projects/<project>/<session>.jsonl` transcript is not the same thing as `MEMORY.md`, but both are useful state to inspect.

## One-command inspector

Prerequisite: Node.js 20+.

After the npm alpha is published:

```bash
npx -y agentmemora@latest
```

Until then, run directly from GitHub:

```bash
npx --yes --package=github:hailneed/agentmemora agentmemora
```

AgentMemora starts a read-only dashboard on `127.0.0.1:8765` and opens it in your browser.

### Claude Code session inventory

AgentMemora scans:

```text
~/.claude/projects/**/*.jsonl
```

and turns the raw JSONL into a readable inventory with:

- projects and sessions
- primary sessions vs subagent transcripts
- user prompt count
- assistant record count
- tool-call and tool-result counts
- most-used tools
- models observed
- token usage metadata persisted in the logs
- session duration, branch, cwd, file size, and source path
- readable user/assistant transcript snippets

Token values are observed JSONL metadata, not a billing statement; persistence details can vary across Claude Code versions.

To focus only on Claude session history:

```bash
agentmemora sessions
```

### How `scan --path` works

`--path` selects the **workspace/project directory** whose context files should be inspected. It does not replace Claude home-session discovery.

```bash
agentmemora scan --path /Users/alice/work/my-project
```

This scans the selected workspace for supported files such as `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/**`, and `.github/copilot-instructions.md`, while also discovering supported home-level sources and Claude JSONL sessions.

Windows example:

```powershell
agentmemora scan --path "C:\Users\alice\source\my-project"
```

Disable all home discovery, including Claude JSONL sessions:

```bash
agentmemora scan --path ./my-project --no-home
```

Keep home memory/instruction discovery but skip session JSONLs:

```bash
agentmemora scan --path ./my-project --no-sessions
```

### Memory and context sources

AgentMemora also discovers supported local surfaces including:

- `AGENTS.md`
- `CLAUDE.md`
- `~/.claude/projects/<project>/memory/**/*.md`
- `GEMINI.md` and `~/.gemini/GEMINI.md`
- `MEMORY.md`-style explicit memory files
- `.github/copilot-instructions.md`
- `.github/instructions/**/*.instructions.md`
- `$HOME/.copilot/...`
- `.cursor/rules/**`
- `$CODEX_HOME/memories/**` (default `~/.codex/memories/**`)

AgentMemora does **not** blindly crawl your PC. It does not intentionally scan `.env`, SSH keys, browser credential stores, keychains, or arbitrary documents. Discovery is read-only, the dashboard binds to localhost, and there is no telemetry by default.

## Live memory observability

The Python SDK remains the advanced instrumentation layer for observing memory while an agent runs.

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
Local session history        Local memory/context        Runtime memory
Claude Code JSONL            AGENTS / MEMORY / rules     Mem0 / LangGraph
        |                              |                       |
        +------------------------------+-----------------------+
                                       |
                            AgentMemora DevTools UI
```

AgentMemora is **not another shared-memory database**. It is an inspection and observability layer beside the state your agents already create and use.

## Development

Node inspector:

```bash
npm run test:node
node ./bin/agentmemora.js --no-open
node ./bin/agentmemora.js sessions --no-open
```

Python SDK:

```bash
python -m venv .venv
pip install -e '.[dev]'
pytest -q
agentmemora serve
```

## Roadmap

Next: richer session analytics, semantic conflict detection, Graphiti/OpenAI Agents adapters, memory diff/rollback, temporal benchmarks, JSONL export, PII/secret hooks, poisoning signals, and memory regression checks.

See [ROADMAP.md](docs/ROADMAP.md).

## Contributing

Real agent-memory/session failure cases, discovery adapters, provider adapters, benchmark scenarios, dashboard improvements, and security checks are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
