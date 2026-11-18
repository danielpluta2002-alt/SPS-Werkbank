/* =====================================================================
   Grafische Editoren (KOP/FUP), AWL-Editor und Anweisungsbibliothek
   ===================================================================== */
const ROW = 30, CW = 6.6;
const tw = s => Math.ceil(String(s ?? '').length * CW);
let EDITS = [];
const and_ = (p, x) => p === 'TRUE' ? x : x === 'TRUE' ? p : `${par(p)} AND ${par(x)}`;
const ev = (ctx, ex) => ex ? `data-eb="${esc(ex)}" data-sc="${ctx.sc}"` : '';
const GSYM_T = { AND: '&', OR: '>=1', XOR: 'X' };
const COIL_T = { OPEN: '…', '=': '=', '/=': '/=', S: 'S', R: 'R', 'P=': 'P=', 'N=': 'N=', JMP: 'JMP', JMPN: 'JMPN', RET: 'RET' };
const COIL_LAD = { OPEN: '?', '=': '', '/=': '/', S: 'S', R: 'R', 'P=': 'P', 'N=': 'N', JMP: 'JMP', JMPN: 'JMPN', RET: 'RET' };

/* ---------- Auswahl ---------- */
function isSel(ctx, path, kind = 'in') { const s = ui.nsel; return !!s && s.b === ctx.b.name && s.ni === ctx.ni && s.ri === ctx.ri && s.kind === kind && s.path.join('/') === path.join('/'); }
function selA(ctx, path, kind = 'in') { return A(() => { ui.nsel = { b: ctx.b.name, ni: ctx.ni, ri: ctx.ri, path, kind }; renderEditor(); }); }
function ctxRoot(ctx) { return ctx.b.networks[ctx.ni].roots[ctx.ri]; }

