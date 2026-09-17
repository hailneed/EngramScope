#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanSources, analyzeSources } from '../src-node/scanner.js';
import { scanClaudeSessions, analyzeClaudeSessions } from '../src-node/session-scanner.js';
import { renderDashboard, startDashboard } from '../src-node/dashboard.js';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('-') ? args[0] : 'scan';
const valueOf = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 && args[i+1] ? args[i+1] : fallback; };
const has = (flag) => args.includes(flag);

function openBrowser(url) {
  const spec = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(spec[0], spec[1], { detached: true, stdio: 'ignore' }).unref(); } catch {}
}

function help() {
  console.log(`AgentMemora — local-first AI agent session, memory, and context inspector\n\nUsage:\n  agentmemora [scan] [--path <dir>] [--port 8765] [--no-home] [--no-sessions] [--no-open]\n  agentmemora sessions [--port 8765] [--no-open]\n  agentmemora doctor\n\nWhat --path means:\n  It selects the workspace whose AGENTS.md / CLAUDE.md / rules / context files are scanned.\n  Claude Code session JSONL inventory is discovered separately from ~/.claude/projects when home scanning is enabled.\n\nExamples:\n  npx -y agentmemora@latest\n  npx -y agentmemora@latest scan --path C:\\work\\project\n  npx -y agentmemora@latest sessions\n`);
}

if (has('--help') || has('-h') || command === 'help') { help(); process.exit(0); }
if (command === 'doctor') {
  console.log('AgentMemora doctor');
  console.log(`✓ Node ${process.version}`);
  console.log(`✓ Platform ${process.platform} ${process.arch}`);
  console.log(`✓ Workspace ${process.cwd()}`);
  console.log('✓ Scan mode is read-only');
  console.log('✓ Claude session discovery: ~/.claude/projects/**/*.jsonl');
  console.log('✓ Dashboard binds to 127.0.0.1 only');
  process.exit(0);
}
if (!['scan', 'sessions'].includes(command)) { console.error(`Unknown command: ${command}`); help(); process.exit(1); }

const root = path.resolve(valueOf('--path', process.cwd()));
const port = Number(valueOf('--port', '8765'));
const includeHome = command === 'sessions' ? true : !has('--no-home');
const includeSessions = command === 'sessions' || (includeHome && !has('--no-sessions'));

console.log('\n◉ AgentMemora');
console.log('  Local AI agent session, memory, and context inspector\n');
if (command !== 'sessions') console.log(`Scanning workspace: ${root}`);
console.log(includeHome ? 'Home scan: supported agent locations enabled' : 'Home scan: disabled');
console.log(includeSessions ? 'Claude sessions: ~/.claude/projects/**/*.jsonl' : 'Claude sessions: disabled');
console.log('Mode: read-only · no telemetry\n');

const items = command === 'sessions' ? [] : scanSources({ root, includeHome });
const analysis = analyzeSources(items);
const sessions = includeSessions ? scanClaudeSessions() : [];
const sessionAnalysis = analyzeClaudeSessions(sessions);

for (const [provider, count] of Object.entries(analysis.providerCounts)) console.log(`✓ ${provider}: ${count} context source${count === 1 ? '' : 's'}`);
if (includeSessions) {
  const t = sessionAnalysis.totals;
  console.log(`✓ Claude Code: ${t.sessions} sessions + ${t.subagents} subagent transcripts across ${t.projects} projects`);
  console.log(`✓ Session activity: ${t.userPrompts} user prompts · ${t.assistantMessages} assistant records · ${t.toolCalls} tool calls`);
}
console.log(`\n✓ ${items.length} supported context/memory source${items.length === 1 ? '' : 's'} discovered`);
console.log(`✓ ${analysis.duplicates.length} duplicate/overlapping instruction${analysis.duplicates.length === 1 ? '' : 's'} detected`);

const html = renderDashboard({ items, analysis, sessions, sessionAnalysis, root });
try {
  await startDashboard({ html, port });
  const url = `http://127.0.0.1:${port}`;
  console.log(`\nDashboard → ${url}`);
  console.log('Press Ctrl+C to stop.\n');
  if (!has('--no-open')) openBrowser(url);
} catch (error) {
  if (error?.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Try --port ${port + 1}.`);
  else console.error(error?.message ?? error);
  process.exit(1);
}
