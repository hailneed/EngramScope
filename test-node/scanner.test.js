import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanSources, analyzeSources, scannerInternals } from '../src-node/scanner.js';

test('recognizes supported agent context paths', () => {
  assert.equal(scannerInternals.isSupported('/repo/AGENTS.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.github/copilot-instructions.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.github/instructions/api.instructions.md'), true);
  assert.equal(scannerInternals.isSupported('/repo/.cursor/rules/backend.mdc'), true);
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
