import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EXACT_FILES = new Map([
  ['AGENTS.md', 'Agent instructions'],
  ['CLAUDE.md', 'Claude Code'],
  ['GEMINI.md', 'Gemini'],
  ['MEMORY.md', 'Generic memory'],
  ['copilot-instructions.md', 'GitHub Copilot'],
]);

const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.cache']);
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 2500;

function providerFor(filePath) {
  const normalized = filePath.replaceAll('\\', '/').toLowerCase();
  const base = path.basename(filePath);
  if (base === 'CLAUDE.md' || normalized.includes('/.claude/')) return 'Claude Code';
  if (base === 'GEMINI.md' || normalized.includes('/.gemini/')) return 'Gemini';
  if (normalized.includes('/.github/') || normalized.includes('/.copilot/')) return 'GitHub Copilot';
  if (normalized.includes('/.cursor/')) return 'Cursor';
  if (normalized.includes('/.codex/')) return 'Codex';
  if (base === 'AGENTS.md') return 'Agent instructions';
  return 'Generic memory';
}

function isSupported(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const base = path.basename(filePath);
  if (EXACT_FILES.has(base)) return true;
  if (/\/\.github\/instructions\/.*\.instructions\.md$/i.test(normalized)) return true;
  if (/\/\.copilot\/instructions\/.*\.instructions\.md$/i.test(normalized)) return true;
  if (/\/\.cursor\/rules\//i.test(normalized)) return true;
  if (/\/\.codex\//i.test(normalized) && /\.(md|txt)$/i.test(base)) return true;
  return false;
}

function safeRead(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    return { content: fs.readFileSync(filePath, 'utf8'), stat };
  } catch {
    return null;
  }
}

function record(filePath, root) {
  const read = safeRead(filePath);
  if (!read) return null;
  return {
    id: Buffer.from(filePath).toString('base64url'),
    provider: providerFor(filePath),
    path: filePath,
    relativePath: path.relative(root, filePath) || path.basename(filePath),
    modifiedAt: read.stat.mtime.toISOString(),
    bytes: read.stat.size,
    content: read.content,
  };
}

function walk(root, out, state) {
  if (state.visited >= MAX_FILES) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (state.visited++ >= MAX_FILES) return;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out, state);
      continue;
    }
    if (entry.isFile() && isSupported(full)) {
      const item = record(full, root);
      if (item) out.push(item);
    }
  }
}

function explicitHomeCandidates(home) {
  return [
    path.join(home, '.copilot', 'copilot-instructions.md'),
    path.join(home, '.claude', 'CLAUDE.md'),
    path.join(home, '.codex', 'AGENTS.md'),
    path.join(home, 'AGENTS.md'),
    path.join(home, 'CLAUDE.md'),
    path.join(home, 'GEMINI.md'),
    path.join(home, 'MEMORY.md'),
  ];
}

function walkSupportedHomeDirs(home, out) {
  for (const dir of [path.join(home, '.copilot', 'instructions'), path.join(home, '.cursor', 'rules')]) {
    if (fs.existsSync(dir)) walk(dir, out, { visited: 0 });
  }
}

export function scanSources({ root = process.cwd(), includeHome = true } = {}) {
  const resolvedRoot = path.resolve(root);
  const items = [];
  walk(resolvedRoot, items, { visited: 0 });

  if (includeHome) {
    const home = os.homedir();
    for (const candidate of explicitHomeCandidates(home)) {
      if (fs.existsSync(candidate) && isSupported(candidate)) {
        const item = record(candidate, home);
        if (item) items.push(item);
      }
    }
    walkSupportedHomeDirs(home, items);
  }

  const unique = new Map(items.map((item) => [path.resolve(item.path), item]));
  return [...unique.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.path.localeCompare(b.path));
}

function meaningfulLines(content) {
  return content.split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*#>]+\s*/, '').trim())
    .filter((line) => line.length >= 12 && line.length <= 300)
    .map((line) => ({ raw: line, norm: line.toLowerCase().replace(/[`*_"']/g, '').replace(/\s+/g, ' ') }));
}

export function analyzeSources(items) {
  const lineIndex = new Map();
  for (const item of items) {
    for (const line of meaningfulLines(item.content)) {
      const bucket = lineIndex.get(line.norm) ?? [];
      bucket.push({ provider: item.provider, path: item.path, text: line.raw });
      lineIndex.set(line.norm, bucket);
    }
  }
  const duplicates = [...lineIndex.entries()]
    .filter(([, refs]) => new Set(refs.map((r) => r.path)).size > 1)
    .map(([text, refs]) => ({ text, refs }));

  const providerCounts = {};
  for (const item of items) providerCounts[item.provider] = (providerCounts[item.provider] ?? 0) + 1;
  return { providerCounts, duplicates };
}

export const scannerInternals = { isSupported, providerFor };
