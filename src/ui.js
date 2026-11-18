/* ===================== Zustand ===================== */
const LS_KEY = 'sps-werkbank-projekt-v1';
function loadLocal() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
let P = loadLocal() || exampleProject();
let prog = null; const plc = new PLC();
const ui = { sel: { k: 'block', name: 'Main' }, navOpen: false, infoOpen: false, msgs: [], monitor: true, ladSel: null, fbdSel: null, ifaceOpen: {}, dirty: true, tast: false, gotoLine: null, gotoNet: null };
let H = [];
const A = fn => { H.push(fn); return `data-a="${H.length - 1}"`; };
const B = fn => { H.push(fn); return `data-b="${H.length - 1}"`; };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
let saveT = null;
function save() { if (typeof DESK !== 'undefined' && DESK && !fileDirty) setFileDirty(true); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(P)); } catch (e) {} }, 300); }
function touch(o = {}) { ui.dirty = true; save(); if (o.nav) renderNav(); if (o.ed !== false) renderEditor(); renderTop(); }
function toast(msg, lvl = '') { const t = $('#toast'); t.textContent = msg; t.className = 'show ' + lvl; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2600); }
function curBlock() { return ui.sel.k === 'block' ? P.blocks.find(b => b.name === ui.sel.name) : null; }
function reg() { return buildReg(P); }
const LANG_L = { SCL: 'SCL', LAD: 'KOP', FBD: 'FUP' };
const TYPE_ORDER = { OB: 0, FB: 1, FC: 2, DB: 3 };

/* ===================== Ereignisse ===================== */
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && H[el.dataset.a]) { H[el.dataset.a](el, e); } });
document.addEventListener('change', e => { const el = e.target.closest('[data-b]'); if (el && H[el.dataset.b]) H[el.dataset.b](el.type === 'checkbox' ? el.checked : el.value, el); });
document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.iface) ui.ifaceOpen[d.dataset.iface] = d.open; }, true);
document.addEventListener('keydown', e => { if (e.target.matches('input[data-b]') && e.key === 'Enter') e.target.blur(); });
let tastEl = null;
document.addEventListener('pointerdown', e => { const el = e.target.closest('[data-tast]'); if (!el || !ui.tast) return; tastEl = el; writeTag(el.dataset.tast, true); });
document.addEventListener('pointerup', () => { if (tastEl) { writeTag(tastEl.dataset.tast, false); tastEl = null; } });
document.addEventListener('input', e => { const el = e.target; if (el.dataset.ana) { writeTag(el.dataset.ana, +el.value); } });

/* ===================== Aktionen ===================== */
function doCompile(quiet) {
  let res; try { res = compileProject(P); } catch (e) { console.error(e); toast('Interner Fehler: ' + e.message, 'err'); return null; }
  ui.msgs = res.msgs; if (!res.ok) ui.infoOpen = true;
  if (!quiet || !res.ok) toast(res.msgs[res.msgs.length - 1].msg, res.ok ? 'ok' : 'err');
  renderNav(); renderEditor(); renderInfo(); return res;
}
function doLoad() {
  const res = doCompile(true); if (!res) return false;
  if (!res.ok) { toast('Laden abgebrochen – Übersetzungsfehler beheben', 'err'); return false; }
  prog = res; plc.load(res, P); evalCache.clear(); ui.dirty = false; toast('In CPU geladen' + (plc.state === 'RUN' ? ' (im RUN übernommen)' : ''), 'ok'); renderTop(); renderEditor(); return true;
}
function doRun() { if ((!plc.prog || ui.dirty) && !doLoad()) return; if (plc.start()) toast('CPU im RUN', 'ok'); renderTop(); }
function doStop() { plc.stop(''); renderTop(); }
function select(k, name) { ui.sel = { k, name }; ui.navOpen = false; ui.ladSel = null; ui.fbdSel = null; renderNav(); renderEditor(); }
plc.onEvent = k => { renderTop(); if (ui.sel.k === 'diag') renderEditor(); if (k === 'state' && plc.state === 'STOP' && plc.diag[0] && plc.diag[0].lvl === 'err') { toast(plc.diag[0].msg, 'err'); } };

/* ===================== Kopfzeile ===================== */
function renderTop() {
  const st = plc.state, sync = plc.prog ? (ui.dirty ? '<span class="sync bad" title="Offline-Projekt weicht vom geladenen Programm ab">online ≠ offline</span>' : '<span class="sync ok">online = offline</span>') : '<span class="sync">nicht geladen</span>';
  $('#top').innerHTML = `
  <button class="ib navt" ${A(() => { ui.navOpen = !ui.navOpen; renderNav(); })} aria-label="Projektnavigation">☰</button>
  <div class="brand"><span class="logo"></span><span>SPS-Werkbank</span></div>
  <input class="pname" value="${esc(P.name)}" ${B(v => { P.name = v; save(); })} aria-label="Projektname">
  <div class="tb">
    <button ${A(() => doCompile())} title="Alle Bausteine übersetzen"><span class="i">⚙</span><span class="t">Übersetzen</span></button>
    <button ${A(doLoad)} title="Übersetzen und in die simulierte CPU laden"><span class="i">⇩</span><span class="t">Laden</span></button>
    <button class="run ${st === 'RUN' ? 'act' : ''}" ${A(doRun)}><span class="i">▶</span><span class="t">RUN</span></button>
    <button class="stop ${st === 'STOP' ? 'act' : ''}" ${A(doStop)}><span class="i">■</span><span class="t">STOP</span></button>
    <button class="mon ${ui.monitor ? 'act' : ''}" ${A(() => { ui.monitor = !ui.monitor; if (!ui.monitor) clearLive(); renderTop(); })} title="Beobachten ein/aus"><span class="i">◎</span><span class="t">Beobachten</span></button>
  </div>
  <div class="cpu ${st}"><span class="led"></span><b>${st}</b><span id="cyc" class="cyc"></span>${sync}</div>`;
}

/* ===================== Projektnavigation ===================== */
function renderNav() {
  const errs = new Set(ui.msgs.filter(m => m.lvl === 'err' && m.block).map(m => m.block));
  const tagErr = ui.msgs.some(m => m.lvl === 'err' && m.tags);
  const bl = [...P.blocks].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || (a.number | 0) - (b.number | 0) || a.name.localeCompare(b.name));
  const it = (k, name, html, err) => `<div class="tn item ${ui.sel.k === k && (name == null || ui.sel.name === name) ? 'sel' : ''}" ${A(() => select(k, name))}>${html}${err ? '<span class="dot"></span>' : ''}</div>`;
  $('#nav').className = ui.navOpen ? 'open' : '';
  $('#nav').innerHTML = `<div class="navh">Projektnavigation</div>
  <div class="tree">
    <div class="tn root"><span class="ico cpu-i"></span>PLC_1 <small>[${esc(P.cpu || 'CPU (Simulation)')}]</small></div>
    <div class="tn grp">Programmbausteine</div>
    <div class="tn add" ${A(addBlockDlg)}>＋ Neuen Baustein hinzufügen</div>
    ${bl.map(b => it('block', b.name, `<span class="bt ${b.type}">${b.type}</span><span class="bn">${esc(b.name)}</span><small>${b.type}${b.number ?? ''}${b.type !== 'DB' ? ' · ' + LANG_L[b.lang] : b.instanceOf ? ' · Instanz' : ''}</small>`, errs.has(b.name))).join('')}
    <div class="tn grp">PLC-Variablen</div>
    ${it('tags', null, '<span class="ico tag-i"></span>Standard-Variablentabelle <small>' + P.tags.length + '</small>', tagErr)}
    <div class="tn grp">Online</div>
    ${it('watch', null, '<span class="ico watch-i"></span>Beobachtung &amp; Simulation')}
    ${it('diag', null, '<span class="ico diag-i"></span>Online &amp; Diagnose')}
    <div class="tn grp">Austausch</div>
    ${it('src', null, '<span class="ico src-i"></span>Externe Quellen &amp; Projektdatei')}
  </div>`;
  $('#scrim').className = ui.navOpen ? 'on' : '';
}

/* ===================== Info-Fenster ===================== */
function renderInfo() {
  const e = ui.msgs.filter(m => m.lvl === 'err' && !/^Übersetzen beendet/.test(m.msg)).length, w = ui.msgs.filter(m => m.lvl === 'warn').length;
  $('#info').className = ui.infoOpen ? 'open' : '';
  $('#info').innerHTML = `<div class="infoh" ${A(() => { ui.infoOpen = !ui.infoOpen; renderInfo(); })}><b>Info</b> · Übersetzen <span class="cnt e">✖ ${e}</span><span class="cnt w">⚠ ${w}</span><span class="chev">${ui.infoOpen ? '▾' : '▴'}</span></div>
  <div class="infob">${ui.msgs.length ? ui.msgs.map(m => `<div class="msg ${m.lvl}" ${A(() => gotoMsg(m))}><span class="mi">${m.lvl === 'err' ? '✖' : m.lvl === 'warn' ? '⚠' : '✔'}</span><span class="mw">${m.block ? esc(m.block) + (m.net != null ? ' · NW ' + (m.net + 1) : m.line ? ' · Zeile ' + m.line : '') : m.tags ? 'Variablen' : ''}</span><span>${esc(m.msg)}</span></div>`).join('') : '<div class="msg">Noch nicht übersetzt.</div>'}</div>`;
}
function gotoMsg(m) {
  if (m.tags) return select('tags');
  if (!m.block) return;
  ui.gotoLine = m.line || null; ui.gotoNet = m.net ?? null; select('block', m.block);
}

/* ===================== Live-Werte ===================== */
const evalCache = new Map();
function fmtTime(ms) { if (!ms) return '0MS'; let s = '', v = Math.abs(ms); const u = [[86400000, 'D'], [3600000, 'H'], [60000, 'M'], [1000, 'S'], [1, 'MS']];
  for (const [f, n] of u) { const q = Math.floor(v / f); if (q) { s += q + n + '_'; v -= q * f; } } return (ms < 0 ? '-' : '') + s.replace(/_$/, ''); }
function fmt(v, t) { if (v === undefined || v === null) return '—'; if (t === 'Bool') return v ? 'TRUE' : 'FALSE'; if (t === 'Time') return 'T#' + fmtTime(v);
  if (t === 'Real' || t === 'LReal') return Number.isFinite(v) ? String(+v.toFixed(4)) : String(v); return String(v); }
