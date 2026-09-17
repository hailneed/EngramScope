import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanClaudeSessions, analyzeClaudeSessions } from '../src-node/session-scanner.js';

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
}

test('turns Claude Code JSONL into readable session inventory and tool stats', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentmemora-claude-home-'));
  const file = path.join(home, '.claude', 'projects', 'demo-project', 'session-1.jsonl');
  writeJsonl(file, [
    { type: 'user', uuid: 'u1', sessionId: 'session-1', cwd: '/work/demo', gitBranch: 'main', timestamp: '2026-09-17T10:00:00.000Z', message: { role: 'user', content: 'Please inspect the repository.' } },
    { type: 'assistant', uuid: 'a1', sessionId: 'session-1', timestamp: '2026-09-17T10:00:05.000Z', message: { role: 'assistant', model: 'claude-sonnet-test', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 }, content: [ { type: 'text', text: 'I will inspect it.' }, { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'README.md' } } ] } },
    { type: 'user', uuid: 'u2', sessionId: 'session-1', timestamp: '2026-09-17T10:00:06.000Z', message: { role: 'user', content: [ { type: 'tool_result', tool_use_id: 'tool-1', content: '# Demo' } ] } },
    { type: 'assistant', uuid: 'a2', sessionId: 'session-1', timestamp: '2026-09-17T10:00:10.000Z', message: { role: 'assistant', model: 'claude-sonnet-test', usage: { input_tokens: 120, output_tokens: 30 }, content: [ { type: 'text', text: 'The repository contains a README.' } ] } },
    { type: 'ai-title', sessionId: 'session-1', aiTitle: 'Inspect repository' },
  ]);

  const sessions = scanClaudeSessions({ home });
  assert.equal(sessions.length, 1);
  const session = sessions[0];
  assert.equal(session.title, 'Inspect repository');
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.userPrompts, 1);
  assert.equal(session.assistantMessages, 2);
  assert.equal(session.toolCalls, 1);
  assert.equal(session.toolResults, 1);
  assert.equal(session.toolCounts.Read, 1);
  assert.equal(session.usage.inputTokens, 220);
  assert.equal(session.usage.outputTokens, 50);
  assert.equal(session.transcript.some((event) => event.role === 'tool' && event.text === 'Read'), true);
  assert.equal(session.transcript.some((event) => event.role === 'user' && event.text.includes('inspect')), true);

  const analysis = analyzeClaudeSessions(sessions);
  assert.equal(analysis.totals.sessions, 1);
  assert.equal(analysis.totals.projects, 1);
  assert.equal(analysis.totals.toolCalls, 1);
  assert.equal(analysis.toolCounts.Read, 1);
});

test('discovers subagent JSONL separately from primary sessions', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentmemora-claude-subagent-'));
  writeJsonl(path.join(home, '.claude', 'projects', 'demo-project', 'main.jsonl'), [
    { type: 'user', sessionId: 'main', timestamp: '2026-09-17T10:00:00.000Z', message: { content: 'Main task' } },
  ]);
  writeJsonl(path.join(home, '.claude', 'projects', 'demo-project', 'subagents', 'agent-abc.jsonl'), [
    { type: 'assistant', sessionId: 'agent-abc', timestamp: '2026-09-17T10:00:01.000Z', message: { content: [{ type: 'tool_use', id: 'x', name: 'Bash' }] } },
  ]);

  const sessions = scanClaudeSessions({ home });
  const analysis = analyzeClaudeSessions(sessions);
  assert.equal(sessions.length, 2);
  assert.equal(analysis.totals.sessions, 1);
  assert.equal(analysis.totals.subagents, 1);
  assert.equal(analysis.toolCounts.Bash, 1);
});
