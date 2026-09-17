#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanSources, analyzeSources } from '../src-node/scanner.js';
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
  console.log(`AgentMemora — local-first AI agent memory inspector\n\nUsage:\n  agentmemora [scan] [--path <dir>] [--port 8765] [--no-home] [--no-open]\n  agentmemora doctor\n\nExamples:\n  npx -y agentmemora@latest\n  npx -y agentmemora@latest scan --path C:\\work\\project\n`);
}

if (has('--help') || has('-h') || command === 'help') { help(); process.exit(0); }
if (command === 'doctor') {
  console.log('AgentMemora doctor');
  console.log(`✓ Node ${process.version}`);
  console.log(`✓ Platform ${process.platform} ${process.arch}`);
  console.log(`✓ Workspace ${process.cwd()}`);
  console.log('✓ Scan mode is read-only');
  console.log('✓ Dashboard binds to 127.0.0.1 only');
  process.exit(0);
}
if (command !== 'scan') { console.error(`Unknown command: ${command}`); help(); process.exit(1); }

const root = path.resolve(valueOf('--path', process.cwd()));
const port = Number(valueOf('--port', '8765'));
const includeHome = !has('--no-home');

console.log('\n◉ AgentMemora');
console.log('  Local AI agent memory/context inspector\n');
console.log(`Scanning workspace: ${root}`);
console.log(includeHome ? 'Home scan: supported agent locations only' : 'Home scan: disabled');
console.log('Mode: read-only · no telemetry\n');

const items = scanSources({ root, includeHome });
const analysis = analyzeSources(items);
for (const [provider, count] of Object.entries(analysis.providerCounts)) console.log(`✓ ${provider}: ${count} source${count === 1 ? '' : 's'}`);
console.log(`\n✓ ${items.length} supported source${items.length === 1 ? '' : 's'} discovered`);
console.log(`✓ ${analysis.duplicates.length} duplicate/overlapping instruction${analysis.duplicates.length === 1 ? '' : 's'} detected`);

const html = renderDashboard({ items, analysis, root });
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
