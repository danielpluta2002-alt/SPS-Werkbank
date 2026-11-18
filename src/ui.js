/* ===================== Zustand ===================== */
const LS_KEY = 'sps-werkbank-projekt-v1';
function loadLocal() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
let firstStart = false;
let P = (() => { const p = loadLocal(); if (!p) { firstStart = true; return exampleProject(); } try { return migrateProject(p); } catch (e) { console.error(e); firstStart = true; return exampleProject(); } })();
let prog = null; const plc = new PLC();
const ui = { sel: { k: 'block', name: 'Main' }, navOpen: false, infoOpen: false, msgs: [], monitor: true, nsel: null, ifaceOpen: {}, dirty: true, tast: false, gotoLine: null, gotoNet: null, tagTab: 'all', libQ: '', libInfo: null, libOpen: false, libOpenCats: { bit: true }, lastTa: null, menu: false };
let H = [];
const A = fn => { H.push(fn); return `data-a="${H.length - 1}"`; };
const B = fn => { H.push(fn); return `data-b="${H.length - 1}"`; };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
let saveT = null;
function save() { if (typeof DESK !== 'undefined' && DESK && !fileDirty) setFileDirty(true); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(P)); } catch (e) {} }, 300); }
function touch(o = {}) { ui.dirty = true; save(); if (o.nav) renderNav(); if (o.ed !== false) renderEditor(); renderTop(); }
function toast(msg, lvl = '') { const t = $('#toast'); t.textContent = msg; t.className = 'show ' + lvl; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2800); }
function curBlock() { return ui.sel.k === 'block' ? P.blocks.find(b => b.name === ui.sel.name) : null; }
function reg() { return buildReg(P); }
const LANG_L = { SCL: 'SCL', LAD: 'KOP', FBD: 'FUP', STL: 'AWL' };
const LANG_LONG = { LAD: 'KOP – Kontaktplan', FBD: 'FUP – Funktionsplan', SCL: 'SCL – Structured Control Language', STL: 'AWL – Anweisungsliste' };
const TYPE_ORDER = { OB: 0, FB: 1, FC: 2, DB: 3 };
const CPUS = ['CPU 1511-1 PN', 'CPU 1513-1 PN', 'CPU 1515-2 PN', 'CPU 1516-3 PN/DP', 'CPU 1517-3 PN/DP', 'CPU 1518-4 PN/DP', 'CPU 1211C DC/DC/DC', 'CPU 1212C DC/DC/DC', 'CPU 1214C DC/DC/DC', 'CPU 1215C DC/DC/DC', 'CPU 1217C DC/DC/DC'];
const isS71200 = cpu => /CPU 12\d\dC/.test(cpu || '');

/* ===================== Ereignisse ===================== */
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && H[el.dataset.a]) { H[el.dataset.a](el, e); } if (ui.menu && !e.target.closest('#pmenu, .logo-btn')) { ui.menu = false; renderMenu(); } });
document.addEventListener('change', e => { const el = e.target.closest('[data-b]'); if (el && H[el.dataset.b]) H[el.dataset.b](el.type === 'checkbox' ? el.checked : el.value, el); });
document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.iface) ui.ifaceOpen[d.dataset.iface] = d.open; }, true);
document.addEventListener('keydown', e => { if (e.target.matches('input[data-b]') && e.key === 'Enter') e.target.blur(); if (e.key === 'Escape' && ui.menu) { ui.menu = false; renderMenu(); } });
let tastEl = null;
document.addEventListener('pointerdown', e => { const el = e.target.closest('[data-tast]'); if (!el || !ui.tast) return; tastEl = el; writeTag(el.dataset.tast, true); });
document.addEventListener('pointerup', () => { if (tastEl) { writeTag(tastEl.dataset.tast, false); tastEl = null; } });
document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.ana) writeTag(el.dataset.ana, +el.value); });

/* ===================== Aktionen ===================== */
function doCompile(quiet) {
  let res; try { res = compileProject(P); } catch (e) { console.error(e); toast('Interner Fehler: ' + e.message, 'err'); return null; }
  ui.msgs = res.msgs; if (!res.ok) ui.infoOpen = true;
  if (!quiet || !res.ok) toast(res.msgs[res.msgs.length - 1].msg, res.ok ? 'ok' : 'err');
  renderEditor(); return res;
}
function doLoad() {
  const res = doCompile(true); if (!res) return false;
  if (!res.ok) { toast('Laden abgebrochen – Übersetzungsfehler beheben', 'err'); return false; }
  prog = res; plc.load(res, P); evalCache.clear(); ui.dirty = false; toast('In CPU geladen' + (plc.state === 'RUN' ? ' (im RUN übernommen)' : ''), 'ok'); renderTop(); renderEditor(); return true;
}
function doRun() { if ((!plc.prog || ui.dirty) && !doLoad()) return; if (plc.start()) toast('CPU im RUN', 'ok'); renderTop(); }
function doStop() { plc.stop(''); renderTop(); }
function select(k, name) { ui.sel = { k, name }; ui.navOpen = false; ui.nsel = null; ui.lastTa = null; renderEditor(); }
plc.onEvent = k => { renderTop(); if (ui.sel.k === 'diag') renderEditor(); if (k === 'state' && plc.state === 'STOP' && plc.diag[0] && plc.diag[0].lvl === 'err') toast(plc.diag[0].msg, 'err'); };

