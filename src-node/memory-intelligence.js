import fs from 'node:fs';
import path from 'node:path';

const MEMORY_HINTS = /\b(always|never|prefer|preferred|must|should|we use|we chose|decision|convention|remember|keep using|do not|don't|kullan|kullanıyoruz|kullanmay|tercih|olmalı|olsun|istemiyorum|istiyorum|karar|seçtik|unutma)\b/i;
const CORRECTION_HINTS = /\b(no[, ]|not |instead|rather|wrong|don't|do not|hayır|değil|yerine|yanlış|öyle değil)\b/i;

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[`*_#>"']/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function isDurable(item) {
  return ['memory', 'instructions', 'rule'].includes(item.kind);
}

function sentences(text) {
  return String(text || '')
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter((line) => line.length >= 18 && line.length <= 360)
    .filter((line) => !line.startsWith('```') && !/^https?:\/\//i.test(line));
}

function extractSessionCandidates(sessions) {
  const index = new Map();
  const corrections = [];
  for (const session of sessions.filter((s) => !s.isSubagent)) {
    for (const event of session.transcript || []) {
      if (event.role !== 'user') continue;
      for (const statement of sentences(event.text)) {
        if (CORRECTION_HINTS.test(statement)) corrections.push({ statement, sessionId: session.sessionId, project: session.projectSlug, timestamp: event.timestamp || session.modifiedAt });
        if (!MEMORY_HINTS.test(statement)) continue;
        const key = normalize(statement);
        if (key.length < 16) continue;
        const current = index.get(key) || { statement, normalized: key, count: 0, sessions: new Set(), projects: new Set(), lastSeen: null };
        current.count += 1;
        current.sessions.add(session.sessionId);
        current.projects.add(session.projectSlug);
        const ts = event.timestamp || session.modifiedAt;
        if (ts && (!current.lastSeen || String(ts) > String(current.lastSeen))) current.lastSeen = ts;
        index.set(key, current);
      }
    }
  }
  const candidates = [...index.values()].map((item) => ({
    ...item,
    sessions: [...item.sessions],
    projects: [...item.projects],
  })).sort((a, b) => b.sessions.length - a.sessions.length || b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen)));
  return { candidates, corrections };
}

function parseKeyValues(items) {
  const keys = new Map();
  for (const item of items.filter(isDurable)) {
    for (const raw of String(item.content || '').split(/\r?\n/)) {
      const line = raw.replace(/^\s*[-*]\s*/, '').trim();
      const match = line.match(/^([^:=]{3,64})\s*[:=]\s*(.{2,180})$/);
      if (!match) continue;
      const key = normalize(match[1]);
      const value = match[2].trim();
      if (!key || /https?\/$/.test(key) || value.startsWith('//')) continue;
      const bucket = keys.get(key) || [];
      bucket.push({ key: match[1].trim(), value, normalizedValue: normalize(value), provider: item.provider, path: item.path });
      keys.set(key, bucket);
    }
  }
  return [...keys.entries()].flatMap(([key, refs]) => {
    const values = new Map();
    for (const ref of refs) values.set(ref.normalizedValue, ref.value);
    if (values.size < 2) return [];
    return [{ key, label: refs[0].key, values: [...values.values()], refs }];
  });
}

function persistedMatch(candidate, durableItems) {
  const needle = candidate.normalized;
  const compactNeedle = needle.slice(0, 120);
  return durableItems.some((item) => {
    const corpus = normalize(item.content);
    return corpus.includes(needle) || (compactNeedle.length >= 32 && corpus.includes(compactNeedle));
  });
}

