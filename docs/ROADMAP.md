# AgentMemora Roadmap

## v0.1 — Memory Intelligence Control Plane
- [x] One-command local inspector
- [x] Claude Code JSONL session inventory
- [x] Claude auto-memory and instruction discovery
- [x] Primary session vs subagent distinction
- [x] Memory Posture dashboard
- [x] Session-only memory candidate detection (heuristic)
- [x] Context-loss risk view
- [x] Conservative durable-memory conflict detection
- [x] Context preservation coverage estimate
- [x] Context Capsule export
- [x] Resume / Fork command generation
- [x] Guarded CLI promotion into memory/instruction files
- [x] Backup before memory mutation
- [x] Localhost-only / no-telemetry defaults

## v0.2 — Curate
- [ ] Review candidate -> promote to memory from dashboard
- [ ] Memory diff / rollback UI
- [ ] Memory provenance timeline
- [ ] Stale-memory review workflow
- [ ] Better semantic contradiction detection with local/opt-in model
- [ ] Repeated correction clustering
- [ ] PII / secret redaction before capsule export

## v0.3 — Context Surgery
- [ ] Select exact turns/decisions from a session
- [ ] Generate a capsule from only the selected context
- [ ] Classify decisions, constraints, preferences, failures, open tasks, important files
- [ ] Cross-agent capsule adapters for Claude Code, Codex, Cursor and Copilot surfaces
- [ ] Import/export capsule manifest with provenance
- [ ] Cross-machine project handoff workflow

## v0.4 — Memory Reliability
- [ ] Temporal consistency checks
- [ ] Memory regression tests
- [ ] Memory poisoning / suspicious-instruction signals
- [ ] Cross-namespace leakage checks
- [ ] Retention / TTL policies
- [ ] GitHub Action for memory regression checks

## Advanced integrations
- [x] Mem0 runtime observability adapter
- [x] LangMem / LangGraph runtime observability adapter
- [ ] OpenAI Agents adapter
- [ ] Graphiti adapter
- [ ] Provider-neutral capsule/MCP bridge

## Product boundary
AgentMemora is not trying to become another memory database or an editor-usage analytics product. Its core is the lifecycle of agent context: **inspect -> understand -> curate -> preserve -> transfer**.
