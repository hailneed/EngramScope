import http from 'node:http';
import { buildContextCapsule } from './memory-intelligence.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (value) => Number(value || 0).toLocaleString('en-US');
const duration = (ms) => {
  if (ms == null) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const topEntries = (obj, limit = 8) => Object.entries(obj || {}).sort((a,b) => b[1] - a[1]).slice(0, limit);
const shortPath = (value) => String(value || '').replace(/^.*?\.claude[\\/]/, '~/.claude/').replace(/^.*?\.codex[\\/]/, '~/.codex/');

const toolIcon = (name) => ({ Bash:'⌘', Read:'◫', Edit:'✎', Write:'▣', Agent:'◇', Task:'◇', WebFetch:'◎', WebSearch:'◎', AskUserQuestion:'?', ToolSearch:'⌕' }[name] || '◆');

function sourceSurvival(item) {
  if (item.kind === 'memory') return { compact: 'YES', session: 'YES', portable: item.path.includes('.claude') ? 'LOCAL' : 'YES' };
  if (item.kind === 'instructions' || item.kind === 'rule') return { compact: 'YES', session: 'YES', portable: 'FILE' };
  return { compact: 'MAYBE', session: 'NO', portable: 'NO' };
}

function renderSource(item) {
  const s = sourceSurvival(item);
  return `<article class="source-row" data-context-search="${esc((item.provider + ' ' + item.kind + ' ' + item.path + ' ' + item.content).toLowerCase())}">
    <div class="source-main"><span class="source-icon">${item.kind === 'memory' ? '◉' : item.kind === 'rule' ? '◇' : '▤'}</span><div><b>${esc(item.relativePath)}</b><small>${esc(item.provider)} · ${esc(shortPath(item.path))}</small></div></div>
    <span class="tag">${esc(item.kind)}</span><span class="survive yes">compact ${s.compact}</span><span class="survive ${s.session === 'YES' ? 'yes' : 'warn'}">new session ${s.session}</span><span class="survive">portable ${s.portable}</span>
    <details><summary>inspect</summary><pre>${esc(item.content.slice(0, 7000))}</pre></details>
  </article>`;
}

function renderRisk(risk, index) {
  const project = risk.projects?.[0] || 'unknown';
  return `<article class="intel-row risk"><div class="signal">!</div><div class="intel-copy"><b>${esc(risk.statement)}</b><small>Session-only candidate · ${risk.sessions.length} session${risk.sessions.length === 1 ? '' : 's'} · ${esc(project)} · not found in durable memory/instructions</small></div><button onclick="copyText(${JSON.stringify(risk.statement)})">COPY</button></article>`;
}

function renderConflict(conflict) {
  return `<article class="intel-row conflict"><div class="signal">≠</div><div class="intel-copy"><b>${esc(conflict.label)}</b><small>${conflict.values.map(esc).join('  ↔  ')}</small><small>${conflict.refs.map((ref) => esc(ref.provider + ': ' + shortPath(ref.path))).join(' · ')}</small></div></article>`;
}

function renderSession(session, riskCount = 0) {
  const tools = topEntries(session.toolCounts, 5).map(([name,count]) => `<span class="tool">${toolIcon(name)} ${esc(name)} <b>${count}</b></span>`).join('');
  const icon = session.isSubagent ? '◇' : '▣';
  const kind = session.isSubagent ? 'SUBAGENT' : 'SESSION';
  const search = [session.title, session.projectSlug, session.sessionId, session.cwd, session.path, ...Object.keys(session.toolCounts), ...session.models].join(' ').toLowerCase();
  const capsuleId = `capsule-${session.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const capsule = buildContextCapsule(session);
  const resume = `claude --resume ${session.sessionId}`;
  const fork = `claude --resume ${session.sessionId} --fork-session`;
  return `<article class="session-row" data-session-search="${esc(search)}">
    <div class="session-head"><span class="session-icon">${icon}</span><div class="grow"><div class="eyebrow">CLAUDE CODE // ${kind}</div><h3>${esc(session.title)}</h3><div class="path">${esc(session.cwd || session.projectSlug)}</div></div><div class="session-time">${esc(session.modifiedAt)}</div></div>
    <div class="session-facts"><span>${num(session.userPrompts)} prompts</span><span>${num(session.toolCalls)} tools</span><span>${duration(session.durationMs)}</span>${riskCount ? `<span class="danger">${riskCount} context-loss risk${riskCount === 1 ? '' : 's'}</span>` : '<span class="ok">durable context looks covered</span>'}</div>
    <div class="tools">${tools || '<span class="muted">No tool calls</span>'}</div>
    <div class="actions"><button onclick="copyText(${JSON.stringify(resume)})">▶ RESUME CMD</button><button onclick="copyText(${JSON.stringify(fork)})">⑂ FORK CMD</button><button class="primary" onclick="downloadCapsule('${capsuleId}', ${JSON.stringify(session.projectSlug + '-' + session.sessionId.slice(0,8) + '-context.md')})">⇢ CONTEXT CAPSULE</button></div>
    <textarea id="${capsuleId}" hidden>${esc(capsule)}</textarea>
    <details><summary>inspect readable session</summary><div class="transcript">${(session.transcript || []).slice(0,80).map((event) => `<div class="event ${esc(event.role)}"><span>${event.role === 'tool' ? toolIcon(event.text) + ' TOOL' : esc(event.role.toUpperCase())}</span><div>${esc(event.text)}</div></div>`).join('')}</div></details>
  </article>`;
}

export function renderDashboard({ items, analysis, sessions = [], sessionAnalysis = { totals: {}, toolCounts: {}, modelCounts: {}, projectCounts: {} }, memoryIntelligence = { totals: {}, risks: [], conflicts: [], stale: [], candidates: [], riskySessions: [] }, root }) {
  const m = memoryIntelligence.totals || {};
  const t = sessionAnalysis.totals || {};
  const riskBySession = new Map((memoryIntelligence.riskySessions || []).map((r) => [r.sessionId, r.riskCount]));
  const sources = items.map(renderSource).join('');
  const risks = (memoryIntelligence.risks || []).slice(0,12).map(renderRisk).join('');
  const conflicts = (memoryIntelligence.conflicts || []).slice(0,8).map(renderConflict).join('');
  const sessionRows = sessions.filter((s) => !s.isSubagent).slice(0,18).map((s) => renderSession(s, riskBySession.get(s.sessionId) || 0)).join('');
  const subagentRows = sessions.filter((s) => s.isSubagent).slice(0,8).map((s) => renderSession(s, 0)).join('');
  const tools = topEntries(sessionAnalysis.toolCounts, 10).map(([name,count]) => `<div class="bar-row"><span>${toolIcon(name)} ${esc(name)}</span><div class="bar"><i style="width:${Math.max(4, Math.round(count / Math.max(1, topEntries(sessionAnalysis.toolCounts,1)[0]?.[1] || 1) * 100))}%"></i></div><b>${num(count)}</b></div>`).join('');
  const models = topEntries(sessionAnalysis.modelCounts, 8).map(([name,count]) => `<div class="bar-row"><span>⬡ ${esc(name)}</span><div class="bar"><i style="width:${Math.max(8, count * 4)}%"></i></div><b>${num(count)}</b></div>`).join('');
  const coverage = Number(m.preservationCoverage || 0);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgentMemora // Memory Intelligence</title><style>
  :root{font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;background:#05080c;color:#dbe7f5;--panel:#081018;--line:#173044;--blue:#61a8ff;--cyan:#55e6dc;--green:#69e39c;--amber:#f2c66d;--red:#ff7c84;--muted:#7890a5}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 65% -20%,#10233b 0,#05080c 38%);font-size:13px}.shell{display:grid;grid-template-columns:210px 1fr;min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;border-right:1px solid var(--line);background:#050b11;padding:20px 14px;display:flex;flex-direction:column}.brand{font-size:20px;font-weight:800;color:#a9c9ff;letter-spacing:-.04em}.brand small{display:block;font-size:9px;letter-spacing:.14em;color:var(--muted);margin-top:5px}.nav{margin-top:28px;display:grid;gap:5px}.nav a{color:#9fb3c7;text-decoration:none;padding:9px 10px;border:1px solid transparent;border-radius:5px}.nav a:hover,.nav a.active{background:#0c1b2b;border-color:#21496b;color:#d9ecff}.side-status{margin-top:auto;border-top:1px solid var(--line);padding-top:16px;color:var(--muted);font-size:10px;line-height:1.8}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:6px}.content{min-width:0}.topbar{height:74px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:rgba(5,10,16,.84);backdrop-filter:blur(10px);position:sticky;top:0;z-index:3}.title b{display:block;letter-spacing:.08em}.title span,.muted,.path,small{color:var(--muted)}.statusline{font-size:10px;color:#91a9bf;display:flex;gap:16px}.main{padding:22px;max-width:1600px;margin:auto}.section{margin-bottom:24px}.section-title{display:flex;align-items:end;justify-content:space-between;margin-bottom:10px}.section-title h2{font-size:14px;letter-spacing:.08em;margin:0}.section-title span{font-size:10px;color:var(--muted)}.kpis{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px}.kpi,.panel{background:linear-gradient(180deg,#09121b,#070d13);border:1px solid var(--line);border-radius:7px;box-shadow:0 8px 30px rgba(0,0,0,.18)}.kpi{padding:14px}.kpi .ico{font-size:15px;color:var(--cyan)}.kpi b{display:block;font-size:25px;margin:10px 0 3px;color:#edf6ff}.kpi span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.kpi.alert b{color:var(--amber)}.kpi.danger b{color:var(--red)}.intel-grid{display:grid;grid-template-columns:1.3fr .7fr;gap:10px}.panel{padding:15px}.panel h3{font-size:11px;margin:0 0 12px;letter-spacing:.08em;color:#bcd4e9}.meter{height:10px;background:#0d1a24;border:1px solid #193348;border-radius:3px;overflow:hidden}.meter i,.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--blue),var(--cyan))}.meter-copy{display:flex;justify-content:space-between;margin-top:8px;color:var(--muted);font-size:10px}.intel-row{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-top:1px solid #102536}.intel-row:first-of-type{border-top:0}.signal{width:22px;height:22px;display:grid;place-items:center;border:1px solid #5b4b22;color:var(--amber);background:#1b160a;border-radius:4px;flex:0 0 auto}.conflict .signal{border-color:#69343a;color:var(--red);background:#1b0d10}.intel-copy{min-width:0;flex:1}.intel-copy b{display:block;font-size:11px;line-height:1.5;font-weight:600}.intel-copy small{display:block;margin-top:4px;line-height:1.4}.intel-row button,.actions button{border:1px solid #24435c;background:#09141e;color:#9fc8e9;border-radius:4px;padding:6px 8px;font:inherit;font-size:9px;cursor:pointer}.intel-row button:hover,.actions button:hover{border-color:var(--blue);color:white}.terminal-note{padding:12px;border-left:2px solid var(--cyan);background:#07151a;color:#9bc3ca;font-size:10px;line-height:1.6}.session-list{display:grid;gap:8px}.session-row{background:#070d13;border:1px solid var(--line);border-radius:7px;padding:14px}.session-head{display:flex;gap:11px}.session-icon{width:30px;height:30px;border:1px solid #245c7d;display:grid;place-items:center;color:var(--cyan);border-radius:4px}.grow{flex:1;min-width:0}.eyebrow{font-size:9px;letter-spacing:.12em;color:#73aee7}.session-row h3{font-size:13px;margin:5px 0}.session-time{font-size:9px;color:var(--muted)}.session-facts,.tools,.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.session-facts span,.tool,.tag,.survive{font-size:9px;padding:5px 7px;border:1px solid #1c3447;background:#09131c;border-radius:4px;color:#9db4c7}.session-facts .danger{border-color:#6a3c28;color:#ffc28a}.session-facts .ok{border-color:#235b40;color:#8ce6af}.tool{color:#b9cee0}.actions{border-top:1px solid #102536;padding-top:10px}.actions .primary{border-color:#29695f;color:#72e4cf;background:#071a18}.source-row{display:grid;grid-template-columns:minmax(300px,1fr) auto auto auto auto;align-items:center;gap:8px;padding:10px 0;border-top:1px solid #102536}.source-main{display:flex;align-items:center;gap:9px;min-width:0}.source-main b,.source-main small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.source-icon{color:var(--cyan)}.tag{text-transform:uppercase}.survive.yes{color:#7ee5a6;border-color:#245b40}.survive.warn{color:#f2c66d;border-color:#5b4b22}.source-row details{grid-column:1/-1}.source-row pre{max-height:280px;overflow:auto;white-space:pre-wrap;color:#b7c9d8;background:#04080c;padding:12px;border:1px solid #102536}.toolbar{margin:10px 0}.toolbar input{width:100%;padding:10px;background:#060c12;border:1px solid var(--line);color:#dbe7f5;border-radius:4px;font:inherit}.telemetry-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bar-row{display:grid;grid-template-columns:160px 1fr 60px;gap:8px;align-items:center;margin:9px 0;font-size:10px}.bar{height:6px;background:#0d1a24}.bar b{font-size:10px}.bar-row>b{text-align:right;color:#a9c0d5}details>summary{cursor:pointer;color:#8fb7d5;font-size:10px;margin-top:8px}.transcript{max-height:480px;overflow:auto;margin-top:10px}.event{padding:9px 10px;border-left:2px solid #29475c;background:#060b10;margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}.event>span{display:block;color:#6f8da7;font-size:8px;letter-spacing:.12em;margin-bottom:4px}.event.user{border-color:var(--blue)}.event.assistant{border-color:var(--green)}.event.tool{border-color:var(--amber)}.footer{border-top:1px solid var(--line);padding:14px 22px;color:#648197;font-size:9px}.toast{position:fixed;right:20px;bottom:20px;background:#0b1b24;border:1px solid #286c62;color:#83ead6;padding:10px 14px;border-radius:5px;opacity:0;pointer-events:none;transition:.2s}.toast.show{opacity:1}@media(max-width:1000px){.shell{grid-template-columns:1fr}.sidebar{display:none}.kpis{grid-template-columns:repeat(2,1fr)}.intel-grid,.telemetry-grid{grid-template-columns:1fr}.source-row{grid-template-columns:1fr auto}.survive{display:none}.topbar{position:static}}@media(max-width:600px){.kpis{grid-template-columns:1fr}.main{padding:14px}.statusline{display:none}}
  </style></head><body><div class="shell"><aside class="sidebar"><div class="brand">◉ AgentMemora<small>MEMORY INTELLIGENCE CONSOLE</small></div><nav class="nav"><a class="active" href="#overview">⌁ Overview</a><a href="#risks">⚠ Context Risks</a><a href="#sessions">▣ Sessions</a><a href="#memory">◉ Memory Sources</a><a href="#conflicts">≠ Conflicts</a><a href="#telemetry">⌁ Telemetry</a></nav><div class="side-status"><div><span class="dot"></span>LOCAL CONTROL PLANE</div><div>read-only vendor logs</div><div>no telemetry</div><div>127.0.0.1</div></div></aside><div class="content"><header class="topbar"><div class="title"><b>LOCAL AGENT MEMORY & CONTEXT CONTROL PLANE</b><span>Inspect what agents know · preserve important context · transfer it safely</span></div><div class="statusline"><span>● SCAN COMPLETE</span><span>${num(items.length)} SOURCES</span><span>${num(t.sessions || 0)} SESSIONS</span></div></header><main class="main">

  <section id="overview" class="section"><div class="section-title"><h2>MEMORY POSTURE</h2><span>heuristic intelligence · provenance preserved</span></div><div class="kpis">
    <div class="kpi"><span class="ico">◉</span><b>${num(m.memories)}</b><span>Memory files</span></div>
    <div class="kpi"><span class="ico">◆</span><b>${num(m.sessionCandidates)}</b><span>Session memory candidates</span></div>
    <div class="kpi danger"><span class="ico">!</span><b>${num(m.contextLossRisks)}</b><span>Context-loss risks</span></div>
    <div class="kpi danger"><span class="ico">≠</span><b>${num(m.conflicts)}</b><span>Potential conflicts</span></div>
    <div class="kpi alert"><span class="ico">◷</span><b>${num(m.staleMemories)}</b><span>Stale memories 90d+</span></div>
  </div></section>

  <section class="section intel-grid"><div class="panel"><h3>CONTEXT PRESERVATION COVERAGE</h3><div class="meter"><i style="width:${coverage}%"></i></div><div class="meter-copy"><span>${coverage}% of detected session memory candidates also appear in durable memory/instructions</span><b>${coverage}%</b></div><div class="terminal-note" style="margin-top:14px">Session JSONL is treated as history, not durable memory. AgentMemora never rewrites vendor transcripts. Use Context Capsules for portable handoff; use the guarded <b>promote</b> command to curate selected facts into a memory file with backup.</div></div><div class="panel"><h3>SURVIVABILITY MODEL</h3><div class="bar-row"><span>Conversation only</span><div class="bar"><i style="width:18%"></i></div><b>AT RISK</b></div><div class="bar-row"><span>Auto memory</span><div class="bar"><i style="width:82%"></i></div><b>SESSION ✓</b></div><div class="bar-row"><span>CLAUDE.md / rules</span><div class="bar"><i style="width:100%"></i></div><b>DURABLE</b></div><div class="bar-row"><span>Context Capsule</span><div class="bar"><i style="width:100%"></i></div><b>PORTABLE</b></div></div></section>

  <section id="risks" class="section"><div class="section-title"><h2>INTELLIGENCE ALERTS // CONTEXT LOSS</h2><span>candidate statements detected in user turns but not matched in durable sources</span></div><div class="panel">${risks || '<div class="muted">No session-only memory candidates detected by the conservative heuristic.</div>'}</div></section>

  <section id="sessions" class="section"><div class="section-title"><h2>CONTEXT SESSIONS</h2><span>resume exact history · fork safely · extract portable context</span></div><div class="toolbar"><input id="sessionQ" placeholder="search session / project / model / tool / path"></div><div class="session-list">${sessionRows || '<div class="panel muted">No Claude Code primary sessions found.</div>'}</div>${subagentRows ? `<details><summary>SHOW SUBAGENT TRANSCRIPTS (${num(t.subagents)})</summary><div class="session-list" style="margin-top:8px">${subagentRows}</div></details>` : ''}</section>

  <section id="memory" class="section"><div class="section-title"><h2>MEMORY & CONTEXT SOURCES</h2><span>${esc(root)}</span></div><div class="toolbar"><input id="contextQ" placeholder="search memory / instruction / rule / provider / path"></div><div class="panel">${sources || '<div class="muted">No supported durable memory/context sources found.</div>'}</div></section>

  <section id="conflicts" class="section"><div class="section-title"><h2>POTENTIAL MEMORY CONFLICTS</h2><span>conservative key:value comparison across durable sources</span></div><div class="panel">${conflicts || '<div class="muted">No conservative key/value conflicts detected.</div>'}</div></section>

  <section id="telemetry" class="section"><div class="section-title"><h2>SESSION TELEMETRY</h2><span>supporting evidence, not the product center</span></div><div class="telemetry-grid"><div class="panel"><h3>MOST USED TOOLS</h3>${tools || '<span class="muted">No tool data</span>'}</div><div class="panel"><h3>MODELS OBSERVED</h3>${models || '<span class="muted">No model data</span>'}</div></div><div class="panel" style="margin-top:10px"><div class="session-facts"><span>${num(t.sessions)} primary sessions</span><span>${num(t.subagents)} subagents</span><span>${num(t.userPrompts)} prompts</span><span>${num(t.assistantMessages)} assistant records</span><span>${num(t.toolCalls)} tool calls</span><span>${num(t.inputTokens)} observed input tokens*</span><span>${num(t.outputTokens)} observed output tokens*</span></div><small>* Observed JSONL usage metadata, not billing totals.</small></div></section>

  </main><footer class="footer">AGENTMEMORA // INSPECT · CURATE · PRESERVE · TRANSFER &nbsp;|&nbsp; vendor JSONL read-only &nbsp;|&nbsp; memory writes require explicit CLI confirmation + backup</footer></div></div><div id="toast" class="toast">COPIED</div><script>
  function toast(message){const t=document.getElementById('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1400)}
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast('COPIED TO CLIPBOARD')}catch{toast('COPY FAILED')}}
  function downloadCapsule(id,name){const value=document.getElementById(id)?.value||'';const blob=new Blob([value],{type:'text/markdown'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);toast('CONTEXT CAPSULE EXPORTED')}
  const sessionQ=document.getElementById('sessionQ');sessionQ?.addEventListener('input',()=>{const q=sessionQ.value.toLowerCase();document.querySelectorAll('[data-session-search]').forEach(el=>el.style.display=el.dataset.sessionSearch.includes(q)?'block':'none')});
  const contextQ=document.getElementById('contextQ');contextQ?.addEventListener('input',()=>{const q=contextQ.value.toLowerCase();document.querySelectorAll('[data-context-search]').forEach(el=>el.style.display=el.dataset.contextSearch.includes(q)?'grid':'none')});
  </script></body></html>`;
}

export function startDashboard({ html, port = 8765, host = '127.0.0.1' }) {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(html);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