export function analyzeMemoryIntelligence(items, sessions, { now = Date.now() } = {}) {
  const durableItems = items.filter(isDurable);
  const memoryItems = items.filter((item) => item.kind === 'memory');
  const instructionItems = items.filter((item) => item.kind === 'instructions' || item.kind === 'rule');
  const { candidates, corrections } = extractSessionCandidates(sessions);
  const enriched = candidates.map((candidate) => ({ ...candidate, persisted: persistedMatch(candidate, durableItems) }));
  const risks = enriched.filter((candidate) => !candidate.persisted).slice(0, 24);
  const persistedCandidates = enriched.filter((candidate) => candidate.persisted).length;
  const coverage = enriched.length ? Math.round((persistedCandidates / enriched.length) * 100) : (durableItems.length ? 100 : 0);
  const stale = memoryItems.filter((item) => {
    const modified = Date.parse(item.modifiedAt || '');
    return Number.isFinite(modified) && now - modified > 90 * 24 * 60 * 60 * 1000;
  });
  const conflicts = parseKeyValues(items).slice(0, 24);
  const sessionRisk = new Map();
  for (const risk of risks) {
    for (const sessionId of risk.sessions) sessionRisk.set(sessionId, (sessionRisk.get(sessionId) || 0) + 1);
  }
  const riskySessions = sessions
    .filter((session) => !session.isSubagent && sessionRisk.has(session.sessionId))
    .map((session) => ({ sessionId: session.sessionId, title: session.title, project: session.projectSlug, riskCount: sessionRisk.get(session.sessionId), modifiedAt: session.modifiedAt }))
    .sort((a, b) => b.riskCount - a.riskCount || String(b.modifiedAt).localeCompare(String(a.modifiedAt)))
    .slice(0, 12);

  return {
    totals: {
      durableSources: durableItems.length,
      memories: memoryItems.length,
      instructions: instructionItems.length,
      sessionCandidates: enriched.length,
      contextLossRisks: risks.length,
      conflicts: conflicts.length,
      staleMemories: stale.length,
      repeatedCorrections: corrections.length,
      preservationCoverage: coverage,
    },
    candidates: enriched.slice(0, 40),
    risks,
    conflicts,
    stale: stale.slice(0, 20),
    corrections: corrections.slice(0, 20),
    riskySessions,
  };
}

function cleanBlock(text, max = 700) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildContextCapsule(session) {
  if (!session) throw new Error('Session is required');
  const user = (session.transcript || []).filter((event) => event.role === 'user').map((event) => cleanBlock(event.text)).filter(Boolean);
  const assistant = (session.transcript || []).filter((event) => event.role === 'assistant').map((event) => cleanBlock(event.text)).filter(Boolean);
  const tools = Object.entries(session.toolCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const lines = [
    '# AgentMemora Context Capsule',
    '',
    '> Portable, deterministic context extracted from a local Claude Code session. Review before reuse.',
    '',
    '## Provenance',
    `- Provider: Claude Code`,
    `- Project: ${session.projectSlug || 'unknown'}`,
    `- Session: ${session.sessionId}`,
    `- Source: ${session.path}`,
    `- Working directory: ${session.cwd || 'unknown'}`,
    `- Git branch: ${session.gitBranch || 'unknown'}`,
    `- Last activity: ${session.modifiedAt || 'unknown'}`,
    '',
    '## User intent and constraints',
    ...(user.slice(0, 12).map((text) => `- ${text}`)),
    '',
    '## Recent working state',
    ...(assistant.slice(-6).map((text) => `- ${text}`)),
    '',
    '## Tool footprint',
    ...(tools.length ? tools.map(([name, count]) => `- ${name}: ${count}`) : ['- No tool calls observed']),
    '',
    '## Reuse note',
    'Use this capsule as selected context for a fresh session. It is not a byte-for-byte session migration and intentionally excludes raw tool results.',
    '',
  ];
  return lines.join('\n');
}

export function appendMemory({ target, text, confirm = false }) {
  if (!confirm) throw new Error('Refusing to modify memory without explicit confirmation (--yes).');
  const resolved = path.resolve(target);
  const normalizedPath = resolved.replaceAll('\\', '/').toLowerCase();
  const basename = path.basename(resolved).toLowerCase();
  if (!(basename === 'memory.md' || basename === 'claude.md' || normalizedPath.includes('/memory/') || normalizedPath.includes('/memories/'))) {
    throw new Error('Target must be a recognized memory/instruction file (MEMORY.md, CLAUDE.md, or a memory/memories directory).');
  }
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });
  let previous = '';
  if (fs.existsSync(resolved)) previous = fs.readFileSync(resolved, 'utf8');
  const backupDir = path.join(dir, '.agentmemora-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(resolved)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir, `${stamp}-${path.basename(resolved)}`), previous, 'utf8');
  }
  const addition = String(text || '').trim();
  if (!addition) throw new Error('Memory text is empty.');
  const next = `${previous.trimEnd()}${previous.trim() ? '\n\n' : ''}${addition}\n`;
  fs.writeFileSync(resolved, next, 'utf8');
  return { target: resolved, backupDir, bytesAdded: Buffer.byteLength(addition, 'utf8') };
}

export const memoryIntelligenceInternals = { normalize, sentences, isDurable, parseKeyValues, extractSessionCandidates };