function getEval(expr, sc) {
  const key = sc + '\u0001' + expr; let c = evalCache.get(key); if (c) return c;
  try { const cb = sc && prog ? prog.code.get(sc) : null; const scope = cb ? cb.sc : makeScope(null, prog.reg); c = compileExprString(expr, scope); }
  catch (e) { c = { err: e.msg || String(e) }; }
  evalCache.set(key, c); return c;
}
function liveTick() {
  const cyc = $('#cyc'); if (cyc) cyc.textContent = plc.state === 'RUN' ? plc.cyc.last.toFixed(2) + ' ms' : '';
  document.querySelectorAll('[data-cyc]').forEach(el => { const k = el.dataset.cyc; el.textContent = plc.cyc.n ? plc.cyc[k].toFixed(3) + ' ms' : '—'; });
  if (!ui.monitor || !plc.prog || !prog) return;
  const ctxs = {};
  document.querySelectorAll('#ed [data-ev], #ed [data-eb]').forEach(el => {
    const sc = el.dataset.sc || '', ex = el.dataset.ev ?? el.dataset.eb; const c = getEval(ex, sc);
    let v; if (!c.err) { const ctx = ctxs[sc] || (ctxs[sc] = Object.assign(plc.ctx(), { L: plc.last[sc] || {} })); try { v = c.f(ctx); } catch (e) { v = undefined; } }
    if (el.dataset.ev !== undefined) { const txt = c.err ? '—' : (el.dataset.pre || '') + fmt(v, c.t); if (el.textContent !== txt) el.textContent = txt; el.classList.toggle('t', v === true); el.classList.toggle('f', v === false); }
    else { el.classList.toggle('on', v === true); el.classList.toggle('off', v !== true); }
  });
  document.body.classList.add('live');
}
function clearLive() { document.body.classList.remove('live'); document.querySelectorAll('#ed [data-ev]').forEach(el => { el.textContent = ''; }); document.querySelectorAll('.on').forEach(el => el.classList.remove('on')); }
setInterval(liveTick, 120);
function writeTag(name, v) {
  if (!plc.prog) { toast('Erst Programm laden (⇩ Laden)', 'warn'); return; }
  const t = P.tags.find(t => t.name === name); if (!t) return; plc.G[name] = normType(t.type) === 'Bool' ? !!v : +v; liveTick();
}
function writeExpr(expr, val) {
  if (!plc.prog) { toast('Erst Programm laden (⇩ Laden)', 'warn'); return false; }
  try { const r = compileRefString(expr, makeScope(null, prog.reg)); if (r.kind !== 'bool' && r.kind !== 'num') throw new SclError('Nur elementare Operanden steuerbar');
    const v = parseInit(val, r.t, prog.reg); if (v === null) throw new SclError('Steuerwert fehlt'); r.set(plc.ctx(), v); liveTick(); return true; }
  catch (e) { toast((e.msg || e.message) + ' (' + expr + ')', 'err'); return false; }
}

/* ===================== Editor-Verteiler ===================== */
function renderEditor() {
  H = H.slice(0, 0); renderTop(); renderNav(); renderInfo();
  const ed = $('#ed'); const sc = ed.scrollTop;
  updateLists();
  const k = ui.sel.k; let html = '';
  if (k === 'tags') html = tagsView();
  else if (k === 'watch') html = watchView();
  else if (k === 'diag') html = diagView();
  else if (k === 'src') html = srcView();
  else { const b = curBlock(); if (!b) { ui.sel = { k: 'tags' }; return renderEditor(); } html = blockView(b); }
  ed.innerHTML = html; ed.scrollTop = sc;
  if (k === 'block') afterBlockRender(curBlock());
  liveTick();
}
function updateLists() {
  const r = reg(); const b = curBlock();
  $('#typelist').innerHTML = [...BASIC_TYPES, ...IEC_NAMES, ...P.blocks.filter(b => b.type === 'FB').map(b => b.name)].map(t => `<option value="${esc(t)}">`).join('');
  const ops = P.tags.map(t => `"${t.name}"`);
  if (b && b.type !== 'DB') for (const s of SECTIONS[b.type]) for (const v of (b.iface[s] || [])) { ops.push('#' + v.name);
    const ct = canonType(v.type, r); if (IEC[ct]) for (const m of Object.keys(IEC[ct].outs)) ops.push(`#${v.name}.${m}`); }
  for (const d of P.blocks.filter(x => x.type === 'DB')) { const t = d.instanceOf ? canonType(d.instanceOf, r) : null;
    const vars = t ? (IEC[t] ? Object.keys({ ...IEC[t].ins, ...IEC[t].outs }) : ifaceVars(r.blocks.get(t.toLowerCase()) || {}, ['Input', 'Output', 'InOut', 'Static']).map(v => v.name)) : ifaceVars(d, ['Static']).map(v => v.name);
    for (const v of vars) ops.push(`"${d.name}".${v}`); }
  $('#oplist').innerHTML = ops.map(o => `<option value="${esc(o)}">`).join('');
}

