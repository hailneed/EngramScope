# Launch plan

The goal is not to “ask for stars.” The goal is to make EngramScope useful enough that developers save it, try it, and contribute.

## Positioning

**One sentence:** Open-source DevTools for AI-agent memory — inspect what agents store, what they recall, why it was selected, when facts conflict, and where the memory came from.

**Do not position as:** another vector database, another long-term-memory SDK, or a generic tracing platform.

## Before launch

- Ship a 10–20 second demo GIF/video showing PostgreSQL → MongoDB conflict + recall trace.
- Add a custom GitHub social preview image.
- Publish a tagged `v0.1.0-alpha` release with 5–8 concise release notes.
- Keep install-to-demo under 60 seconds and without signup.
- Add repository topics: `ai-agents`, `agent-memory`, `agentic-memory`, `observability`, `llm`, `debugging`, `developer-tools`, `mem0`, `langgraph`.
- Open 4–6 meaningful issues, including 2–3 `good first issue` items.
- Add one real integration (Mem0) before outreach.
- Add one benchmark/regression example shortly after launch.

## Launch sequence

### Launch day

1. GitHub release goes live first.
2. X thread with native demo media; GitHub link in the thread.
3. LinkedIn technical post with the problem and 15-second demo.
4. Show HN once the repo is runnable without signup.
5. Community-specific Reddit posts adapted to each community; ask for technical feedback rather than votes.

### Days 2–7

- Publish a Medium article focused on the engineering problem, not on “we launched a repo.”
- Cross-post a shortened technical version to dev.to if useful.
- Submit relevant, non-spammy PRs to curated awesome lists.
- Publish a short benchmark or “memory failure case” every few days.
- Respond quickly to every issue and PR; early contributor experience matters.

## Medium vs X

### X

Use a **thread first**, not a long X Article as the main launch asset. A thread gives multiple hooks, native demo media, and lets developers understand the project before clicking away.

Suggested structure:

1. Problem: “Agents remember now, but memory failures are still opaque.”
2. Concrete failure: stale PostgreSQL memory vs current MongoDB memory.
3. Demo clip.
4. What EngramScope captures: writes, recalls, conflicts, provenance, latency.
5. Mem0 integration snippet.
6. Roadmap: benchmarks, LangGraph, Graphiti, security.
7. GitHub link + request for failure cases/integrations.

### Medium

Yes, publish one. It helps searchability, gives you a durable explanation to link from discussions, and is better for architecture depth.

Recommended title:

> Your AI Agent Remembers — But Can You Debug Its Memory?

Do **not** make the Medium link the primary CTA at the top of the GitHub README. The README should convert visitors into users/contributors. Put the article under a `Writing / Background` section after Quickstart or Architecture.

## PR / ecosystem strategy

Good targets after the public repo exists and the integration is real:

- `IAAR-Shanghai/Awesome-AI-Memory`
- `wfnuser/Awesome-Agent-Memory`
- other curated agent/devtool lists where observability is explicitly in scope
- upstream integration/documentation pages only after the adapter is tested

Avoid mass-opening “please add my project” PRs. One accepted, relevant integration PR is worth more than ten promotional PRs.

## First public issues

1. `[integration] LangMem / LangGraph adapter`
2. `[integration] Graphiti operation adapter`
3. `[feature] memory diff + rollback model`
4. `[eval] temporal contradiction benchmark`
5. `[security] secret / PII detection hooks`
6. `[good first issue] export operation events to JSONL`

## Metrics to watch

Do not optimize only for stars. Track:

- GitHub stars / day
- unique cloners
- README → install attempts / package downloads
- issues opened by non-maintainers
- external PRs
- adapter requests
- repeat contributors

A project with 500 stars and active external contributors is healthier than a one-day 5k-star spike with no usage.
