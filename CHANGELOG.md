# Changelog

All notable public changes to AgentMemora are documented here.

## 0.2.0 — 2026-09-18

### Project-first context browsing
- Group Claude Code history by local project.
- Show primary-session, subagent, prompt, and tool counts per project.
- Browse primary sessions in compact cards instead of one full-width stream.
- Show every indexed subagent transcript under its project rather than truncating the detailed list.
- Search across projects, sessions, subagents, models, tools, and paths.

### First-run usability
- Add a three-step Start Here path: choose a project -> inspect what survived -> preserve useful context.
- Make Projects the primary navigation path.
- Keep Resume, Fork, readable transcript, and Context Capsule actions available at session level.

### Safety
- Vendor JSONL remains read-only.
- Dashboard remains localhost-only by default.
- Durable-memory writes still require an explicit target, confirmation, and backup.

## 0.1.0

- Initial Memory Intelligence Control Plane.
- Claude Code session inventory and subagent distinction.
- Durable memory/instruction discovery.
- Context-loss candidates, conservative conflicts, stale-memory signals, and preservation coverage.
- Resume/Fork command generation and deterministic Context Capsule export.
- Guarded CLI promotion with backup.

## 0.1.0-alpha.1

- Added one-command Node inspector and local dashboard.
- Added Claude Code JSONL session inventory with primary session/subagent distinction.
- Added Claude and Codex local memory discovery.
- Added local FastAPI API and Python memory observability SDK.
- Added reference memory store with conflict detection and temporal history.
- Added provider-neutral operation events and Mem0/LangGraph adapters with privacy-safe defaults.
- Added CI for Node and Python 3.10–3.13.
