// Builds a fully STATIC self-contained HTML dashboard (no JavaScript) preloaded
// with the real PSP numbers. Works even in locked-down in-app file previewers
// that block JS. Computes everything in PGlite, then renders plain HTML.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync } from 'node:fs';

function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let i = 0; let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const db = new PGlite();
await db.exec(readFileSync('tests/fixtures/auth_shim.sql', 'utf8'));
await db.exec(readFileSync('supabase/setup_full.sql', 'utf8'));
const csv = parseCSV(readFileSync('data/sales_transactions.csv', 'utf8'));
const header = csv[0];
const bodyRows = csv.slice(1).filter((r) => r.length === header.length);
const nullify = (v) => (v === '' ? null : v);
for (let s = 0; s < bodyRows.length; s += 1000) {
  const batch = bodyRows.slice(s, s + 1000);
  const vals = []; const params = []; let p = 1;
  for (const r of batch) { vals.push(`(${header.map(() => `$${p++}`).join(',')})`); params.push(...r.map(nullify)); }
  await db.query(`insert into sales_transactions (${header.join(',')}) values ${vals.join(',')}`, params);
}
const one = async (sql) => (await db.query(sql)).rows[0];
const all = async (sql) => (await db.query(sql)).rows;

const kpis = await one('select * from portfolio_kpis');
const T = await one('select * from targets');
const pastCadence = Number((await one('select count(*) n from branch_metrics where days_idle > (select cadence_days from targets)')).n);
const leak = await all('select account_name, ttm_revenue, prior_revenue, delta, delta_pct from account_metrics where delta < 0 order by delta asc limit 10');
const ws = Object.fromEntries((await all('select * from whitespace_summary')).map((w) => [w.white_space, w]));
const accounts = await all('select account_id, account_name, primary_state, branch_count, ttm_revenue, prior_revenue, delta, delta_pct, status, coverage_rag from account_metrics order by ttm_revenue desc');
const branches = await all('select account_id, branch_name, city, state, ttm_revenue, delta_pct, days_idle, status, coverage_rag, white_space from branch_metrics');
await db.close();

const branchesByAccount = {};
for (const b of branches) (branchesByAccount[b.account_id] ||= []).push(b);
for (const id in branchesByAccount) branchesByAccount[id].sort((a, b) => +b.ttm_revenue - +a.ttm_revenue);

// ── formatters ──
const money = (n) => { if (n == null) return '—'; const a = Math.abs(+n), s = +n < 0 ? '-' : ''; if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'K'; return s + '$' + a.toFixed(0); };
const pct = (r, d = 1) => r == null ? '—' : (+r * 100).toFixed(d) + '%';
const dpct = (r) => r == null ? 'n/m' : (+r * 100 >= 0 ? '+' : '') + (+r * 100).toFixed(0) + '%';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = (s) => 's-' + String(s).replace(/[^A-Za-z]/g, '');
const ccls = (s) => 'c-' + String(s).replace(/[^A-Za-z]/g, '');
const tone = (v, t, dir) => v == null ? '' : dir === 'gte' ? (+v >= t ? 'good' : +v >= t * 0.9 ? 'warn' : 'bad') : (+v <= t ? 'good' : +v <= t * 1.3 ? 'warn' : 'bad');
const wsLabel = (w) => w === 'Steel gap' ? 'No steel' : w === 'Alu gap' ? 'No aluminum' : w === 'Both' ? 'No alu/steel' : '—';
const tile = (lab, val, sub, toneCls, flag) => `<div class="card tile${flag ? ' ring' : ''}"><div class="lab"><span>${lab}</span>${flag ? '<span class="flag">Flagship</span>' : ''}</div><div class="val ${toneCls || ''}">${val}</div><p class="sub">${sub || ''}</p></div>`;

const tiles = [
  tile('Current book (TTM)', money(kpis.current_book), `Prior ${money(kpis.prior_book)} · <b class="${+kpis.yoy >= 0 ? 'good' : 'bad'}">${dpct(kpis.yoy)} YoY</b>`),
  tile('GRR', pct(kpis.grr), `Target ${pct(T.grr_target, 0)}`, tone(kpis.grr, +T.grr_target, 'gte'), true),
  tile('NRR', pct(kpis.nrr), `Target ${pct(T.nrr_target, 0)}`, tone(kpis.nrr, +T.nrr_target, 'gte')),
  tile('Gross margin', pct(kpis.gm_pct), 'TTM blended'),
  tile('Contraction', money(kpis.contraction), `Ceiling ${money(T.contraction_ceiling)}`, tone(kpis.contraction, +T.contraction_ceiling, 'lte')),
  tile('Expansion', money(kpis.expansion), 'Growth in retained', 'good'),
  tile('New business', money(kpis.new_business), `${kpis.new_accounts} new · target ${money(T.new_biz_target)}`, tone(kpis.new_business, +T.new_biz_target, 'gte')),
  tile('Past reorder cadence', String(pastCadence), `Branches idle > ${T.cadence_days}d`, pastCadence > 0 ? 'warn' : 'good'),
].join('');

const leakRows = leak.map((a) => `<tr><td>${esc(a.account_name)}</td><td class="r">${money(a.ttm_revenue)}</td><td class="r mut">${money(a.prior_revenue)}</td><td class="r bad">${money(a.delta)}</td><td class="r mut">${dpct(a.delta_pct)}</td></tr>`).join('');
const wsRow = (lab, w) => `<div class="pill"><span>${lab}</span><span><b>${w ? w.branch_count : 0}</b> &nbsp;<span class="mut">${money(w ? w.ttm_revenue : 0)}</span></span></div>`;

