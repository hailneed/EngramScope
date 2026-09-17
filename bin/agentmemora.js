#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanSources, analyzeSources } from '../src-node/scanner.js';
import { scanClaudeSessions, analyzeClaudeSessions } from '../src-node/session-scanner.js';
import { analyzeMemoryIntelligence, buildContextCapsule, appendMemory } from '../src-node/memory-intelligence.js';
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
  console.log(`AgentMemora — memory & context control plane for AI coding agents\n\nUsage:\n  agentmemora [scan] [--path <dir>] [--port 8765] [--no-home] [--no-sessions] [--no-open]\n  agentmemora sessions [--port 8765] [--no-open]\n  agentmemora capsule --session <id> [--output context.md]\n  agentmemora promote --target <MEMORY.md|CLAUDE.md> (--text <text> | --from <file>) --yes\n  agentmemora doctor\n\nCore idea:\n  Inspect what agents know, find context that exists only inside sessions, preserve it as memory,\n  and create portable Context Capsules without editing vendor JSONL transcripts.\n\nExamples:\n  npx -y agentmemora@latest\n  agentmemora scan --path C:\\work\\project\n  agentmemora capsule --session 7a92 --output riva-context.md\n  agentmemora promote --target ~/.claude/projects/my-project/memory/MEMORY.md --text "- Use pnpm for this project" --yes\n`);
}

if (has('--help') || has('-h') || command === 'help') { help(); process.exit(0); }
if (command === 'doctor') {
  console.log('AgentMemora doctor');
  console.log(`✓ Node ${process.version}`);
  console.log(`✓ Platform ${process.platform} ${process.arch}`);
  console.log(`✓ Workspace ${process.cwd()}`);
  console.log('✓ Vendor session JSONL is read-only');
  console.log('✓ Memory writes require an explicit target and --yes');
  console.log('✓ Memory writes create a local backup first');
  console.log('✓ Claude session discovery: ~/.claude/projects/**/*.jsonl');
  console.log('✓ Dashboard binds to 127.0.0.1 only');
  process.exit(0);
}

if (command === 'capsule') {
  const sessionRef = valueOf('--session');
  if (!sessionRef) { console.error('Missing --session <id>.'); process.exit(1); }
  const sessions = scanClaudeSessions();
  const matches = sessions.filter((session) => session.sessionId === sessionRef || session.sessionId.startsWith(sessionRef));
  if (matches.length !== 1) {
    console.error(matches.length ? `Session prefix is ambiguous (${matches.length} matches). Use a longer ID.` : `Session not found: ${sessionRef}`);
    process.exit(1);
  }
  const capsule = buildContextCapsule(matches[0]);
  const output = valueOf('--output');
  if (output) {
    const target = path.resolve(output);
    fs.writeFileSync(target, capsule, 'utf8');
    console.log(`✓ Context Capsule written to ${target}`);
  } else console.log(capsule);
  process.exit(0);
}

if (command === 'promote') {
  const target = valueOf('--target');
  const from = valueOf('--from');
  const inline = valueOf('--text');
  if (!target || (!from && !inline)) {
    console.error('Usage: agentmemora promote --target <memory file> (--text <text> | --from <file>) --yes');
    process.exit(1);
  }
  let text = inline;
  if (from) text = fs.readFileSync(path.resolve(from), 'utf8');
  try {
    const result = appendMemory({ target, text, confirm: has('--yes') });
    console.log(`✓ Memory updated: ${result.target}`);
    console.log(`✓ Backup directory: ${result.backupDir}`);
    console.log(`✓ Added ${result.bytesAdded} bytes`);
  } catch (error) {
    console.error(error?.message ?? error);
    process.exit(1);
  }
  process.exit(0);
}

if (!['scan', 'sessions'].includes(command)) { console.error(`Unknown command: ${command}`); help(); process.exit(1); }

const root = path.resolve(valueOf('--path', process.cwd()));
const port = Number(valueOf('--port', '8765'));
const includeHome = command === 'sessions' ? true : !has('--no-home');
const includeSessions = command === 'sessions' || (includeHome && !has('--no-sessions'));

console.log('\n◉ AgentMemora // MEMORY INTELLIGENCE');
console.log('  Inspect · preserve · transfer agent context\n');
if (command !== 'sessions') console.log(`Scanning workspace: ${root}`);
console.log(includeHome ? 'Home scan: supported agent locations enabled' : 'Home scan: disabled');
console.log(includeSessions ? 'Claude sessions: ~/.claude/projects/**/*.jsonl' : 'Claude sessions: disabled');
console.log('Vendor session logs: read-only · dashboard: localhost · telemetry: off\n');

const items = command === 'sessions' ? [] : scanSources({ root, includeHome });
const analysis = analyzeSources(items);
const sessions = includeSessions ? scanClaudeSessions() : [];
const sessionAnalysis = analyzeClaudeSessions(sessions);
const memoryIntelligence = analyzeMemoryIntelligence(items, sessions);

for (const [provider, count] of Object.entries(analysis.providerCounts)) console.log(`✓ ${provider}: ${count} context source${count === 1 ? '' : 's'}`);
if (includeSessions) {
  const t = sessionAnalysis.totals;
  console.log(`✓ Claude Code: ${t.sessions} sessions + ${t.subagents} subagent transcripts across ${t.projects} projects`);
}
const m = memoryIntelligence.totals;
console.log(`✓ Memory posture: ${m.memories} memory files · ${m.sessionCandidates} candidate facts · ${m.contextLossRisks} context-loss risks · ${m.conflicts} potential conflicts`);
console.log(`✓ Preservation coverage: ${m.preservationCoverage}% of detected session memory candidates already appear in durable context`);

const html = renderDashboard({ items, analysis, sessions, sessionAnalysis, memoryIntelligence, root });
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
