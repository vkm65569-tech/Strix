/**
 * The dashboard, served as one self-contained HTML page.
 *
 * The client script deliberately avoids template literals so the whole page can
 * live inside a single TS template string without escaping gymnastics.
 */

export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Strix Scanner</title>
<style>
  :root {
    --bg: #0b0f14; --panel: #11161d; --panel2: #161d26; --line: #232c38;
    --text: #dbe4ee; --muted: #8797a8; --accent: #35c98e; --accent-dim: #1d7a57;
    --red: #ef5350; --orange: #fb8c42; --yellow: #f2c94c; --blue: #64b5f6; --grey: #5b6b7c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  header {
    display: flex; align-items: center; gap: 10px; padding: 14px 22px;
    border-bottom: 1px solid var(--line); background: var(--panel);
    position: sticky; top: 0; z-index: 5;
  }
  header .logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, var(--accent), #0f5132); }
  header h1 { font-size: 15px; margin: 0; letter-spacing: .3px; }
  header .spacer { flex: 1; }
  header a { color: var(--muted); font-size: 12px; text-decoration: none; }
  header a:hover { color: var(--text); }
  main { max-width: 1240px; margin: 0 auto; padding: 20px 22px 60px; }
  .cols { display: grid; grid-template-columns: 360px 1fr; gap: 18px; align-items: start; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
  .panel + .panel { margin-top: 16px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); margin: 0 0 12px; }
  label { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
  input, select, textarea {
    width: 100%; background: var(--panel2); color: var(--text); border: 1px solid var(--line);
    border-radius: 6px; padding: 8px 10px; font: inherit; outline: none;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--accent-dim); }
  textarea { resize: vertical; min-height: 56px; }
  button {
    background: var(--accent); color: #06281b; border: 0; border-radius: 6px;
    padding: 9px 14px; font: inherit; font-weight: 600; cursor: pointer;
  }
  button:hover { filter: brightness(1.08); }
  button.secondary { background: var(--panel2); color: var(--text); border: 1px solid var(--line); font-weight: 500; }
  button.small { padding: 4px 9px; font-size: 12px; font-weight: 500; }
  button:disabled { opacity: .5; cursor: default; }
  .row { display: flex; gap: 8px; align-items: center; }
  .row > * { flex: 1; }
  .muted { color: var(--muted); }
  .tiny { font-size: 12px; }
  .pill {
    display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px;
    font-weight: 600; letter-spacing: .4px; text-transform: uppercase;
  }
  .pill.running  { background: #14324a; color: var(--blue); }
  .pill.complete { background: #11301f; color: var(--accent); }
  .pill.error    { background: #3a1516; color: var(--red); }
  .sev-CRITICAL  { background: #3a1516; color: var(--red); }
  .sev-HIGH      { background: #3a2013; color: var(--orange); }
  .sev-MEDIUM    { background: #383113; color: var(--yellow); }
  .sev-LOW       { background: #14324a; color: var(--blue); }
  .sev-INFO      { background: #1d2530; color: var(--grey); }
  .target-item, .run-item {
    border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;
    background: var(--panel2); margin-top: 8px;
  }
  .run-item { cursor: pointer; }
  .run-item:hover, .target-item:hover { border-color: var(--accent-dim); }
  .run-item.active { border-color: var(--accent); }
  .target-item .top { display: flex; align-items: center; gap: 8px; }
  .target-item .top .name { font-weight: 600; flex: 1; }
  .target-item .url { color: var(--muted); font-size: 12px; word-break: break-all; margin-top: 2px; }
  .type-tag {
    font-size: 10px; text-transform: uppercase; letter-spacing: .6px; padding: 2px 6px;
    border-radius: 4px; background: #1d2530; color: var(--muted);
  }
  .runs-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .runs-head h2 { margin: 0; flex: 1; }
  .err { background: #3a1516; border: 1px solid #5c1e20; color: #f1b0b0; padding: 10px 12px; border-radius: 8px; margin-top: 10px; font-size: 13px; }
  .note { background: #1d2530; border: 1px solid var(--line); color: var(--muted); padding: 10px 12px; border-radius: 8px; margin-top: 10px; font-size: 13px; }
  .findings { margin-top: 14px; }
  .finding { border: 1px solid var(--line); border-radius: 8px; margin-top: 8px; background: var(--panel2); overflow: hidden; }
  .finding > .head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; }
  .finding > .head:hover { background: #1a222d; }
  .finding .title { flex: 1; font-weight: 600; }
  .finding > .body { border-top: 1px solid var(--line); padding: 12px 14px; }
  .field { margin-top: 10px; }
  .field .k { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin-bottom: 3px; }
  .field .v { white-space: pre-wrap; word-break: break-word; }
  .field .v code { background: #0b1219; padding: 1px 5px; border-radius: 4px; }
  pre.code {
    background: #0b1219; border: 1px solid var(--line); border-radius: 6px;
    padding: 10px; overflow-x: auto; font: 12px/1.5 ui-monospace, "Cascadia Mono", Consolas, monospace;
    white-space: pre-wrap; word-break: break-word;
  }
  .md { line-height: 1.6; }
  .md h1, .md h2, .md h3 { line-height: 1.3; margin: 18px 0 8px; }
  .md h1 { font-size: 20px; } .md h2 { font-size: 16px; } .md h3 { font-size: 14px; }
  .md p { margin: 8px 0; } .md ul, .md ol { margin: 8px 0; padding-left: 22px; }
  .md code { background: #0b1219; padding: 1px 5px; border-radius: 4px; }
  .md pre { margin: 10px 0; }
  .md a { color: var(--blue); }
  .md table { border-collapse: collapse; margin: 10px 0; width: 100%; }
  .md th, .md td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; font-size: 13px; }
  .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }
  .kv .cell { background: var(--panel2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .kv .cell .k { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
  .kv .cell .v { font-size: 15px; font-weight: 600; margin-top: 2px; }
  .hidden { display: none; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; vertical-align: -2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<header>
  <div class="logo"></div>
  <h1>Strix Scanner</h1>
  <div class="spacer"></div>
  <a href="#" id="logout">Sign out</a>
</header>

<main>
  <div id="gate" class="panel hidden" style="max-width:420px;margin:60px auto 0;">
    <h2>Sign in</h2>
    <p class="muted tiny">Paste the dashboard token from the Worker secrets.</p>
    <label>Dashboard token</label>
    <input type="password" id="token" placeholder="DASHBOARD_TOKEN value" autocomplete="off">
    <div style="margin-top:12px;"><button id="gateGo" style="width:100%;">Unlock</button></div>
    <div id="gateErr"></div>
  </div>

  <div id="app" class="hidden">
    <div class="cols">
      <!-- ============ left column ============ -->
      <div>
        <div class="panel">
          <h2>New target</h2>
          <label>Type</label>
          <select id="tType">
            <option value="github">GitHub repository (source scan)</option>
            <option value="web">Website / Vercel deployment (live test)</option>
            <option value="supabase">Supabase project API (RLS test)</option>
            <option value="vercel">Vercel project (live test)</option>
          </select>
          <label>Label</label>
          <input id="tLabel" placeholder="ChirplyMint">
          <label>Target</label>
          <input id="tTarget" placeholder="https://github.com/owner/repo  or  https://app.com">
          <label>Extra targets (one per line, optional)</label>
          <textarea id="tExtra" placeholder="e.g. an OpenAPI spec URL, a second domain"></textarea>
          <label>Extra instructions for the agent (optional)</label>
          <textarea id="tInstr" placeholder="e.g. authenticated testing with user:pass"></textarea>
          <div style="margin-top:12px;"><button id="addTarget" style="width:100%;">Add target</button></div>
          <div id="targetMsg"></div>
        </div>

        <div class="panel">
          <h2>Targets</h2>
          <div id="targetList"><span class="muted tiny">Loading…</span></div>
        </div>

        <div class="panel">
          <h2>Run a scan</h2>
          <div id="pickList"><span class="muted tiny">Add a target first.</span></div>
          <label>Scan depth</label>
          <select id="rMode">
            <option value="quick">quick — minutes, cheap, first look</option>
            <option value="standard">standard — ~30 min</option>
            <option value="deep">deep — 1–4 h, most thorough</option>
          </select>
          <label>Spend cap for this run (USD)</label>
          <input id="rBudget" type="number" min="1" max="100" value="10">
          <div style="margin-top:12px;"><button id="runBtn" style="width:100%;">Run scan</button></div>
          <div id="runMsg"></div>
        </div>
      </div>

      <!-- ============ right column ============ -->
      <div>
        <div class="panel">
          <div class="runs-head">
            <h2>Runs</h2>
            <button class="secondary small" id="refreshRuns">Refresh</button>
          </div>
          <div id="runList"><span class="muted tiny">Loading…</span></div>
        </div>

        <div class="panel hidden" id="runDetail">
          <div class="runs-head">
            <h2 id="rdTitle">Run</h2>
            <button class="secondary small" id="rdSync">Sync from GitHub</button>
            <button class="secondary small" id="rdClose">Close</button>
          </div>
          <div id="rdMeta"></div>
          <div id="rdError"></div>
          <div class="findings hidden" id="rdFindingsWrap">
            <h2 style="margin-top:16px;">Findings</h2>
            <div id="rdFindings"></div>
          </div>
          <div id="rdReportWrap" class="hidden">
            <h2 style="margin-top:18px;">Full report</h2>
            <div class="md" id="rdReport"></div>
          </div>
          <div id="rdDocs" class="hidden">
            <h2 style="margin-top:18px;">Finding detail</h2>
            <div id="rdDocBody"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>

<script>
(function () {
  'use strict';

  var TOKEN_KEY = 'strix_dashboard_token';
  var api = function (path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = 'Bearer ' + localStorage.getItem(TOKEN_KEY);
    if (opts.body && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { showGate(); throw new Error('Unauthorized'); }
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  };
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var byId = function (id) { return document.getElementById(id); };

  /* ---------- minimal, escaping-first markdown renderer ---------- */
  function renderMarkdown(src) {
    var out = [];
    var lines = String(src || '').split('\\n');
    var i = 0, inCode = false, codeBuf = [], listType = null;
    function flushList() {
      if (listType) { out.push('</' + listType + '>'); listType = null; }
    }
    function inline(t) {
      t = esc(t);
      t = t.replace(/\`+([^\`]+)\`+/g, function (m, c) { return '<code>' + c + '</code>'; });
      t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|\\W)\\*([^*\\s][^*]*)\\*(?=\\W|$)/g, '$1<em>$2</em>');
      t = t.replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return t;
    }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\\s*\`\`\`/.test(line)) {
        if (!inCode) { flushList(); inCode = true; codeBuf = []; }
        else { inCode = false; out.push('<pre class="code">' + esc(codeBuf.join('\\n')) + '</pre>'); }
        i++; continue;
      }
      if (inCode) { codeBuf.push(line); i++; continue; }
      var h = /^(#{1,4})\\s+(.*)$/.exec(line);
      if (h) {
        flushList();
        var lvl = Math.min(h[1].length + 1, 5);
        out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
        i++; continue;
      }
      var ul = /^[-*+]\\s+/.test(line), ol = /^\\d+[.)]\\s+/.test(line);
      if (ul || ol) {
        var want = ul ? 'ul' : 'ol';
        if (listType !== want) { flushList(); listType = want; out.push('<' + want + '>'); }
        out.push('<li>' + inline(line.replace(/^[-*+]|^\\d+[.)]/, '').replace(/^\\s+/, '')) + '</li>');
        i++; continue;
      }
      if (/^\\s*$/.test(line)) { flushList(); i++; continue; }
      if (/^\\s*\\|.*\\|\\s*$/.test(line) && /^\\s*\\|[-\\s|:]+\\|\\s*$/.test(lines[i + 1] || '')) {
        flushList();
        var rows = [];
        while (i < lines.length && /^\\s*\\|.*\\|\\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        var cells = function (r) { return r.replace(/^\\s*\\||\\|\\s*$/g, '').split('|'); };
        var head = cells(rows[0]);
        var html = '<table><thead><tr>';
        head.forEach(function (c) { html += '<th>' + inline(c.trim()) + '</th>'; });
        html += '</tr></thead><tbody>';
        for (var r = 2; r < rows.length; r++) {
          html += '<tr>';
          cells(rows[r]).forEach(function (c) { html += '<td>' + inline(c.trim()) + '</td>'; });
          html += '</tr>';
        }
        out.push(html + '</tbody></table>');
        continue;
      }
      flushList();
      out.push('<p>' + inline(line) + '</p>');
      i++;
    }
    if (inCode) out.push('<pre class="code">' + esc(codeBuf.join('\\n')) + '</pre>');
    flushList();
    return out.join('\\n');
  }

  /* ---------- auth gate ---------- */
  function showGate() {
    byId('gate').classList.remove('hidden');
    byId('app').classList.add('hidden');
  }
  function showApp() {
    byId('gate').classList.add('hidden');
    byId('app').classList.remove('hidden');
    loadTargets(); loadRuns();
  }
  byId('gateGo').addEventListener('click', function () {
    localStorage.setItem(TOKEN_KEY, byId('token').value.trim());
    api('/api/targets').then(function () { showApp(); })
      .catch(function (e) {
        if (e.message !== 'Unauthorized') byId('gateErr').innerHTML = '<div class="err">' + esc(e.message) + '</div>';
      });
  });
  byId('logout').addEventListener('click', function (e) {
    e.preventDefault(); localStorage.removeItem(TOKEN_KEY); showGate();
  });

  /* ---------- targets ---------- */
  var TARGETS = [];
  function loadTargets() {
    return api('/api/targets').then(function (data) {
      TARGETS = data.targets || [];
      var list = byId('targetList');
      if (!TARGETS.length) {
        list.innerHTML = '<span class="muted tiny">No targets yet — add one above.</span>';
      } else {
        list.innerHTML = TARGETS.map(function (t) {
          return '<div class="target-item" data-id="' + esc(t.id) + '">' +
            '<div class="top"><span class="type-tag">' + esc(t.type) + '</span>' +
            '<span class="name">' + esc(t.label) + '</span>' +
            '<button class="small secondary del">Delete</button></div>' +
            '<div class="url">' + esc(t.target) + '</div></div>';
        }).join('');
        Array.prototype.forEach.call(list.querySelectorAll('.del'), function (btn) {
          btn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var id = ev.target.closest('.target-item').getAttribute('data-id');
            api('/api/targets/' + id, { method: 'DELETE' }).then(loadTargets);
          });
        });
      }
      renderPickList();
    });
  }
  byId('addTarget').addEventListener('click', function () {
    var payload = {
      type: byId('tType').value,
      label: byId('tLabel').value.trim(),
      target: byId('tTarget').value.trim(),
      extra_targets: byId('tExtra').value,
      instructions: byId('tInstr').value
    };
    if (!payload.label || !payload.target) {
      byId('targetMsg').innerHTML = '<div class="err">Label and target are both required.</div>'; return;
    }
    api('/api/targets', { method: 'POST', body: JSON.stringify(payload) }).then(function () {
      byId('tLabel').value = ''; byId('tTarget').value = ''; byId('tExtra').value = ''; byId('tInstr').value = '';
      byId('targetMsg').innerHTML = '<div class="note">Target added.</div>';
      loadTargets();
    }).catch(function (e) {
      byId('targetMsg').innerHTML = '<div class="err">' + esc(e.message) + '</div>';
    });
  });

  /* ---------- run launcher ---------- */
  function renderPickList() {
    var pick = byId('pickList');
    if (!TARGETS.length) {
      pick.innerHTML = '<span class="muted tiny">Add a target first.</span>'; return;
    }
    pick.innerHTML = TARGETS.map(function (t) {
      return '<label style="display:flex;align-items:center;gap:8px;margin:6px 0;">' +
        '<input type="checkbox" class="pick" value="' + esc(t.id) + '" style="width:auto;">' +
        '<span>' + esc(t.label) + ' <span class="type-tag">' + esc(t.type) + '</span></span></label>';
    }).join('');
    Array.prototype.forEach.call(pick.querySelectorAll('.pick'), function (cb) { cb.checked = true; });
  }
  byId('runBtn').addEventListener('click', function () {
    var ids = Array.prototype.map.call(document.querySelectorAll('.pick:checked'), function (cb) { return cb.value; });
    if (!ids.length) {
      byId('runMsg').innerHTML = '<div class="err">Tick at least one target.</div>'; return;
    }
    var btn = byId('runBtn');
    btn.disabled = true;
    byId('runMsg').innerHTML = '<div class="note"><span class="spinner"></span> Dispatching to GitHub Actions…</div>';
    api('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ target_ids: ids, scan_mode: byId('rMode').value, budget: byId('rBudget').value })
    }).then(function (data) {
      byId('runMsg').innerHTML = '<div class="note">Scan dispatched. It now runs on GitHub — the report lands here automatically when finished.</div>';
      loadRuns();
    }).catch(function (e) {
      byId('runMsg').innerHTML = '<div class="err">' + esc(e.message) + '</div>';
    }).finally(function () { btn.disabled = false; });
  });

  /* ---------- runs ---------- */
  var RUNS = [];
  var OPEN_RUN = null;
  function loadRuns() {
    return api('/api/runs').then(function (data) {
      RUNS = data.runs || [];
      var list = byId('runList');
      if (!RUNS.length) {
        list.innerHTML = '<span class="muted tiny">No runs yet.</span>';
      } else {
        list.innerHTML = RUNS.map(function (r) {
          var when = new Date(r.created_at).toLocaleString();
          var targets = summaryOf(r.targets_json);
          return '<div class="run-item' + (OPEN_RUN === r.id ? ' active' : '') + '" data-id="' + esc(r.id) + '">' +
            '<div class="row" style="gap:8px;">' +
            '<span class="pill ' + esc(r.status) + '">' + esc(r.status) + '</span>' +
            '<span class="tiny muted" style="flex:1;">' + esc(when) + ' · ' + esc(r.scan_mode) + ' · cap $' + esc(r.budget) + '</span></div>' +
            '<div class="tiny" style="margin-top:4px;color:var(--muted);">' + esc(targets) + '</div>' +
            (r.error ? '<div class="tiny" style="margin-top:4px;color:#f1b0b0;">' + esc(r.error) + '</div>' : '') +
            '</div>';
        }).join('');
        Array.prototype.forEach.call(list.querySelectorAll('.run-item'), function (el) {
          el.addEventListener('click', function () { openRun(el.getAttribute('data-id')); });
        });
      }
      if (RUNS.some(function (r) { return r.status === 'running'; })) schedulePoll();
    });
  }
  function summaryOf(targetsJson) {
    try {
      var arr = JSON.parse(targetsJson || '[]');
      return arr.map(function (t) { return t.label || t.target; }).join(', ');
    } catch (e) { return ''; }
  }
  function schedulePoll() {
    if (schedulePoll.timer) return;
    schedulePoll.timer = setInterval(function () {
      loadRuns().then(function () {
        if (OPEN_RUN) openRun(OPEN_RUN, true);
        if (!RUNS.some(function (r) { return r.status === 'running'; })) {
          clearInterval(schedulePoll.timer); schedulePoll.timer = null;
        }
      });
    }, 15000);
  }
  byId('refreshRuns').addEventListener('click', function () { loadRuns(); });

  var SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  function openRun(id, quiet) {
    OPEN_RUN = id;
    byId('runDetail').classList.remove('hidden');
    byId('rdDocs').classList.add('hidden');
    api('/api/runs/' + id).then(function (data) {
      var r = data.run;
      byId('rdTitle').textContent = 'Run ' + r.id;
      var targets = summaryOf(r.targets_json);
      var findings = [];
      try { findings = JSON.parse(r.findings_json || '[]'); } catch (e) {}
      var counts = {};
      findings.forEach(function (f) { var s = (f.severity || 'INFO').toUpperCase(); counts[s] = (counts[s] || 0) + 1; });
      var sevHtml = SEV_ORDER.map(function (s) {
        return counts[s] ? '<div class="cell"><div class="k">' + s + '</div><div class="v">' + counts[s] + '</div></div>' : '';
      }).join('');
      byId('rdMeta').innerHTML =
        '<div style="margin-top:6px;"><span class="pill ' + esc(r.status) + '">' + esc(r.status) + '</span></div>' +
        '<div class="kv">' +
        '<div class="cell"><div class="k">Depth</div><div class="v">' + esc(r.scan_mode) + '</div></div>' +
        '<div class="cell"><div class="k">Exit code</div><div class="v">' + esc(r.exit_code == null ? '—' : r.exit_code) + '</div></div>' +
        '<div class="cell"><div class="k">Budget cap</div><div class="v">$' + esc(r.budget) + '</div></div>' +
        '<div class="cell"><div class="k">Started</div><div class="v" style="font-size:13px;">' + esc(new Date(r.created_at).toLocaleString()) + '</div></div>' +
        (counts && Object.keys(counts).length ? sevHtml : '') +
        '</div>' +
        '<div class="field"><div class="k">Targets</div><div class="v">' + esc(targets) + '</div></div>' +
        (r.gh_run_url ? '<div class="field"><div class="k">GitHub run</div><div class="v"><a href="' + esc(r.gh_run_url) + '" target="_blank" rel="noopener noreferrer">open workflow run</a></div></div>' : '');

      byId('rdError').innerHTML = r.error ? '<div class="err">' + esc(r.error) + '</div>' : '';

      var fWrap = byId('rdFindingsWrap');
      if (findings.length) {
        fWrap.classList.remove('hidden');
        byId('rdFindings').innerHTML = findings.map(function (f) {
          var sev = (f.severity || 'INFO').toUpperCase();
          return '<div class="finding"><div class="head" data-fid="' + esc(f.id) + '">' +
            '<span class="pill sev-' + esc(sev) + '">' + esc(sev) + '</span>' +
            '<span class="title">' + esc(f.title) + '</span>' +
            (f.cvss ? '<span class="tiny muted">CVSS ' + esc(f.cvss) + '</span>' : '') +
            '</div><div class="body hidden">' + findingBody(f) + '</div></div>';
        }).join('');
        Array.prototype.forEach.call(byId('rdFindings').querySelectorAll('.finding > .head'), function (head) {
          head.addEventListener('click', function () {
            var body = head.nextElementSibling;
            body.classList.toggle('hidden');
            if (!body.classList.contains('hidden')) loadDoc(id, head.getAttribute('data-fid'), body);
          });
        });
      } else {
        fWrap.classList.add('hidden');
        byId('rdFindings').innerHTML = '';
      }

      var repWrap = byId('rdReportWrap');
      if (r.report_md) {
        repWrap.classList.remove('hidden');
        byId('rdReport').innerHTML = renderMarkdown(r.report_md);
      } else {
        repWrap.classList.add('hidden');
        byId('rdReport').innerHTML = '';
      }
      if (!quiet) byId('runDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function kvField(k, v, code) {
    if (v == null || v === '') return '';
    return '<div class="field"><div class="k">' + esc(k) + '</div><div class="v">' +
      (code ? '<pre class="code">' + esc(v) + '</pre>' : esc(v)) + '</div></div>';
  }
  function findingBody(f) {
    var cwe = f.cwe ? String(f.cwe) : '';
    var meta = [];
    if (f.endpoint) meta.push('Endpoint: ' + f.endpoint);
    if (f.method) meta.push('Method: ' + f.method);
    if (f.cve) meta.push('CVE: ' + f.cve);
    if (cwe) meta.push('CWE: ' + cwe);
    if (f.confidence) meta.push('Confidence: ' + f.confidence);
    if (f.fix_effort) meta.push('Fix effort: ' + f.fix_effort);
    return kvField('Summary', meta.join(' · ')) +
      kvField('Impact', f.impact) +
      kvField('Technical analysis', f.technical_analysis) +
      kvField('Proof of concept', f.poc_description) +
      (f.poc_script_code ? kvField('PoC script', f.poc_script_code, true) : '') +
      kvField('Evidence', Array.isArray(f.evidence) ? f.evidence.join('\\n\\n') : f.evidence) +
      kvField('Remediation', Array.isArray(f.remediation_steps) ? f.remediation_steps.join('\\n') : f.remediation_steps) +
      '<div class="tiny muted" style="margin-top:12px;">Full write-up loads below when the agent saved one.</div>';
  }
  function loadDoc(runId, fid, container) {
    var slot = byId('rdDocs');
    api('/api/runs/' + runId + '/docs/' + encodeURIComponent(fid)).then(function (data) {
      slot.classList.remove('hidden');
      byId('rdDocBody').innerHTML = renderMarkdown(data.markdown || '(no detail saved)');
      container.appendChild(slot);
    }).catch(function () { /* no doc saved for this finding */ });
  }
  byId('rdClose').addEventListener('click', function () {
    byId('runDetail').classList.add('hidden'); OPEN_RUN = null;
  });
  byId('rdSync').addEventListener('click', function () {
    if (!OPEN_RUN) return;
    api('/api/runs/' + OPEN_RUN + '/sync', { method: 'POST' }).then(function () { loadRuns(); openRun(OPEN_RUN, true); });
  });

  /* ---------- boot ---------- */
  if (localStorage.getItem(TOKEN_KEY)) {
    api('/api/targets').then(showApp).catch(function (e) {
      if (e.message !== 'Unauthorized') showApp();
    });
  } else {
    showGate();
  }
})();
</script>
</body>
</html>`;
}