const accountBlocks = accounts.map((a) => {
  const bs = branchesByAccount[a.account_id] || [];
  const brows = bs.map((b) => `<tr><td>${esc(b.branch_name)}</td><td class="mut">${esc([b.city, b.state].filter(Boolean).join(', ')) || '—'}</td><td class="r">${money(b.ttm_revenue)}</td><td class="r ${b.delta_pct != null && +b.delta_pct < 0 ? 'bad' : 'good'}">${dpct(b.delta_pct)}</td><td class="r mut">${b.days_idle == null ? '—' : b.days_idle + 'd'}</td><td><span class="tag ${cls(b.status)}">${b.status}</span></td><td class="mut">${wsLabel(b.white_space)}</td></tr>`).join('');
  return `<details class="acct"><summary><span class="aname">${esc(a.account_name)}</span><span class="ameta"><span class="tag ${cls(a.status)}">${a.status}</span> <span class="tag ${ccls(a.coverage_rag)}">${a.coverage_rag}</span> <b>${money(a.ttm_revenue)}</b> <span class="mut ${+a.delta < 0 ? 'bad' : 'good'}">${dpct(a.delta_pct)}</span></span></summary>
    <div class="overflow"><table><thead><tr><th>Branch</th><th>Location</th><th class="r">TTM</th><th class="r">Δ%</th><th class="r">Idle</th><th>Status</th><th>White-space</th></tr></thead><tbody>${brows || '<tr><td colspan="7" class="mut">No branches</td></tr>'}</tbody></table></div></details>`;
}).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Pacific Shoring — Coverage Dashboard (demo)</title>
<style>
:root{--brand:#F26A1B;--brand50:#fef2ea;--brand700:#b4470d;--ink:#1e1e1e;--mut:#6b7280;--canvas:#f4f5f7;--line:#e5e7eb;--ok:#15803d;--okbg:#dcfce7;--warn:#b45309;--warnbg:#fef3c7;--bad:#b91c1c;--badbg:#fee2e2;--blue:#1d4ed8;--bluebg:#dbeafe}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--canvas);color:var(--ink)}
.demobar{background:#1e1e1e;color:#fff;font-size:12px;text-align:center;padding:6px 10px}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;align-items:center;gap:10px;z-index:5}
.logo{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:5px;background:var(--brand);color:#fff;font-weight:800;font-size:13px}
.brand b{font-size:14px}.brand div{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--mut)}
.wrap{max-width:1100px;margin:0 auto;padding:18px 16px 60px}h1{font-size:20px;margin:.2em 0}.sub{color:var(--mut);font-size:13px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:760px){.grid{grid-template-columns:repeat(2,1fr)}}
.card{background:#fff;border:1px solid var(--line);border-radius:10px}.tile{padding:14px}
.tile .lab{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);display:flex;justify-content:space-between}
.tile .val{font-size:23px;font-weight:800;margin-top:4px}.tile .sub{font-size:12px;color:var(--mut);margin:0}
.flag{background:var(--brand50);color:var(--brand700);font-size:9px;font-weight:800;text-transform:uppercase;padding:1px 5px;border-radius:4px}
.good{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.mut{color:var(--mut)}.ring{box-shadow:0 0 0 2px rgba(242,106,27,.35)}
section{margin-top:22px}h2{font-size:14px;margin:0 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:var(--mut);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--line);padding:8px 10px}
td{padding:8px 10px;border-bottom:1px solid #f0f1f3}.r{text-align:right}
.tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700}
.s-Active,.c-Ontrack{background:var(--okbg);color:var(--ok)}.s-New{background:var(--bluebg);color:var(--blue)}
.s-Declining,.c-Watch{background:var(--warnbg);color:var(--warn)}.s-Lapsed,.c-Atrisk{background:var(--badbg);color:var(--bad)}
.overflow{overflow-x:auto}.pill{background:var(--canvas);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px}
.note{font-size:12px;color:var(--mut);margin-top:8px}
details.acct{background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;padding:0 12px}
details.acct>summary{list-style:none;cursor:pointer;padding:12px 0;display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;align-items:center}
details.acct>summary::-webkit-details-marker{display:none}
.aname{font-weight:700;color:var(--brand700)}.aname::before{content:"▸ ";color:var(--mut)}
details.acct[open]>summary .aname::before{content:"▾ "}
.ameta{font-size:12px;display:flex;gap:6px;align-items:center}
</style></head><body>
<div class="demobar">DEMO SNAPSHOT — your real PSP numbers, as of 2026-05-31. Read-only preview of the live Coverage Dashboard.</div>
<header><span class="logo">PS</span><span class="brand"><b>PACIFIC SHORING</b><div>Coverage CRM</div></span></header>
<div class="wrap">
  <h1>Coverage Dashboard</h1><div class="sub">Full portfolio · as of 2026-05-31</div>
  <div class="grid">${tiles}</div>
  <section><div class="card" style="padding:14px"><h2>Where the leak is — top contracting accounts</h2>
    <div class="overflow"><table><thead><tr><th>Account</th><th class="r">TTM</th><th class="r">Prior</th><th class="r">Δ</th><th class="r">Δ%</th></tr></thead><tbody>${leakRows}</tbody></table></div></div></section>
  <section><div class="card" style="padding:14px"><h2>Cross-sell white-space</h2>
    ${wsRow('Aluminum-only (no steel)', ws['Steel gap'])}${wsRow('Steel-only (no aluminum)', ws['Alu gap'])}
    <p class="note">Branches buying one product line but not the other — the clearest cross-sell openings.</p></div></section>
  <section><h2>Accounts (${accounts.length}) — tap a row to see its branches</h2>${accountBlocks}</section>
</div></body></html>`;

writeFileSync('psp-dashboard-demo.html', html);
console.log('wrote psp-dashboard-demo.html (' + (html.length / 1024).toFixed(0) + ' KB) — fully static, no JS');
