import test from 'node:test';
import assert from 'node:assert/strict';

import { renderDashboard } from '../src-node/dashboard.js';

const memoryItem = {
  provider: 'Claude Code',
  kind: 'memory',
  path: '/Users/demo/.claude/projects/demo/memory/MEMORY.md',
  relativePath: 'memory/MEMORY.md',
  content: '# Project memory\n- Use pnpm\n',
  bytes: 32,
};

const primary = {
  id: 'primary-1',
  provider: 'Claude Code',
  kind: 'session',
  path: '/Users/demo/.claude/projects/demo/session.jsonl',
  projectSlug: 'demo',
  sessionId: 'session-123',
  isSubagent: false,
  cwd: '/Users/demo/projects/agentmemora',
  title: 'Improve memory workflow',
  modifiedAt: '2026-09-18T06:00:00.000Z',
  durationMs: 120000,
  userPrompts: 4,
  toolCalls: 8,
  toolCounts: { Read: 4, Edit: 2, Bash: 2 },
  models: ['claude-sonnet'],
  transcript: [{ role: 'user', text: 'Keep this context', timestamp: null }],
};

const subagent = {
  ...primary,
  id: 'subagent-1',
  sessionId: 'agent-456',
  isSubagent: true,
  title: 'Review memory conflicts',
  toolCalls: 3,
  transcript: [
    { role: 'assistant', text: 'I found a possible conflict.', timestamp: null },
    { role: 'user', text: 'Show the source.', timestamp: null },
  ],
};

test('dashboard renders the light top-nav memory workspace', () => {
  const html = renderDashboard({
    items: [memoryItem],
    analysis: {},
    sessions: [primary, subagent],
    sessionAnalysis: {
      totals: { sessions: 1, subagents: 1, projects: 1, userPrompts: 4, assistantMessages: 3, toolCalls: 11 },
      toolCounts: { Read: 4, Edit: 2, Bash: 2 },
      modelCounts: { 'claude-sonnet': 1 },
      projectCounts: { demo: 2 },
    },
    memoryIntelligence: {
      totals: { memories: 1, sessionCandidates: 2, contextLossRisks: 1, conflicts: 0, staleMemories: 0, preservationCoverage: 50 },
      risks: [],
      conflicts: [],
      stale: [],
      candidates: [],
      riskySessions: [],
    },
    root: '/Users/demo/projects/agentmemora',
  });

  assert.match(html, /class="topnav"/);
  assert.doesNotMatch(html, /class="sidebar"/);
  assert.match(html, /Turn agent conversations into/);
  assert.match(html, /Memory Workspace/);
  assert.match(html, /Memory Preview/);
  assert.match(html, /Subagent Conversations/);
  assert.match(html, /Review memory conflicts/);
  assert.match(html, /Context Coverage/);
  assert.match(html, /Local · Read-only/);
  assert.match(html, /selectMemory/);
});
