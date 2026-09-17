import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeMemoryIntelligence, buildContextCapsule, appendMemory } from '../src-node/memory-intelligence.js';

const session = (overrides = {}) => ({
  sessionId: 's-1', projectSlug: 'demo', title: 'Demo session', path: '/tmp/s-1.jsonl', cwd: '/work/demo', gitBranch: 'main', modifiedAt: '2026-09-17T10:00:00Z', isSubagent: false,
  toolCounts: { Read: 3, Edit: 1 },
  transcript: [
    { role: 'user', text: 'We always use pnpm instead of npm for this project.', timestamp: '2026-09-17T09:00:00Z' },
    { role: 'assistant', text: 'Understood. I will keep the package manager consistent.', timestamp: '2026-09-17T09:01:00Z' },
  ],
  ...overrides,
});

test('flags durable-memory gaps as context-loss risks', () => {
  const result = analyzeMemoryIntelligence([], [session()]);
  assert.equal(result.totals.sessionCandidates, 1);
  assert.equal(result.totals.contextLossRisks, 1);
  assert.equal(result.risks[0].statement.includes('pnpm'), true);
});

test('marks a session candidate persisted when durable memory contains it', () => {
  const items = [{ provider: 'Claude Code', kind: 'memory', path: '/tmp/MEMORY.md', modifiedAt: '2026-09-17T00:00:00Z', content: 'We always use pnpm instead of npm for this project.' }];
  const result = analyzeMemoryIntelligence(items, [session()]);
  assert.equal(result.totals.contextLossRisks, 0);
  assert.equal(result.totals.preservationCoverage, 100);
});

test('detects conservative key-value conflicts across durable sources', () => {
  const items = [
    { provider: 'Claude Code', kind: 'memory', path: '/a/MEMORY.md', modifiedAt: '2026-09-17T00:00:00Z', content: 'Database: PostgreSQL' },
    { provider: 'Codex', kind: 'memory', path: '/b/MEMORY.md', modifiedAt: '2026-09-17T00:00:00Z', content: 'Database: MongoDB' },
  ];
  const result = analyzeMemoryIntelligence(items, []);
  assert.equal(result.totals.conflicts, 1);
  assert.deepEqual(new Set(result.conflicts[0].values), new Set(['PostgreSQL', 'MongoDB']));
});

test('builds a portable capsule without raw tool results', () => {
  const capsule = buildContextCapsule(session());
  assert.match(capsule, /Context Capsule/);
  assert.match(capsule, /pnpm/);
  assert.match(capsule, /Read: 3/);
  assert.match(capsule, /Session: s-1/);
});

test('memory append requires confirmation and creates a backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentmemora-memory-'));
  const target = path.join(dir, 'memory', 'MEMORY.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '# Existing\n', 'utf8');
  assert.throws(() => appendMemory({ target, text: '- New fact' }), /confirmation/);
  const result = appendMemory({ target, text: '- New fact', confirm: true });
  assert.match(fs.readFileSync(target, 'utf8'), /New fact/);
  assert.equal(fs.readdirSync(result.backupDir).length, 1);
});
