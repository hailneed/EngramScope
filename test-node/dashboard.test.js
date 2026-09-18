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

const extraSubagents = Array.from({ length: 10 }, (_, index) => ({
  ...subagent,
  id: `subagent-extra-${index + 1}`,
  sessionId: `agent-extra-${index + 1}`,
  title: `Subagent trace ${index + 1}`,
  toolCalls: index + 1,
}));

const secondProject = {
  ...primary,
  id: 'primary-2',
  sessionId: 'session-789',
  projectSlug: 'second-project',
  cwd: '/Users/demo/projects/second-project',
  title: 'Second project session',
};

test('dashboard renders the intelligence terminal memory workspace', () => {
  const html = renderDashboard({
    items: [memoryItem],
    analysis: {},
    sessions: [primary, subagent, ...extraSubagents, secondProject],
    sessionAnalysis: {
      totals: { sessions: 2, subagents: 11, projects: 2, userPrompts: 8, assistantMessages: 3, toolCalls: 76 },
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
  assert.match(html, /Know what your agents/);
  assert.match(html, /START HERE/);
  assert.match(html, /Choose a project/);
  assert.match(html, /Preserve useful context/);
  assert.match(html, /Memory Intelligence Workspace/);
  assert.match(html, /Memory Evidence Viewer/);
  assert.match(html, /Subagent Comms/);
  assert.match(html, /Project Explorer &amp; Context Transfer|Project Explorer & Context Transfer/);
  assert.match(html, /agentmemora/);
  assert.match(html, /second-project/);
  assert.match(html, /11 total/);
  assert.match(html, /Subagent trace 10/);
  assert.doesNotMatch(html, /SHOW ALL SUBAGENT TRANSCRIPTS/);
  assert.match(html, /Review memory conflicts/);
  assert.match(html, /Context Coverage/);
  assert.match(html, /Local · Read-only/);
  assert.match(html, /class="intel-strip"/);
  assert.match(html, /OPERATIONAL MEMORY INTELLIGENCE/);
  assert.match(html, /WRITE GUARD/);
  assert.match(html, /selectMemory/);
});
