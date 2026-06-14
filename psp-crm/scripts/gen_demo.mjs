// Builds a single self-contained HTML dashboard preloaded with the real PSP
// numbers — no database, no server, no login. Computes everything in PGlite from
// setup_full.sql + sales_transactions.csv, then embeds the results as JSON.
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
const body = csv.slice(1).filter((r) => r.length === header.length);
const nullify = (v) => (v === '' ? null : v);
for (let s = 0; s < body.length; s += 1000) {
  const batch = body.slice(s, s + 1000);
  const vals = []; const params = []; let p = 1;
  for (const r of batch) { vals.push(`(${header.map(() => `$${p++}`).join(',')})`); params.push(...r.map(nullify)); }
  await db.query(`insert into sales_transactions (${header.join(',')}) values ${vals.join(',')}`, params);
}

const one = async (sql) => (await db.query(sql)).rows[0];
const all = async (sql) => (await db.query(sql)).rows;

const data = {
  asOf: '2026-05-31',
  kpis: await one('select * from portfolio_kpis'),
  targets: await one('select * from targets'),
  pastCadence: Number((await one('select count(*) n from branch_metrics where days_idle > (select cadence_days from targets)')).n),
  leak: await all('select account_id, account_name, ttm_revenue, prior_revenue, delta, delta_pct from account_metrics where delta < 0 order by delta asc limit 10'),
  whitespace: await all('select * from whitespace_summary'),
  accounts: await all('select account_id, account_name, primary_state, branch_count, ttm_revenue, prior_revenue, delta, delta_pct, status, coverage_rag from account_metrics order by ttm_revenue desc'),
  branches: await all('select branch_id, account_id, branch_name, city, state, ttm_revenue, prior_revenue, delta_pct, days_idle, status, coverage_rag, white_space, aluminum_ttm, steel_ttm, gm_pct from branch_metrics'),
};
await db.close();

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Pacific Shoring — Coverage Dashboard (demo)</title>
<style>
  :root{--brand:#F26A1B;--brand50:#fef2ea;--brand700:#b4470d;--ink:#1e1e1e;--muted:#6b7280;
    --canvas:#f4f5f7;--line:#e5e7eb;--ok:#15803d;--okbg:#dcfce7;--warn:#b45309;--warnbg:#fef3c7;--bad:#b91c1c;--badbg:#fee2e2;--blue:#1d4ed8;--bluebg:#dbeafe;}
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--canvas);color:var(--ink)}
  header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;align-items:center;gap:10px;z-index:5}
  .logo{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:5px;background:var(--brand);color:#fff;font-weight:800;font-size:13px}
  .brand b{font-size:14px;letter-spacing:-.2px} .brand div{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted)}
  .wrap{max-width:1100px;margin:0 auto;padding:18px 16px 60px}
  h1{font-size:20px;margin:.2em 0} .sub{color:var(--muted);font-size:13px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px} @media(max-width:760px){.grid{grid-template-columns:repeat(2,1fr)}}
  .card{background:#fff;border:1px solid var(--line);border-radius:10px}
  .tile{padding:14px} .tile .lab{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);display:flex;justify-content:space-between}
  .tile .val{font-size:24px;font-weight:800;margin-top:4px} .tile .sub{font-size:12px;color:var(--muted);margin:0}
  .flag{background:var(--brand50);color:var(--brand700);font-size:9px;font-weight:800;text-transform:uppercase;padding:1px 5px;border-radius:4px}
  .good{color:var(--ok)} .warn{color:var(--warn)} .bad{color:var(--bad)} .ring{box-shadow:0 0 0 2px rgba(242,106,27,.35)}
  section{margin-top:22px} h2{font-size:14px;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:13px} th{ text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--line);padding:8px 10px}
  td{padding:8px 10px;border-bottom:1px solid #f0f1f3} tr:last-child td{border-bottom:0}
  .r{text-align:right} .tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700}
  .s-Active,.c-Ontrack{background:var(--okbg);color:var(--ok)} .s-New{background:var(--bluebg);color:var(--blue)}
  .s-Declining,.c-Watch{background:var(--warnbg);color:var(--warn)} .s-Lapsed,.c-Atrisk{background:var(--badbg);color:var(--bad)}
  a.link{color:var(--brand700);font-weight:600;cursor:pointer;text-decoration:none} a.link:hover{text-decoration:underline}
  .overflow{overflow-x:auto} .back{cursor:pointer;color:var(--brand700);font-size:13px;font-weight:600}
  .note{font-size:12px;color:var(--muted);margin-top:8px} .pill{background:var(--canvas);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px}
  .demobar{background:#1e1e1e;color:#fff;font-size:12px;text-align:center;padding:6px}
</style></head>
<body>
<div class="demobar">DEMO SNAPSHOT — real PSP numbers, as of 2026-05-31. Read-only preview of the live Coverage Dashboard.</div>
<header><span class="logo">PS</span><span class="brand"><b>PACIFIC SHORING</b><div>Coverage CRM</div></span></header>
<div class="wrap">
  <div id="view"></div>
</div>
<script>
const DATA = ${JSON.stringify(data)};
const T = DATA.targets;
const money=(n)=>{if(n==null)return '—';const a=Math.abs(n),s=n<0?'-':'';if(a>=1e6)return s+'$'+(a/1e6).toFixed(2)+'M';if(a>=1e3)return s+'$'+(a/1e3).toFixed(0)+'K';return s+'$'+a.toFixed(0);};
const pct=(r,d=1)=>r==null?'—':(r*100).toFixed(d)+'%';
const dpct=(r)=>r==null?'n/m':(r*100>=0?'+':'')+(r*100).toFixed(0)+'%';
const cls=(s)=>'s-'+String(s).replace(/[^A-Za-z]/g,'');
const ccls=(s)=>'c-'+String(s).replace(/[^A-Za-z]/g,'');
const tone=(v,t,dir)=>v==null?'':dir==='gte'?(v>=t?'good':v>=t*0.9?'warn':'bad'):(v<=t?'good':v<=t*1.3?'warn':'bad');
function tile(lab,val,sub,toneCls,flag){return '<div class="card tile'+(flag?' ring':'')+'"><div class="lab"><span>'+lab+'</span>'+(flag?'<span class="flag">Flagship</span>':'')+'</div><div class="val '+(toneCls||'')+'">'+val+'</div><p class="sub">'+(sub||'')+'</p></div>';}

function dashboard(){
  const k=DATA.kpis;
  const tiles=[
    tile('Current book (TTM)',money(+k.current_book),'Prior '+money(+k.prior_book)+' · <b class="'+((+k.yoy>=0)?'good':'bad')+'">'+dpct(+k.yoy)+' YoY</b>'),
    tile('GRR',pct(+k.grr),'Target '+pct(+T.grr_target,0),tone(+k.grr,+T.grr_target,'gte'),true),
    tile('NRR',pct(+k.nrr),'Target '+pct(+T.nrr_target,0),tone(+k.nrr,+T.nrr_target,'gte')),
    tile('Gross margin',pct(+k.gm_pct),'TTM blended'),
    tile('Contraction',money(+k.contraction),'Ceiling '+money(+T.contraction_ceiling),tone(+k.contraction,+T.contraction_ceiling,'lte')),
    tile('Expansion',money(+k.expansion),'Growth in retained','good'),
    tile('New business',money(+k.new_business),k.new_accounts+' new · target '+money(+T.new_biz_target),tone(+k.new_business,+T.new_biz_target,'gte')),
    tile('Past reorder cadence',String(DATA.pastCadence),'Branches idle > '+T.cadence_days+'d',DATA.pastCadence>0?'warn':'good'),
  ].join('');
  const leak=DATA.leak.map(a=>'<tr><td><a class="link" onclick="account(\\''+a.account_id+'\\')">'+esc(a.account_name)+'</a></td><td class="r">'+money(+a.ttm_revenue)+'</td><td class="r" style="color:var(--muted)">'+money(+a.prior_revenue)+'</td><td class="r bad">'+money(+a.delta)+'</td><td class="r" style="color:var(--muted)">'+dpct(+a.delta_pct)+'</td></tr>').join('');
  const ws=Object.fromEntries(DATA.whitespace.map(w=>[w.white_space,w]));
  const wrow=(lab,w)=>'<div class="pill"><span>'+lab+'</span><span><b>'+(w?w.branch_count:0)+'</b> &nbsp;<span style="color:var(--muted)">'+money(w?+w.ttm_revenue:0)+'</span></span></div>';
  document.getElementById('view').innerHTML=
    '<h1>Coverage Dashboard</h1><div class="sub">Full portfolio · as of '+DATA.asOf+'</div>'+
    '<div class="grid">'+tiles+'</div>'+
    '<section><div class="card" style="padding:14px"><h2>Where the leak is — top contracting accounts</h2><div class="overflow"><table><thead><tr><th>Account</th><th class="r">TTM</th><th class="r">Prior</th><th class="r">Δ</th><th class="r">Δ%</th></tr></thead><tbody>'+leak+'</tbody></table></div></div></section>'+
    '<section><div class="card" style="padding:14px"><h2>Cross-sell white-space</h2>'+wrow('Aluminum-only (no steel)',ws['Steel gap'])+wrow('Steel-only (no aluminum)',ws['Alu gap'])+'<p class="note">Branches buying one product line but not the other — the clearest cross-sell openings.</p></div></section>'+
    '<section><div class="card" style="padding:14px"><h2>Accounts ('+DATA.accounts.length+')</h2><div class="overflow"><table><thead><tr><th>Account</th><th>State</th><th class="r">Branches</th><th class="r">TTM</th><th class="r">Δ%</th><th>Status</th><th>Coverage</th></tr></thead><tbody>'+
      DATA.accounts.map(a=>'<tr><td><a class="link" onclick="account(\\''+a.account_id+'\\')">'+esc(a.account_name)+'</a></td><td style="color:var(--muted)">'+(a.primary_state||'—')+'</td><td class="r">'+a.branch_count+'</td><td class="r">'+money(+a.ttm_revenue)+'</td><td class="r '+((+a.delta<0)?'bad':'good')+'">'+dpct(+a.delta_pct)+'</td><td><span class="tag '+cls(a.status)+'">'+a.status+'</span></td><td><span class="tag '+ccls(a.coverage_rag)+'">'+a.coverage_rag+'</span></td></tr>').join('')+
    '</tbody></table></div></div></section>';
  window.scrollTo(0,0);
}
function account(id){
  const a=DATA.accounts.find(x=>x.account_id===id);
  const bs=DATA.branches.filter(b=>b.account_id===id).sort((x,y)=>+y.ttm_revenue-+x.ttm_revenue);
  const rows=bs.map(b=>'<tr><td>'+esc(b.branch_name)+'</td><td style="color:var(--muted)">'+[b.city,b.state].filter(Boolean).join(', ')+'</td><td class="r">'+money(+b.ttm_revenue)+'</td><td class="r '+((b.delta_pct!=null&&+b.delta_pct<0)?'bad':'good')+'">'+dpct(b.delta_pct==null?null:+b.delta_pct)+'</td><td class="r" style="color:var(--muted)">'+(b.days_idle==null?'—':b.days_idle+'d')+'</td><td><span class="tag '+cls(b.status)+'">'+b.status+'</span></td><td><span class="tag '+ccls(b.coverage_rag)+'">'+b.coverage_rag+'</span></td><td style="color:var(--muted)">'+wsLabel(b.white_space)+'</td></tr>').join('');
  document.getElementById('view').innerHTML=
    '<div class="back" onclick="dashboard()">← Dashboard</div>'+
    '<h1>'+esc(a.account_name)+' <span class="tag '+cls(a.status)+'">'+a.status+'</span> <span class="tag '+ccls(a.coverage_rag)+'">'+a.coverage_rag+'</span></h1>'+
    '<div class="sub">'+(a.primary_state||'')+' · '+a.branch_count+' branches</div>'+
    '<div class="grid"><div class="card tile"><div class="lab">TTM revenue</div><div class="val">'+money(+a.ttm_revenue)+'</div></div>'+
    '<div class="card tile"><div class="lab">Prior</div><div class="val">'+money(+a.prior_revenue)+'</div><p class="sub">'+dpct(+a.delta_pct)+' YoY</p></div>'+
    '<div class="card tile"><div class="lab">Change</div><div class="val '+((+a.delta<0)?'bad':'good')+'">'+money(+a.delta)+'</div></div></div>'+
    '<section><div class="card" style="padding:14px"><h2>Branches</h2><div class="overflow"><table><thead><tr><th>Branch</th><th>Location</th><th class="r">TTM</th><th class="r">Δ%</th><th class="r">Idle</th><th>Status</th><th>Coverage</th><th>White-space</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section>';
  window.scrollTo(0,0);
}
function wsLabel(w){return w==='Steel gap'?'No steel':w==='Alu gap'?'No aluminum':w==='Both'?'No alu/steel':'—';}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
dashboard();
</script>
</body></html>`;

writeFileSync('psp-dashboard-demo.html', html);
console.log('wrote psp-dashboard-demo.html (' + (html.length / 1024).toFixed(0) + ' KB)');
console.log('KPIs:', { current_book: data.kpis.current_book, grr: data.kpis.grr, nrr: data.kpis.nrr });
