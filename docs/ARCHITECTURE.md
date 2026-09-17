# Architecture

AgentMemora is split into four small layers:

1. **Instrumentation / adapters** — provider-neutral events around existing memory systems.
2. **Event + reference state store** — SQLite in v0.1; Postgres is planned.
3. **Analysis layer** — conflict detection, retrieval scoring, provenance, and timelines.
4. **DevTools UI / API** — FastAPI endpoints and a zero-build dashboard.

```text
Agent / App
    |
    +--> Mem0 ------------------+
    +--> LangGraph / LangMem ---+--> AgentMemora Events API
    +--> Custom memory ---------+        |
                                         +--> provider / operation / latency
                                         +--> Dashboard + filters

AgentMemora reference store ---> conflict / timeline / recall trace
```

AgentMemora does not replace Mem0, Graphiti, Cognee, LangMem, or Hindsight. The goal is to observe and evaluate memory systems through adapters.