/* ===================== Variablentabelle ===================== */
const TAG_TYPES = ['Bool', 'Byte', 'Word', 'Int', 'UInt', 'DInt', 'Real', 'LReal', 'Time'];
function renameRefs(oldN, newN, scopeBlock) {
  if (!oldN || oldN === newN) return;
  const reQ = new RegExp('"' + oldN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'gi');
  const reL = new RegExp('#' + oldN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
  const walk = (o, local) => { for (const k of Object.keys(o)) { const v = o[k];
    if (typeof v === 'string') { if (local) o[k] = v.replace(reL, '#' + newN); else { o[k] = v.replace(reQ, '"' + newN + '"'); if ((k === 'type' || k === 'blk' || k === 'instanceOf') && v.toLowerCase() === oldN.toLowerCase()) o[k] = newN; } }
    else if (v && typeof v === 'object') walk(v, local); } };
  if (scopeBlock) { walk({ scl: scopeBlock.scl || '', _: 0 }, true); scopeBlock.scl = (scopeBlock.scl || '').replace(reL, '#' + newN); if (scopeBlock.networks) walk(scopeBlock.networks, true); }
  else { walk(P.blocks, false); walk(P.watch || [], false); }
}
function tagsView() {
  const rows = P.tags.map((t, i) => `<tr>
    <td><input value="${esc(t.name)}" ${B(v => { const o = t.name; t.name = v.trim(); renameRefs(o, t.name); touch(); })}></td>
    <td><select ${B(v => { t.type = v; touch(); })}>${TAG_TYPES.map(x => `<option ${normType(t.type) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
    <td><input class="mono" value="${esc(t.addr)}" ${B(v => { t.addr = v.trim().toUpperCase(); touch(); })} placeholder="%I0.0"></td>
    <td><input class="mono" value="${esc(t.init)}" ${B(v => { t.init = v.trim(); touch(); })}></td>
    <td class="live mono" data-ev="&quot;${esc(t.name)}&quot;"></td>
    <td><input value="${esc(t.comment)}" ${B(v => { t.comment = v; save(); })}></td>
    <td><button class="x" ${A(() => { P.tags.splice(i, 1); touch(); })} title="Löschen">✕</button></td></tr>`).join('');
  return `<div class="edh"><div><h2>Standard-Variablentabelle</h2><div class="sub">${P.tags.length} PLC-Variablen · Eingänge %I, Ausgänge %Q, Merker %M</div></div>
    <div class="acts"><button class="pri" ${A(() => { P.tags.push({ name: uniqName('Tag_', P.tags.map(t => t.name)), type: 'Bool', addr: nextAddr('M'), comment: '', init: '' }); touch(); })}>＋ Variable</button></div></div>
  <div class="tw"><table class="grid"><thead><tr><th>Name</th><th>Datentyp</th><th>Adresse</th><th>Startwert</th><th class="live">Beobachtungswert</th><th>Kommentar</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function uniqName(base, list) { const s = new Set(list.map(x => x.toLowerCase())); let i = 1; while (s.has((base + i).toLowerCase())) i++; return base + i; }
function nextAddr(area) { const used = new Set(P.tags.map(t => (t.addr || '').toUpperCase())); for (let b = 0; b < 100; b++) for (let i = 0; i < 8; i++) { const a = `%${area}${b}.${i}`; if (!used.has(a)) return a; } return ''; }

/* ===================== Bausteine ===================== */
const SEC_L = { Input: 'Input', Output: 'Output', InOut: 'InOut', Static: 'Static', Temp: 'Temp' };
function blockView(b) {
  const r = reg(); const lo = b.name.toLowerCase();
  const head = `<div class="edh"><div><h2><span class="bt ${b.type}">${b.type}</span> ${esc(b.name)} <small>[${b.type}${b.number ?? ''}]</small></h2>
    <div class="sub">${b.type === 'DB' ? (b.instanceOf ? 'Instanz-DB von „' + esc(b.instanceOf) + '“' : 'Global-DB') : (b.type === 'OB' ? ((b.number | 0) === 100 ? 'Anlauf (Startup)' : 'Programmzyklus') : b.type === 'FB' ? 'Funktionsbaustein mit Gedächtnis (Instanz)' : 'Funktion ohne Gedächtnis') + ' · Sprache ' + LANG_L[b.lang]}</div></div>
    <div class="acts">${b.lang && b.lang !== 'SCL' ? `<button ${A(() => showGenScl(b))}>SCL anzeigen</button>` : ''}<button ${A(() => propsDlg(b))}>Eigenschaften</button><button class="danger" ${A(() => delBlockDlg(b))}>Löschen</button></div></div>`;
  if (b.type === 'DB') {
    if (b.instanceOf) { const t = canonType(b.instanceOf, r); const vars = IEC[t] ? Object.entries({ ...IEC[t].ins, ...IEC[t].outs }).map(([n, ty]) => ({ name: n, type: ty, sec: n in IEC[t].ins ? 'Input' : 'Output' })) : ifaceVars(r.blocks.get(t.toLowerCase()) || {}, ['Input', 'Output', 'InOut', 'Static']).map(v => ({ ...v, sec: '' }));
      return head + `<p class="hint">Die Struktur eines Instanz-DB wird von „${esc(t)}“ vorgegeben. Werte hier beobachten, steuern in der Beobachtungstabelle.</p>
      <div class="tw"><table class="grid"><thead><tr><th>Name</th><th>Datentyp</th><th class="live">Beobachtungswert</th></tr></thead><tbody>${vars.map(v => { const ct = canonType(v.type, r);
        const ex = typeKind(ct, r) === 'iec' ? `"${b.name}".${v.name}.Q` : `"${b.name}".${v.name}`; return `<tr><td class="mono">${esc(v.name)}</td><td class="mono">${esc(v.type)}</td><td class="live mono" data-ev="${esc(ex)}" ${typeKind(ct, r) === 'iec' ? 'data-pre="Q="' : ''}></td></tr>`; }).join('')}</tbody></table></div>`; }
    return head + ifaceHtml(b, true);
  }
  let body = '';
  if (b.lang === 'SCL') body = sclHtml(b);
  else if (b.lang === 'LAD') body = ladHtml(b);
  else body = fbdHtml(b);
  return head + ifaceHtml(b) + body;
}
function ifaceHtml(b, isDb) {
  const lo = b.name.toLowerCase(), r = reg(); const open = ui.ifaceOpen[b.name] ?? (isDb || allVarNames(b).length <= 6);
  const secs = SECTIONS[b.type];
  const rows = secs.map(s => { b.iface[s] = b.iface[s] || []; return `<tr class="sec"><td colspan="6"><span>${SEC_L[s]}</span><button class="mini" ${A(() => { b.iface[s].push({ name: uniqName(s === 'Static' ? 'stat' : s === 'Temp' ? 'temp' : s.toLowerCase(), allVarNames(b)), type: 'Bool', init: '', comment: '' }); ui.ifaceOpen[b.name] = true; touch(); })}>＋ Zeile</button></td></tr>` +
    b.iface[s].map((v, i) => { const ct = canonType(v.type, r); const iec = !!IEC[ct]; const ex = isDb ? `"${b.name}".${v.name}${iec ? '.Q' : ''}` : `#${v.name}${iec ? '.Q' : ''}`;
      return `<tr><td><input class="mono" value="${esc(v.name)}" ${B(x => { const o = v.name; v.name = x.trim(); if (!isDb) renameRefs(o, v.name, b); touch(); })}></td>
      <td><input class="mono" list="typelist" value="${esc(v.type)}" ${B(x => { v.type = x.trim(); touch(); })}></td>
      <td><input class="mono" value="${esc(v.init)}" ${B(x => { v.init = x.trim(); touch(); })} ${iec || typeKind(ct, r) === 'fb' ? 'disabled' : ''}></td>
      <td class="live mono" data-ev="${esc(ex)}" ${isDb ? '' : `data-sc="${esc(lo)}"`} ${iec ? 'data-pre="Q="' : ''}></td>
      <td><input value="${esc(v.comment)}" ${B(x => { v.comment = x; save(); })}></td>
      <td><button class="x" ${A(() => { b.iface[s].splice(i, 1); touch(); })}>✕</button></td></tr>`; }).join(''); }).join('');
  return `<details class="iface" data-iface="${esc(b.name)}" ${open ? 'open' : ''}><summary>Schnittstelle</summary>
  <div class="tw"><table class="grid"><thead><tr><th>Name</th><th>Datentyp</th><th>Startwert</th><th class="live">Beobachtungswert</th><th>Kommentar</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
function allVarNames(b) { const o = []; for (const s of SECTIONS[b.type]) for (const v of b.iface[s] || []) o.push(v.name); return o; }
function quickFix(m, b) {
  let x = /Lokale Variable „#(\w+)“ ist nicht deklariert/.exec(m.msg);
  if (x && b) return ` <button class="mini qf" ${A(() => declDlg(b, x[1]))}>Deklarieren…</button>`;
  x = /PLC-Variable „"(\w+)"“ ist nicht definiert/.exec(m.msg) || /Bezeichner „(\w+)“ ist unbekannt/.exec(m.msg);
  if (x && x[1].toUpperCase() !== 'FALSE') return ` <button class="mini qf" ${A(() => { P.tags.push({ name: x[1], type: 'Bool', addr: nextAddr('M'), comment: '', init: '' }); touch(); doCompile(true); toast('PLC-Variable „' + x[1] + '“ angelegt (Bool, ' + P.tags[P.tags.length - 1].addr + ')', 'ok'); })}>Als PLC-Variable anlegen</button>`;
  return '';
}
function declDlg(b, name) {
  const secs = SECTIONS[b.type];
  modal(`<h3>„#${esc(name)}“ deklarieren</h3><label class="fl">Bereich<select id="dSec">${secs.map(s => `<option ${s === (b.type === 'FB' ? 'Static' : 'Temp') ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fl">Datentyp<input id="dType" class="mono" list="typelist" value="Bool"></label>`,
    [['Abbrechen', closeModal], ['OK', () => { const sec = $('#dSec').value; (b.iface[sec] = b.iface[sec] || []).push({ name, type: $('#dType').value.trim() || 'Bool', init: '', comment: '' }); closeModal(); ui.ifaceOpen[b.name] = true; touch(); doCompile(true); }, 'pri']]);
}
function blockErrors(b) { return ui.msgs.filter(m => m.block === b.name && (m.lvl === 'err' || m.lvl === 'warn')); }

/* ---------- SCL-Editor ---------- */
const KW = new Set('IF THEN ELSIF ELSE END_IF CASE OF END_CASE FOR TO BY DO END_FOR WHILE END_WHILE REPEAT UNTIL END_REPEAT EXIT CONTINUE RETURN AND OR XOR NOT MOD REGION END_REGION'.split(' '));
const KW2 = new Set(['TRUE', 'FALSE', ...Object.keys(BUILTIN), ...IEC_NAMES]);
function hl(code) {
  const re = /(\/\/[^\n]*|\(\*[\s\S]*?\*\)|\/\*[\s\S]*?\*\/)|("[^"\n]*")|('[^'\n]*')|(#[A-Za-z_]\w*)|\b((?:T|TIME)#[-\w.]+|\d+#[\w]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) { out += esc(code.slice(last, m.index)); last = re.lastIndex; const t = m[0];
    if (m[1]) out += `<i class="c">${esc(t)}</i>`; else if (m[2]) out += `<i class="g">${esc(t)}</i>`; else if (m[3]) out += `<i class="s">${esc(t)}</i>`;
    else if (m[4]) out += `<i class="l">${esc(t)}</i>`; else if (m[5]) out += `<i class="n">${esc(t)}</i>`;
    else { const u = t.toUpperCase(); out += KW.has(u) ? `<i class="k">${t}</i>` : KW2.has(u) || /_TO_/.test(u) ? `<i class="f">${t}</i>` : esc(t); } }
  return out + esc(code.slice(last)) + '\n';
}
const SNIP = [['IF', 'IF  THEN\n   \nEND_IF;'], ['ELSIF', 'ELSIF  THEN\n   '], ['CASE', 'CASE  OF\n   1:\n      ;\n   ELSE\n      ;\nEND_CASE;'], ['FOR', 'FOR #i := 1 TO 10 DO\n   \nEND_FOR;'], ['WHILE', 'WHILE  DO\n   \nEND_WHILE;'], [':=', ' := '], [';', ';'], ['""', '""'], ['#', '#'], ['TON', '#Timer(IN := , PT := T#5s);'], ['AND', ' AND '], ['OR', ' OR '], ['NOT', 'NOT '], ['//', '// ']];
function sclHtml(b) {
  const errs = blockErrors(b).filter(m => m.line);
  return `<div class="sclt">${SNIP.map(([l, s]) => `<button class="snip" ${A(() => insertSnip(s))}>${esc(l)}</button>`).join('')}</div>
  <div class="scl" id="sclbox"><div class="gut" id="gut"></div><div class="code"><div class="errlay">${errs.map(m => `<div class="el ${m.lvl}" style="top:calc(${m.line - 1} * var(--lh) + 8px)" title="${esc(m.msg)}"></div>`).join('')}</div><pre id="hl"></pre><textarea id="ta" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="SCL-Code"></textarea></div></div>
  ${errs.length ? `<div class="errlist">${errs.map(m => `<div class="msg ${m.lvl}" ${A(() => gotoLine(m.line))}><span class="mi">${m.lvl === 'err' ? '✖' : '⚠'}</span><span class="mw">Zeile ${m.line}</span><span>${esc(m.msg)}${quickFix(m, b)}</span></div>`).join('')}</div>` : ''}`;
}
function gutter(code, b) { const n = code.split('\n').length; const el = new Set(blockErrors(b).filter(m => m.line).map(m => m.line)); let s = ''; for (let i = 1; i <= n; i++) s += `<div class="${el.has(i) ? 'e' : ''}">${i}</div>`; return s; }
function afterBlockRender(b) {
  if (!b) return;
  if (b.lang === 'SCL' && b.type !== 'DB') {
    const ta = $('#ta'), pre = $('#hl'), gut = $('#gut'); ta.value = b.scl || '';
    const upd = () => { pre.innerHTML = hl(ta.value); gut.innerHTML = gutter(ta.value, b); };
    upd();
    ta.addEventListener('input', () => { b.scl = ta.value; upd(); ui.dirty = true; save(); renderTop(); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('   ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      else if (e.key === 'Enter') { const s = ta.selectionStart; const ls = ta.value.lastIndexOf('\n', s - 1) + 1; const line = ta.value.slice(ls, s); let ind = line.match(/^\s*/)[0];
        if (/\b(THEN|DO|ELSE|OF|REPEAT)\s*$/i.test(line) || /^\s*\d+(\.\.\d+)?\s*:\s*$/.test(line)) ind += '   ';
        e.preventDefault(); ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
    if (ui.gotoLine) { const l = ui.gotoLine; ui.gotoLine = null; setTimeout(() => gotoLine(l), 30); }
  }
  if (ui.gotoNet != null) { const n = ui.gotoNet; ui.gotoNet = null; setTimeout(() => { const el = document.getElementById('net-' + n); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); } }, 30); }
}
function gotoLine(l) { const ta = $('#ta'); if (!ta) return; const lines = ta.value.split('\n'); let p = 0; for (let i = 0; i < l - 1 && i < lines.length; i++) p += lines[i].length + 1;
  ta.focus({ preventScroll: true }); ta.setSelectionRange(p, p + (lines[l - 1] || '').length);
  const box = $('#sclbox'); const lh = parseFloat(getComputedStyle(box).lineHeight) || 20; box.scrollTop = Math.max(0, (l - 4) * lh); }
function insertSnip(s) { const ta = $('#ta'); if (!ta) return; ta.focus(); const st = ta.selectionStart; ta.setRangeText(s, st, ta.selectionEnd, 'end');
  const ip = s.search(/ {2}THEN| {2}OF| {2}DO|""|:= ,/); if (ip >= 0) { const off = s.startsWith('""') ? 1 : s.indexOf(':= ,') >= 0 ? s.indexOf(':= ,') + 3 : ip + 1; ta.setSelectionRange(st + off, st + off); }
  ta.dispatchEvent(new Event('input')); }
function showGenScl(b) { const g = blockScl(b, reg()); modal(`<h3>${esc(b.name)} – erzeugter SCL-Code</h3><p class="hint">So wird der ${LANG_L[b.lang]}-Baustein übersetzt und ausgeführt.</p><pre class="srcpre">${hl(g.text)}</pre>`, [['Schließen', closeModal]]); }

/* ---------- KOP (LAD) ---------- */
const FIELDS = {
  NO: [['op', 'Operand']], NC: [['op', 'Operand']], P: [['op', 'Operand'], ['mem', 'Flankenmerker']], N: [['op', 'Operand'], ['mem', 'Flankenmerker']],
  CMP: [['a', 'IN1'], ['cmp', 'Vergleich'], ['b', 'IN2']], COIL: [['op', 'Operand']], NCOIL: [['op', 'Operand']], SET: [['op', 'Operand']], RST: [['op', 'Operand']],
  TON: [['inst', 'Instanz'], ['pt', 'PT (Zeit)'], ['q', 'Q →'], ['et', 'ET →']], TOF: [['inst', 'Instanz'], ['pt', 'PT (Zeit)'], ['q', 'Q →'], ['et', 'ET →']], TP: [['inst', 'Instanz'], ['pt', 'PT (Zeit)'], ['q', 'Q →'], ['et', 'ET →']],
  CTU: [['inst', 'Instanz'], ['r', 'R (Reset)'], ['pv', 'PV'], ['q', 'Q →'], ['cv', 'CV →']], CTD: [['inst', 'Instanz'], ['ld', 'LD (Laden)'], ['pv', 'PV'], ['q', 'Q →'], ['cv', 'CV →']],
  MOVE: [['in', 'IN'], ['out', 'OUT1 →']], ADD: [['in1', 'IN1'], ['in2', 'IN2'], ['out', 'OUT →']], SUB: [['in1', 'IN1'], ['in2', 'IN2'], ['out', 'OUT →']], MUL: [['in1', 'IN1'], ['in2', 'IN2'], ['out', 'OUT →']], DIV: [['in1', 'IN1'], ['in2', 'IN2'], ['out', 'OUT →']],
};
const BOX_PIN = { TON: ['IN', 'Q'], TOF: ['IN', 'Q'], TP: ['IN', 'Q'], CTU: ['CU', 'Q'], CTD: ['CD', 'Q'], MOVE: ['EN', 'ENO'], ADD: ['EN', 'ENO'], SUB: ['EN', 'ENO'], MUL: ['EN', 'ENO'], DIV: ['EN', 'ENO'], CALL: ['EN', 'ENO'] };
const IEC_OF = { TON: 'TON_TIME', TOF: 'TOF_TIME', TP: 'TP_TIME', CTU: 'CTU_INT', CTD: 'CTD_INT' };
const LAD_TOOLS = [
  ['Kontakte', [['NO', '┤ ├', 'Schließer'], ['NC', '┤/├', 'Öffner'], ['P', '┤P├', 'Positive Flanke'], ['N', '┤N├', 'Negative Flanke'], ['CMP', '┤==├', 'Vergleicher']]],
  ['Spulen', [['COIL', '( )', 'Zuweisung'], ['NCOIL', '(/)', 'Negierte Zuweisung'], ['SET', '(S)', 'Setzen'], ['RST', '(R)', 'Rücksetzen']]],
  ['Boxen', [['TON', 'TON', 'Einschaltverzögerung'], ['TOF', 'TOF', 'Ausschaltverzögerung'], ['TP', 'TP', 'Impuls'], ['CTU', 'CTU', 'Vorwärtszähler'], ['CTD', 'CTD', 'Rückwärtszähler'], ['MOVE', 'MOVE', 'Wert kopieren'], ['ADD', 'ADD', 'Addieren'], ['SUB', 'SUB', 'Subtrahieren'], ['MUL', 'MUL', 'Multiplizieren'], ['DIV', 'DIV', 'Dividieren'], ['CALL', 'FB/FC', 'Baustein aufrufen']]],
  ['Verbinden', [['W', '───', 'Leitung'], ['LL', '┬ links', 'Abzweig links öffnen/schließen'], ['LR', '┬ rechts', 'Abzweig rechts öffnen/schließen'], ['DEL', '✕', 'Element löschen']]],
];
const W = 140, X0 = 14;
function boxLines(el) { if (el.t === 'CALL') { const b = reg().blocks.get(String(el.blk || '').replace(/"/g, '').toLowerCase()); return b ? ifaceVars(b, ['Input', 'InOut', 'Output']).length : 0; } return (FIELDS[el.t] || []).filter(f => f[0] !== 'inst').length; }
function isBox(t) { return !!BOX_PIN[t]; }
function rowLayout(net) { const Y = [], RH = []; let y = 4; for (let r = 0; r < net.rows; r++) { let h = 74; for (let c = 0; c < net.cols; c++) { const el = net.cells[r + ',' + c]; if (el && isBox(el.t)) h = Math.max(h, 40 + 18 + boxLines(el) * 13 + 14); } Y.push(y); RH.push(h); y += h; } return { Y, RH, H: y + 4 }; }
function ladSvg(b, net, ni, d) {
  const { Y, RH, H: HH } = rowLayout(net), Wd = X0 + net.cols * W + 12, sc = esc(b.name.toLowerCase());
  const ex = s => `data-eb="${esc(s ?? 'FALSE')}" data-sc="${sc}"`;
  let g = `<line x1="${X0}" y1="0" x2="${X0}" y2="${HH}" class="rail on"/>`, hits = '', sel = '';
  for (let r = 0; r < net.rows; r++) for (let c = 0; c < net.cols; c++) {
    const x = X0 + c * W, y = Y[r], wy = y + 40, cx = x + W / 2, key = r + ',' + c, el = net.cells[key];
    const isSel = ui.ladSel && ui.ladSel.b === b.name && ui.ladSel.ni === ni && ui.ladSel.r === r && ui.ladSel.c === c;
    if (isSel) sel += `<rect x="${x + 2}" y="${y + 2}" width="${W - 4}" height="${RH[r] - 4}" rx="6" class="selr"/>`;
    hits += `<rect x="${x}" y="${y}" width="${W}" height="${RH[r]}" class="hit" ${A(() => { ui.ladSel = { b: b.name, ni, r, c }; renderEditor(); })}/>`;
    if (!el) { g += `<line x1="${x + 8}" y1="${wy}" x2="${x + W - 8}" y2="${wy}" class="ph"/>`; continue; }
    const IN = ex(d.dIn[key]), OUT = ex(d.dOut[key]);
    const txt = (s, yy, cls = 'opd') => `<text x="${cx}" y="${yy}" text-anchor="middle" class="${cls}">${esc(trunc(s, 18))}</text>`;
    const seg = (x1, x2, a) => `<line x1="${x1}" y1="${wy}" x2="${x2}" y2="${wy}" class="w" ${a}/>`;
    switch (el.t) {
      case 'W': g += seg(x, x + W, OUT); break;
      case 'NO': case 'NC': case 'P': case 'N': case 'CMP': {
        const hw = el.t === 'CMP' ? 16 : 9;
        g += seg(x, cx - hw, IN) + seg(cx + hw, x + W, OUT) + `<g class="sym" ${OUT}><line x1="${cx - hw}" y1="${wy - 12}" x2="${cx - hw}" y2="${wy + 12}"/><line x1="${cx + hw}" y1="${wy - 12}" x2="${cx + hw}" y2="${wy + 12}"/>${el.t === 'NC' ? `<line x1="${cx - 6}" y1="${wy + 10}" x2="${cx + 6}" y2="${wy - 10}"/>` : ''}</g>`;
        if (el.t === 'P' || el.t === 'N') g += `<text x="${cx}" y="${wy + 4}" text-anchor="middle" class="sl">${el.t}</text>` + txt(el.mem || '???', wy + 28, 'opd s');
        if (el.t === 'CMP') g += `<text x="${cx}" y="${wy + 4}" text-anchor="middle" class="sl">${esc(el.cmp || '==')}</text>` + txt(el.b || '???', wy + 28);
        g += txt(el.t === 'CMP' ? (el.a || '???') : (el.op || '???'), wy - 18); break; }
      case 'COIL': case 'NCOIL': case 'SET': case 'RST': {
        g += seg(x, cx - 11, IN) + seg(cx + 11, x + W, IN) + `<g class="sym" ${IN}><path d="M${cx - 6} ${wy - 12} Q${cx - 13} ${wy} ${cx - 6} ${wy + 12}"/><path d="M${cx + 6} ${wy - 12} Q${cx + 13} ${wy} ${cx + 6} ${wy + 12}"/></g>`;
        const l = { NCOIL: '/', SET: 'S', RST: 'R' }[el.t]; if (l) g += `<text x="${cx}" y="${wy + 4}" text-anchor="middle" class="sl">${l}</text>`;
        g += txt(el.op || '???', wy - 18); break; }
      default: {
        const lines = el.t === 'CALL' ? (() => { const bb = reg().blocks.get(String(el.blk || '').replace(/"/g, '').toLowerCase()); return bb ? ifaceVars(bb, ['Input', 'InOut', 'Output']).map(v => [v.name, (el.params || {})[v.name] || '']) : []; })() : (FIELDS[el.t] || []).filter(f => f[0] !== 'inst').map(f => [f[1].replace(/ \(.*\)/, ''), el[f[0]] || '']);
        const bx = x + 12, bw = W - 24, top = y + 26, bot = wy + 18 + lines.length * 13; const [pi, po] = BOX_PIN[el.t] || ['EN', 'ENO'];
        g += seg(x, bx, IN) + seg(bx + bw, x + W, OUT) + `<rect x="${bx}" y="${top}" width="${bw}" height="${bot - top}" rx="3" class="box" ${OUT}/>`;
        const title = el.t === 'CALL' ? (String(el.blk || 'FB/FC ?').replace(/"/g, '')) : el.t;
        g += `<text x="${bx + bw / 2}" y="${top + 11}" text-anchor="middle" class="bt2">${esc(trunc(title, 16))}</text>`;
        g += `<text x="${bx + 3}" y="${wy + 4}" class="pin">${pi}</text><text x="${bx + bw - 3}" y="${wy + 4}" text-anchor="end" class="pin">${po}</text>`;
        lines.forEach(([k, v], i) => { g += `<text x="${bx + 3}" y="${wy + 20 + i * 13}" class="prm"><tspan class="pk">${esc(trunc(k, 8))}</tspan> ${esc(trunc(v, 19 - Math.min(k.length, 8)))}</text>`; });
        if (el.inst) g += `<text x="${bx + bw / 2}" y="${y + 18}" text-anchor="middle" class="opd s">${esc(trunc(el.inst, 20))}</text>`;
      }
    }
  }
  for (const k of Object.keys(net.links)) { if (!net.links[k]) continue; const [r, bb] = k.split(',').map(Number); if (r + 1 >= net.rows) continue;
    const x = X0 + bb * W; g += `<line x1="${x}" y1="${Y[r] + 40}" x2="${x}" y2="${Y[r + 1] + 40}" class="w lk" ${ex(d.dLink[k])}/>`; }
  return `<svg class="lad" width="${Wd}" height="${HH}" viewBox="0 0 ${Wd} ${HH}">${sel}${g}${hits}</svg>`;
}
function netHead(b, ni, net, extra = '') {
  const nets = b.networks; const errs = blockErrors(b).filter(m => m.net === ni);
  return `<div class="neth"><b>Netzwerk ${ni + 1}:</b><input class="ntitle" value="${esc(net.title)}" placeholder="Titel" ${B(v => { net.title = v; save(); })}>${extra}
    <span class="nacts"><button class="mini" ${A(() => { if (ni > 0) { [nets[ni - 1], nets[ni]] = [nets[ni], nets[ni - 1]]; touch(); } })} title="Nach oben">↑</button><button class="mini" ${A(() => { if (ni < nets.length - 1) { [nets[ni + 1], nets[ni]] = [nets[ni], nets[ni + 1]]; touch(); } })} title="Nach unten">↓</button><button class="mini" ${A(() => { nets.splice(ni + 1, 0, JSON.parse(JSON.stringify(net))); touch(); })} title="Duplizieren">⧉</button><button class="mini x" ${A(() => { nets.splice(ni, 1); ui.ladSel = null; ui.fbdSel = null; touch(); })} title="Netzwerk löschen">✕</button></span></div>
    <input class="ncom" value="${esc(net.comment)}" placeholder="Kommentar" ${B(v => { net.comment = v; save(); })}>
    ${errs.length ? `<div class="nerr">${errs.map(m => `<div class="${m.lvl}">${m.lvl === 'err' ? '✖' : '⚠'} ${esc(m.msg)}${quickFix(m, b)}</div>`).join('')}</div>` : ''}`;
}
function ladHtml(b) {
  const r = reg(); let g; try { g = blockScl(b, r); } catch (e) { g = { disp: [] }; }
  const tools = `<div class="tools">${LAD_TOOLS.map(([grp, its]) => `<div class="tg"><span>${grp}</span>${its.map(([t, l, title]) => `<button class="tl" title="${title}" ${A(() => ladPlace(b, t))}>${esc(l)}</button>`).join('')}</div>`).join('')}</div>`;
  const nets = b.networks.map((net, ni) => {
    const errs = blockErrors(b).some(m => m.net === ni && m.lvl === 'err');
    const sel = ui.ladSel && ui.ladSel.b === b.name && ui.ladSel.ni === ni ? ui.ladSel : null;
    return `<div class="net ${errs ? 'bad' : ''}" id="net-${ni}">${netHead(b, ni, net)}
      <div class="ladw">${ladSvg(b, net, ni, g.disp[ni] || { dIn: {}, dOut: {}, dLink: {} })}</div>
      <div class="nsize"><span>Zeilen ${net.rows}</span><button class="mini" ${A(() => { net.rows++; touch(); })}>＋</button><button class="mini" ${A(() => { if (net.rows > 1) { net.rows--; trimNet(net); touch(); } })}>−</button>
      <span>Spalten ${net.cols}</span><button class="mini" ${A(() => { net.cols++; touch(); })}>＋</button><button class="mini" ${A(() => { if (net.cols > 1) { net.cols--; trimNet(net); touch(); } })}>−</button></div>
      ${sel ? cellProps(b, net, sel) : ''}</div>`; }).join('');
  return `${tools}<div class="hint small">Zelle antippen, dann Element aus der Leiste wählen. Abzweige verbinden die Zeile mit der darunterliegenden.</div>${nets}<button class="addnet" ${A(() => { b.networks.push({ title: '', comment: '', rows: 1, cols: 6, cells: {}, links: {} }); touch(); })}>＋ Netzwerk hinzufügen</button>`;
}
function trimNet(net) { for (const k of Object.keys(net.cells)) { const [r, c] = k.split(',').map(Number); if (r >= net.rows || c >= net.cols) delete net.cells[k]; }
  for (const k of Object.keys(net.links)) { const [r, c] = k.split(',').map(Number); if (r >= net.rows - 1 || c > net.cols) delete net.links[k]; } }
function autoInstance(b, iecOrFb) {
  const isFb = !IEC[iecOrFb]; const base = isFb ? iecOrFb : (iecOrFb.startsWith('CT') ? 'IEC_Counter' : 'IEC_Timer');
  if (b.type === 'FB') { const n = uniqName((isFb ? iecOrFb + '_Instance' : base) + '_', allVarNames(b)); b.iface.Static = b.iface.Static || []; b.iface.Static.push({ name: n, type: iecOrFb, init: '', comment: 'Multiinstanz' }); return '#' + n; }
  const names = [...P.blocks.map(x => x.name), ...P.tags.map(t => t.name)]; let n = isFb ? iecOrFb + '_DB' : base + '_0_DB';
  if (names.some(x => x.toLowerCase() === n.toLowerCase())) { let i = 1; const stem = isFb ? iecOrFb + '_DB_' : base + '_'; while (names.some(x => x.toLowerCase() === (isFb ? stem + i : stem + i + '_DB').toLowerCase())) i++; n = isFb ? stem + i : stem + i + '_DB'; }
  P.blocks.push({ name: n, type: 'DB', number: nextNum('DB'), instanceOf: iecOrFb }); return '"' + n + '"';
}
function nextNum(type, start = 1) { const used = new Set(P.blocks.filter(b => b.type === type).map(b => b.number | 0)); let n = start; while (used.has(n)) n++; return n; }
function ladPlace(b, t) {
  const s = ui.ladSel; if (!s || s.b !== b.name) { toast('Zuerst eine Zelle im Netzwerk antippen', 'warn'); return; }
  const net = b.networks[s.ni], key = s.r + ',' + s.c;
  if (t === 'DEL') { delete net.cells[key]; return touch(); }
  if (t === 'LL' || t === 'LR') { const bnd = t === 'LL' ? s.c : s.c + 1; if (bnd === 0) { toast('Links ist die Stromschiene – Abzweig rechts verwenden', 'warn'); return; }
    if (s.r + 1 >= net.rows) net.rows++; const lk = s.r + ',' + bnd; if (net.links[lk]) delete net.links[lk]; else net.links[lk] = true; return touch(); }
  const old = net.cells[key]; const el = { t };
  if (old && ['NO', 'NC', 'COIL', 'NCOIL', 'SET', 'RST', 'P', 'N'].includes(old.t) && ['NO', 'NC', 'COIL', 'NCOIL', 'SET', 'RST', 'P', 'N'].includes(t)) { el.op = old.op; el.mem = old.mem; }
  if (IEC_OF[t]) { el.inst = autoInstance(b, IEC_OF[t]); if (t.startsWith('T')) el.pt = 'T#5s'; else el.pv = '10'; }
  if (t === 'CMP') { el.cmp = '=='; }
  if (t === 'CALL') { el.blk = ''; el.params = {}; }
  if (t === 'P' || t === 'N') el.mem = '';
  net.cells[key] = el;
  let c = s.c - 1; while (c >= 0 && !net.cells[s.r + ',' + c] && !net.links[s.r + ',' + (c + 1)] && !(s.r > 0 && net.links[(s.r - 1) + ',' + (c + 1)])) c--;
  const leftEnd = c; if (leftEnd >= 0 || s.r === 0) for (let k = leftEnd + 1; k < s.c; k++) net.cells[s.r + ',' + k] = { t: 'W' };
  touch(); setTimeout(() => { const f = document.querySelector('.props input:not([disabled])'); if (f && !['W'].includes(t) && window.innerWidth > 820) f.focus(); }, 20);
}
function fieldInput(el, k, label, b) {
  if (k === 'cmp') return `<label>${label}<select ${B(v => { el.cmp = v; touch(); })}>${Object.keys(CMP_SCL).map(o => `<option ${el.cmp === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  return `<label>${label}<input class="mono" list="oplist" value="${esc(el[k])}" ${B(v => { el[k] = v.trim(); touch(); })} placeholder="${k === 'pt' ? 'T#5s' : k === 'pv' ? '10' : '"Operand"'}"></label>`;
}
function instHelper(b, el, type) {
  const v = String(el.inst || '').trim(); if (!v) return ''; const r = reg();
  const exists = v.startsWith('#') ? allVarNames(b).some(n => n.toLowerCase() === v.slice(1).toLowerCase()) : r.blocks.has(v.replace(/"/g, '').toLowerCase());
  if (exists) return '';
  return `<button class="mini" ${A(() => { if (v.startsWith('#')) { if (b.type !== 'FB') { toast('Multiinstanzen (#…) nur in FBs möglich', 'warn'); return; } (b.iface.Static = b.iface.Static || []).push({ name: v.slice(1), type, init: '', comment: '' }); } else P.blocks.push({ name: v.replace(/"/g, ''), type: 'DB', number: nextNum('DB'), instanceOf: type }); touch({ nav: true }); })}>Instanz „${esc(v)}“ anlegen</button>`;
}
function elFields(b, el) {
  if (el.t === 'W') return '<div class="hint small">Leitung – verbindet links und rechts.</div>';
  if (el.t === 'CALL') {
    const r = reg(); const callables = P.blocks.filter(x => x.type === 'FB' || x.type === 'FC'); const bb = r.blocks.get(String(el.blk || '').replace(/"/g, '').toLowerCase());
    return `<label>Baustein<select ${B(v => { el.blk = v; el.params = {}; const nb = reg().blocks.get(v.toLowerCase()); if (nb && nb.type === 'FB') el.inst = autoInstance(b, nb.name); else delete el.inst; touch({ nav: true }); })}><option value="">– wählen –</option>${callables.map(x => `<option ${x.name === bb?.name ? 'selected' : ''} value="${esc(x.name)}">${x.type} ${esc(x.name)}</option>`).join('')}</select></label>
      ${bb && bb.type === 'FB' ? fieldInput(el, 'inst', 'Instanz', b) + instHelper(b, el, bb.name) : ''}
      ${bb ? ['Input', 'InOut', 'Output'].map(s => (bb.iface[s] || []).map(v => `<label>${esc(v.name)} <small>${s === 'Output' ? '→ ' : ''}${esc(v.type)}</small><input class="mono" list="oplist" value="${esc((el.params || {})[v.name])}" ${B(x => { el.params = el.params || {}; el.params[v.name] = x.trim(); touch(); })}></label>`).join('')).join('') : ''}`;
  }
  return (FIELDS[el.t] || []).map(([k, l]) => fieldInput(el, k, l, b) + (k === 'inst' ? instHelper(b, el, IEC_OF[el.t]) : '')).join('');
}
function cellProps(b, net, s) {
  const el = net.cells[s.r + ',' + s.c];
  return `<div class="props"><div class="ph2">Zeile ${s.r + 1}, Spalte ${s.c + 1}${el ? ' · ' + (elLabel(el.t) === el.t ? (LAD_TOOLS.flatMap(g => g[1]).find(x => x[0] === el.t) || [, , el.t])[2] : elLabel(el.t)) : ''}</div>
    ${el ? `<div class="pf">${elFields(b, el)}</div>` : '<div class="hint small">Leere Zelle – Element aus der Werkzeugleiste wählen.</div>'}</div>`;
}

/* ---------- FUP (FBD) ---------- */
const ROOT_T = [['ASSIGN', '= Zuweisung'], ['NCOIL', '/= Neg. Zuweisung'], ['SET', 'S Setzen'], ['RST', 'R Rücksetzen'], ['TON', 'TON'], ['TOF', 'TOF'], ['TP', 'TP'], ['CTU', 'CTU'], ['CTD', 'CTD'], ['MOVE', 'MOVE'], ['ADD', 'ADD'], ['SUB', 'SUB'], ['MUL', 'MUL'], ['DIV', 'DIV'], ['CALL', 'FB/FC-Aufruf']];
const GSYM = { AND: '&amp;', OR: '&gt;=1', XOR: 'X' };
function fbdInput(net, path) { let inp = net.root.in; for (const k of path) inp = inp.n.ins[k]; return inp; }
function fbdHtml(b) {
  const r = reg(); let g; try { g = blockScl(b, r); } catch (e) { g = { disp: [] }; }
  const sc = esc(b.name.toLowerCase());
  const tools = `<div class="tools"><div class="tg"><span>Logik</span><button class="tl" ${A(() => fbdAct(b, 'AND'))} title="UND-Box">&amp;</button><button class="tl" ${A(() => fbdAct(b, 'OR'))} title="ODER-Box">&gt;=1</button><button class="tl" ${A(() => fbdAct(b, 'XOR'))} title="Exklusiv-ODER">X</button><button class="tl" ${A(() => fbdAct(b, 'CMP'))} title="Vergleicher">CMP</button></div>
    <div class="tg"><span>Eingang</span><button class="tl" ${A(() => fbdAct(b, 'ADD'))}>＋ Eingang</button><button class="tl" ${A(() => fbdAct(b, 'NEG'))}>○ Negieren</button><button class="tl" ${A(() => fbdAct(b, 'DEL'))}>✕ Entfernen</button></div></div>`;
  const nets = b.networks.map((net, ni) => {
    net.root = net.root || { t: 'ASSIGN', op: '', in: { neg: false, n: { t: 'OP', op: '' } } };
    const d = g.disp[ni] || new Map(); const errs = blockErrors(b).some(m => m.net === ni && m.lvl === 'err');
    const isSel = path => ui.fbdSel && ui.fbdSel.b === b.name && ui.fbdSel.ni === ni && ui.fbdSel.path.join() === path.join();
    const pick = path => A(() => { ui.fbdSel = { b: b.name, ni, path }; renderEditor(); });
    const ev = x => `data-eb="${esc(x ?? 'FALSE')}" data-sc="${sc}"`;
    const node = (n, path) => {
      if (n.t === 'OP') return `<input class="fop mono" list="oplist" value="${esc(n.op)}" placeholder="??" ${B(v => { n.op = v.trim(); touch(); })}>`;
      if (n.t === 'CMP') return `<div class="fcmp ${isSel(path) ? 'sel' : ''}"><div class="fcmpin"><input class="fop mono" list="oplist" value="${esc(n.a)}" placeholder="IN1" ${B(v => { n.a = v.trim(); touch(); })}><input class="fop mono" list="oplist" value="${esc(n.b)}" placeholder="IN2" ${B(v => { n.b = v.trim(); touch(); })}></div><div class="fbx" ${pick(path)} ${ev(d.get(n))}><b>CMP</b><select ${B(v => { n.cmp = v; touch(); })}>${Object.keys(CMP_SCL).map(o => `<option ${n.cmp === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div></div>`;
      return `<div class="fgate"><div class="fins">${n.ins.map((i, k) => pin(i, [...path, k])).join('')}</div><div class="fbx ${isSel(path) ? 'sel' : ''}" ${pick(path)} ${ev(d.get(n))}><b>${GSYM[n.t]}</b></div></div>`;
    };
    const pin = (inp, path) => `<div class="fpin"><div class="fsrc">${node(inp.n, path)}</div><div class="fw ${inp.neg ? 'neg' : ''} ${isSel(path) ? 'sel' : ''}" ${pick(path)} ${ev(d.get(inp))}><i></i></div></div>`;
    const root = net.root, rt = root.t;
    const el = rt === 'ASSIGN' ? { ...root, t: 'COIL' } : root;
    let rb;
    if (['ASSIGN', 'NCOIL', 'SET', 'RST'].includes(rt)) rb = `<div class="froot"><input class="fop mono top" list="oplist" value="${esc(root.op)}" placeholder="Operand" ${B(v => { root.op = v.trim(); touch(); })}><div class="fbx rootb" ${ev(d.get(root.in))}><b>${{ ASSIGN: '=', NCOIL: '/=', SET: 'S', RST: 'R' }[rt]}</b></div></div>`;
    else rb = `<div class="froot"><div class="fbx rootb wide" ${ev(d.get(root.in))}><b>${rt === 'CALL' ? esc(root.blk || 'FB/FC') : rt}</b><div class="pf">${elFields(b, root)}</div></div></div>`;
    return `<div class="net ${errs ? 'bad' : ''}" id="net-${ni}">${netHead(b, ni, net, `<select class="rsel" ${B(v => { const keep = root.in; net.root = { t: v, in: keep }; if (IEC_OF[v]) { net.root.inst = autoInstance(b, IEC_OF[v]); if (v.startsWith('T')) net.root.pt = 'T#5s'; else net.root.pv = '10'; } if (v === 'CALL') net.root.params = {}; if (['ASSIGN', 'NCOIL', 'SET', 'RST'].includes(v)) net.root.op = root.op || ''; touch({ nav: true }); })}>${ROOT_T.map(([v, l]) => `<option value="${v}" ${v === rt ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      <div class="fbdw"><div class="fbd">${pin(root.in, [])}${rb}</div></div></div>`; }).join('');
  return `${tools}<div class="hint small">Eingang (Linie rechts neben dem Operanden) oder Box antippen, dann Werkzeug wählen.</div>${nets}<button class="addnet" ${A(() => { b.networks.push({ title: '', comment: '', root: { t: 'ASSIGN', op: '', in: { neg: false, n: { t: 'OP', op: '' } } } }); touch(); })}>＋ Netzwerk hinzufügen</button>`;
}
function fbdAct(b, act) {
  const s = ui.fbdSel; if (!s || s.b !== b.name) { toast('Zuerst einen Eingang oder eine Box antippen', 'warn'); return; }
  const net = b.networks[s.ni]; const inp = fbdInput(net, s.path); const leaf = () => ({ neg: false, n: { t: 'OP', op: '' } });
  const parentPath = s.path.slice(0, -1), idx = s.path[s.path.length - 1]; const parent = s.path.length ? fbdInput(net, parentPath) : null;
  if (act === 'AND' || act === 'OR' || act === 'XOR') { if (inp.n.t === act) inp.n.ins.push(leaf()); else if (['AND', 'OR', 'XOR'].includes(inp.n.t) && !inp.n._wrap) inp.n.t = act; else { inp.n = { t: act, ins: [{ neg: inp.neg, n: inp.n }, leaf()] }; inp.neg = false; } }
  else if (act === 'CMP') inp.n = { t: 'CMP', cmp: '>', a: inp.n.t === 'OP' ? inp.n.op : '', b: '' };
  else if (act === 'NEG') inp.neg = !inp.neg;
  else if (act === 'ADD') { if (['AND', 'OR', 'XOR'].includes(inp.n.t)) inp.n.ins.push(leaf()); else if (parent) parent.n.ins.splice(idx + 1, 0, leaf()); else { inp.n = { t: 'AND', ins: [{ neg: inp.neg, n: inp.n }, leaf()] }; inp.neg = false; } }
  else if (act === 'DEL') { if (parent && parent.n.ins.length > 2) { parent.n.ins.splice(idx, 1); ui.fbdSel = { ...s, path: parentPath }; }
    else if (parent) { const sib = parent.n.ins[1 - idx]; parent.n = sib.n; parent.neg = parent.neg !== sib.neg; ui.fbdSel = { ...s, path: parentPath }; }
    else { inp.n = { t: 'OP', op: '' }; inp.neg = false; } }
  touch();
}

/* ===================== Beobachtung & Simulation ===================== */
function watchView() {
  P.watch = P.watch || [];
  const din = P.tags.filter(t => normType(t.type) === 'Bool' && /^%I/i.test(t.addr || ''));
  const ain = P.tags.filter(t => normType(t.type) !== 'Bool' && /^%I/i.test(t.addr || ''));
  const dout = P.tags.filter(t => normType(t.type) === 'Bool' && /^%Q/i.test(t.addr || ''));
  const rows = P.watch.map((w, i) => `<tr><td><input class="mono" list="oplist" value="${esc(w.expr)}" ${B(v => { w.expr = v.trim(); save(); renderEditor(); })}></td>
    <td class="live mono" data-ev="${esc(w.expr)}"></td>
    <td><input class="mono" value="${esc(w.ctrl)}" placeholder="TRUE / 42 / T#2s" ${B(v => { w.ctrl = v.trim(); save(); })}></td>
    <td><button class="mini" ${A(() => writeExpr(w.expr, w.ctrl))}>Steuern</button></td>
    <td><button class="x" ${A(() => { P.watch.splice(i, 1); save(); renderEditor(); })}>✕</button></td></tr>`).join('');
  return `<div class="edh"><div><h2>Beobachtung &amp; Simulation</h2><div class="sub">Eingänge der simulierten CPU betätigen, Ausgänge und Variablen beobachten, Werte steuern.</div></div></div>
  ${!plc.prog ? `<div class="banner">Noch kein Programm in der CPU. <button class="pri" ${A(doRun)}>⇩ Laden &amp; RUN</button></div>` : ''}
  <div class="panel"><div class="ph2">Digitale Eingänge <label class="sw"><input type="checkbox" ${ui.tast ? 'checked' : ''} ${B(v => { ui.tast = v; renderEditor(); })}> Taster-Modus (gedrückt halten)</label></div>
    <div class="chips">${din.map(t => `<button class="chip" data-eb="&quot;${esc(t.name)}&quot;" ${ui.tast ? `data-tast="${esc(t.name)}"` : A(() => writeTag(t.name, !plc.G[t.name]))}><b>${esc(t.name)}</b><small>${esc(t.addr)}</small></button>`).join('') || '<span class="hint small">Keine Bool-Variablen mit %I-Adresse.</span>'}</div>
    ${ain.length ? `<div class="ph2">Analoge Eingänge</div>${ain.map(t => `<div class="ana"><b>${esc(t.name)}</b><small>${esc(t.addr)}</small><input type="range" min="0" max="${normType(t.type) === 'Real' ? 100 : 27648}" value="${plc.G[t.name] || 0}" data-ana="${esc(t.name)}"><span class="mono live" data-ev="&quot;${esc(t.name)}&quot;"></span></div>`).join('')}` : ''}
    <div class="ph2">Digitale Ausgänge</div><div class="chips">${dout.map(t => `<div class="chip out" data-eb="&quot;${esc(t.name)}&quot;"><b>${esc(t.name)}</b><small>${esc(t.addr)}</small></div>`).join('') || '<span class="hint small">Keine Bool-Variablen mit %Q-Adresse.</span>'}</div></div>
  <div class="panel"><div class="ph2">Beobachtungstabelle <span class="sp"></span><button class="mini" ${A(() => { P.watch.push({ expr: '', ctrl: '' }); save(); renderEditor(); })}>＋ Zeile</button><button class="mini" ${A(() => { let n = 0; for (const w of P.watch) if (w.ctrl && writeExpr(w.expr, w.ctrl)) n++; if (n) toast(n + ' Werte gesteuert', 'ok'); })}>Alle steuern</button></div>
  <div class="tw"><table class="grid"><thead><tr><th>Operand</th><th class="live">Beobachtungswert</th><th>Steuerwert</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function diagView() {
  return `<div class="edh"><div><h2>Online &amp; Diagnose</h2><div class="sub">Simulierte CPU · ${esc(P.cpu || '')}</div></div></div>
  <div class="panel cpup"><div class="cpubig ${plc.state}"><span class="led"></span>${plc.state}</div>
    <div class="cpub"><button class="run" ${A(doRun)}>▶ RUN</button><button class="stop" ${A(doStop)}>■ STOP</button><button ${A(() => { plc.memReset(P); renderEditor(); toast('Urlöschen durchgeführt', 'ok'); })}>MRES Urlöschen</button></div>
    <table class="kv"><tr><td>Zykluszeit aktuell</td><td class="mono" data-cyc="last"></td></tr><tr><td>Zykluszeit min.</td><td class="mono" data-cyc="min"></td></tr><tr><td>Zykluszeit max.</td><td class="mono" data-cyc="max"></td></tr>
    <tr><td>CPU-Typ</td><td><input value="${esc(P.cpu)}" ${B(v => { P.cpu = v; save(); renderNav(); })}></td></tr></table></div>
  <div class="panel"><div class="ph2">Diagnosepuffer</div><div class="tw"><table class="grid"><thead><tr><th>Zeit</th><th>Ereignis</th></tr></thead><tbody>${plc.diag.map(d => `<tr class="${d.lvl}"><td class="mono">${d.t.toLocaleTimeString('de-DE')}</td><td>${esc(d.msg)}</td></tr>`).join('') || '<tr><td colspan="2" class="hint">Keine Einträge</td></tr>'}</tbody></table></div></div>`;
}
function srcView() {
  let src = ''; try { src = genSource(P); } catch (e) { src = '// Fehler beim Erzeugen: ' + e.message; }
  return `<div class="edh"><div><h2>Externe Quellen &amp; Projektdatei</h2><div class="sub">Austausch mit dem TIA Portal über SCL-Quellen (.scl) und Sicherung des ganzen Projekts (.json).</div></div></div>
  <div class="panel"><div class="ph2">Alle Bausteine als externe Quelle <span class="sp"></span>${DESK ? `<button class="mini" ${A(exportSrcFile)}>Als .scl-Datei speichern…</button>` : ''}<button class="mini" ${A(() => copyText(src))}>Kopieren</button></div>
    <p class="hint small">Im TIA Portal: Projektnavigation → Externe Quellen → Neue externe Datei hinzufügen → .scl-Datei mit diesem Inhalt → „Bausteine aus Quelle generieren“. Die PLC-Variablen müssen dort mit gleichem Namen existieren. KOP/FUP-Bausteine werden als SCL exportiert.</p>
    <pre class="srcpre">${hl(src)}</pre></div>
  <div class="panel"><div class="ph2">Externe Quelle importieren${DESK ? `<span class="sp"></span><button class="mini" ${A(importSrcFileDesk)}>.scl-Datei öffnen…</button>` : ''}</div>
    <p class="hint small">SCL-Quelltext einfügen oder .scl-Datei wählen. Bausteine mit gleichem Namen werden ersetzt.</p>
    <input type="file" accept=".scl,.txt,.awl" id="srcfile"><textarea id="srcin" class="mono imp" placeholder="FUNCTION_BLOCK &quot;FB_Beispiel&quot; …"></textarea>
    <button class="pri" ${A(importSrc)}>Bausteine aus Quelle generieren</button></div>
  <div class="panel"><div class="ph2">Projektdatei (.json) <span class="sp"></span>${DESK ? `<button class="mini" ${A(() => fileSave(false))}>Speichern</button><button class="mini" ${A(() => fileSave(true))}>Speichern unter…</button><button class="mini" ${A(() => guardDirty(() => fileOpen()))}>Öffnen…</button>` : ''}<button class="mini" ${A(() => copyText(JSON.stringify(P, null, 1)))}>Projekt kopieren</button></div>
    <p class="hint small">Das Projekt wird automatisch in diesem Browser gespeichert. Zum Sichern oder Übertragen den JSON-Text kopieren; zum Laden Datei wählen oder Text einfügen.</p>
    <input type="file" accept=".json" id="jsonfile"><textarea id="jsonin" class="mono imp" placeholder="{ &quot;name&quot;: … }"></textarea>
    <div class="row"><button class="pri" ${A(importJson)}>Projekt öffnen</button><button ${A(() => confirmDlg('Beispielprojekt „Pumpstation“ laden? Das aktuelle Projekt wird ersetzt.', () => setProject(exampleProject())))}>Beispielprojekt laden</button><button class="danger" ${A(() => confirmDlg('Neues leeres Projekt anlegen? Das aktuelle Projekt wird ersetzt.', () => setProject(emptyProject())))}>Neues leeres Projekt</button></div></div>`;
}
function emptyProject() { return { name: 'Neues Projekt', cpu: 'CPU 1516-3 PN/DP (Simulation)', version: 1, tags: [], blocks: [{ name: 'Main', type: 'OB', number: 1, lang: 'LAD', iface: { Temp: [] }, networks: [{ title: '', comment: '', rows: 1, cols: 6, cells: {}, links: {} }] }], watch: [] }; }
function setProject(np) { if (plc.state === 'RUN') plc.stop('Projektwechsel'); P = np; prog = null; plc.prog = null; ui.msgs = []; ui.dirty = true; evalCache.clear(); save(); select('block', (P.blocks[0] || {}).name); }
async function readFileInput(id) { const f = $(id).files[0]; return f ? await f.text() : null; }
async function importSrc() { importSrcText((await readFileInput('#srcfile')) || $('#srcin').value); }
function importSrcText(txt) {
  if (!txt || !txt.trim()) { toast('Keine Quelle angegeben', 'warn'); return; }
  let bl; try { bl = parseSource(txt); } catch (e) { toast('Quelle nicht lesbar: ' + e.message, 'err'); return; }
  if (!bl.length) { toast('Keine Bausteine in der Quelle gefunden', 'err'); return; }
  for (const b of bl) { const i = P.blocks.findIndex(x => x.name.toLowerCase() === b.name.toLowerCase());
    if (i >= 0) b.number = P.blocks[i].number; else b.number = b.type === 'OB' ? (/startup/i.test(b.name) ? 100 : nextNum('OB', 1)) : nextNum(b.type);
    if (b.type !== 'DB') for (const s of SECTIONS[b.type]) b.iface[s] = b.iface[s] || [];
    if (i >= 0) P.blocks[i] = b; else P.blocks.push(b); }
  toast(bl.length + ' Baustein(e) importiert', 'ok'); touch({ nav: true }); select('block', bl[0].name);
}
async function importJson() {
  const txt = (await readFileInput('#jsonfile')) || $('#jsonin').value; let np;
  try { np = JSON.parse(txt); if (!Array.isArray(np.tags) || !Array.isArray(np.blocks)) throw new Error('Kein gültiges Projekt'); } catch (e) { toast('Projektdatei ungültig: ' + e.message, 'err'); return; }
  setProject(np); toast('Projekt geöffnet', 'ok');
}
function copyText(t) { try { navigator.clipboard.writeText(t).then(() => toast('In die Zwischenablage kopiert', 'ok'), () => toast('Kopieren nicht erlaubt – Text markieren und manuell kopieren', 'warn')); } catch (e) { toast('Kopieren nicht möglich', 'warn'); } }

/* ===================== Dialoge ===================== */
function modal(html, buttons) { const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}<div class="mbtn">${buttons.map(([l, fn, cls]) => `<button class="${cls || ''}" ${A(fn)}>${l}</button>`).join('')}</div></div>`; m.className = 'on'; const f = m.querySelector('input'); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { $('#modal').className = ''; $('#modal').innerHTML = ''; }
function confirmDlg(text, fn) { modal(`<h3>Bestätigen</h3><p>${esc(text)}</p>`, [['Abbrechen', closeModal], ['OK', () => { closeModal(); fn(); }, 'pri']]); }
function addBlockDlg() {
  ui.navOpen = false; renderNav();
  const fbs = P.blocks.filter(b => b.type === 'FB').map(b => b.name);
  modal(`<h3>Neuen Baustein hinzufügen</h3>
   <div class="seg" id="nbType">${[['OB', 'Organisationsbaustein'], ['FB', 'Funktionsbaustein'], ['FC', 'Funktion'], ['DB', 'Datenbaustein']].map(([t, l], i) => `<label><input type="radio" name="nbt" value="${t}" ${t === 'FB' ? 'checked' : ''}><span><b>${t}</b>${l}</span></label>`).join('')}</div>
   <label class="fl">Name<input id="nbName" class="mono" value="${uniqName('Baustein_', P.blocks.map(b => b.name))}"></label>
   <label class="fl" id="nbLangL">Sprache<select id="nbLang"><option value="LAD">KOP (Kontaktplan)</option><option value="FBD">FUP (Funktionsplan)</option><option value="SCL" selected>SCL (Structured Control Language)</option></select></label>
   <label class="fl" id="nbInstL">DB-Typ<select id="nbInst"><option value="">Global-DB</option>${[...fbs, ...IEC_NAMES].map(t => `<option value="${esc(t)}">Instanz-DB von ${esc(t)}</option>`).join('')}</select></label>
   <label class="fl">Nummer<input id="nbNum" type="number" min="1" placeholder="automatisch"></label>`, [['Abbrechen', closeModal], ['OK', createBlock, 'pri']]);
  const upd = () => { const t = document.querySelector('input[name=nbt]:checked').value; $('#nbLangL').style.display = t === 'DB' ? 'none' : ''; $('#nbInstL').style.display = t === 'DB' ? '' : 'none'; };
  document.querySelectorAll('input[name=nbt]').forEach(r => r.addEventListener('change', upd)); upd();
}
function createBlock() {
  const t = document.querySelector('input[name=nbt]:checked').value, name = $('#nbName').value.trim(), lang = $('#nbLang').value, inst = $('#nbInst').value; let num = parseInt($('#nbNum').value, 10);
  if (!/^[A-Za-z_][\w]*$/.test(name)) { toast('Name: nur Buchstaben, Ziffern, _ (nicht mit Ziffer beginnen)', 'err'); return; }
  if ([...P.blocks.map(b => b.name), ...P.tags.map(t => t.name)].some(n => n.toLowerCase() === name.toLowerCase())) { toast('Name ist bereits vergeben', 'err'); return; }
  if (!num) num = t === 'OB' ? (P.blocks.some(b => b.type === 'OB' && (b.number | 0) === 1) ? nextNum('OB', 123) : 1) : nextNum(t);
  else if (P.blocks.some(b => b.type === t && (b.number | 0) === num)) { toast(`${t}${num} existiert bereits`, 'err'); return; }
  const b = { name, type: t, number: num };
  if (t === 'DB') { if (inst) b.instanceOf = inst; else b.iface = { Static: [] }; }
  else { b.lang = lang; b.iface = {}; for (const s of SECTIONS[t]) b.iface[s] = [];
    if (lang === 'SCL') b.scl = t === 'OB' ? '// Zyklisches Programm\n' : '// ' + name + '\n';
    else if (lang === 'LAD') b.networks = [{ title: '', comment: '', rows: 1, cols: 6, cells: {}, links: {} }];
    else b.networks = [{ title: '', comment: '', root: { t: 'ASSIGN', op: '', in: { neg: false, n: { t: 'OP', op: '' } } } }]; }
  P.blocks.push(b); closeModal(); touch({ nav: true }); select('block', name);
}
function propsDlg(b) {
  modal(`<h3>Eigenschaften ${b.type} „${esc(b.name)}“</h3><label class="fl">Name<input id="pName" class="mono" value="${esc(b.name)}"></label><label class="fl">Nummer<input id="pNum" type="number" min="1" value="${b.number ?? ''}"></label>
    ${b.type === 'OB' ? '<p class="hint small">OB1 und OB ≥ 123 laufen zyklisch, OB100 einmal beim Anlauf (STOP → RUN).</p>' : ''}
    ${b.type !== 'DB' ? `<p class="hint small">Sprache: ${LANG_L[b.lang]}${b.lang !== 'SCL' ? ` · <a href="#" ${A((el, e) => { e.preventDefault(); const g = blockScl(b, reg()); b.lang = 'SCL'; b.scl = g.text; if (g.temps.length) b.iface.Temp.push(...g.temps.map(t => ({ name: t.name, type: 'Bool', init: '', comment: 'aus KOP' }))); delete b.networks; closeModal(); touch({ nav: true }); })}>In SCL umwandeln</a>` : ''}</p>` : ''}`,
    [['Abbrechen', closeModal], ['OK', () => { const n = $('#pName').value.trim(), num = parseInt($('#pNum').value, 10);
      if (!/^[A-Za-z_][\w]*$/.test(n)) { toast('Ungültiger Name', 'err'); return; }
      if (n.toLowerCase() !== b.name.toLowerCase() && [...P.blocks.map(x => x.name), ...P.tags.map(t => t.name)].some(x => x.toLowerCase() === n.toLowerCase())) { toast('Name ist bereits vergeben', 'err'); return; }
      if (num && P.blocks.some(x => x !== b && x.type === b.type && (x.number | 0) === num)) { toast(`${b.type}${num} existiert bereits`, 'err'); return; }
      const old = b.name; b.name = n; if (num) b.number = num; renameRefs(old, n); closeModal(); ui.sel.name = n; touch({ nav: true }); }, 'pri']]);
}
function delBlockDlg(b) { confirmDlg(`Baustein „${b.name}“ löschen?`, () => { P.blocks.splice(P.blocks.indexOf(b), 1); touch({ nav: true }); select('tags'); }); }


/* ===================== Desktop-Integration (Electron) ===================== */
var DESK = typeof window !== 'undefined' && window.desktop ? window.desktop : null;
var filePath = null, fileDirty = false;
const PROJ_FILTER = [{ name: 'SPS-Werkbank-Projekt', extensions: ['spsw', 'json'] }];
function setFileDirty(d) { fileDirty = d; if (DESK) { DESK.setDirty(d); updateTitle(); } }
function updateTitle() { if (DESK) DESK.setTitle(`${fileDirty ? '● ' : ''}${filePath ? filePath.split(/[\\/]/).pop() : P.name} – SPS-Werkbank`); }
function rememberPath() { try { if (filePath) localStorage.setItem(LS_KEY + '-pfad', filePath); else localStorage.removeItem(LS_KEY + '-pfad'); } catch (e) {} }
function guardDirty(fn) {
  if (!fileDirty) return fn();
  modal('<h3>Ungespeicherte Änderungen</h3><p>Möchtest du die Änderungen am Projekt „' + esc(P.name) + '“ speichern?</p>',
    [['Abbrechen', closeModal], ['Nicht speichern', () => { closeModal(); fn(); }, 'danger'], ['Speichern', async () => { closeModal(); if (await fileSave(false)) fn(); }, 'pri']]);
}
async function fileOpen(path) {
  const r = await DESK.openFile({ title: 'Projekt öffnen', filters: PROJ_FILTER, path }); if (!r) return;
  let np; try { np = JSON.parse(r.content); if (!Array.isArray(np.tags) || !Array.isArray(np.blocks)) throw new Error('kein SPS-Werkbank-Projekt'); }
  catch (e) { toast('Datei ungültig: ' + e.message, 'err'); return; }
  setProject(np); filePath = r.path; rememberPath(); setFileDirty(false); toast('Geöffnet: ' + r.path, 'ok');
}
async function fileSave(as) {
  const r = await DESK.saveFile({ title: 'Projekt speichern', content: JSON.stringify(P, null, 1), path: as ? null : filePath, defaultName: (P.name || 'Projekt').replace(/[\\/:*?"<>|]/g, '_') + '.spsw', filters: PROJ_FILTER });
  if (!r) return false; filePath = r.path; rememberPath(); setFileDirty(false); toast('Gespeichert: ' + r.path, 'ok'); return true;
}
function fileNew() { guardDirty(() => { setProject(emptyProject()); filePath = null; rememberPath(); setFileDirty(false); }); }
async function exportSrcFile() {
  let src; try { src = genSource(P); } catch (e) { toast('Quelle konnte nicht erzeugt werden: ' + e.message, 'err'); return; }
  const r = await DESK.saveFile({ title: 'Externe Quelle exportieren', content: src, defaultName: (P.name || 'Projekt').replace(/[\\/:*?"<>|]/g, '_') + '.scl', filters: [{ name: 'SCL-Quelle', extensions: ['scl'] }] });
  if (r) toast('Quelle gespeichert: ' + r.path, 'ok');
}
async function importSrcFileDesk() { const r = await DESK.openFile({ title: 'Externe Quelle importieren', filters: [{ name: 'SCL-Quelle', extensions: ['scl', 'txt'] }] }); if (r) importSrcText(r.content); }
async function aboutDlg() { const i = DESK ? await DESK.appInfo() : {}; modal(`<h3>SPS-Werkbank</h3><p>Version ${esc(i.version || '1.0.0')} · ${esc(i.platform || '')}</p><p class="hint small">Programmierumgebung für KOP, FUP und SCL mit simulierter CPU. Austausch mit dem TIA Portal über externe SCL-Quellen. Kein Produkt der Siemens AG.</p>`, [['OK', closeModal, 'pri']]); }
if (DESK) {
  document.body.classList.add('desktop');
  try { filePath = localStorage.getItem(LS_KEY + '-pfad'); } catch (e) {}
  DESK.onMenu(cmd => {
    const go = { new: fileNew, open: () => guardDirty(() => fileOpen()), save: () => fileSave(false), saveAs: () => fileSave(true),
      exportScl: exportSrcFile, importScl: importSrcFileDesk, compile: () => doCompile(), load: doLoad, run: doRun, stop: doStop,
      example: () => guardDirty(() => { setProject(exampleProject()); filePath = null; rememberPath(); setFileDirty(false); }),
      tags: () => select('tags'), watch: () => select('watch'), diag: () => select('diag'), src: () => select('src'), about: aboutDlg }[cmd];
    if (go) go();
  });
  DESK.onOpenPath(p => guardDirty(() => fileOpen(p)));
  DESK.onAskClose(() => guardDirty(() => DESK.closeNow()));
  setFileDirty(false);
}

/* ===================== Start ===================== */
document.getElementById('scrim').addEventListener('click', () => { ui.navOpen = false; renderNav(); });
renderEditor();
