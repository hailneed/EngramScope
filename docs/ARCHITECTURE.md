# Architecture

EngramScope is intentionally split into four small layers:

1. **Instrumentation / SDK** — framework-agnostic `remember()` and `recall()` calls.
2. **Event + state store** — SQLite in v0.1; Postgres is planned.
3. **Analysis layer** — conflict detection, retrieval scoring, provenance, and timelines.
4. **DevTools UI / API** — FastAPI endpoints and a zero-build dashboard.

```text
Agent / App
    |
    v
EngramScope SDK
    |
    +--> write event ----> Memory Store ----> conflict / timeline analysis
    |
    +--> recall event ---> Retrieval Trace --> score + reason
                                      |
                                      v
                             API + DevTools UI
```

The project is not intended to replace Mem0, Graphiti, Cognee, LangMem, or Hindsight. The long-term goal is to **observe and evaluate them through adapters**.
