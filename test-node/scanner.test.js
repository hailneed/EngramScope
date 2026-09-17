import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanSources, analyzeSources, scannerInternals } from '../src-node/scanner.js';

test('recognizes supported agent context and real memory paths', () => {
  assert.equal(scannerInternals.isSupported('/repo/AGENTS.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.github/copilot-instructions.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.github/instructions/api.instructions.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.cursor/rules/backend.mdc'), true);
  assert.equal(scannerInternals.isSupported('/home/alice/.claude/projects/demo/memory/MEMORY.md'), true);
  assert.equal(scannerInternals.isSupported('/home/alice/.claude/projects/demo/memory/user_role.md'), true);
  assert.equal(scannerInternals.isSupported('/home/alice/.codex/memories/project.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.env'), false);
  assert.equal(scannerInternals.isSupported('/repo/id_rsa'), false);
});

test('scans read-only supported files and detects duplicates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentmemora-'));
  fs.mkdirSync(path.join(root, '.github'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Rules\nAlways use PostgreSQL for persistence.\n');
  fs.writeFileSync(path.join(root, '.github', 'copilot-instructions.md'), 'Always use PostgreSQL for persistence.\n');
  fs.writeFileSync(path.join(root, '.env'), 'SECRET=do-not-read');
  const items = scanSources({ root, includeHome: false });
  assert.equal(items.length, 2);
  assert.equal(items.some((x) => x.path.endsWith('.env')), false);
  const analysis = analyzeSources(items);
  assert.equal(analysis.duplicates.length, 1);
});

test('discovers Claude project auto-memory and Codex memories from home', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentmemora-home-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'agentmemora-workspace-'));
  const claudeMemory = path.join(home, '.claude', 'projects', 'demo-project', 'memory');
  const codexMemory = path.join(home, '.codex', 'memories');
  const geminiDir = path.join(home, '.gemini');
  fs.mkdirSync(claudeMemory, { recursive: true });
  fs.mkdirSync(codexMemory, { recursive: true });
  fs.mkdirSync(geminiDir, { recursive: true });
  fs.writeFileSync(path.join(claudeMemory, 'MEMORY.md'), '# Project memory\nUse PostgreSQL.\n');
  fs.writeFileSync(path.join(claudeMemory, 'user_role.md'), 'The user owns the API layer.\n');
  fs.writeFileSync(path.join(codexMemory, 'project.md'), 'Prefer TypeScript for CLI code.\n');
  fs.writeFileSync(path.join(geminiDir, 'GEMINI.md'), 'Use concise answers.\n');

  const items = scanSources({ root: workspace, includeHome: true, home });
  assert.equal(items.filter((x) => x.provider === 'Claude Code' && x.kind === 'memory').length, 2);
  assert.equal(items.some((x) => x.provider === 'Codex' && x.kind === 'memory'), true);
  assert.equal(items.some((x) => x.provider === 'Gemini'), true);
});
