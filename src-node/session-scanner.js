import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MAX_JSONL_BYTES = 100 * 1024 * 1024;
const MAX_SESSION_FILES = 2000;
const MAX_TRANSCRIPT_EVENTS = 160;
const MAX_TEXT_CHARS = 1800;

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function textFromContent(content) {
  if (typeof content === 'string') return content.trim();
  const parts = [];
  for (const block of asArray(content)) {
    if (typeof block === 'string') parts.push(block);
    else if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.join('\n').trim();
}

function addCount(target, key, amount = 1) {
  if (!key) return;
  target[key] = (target[key] ?? 0) + amount;
}

function walkJsonl(root, out) {
  if (out.length >= MAX_SESSION_FILES) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (out.length >= MAX_SESSION_FILES) return;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walkJsonl(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) out.push(full);
  }
}

function parseClaudeSession(filePath, projectsRoot) {
  let stat;
  let raw;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_JSONL_BYTES) return null;
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const relative = path.relative(projectsRoot, filePath);
  const segments = relative.split(path.sep);
  const projectSlug = segments[0] || 'unknown-project';
  const isSubagent = segments.some((part) => part.toLowerCase() === 'subagents') || path.basename(filePath).startsWith('agent-');
  const fallbackSessionId = path.basename(filePath, '.jsonl');
  const entryTypes = {};
  const toolCounts = {};
  const models = new Set();
  const userIds = new Set();
  const assistantIds = new Set();
  const toolUseIds = new Set();
  const toolResultIds = new Set();
  const transcript = [];
  const usage = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };
  let userWithoutId = 0;
  let assistantWithoutId = 0;
  let userPrompts = 0;
  let thinkingBlocks = 0;
  let parseErrors = 0;
  let sessionId = null;
  let cwd = null;
  let gitBranch = null;
  let title = null;
  let firstPrompt = null;
  let firstTimestamp = null;
  let lastTimestamp = null;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { parseErrors += 1; continue; }
    const type = entry?.type || 'unknown';
    addCount(entryTypes, type);
    sessionId ||= entry?.sessionId || null;
    cwd ||= entry?.cwd || entry?.originCwd || null;
    gitBranch ||= entry?.gitBranch || null;
    if (type === 'custom-title' && entry.customTitle) title = entry.customTitle;
    if (type === 'ai-title' && entry.aiTitle) title = entry.aiTitle;

    const ts = entry?.timestamp ? Date.parse(entry.timestamp) : NaN;
    if (Number.isFinite(ts)) {
      firstTimestamp = firstTimestamp == null ? ts : Math.min(firstTimestamp, ts);
      lastTimestamp = lastTimestamp == null ? ts : Math.max(lastTimestamp, ts);
    }

    if (type === 'user') {
      if (entry.uuid) userIds.add(entry.uuid); else userWithoutId += 1;
      const blocks = asArray(entry?.message?.content);
      const hasToolResult = blocks.some((block) => block?.type === 'tool_result');
      const text = textFromContent(entry?.message?.content);
      if (text && !hasToolResult) {
        userPrompts += 1;
        firstPrompt ||= text;
        if (transcript.length < MAX_TRANSCRIPT_EVENTS) transcript.push({ role: 'user', text: text.slice(0, MAX_TEXT_CHARS), timestamp: entry.timestamp || null });
      }
      for (const block of blocks) {
        if (block?.type === 'tool_result') {
          const id = block.tool_use_id || `${toolResultIds.size}:${entry.uuid || ''}`;
          toolResultIds.add(id);
        }
      }
    }

    if (type === 'assistant') {
      if (entry.uuid) assistantIds.add(entry.uuid); else assistantWithoutId += 1;
      const message = entry?.message || {};
      if (message.model) models.add(message.model);
      const blocks = asArray(message.content);
      const text = textFromContent(message.content);
      if (text && transcript.length < MAX_TRANSCRIPT_EVENTS) transcript.push({ role: 'assistant', text: text.slice(0, MAX_TEXT_CHARS), timestamp: entry.timestamp || null });
      for (const block of blocks) {
        if (block?.type === 'thinking') thinkingBlocks += 1;
        if (block?.type === 'tool_use') {
          const id = block.id || `${toolUseIds.size}:${entry.uuid || ''}:${block.name || 'tool'}`;
          if (!toolUseIds.has(id)) {
            toolUseIds.add(id);
            addCount(toolCounts, block.name || 'unknown');
            if (transcript.length < MAX_TRANSCRIPT_EVENTS) transcript.push({ role: 'tool', text: block.name || 'unknown', timestamp: entry.timestamp || null });
          }
        }
      }
      const u = message.usage || entry.usage || {};
      usage.inputTokens += Number(u.input_tokens || 0);
      usage.outputTokens += Number(u.output_tokens || 0);
      usage.cacheCreationInputTokens += Number(u.cache_creation_input_tokens || 0);
      usage.cacheReadInputTokens += Number(u.cache_read_input_tokens || 0);
    }
  }

  const userMessages = userIds.size + userWithoutId;
  const assistantMessages = assistantIds.size + assistantWithoutId;
  return {
    id: Buffer.from(filePath).toString('base64url'),
    provider: 'Claude Code',
    kind: 'session',
    path: filePath,
    relativePath: relative,
    projectSlug,
    sessionId: sessionId || fallbackSessionId,
    isSubagent,
    cwd,
    gitBranch,
    title: title || (firstPrompt ? firstPrompt.replace(/\s+/g, ' ').slice(0, 100) : fallbackSessionId),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    startedAt: firstTimestamp == null ? null : new Date(firstTimestamp).toISOString(),
    endedAt: lastTimestamp == null ? null : new Date(lastTimestamp).toISOString(),
    durationMs: firstTimestamp != null && lastTimestamp != null ? Math.max(0, lastTimestamp - firstTimestamp) : null,
    userMessages,
    assistantMessages,
    messages: userMessages + assistantMessages,
    userPrompts,
    toolCalls: toolUseIds.size,
    toolResults: toolResultIds.size,
    thinkingBlocks,
    toolCounts,
    models: [...models],
    usage,
    entryTypes,
    parseErrors,
    transcript,
  };
}

