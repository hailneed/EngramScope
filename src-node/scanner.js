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
const MAX_FILES = 5000;
const TEXT_EXTENSIONS = new Set(['.md', '.mdc', '.txt']);

function normalized(filePath) {
  return filePath.replaceAll('\\', '/');
}

function providerFor(filePath) {
  const lower = normalized(filePath).toLowerCase();
  const base = path.basename(filePath);
  if (base === 'CLAUDE.md' || lower.includes('/.claude/')) return 'Claude Code';
  if (base === 'GEMINI.md' || lower.includes('/.gemini/')) return 'Gemini';
  if (lower.includes('/.github/') || lower.includes('/.copilot/')) return 'GitHub Copilot';
  if (lower.includes('/.cursor/')) return 'Cursor';
  if (lower.includes('/.codex/')) return 'Codex';
  if (base === 'AGENTS.md') return 'Agent instructions';
  return 'Generic memory';
}

function kindFor(filePath) {
  const lower = normalized(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  if (base === 'memory.md' || lower.includes('/memory/') || lower.includes('/memories/')) return 'memory';
  if (lower.includes('/.cursor/rules/')) return 'rule';
  if (base === 'agents.md' || base === 'claude.md' || base === 'gemini.md' || base === 'copilot-instructions.md' || lower.includes('/instructions/')) return 'instructions';
  return 'context';
}

function isSupported(filePath) {
  const value = normalized(filePath);
  const lower = value.toLowerCase();
  const base = path.basename(filePath);
  const ext = path.extname(base).toLowerCase();
  if (EXACT_FILES.has(base)) return true;
  if (/\/\.github\/instructions\/.*\.instructions\.md$/i.test(value)) return true;
  if (/\/\.copilot\/instructions\/.*\.instructions\.md$/i.test(value)) return true;
  if (lower.includes('/.cursor/rules/') && TEXT_EXTENSIONS.has(ext)) return true;
  if (lower.includes('/.codex/memories/') && TEXT_EXTENSIONS.has(ext)) return true;
  if (lower.includes('/.codex/') && TEXT_EXTENSIONS.has(ext)) return true;
  if (/\/\.claude\/projects\/[^/]+\/memory\//i.test(value) && TEXT_EXTENSIONS.has(ext)) return true;
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
    kind: kindFor(filePath),
    path: filePath,
    relativePath: path.relative(root, filePath) || path.basename(filePath),
    modifiedAt: read.stat.mtime.toISOString(),
    bytes: read.stat.size,
    content: read.content,
  };
}

function walk(root, out, state, recordRoot = root) {
  if (state.visited >= MAX_FILES) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (state.visited++ >= MAX_FILES) return;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out, state, recordRoot);
      continue;
    }
    if (entry.isFile() && isSupported(full)) {
      const item = record(full, recordRoot);
      if (item) out.push(item);
    }
  }
}

function explicitHomeCandidates(home, codexHome) {
  return [
    path.join(home, '.copilot', 'copilot-instructions.md'),
    path.join(home, '.claude', 'CLAUDE.md'),
    path.join(codexHome, 'AGENTS.md'),
    path.join(home, '.gemini', 'GEMINI.md'),
    path.join(home, 'AGENTS.md'),
    path.join(home, 'CLAUDE.md'),
    path.join(home, 'GEMINI.md'),
    path.join(home, 'MEMORY.md'),
  ];
}

function walkClaudeProjectMemories(home, out) {
  const projectsRoot = path.join(home, '.claude', 'projects');
  let projects;
  try { projects = fs.readdirSync(projectsRoot, { withFileTypes: true }); } catch { return; }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const memoryRoot = path.join(projectsRoot, project.name, 'memory');
    if (fs.existsSync(memoryRoot)) walk(memoryRoot, out, { visited: 0 }, home);
  }
}

function walkSupportedHomeDirs(home, codexHome, out) {
  const dirs = [
    path.join(home, '.copilot', 'instructions'),
    path.join(home, '.cursor', 'rules'),
    path.join(codexHome, 'memories'),
  ];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) walk(dir, out, { visited: 0 }, home);
  }
  walkClaudeProjectMemories(home, out);
}

export function scanSources({ root = process.cwd(), includeHome = true, home = os.homedir() } = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedHome = path.resolve(home);
  const codexHome = path.resolve(process.env.CODEX_HOME || path.join(resolvedHome, '.codex'));
  const items = [];
  walk(resolvedRoot, items, { visited: 0 });

  if (includeHome) {
    for (const candidate of explicitHomeCandidates(resolvedHome, codexHome)) {
      if (fs.existsSync(candidate) && isSupported(candidate)) {
        const item = record(candidate, resolvedHome);
        if (item) items.push(item);
      }
    }
    walkSupportedHomeDirs(resolvedHome, codexHome, items);
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
  const kindCounts = {};
  for (const item of items) {
    providerCounts[item.provider] = (providerCounts[item.provider] ?? 0) + 1;
    kindCounts[item.kind] = (kindCounts[item.kind] ?? 0) + 1;
  }
  return { providerCounts, kindCounts, duplicates };
}

export const scannerInternals = { isSupported, providerFor, kindFor };
