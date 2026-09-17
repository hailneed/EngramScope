# AgentMemora scanning guide

AgentMemora uses two discovery scopes at the same time by default:

1. **Workspace scope** — the current directory, or the directory passed with `--path`.
2. **Home agent scope** — a small allowlist of supported agent-specific locations under your home directory.

It does not blindly crawl the whole computer.

## Run from GitHub before the npm release

```bash
npx --yes --package=github:hailneed/agentmemora#main agentmemora
```

Scan a specific project/workspace:

```bash
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "/absolute/path/to/project"
```

macOS/Linux examples:

```bash
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "$HOME/projects/my-app"
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "$HOME/.claude/projects"
```

PowerShell examples:

```powershell
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "$HOME\projects\my-app"
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "$HOME\.claude\projects"
```

`--path` changes the **workspace** being recursively inspected. Supported home memory locations are still checked unless `--no-home` is supplied.

```bash
# Only inspect this workspace; do not inspect supported home agent locations.
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "/path/to/project" --no-home
```

## Home locations currently discovered

- Claude Code: `~/.claude/projects/<project>/memory/**/*.md`, plus `~/.claude/CLAUDE.md`
- Codex: `$CODEX_HOME/memories/**/*.{md,txt}` (defaults to `~/.codex/memories/`) and supported text context under `.codex`
- Gemini: `~/.gemini/GEMINI.md`
- GitHub Copilot: `~/.copilot/copilot-instructions.md` and `~/.copilot/instructions/**/*.instructions.md`
- Cursor: `~/.cursor/rules/**` text/rule files
- Generic explicit files in home: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `MEMORY.md`

## Workspace locations currently discovered

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `MEMORY.md`
- `.github/copilot-instructions.md`
- `.github/instructions/**/*.instructions.md`
- `.cursor/rules/**`
- `.codex/**` supported text files
- Claude project `memory/` Markdown files when the workspace path contains them

## Safety defaults

Scanning is read-only. AgentMemora does not intentionally scan `.env`, SSH keys, browser credential stores, keychains, `node_modules`, virtual environments, build output, or arbitrary unrelated documents. The dashboard binds to `127.0.0.1` and no telemetry is sent by default.