export function scanClaudeSessions({ home = os.homedir() } = {}) {
  const projectsRoot = path.join(path.resolve(home), '.claude', 'projects');
  const files = [];
  walkJsonl(projectsRoot, files);
  return files
    .map((file) => parseClaudeSession(file, projectsRoot))
    .filter(Boolean)
    .sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
}

export function analyzeClaudeSessions(sessions) {
  const toolCounts = {};
  const modelCounts = {};
  const projectCounts = {};
  const totals = {
    sessions: sessions.filter((s) => !s.isSubagent).length,
    subagents: sessions.filter((s) => s.isSubagent).length,
    files: sessions.length,
    projects: 0,
    messages: 0,
    userPrompts: 0,
    assistantMessages: 0,
    toolCalls: 0,
    toolResults: 0,
    thinkingBlocks: 0,
    bytes: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
  for (const session of sessions) {
    totals.messages += session.messages;
    totals.userPrompts += session.userPrompts;
    totals.assistantMessages += session.assistantMessages;
    totals.toolCalls += session.toolCalls;
    totals.toolResults += session.toolResults;
    totals.thinkingBlocks += session.thinkingBlocks;
    totals.bytes += session.bytes;
    totals.inputTokens += session.usage.inputTokens;
    totals.outputTokens += session.usage.outputTokens;
    totals.cacheCreationInputTokens += session.usage.cacheCreationInputTokens;
    totals.cacheReadInputTokens += session.usage.cacheReadInputTokens;
    addCount(projectCounts, session.projectSlug);
    for (const [tool, count] of Object.entries(session.toolCounts)) addCount(toolCounts, tool, count);
    for (const model of session.models) addCount(modelCounts, model);
  }
  totals.projects = Object.keys(projectCounts).length;
  return { totals, toolCounts, modelCounts, projectCounts };
}

export const sessionScannerInternals = { textFromContent, parseClaudeSession };
