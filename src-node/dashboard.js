import http from 'node:http';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (value) => Number(value || 0).toLocaleString('en-US');
const bytes = (value) => value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${value || 0} B`;
const duration = (ms) => {
  if (ms == null) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
};
const topEntries = (obj, limit = 8) => Object.entries(obj || {}).sort((a,b) => b[1] - a[1]).slice(0, limit);

function renderTranscript(session) {
  if (!session.transcript?.length) return '<div class="empty compact">No readable user/assistant text blocks were persisted in this JSONL.</div>';
  return session.transcript.map((event) => {
    if (event.role === 'tool') return `<div class="event tool-event"><span>TOOL</span><code>${esc(event.text)}</code></div>`;
    return `<div class="event ${esc(event.role)}"><span>${esc(event.role.toUpperCase())}</span><div>${esc(event.text)}</div></div>`;
  }).join('');
}

function renderSessionCard(session) {
  const tools = topEntries(session.toolCounts, 6).map(([name,count]) => `<span class="mini">${esc(name)} <b>${count}</b></span>`).join('') || '<span class="muted">No tool calls</span>';
  const models = session.models.map((model) => `<span class="mini">${esc(model)}</span>`).join('');
  const search = [session.title, session.projectSlug, session.sessionId, session.cwd, session.path, ...Object.keys(session.toolCounts), ...session.models].join(' ').toLowerCase();
  return `<article class="session-card" data-session-search="${esc(search)}">
    <div class="row"><span><span class="provider">Claude Code</span><span class="kind">${session.isSubagent ? 'subagent' : 'session'}</span></span><span class="meta">${esc(session.modifiedAt)}</span></div>
    <h3>${esc(session.title)}</h3>
    <div class="path">${esc(session.cwd || session.projectSlug)}</div>
    <div class="metric-grid">
      <div><b>${num(session.userPrompts)}</b><span>User prompts</span></div>
      <div><b>${num(session.assistantMessages)}</b><span>Assistant records</span></div>
      <div><b>${num(session.toolCalls)}</b><span>Tool calls</span></div>
      <div><b>${duration(session.durationMs)}</b><span>Duration</span></div>
    </div>
    <div class="chips">${tools}</div>
    ${models ? `<div class="chips models">${models}</div>` : ''}
    <div class="session-meta"><code>${esc(session.sessionId)}</code> · ${bytes(session.bytes)}${session.gitBranch ? ` · branch ${esc(session.gitBranch)}` : ''}${session.parseErrors ? ` · ${session.parseErrors} malformed line(s)` : ''}</div>
    <details><summary>Readable transcript (${session.transcript.length} events shown)</summary><div class="transcript">${renderTranscript(session)}</div></details>
    <details><summary>JSONL source</summary><div class="path source-path">${esc(session.path)}</div></details>
  </article>`;
}

export function renderDashboard({ items, analysis, sessions = [], sessionAnalysis = { totals: {}, toolCounts: {}, modelCounts: {}, projectCounts: {} }, root }) {
  const cards = items.map((item) => `
    <article class="card" data-context-search="${esc((item.provider + ' ' + item.kind + ' ' + item.path + ' ' + item.content).toLowerCase())}">
      <div class="row"><span><span class="provider">${esc(item.provider)}</span><span class="kind">${esc(item.kind || 'context')}</span></span><span class="meta">${esc(item.bytes)} bytes</span></div>
      <h3>${esc(item.relativePath)}</h3>
      <div class="path">${esc(item.path)}</div>
      <pre>${esc(item.content.slice(0, 5000))}</pre>
    </article>`).join('');
  const providers = Object.entries(analysis.providerCounts).map(([name,count]) => `<span class="pill">${esc(name)} <b>${count}</b></span>`).join('');
  const kinds = Object.entries(analysis.kindCounts || {}).map(([name,count]) => `<span class="pill kind-pill">${esc(name)} <b>${count}</b></span>`).join('');
  const dupes = analysis.duplicates.slice(0, 20).map((d) => `<li><code>${esc(d.refs[0].text)}</code><small>${d.refs.map(r=>esc(r.provider + ': ' + r.path)).join('<br>')}</small></li>`).join('');
  const sessionCards = sessions.map(renderSessionCard).join('');
  const totals = sessionAnalysis.totals || {};
  const topTools = topEntries(sessionAnalysis.toolCounts, 10).map(([name,count]) => `<span class="pill">${esc(name)} <b>${num(count)}</b></span>`).join('');
  const topProjects = topEntries(sessionAnalysis.projectCounts, 8).map(([name,count]) => `<span class="pill">${esc(name)} <b>${num(count)}</b></span>`).join('');
  const models = topEntries(sessionAnalysis.modelCounts, 8).map(([name,count]) => `<span class="pill">${esc(name)} <b>${num(count)}</b></span>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgentMemora</title><style>
  :root{font-family:Inter,ui-sans-serif,system-ui;background:#090b10;color:#eef2ff}*{box-sizing:border-box}body{margin:0}header{padding:32px max(24px,6vw);border-bottom:1px solid #252a35;background:radial-gradient(circle at 20% 0,#17213a,#090b10 55%)}h1{font-size:34px;margin:0 0 8px}h2{margin-bottom:8px}.accent{color:#9bb4ff}.sub,.muted{color:#a8b0c3}.sub{max-width:980px}.safe{display:inline-block;margin-top:14px;padding:7px 10px;border:1px solid #285b45;border-radius:999px;color:#91e6bd;background:#10251c}main{padding:24px max(24px,6vw)}.stats,.chips{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.pill,.mini{border:1px solid #2a3040;background:#121722;padding:8px 10px;border-radius:10px;color:#cbd5e1}.mini{font-size:12px;padding:5px 8px}.kind-pill{border-color:#3a3456}.toolbar{display:flex;gap:12px;margin:20px 0}.toolbar input{width:min(760px,100%);padding:12px 14px;border-radius:10px;border:1px solid #30384a;background:#10141d;color:white}.grid,.session-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px}.card,.session-card{border:1px solid #262d3b;background:#10141d;border-radius:14px;padding:16px;min-width:0}.session-card{border-color:#30384a}.row{display:flex;justify-content:space-between;gap:10px}.provider{font-size:12px;color:#9bb4ff;text-transform:uppercase;letter-spacing:.08em}.kind{font-size:10px;margin-left:8px;padding:3px 6px;border:1px solid #4a4269;border-radius:999px;color:#c8b9ff;text-transform:uppercase}.meta,.path,small,.session-meta{color:#8d97aa;font-size:12px}.path{overflow-wrap:anywhere;margin:8px 0 12px}.source-path{margin-top:10px}pre{white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;background:#0a0d13;padding:12px;border-radius:10px;color:#cbd5e1}section{margin:34px 0}.dupes li{margin:12px 0}.dupes small{display:block;margin-top:5px}code{color:#ffd58a}.empty{padding:36px;border:1px dashed #343b4b;border-radius:14px;color:#a8b0c3}.compact{padding:14px}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.metric-grid div,.hero-metric{background:#0b0f16;border:1px solid #252d3a;border-radius:10px;padding:10px}.metric-grid b,.hero-metric b{display:block;font-size:20px}.metric-grid span,.hero-metric span{font-size:11px;color:#8d97aa}.hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:18px 0}.hero-metric b{font-size:26px}.models{opacity:.85}.session-meta{overflow-wrap:anywhere;margin:10px 0}details{border-top:1px solid #252d3a;margin-top:12px;padding-top:10px}summary{cursor:pointer;color:#cbd5e1;font-size:13px}.transcript{margin-top:12px;max-height:520px;overflow:auto}.event{padding:10px;margin:7px 0;border-radius:9px;background:#0a0d13;white-space:pre-wrap;overflow-wrap:anywhere}.event span{display:block;font-size:10px;letter-spacing:.08em;color:#8d97aa;margin-bottom:5px}.event.user{border-left:3px solid #8db2ff}.event.assistant{border-left:3px solid #a8e6c1}.event.tool-event{border-left:3px solid #ffd58a;display:flex;align-items:center;gap:8px}.event.tool-event span{margin:0}.note{border-left:3px solid #ffd58a;padding:10px 12px;background:#17140d;color:#d9c79e;border-radius:6px}
  </style></head><body><header><h1>◉ <span class="accent">AgentMemora</span></h1><div class="sub">Local-first inspector for AI agent sessions, memory, and context. Turn Claude Code JSONL transcripts into a readable inventory: projects, prompts, assistant activity, tools, models, token metadata, and transcripts.</div><div class="safe">Read-only scan · localhost only · no telemetry</div></header><main>
  <section><h2>Claude Code session inventory</h2><div class="sub">Reads local <code>~/.claude/projects/**/*.jsonl</code>. Session transcripts are history/state artifacts, not the same thing as curated <code>MEMORY.md</code> memory.</div>
    <div class="hero-grid">
      <div class="hero-metric"><b>${num(totals.sessions)}</b><span>Primary sessions</span></div>
      <div class="hero-metric"><b>${num(totals.subagents)}</b><span>Subagent transcripts</span></div>
      <div class="hero-metric"><b>${num(totals.projects)}</b><span>Projects</span></div>
      <div class="hero-metric"><b>${num(totals.userPrompts)}</b><span>User prompts</span></div>
      <div class="hero-metric"><b>${num(totals.assistantMessages)}</b><span>Assistant records</span></div>
      <div class="hero-metric"><b>${num(totals.toolCalls)}</b><span>Tool calls</span></div>
      <div class="hero-metric"><b>${num(totals.inputTokens)}</b><span>Reported input tokens*</span></div>
      <div class="hero-metric"><b>${num(totals.outputTokens)}</b><span>Reported output tokens*</span></div>
    </div>
    <div class="note">* Token values are summed from usage metadata persisted in the JSONL. Claude Code may persist cache/retry/stream-related records differently across versions, so treat these as observed log totals rather than billing totals.</div>
    ${topTools ? `<h3>Most-used tools</h3><div class="stats">${topTools}</div>` : ''}
    ${topProjects ? `<h3>Projects</h3><div class="stats">${topProjects}</div>` : ''}
    ${models ? `<h3>Models observed</h3><div class="stats">${models}</div>` : ''}
    <div class="toolbar"><input id="sessionQ" placeholder="Search sessions by title, project, path, tool, model…"></div>
    <div id="sessionGrid" class="session-grid">${sessionCards || '<div class="empty">No Claude Code JSONL sessions found under ~/.claude/projects.</div>'}</div>
  </section>

  <section><h2>Memory & instruction files</h2><div class="sub">Separate from session history: explicit memory, agent instructions, rules, and project context. Workspace: ${esc(root)}</div><div class="stats"><span class="pill">Sources <b>${items.length}</b></span>${providers}${kinds}<span class="pill">Duplicates <b>${analysis.duplicates.length}</b></span></div><div class="toolbar"><input id="contextQ" placeholder="Search memory, instructions, rules, paths, providers…"></div><div id="contextGrid" class="grid">${cards || '<div class="empty">No supported memory/context files found in this scope yet.</div>'}</div></section>
  <section><h2>Duplicate / overlapping instructions</h2>${dupes ? `<ul class="dupes">${dupes}</ul>` : '<div class="empty">No exact duplicate instruction lines found.</div>'}</section>
  </main><script>
  const sessionQ=document.getElementById('sessionQ');sessionQ?.addEventListener('input',()=>{const s=sessionQ.value.toLowerCase();document.querySelectorAll('[data-session-search]').forEach(c=>c.style.display=c.dataset.sessionSearch.includes(s)?'block':'none')});
  const contextQ=document.getElementById('contextQ');contextQ?.addEventListener('input',()=>{const s=contextQ.value.toLowerCase();document.querySelectorAll('[data-context-search]').forEach(c=>c.style.display=c.dataset.contextSearch.includes(s)?'block':'none')});
  </script></body></html>`;
}

export function startDashboard({ html, port = 8765, host = '127.0.0.1' }) {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(html);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