/* ---------- Operandentext (inline editierbar) ---------- */
function opText(ctx, text, set, o = {}) {
  const t = String(text ?? '').trim(); const shown = t || (o.ph || '<???>');
  const w = Math.max(o.minw || 36, tw(trunc(shown, 30)) + 10);
  const id = EDITS.push({ get: () => t, set, ph: o.ph || '', sel: o.sel ? { b: ctx.b.name, ni: ctx.ni, ri: ctx.ri, path: o.sel, kind: 'in' } : null, ro: !!o.ro }) - 1;
  const showVal = t && o.live !== false && !/^(TRUE|FALSE|-?\d|T#|TIME#|'|16#|2#|#__)/i.test(t);
  return { w, h: ROW, oy: 15, draw: (x, y) => {
    const anc = o.anchor || 'end'; const ax = anc === 'start' ? x + 4 : anc === 'middle' ? x + w / 2 : x + w - 4;
    return `<text x="${ax}" y="${y + 19}" text-anchor="${anc}" class="op ${t ? '' : (o.ph === '...' ? 'opt' : 'ph')} ${o.ro ? 'ro' : ''}" data-ed="${id}">${esc(trunc(shown, 30))}</text>`
      + (showVal ? `<text x="${ax}" y="${y + 6}" text-anchor="${anc}" class="mv" data-ev="${esc(t)}" data-sc="${ctx.sc}"></text>` : ''); } };
}

/* ---------- Generische Box (FUP-Boxen, Gatter, KOP-Boxen) ---------- */
function layoutBox(ctx, sp) {
  const HDR = sp.sub ? 32 : 20;
  const aboveH = sp.above ? 24 : 0, belowH = sp.below ? 22 : 0;
  const srcW = Math.max(0, ...sp.left.map(r => r.src ? r.src.w : 0));
  const WIRE = sp.left.length ? 22 : 0;
  const lw = Math.max(0, ...sp.left.map(r => tw(r.label))), rw = Math.max(0, ...sp.right.map(r => tw(r.label)));
  const boxW = Math.max(sp.minW || 46, tw(sp.title) + 16, sp.sub ? tw(sp.sub) + 16 : 0, lw + rw + 22, sp.above ? 0 : 0);
  const opW = Math.max(0, ...sp.right.map(r => r.op ? r.op.w : 0));
  const RW = sp.right.some(r => r.op) ? 22 + opW : (sp.isNode ? 14 : 0);
  const aboveExtra = sp.above ? Math.max(0, (sp.above.w - boxW) / 2) : 0;
  const first = aboveH + HDR + ROW / 2; let cur = 0, prev = -1e9; const rows = [];
  sp.left.forEach((r, i) => { const s = r.src || { h: ROW, oy: ROW / 2 }; const wy = Math.max(i === 0 ? first : prev + ROW, cur + s.oy); rows.push({ wy, top: wy - s.oy }); cur = wy - s.oy + s.h + 2; prev = wy; });
  const wy0 = rows.length ? rows[0].wy : first;
  const rrows = sp.right.map((r, j) => wy0 + j * ROW);
  const boxTop = wy0 - ROW / 2 - HDR;
  const lastY = Math.max(rows.length ? rows[rows.length - 1].wy : wy0, rrows.length ? rrows[rrows.length - 1] : wy0);
  const boxBot = lastY + ROW / 2;
  const h = Math.max(cur, boxBot + belowH) + 4;
  const bx = Math.max(srcW + WIRE, aboveExtra), w = Math.max(bx + boxW + RW, bx + boxW / 2 + (sp.above ? sp.above.w / 2 : 0));
  const mainR = sp.right.findIndex(r => r.main); const oy = mainR >= 0 ? rrows[mainR] : wy0;
  return { w, h, oy, wy: oy, draw: (x, y) => {
    let s = `<rect x="${x + bx}" y="${y + boxTop}" width="${boxW}" height="${boxBot - boxTop}" class="bx ${sp.cls || ''} ${sp.isSel ? 'sel' : ''}" rx="2" ${ev(ctx, sp.boxEx)} ${sp.selfSel || ''}/>`;
    rows.forEach((rr, i) => { const r = sp.left[i]; const yy = y + rr.wy;
      if (r.src) s += r.src.draw(x + bx - WIRE - r.src.w, y + rr.top);
      const x1 = r.power ? x : x + bx - WIRE, x2 = x + bx;
      if (WIRE || r.power) s += `<line x1="${x1}" y1="${yy}" x2="${x2 - (r.neg ? 8 : 0)}" y2="${yy}" class="w" ${ev(ctx, r.wireEx)}/>` + (r.neg ? `<circle cx="${x2 - 4}" cy="${yy}" r="4" class="neg"/>` : '');
      if (r.selAttr) s += `<rect x="${x2 - WIRE}" y="${yy - 8}" width="${WIRE}" height="16" class="hit ${r.isSel ? 'selw' : ''}" ${r.selAttr}/>`;
      if (r.label) s += `<text x="${x + bx + 4}" y="${yy + 4}" class="pl">${esc(r.label)}</text>`; });
    s += `<text x="${x + bx + boxW / 2}" y="${y + boxTop + 14}" text-anchor="middle" class="btl">${esc(sp.title)}</text>`;
    if (sp.sub) s += `<text x="${x + bx + boxW / 2}" y="${y + boxTop + 27}" text-anchor="middle" class="bsub">${esc(sp.sub)}</text>`;
    if (sp.above) s += sp.above.draw(x + bx + boxW / 2 - sp.above.w / 2, y + boxTop - 24);
    if (sp.below) s += sp.below.draw(x + bx + boxW / 2 - sp.below.w / 2, y + boxBot - 2);
    sp.right.forEach((r, j) => { const yy = y + rrows[j]; const xr = x + bx + boxW;
      if (r.label) s += `<text x="${xr - 4}" y="${yy + 4}" text-anchor="end" class="pl">${esc(r.label)}</text>`;
      if (r.op) { s += `<line x1="${xr}" y1="${yy}" x2="${xr + 22}" y2="${yy}" class="w" ${ev(ctx, r.ex)}/>` + r.op.draw(xr + 22, yy - 15); }
      else if (r.main && sp.isNode) s += `<line x1="${xr}" y1="${yy}" x2="${x + w}" y2="${yy}" class="w" ${ev(ctx, sp.boxEx)}/>`; });
    return s; } };
}
function logicRow(ctx, inp, path, label, o = {}) {
  return { label, src: o.lad ? ladPinSrc(ctx, inp, path, o) : fIn(ctx, inp, path, o), wireEx: inp && inp.n ? (ctx.disp.get(inp) || null) : (o.en ? 'TRUE' : null), neg: !!(inp && inp.neg), selAttr: selA(ctx, path), isSel: isSel(ctx, path) };
}

/* ---------- FUP ---------- */
function fIn(ctx, inp, path, o = {}) {
  const n = inp && inp.n;
  if (!n) { if (o.en) return { w: 0, h: ROW, oy: ROW / 2, draw: () => '' };
    return opText(ctx, '', v => { const I = getInput(ctxRoot(ctx), path); if (I && v) { I.n = { t: 'OP', op: v }; touch(); } }, { ph: o.opt ? '...' : '<???>', sel: path }); }
  if (n.t === 'OP') return opText(ctx, n.op, v => { n.op = v; touch(); }, { sel: path });
  if (n.t === 'BOX') return fBox(ctx, n, path, true);
  return fGate(ctx, n, path);
}
function fGate(ctx, n, path) {
  return layoutBox(ctx, { title: GSYM_T[n.t], left: n.ins.map((i, k) => logicRow(ctx, i, [...path, k], '')), right: [{ label: '', main: true }], boxEx: ctx.disp.get(n), selfSel: selA(ctx, path), isSel: isSel(ctx, path), isNode: true, minW: 40 });
}
function boxSub(d, box) { if (d.kind === 'iec') return d.iec && d.iec.startsWith('T') ? 'Time' : d.iec && d.iec.startsWith('CT') ? 'Int' : ''; if (box.i === 'CONVERT') return `${box.dtype || '?'} to ${box.dtype2 || '?'}`; if (d.dt2) return `${box.dtype || '?'} to ${box.dtype2 || '?'}`; return d.dt ? (box.dtype || '???') : ''; }
function boxTitle(d, box, lang) { if (d.kind === 'fn' && d.sym) return lang === 'LAD' ? d.sym : `CMP ${d.sym}`; const nm = typeof d.name === 'object' ? d.name[lang] || d.name.FBD : d.name; return nm; }
function fBox(ctx, box, path, isNode, lad) {
  const r = reg(); const d = getDef(box, r); const { ins, outs } = boxPins(d, box); const lang = lad ? 'LAD' : 'FBD';
  const left = []; const mainPin = ins.find(q => q.main);
  for (const q of ins) {
    if (lad && lad.mainAsPower && q === mainPin) { left.push({ label: q.en ? 'EN' : q.n, power: true, wireEx: lad.power, src: null }); continue; }
    if (isLogicPin(q)) left.push(logicRow(ctx, box.pins[q.n], [...path, q.n], q.n, { en: q.en, opt: q.opt, lad: !!lad }));
    else left.push({ label: q.n, src: opText(ctx, box.pins[q.n], v => { box.pins[q.n] = v; touch(); }, { ph: q.opt ? '...' : '<???>' }) });
  }
  const right = [];
  for (const q of outs) {
    if (q.main && isNode) { right.push({ label: q.hidden ? '' : q.n, main: true }); continue; }
    if (q.hidden) continue;
    right.push({ label: q.n, main: q.main, ex: q.main ? ctx.disp.get(box) : null, op: opText(ctx, (box.outs || {})[q.n], v => { box.outs = box.outs || {}; box.outs[q.n] = v; touch(); }, { ph: q.opt || q.main ? '...' : '<???>', anchor: 'start' }) });
  }
  let above = null, below = null;
  if (d.kind === 'iec' || (d.fb)) above = opText(ctx, box.inst, v => { box.inst = v; touch(); }, { anchor: 'middle', ph: '<???>' });
  if (d.kind === 'ff' || d.kind === 'edge') above = opText(ctx, box.op, v => { box.op = v; touch(); }, { anchor: 'middle' });
  if (d.kind === 'edge' || d.kind === 'trig') below = opText(ctx, box.mem, v => { box.mem = v; touch(); }, { anchor: 'middle', ph: '<???>' });
  const selfSel = isNode ? selA(ctx, path) : selA(ctx, [], 'root');
  return layoutBox(ctx, { title: boxTitle(d, box, lang), sub: boxSub(d, box), above, below, left, right, boxEx: ctx.disp.get(box), selfSel, isSel: isNode ? isSel(ctx, path) : isSel(ctx, [], 'root'), isNode, cls: d.missing ? 'bad' : '', minW: 56 });
}
function fRoot(ctx, r) {
  if (r.k === 'BOX') return fBox(ctx, r.box, [], false);
  const above = r.k === 'RET' || r.k === 'OPEN' ? null : (r.k === 'JMP' || r.k === 'JMPN') ? opText(ctx, r.label, v => { r.label = v; touch(); }, { anchor: 'middle', live: false }) : opText(ctx, r.op, v => { r.op = v; touch(); }, { anchor: 'middle' });
  const below = r.k === 'P=' || r.k === 'N=' ? opText(ctx, r.mem, v => { r.mem = v; touch(); }, { anchor: 'middle' }) : null;
  return layoutBox(ctx, { title: COIL_T[r.k], cls: r.k === 'OPEN' ? 'open' : '', above, below, left: [logicRow(ctx, r.in, [], '')], right: [], boxEx: r.k === 'OPEN' ? null : ctx.disp.get(r), selfSel: selA(ctx, [], 'root'), isSel: isSel(ctx, [], 'root'), minW: 40 });
}

/* ---------- KOP ---------- */
function series(Ls) {
  const wy = Math.max(...Ls.map(L => L.wy)); let w = 0, h = 0;
  for (const L of Ls) { h = Math.max(h, wy - L.wy + L.h); w += L.w; }
  return { w, h, wy, oy: wy, draw: (x, y) => { let s = '', xx = x; for (const L of Ls) { s += L.draw(xx, y + wy - L.wy); xx += L.w; } return s; } };
}
function wireL(ctx, w, ex) { return { w, h: 40, wy: 20, draw: (x, y) => `<line x1="${x}" y1="${y + 20}" x2="${x + w}" y2="${y + 20}" class="w" ${ev(ctx, ex)}/>` }; }
function parallel(ctx, Ls, pin, outs) {
  const W = Math.max(...Ls.map(L => L.w)) + 16; const offs = []; let h = 0;
  for (const L of Ls) { offs.push(h); h += L.h + 2; }
  const wy = Ls[0].wy;
  return { w: W, h, wy, draw: (x, y) => { let s = '';
    const last = offs[offs.length - 1] + Ls[Ls.length - 1].wy;
    s += `<line x1="${x + 4}" y1="${y + wy}" x2="${x + 4}" y2="${y + last}" class="w" ${ev(ctx, pin)}/>`;
    Ls.forEach((L, i) => { const yy = y + offs[i] + L.wy;
      s += `<line x1="${x}" y1="${y + wy}" x2="${x + 4}" y2="${y + wy}" class="w" ${ev(ctx, pin)}/>`;
      s += `<line x1="${x + 4}" y1="${yy}" x2="${x + 8}" y2="${yy}" class="w" ${ev(ctx, pin)}/>`;
      s += L.draw(x + 8, y + offs[i]);
      s += `<line x1="${x + 8 + L.w}" y1="${yy}" x2="${x + W - 4}" y2="${yy}" class="w" ${ev(ctx, outs[i])}/>`; });
    s += `<line x1="${x + W - 4}" y1="${y + wy}" x2="${x + W - 4}" y2="${y + last}" class="w" ${ev(ctx, '(' + outs.join(' OR ') + ')')}/>`;
    s += `<line x1="${x + W - 4}" y1="${y + wy}" x2="${x + W}" y2="${y + wy}" class="w" ${ev(ctx, '(' + outs.join(' OR ') + ')')}/>`;
    return s; } };
}
function contactL(ctx, inp, path, pin, out, kind, extra) {
  const cmp = kind === 'cmp'; const w = cmp ? 100 : 84; const wy = 36; const cx = w / 2; const hw = cmp ? 16 : 9;
  const n = inp.n; const sel = isSel(ctx, path);
  let top, bot = null, mid = '', sub = '';
  if (kind === 'cmp') { const d = INS[n.i]; top = opText(ctx, n.pins.IN1, v => { n.pins.IN1 = v; touch(); }, { anchor: 'middle' }); bot = opText(ctx, n.pins.IN2, v => { n.pins.IN2 = v; touch(); }, { anchor: 'middle' }); mid = d.sym; sub = n.dtype || ''; }
  else if (kind === 'edge') { top = opText(ctx, n.op, v => { n.op = v; touch(); }, { anchor: 'middle' }); bot = opText(ctx, n.mem, v => { n.mem = v; touch(); }, { anchor: 'middle' }); mid = INS[n.i].neg ? 'N' : 'P'; }
  else if (kind === 'not') { top = null; mid = 'NOT'; }
  else top = opText(ctx, n.op, v => { n.op = v; touch(); }, { anchor: 'middle', sel: path, live: false });
  const W = Math.max(w, top ? top.w : 0, bot ? bot.w : 0), c = W / 2;
  const h = bot ? (cmp ? 96 : 84) : 58;
  return { w: W, h, wy, draw: (x, y) => { const X = x + c, Y = y + wy; let s = '';
    if (sel) s += `<rect x="${X - hw - 8}" y="${Y - 17}" width="${2 * hw + 16}" height="34" rx="4" class="selr"/>`;
    s += `<line x1="${x}" y1="${Y}" x2="${X - hw}" y2="${Y}" class="w" ${ev(ctx, pin)}/><line x1="${X + hw}" y1="${Y}" x2="${x + W}" y2="${Y}" class="w" ${ev(ctx, out)}/>`;
    s += `<g class="sym" ${ev(ctx, out)}><line x1="${X - hw}" y1="${Y - 13}" x2="${X - hw}" y2="${Y + 13}"/><line x1="${X + hw}" y1="${Y - 13}" x2="${X + hw}" y2="${Y + 13}"/>${!kind && inp.neg ? `<line x1="${X - 6}" y1="${Y + 10}" x2="${X + 6}" y2="${Y - 10}"/>` : ''}</g>`;
    if (mid) s += `<text x="${X}" y="${Y + 4}" text-anchor="middle" class="sl">${esc(mid)}</text>`;
    if (sub) s += `<text x="${X}" y="${Y + 26}" text-anchor="middle" class="bsub">${esc(sub)}</text>`;
    if (top) s += top.draw(X - top.w / 2, y - 3);
    if (bot) s += bot.draw(X - bot.w / 2, Y + (cmp ? 28 : 12));
    s += `<rect x="${X - hw - 6}" y="${Y - 15}" width="${2 * hw + 12}" height="30" class="hit" ${selA(ctx, path)}/>`;
    return s; } };
}
function coilL(ctx, r, P) {
  const w = 90, wy = 36, sel = isSel(ctx, [], 'root');
  const top = r.k === 'RET' || r.k === 'OPEN' ? null : (r.k === 'JMP' || r.k === 'JMPN') ? opText(ctx, r.label, v => { r.label = v; touch(); }, { anchor: 'middle', live: false }) : opText(ctx, r.op, v => { r.op = v; touch(); }, { anchor: 'middle', live: false });
  const bot = r.k === 'P=' || r.k === 'N=' ? opText(ctx, r.mem, v => { r.mem = v; touch(); }, { anchor: 'middle' }) : null;
  const W = Math.max(w, top ? top.w : 0, bot ? bot.w : 0); const c = W / 2; const L = COIL_LAD[r.k]; const big = L.length > 1; const open = r.k === 'OPEN';
  return { w: W, h: bot ? 84 : 58, wy, draw: (x, y) => { const X = x + c, Y = y + wy; const hw = big ? 20 : 11; let s = '';
    if (sel) s += `<rect x="${X - hw - 8}" y="${Y - 17}" width="${2 * hw + 16}" height="34" rx="4" class="selr"/>`;
    s += `<line x1="${x}" y1="${Y}" x2="${X - hw}" y2="${Y}" class="w" ${ev(ctx, P)}/>`;
    s += `<g class="sym ${open ? 'openc' : ''}" ${open ? '' : ev(ctx, P)}><path d="M${X - hw + 5} ${Y - 13} Q${X - hw - 3} ${Y} ${X - hw + 5} ${Y + 13}"/><path d="M${X + hw - 5} ${Y - 13} Q${X + hw + 3} ${Y} ${X + hw - 5} ${Y + 13}"/></g>`;
    if (L) s += `<text x="${X}" y="${Y + 4}" text-anchor="middle" class="sl">${esc(L)}</text>`;
    if (top) s += top.draw(X - top.w / 2, y - 3); if (bot) s += bot.draw(X - bot.w / 2, Y + 12);
    s += `<rect x="${X - hw - 6}" y="${Y - 15}" width="${2 * hw + 12}" height="30" class="hit" ${selA(ctx, [], 'root')}/>`;
    return s; } };
}
function ladPinSrc(ctx, inp, path, o) { // Nebeneingänge von KOP-Boxen: Operand oder Ausdruck als Text
  const n = inp && inp.n;
  if (!n || n.t === 'OP') return fIn(ctx, inp, path, o);
  return opText(ctx, ctx.disp.get(inp) || '(…)', () => toast('Komplexe Verschaltung – in FUP bearbeiten oder Eingang löschen', 'warn'), { ro: true, live: false });
}
function lIn(ctx, inp, path, pin, top) {
  if (!inp || !inp.n) return { L: wireL(ctx, 26, pin), out: pin };
  const n = inp.n, ex = ctx.disp.get(inp) || 'FALSE';
  if (n.t === 'OP') { const out = and_(pin, ex); return { L: contactL(ctx, inp, path, pin, out), out }; }
  if (inp.neg) { const inner = lNode(ctx, n, path, pin, top, ctx.disp.get(n)); const out = and_(pin, ex);
    return { L: series([inner.L, contactL(ctx, { neg: false, n: {} }, path, inner.out, out, 'not')]), out }; }
  return lNode(ctx, n, path, pin, top, ex);
}
function lNode(ctx, n, path, pin, top, ex) {
  if (n.t === 'AND') { let p = pin; const Ls = []; n.ins.forEach((c, k) => { const r = lIn(ctx, c, [...path, k], p, top && k === 0); Ls.push(r.L); p = r.out; }); return { L: series(Ls), out: p }; }
  if (n.t === 'OR') { const br = n.ins.map((c, k) => lIn(ctx, c, [...path, k], pin, false)); return { L: parallel(ctx, br.map(b => b.L), pin, br.map(b => b.out)), out: '(' + br.map(b => b.out).join(' OR ') + ')' }; }
  if (n.t === 'XOR') { const out = and_(pin, ex || 'FALSE'); return { L: series([wireL(ctx, 10, pin), fGate(ctx, n, path)]), out }; }
  if (n.t === 'BOX') {
    const d = getDef(n, reg()); const out0 = ctx.disp.get(n) || 'FALSE';
    if (d && d.kind === 'fn' && d.sym) { const out = and_(pin, out0); return { L: contactL(ctx, { neg: false, n }, path, pin, out, 'cmp'), out }; }
    if (d && d.kind === 'edge') { const out = and_(pin, out0); return { L: contactL(ctx, { neg: false, n }, path, pin, out, 'edge'), out }; }
    const m = d && mainIn(d, n);
    if (!m) { const out = and_(pin, out0); const bl = fBox(ctx, n, path, true, { mainAsPower: false }); bl.wy = bl.oy; return { L: series([wireL(ctx, 10, pin), bl]), out }; }
    if (top) { const r1 = lIn(ctx, n.pins[m.n], [...path, m.n], pin, true); const bl = fBox(ctx, n, path, true, { mainAsPower: true, power: r1.out }); bl.wy = bl.oy; return { L: series([r1.L, bl]), out: out0 }; }
    const bl = fBox(ctx, n, path, true, {}); bl.wy = bl.oy; return { L: series([wireL(ctx, 10, pin), bl]), out: and_(pin, out0) };
  }
  return { L: wireL(ctx, 20, pin), out: pin };
}
function lRoot(ctx, r) {
  if (r.k === 'BOX') { const d = getDef(r.box, reg()); const m = d && mainIn(d, r.box);
    if (m && isLogicPin(m)) { const r1 = lIn(ctx, r.box.pins[m.n], [m.n], 'TRUE', true); const bl = fBox(ctx, r.box, [], false, { mainAsPower: true, power: r1.out }); bl.wy = bl.oy; return series([r1.L, bl]); }
    const bl = fBox(ctx, r.box, [], false, {}); bl.wy = bl.oy; return bl; }
  const r1 = lIn(ctx, r.in, [], 'TRUE', true); return series([r1.L, wireL(ctx, 12, r1.out), coilL(ctx, r, ctx.disp.get(r) || r1.out)]);
}

/* ---------- Netzwerk zeichnen ---------- */
function netSvg(b, ni, net, lang, disp) {
  const parts = []; let y = 6, W = 200;
  const roots = net.roots || [];
  roots.forEach((r, ri) => {
    const ctx = { b, ni, ri, lang, sc: esc(b.name.toLowerCase()), disp };
    const L = lang === 'LAD' ? lRoot(ctx, r) : fRoot(ctx, r);
    const x = lang === 'LAD' ? 10 : 8; if (L.wy === undefined) L.wy = L.oy;
    parts.push({ L, x, y }); W = Math.max(W, x + L.w + 16); y += L.h + 14;
  });
  const Hh = Math.max(y, 48);
  let s = '';
  if (lang === 'LAD') s += `<line x1="10" y1="0" x2="10" y2="${Hh}" class="rail"/>`;
  for (const p of parts) { if (lang === 'LAD') s += `<line x1="8" y1="${p.y + p.L.wy}" x2="${p.x}" y2="${p.y + p.L.wy}" class="w on"/>`; s += p.L.draw(p.x, p.y); }
  if (!roots.length) s += `<text x="${lang === 'LAD' ? 24 : 10}" y="28" class="emptyt">Leeres Netzwerk – Anweisung aus der Bibliothek wählen oder hierher ziehen</text>`;
  return `<svg class="nsvg ${lang}" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${s}</svg>`;
}

/* ---------- Bearbeiten (Einfügen, Löschen, Negieren) ---------- */
function selInfo(b) { const s = ui.nsel; if (!s || s.b !== b.name || !b.networks[s.ni]) return null; const net = b.networks[s.ni]; return { s, net, root: s.ri >= 0 ? net.roots[s.ri] : null }; }
function startPath(root) { if (root.k !== 'BOX') return []; const d = getDef(root.box, reg()); const m = d && mainIn(d, root.box); return m && isLogicPin(m) ? [m.n] : null; }
function targetOf(si) {
  const { s, root } = si; if (!root) return null;
  if (s.kind === 'root') { const sp = startPath(root); if (!sp) return null; if (root.k === 'BOX' && !root.box.pins[sp[0]]) root.box.pins[sp[0]] = { neg: false, n: null }; return { I: getInput(root, sp), path: sp, atRoot: true }; }
  const I = getInput(root, s.path); return I ? { I, path: s.path } : null;
}
function parentOf(root, path) { if (!path.length || typeof path[path.length - 1] !== 'number') return null; return getInput(root, path.slice(0, -1)); }
const emptyLeaf = I => !I.n || (I.n.t === 'OP' && !String(I.n.op || '').trim());
function insGate(root, t, G, node) { // node in Verknüpfung G (AND = Reihe, OR = parallel) nach dem Ziel einfügen
  const I = t.I;
  if (t.atRoot || !parentOf(root, t.path) || parentOf(root, t.path).n.t !== G || parentOf(root, t.path).neg) {
    if (emptyLeaf(I) && node.n.t !== 'OP') { I.n = node.n; I.neg = node.neg; return t.path; }
    if (!I.n) { I.n = node.n; I.neg = node.neg; return t.path; }
    if (I.n.t === G && !I.neg && t.atRoot) { I.n.ins.push(node); return [...t.path, I.n.ins.length - 1]; }
    I.n = { t: G, ins: [{ neg: I.neg, n: I.n }, node] }; I.neg = false; return [...t.path, 1];
  }
  const par_ = parentOf(root, t.path), k = t.path[t.path.length - 1]; par_.n.ins.splice(k + 1, 0, node); return [...t.path.slice(0, -1), k + 1];
}
function insBoxLad(root, t, box, mainName) {
  const sp = startPath(root); const R0 = sp && getInput(root, sp);
  if (!R0 || t.atRoot || t.path.length < sp.length || t.path.slice(0, sp.length).join('/') !== sp.join('/')) { const I = t.I; box.pins[mainName] = { neg: I.neg, n: I.n }; I.n = box; I.neg = false; return t.path; }
  const rel = t.path.slice(sp.length);
  if (R0.n && R0.n.t === 'AND' && !R0.neg && rel.length) { const k = rel[0]; const pre = R0.n.ins.slice(0, k + 1);
    box.pins[mainName] = pre.length === 1 ? pre[0] : { neg: false, n: { t: 'AND', ins: pre } };
    R0.n.ins = [{ neg: false, n: box }, ...R0.n.ins.slice(k + 1)]; if (R0.n.ins.length === 1) { R0.n = box; return sp; } return [...sp, 0]; }
  box.pins[mainName] = { neg: R0.neg, n: R0.n }; R0.n = box; R0.neg = false; return sp;
}
function makeBox(b, id) {
  if (id.startsWith('CALL:')) { const nm = id.slice(5); const blk = reg().blocks.get(nm.toLowerCase()); const box = { t: 'BOX', i: 'CALL', blk: blk.name, pins: { EN: { neg: false, n: null } }, outs: {} };
    for (const v of ifaceVars(blk, ['Input'])) box.pins[v.name] = normType(v.type) === 'Bool' ? (blk.type === 'FB' ? { neg: false, n: null } : leaf('')) : '';
    for (const v of ifaceVars(blk, ['InOut'])) box.pins[v.name] = '';
    if (blk.type === 'FB') box.inst = autoInstance(b, blk.name); return box; }
  const d = INS[id]; const box = newBox(id);
  if (d.kind === 'iec') box.inst = autoInstance(b, d.iec);
  return box;
}
function libInsert(b, id) {
  if (b.lang === 'SCL' || b.lang === 'STL') return textInsert(b, id);
  const lang = b.lang; const d = id.startsWith('CALL:') ? { kind: 'call' } : INS[id]; if (!d) return;
  if (d.kind === 'label') { const s = ui.nsel && ui.nsel.b === b.name ? ui.nsel.ni : b.networks.length - 1; const net = b.networks[Math.max(0, s)]; if (!net) return; net.label = net.label || uniqName('M', b.networks.map(n => n.label || '')); touch(); toast('Sprungmarke „' + net.label + '“ im Netzwerkkopf gesetzt', 'ok'); return; }
  if (!b.networks.length) b.networks.push(newNet(lang));
  let si = selInfo(b); if (!si) { ui.nsel = { b: b.name, ni: b.networks.length - 1, ri: -1, path: [], kind: 'net' }; si = selInfo(b); }
  const net = si.net; const newSel = (ri, path, kind = 'in') => { ui.nsel = { b: b.name, ni: si.s.ni, ri, path, kind }; };
  const t = targetOf(si);
  if (d.kind === 'coil') {
    if (si.root && si.root.k !== 'BOX' && (si.s.kind === 'root' || si.root.k === 'OPEN')) { si.root.k = d.k; if (d.k !== 'JMP' && d.k !== 'JMPN' && d.k !== 'RET' && si.root.op === undefined) si.root.op = ''; newSel(si.s.ri, [], 'root'); if ((d.k === 'P=' || d.k === 'N=') && si.root.mem === undefined) si.root.mem = ''; if (d.k === 'JMP' || d.k === 'JMPN') si.root.label = si.root.label || ''; return touch(); }
    const src = si.root && si.root.k !== 'BOX' && !JSON.stringify(si.root.in).includes('"BOX"') ? JSON.parse(JSON.stringify(si.root.in)) : leaf('');
    const r = { k: d.k, op: '', in: src }; if (d.k === 'P=' || d.k === 'N=') r.mem = ''; if (d.k === 'JMP' || d.k === 'JMPN') { r.label = ''; delete r.op; } if (d.k === 'RET') delete r.op;
    net.roots.push(r); newSel(net.roots.length - 1, [], 'root'); return touch();
  }
  if (!t) { // neues Netzwerkelement
    let r;
    if (d.kind === 'contact') r = { k: 'OPEN', in: { neg: !!d.neg, n: { t: 'OP', op: '' } } };
    else if (d.kind === 'gate') r = { k: 'OPEN', in: { neg: false, n: { t: id, ins: [leaf(''), leaf('')] } } };
    else if (d.kind === 'branch') r = { k: 'OPEN', in: { neg: false, n: { t: 'OR', ins: [leaf(''), leaf('')] } } };
    else if (d.kind === 'not') { toast('Zuerst ein Element markieren', 'warn'); return; }
    else { const box = makeBox(b, id); const dd = getDef(box, reg()); const m = mainIn(dd, box);
      if (dd.kind === 'fn' || dd.kind === 'edge') r = { k: 'OPEN', in: { neg: false, n: box } };
      else { if (m && isLogicPin(m) && !m.en) box.pins[m.n] = leaf(''); r = { k: 'BOX', box }; } }
    net.roots.push(r); newSel(net.roots.length - 1, [], r.k === 'BOX' ? 'root' : 'in'); return touch();
  }
  const root = si.root; let p = null;
  switch (d.kind) {
    case 'contact': p = insGate(root, t, 'AND', { neg: !!d.neg, n: { t: 'OP', op: '' } }); break;
    case 'branch': p = insGate(root, t, 'OR', leaf('')); break;
    case 'not': t.I.neg = !t.I.neg; return touch();
    case 'gate': { const I = t.I; if (I.n && I.n.t === id && !I.neg) { I.n.ins.push(leaf('')); p = [...t.path, I.n.ins.length - 1]; } else if (emptyLeaf(I)) { I.n = { t: id, ins: [leaf(''), leaf('')] }; p = [...t.path, 0]; } else { I.n = { t: id, ins: [{ neg: I.neg, n: I.n }, leaf('')] }; I.neg = false; p = [...t.path, 1]; } break; }
    default: {
      const box = makeBox(b, id); const dd = getDef(box, reg()); const m = mainIn(dd, box);
      if (dd.kind === 'fn' || dd.kind === 'edge' || !m || !isLogicPin(m)) { p = lang === 'LAD' ? insGate(root, t, 'AND', { neg: false, n: box }) : (emptyLeaf(t.I) ? (t.I.n = box, t.I.neg = false, t.path) : insGate(root, t, 'AND', { neg: false, n: box })); }
      else if (lang === 'LAD') p = insBoxLad(root, t, box, m.n);
      else { const I = t.I; box.pins[m.n] = { neg: I.neg, n: I.n }; I.n = box; I.neg = false; p = t.path; }
    }
  }
  if (p) newSel(si.s.ri, p);
  if (root.k === 'OPEN' && root.in && root.in.n && root.in.n.t === 'BOX' && !root.in.neg) { const dd = getDef(root.in.n, reg()); if (dd && !['fn', 'edge', 'trig'].includes(dd.kind) && dd.kind !== 'ff') { net.roots[si.s.ri] = { k: 'BOX', box: root.in.n }; newSel(si.s.ri, [], 'root'); } }
  touch();
}
function netDelete(b) {
  const si = selInfo(b); if (!si || !si.root) return; const { s, net, root } = si;
  if (s.kind === 'root') {
    if (root.k !== 'BOX' && root.in && root.in.n && root.in.n.t === 'BOX' && !root.in.neg) net.roots[s.ri] = { k: 'BOX', box: root.in.n };
    else if (root.k === 'BOX') { const sp = startPath(root); const mi = sp && root.box.pins[sp[0]]; if (mi && mi.n && mi.n.t === 'BOX') net.roots[s.ri] = { k: 'BOX', box: mi.n }; else net.roots.splice(s.ri, 1); }
    else net.roots.splice(s.ri, 1);
    ui.nsel = null; return touch(); }
  const I = getInput(root, s.path); if (!I) return;
  if (I.n && I.n.t === 'BOX') { const d = getDef(I.n, reg()); const m = mainIn(d, I.n); const mi = m && I.n.pins[m.n];
    if (mi && mi.n && isLogicPin(m)) { I.neg = I.neg !== !!mi.neg; I.n = mi.n; return touch(); } }
  const par_ = parentOf(root, s.path);
  if (par_ && par_.n.ins.length > 2) { par_.n.ins.splice(s.path[s.path.length - 1], 1); ui.nsel = null; return touch(); }
  if (par_ && par_.n.ins.length === 2) { const other = par_.n.ins[1 - s.path[s.path.length - 1]]; par_.neg = par_.neg !== other.neg; par_.n = other.n; ui.nsel = { ...s, path: s.path.slice(0, -1) }; return touch(); }
  const last = s.path[s.path.length - 1];
  if (typeof last === 'string') { const box = getInput(root, s.path.slice(0, -1)); const bx = s.path.length === 1 && root.k === 'BOX' ? root.box : box && box.n; const d = bx && getDef(bx, reg()); const q = d && boxPins(d, bx).ins.find(x => x.n === last);
    I.n = q && (q.en || q.opt) ? null : { t: 'OP', op: '' }; I.neg = false; return touch(); }
  I.n = { t: 'OP', op: '' }; I.neg = false; touch();
}
function netNegate(b) { const si = selInfo(b); if (!si) return toast('Zuerst ein Element markieren', 'warn'); const t = targetOf(si); if (!t) return; t.I.neg = !t.I.neg; touch(); }

/* ---------- Eigenschaften des markierten Elements ---------- */
function propField(label, val, set, o = {}) { return `<label>${esc(label)}${o.type ? ` <small>${esc(o.type)}</small>` : ''}<input class="mono" list="oplist" value="${esc(val)}" placeholder="${esc(o.ph || '')}" ${B(v => set(v.trim()))}></label>`; }
function netProps(b) {
  const si = selInfo(b); if (!si || !si.root) return '';
  const { s, root } = si; const T = (fn) => v => { fn(v); touch(); };
  let html = '', title = '';
  if (s.kind === 'root' && root.k !== 'BOX') {
    const d = Object.values(INS).find(x => x.kind === 'coil' && x.k === root.k); title = root.k === 'OPEN' ? 'Offener Strompfad – Spule, Zuweisung oder Box aus der Bibliothek wählen' : d ? d.title : root.k;
    if (root.op !== undefined) html += propField('Operand', root.op, T(v => root.op = v));
    if (root.mem !== undefined) html += propField('Flankenmerker', root.mem, T(v => root.mem = v));
    if (root.label !== undefined) html += propField('Sprungmarke', root.label, T(v => root.label = v));
  } else {
    const bx = s.kind === 'root' ? root.box : (getInput(root, s.path) || {}).n; const I = s.kind === 'root' ? null : getInput(root, s.path);
    if (!bx) return '';
    if (bx.t === 'OP') { title = I.neg ? 'Öffner / negierter Operand' : 'Operand'; html += propField('Operand', bx.op, T(v => bx.op = v)) + `<label class="chk"><input type="checkbox" ${I.neg ? 'checked' : ''} ${B(v => { I.neg = v; touch(); })}> negiert</label>`; }
    else if (bx.t !== 'BOX') { title = { AND: 'UND-Verknüpfung', OR: 'ODER-Verknüpfung', XOR: 'EXKLUSIV-ODER' }[bx.t];
      html += `<label>Eingänge<span class="row"><button class="mini" ${A(() => { if (bx.ins.length > 2) { bx.ins.pop(); touch(); } })}>−</button><b class="cnt">${bx.ins.length}</b><button class="mini" ${A(() => { bx.ins.push(leaf('')); touch(); })}>＋</button></span></label>`; }
    else {
      const r = reg(); const d = getDef(bx, r); title = (d.title || '') + ' – ' + (typeof d.name === 'object' ? d.name.FBD : d.name);
      if (bx.i === 'CALL') html += `<label>Baustein<select ${B(v => { bx.blk = v; const nb = reg().blocks.get(v.toLowerCase()); if (nb && nb.type === 'FB') bx.inst = autoInstance(b, nb.name); else delete bx.inst; touch({ nav: true }); })}>${P.blocks.filter(x => x.type === 'FB' || x.type === 'FC').map(x => `<option ${x.name === bx.blk ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`;
      if (d.kind === 'iec' || d.fb) html += propField('Instanz', bx.inst, T(v => bx.inst = v), { ph: '"IEC_Timer_0_DB" oder #Instanz' }) + instHelper(b, bx, d.kind === 'iec' ? d.iec : d.block.name);
      if (d.kind === 'ff' || d.kind === 'edge') html += propField('Operand', bx.op, T(v => bx.op = v));
      if (d.kind === 'edge' || d.kind === 'trig') html += propField('Flankenmerker (M_BIT)', bx.mem, T(v => bx.mem = v));
      if (d.dt) html += `<label>Datentyp${d.dt2 ? ' (IN)' : ''}<select ${B(v => { bx.dtype = v; touch(); })}>${d.dt.list.map(t => `<option ${t === bx.dtype ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
      if (d.dt2) html += `<label>Datentyp (OUT)<select ${B(v => { bx.dtype2 = v; touch(); })}>${d.dt2.list.map(t => `<option ${t === bx.dtype2 ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
      const vv = d.varIn || d.varOut; if (vv) html += `<label>${d.varIn ? 'Eingänge' : 'Ausgänge'}<span class="row"><button class="mini" ${A(() => { bx.n = Math.max(vv.min, (bx.n || vv.min) - 1); touch(); })}>−</button><b class="cnt">${bx.n || vv.min}</b><button class="mini" ${A(() => { bx.n = Math.min(vv.max, (bx.n || vv.min) + 1); touch(); })}>＋</button></span></label>`;
      if (bx.i === 'CALCULATE') html += `<label class="wide">Formel (IN1, IN2 … verwenden)<input class="mono" value="${esc(bx.expr)}" ${B(v => { bx.expr = v; touch(); })}></label>`;
      const { ins, outs } = boxPins(d, bx);
      for (const q of ins) { if (q.en) continue; const tt = pinType(q, bx);
        if (isLogicPin(q)) { const pi = bx.pins[q.n]; if (!pi || !pi.n || pi.n.t === 'OP') html += propField(q.n, pi && pi.n ? pi.n.op : '', T(v => { bx.pins[q.n] = v ? { neg: !!(pi && pi.neg), n: { t: 'OP', op: v } } : { neg: false, n: q.opt ? null : { t: 'OP', op: '' } }; }), { type: tt, ph: q.opt ? 'optional' : '' }); }
        else html += propField(q.n, bx.pins[q.n], T(v => bx.pins[q.n] = v), { type: tt, ph: q.opt ? 'optional' : '' }); }
      for (const q of outs) { if (q.hidden || (q.main && s.kind !== 'root')) continue; html += propField(q.n + ' →', (bx.outs || {})[q.n], T(v => { bx.outs = bx.outs || {}; bx.outs[q.n] = v; }), { type: pinType(q, bx), ph: q.opt || q.main ? 'optional' : '' }); }
      if (d.desc) html = `<p class="hint small wide">${esc(d.desc)}</p>` + html;
    }
  }
  return `<div class="props"><div class="ph2">${esc(title)}<span class="sp"></span><button class="mini" ${A(() => netNegate(b))}>Negieren</button><button class="mini danger" ${A(() => netDelete(b))}>Löschen</button></div><div class="pf">${html}</div></div>`;
}
function instHelper(b, bx, type) {
  const v = String(bx.inst || '').trim(); if (!v) return ''; const r = reg();
  const exists = v.startsWith('#') ? allVarNames(b).some(n => n.toLowerCase() === v.slice(1).toLowerCase()) : r.blocks.has(v.replace(/"/g, '').toLowerCase());
  if (exists) return '';
  return `<button class="mini" ${A(() => { if (v.startsWith('#')) { if (b.type !== 'FB') { toast('Multiinstanzen (#…) nur in FBs möglich', 'warn'); return; } (b.iface.Static = b.iface.Static || []).push({ name: v.slice(1), type, init: '', comment: '' }); } else P.blocks.push({ name: v.replace(/"/g, ''), type: 'DB', number: nextNum('DB'), instanceOf: type }); touch({ nav: true }); })}>Instanz „${esc(v)}“ anlegen</button>`;
}
function autoInstance(b, type) {
  const isFb = !IEC[type]; const base = isFb ? type : (type.startsWith('CT') ? 'IEC_Counter' : type.endsWith('TRIG') ? type : 'IEC_Timer');
  if (b.type === 'FB') { const n = uniqName((isFb ? type + '_Instance' : base) + '_', allVarNames(b)); b.iface.Static = b.iface.Static || []; b.iface.Static.push({ name: n, type, init: '', comment: 'Multiinstanz' }); return '#' + n; }
  const names = [...P.blocks.map(x => x.name), ...P.tags.map(t => t.name)].map(x => x.toLowerCase()); let i = 0, n;
  do { n = isFb ? (i ? `${type}_DB_${i}` : `${type}_DB`) : `${base}_${i}_DB`; i++; } while (names.includes(n.toLowerCase()));
  P.blocks.push({ name: n, type: 'DB', number: nextNum('DB'), instanceOf: type }); return '"' + n + '"';
}
function nextNum(type, start = 1) { const used = new Set(P.blocks.filter(b => b.type === type).map(b => b.number | 0)); let n = start; while (used.has(n)) n++; return n; }

/* ---------- Inline-Bearbeitung von Operanden ---------- */
let edBox = null;
function openEdit(el) {
  const id = +el.dataset.ed; const E = EDITS[id]; if (!E) return;
  if (E.sel) ui.nsel = E.sel;
  if (E.ro) { E.set(); return; }
  closeEdit(false);
  const cv = el.closest('.cv'); const r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
  const inp = document.createElement('input'); inp.className = 'opedit mono'; inp.setAttribute('list', 'oplist'); inp.value = E.get(); inp.placeholder = E.ph && E.ph !== '<???>' && E.ph !== '...' ? E.ph : 'Operand';
  const w = Math.max(150, r.width + 30);
  inp.style.left = Math.max(0, (el.getAttribute('text-anchor') === 'end' ? r.right - w : el.getAttribute('text-anchor') === 'middle' ? r.left + r.width / 2 - w / 2 : r.left) - c.left + cv.scrollLeft) + 'px';
  inp.style.top = (r.top - c.top + cv.scrollTop - 5) + 'px'; inp.style.width = w + 'px';
  cv.appendChild(inp); edBox = { inp, E, id }; inp.focus(); inp.select();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeEdit(true); } else if (e.key === 'Escape') { e.preventDefault(); closeEdit(false); renderEditor(); } else if (e.key === 'Tab') { e.preventDefault(); const nid = id + (e.shiftKey ? -1 : 1); closeEdit(true, nid); } });
  inp.addEventListener('blur', () => setTimeout(() => { if (edBox && edBox.inp === inp) closeEdit(true); }, 120));
}
function closeEdit(commit, nextId) {
  if (!edBox) return; const { inp, E } = edBox; edBox = null; const v = inp.value.trim(); inp.remove();
  if (commit && v !== E.get()) E.set(v); else if (commit) renderEditor();
  if (nextId !== undefined) setTimeout(() => { const el = document.querySelector(`[data-ed="${nextId}"]`); if (el) openEdit(el); }, 30);
}
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-ed]'); if (el) { e.stopPropagation(); openEdit(el); } }, true);

/* ---------- KOP/FUP-Bausteinansicht ---------- */
function netHead(b, ni, net) {
  const nets = b.networks; const errs = blockErrors(b).filter(m => m.net === ni);
  return `<div class="neth"><b>Netzwerk ${ni + 1}:</b><input class="ntitle" value="${esc(net.title)}" placeholder="Netzwerktitel" ${B(v => { net.title = v; save(); })}>
    <input class="nlabel mono" value="${esc(net.label || '')}" placeholder="Marke" title="Sprungmarke dieses Netzwerks" ${B(v => { net.label = v.trim() || undefined; touch(); })}>
    <span class="nacts"><button class="mini" title="Nach oben" ${A(() => { if (ni > 0) { [nets[ni - 1], nets[ni]] = [nets[ni], nets[ni - 1]]; ui.nsel = null; touch(); } })}>↑</button><button class="mini" title="Nach unten" ${A(() => { if (ni < nets.length - 1) { [nets[ni + 1], nets[ni]] = [nets[ni], nets[ni + 1]]; ui.nsel = null; touch(); } })}>↓</button><button class="mini" title="Duplizieren" ${A(() => { nets.splice(ni + 1, 0, JSON.parse(JSON.stringify(net))); touch(); })}>⧉</button><button class="mini x" title="Netzwerk löschen" ${A(() => { nets.splice(ni, 1); ui.nsel = null; touch(); })}>✕</button></span></div>
    <input class="ncom" value="${esc(net.comment)}" placeholder="Kommentar" ${B(v => { net.comment = v; save(); })}>
    ${errs.length ? `<div class="nerr">${errs.map(m => `<div class="${m.lvl}">${m.lvl === 'err' ? '✖' : '⚠'} ${m.nline ? 'Zeile ' + m.nline + ': ' : ''}${esc(m.msg)}${quickFix(m, b)}</div>`).join('')}</div>` : ''}`;
}
const FAV = { LAD: ['NO', 'NC', 'BRANCH', 'NOT', '=', 'S', 'R', 'TON', 'MOVE', 'CMP_EQ'], FBD: ['AND', 'OR', 'XOR', 'NEGATE', '=', 'S', 'R', 'TON', 'MOVE', 'CMP_EQ'] };
function favBar(b) {
  return `<div class="tools"><div class="tg"><span>Favoriten</span>${FAV[b.lang].map(id => { const d = INS[id]; const nm = typeof d.name === 'object' ? d.name[b.lang] : d.name;
    return `<button class="tl" title="${esc(d.title)}" draggable="true" data-drag="${id}" ${A(() => libInsert(b, id))}>${esc(nm)}</button>`; }).join('')}</div>
    <div class="tg"><span>Element</span><button class="tl" ${A(() => netNegate(b))} title="Markierten Eingang negieren">¬ Negieren</button><button class="tl" ${A(() => netDelete(b))} title="Markiertes Element löschen (Entf)">✕ Löschen</button>
    <button class="tl" ${A(() => { const si = selInfo(b); const ni = si ? si.s.ni : b.networks.length - 1; if (ni < 0) return; b.networks[ni].roots.push({ k: 'OPEN', in: leaf('') }); ui.nsel = { b: b.name, ni, ri: b.networks[ni].roots.length - 1, path: [], kind: 'in' }; touch(); })} title="Weiteren Ausgang/Strompfad im Netzwerk">＋ Strompfad</button></div></div>`;
}
function graphicHtml(b) {
  const r = reg(); let g; try { g = blockGen(b, r); } catch (e) { console.error(e); g = { disp: [] }; }
  const nets = b.networks.map((net, ni) => {
    const bad = blockErrors(b).some(m => m.net === ni && m.lvl === 'err');
    const selHere = ui.nsel && ui.nsel.b === b.name && ui.nsel.ni === ni;
    return `<div class="net ${bad ? 'bad' : ''} ${selHere ? 'act' : ''}" id="net-${ni}">${netHead(b, ni, net)}
      <div class="cv" data-net="${ni}" ${A((el, e) => { if (e.target.closest('[data-a]') !== el) return; ui.nsel = { b: b.name, ni, ri: -1, path: [], kind: 'net' }; renderEditor(); })}>${netSvg(b, ni, net, b.lang, g.disp[ni] || new Map())}</div>
      ${selHere && ui.nsel.ri >= 0 ? netProps(b) : ''}</div>`; }).join('');
  return `${favBar(b)}<div class="hint small">Element antippen und Anweisung aus der Bibliothek wählen (oder hineinziehen). Operanden durch Antippen bearbeiten, Tab springt zum nächsten.</div>${nets}
    <button class="addnet" ${A(() => { b.networks.push(newNet(b.lang)); ui.nsel = { b: b.name, ni: b.networks.length - 1, ri: -1, path: [], kind: 'net' }; touch(); })}>＋ Netzwerk hinzufügen</button>`;
}

/* ---------- AWL-Editor ---------- */
function hlAwl(code) {
  return String(code).split('\n').map(line => {
    const ci = (() => { let q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"' || c === "'") q = !q; if (!q && c === '/' && line[i + 1] === '/') return i; } return -1; })();
    const body = ci >= 0 ? line.slice(0, ci) : line, com = ci >= 0 ? line.slice(ci) : '';
    let out = ''; const m = /^(\s*)([A-Za-z_]\w*\s*:(?!=))?(\s*)(\S+)?(.*)$/.exec(body);
    if (m) { out += esc(m[1]); if (m[2]) out += `<i class="lb">${esc(m[2])}</i>`; out += esc(m[3]);
      if (m[4]) { const op = m[4].toUpperCase(); const known = AWL_KNOWN.has(MN_TO_INT[op] || op) || /^[A-Za-z_]\w*$/.test(m[4]) && /:=/.test(m[5]); out += `<i class="${known ? 'k' : /:=/.test(m[5]) ? '' : 'bad'}">${esc(m[4])}</i>`; }
      out += (m[5] || '').replace(/("[^"]*")|('[^']*')|(#[A-Za-z_]\w*)|(%[A-Z]+[\d.]+)|\b((?:T|TIME)#[-\w.]+|\d+#\w+|-?\d+(?:\.\d+)?)\b|([^"'#%\w]+|\w+)/gi, (x, q, s, l, a, n) => q ? `<i class="g">${esc(q)}</i>` : s ? `<i class="s">${esc(s)}</i>` : l ? `<i class="l">${esc(l)}</i>` : a ? `<i class="g">${esc(a)}</i>` : n ? `<i class="n">${esc(n)}</i>` : esc(x)); }
    else out = esc(body);
    return out + (com ? `<i class="c">${esc(com)}</i>` : '');
  }).join('\n') + '\n';
}
function awlHtml(b) {
  const lo = b.name.toLowerCase();
  const nets = b.networks.map((net, ni) => {
    const errs = blockErrors(b).filter(m => m.net === ni && m.nline); const lines = String(net.awl || '').split('\n');
    const mon = lines.map((l, i) => `<div class="ml" data-awl="${esc(lo)}|${ni}|${i + 1}"></div>`).join('');
    return `<div class="net ${errs.some(m => m.lvl === 'err') ? 'bad' : ''}" id="net-${ni}">${netHead(b, ni, net)}
      <div class="awl"><div class="gut">${lines.map((l, i) => `<div class="${errs.some(m => m.nline === i + 1) ? 'e' : ''}">${i + 1}</div>`).join('')}</div>
      <div class="code"><div class="errlay">${errs.map(m => `<div class="el ${m.lvl}" style="top:calc(${m.nline - 1} * var(--lh) + 6px)" title="${esc(m.msg)}"></div>`).join('')}</div><pre>${hlAwl(net.awl || '')}</pre><textarea data-awlnet="${ni}" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${esc(net.awl || '')}</textarea></div>
      <div class="mon"><div class="mh">VKE · AKKU 1</div>${mon}</div></div></div>`; }).join('');
  return `<div class="hint small">AWL mit ${P.mnemonic === 'INT' ? 'internationaler' : 'deutscher'} Mnemonik (beide werden verstanden). Im Beobachtungsmodus zeigt die rechte Spalte VKE und AKKU 1 je Zeile.</div>${nets}
    <button class="addnet" ${A(() => { b.networks.push(newNet('STL')); touch(); })}>＋ Netzwerk hinzufügen</button>`;
}
function wireAwl(b) {
  document.querySelectorAll('textarea[data-awlnet]').forEach(ta => {
    const ni = +ta.dataset.awlnet; const pre = ta.previousElementSibling, gut = ta.closest('.awl').querySelector('.gut'), mon = ta.closest('.awl').querySelector('.mon');
    const lo = b.name.toLowerCase();
    const upd = () => { pre.innerHTML = hlAwl(ta.value); const n = ta.value.split('\n').length;
      if (gut.children.length !== n) { gut.innerHTML = Array.from({ length: n }, (_, i) => `<div>${i + 1}</div>`).join(''); mon.innerHTML = '<div class="mh">VKE · AKKU 1</div>' + Array.from({ length: n }, (_, i) => `<div class="ml" data-awl="${esc(lo)}|${ni}|${i + 1}"></div>`).join(''); } };
    ta.addEventListener('focus', () => { ui.lastTa = ta; });
    ta.addEventListener('input', () => { b.networks[ni].awl = ta.value; upd(); ui.dirty = true; save(); renderTop(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('      ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
  });
}
function awlLive() {
  if (!prog) return;
  document.querySelectorAll('[data-awl]').forEach(el => {
    const [lo, ni, line] = el.dataset.awl.split('|'); const cb = prog.code.get(lo); const mon = cb && cb.awl && cb.awl.mon; if (!mon) { el.textContent = ''; return; }
    if (!mon._map) { mon._map = new Map(); mon.instrs.forEach((x, i) => mon._map.set(x.net + ':' + x.line, i)); }
    const i = mon._map.get(ni + ':' + line); if (i === undefined || mon.r[i] === null) { el.innerHTML = ''; return; }
    const stale = mon.seen[i] !== mon.tick; const a1 = mon.a1[i]; const v = typeof a1 === 'number' && !Number.isInteger(a1) ? +a1.toFixed(3) : a1;
    const html = `<span class="vke ${mon.r[i] ? 't' : 'f'}">${mon.r[i] ? 1 : 0}</span><span class="ak">${esc(v)}</span>`;
    if (el.innerHTML !== html) el.innerHTML = html; el.classList.toggle('stale', stale);
  });
}

/* ---------- Anweisungsbibliothek ---------- */
const AWL_LIB = [
  ['bit', 'A', 'UND', 'Fragt den Signalzustand ab und verknüpft ihn mit UND mit dem VKE.', 'A   "Operand"'], ['bit', 'AN', 'UND NICHT', 'Fragt auf Signalzustand 0 ab und verknüpft mit UND.', 'AN  "Operand"'],
  ['bit', 'O', 'ODER', 'Verknüpft den Signalzustand mit ODER. UND wird vor ODER bearbeitet.', 'O   "Operand"'], ['bit', 'ON', 'ODER NICHT', 'Fragt auf Signalzustand 0 ab und verknüpft mit ODER.', 'ON  "Operand"'],
  ['bit', 'X', 'EXKLUSIV-ODER', 'Exklusiv-ODER-Verknüpfung mit dem VKE.', 'X   "Operand"'], ['bit', 'XN', 'EXKLUSIV-ODER NICHT', '', 'XN  "Operand"'],
  ['bit', 'A(', 'UND Klammer auf', 'Öffnet eine Klammer; das Ergebnis wird mit UND verknüpft. Mit „)“ schließen.', 'A(\nO   "Operand1"\nO   "Operand2"\n)'], ['bit', 'O(', 'ODER Klammer auf', 'Öffnet eine Klammer; Ergebnis wird mit ODER verknüpft.', 'O(\nA   "Operand1"\nA   "Operand2"\n)'],
  ['bit', 'O ', 'ODER-Verknüpfung von UND-Gruppen', 'O ohne Operand: ODER-Verknüpfung der vorigen und der folgenden UND-Gruppe.', 'O'],
  ['bit', 'NOT', 'VKE negieren', 'Invertiert das VKE.', 'NOT'], ['bit', 'SET', 'VKE setzen', 'Setzt das VKE auf 1.', 'SET'], ['bit', 'CLR', 'VKE rücksetzen', 'Setzt das VKE auf 0.', 'CLR'],
  ['bit', '=', 'Zuweisung', 'Schreibt das VKE in den Bitoperanden.', '=   "Operand"'], ['bit', 'S', 'Setzen', 'Setzt den Operanden auf 1, wenn VKE = 1.', 'S   "Operand"'], ['bit', 'R', 'Rücksetzen', 'Setzt den Operanden auf 0, wenn VKE = 1.', 'R   "Operand"'],
  ['bit', 'FP', 'Flanke positiv', 'VKE = 1 für einen Zyklus bei steigender Flanke des VKE. Operand = Flankenmerker.', 'FP  "Flankenmerker"'], ['bit', 'FN', 'Flanke negativ', 'VKE = 1 für einen Zyklus bei fallender Flanke.', 'FN  "Flankenmerker"'],
  ['move', 'L', 'Laden', 'Lädt einen Wert in AKKU 1; der alte Inhalt von AKKU 1 wandert nach AKKU 2.', 'L   "Operand"'], ['move', 'T', 'Transferieren', 'Schreibt AKKU 1 in den Operanden.', 'T   "Operand"'], ['move', 'TAK', 'Akkus tauschen', 'Tauscht AKKU 1 und AKKU 2.', 'TAK'],
  ...['I', 'D', 'R'].flatMap(t => [['==', 'gleich'], ['<>', 'ungleich'], ['>', 'größer'], ['<', 'kleiner'], ['>=', 'größer gleich'], ['<=', 'kleiner gleich']].map(([c, n]) => ['cmp', c + t, `${{ I: 'Ganzzahl (16 Bit)', D: 'Ganzzahl (32 Bit)', R: 'Gleitpunktzahl' }[t]} ${n}`, `Vergleicht AKKU 2 ${c} AKKU 1 und verknüpft das Ergebnis mit UND zum VKE.`, `L   "Wert1"\nL   "Wert2"\n${c}${t}`])),
  ...['I', 'D', 'R'].flatMap(t => [['+', 'addieren'], ['-', 'subtrahieren'], ['*', 'multiplizieren'], ['/', 'dividieren']].map(([c, n]) => ['math', c + t, `${{ I: 'Int', D: 'DInt', R: 'Real' }[t]} ${n}`, `AKKU 1 := AKKU 2 ${c} AKKU 1.`, `L   "Wert1"\nL   "Wert2"\n${c}${t}\nT   "Ergebnis"`])),
  ['math', 'MOD', 'Divisionsrest (DInt)', 'AKKU 1 := AKKU 2 MOD AKKU 1.', 'MOD'], ['math', '+', 'Konstante addieren', 'Addiert eine Konstante zu AKKU 1.', '+   1'],
  ...['NEGI', 'NEGD', 'NEGR', 'ABS', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN'].map(m => ['math', m, m, 'Wirkt auf AKKU 1.', m]),
  ...[['ITD', 'Int → DInt'], ['DTR', 'DInt → Real'], ['RND', 'Real → DInt (runden)'], ['TRUNC', 'Real → DInt (abschneiden)'], ['RND+', 'Real → DInt (aufrunden)'], ['RND-', 'Real → DInt (abrunden)'], ['INVI', 'Einerkomplement Int'], ['INVD', 'Einerkomplement DInt']].map(([m, t]) => ['conv', m, t, 'Wandelt AKKU 1 um.', m]),
  ...[['AW', 'UND Wort'], ['OW', 'ODER Wort'], ['XOW', 'EXKLUSIV-ODER Wort'], ['AD', 'UND Doppelwort'], ['OD', 'ODER Doppelwort'], ['XOD', 'EXKLUSIV-ODER Doppelwort']].map(([m, t]) => ['word', m, t, 'Verknüpft AKKU 1 mit AKKU 2 (oder einer Konstanten) bitweise.', `L   "Wort1"\nL   "Wort2"\n${m}\nT   "Ergebnis"`]),
  ...[['SLW', 'Links schieben Wort'], ['SRW', 'Rechts schieben Wort'], ['SLD', 'Links schieben Doppelwort'], ['SRD', 'Rechts schieben Doppelwort'], ['RLD', 'Links rotieren'], ['RRD', 'Rechts rotieren'], ['SSI', 'Schieben mit Vorzeichen Int'], ['SSD', 'Schieben mit Vorzeichen DInt']].map(([m, t]) => ['shift', m, t, 'Schiebt AKKU 1 um die angegebene Anzahl Stellen.', `${m} 1`]),
  ['prog', 'JU', 'Springe unbedingt', 'Springt immer zur Sprungmarke.', 'JU  M001'], ['prog', 'JC', 'Springe bei VKE = 1', '', 'JC  M001'], ['prog', 'JCN', 'Springe bei VKE = 0', '', 'JCN M001'],
  ['prog', 'BEU', 'Bausteinende unbedingt', '', 'BEU'], ['prog', 'BEC', 'Bausteinende bei VKE = 1', '', 'BEC'], ['prog', 'NOP', 'Nulloperation / Sprungziel', 'Zeile mit Sprungmarke: „M001: NOP 0“.', 'M001: NOP 0'],
];
const SCL_LIB = [['IF', 'IF … THEN … END_IF', 'IF  THEN\n   \nEND_IF;'], ['ELSIF', 'ELSIF-Zweig', 'ELSIF  THEN\n   '], ['CASE', 'CASE … OF', 'CASE  OF\n   1:\n      ;\nELSE\n   ;\nEND_CASE;'], ['FOR', 'FOR-Schleife', 'FOR #i := 1 TO 10 DO\n   \nEND_FOR;'],
  ['WHILE', 'WHILE-Schleife', 'WHILE  DO\n   \nEND_WHILE;'], ['REPEAT', 'REPEAT-Schleife', 'REPEAT\n   \nUNTIL  END_REPEAT;'], ['EXIT', 'Schleife verlassen', 'EXIT;'], ['RETURN', 'Baustein verlassen', 'RETURN;'], ['REGION', 'Region', 'REGION Bereich\n   \nEND_REGION']];
function libItems(lang) {
  const items = []; const de = P.mnemonic !== 'INT';
  const blocks = P.blocks.filter(x => x.type === 'FB' || x.type === 'FC');
  if (lang === 'LAD' || lang === 'FBD') {
    for (const d of Object.values(INS)) if (d.langs.includes(lang)) items.push({ id: d.id, cat: d.cat, name: typeof d.name === 'object' ? d.name[lang] || d.name.FBD : d.name, title: d.title, desc: d.desc, d });
    for (const x of blocks) items.push({ id: 'CALL:' + x.name, cat: 'user', name: x.name, title: `${x.type}${x.number ?? ''} aufrufen`, desc: x.type === 'FB' ? 'Funktionsbaustein mit Instanz-DB aufrufen.' : 'Funktion aufrufen.' });
  } else if (lang === 'SCL') {
    for (const [n, t, sn] of SCL_LIB) items.push({ id: 'SCL:' + n, cat: 'prog', name: n, title: t, snip: sn });
    for (const d of Object.values(INS)) if (d.scl && !['contact', 'not', 'branch'].includes(d.kind)) items.push({ id: d.id, cat: d.cat, name: typeof d.name === 'object' ? d.name.FBD : d.name, title: d.title, desc: d.desc, snip: d.scl, d });
    for (const x of blocks) items.push({ id: 'CALL:' + x.name, cat: 'user', name: x.name, title: `${x.type} aufrufen`, snip: sclCall(x) });
  } else {
    for (const [cat, mn, t, desc, sn] of AWL_LIB) items.push({ id: 'AWL:' + mn, cat, name: mnem(mn.trim(), de) + (mn === 'O ' ? ' (ohne Op.)' : ''), title: t, desc, snip: sn.split('\n').map(l => { const m = /^(\w+:\s*)?(\S+)(.*)$/.exec(l); return m ? (m[1] || '') + mnem(m[2], de) + m[3] : l; }).join('\n') });
    for (const d of Object.values(INS)) if ((d.cat === 'tim' || d.cat === 'cnt' || d.id === 'R_TRIG' || d.id === 'F_TRIG' || ['SCALE_X', 'NORM_X', 'LIMIT', 'MIN', 'MAX', 'SEL', 'CALCULATE'].includes(d.id)) && d.kind !== 'coil') items.push({ id: d.id, cat: d.cat, name: 'CALL ' + d.name, title: d.title, desc: d.desc, snip: awlCallSnip(d), d });
    for (const x of blocks) items.push({ id: 'CALL:' + x.name, cat: 'user', name: x.name, title: `${x.type} aufrufen`, snip: awlCallBlock(x) });
  }
  return items;
}
function sclCall(x) { const ps = [...ifaceVars(x, ['Input', 'InOut']).map(v => `${v.name} := `), ...ifaceVars(x, ['Output']).map(v => `${v.name} => `)]; return `${x.type === 'FB' ? '"' + x.name + '_DB"' : '"' + x.name + '"'}(${ps.join(',\n   ')});`; }
function awlCallBlock(x) { const ps = ifaceVars(x, ['Input', 'InOut', 'Output']).map(v => v.name); return `CALL "${x.name}"${x.type === 'FB' ? ' , "' + x.name + '_DB"' : ''}${ps.length ? '\n(  ' + ps.map(n => `${n} := `).join(',\n   ') + '\n)' : ''}`; }
function awlCallSnip(d) { const bx = newBox(d.id); const { ins, outs } = boxPins(d, bx); const ps = [...ins.filter(q => !q.en), ...outs.filter(q => !q.hidden && q.n !== 'ENO')].map(q => q.n);
  return `CALL ${d.kind === 'iec' ? d.name + ' , "' + d.name + '_DB"' : d.id}${d.dt && d.kind !== 'iec' ? `\n(  TYP := ${d.dt.def},` : '\n('}\n${ps.map(n => `   ${n} := `).join(',\n')}\n)`; }
function textInsert(b, id) {
  const it = libItems(b.lang).find(x => x.id === id); if (!it || !it.snip) return;
  let snip = it.snip; const de = P.mnemonic !== 'INT';
  // Instanzen automatisch anlegen (IEC-Zeiten/-Zähler, FB-Aufrufe)
  const d = INS[id]; const blk = id.startsWith('CALL:') ? reg().blocks.get(id.slice(5).toLowerCase()) : null;
  if ((d && d.kind === 'iec') || (blk && blk.type === 'FB')) {
    const inst = autoInstance(b, d ? d.iec : blk.name); const io = d ? boxPins(d, newBox(id)) : null;
    const ps = d ? [...io.ins.map(q => [q.n, q.n === 'PT' ? 'T#5s' : q.n === 'PV' ? '10' : '']), ...io.outs.map(q => [q.n, null])] : [...ifaceVars(blk, ['Input', 'InOut']).map(v => [v.name, '']), ...ifaceVars(blk, ['Output']).map(v => [v.name, null])];
    const w = Math.max(...ps.map(x => x[0].length));
    if (b.lang === 'SCL') snip = `${inst}(${ps.map(([n, v], i) => `${i ? ' '.repeat(inst.length + 1) : ''}${n.padEnd(w)} ${v === null ? '=>' : ':='} ${v || ''}`).join(',\n')});`;
    else snip = `CALL ${inst.startsWith('#') ? inst : (d ? d.name : '"' + blk.name + '"') + ' , ' + inst}\n(  ${ps.map(([n, v]) => `${n.padEnd(w)} := ${v || ''}`).join(',\n   ')}\n)`;
    touch({ ed: false, nav: true });
  }
  let ta = ui.lastTa && document.body.contains(ui.lastTa) ? ui.lastTa : null;
  if (!ta) ta = b.lang === 'SCL' ? $('#ta') : [...document.querySelectorAll('textarea[data-awlnet]')].pop();
  if (!ta) { if (b.lang === 'STL') { b.networks.push({ title: '', comment: '', awl: snip }); touch(); } return; }
  ta.focus(); let st = ta.selectionStart; const before = ta.value.slice(0, st); const atLineStart = !before || /\n\s*$/.test(before);
  const ind = before.slice(before.lastIndexOf('\n') + 1).match(/^\s*/)[0];
  let txt = snip.split('\n').join('\n' + ind); let pre = '';
  if (b.lang === 'STL' && !atLineStart) pre = '\n' + ind;
  if (b.lang === 'STL' && ta.value.slice(ta.selectionEnd)[0] && ta.value.slice(ta.selectionEnd)[0] !== '\n') txt += '\n';
  ta.setRangeText(pre + txt, st, ta.selectionEnd, 'end'); const start = st + pre.length;
  // ersten Platzhalter markieren, damit Tippen ihn ersetzt
  const m = /"(Operand\d?|Wert\d?|Quelle|Ziel|Ergebnis|Wort\d?|Flankenmerker|Zaehler|Min|Max|Normiert|Rohwert|Auswahl|Basis|Exponent|Bitnummer|Setzen|Ruecksetzen|Flanke)"|(?<=:= )(?=,|\n|\)|$)|(?<=IF  ?)(?= THEN)|(?<=WHILE )(?= DO)|(?<=CASE )(?= OF)/.exec(txt);
  if (m) ta.setSelectionRange(start + m.index, start + m.index + m[0].length);
  ta.dispatchEvent(new Event('input'));
}
function libHtml(b) {
  const lang = b.lang; const q = (ui.libQ || '').trim().toLowerCase();
  const items = libItems(lang).filter(it => !q || (it.name + ' ' + it.title + ' ' + (it.desc || '') + ' ' + it.id).toLowerCase().includes(q));
  const groups = CATS.map(([k, nm]) => [k, nm, items.filter(i => i.cat === k)]).filter(g => g[2].length);
  const info = ui.libInfo && libItems(lang).find(x => x.id === ui.libInfo);
  return `<div class="libh"><b>Anweisungen</b><small>${LANG_L[lang]}</small><button class="ib libx" ${A(() => { ui.libOpen = false; renderLib(); })} aria-label="Schließen">✕</button></div>
  <div class="libs"><input id="libq" type="search" placeholder="Suchen (z. B. TON, Vergleich, ADD)" value="${esc(ui.libQ || '')}"></div>
  <div class="libt">${groups.map(([k, nm, its]) => `<details ${q || ui.libOpenCats[k] ? 'open' : ''} data-cat="${k}"><summary>${esc(nm)} <small>${its.length}</small></summary>
    ${its.map(it => `<div class="li ${ui.libInfo === it.id ? 'cur' : ''}" draggable="true" data-drag="${esc(it.id)}" data-info="${esc(it.id)}" ${A(() => { ui.libInfo = it.id; libInsert(b, it.id); })} title="${esc(it.desc || it.title)}"><span class="sym mono">${esc(it.name)}</span><span class="lt">${esc(it.title)}</span></div>`).join('')}</details>`).join('') || '<div class="hint small" style="padding:10px">Keine Treffer.</div>'}</div>
  <div class="libinfo">${info ? libInfoHtml(info, lang) : '<span class="hint small">Anweisung antippen = an der markierten Stelle einfügen. Beschreibung erscheint hier.</span>'}</div>`;
}
function libInfoHtml(it, lang) {
  let pins = '';
  if (it.d && (lang === 'LAD' || lang === 'FBD') && !['contact', 'not', 'branch', 'gate', 'coil', 'label'].includes(it.d.kind)) { const bx = newBox(it.id); const { ins, outs } = boxPins(it.d, bx);
    pins = `<table class="pins"><tr><th>Parameter</th><th>Typ</th><th></th></tr>${ins.map(q => `<tr><td>${esc(q.n)}</td><td>${esc(pinType(q, bx))}</td><td>Input</td></tr>`).join('')}${outs.filter(q => !q.hidden).map(q => `<tr><td>${esc(q.n)}</td><td>${esc(pinType(q, bx))}</td><td>Output</td></tr>`).join('')}</table>`; }
  if (it.snip && (lang === 'SCL' || lang === 'STL')) pins += `<pre class="snipv">${esc(it.snip)}</pre>`;
  return `<div class="lih"><span class="sym mono">${esc(it.name)}</span> ${esc(it.title)}</div>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${pins}`;
}
function renderLib() {
  const b = curBlock(); const el = $('#lib'); const show = !!(b && b.type !== 'DB');
  document.body.classList.toggle('haslib', show); el.className = ui.libOpen ? 'open' : '';
  if (!show) { el.innerHTML = ''; return; }
  const sc = el.querySelector('.libt') ? el.querySelector('.libt').scrollTop : 0;
  el.innerHTML = libHtml(b); const t = el.querySelector('.libt'); if (t) t.scrollTop = sc;
  const qi = $('#libq'); qi.addEventListener('input', () => { ui.libQ = qi.value; const pos = qi.selectionStart; renderLib(); const n = $('#libq'); n.focus(); n.setSelectionRange(pos, pos); });
  el.querySelectorAll('details[data-cat]').forEach(dd => dd.addEventListener('toggle', () => { if (!ui.libQ) ui.libOpenCats[dd.dataset.cat] = dd.open; }));
}
document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('#lib [data-info]'); if (!el) return; const b = curBlock(); if (!b) return; const it = libItems(b.lang).find(x => x.id === el.dataset.info); const box = document.querySelector('#lib .libinfo'); if (it && box && box.dataset.cur !== it.id) { box.innerHTML = libInfoHtml(it, b.lang); box.dataset.cur = it.id; } });
document.addEventListener('dragstart', e => { const el = e.target.closest && e.target.closest('[data-drag]'); if (!el) return; const b = curBlock(); if (!b) return; const id = el.dataset.drag;
  const it = (b.lang === 'SCL' || b.lang === 'STL') ? libItems(b.lang).find(x => x.id === id) : null;
  e.dataTransfer.setData('text/plain', it && it.snip ? it.snip : ''); e.dataTransfer.setData('application/x-sps', id); e.dataTransfer.effectAllowed = 'copy'; });
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('#ed .cv, #ed .net')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('drop', e => { const cv = e.target.closest && e.target.closest('#ed .cv, #ed .net'); const b = curBlock(); if (!cv || !b || b.lang === 'SCL' || b.lang === 'STL') return;
  const id = e.dataTransfer.getData('application/x-sps'); if (!id) return; e.preventDefault();
  const hit = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.matches && x.matches('#ed .cv [data-a]'));
  if (hit && hit !== cv && H[hit.dataset.a]) { const save_ = renderEditor; renderEditor = () => {}; try { H[hit.dataset.a](hit, e); } finally { renderEditor = save_; } }
  else { const net = cv.closest('.net'); const ni = net ? +net.id.slice(4) : b.networks.length - 1; ui.nsel = { b: b.name, ni, ri: -1, path: [], kind: 'net' }; }
  libInsert(b, id); });
document.addEventListener('keydown', e => { if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea, select') && ui.nsel) { const b = curBlock(); if (b && (b.lang === 'LAD' || b.lang === 'FBD')) { e.preventDefault(); netDelete(b); } } });
