import http from 'node:http';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderDashboard({ items, analysis, root }) {
  const payload = JSON.stringify(items).replace(/</g, '\\u003c');
  const cards = items.map((item) => `
    <article class="card" data-search="${esc((item.provider + ' ' + item.kind + ' ' + item.path + ' ' + item.content).toLowerCase())}">
      <div class="row"><span><span class="provider">${esc(item.provider)}</span><span class="kind">${esc(item.kind || 'context')}</span></span><span class="meta">${esc(item.bytes)} bytes</span></div>
      <h3>${esc(item.relativePath)}</h3>
      <div class="path">${esc(item.path)}</div>
      <pre>${esc(item.content.slice(0, 5000))}</pre>
    </article>`).join('');
  const providers = Object.entries(analysis.providerCounts).map(([name,count]) => `<span class="pill">${esc(name)} <b>${count}</b></span>`).join('');
  const kinds = Object.entries(analysis.kindCounts || {}).map(([name,count]) => `<span class="pill kind-pill">${esc(name)} <b>${count}</b></span>`).join('');
  const dupes = analysis.duplicates.slice(0, 20).map((d) => `<li><code>${esc(d.refs[0].text)}</code><small>${d.refs.map(r=>esc(r.provider + ': ' + r.path)).join('<br>')}</small></li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgentMemora</title><style>
  :root{font-family:Inter,ui-sans-serif,system-ui;background:#090b10;color:#eef2ff}*{box-sizing:border-box}body{margin:0}header{padding:32px max(24px,6vw);border-bottom:1px solid #252a35;background:radial-gradient(circle at 20% 0,#17213a,#090b10 55%)}h1{font-size:34px;margin:0 0 8px}.accent{color:#9bb4ff}.sub{color:#a8b0c3;max-width:850px}.safe{display:inline-block;margin-top:14px;padding:7px 10px;border:1px solid #285b45;border-radius:999px;color:#91e6bd;background:#10251c}main{padding:24px max(24px,6vw)}.stats{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.pill{border:1px solid #2a3040;background:#121722;padding:8px 10px;border-radius:10px;color:#cbd5e1}.kind-pill{border-color:#3a3456}.toolbar{display:flex;gap:12px;margin:22px 0}.toolbar input{width:min(720px,100%);padding:12px 14px;border-radius:10px;border:1px solid #30384a;background:#10141d;color:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}.card{border:1px solid #262d3b;background:#10141d;border-radius:14px;padding:16px;min-width:0}.row{display:flex;justify-content:space-between;gap:10px}.provider{font-size:12px;color:#9bb4ff;text-transform:uppercase;letter-spacing:.08em}.kind{font-size:10px;margin-left:8px;padding:3px 6px;border:1px solid #4a4269;border-radius:999px;color:#c8b9ff;text-transform:uppercase}.meta,.path,small{color:#8d97aa;font-size:12px}.path{overflow-wrap:anywhere;margin:8px 0 12px}pre{white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;background:#0a0d13;padding:12px;border-radius:10px;color:#cbd5e1}section{margin:28px 0}.dupes li{margin:12px 0}.dupes small{display:block;margin-top:5px}code{color:#ffd58a}.empty{padding:36px;border:1px dashed #343b4b;border-radius:14px;color:#a8b0c3}
  </style></head><body><header><h1>◉ <span class="accent">AgentMemora</span></h1><div class="sub">Local-first inspector for AI agent memory and context. See what your agents remember, what is only an instruction/rule, where it came from, and where context overlaps.</div><div class="safe">Read-only scan · localhost only · no telemetry</div></header><main><div class="stats"><span class="pill">Sources <b>${items.length}</b></span>${providers}${kinds}<span class="pill">Duplicates <b>${analysis.duplicates.length}</b></span></div><div class="sub">Scanning workspace: ${esc(root)} · Home discovery also checks supported agent-specific memory locations unless <code>--no-home</code> is used.</div><div class="toolbar"><input id="q" autofocus placeholder="Search memories, instructions, rules, paths, providers…"></div><section><h2>Discovered memory & context</h2><div id="grid" class="grid">${cards || '<div class="empty">No supported memory/context files found in this scope yet.</div>'}</div></section><section><h2>Duplicate / overlapping instructions</h2>${dupes ? `<ul class="dupes">${dupes}</ul>` : '<div class="empty">No exact duplicate instruction lines found.</div>'}</section></main><script>const DATA=${payload};const q=document.getElementById('q');q.addEventListener('input',()=>{const s=q.value.toLowerCase();document.querySelectorAll('.card').forEach(c=>c.style.display=c.dataset.search.includes(s)?'block':'none')});</script></body></html>`;
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