/* ===================== Kopfzeile & Projektmenü ===================== */
function renderTop() {
  const st = plc.state, sync = plc.prog ? (ui.dirty ? '<span class="sync bad" title="Offline-Projekt weicht vom geladenen Programm ab">online ≠ offline</span>' : '<span class="sync ok">online = offline</span>') : '<span class="sync">nicht geladen</span>';
  $('#top').innerHTML = `
  <button class="ib navt" ${A(() => { ui.navOpen = !ui.navOpen; renderNav(); })} aria-label="Projektnavigation">☰</button>
  <button class="logo-btn ${ui.menu ? 'act' : ''}" ${A(() => { ui.menu = !ui.menu; renderMenu(); renderTop(); })} aria-haspopup="menu" title="Projekt: Neu, Öffnen, Speichern, Beispiel …"><span class="logo"></span><span class="bt1">SPS-Werkbank</span><span class="car">▾</span></button>
  <div class="pinfo"><b>${esc(P.name)}</b><small>${LANG_L[P.lang] || ''} · ${esc(P.cpu || '')}</small></div>
  <div class="tb">
    <button ${A(() => doCompile())} title="Alle Bausteine übersetzen (Strg+B)"><span class="i">⚙</span><span class="t">Übersetzen</span></button>
    <button ${A(doLoad)} title="Übersetzen und in die simulierte CPU laden"><span class="i">⇩</span><span class="t">Laden</span></button>
    <button class="run ${st === 'RUN' ? 'act' : ''}" ${A(doRun)}><span class="i">▶</span><span class="t">RUN</span></button>
    <button class="stop ${st === 'STOP' ? 'act' : ''}" ${A(doStop)}><span class="i">■</span><span class="t">STOP</span></button>
    <button class="mon ${ui.monitor ? 'act' : ''}" ${A(() => { ui.monitor = !ui.monitor; if (!ui.monitor) clearLive(); renderTop(); })} title="Beobachten ein/aus"><span class="i">◎</span><span class="t">Beobachten</span></button>
    <button class="libbtn" ${A(() => { ui.libOpen = !ui.libOpen; renderLib(); })} title="Anweisungen"><span class="i">☷</span><span class="t">Anweisungen</span></button>
  </div>
  <div class="cpu ${st}"><span class="led"></span><b>${st}</b><span id="cyc" class="cyc"></span>${sync}</div>`;
}
function renderMenu() {
  const m = $('#pmenu'); if (!ui.menu) { m.className = ''; m.innerHTML = ''; return; }
  const it = (label, fn, key, cls = '') => `<button class="mi ${cls}" role="menuitem" ${A(() => { ui.menu = false; renderMenu(); renderTop(); fn(); })}><span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
  m.className = 'on';
  m.innerHTML = `<div class="mhd"><b>${esc(P.name)}</b><small>${esc(LANG_LONG[P.lang] || '')}${filePath ? '<br>' + esc(filePath) : ''}</small></div>
    ${it('Neues Projekt…', () => guardDirty(newProjectDlg), DESK ? 'Strg+N' : '')}
    ${it('Projekt öffnen…', () => guardDirty(openProjectDlg), DESK ? 'Strg+O' : '')}
    ${DESK ? it('Speichern', () => fileSave(false), 'Strg+S') + it('Speichern unter…', () => fileSave(true), 'Strg+⇧+S') : it('Projekt sichern (.json)…', exportProjectDlg)}
    ${it('Beispielprojekt laden…', () => guardDirty(exampleDlg))}
    <div class="msep"></div>
    ${it(`Projektsprache ändern… <small>(${LANG_L[P.lang]})</small>`, langDlg)}
    ${it(`AWL-Mnemonik: ${P.mnemonic === 'INT' ? 'International' : 'Deutsch'}`, () => { P.mnemonic = P.mnemonic === 'INT' ? 'DE' : 'INT'; touch(); toast('AWL-Mnemonik: ' + (P.mnemonic === 'INT' ? 'International (A, AN, JC …)' : 'Deutsch (U, UN, SPB …)'), 'ok'); })}
    ${it('Projekteigenschaften…', projPropsDlg)}
    <div class="msep"></div>
    ${it('Externe Quellen &amp; Austausch', () => select('src'))}
    ${it('Über SPS-Werkbank', aboutDlg)}`;
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
    <div class="tn root"><span class="ico cpu-i"></span>PLC_1 <small>[${esc(P.cpu || 'CPU')}]</small></div>
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
  $('#scrim').className = ui.navOpen || ui.libOpen ? 'on' : '';
}

/* ===================== Info-Fenster ===================== */
function renderInfo() {
  const e = ui.msgs.filter(m => m.lvl === 'err' && !/^Übersetzen beendet/.test(m.msg)).length, w = ui.msgs.filter(m => m.lvl === 'warn').length;
  $('#info').className = ui.infoOpen ? 'open' : '';
  $('#info').innerHTML = `<div class="infoh" ${A(() => { ui.infoOpen = !ui.infoOpen; renderInfo(); })}><b>Info</b> · Übersetzen <span class="cnt e">✖ ${e}</span><span class="cnt w">⚠ ${w}</span><span class="chev">${ui.infoOpen ? '▾' : '▴'}</span></div>
  <div class="infob">${ui.msgs.length ? ui.msgs.map(m => `<div class="msg ${m.lvl}" ${A(() => gotoMsg(m))}><span class="mi">${m.lvl === 'err' ? '✖' : m.lvl === 'warn' ? '⚠' : '✔'}</span><span class="mw">${m.block ? esc(m.block) + (m.net != null ? ' · NW ' + (m.net + 1) + (m.nline ? ' Z ' + m.nline : '') : m.line ? ' · Zeile ' + m.line : '') : m.tags ? 'Variablen' : ''}</span><span>${esc(m.msg)}</span></div>`).join('') : '<div class="msg">Noch nicht übersetzt.</div>'}</div>`;
}
function gotoMsg(m) { if (m.tags) return select('tags'); if (!m.block) return; ui.gotoLine = m.line || null; ui.gotoNet = m.net ?? null; select('block', m.block); }

/* ===================== Live-Werte ===================== */
const evalCache = new Map();
function fmtTime(ms) { if (!ms) return '0MS'; let s = '', v = Math.abs(ms); const u = [[86400000, 'D'], [3600000, 'H'], [60000, 'M'], [1000, 'S'], [1, 'MS']];
  for (const [f, n] of u) { const q = Math.floor(v / f); if (q) { s += q + n + '_'; v -= q * f; } } return (ms < 0 ? '-' : '') + s.replace(/_$/, ''); }
function fmt(v, t) { if (v === undefined || v === null) return '—'; if (t === 'Bool') return v ? 'TRUE' : 'FALSE'; if (t === 'Time') return 'T#' + fmtTime(v);
  if (t === 'Real' || t === 'LReal') return Number.isFinite(v) ? String(+v.toFixed(4)) : String(v); if (t === 'Word' || t === 'DWord' || t === 'Byte') return '16#' + (v >>> 0).toString(16).toUpperCase().padStart(t === 'Byte' ? 2 : t === 'Word' ? 4 : 8, '0'); return String(v); }
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
    if (el.dataset.ev !== undefined) { const txt = c.err ? (el.tagName === 'text' ? '' : '—') : (el.dataset.pre || '') + fmt(v, c.t); if (el.textContent !== txt) el.textContent = txt; el.classList.toggle('t', v === true); el.classList.toggle('f', v === false); }
    else { const on = v === true; if (el.classList.contains('on') !== on) { el.classList.toggle('on', on); } el.classList.toggle('off', v === false); }
  });
  awlLive();
  document.body.classList.add('live');
}
function clearLive() { document.body.classList.remove('live'); document.querySelectorAll('#ed [data-ev]').forEach(el => { el.textContent = ''; }); document.querySelectorAll('#ed .on, #ed .off').forEach(el => el.classList.remove('on', 'off')); document.querySelectorAll('[data-awl]').forEach(el => el.innerHTML = ''); }
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
  H = []; EDITS = []; if (edBox) { edBox.inp.remove(); edBox = null; }
  renderTop(); renderNav(); renderInfo(); renderMenu();
  const ed = $('#ed'); const sc = ed.scrollTop;
  updateLists();
  const k = ui.sel.k; let html = '';
  if (k === 'tags') html = tagsView();
  else if (k === 'watch') html = watchView();
  else if (k === 'diag') html = diagView();
  else if (k === 'src') html = srcView();
  else { const b = curBlock(); if (!b) { ui.sel = { k: 'tags' }; return renderEditor(); } html = blockView(b); }
  ed.innerHTML = html; ed.scrollTop = sc;
  renderLib();
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
const TAG_TYPES = ['Bool', 'Byte', 'Word', 'DWord', 'SInt', 'Int', 'DInt', 'USInt', 'UInt', 'UDInt', 'Real', 'LReal', 'Time'];
const TAG_TABS = [['all', 'Alle', null], ['I', 'Eingänge', 'I'], ['Q', 'Ausgänge', 'Q'], ['M', 'Merker', 'M']];
const areaOf = t => { const a = normAddr(t.addr || ''); const m = /^%([IQM])/.exec(a); return m ? m[1] : ''; };
function renameRefs(oldN, newN, scopeBlock) {
  if (!oldN || oldN === newN) return;
  const rx = oldN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const reQ = new RegExp('"' + rx + '"', 'gi'), reL = new RegExp('#' + rx + '\\b', 'gi');
  const walk = (o, local) => { for (const k of Object.keys(o)) { const v = o[k];
    if (typeof v === 'string') { if (local) o[k] = v.replace(reL, '#' + newN); else { o[k] = v.replace(reQ, '"' + newN + '"'); if ((k === 'type' || k === 'blk' || k === 'instanceOf') && v.toLowerCase() === oldN.toLowerCase()) o[k] = newN; } }
    else if (v && typeof v === 'object') walk(v, local); } };
  if (scopeBlock) { scopeBlock.scl = (scopeBlock.scl || '').replace(reL, '#' + newN); if (scopeBlock.networks) walk(scopeBlock.networks, true); }
  else { walk(P.blocks, false); walk(P.watch || [], false); }
}
function nextAddr(area, type = 'Bool') {
  const used = P.tags.map(t => normAddr(t.addr || ''));
  if (type === 'Bool') { for (let b = 0; b < 1000; b++) for (let i = 0; i < 8; i++) { const a = `%${area}${b}.${i}`; if (!used.includes(a)) return a; } return ''; }
  const sz = { Byte: 1, SInt: 1, USInt: 1, Word: 2, Int: 2, UInt: 2 }[type] || 4; const L = sz === 1 ? 'B' : sz === 2 ? 'W' : 'D';
  const occ = new Set(); for (const t of P.tags) { const a = normAddr(t.addr || ''); const m = new RegExp(`^%${area}([BWD]?)(\\d+)`).exec(a); if (!m) continue; const s = m[1] === 'B' ? 1 : m[1] === 'W' ? 2 : m[1] === 'D' ? 4 : 1; for (let k = 0; k < s; k++) occ.add(+m[2] + k); }
  const start = area === 'I' || area === 'Q' ? (sz === 1 ? 0 : 64) : 10;
  for (let x = start; x < 4000; x += sz) { let free = true; for (let k = 0; k < sz; k++) if (occ.has(x + k)) free = false; if (free) return `%${area}${L}${x}`; } return '';
}
function tagsView() {
  const tab = ui.tagTab; const area = (TAG_TABS.find(t => t[0] === tab) || [])[2];
  const list = P.tags.map((t, i) => [t, i]).filter(([t]) => !area || areaOf(t) === area);
  const cnt = a => P.tags.filter(t => !a || areaOf(t) === a).length;
  const rows = list.map(([t, i]) => `<tr>
    <td><span class="ar ${areaOf(t)}">${areaOf(t) ? { I: 'E', Q: 'A', M: 'M' }[areaOf(t)] : '–'}</span></td>
    <td><input value="${esc(t.name)}" ${B(v => { const o = t.name; t.name = v.trim(); renameRefs(o, t.name); touch(); })}></td>
    <td><select ${B(v => { t.type = v; if (t.addr) { const a = areaOf(t); if (a) t.addr = nextAddr(a, v); } touch(); })}>${TAG_TYPES.map(x => `<option ${normType(t.type) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
    <td><input class="mono" value="${esc(t.addr)}" ${B(v => { t.addr = normAddr(v.trim()); touch(); })} placeholder="%I0.0"></td>
    <td><input class="mono" value="${esc(t.init)}" ${B(v => { t.init = v.trim(); touch(); })}></td>
    <td class="live mono" data-ev="&quot;${esc(t.name)}&quot;"></td>
    <td><input value="${esc(t.comment)}" ${B(v => { t.comment = v; save(); })}></td>
    <td><button class="x" ${A(() => { P.tags.splice(i, 1); touch(); })} title="Löschen">✕</button></td></tr>`).join('');
  const addArea = area || 'M'; const addLabel = { I: 'Eingang', Q: 'Ausgang', M: 'Merker' }[addArea];
  return `<div class="edh"><div><h2>Standard-Variablentabelle</h2><div class="sub">${P.tags.length} PLC-Variablen · Eingänge %I (E), Ausgänge %Q (A), Merker %M</div></div>
    <div class="acts"><button class="pri" ${A(() => { const nm = uniqName({ I: 'Eingang_', Q: 'Ausgang_', M: 'Merker_' }[addArea], P.tags.map(t => t.name)); P.tags.push({ name: nm, type: 'Bool', addr: nextAddr(addArea), comment: '', init: '' }); touch(); })}>＋ ${addLabel}</button></div></div>
  <div class="tabs">${TAG_TABS.map(([k, l, a]) => `<button class="tab ${tab === k ? 'on' : ''}" ${A(() => { ui.tagTab = k; renderEditor(); })}>${l}<small>${cnt(a)}</small></button>`).join('')}</div>
  <div class="tw tabbed"><table class="grid"><thead><tr><th></th><th>Name</th><th>Datentyp</th><th>Adresse</th><th>Startwert</th><th class="live">Beobachtungswert</th><th>Kommentar</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="hint" style="padding:14px">Keine ${tab === 'all' ? 'Variablen' : TAG_TABS.find(t => t[0] === tab)[1]} vorhanden.</td></tr>`}</tbody></table></div>`;
}
function uniqName(base, list) { const s = new Set(list.map(x => String(x).toLowerCase())); let i = 1; while (s.has((base + i).toLowerCase())) i++; return base + i; }

/* ===================== Bausteine ===================== */
const SEC_L = { Input: 'Input', Output: 'Output', InOut: 'InOut', Static: 'Static', Temp: 'Temp' };
function blockView(b) {
  const r = reg();
  const langSel = b.type !== 'DB' ? `<label class="lsel">Sprache <select ${B(v => changeBlockLang(b, v))}>${['LAD', 'FBD', 'SCL', 'STL'].map(l => `<option value="${l}" ${b.lang === l ? 'selected' : ''} ${l === 'STL' && isS71200(P.cpu) ? 'disabled' : ''}>${LANG_L[l]}</option>`).join('')}</select></label>` : '';
  const head = `<div class="edh"><div><h2><span class="bt ${b.type}">${b.type}</span> ${esc(b.name)} <small>[${b.type}${b.number ?? ''}]</small></h2>
    <div class="sub">${b.type === 'DB' ? (b.instanceOf ? 'Instanz-DB von „' + esc(b.instanceOf) + '“' : 'Global-DB') : (b.type === 'OB' ? ((b.number | 0) === 100 ? 'Anlauf (Startup)' : 'Programmzyklus') : b.type === 'FB' ? 'Funktionsbaustein mit Gedächtnis (Instanz)' : 'Funktion ohne Gedächtnis') + ' · ' + LANG_LONG[b.lang]}</div></div>
    <div class="acts">${langSel}${b.lang && b.lang !== 'SCL' ? `<button ${A(() => showGenScl(b))}>SCL anzeigen</button>` : ''}<button ${A(() => propsDlg(b))}>Eigenschaften</button><button class="danger" ${A(() => delBlockDlg(b))}>Löschen</button></div></div>`;
  if (b.type === 'DB') {
    if (b.instanceOf) { const t = canonType(b.instanceOf, r); const vars = IEC[t] ? Object.entries({ ...IEC[t].ins, ...IEC[t].outs }).map(([n, ty]) => ({ name: n, type: ty })) : ifaceVars(r.blocks.get(t.toLowerCase()) || {}, ['Input', 'Output', 'InOut', 'Static']).map(v => ({ ...v }));
      return head + `<p class="hint">Die Struktur eines Instanz-DB wird von „${esc(t)}“ vorgegeben. Werte hier beobachten, steuern in der Beobachtungstabelle.</p>
      <div class="tw"><table class="grid"><thead><tr><th>Name</th><th>Datentyp</th><th class="live">Beobachtungswert</th></tr></thead><tbody>${vars.map(v => { const ct = canonType(v.type, r);
        const ex = typeKind(ct, r) === 'iec' ? `"${b.name}".${v.name}.Q` : `"${b.name}".${v.name}`; return `<tr><td class="mono">${esc(v.name)}</td><td class="mono">${esc(v.type)}</td><td class="live mono" data-ev="${esc(ex)}" ${typeKind(ct, r) === 'iec' ? 'data-pre="Q="' : ''}></td></tr>`; }).join('')}</tbody></table></div>`; }
    return head + ifaceHtml(b, true);
  }
  let body = '';
  if (b.lang === 'SCL') body = sclHtml(b); else if (b.lang === 'STL') body = awlHtml(b); else body = graphicHtml(b);
  return head + ifaceHtml(b) + body;
}
function changeBlockLang(b, to) {
  if (to === b.lang) return;
  const before = JSON.stringify(b); const r = convertBlock(b, to, P);
  if (!r.ok) { Object.assign(b, JSON.parse(before)); renderEditor(); modal(`<h3>Umwandlung nicht möglich</h3><p>${esc(b.name)}: ${esc(r.msg)}</p><p class="hint small">Der Baustein bleibt in ${LANG_L[b.lang]}. Alternativ einen neuen Baustein in ${LANG_L[to]} anlegen.</p>`, [['OK', closeModal, 'pri']]); return; }
  ui.nsel = null; touch({ nav: true }); toast(`${b.name} nach ${LANG_L[to]} umgewandelt`, 'ok');
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
function allVarNames(b) { const o = []; for (const s of SECTIONS[b.type] || []) for (const v of (b.iface && b.iface[s]) || []) o.push(v.name); return o; }
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
  const re = /(\/\/[^\n]*|\(\*[\s\S]*?\*\)|\/\*[\s\S]*?\*\/)|("[^"\n]*")|('[^'\n]*')|(#[A-Za-z_]\w*)|(%[A-Z]+[\d.]+)|\b((?:T|TIME)#[-\w.]+|\d+#[\w]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) { out += esc(code.slice(last, m.index)); last = re.lastIndex; const t = m[0];
    if (m[1]) out += `<i class="c">${esc(t)}</i>`; else if (m[2] || m[5]) out += `<i class="g">${esc(t)}</i>`; else if (m[3]) out += `<i class="s">${esc(t)}</i>`;
    else if (m[4]) out += `<i class="l">${esc(t)}</i>`; else if (m[6]) out += `<i class="n">${esc(t)}</i>`;
    else { const u = t.toUpperCase(); out += KW.has(u) ? `<i class="k">${t}</i>` : KW2.has(u) || /_TO_/.test(u) ? `<i class="f">${t}</i>` : esc(t); } }
  return out + esc(code.slice(last)) + '\n';
}
const SNIP = [['IF', 'IF  THEN\n   \nEND_IF;'], ['CASE', 'CASE  OF\n   1:\n      ;\n   ELSE\n      ;\nEND_CASE;'], ['FOR', 'FOR #i := 1 TO 10 DO\n   \nEND_FOR;'], [':=', ' := '], [';', ';'], ['""', '""'], ['#', '#'], ['AND', ' AND '], ['OR', ' OR '], ['NOT', 'NOT '], ['//', '// ']];
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
    ta.addEventListener('focus', () => { ui.lastTa = ta; });
    ta.addEventListener('input', () => { b.scl = ta.value; upd(); ui.dirty = true; save(); renderTop(); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('   ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      else if (e.key === 'Enter') { const s = ta.selectionStart; const ls = ta.value.lastIndexOf('\n', s - 1) + 1; const line = ta.value.slice(ls, s); let ind = line.match(/^\s*/)[0];
        if (/\b(THEN|DO|ELSE|OF|REPEAT)\s*$/i.test(line) || /^\s*\d+(\.\.\d+)?\s*:\s*$/.test(line)) ind += '   ';
        e.preventDefault(); ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
    if (ui.gotoLine) { const l = ui.gotoLine; ui.gotoLine = null; setTimeout(() => gotoLine(l), 30); }
  }
  if (b.lang === 'STL') wireAwl(b);
  if (ui.gotoNet != null) { const n = ui.gotoNet; ui.gotoNet = null; setTimeout(() => { const el = document.getElementById('net-' + n); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); } }, 30); }
}
function gotoLine(l) { const ta = $('#ta'); if (!ta) return; const lines = ta.value.split('\n'); let p = 0; for (let i = 0; i < l - 1 && i < lines.length; i++) p += lines[i].length + 1;
  ta.focus({ preventScroll: true }); ta.setSelectionRange(p, p + (lines[l - 1] || '').length);
  const box = $('#sclbox'); const lh = parseFloat(getComputedStyle(box).lineHeight) || 20; box.scrollTop = Math.max(0, (l - 4) * lh); }
function insertSnip(s) { const ta = $('#ta'); if (!ta) return; ta.focus(); const st = ta.selectionStart; ta.setRangeText(s, st, ta.selectionEnd, 'end');
  const ip = s.search(/ {2}THEN| {2}OF| {2}DO|""/); if (ip >= 0) { const off = s.startsWith('""') ? 1 : ip + 1; ta.setSelectionRange(st + off, st + off); }
  ta.dispatchEvent(new Event('input')); }
function showGenScl(b) { let g; try { g = b.lang === 'STL' ? null : blockGen(b, reg()); } catch (e) { g = null; }
  if (b.lang === 'STL') { try { const tmp = JSON.parse(JSON.stringify(b)); const r = convertBlock(tmp, 'SCL', P); if (!r.ok) throw new Error(r.msg); g = { text: tmp.scl }; } catch (e) { modal(`<h3>${esc(b.name)}</h3><p>Dieser AWL-Baustein lässt sich nicht als SCL darstellen: ${esc(e.message)}</p>`, [['Schließen', closeModal]]); return; } }
  modal(`<h3>${esc(b.name)} – entsprechender SCL-Code</h3><p class="hint">So wird der ${LANG_L[b.lang]}-Baustein übersetzt und ausgeführt.</p><pre class="srcpre">${hl(g ? g.text : '')}</pre>`, [['Schließen', closeModal]]); }

/* ===================== Beobachtung & Simulation ===================== */
function watchView() {
  P.watch = P.watch || [];
  const din = P.tags.filter(t => normType(t.type) === 'Bool' && areaOf(t) === 'I');
  const ain = P.tags.filter(t => normType(t.type) !== 'Bool' && areaOf(t) === 'I');
  const dout = P.tags.filter(t => normType(t.type) === 'Bool' && areaOf(t) === 'Q');
  const rows = P.watch.map((w, i) => `<tr><td><input class="mono" list="oplist" value="${esc(w.expr)}" ${B(v => { w.expr = v.trim(); save(); renderEditor(); })}></td>
    <td class="live mono" data-ev="${esc(w.expr)}"></td>
    <td><input class="mono" value="${esc(w.ctrl)}" placeholder="TRUE / 42 / T#2s" ${B(v => { w.ctrl = v.trim(); save(); })}></td>
    <td><button class="mini" ${A(() => writeExpr(w.expr, w.ctrl))}>Steuern</button></td>
    <td><button class="x" ${A(() => { P.watch.splice(i, 1); save(); renderEditor(); })}>✕</button></td></tr>`).join('');
  return `<div class="edh"><div><h2>Beobachtung &amp; Simulation</h2><div class="sub">Eingänge der simulierten CPU betätigen, Ausgänge und Variablen beobachten, Werte steuern.</div></div></div>
  ${!plc.prog ? `<div class="banner">Noch kein Programm in der CPU. <button class="pri" ${A(doRun)}>⇩ Laden &amp; RUN</button></div>` : ''}
  <div class="panel"><div class="ph2">Digitale Eingänge <label class="sw"><input type="checkbox" ${ui.tast ? 'checked' : ''} ${B(v => { ui.tast = v; renderEditor(); })}> Taster-Modus (gedrückt halten)</label></div>
    <div class="chips">${din.map(t => `<button class="chip" data-eb="&quot;${esc(t.name)}&quot;" ${ui.tast ? `data-tast="${esc(t.name)}"` : A(() => writeTag(t.name, !plc.G[t.name]))}><b>${esc(t.name)}</b><small>${esc(t.addr)}</small></button>`).join('') || '<span class="hint small">Keine Bool-Variablen mit %I-Adresse.</span>'}</div>
    ${ain.length ? `<div class="ph2">Analoge Eingänge</div>${ain.map(t => `<div class="ana"><b>${esc(t.name)}</b><small>${esc(t.addr)}</small><input type="range" min="0" max="${/Real/.test(normType(t.type)) ? 100 : 27648}" value="${plc.G[t.name] || 0}" data-ana="${esc(t.name)}"><span class="mono live" data-ev="&quot;${esc(t.name)}&quot;"></span></div>`).join('')}` : ''}
    <div class="ph2">Digitale Ausgänge</div><div class="chips">${dout.map(t => `<div class="chip out" data-eb="&quot;${esc(t.name)}&quot;"><b>${esc(t.name)}</b><small>${esc(t.addr)}</small></div>`).join('') || '<span class="hint small">Keine Bool-Variablen mit %Q-Adresse.</span>'}</div></div>
  <div class="panel"><div class="ph2">Beobachtungstabelle <span class="sp"></span><button class="mini" ${A(() => { P.watch.push({ expr: '', ctrl: '' }); save(); renderEditor(); })}>＋ Zeile</button><button class="mini" ${A(() => { let n = 0; for (const w of P.watch) if (w.ctrl && writeExpr(w.expr, w.ctrl)) n++; if (n) toast(n + ' Werte gesteuert', 'ok'); })}>Alle steuern</button></div>
  <div class="tw"><table class="grid"><thead><tr><th>Operand</th><th class="live">Beobachtungswert</th><th>Steuerwert</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function diagView() {
  return `<div class="edh"><div><h2>Online &amp; Diagnose</h2><div class="sub">Simulierte CPU · ${esc(P.cpu || '')}</div></div></div>
  <div class="panel cpup"><div class="cpubig ${plc.state}"><span class="led"></span>${plc.state}</div>
    <div class="cpub"><button class="run" ${A(doRun)}>▶ RUN</button><button class="stop" ${A(doStop)}>■ STOP</button><button ${A(() => { plc.memReset(P); renderEditor(); toast('Urlöschen durchgeführt', 'ok'); })}>MRES Urlöschen</button></div>
    <table class="kv"><tr><td>Zykluszeit aktuell</td><td class="mono" data-cyc="last"></td></tr><tr><td>Zykluszeit min.</td><td class="mono" data-cyc="min"></td></tr><tr><td>Zykluszeit max.</td><td class="mono" data-cyc="max"></td></tr></table></div>
  <div class="panel"><div class="ph2">Diagnosepuffer</div><div class="tw"><table class="grid"><thead><tr><th>Zeit</th><th>Ereignis</th></tr></thead><tbody>${plc.diag.map(d => `<tr class="${d.lvl}"><td class="mono">${d.t.toLocaleTimeString('de-DE')}</td><td>${esc(d.msg)}</td></tr>`).join('') || '<tr><td colspan="2" class="hint">Keine Einträge</td></tr>'}</tbody></table></div></div>`;
}
function srcView() {
  let src = '', awl = ''; try { src = genSource(P, 'scl'); awl = genSource(P, 'awl'); } catch (e) { src = '// Fehler beim Erzeugen: ' + e.message; }
  return `<div class="edh"><div><h2>Externe Quellen &amp; Projektdatei</h2><div class="sub">Austausch mit dem TIA Portal über externe Quellen (.scl / .awl) und Sicherung des ganzen Projekts.</div></div></div>
  <div class="panel"><div class="ph2">SCL-Quelle (SCL-, KOP- und FUP-Bausteine, DBs) <span class="sp"></span>${DESK ? `<button class="mini" ${A(() => exportSrcFile('scl'))}>Als .scl speichern…</button>` : ''}<button class="mini" ${A(() => copyText(src))}>Kopieren</button></div>
    <p class="hint small">Im TIA Portal: Projektnavigation → Externe Quellen → Neue externe Datei hinzufügen → „Bausteine aus Quelle generieren“. Die PLC-Variablen müssen dort mit gleichem Namen existieren. KOP/FUP-Bausteine werden als SCL exportiert.</p>
    <pre class="srcpre">${hl(src)}</pre></div>
  ${awl ? `<div class="panel"><div class="ph2">AWL-Quelle (AWL-Bausteine, nur S7-1500) <span class="sp"></span>${DESK ? `<button class="mini" ${A(() => exportSrcFile('awl'))}>Als .awl speichern…</button>` : ''}<button class="mini" ${A(() => copyText(awl))}>Kopieren</button></div><pre class="srcpre">${esc(awl)}</pre></div>` : ''}
  <div class="panel"><div class="ph2">Externe Quelle importieren${DESK ? `<span class="sp"></span><button class="mini" ${A(importSrcFileDesk)}>Datei öffnen…</button>` : ''}</div>
    <p class="hint small">SCL- oder AWL-Quelltext einfügen oder Datei wählen. Bausteine mit gleichem Namen werden ersetzt.</p>
    <input type="file" accept=".scl,.awl,.txt" id="srcfile"><textarea id="srcin" class="mono imp" placeholder="FUNCTION_BLOCK &quot;FB_Beispiel&quot; …"></textarea>
    <button class="pri" ${A(importSrc)}>Bausteine aus Quelle generieren</button></div>`;
}
function emptyProject(lang = 'LAD', name = 'Neues Projekt', cpu = 'CPU 1516-3 PN/DP') {
  const main = { name: 'Main', type: 'OB', number: 1, lang, iface: { Temp: [] } };
  if (lang === 'SCL') main.scl = '// Zyklisches Hauptprogramm\n'; else main.networks = [newNet(lang)];
  return { name, cpu, version: 2, lang, mnemonic: 'DE', tags: [], blocks: [main], watch: [] };
}
function setProject(np) { if (plc.state === 'RUN') plc.stop('Projektwechsel'); P = migrateProject(np); prog = null; plc.prog = null; ui.msgs = []; ui.dirty = true; ui.nsel = null; evalCache.clear(); save(); select('block', (P.blocks.find(b => b.type === 'OB') || P.blocks[0] || {}).name); }
async function readFileInput(id) { const f = $(id) && $(id).files[0]; return f ? await f.text() : null; }
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
function copyText(t) { try { navigator.clipboard.writeText(t).then(() => toast('In die Zwischenablage kopiert', 'ok'), () => toast('Kopieren nicht erlaubt – Text markieren und manuell kopieren', 'warn')); } catch (e) { toast('Kopieren nicht möglich', 'warn'); } }

/* ===================== Dialoge ===================== */
function modal(html, buttons, cls = '') { const m = $('#modal'); m.innerHTML = `<div class="mbox ${cls}">${html}<div class="mbtn">${buttons.map(([l, fn, c, id]) => `<button class="${c || ''}" ${id ? `id="${id}"` : ''} ${A(fn)}>${l}</button>`).join('')}</div></div>`; m.className = 'on'; const f = m.querySelector('input:not([type=radio]):not([type=checkbox]):not([type=file])'); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { $('#modal').className = ''; $('#modal').innerHTML = ''; }
function confirmDlg(text, fn) { modal(`<h3>Bestätigen</h3><p>${esc(text)}</p>`, [['Abbrechen', closeModal], ['OK', () => { closeModal(); fn(); }, 'pri']]); }
const LANG_CARDS = [['LAD', 'KOP', 'Kontaktplan', 'Grafisch wie ein Stromlaufplan: Kontakte, Spulen und Boxen.'], ['FBD', 'FUP', 'Funktionsplan', 'Grafisch mit Logikboxen (&, >=1) wie in der Digitaltechnik.'],
  ['SCL', 'SCL', 'Structured Control Language', 'Textuell, angelehnt an Pascal – ideal für Berechnungen und Abläufe.'], ['STL', 'AWL', 'Anweisungsliste', 'Maschinennah mit VKE und Akkus – nur S7-300/400/1500.']];
function langCards(name, cur, cpu) { return `<div class="lcards">${LANG_CARDS.map(([l, s, t, d]) => { const dis = l === 'STL' && isS71200(cpu); return `<label class="lcard ${dis ? 'dis' : ''}"><input type="radio" name="${name}" value="${l}" ${cur === l ? 'checked' : ''} ${dis ? 'disabled' : ''}><span><b>${s}</b><em>${t}</em><small>${dis ? 'Von S7-1200 nicht unterstützt' : d}</small></span></label>`; }).join('')}</div>`; }
function newProjectDlg() {
  modal(`<h3>Neues Projekt erstellen</h3>
    <label class="fl">Projektname<input id="npName" value="${esc(uniqName('Projekt_', []))}"></label>
    <label class="fl">CPU<select id="npCpu">${CPUS.map(c => `<option ${c === 'CPU 1516-3 PN/DP' ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="fl">Programmiersprache des Projekts <small>(Pflichtauswahl – neue Bausteine werden in dieser Sprache angelegt)</small></div>
    <div id="npL">${langCards('npLang', null, 'CPU 1516-3 PN/DP')}</div>`,
    [['Abbrechen', closeModal], ['Projekt erstellen', () => { const l = document.querySelector('input[name=npLang]:checked'); if (!l) { toast('Bitte zuerst eine Programmiersprache wählen', 'warn'); return; }
      const name = $('#npName').value.trim() || 'Neues Projekt', cpu = $('#npCpu').value; closeModal(); if (DESK) { filePath = null; rememberPath(); }
      setProject(emptyProject(l.value, name, cpu)); if (DESK) setFileDirty(false); toast(`Projekt „${name}“ in ${LANG_L[l.value]} erstellt`, 'ok'); }, 'pri', 'npOk']], 'wide');
  const upd = () => { const ok = !!document.querySelector('input[name=npLang]:checked'); $('#npOk').disabled = !ok; };
  $('#npCpu').addEventListener('change', () => { const cur = (document.querySelector('input[name=npLang]:checked') || {}).value; $('#npL').innerHTML = langCards('npLang', cur === 'STL' && isS71200($('#npCpu').value) ? null : cur, $('#npCpu').value); hook(); upd(); });
  const hook = () => document.querySelectorAll('input[name=npLang]').forEach(r => r.addEventListener('change', upd)); hook(); upd();
}
function exampleDlg() {
  modal(`<h3>Beispielprojekt „Pumpstation“</h3><p class="hint small">Füllstandsregelung mit Pumpe, Rückmeldeüberwachung, Analogwert-Skalierung und Störmeldungen. Wähle die Sprache, in der das Beispiel angezeigt werden soll. SCL-Bausteine bleiben in SCL.</p>
    <label class="lcard mixed"><input type="radio" name="exLang" value="MIX" checked><span><b>Gemischt</b><em>Original</em><small>KOP, FUP, SCL und AWL nebeneinander – zum Vergleichen.</small></span></label>
    ${langCards('exLang', null, P.cpu)}`, [['Abbrechen', closeModal], ['Laden', () => { const v = document.querySelector('input[name=exLang]:checked').value; closeModal();
      const np = exampleProject(); let rep = null; if (v !== 'MIX') rep = convertProject(np, v); if (DESK) { filePath = null; rememberPath(); }
      setProject(np); if (DESK) setFileDirty(false); if (rep) showReport(rep, v, 'Beispielprojekt geladen'); else toast('Beispielprojekt geladen', 'ok'); }, 'pri']], 'wide');
}
function langDlg() {
  modal(`<h3>Programmiersprache des Projekts</h3><p class="hint small">Aktuell: <b>${LANG_LONG[P.lang]}</b>. Neue Bausteine werden in der Projektsprache angelegt.</p>
    ${langCards('plLang', P.lang, P.cpu)}
    <label class="chk"><input type="checkbox" id="plConv" checked> Vorhandene Bausteine umwandeln</label>
    <p class="hint small">KOP ↔ FUP ist immer möglich, KOP/FUP → AWL und → SCL ebenfalls. AWL → KOP/FUP nur bei darstellbaren Netzwerken. SCL lässt sich nicht automatisch in andere Sprachen umwandeln – solche Bausteine bleiben unverändert.</p>`,
    [['Abbrechen', closeModal], ['Übernehmen', () => { const v = document.querySelector('input[name=plLang]:checked').value; const conv = $('#plConv').checked; closeModal();
      if (conv) { const rep = convertProject(P, v); ui.nsel = null; touch({ nav: true }); showReport(rep, v, 'Projektsprache geändert'); } else { P.lang = v; touch(); toast('Projektsprache: ' + LANG_L[v], 'ok'); } }, 'pri']], 'wide');
}
function showReport(rep, to, title) {
  const ok = rep.filter(r => r.ok && !r.same), same = rep.filter(r => r.same), bad = rep.filter(r => !r.ok);
  modal(`<h3>${esc(title)}</h3><p>Projektsprache: <b>${LANG_LONG[to]}</b></p>
    <table class="rep">${ok.map(r => `<tr><td class="ok">✔</td><td>${esc(r.name)}</td><td>${LANG_L[r.from]} → ${LANG_L[to]}</td></tr>`).join('')}${same.map(r => `<tr><td class="ok">✔</td><td>${esc(r.name)}</td><td>bereits ${LANG_L[to]}</td></tr>`).join('')}${bad.map(r => `<tr><td class="warn">⚠</td><td>${esc(r.name)}</td><td>bleibt ${LANG_L[r.from]} – ${esc(r.msg)}</td></tr>`).join('')}</table>`, [['OK', closeModal, 'pri']], 'wide');
}
function openProjectDlg() {
  if (DESK) return fileOpen();
  modal(`<h3>Projekt öffnen</h3><p class="hint small">Eine gesicherte Projektdatei (.spsw / .json) wählen oder den Projekttext einfügen.</p>
    <input type="file" accept=".spsw,.json" id="jsonfile"><textarea id="jsonin" class="mono imp" placeholder="{ &quot;name&quot;: … }"></textarea>`,
    [['Abbrechen', closeModal], ['Öffnen', async () => { const txt = (await readFileInput('#jsonfile')) || $('#jsonin').value; let np;
      try { np = JSON.parse(txt); if (!Array.isArray(np.tags) || !Array.isArray(np.blocks)) throw new Error('Kein gültiges Projekt'); } catch (e) { toast('Projektdatei ungültig: ' + e.message, 'err'); return; }
      closeModal(); setProject(np); toast('Projekt geöffnet', 'ok'); }, 'pri']]);
}
function exportProjectDlg() {
  const txt = JSON.stringify(P, null, 1);
  modal(`<h3>Projekt sichern</h3><p class="hint small">Das Projekt wird automatisch in diesem Browser gespeichert. Zum Sichern oder Übertragen den Text kopieren und als <b>.spsw</b>-Datei speichern – die Desktop-App öffnet ihn direkt.</p><textarea class="mono imp" readonly>${esc(txt)}</textarea>`,
    [['Schließen', closeModal], ['Kopieren', () => copyText(txt), 'pri']]);
}
function projPropsDlg() {
  modal(`<h3>Projekteigenschaften</h3><label class="fl">Projektname<input id="ppName" value="${esc(P.name)}"></label>
    <label class="fl">CPU<select id="ppCpu">${CPUS.map(c => `<option ${c === P.cpu ? 'selected' : ''}>${c}</option>`).join('')}${CPUS.includes(P.cpu) ? '' : `<option selected>${esc(P.cpu)}</option>`}</select></label>`,
    [['Abbrechen', closeModal], ['OK', () => { const cpu = $('#ppCpu').value; if (isS71200(cpu) && P.blocks.some(b => b.lang === 'STL')) { toast('Das Projekt enthält AWL-Bausteine – S7-1200 unterstützt kein AWL', 'err'); return; }
      P.name = $('#ppName').value.trim() || P.name; P.cpu = cpu; closeModal(); touch({ nav: true }); }, 'pri']]);
}
function addBlockDlg() {
  ui.navOpen = false; renderNav();
  const fbs = P.blocks.filter(b => b.type === 'FB').map(b => b.name);
  modal(`<h3>Neuen Baustein hinzufügen</h3>
   <div class="seg" id="nbType">${[['OB', 'Organisationsbaustein'], ['FB', 'Funktionsbaustein'], ['FC', 'Funktion'], ['DB', 'Datenbaustein']].map(([t, l]) => `<label><input type="radio" name="nbt" value="${t}" ${t === 'FB' ? 'checked' : ''}><span><b>${t}</b>${l}</span></label>`).join('')}</div>
   <label class="fl">Name<input id="nbName" class="mono" value="${uniqName('Baustein_', P.blocks.map(b => b.name))}"></label>
   <label class="fl" id="nbLangL">Sprache<select id="nbLang">${['LAD', 'FBD', 'SCL', 'STL'].map(l => `<option value="${l}" ${l === P.lang ? 'selected' : ''} ${l === 'STL' && isS71200(P.cpu) ? 'disabled' : ''}>${LANG_LONG[l]}</option>`).join('')}</select></label>
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
    if (lang === 'SCL') b.scl = t === 'OB' ? '// Zyklisches Programm\n' : '// ' + name + '\n'; else b.networks = [newNet(lang)]; }
  P.blocks.push(b); closeModal(); touch({ nav: true }); select('block', name);
}
function propsDlg(b) {
  modal(`<h3>Eigenschaften ${b.type} „${esc(b.name)}“</h3><label class="fl">Name<input id="pName" class="mono" value="${esc(b.name)}"></label><label class="fl">Nummer<input id="pNum" type="number" min="1" value="${b.number ?? ''}"></label>
    ${b.type === 'OB' ? '<p class="hint small">OB1 und OB ≥ 123 laufen zyklisch, OB100 einmal beim Anlauf (STOP → RUN).</p>' : ''}`,
    [['Abbrechen', closeModal], ['OK', () => { const n = $('#pName').value.trim(), num = parseInt($('#pNum').value, 10);
      if (!/^[A-Za-z_][\w]*$/.test(n)) { toast('Ungültiger Name', 'err'); return; }
      if (n.toLowerCase() !== b.name.toLowerCase() && [...P.blocks.map(x => x.name), ...P.tags.map(t => t.name)].some(x => x.toLowerCase() === n.toLowerCase())) { toast('Name ist bereits vergeben', 'err'); return; }
      if (num && P.blocks.some(x => x !== b && x.type === b.type && (x.number | 0) === num)) { toast(`${b.type}${num} existiert bereits`, 'err'); return; }
      const old = b.name; b.name = n; if (num) b.number = num; renameRefs(old, n); closeModal(); ui.sel.name = n; touch({ nav: true }); }, 'pri']]);
}
function delBlockDlg(b) { confirmDlg(`Baustein „${b.name}“ löschen?`, () => { P.blocks.splice(P.blocks.indexOf(b), 1); touch({ nav: true }); select('tags'); }); }
function startDlg() {
  modal(`<div class="welcome"><span class="logo big"></span><h3>Willkommen in der SPS-Werkbank</h3><p class="hint">Programmieren lernen wie im TIA Portal: KOP, FUP, SCL und AWL mit simulierter CPU.</p></div>
    <div class="startbtns"><button class="pri" ${A(() => { closeModal(); newProjectDlg(); })}><b>Neues Projekt erstellen</b><small>Sprache wählen und loslegen</small></button>
    <button ${A(() => { closeModal(); openProjectDlg(); })}><b>Projekt öffnen</b><small>Gesicherte .spsw-Datei laden</small></button>
    <button ${A(() => { closeModal(); exampleDlg(); })}><b>Beispielprojekt</b><small>Pumpstation in der Sprache deiner Wahl</small></button></div>`, [['Später', closeModal]], 'wide');
}

/* ===================== Desktop-Integration (Electron) ===================== */
var DESK = typeof window !== 'undefined' && window.desktop ? window.desktop : null;
var filePath = null, fileDirty = false;
const PROJ_FILTER = [{ name: 'SPS-Werkbank-Projekt', extensions: ['spsw', 'json'] }];
function setFileDirty(d) { fileDirty = d; if (DESK) { DESK.setDirty(d); updateTitle(); } }
function updateTitle() { if (DESK) DESK.setTitle(`${fileDirty ? '● ' : ''}${filePath ? filePath.split(/[\\/]/).pop() : P.name} – SPS-Werkbank`); }
function rememberPath() { try { if (filePath) localStorage.setItem(LS_KEY + '-pfad', filePath); else localStorage.removeItem(LS_KEY + '-pfad'); } catch (e) {} }
function guardDirty(fn) {
  if (!DESK || !fileDirty) return fn();
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
async function exportSrcFile(kind = 'scl') {
  let src; try { src = genSource(P, kind); } catch (e) { toast('Quelle konnte nicht erzeugt werden: ' + e.message, 'err'); return; }
  const r = await DESK.saveFile({ title: 'Externe Quelle exportieren', content: src, defaultName: (P.name || 'Projekt').replace(/[\\/:*?"<>|]/g, '_') + '.' + kind, filters: [{ name: kind === 'awl' ? 'AWL-Quelle' : 'SCL-Quelle', extensions: [kind] }] });
  if (r) toast('Quelle gespeichert: ' + r.path, 'ok');
}
async function importSrcFileDesk() { const r = await DESK.openFile({ title: 'Externe Quelle importieren', filters: [{ name: 'Externe Quelle', extensions: ['scl', 'awl', 'txt'] }] }); if (r) importSrcText(r.content); }
async function aboutDlg() { const i = DESK ? await DESK.appInfo() : {}; modal(`<h3>SPS-Werkbank</h3><p>${i.version ? 'Version ' + esc(i.version) + ' · ' + esc(i.platform) : 'Web-Version'}</p><p class="hint small">Programmierumgebung für KOP, FUP, SCL und AWL mit simulierter CPU, Anweisungsbibliothek nach dem Vorbild der TIA-Basisanweisungen und Austausch über externe Quellen. Kein Produkt der Siemens AG; „TIA Portal“ und „SIMATIC“ sind Marken der Siemens AG.</p>`, [['OK', closeModal, 'pri']]); }
if (DESK) {
  document.body.classList.add('desktop');
  try { filePath = localStorage.getItem(LS_KEY + '-pfad'); } catch (e) {}
  DESK.onMenu(cmd => {
    const go = { new: () => guardDirty(newProjectDlg), open: () => guardDirty(() => fileOpen()), save: () => fileSave(false), saveAs: () => fileSave(true),
      exportScl: () => exportSrcFile('scl'), exportAwl: () => exportSrcFile('awl'), importScl: importSrcFileDesk, compile: () => doCompile(), load: doLoad, run: doRun, stop: doStop,
      example: () => guardDirty(exampleDlg), lang: langDlg, tags: () => select('tags'), watch: () => select('watch'), diag: () => select('diag'), src: () => select('src'), about: aboutDlg }[cmd];
    if (go) go();
  });
  DESK.onOpenPath(p => guardDirty(() => fileOpen(p)));
  DESK.onAskClose(() => guardDirty(() => DESK.closeNow()));
  setFileDirty(false);
}

/* ===================== Start ===================== */
document.getElementById('scrim').addEventListener('click', () => { ui.navOpen = false; ui.libOpen = false; renderNav(); renderLib(); });
if (!P.blocks.some(b => b.name === ui.sel.name)) ui.sel = { k: 'block', name: (P.blocks.find(b => b.type === 'OB') || P.blocks[0] || {}).name };
renderEditor();
if (firstStart) setTimeout(startDlg, 200);
