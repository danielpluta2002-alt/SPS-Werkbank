'use strict';
/* ===================== Typen & IEC-Bausteine ===================== */
const INTR = { Int: [-32768, 32767], DInt: [-2147483648, 2147483647], UInt: [0, 65535], Word: [0, 65535], Byte: [0, 255], Time: [-2147483648, 2147483647] };
const NUMT = new Set(['Int', 'DInt', 'UInt', 'Word', 'Byte', 'Real', 'LReal', 'Time']);
const BASIC_TYPES = ['Bool', 'Int', 'DInt', 'UInt', 'Word', 'Byte', 'Real', 'LReal', 'Time'];
const TYPE_ALIAS = { bool: 'Bool', int: 'Int', dint: 'DInt', uint: 'UInt', word: 'Word', byte: 'Byte', real: 'Real', lreal: 'LReal', time: 'Time',
  ton_time: 'TON_TIME', ton: 'TON_TIME', tof_time: 'TOF_TIME', tof: 'TOF_TIME', tp_time: 'TP_TIME', tp: 'TP_TIME',
  ctu_int: 'CTU_INT', ctu: 'CTU_INT', ctd_int: 'CTD_INT', ctd: 'CTD_INT', r_trig: 'R_TRIG', f_trig: 'F_TRIG' };
const IEC = {
  TON_TIME: { ins: { IN: 'Bool', PT: 'Time' }, outs: { Q: 'Bool', ET: 'Time' }, run(s, now) {
    if (s.IN) { if (!s._r) { s._r = 1; s._t = now; } s.ET = Math.min(Math.round(now - s._t), s.PT); s.Q = s.ET >= s.PT; }
    else { s._r = 0; s.ET = 0; s.Q = false; } } },
  TOF_TIME: { ins: { IN: 'Bool', PT: 'Time' }, outs: { Q: 'Bool', ET: 'Time' }, run(s, now) {
    if (s.IN) { s.Q = true; s.ET = 0; s._r = 0; }
    else if (s.Q) { if (!s._r) { s._r = 1; s._t = now; } s.ET = Math.min(Math.round(now - s._t), s.PT); if (s.ET >= s.PT) s.Q = false; } } },
  TP_TIME: { ins: { IN: 'Bool', PT: 'Time' }, outs: { Q: 'Bool', ET: 'Time' }, run(s, now) {
    if (!s._a && s.IN && !s._p) { s._a = 1; s._t = now; }
    if (s._a) { s.ET = Math.round(now - s._t); if (s.ET >= s.PT) { s.ET = s.PT; s.Q = false; s._a = 0; } else s.Q = true; }
    else if (!s.IN) s.ET = 0;
    s._p = s.IN; } },
  CTU_INT: { ins: { CU: 'Bool', R: 'Bool', PV: 'Int' }, outs: { Q: 'Bool', CV: 'Int' }, run(s) {
    if (s.R) s.CV = 0; else if (s.CU && !s._p && s.CV < 32767) s.CV++;
    s._p = s.CU; s.Q = s.CV >= s.PV; } },
  CTD_INT: { ins: { CD: 'Bool', LD: 'Bool', PV: 'Int' }, outs: { Q: 'Bool', CV: 'Int' }, run(s) {
    if (s.LD) s.CV = s.PV; else if (s.CD && !s._p && s.CV > -32768) s.CV--;
    s._p = s.CD; s.Q = s.CV <= 0; } },
  R_TRIG: { ins: { CLK: 'Bool' }, outs: { Q: 'Bool' }, run(s) { s.Q = !!s.CLK && !s._m; s._m = !!s.CLK; } },
  F_TRIG: { ins: { CLK: 'Bool' }, outs: { Q: 'Bool' }, run(s) { s.Q = !s.CLK && !!s._m; s._m = !!s.CLK; } },
};
const IEC_NAMES = Object.keys(IEC);
const SECTIONS = { OB: ['Temp'], FC: ['Input', 'Output', 'InOut', 'Temp'], FB: ['Input', 'Output', 'InOut', 'Static', 'Temp'], DB: ['Static'] };

class SclError { constructor(msg, line) { this.msg = msg; this.line = line; } }
class PlcError extends Error {}

function normType(t) { const s = String(t || '').trim().replace(/^"|"$/g, ''); return TYPE_ALIAS[s.toLowerCase()] || s; }
function canonType(t, reg) {
  const n = normType(t); if (TYPE_ALIAS[n.toLowerCase()] || IEC[n]) return n;
  const b = reg.blocks.get(n.toLowerCase()); return b ? b.name : n;
}
function typeKind(t, reg) {
  if (t === 'Bool') return 'bool'; if (NUMT.has(t)) return 'num'; if (IEC[t]) return 'iec';
  if (t.startsWith('DB:')) return 'db';
  const b = reg.blocks.get(t.toLowerCase()); if (b && b.type === 'FB') return 'fb';
  return null;
}
function isIntT(t) { return !!INTR[t]; }
function isRealT(t) { return t === 'Real' || t === 'LReal'; }

/* ===================== Lexer ===================== */
function parseTime(body, line) {
  let s = body.replace(/_/g, ''), neg = false; if (s[0] === '-') { neg = true; s = s.slice(1); }
  const re = /(\d+(?:\.\d+)?)(ms|d|h|m|s)/gi; let m, total = 0, used = 0;
  while ((m = re.exec(s))) { if (m.index !== used) break; used = re.lastIndex;
    const f = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()]; total += parseFloat(m[1]) * f; }
  if (!s || used !== s.length) throw new SclError('Ungültiges Zeitliteral „T#' + body + '“', line);
  return Math.round(neg ? -total : total);
}
function lex(src) {
  const toks = []; let i = 0, line = 1; const n = src.length;
  const idc = ch => /[A-Za-z0-9_]/.test(ch || '');
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if ((c === '(' && src[i + 1] === '*') || (c === '/' && src[i + 1] === '*')) {
      const end = c === '(' ? '*)' : '*/'; const l0 = line; i += 2;
      while (i < n && src.substr(i, 2) !== end) { if (src[i] === '\n') line++; i++; }
      if (i >= n) throw new SclError('Kommentar nicht abgeschlossen', l0); i += 2; continue; }
    if (c === '"') { let j = i + 1; while (j < n && src[j] !== '"' && src[j] !== '\n') j++;
      if (src[j] !== '"') throw new SclError('Schließendes " fehlt', line);
      toks.push({ t: 'qid', v: src.slice(i + 1, j), line }); i = j + 1; continue; }
    if (c === "'") { let j = i + 1; while (j < n && src[j] !== "'" && src[j] !== '\n') j++;
      if (src[j] !== "'") throw new SclError("Schließendes ' fehlt", line);
      toks.push({ t: 'str', v: src.slice(i + 1, j), line }); i = j + 1; continue; }
    if (c === '#') {
      if (src[i + 1] === '"') { let j = i + 2; while (j < n && src[j] !== '"' && src[j] !== '\n') j++;
        toks.push({ t: 'lid', v: src.slice(i + 2, j), line }); i = j + 1; continue; }
      let j = i + 1; while (idc(src[j])) j++;
      if (j === i + 1) throw new SclError('Name nach # erwartet', line);
      toks.push({ t: 'lid', v: src.slice(i + 1, j), line }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (idc(src[j])) j++; const w = src.slice(i, j);
      if (src[j] === '#') {
        const pre = w.toUpperCase(); let k = j + 1; while (k < n && /[A-Za-z0-9_.\-]/.test(src[k])) k++;
        const body = src.slice(j + 1, k);
        if (pre === 'T' || pre === 'TIME') toks.push({ t: 'num', v: parseTime(body, line), ty: 'Time', line });
        else if (pre === 'BOOL') toks.push({ t: 'num', v: /^(1|true)$/i.test(body), ty: 'Bool', line });
        else { let v; if (/^\d+#/.test(body)) { const [b, d] = body.split('#'); v = parseInt(d.replace(/_/g, ''), +b); } else v = parseFloat(body.replace(/_/g, ''));
          if (isNaN(v)) throw new SclError('Ungültiges Literal „' + w + '#' + body + '“', line);
          const ty = normType(pre); toks.push({ t: 'num', v, ty: NUMT.has(ty) ? ty : (body.includes('.') ? 'Real' : 'Int'), line }); }
        i = k; continue; }
      toks.push({ t: 'id', v: w, u: w.toUpperCase(), line }); i = j; continue; }
    if (/[0-9]/.test(c)) {
      let j = i; while (/[0-9_]/.test(src[j] || '')) j++;
      if (src[j] === '#') { const base = +src.slice(i, j).replace(/_/g, ''); let k = j + 1; while (/[0-9A-Fa-f_]/.test(src[k] || '')) k++;
        toks.push({ t: 'num', v: parseInt(src.slice(j + 1, k).replace(/_/g, ''), base), ty: 'Int', line }); i = k; continue; }
      let real = false;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) { real = true; j++; while (/[0-9_]/.test(src[j] || '')) j++; }
      if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) { real = true; j++; if (/[-+]/.test(src[j])) j++; while (/[0-9]/.test(src[j] || '')) j++; }
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j).replace(/_/g, '')), ty: real ? 'Real' : 'Int', line }); i = j; continue; }
    const two = src.substr(i, 2);
    if ([':=', '=>', '<=', '>=', '<>', '**', '..'].includes(two)) { toks.push({ t: 'op', v: two, line }); i += 2; continue; }
    if ('+-*/()=<>,;:.[]&'.includes(c)) { toks.push({ t: 'op', v: c, line }); i++; continue; }
    throw new SclError('Unerwartetes Zeichen „' + c + '“', line);
  }
  toks.push({ t: 'eof', line }); return toks;
}
function tokText(t) { return t.t === 'qid' ? '"' + t.v + '"' : t.t === 'lid' ? '#' + t.v : t.t === 'str' ? "'" + t.v + "'" : String(t.v); }

/* ===================== Parser ===================== */
class Parser {
  constructor(toks) { this.k = toks; this.p = 0; }
  get cur() { return this.k[this.p]; }
  peek(o = 1) { return this.k[Math.min(this.p + o, this.k.length - 1)]; }
  isKw(u) { const t = this.cur; return t.t === 'id' && t.u === u; }
  isOp(v) { const t = this.cur; return t.t === 'op' && t.v === v; }
  next() { return this.k[this.p++]; }
  err(m, t = this.cur) { throw new SclError(m + (t.t === 'eof' ? ' (Ende des Codes erreicht)' : ', gefunden: „' + tokText(t) + '“'), t.line); }
  expectOp(v, m) { if (!this.isOp(v)) this.err(m || '„' + v + '“ erwartet'); return this.next(); }
  expectKw(u) { if (!this.isKw(u)) this.err(u + ' erwartet'); return this.next(); }
  semi() { if (!this.isOp(';')) { const prev = this.k[this.p - 1]; throw new SclError('„;“ fehlt', prev ? prev.line : this.cur.line); } this.next(); }
  stmtList(terms) {
    const out = [];
    for (;;) {
      const t = this.cur;
      if (t.t === 'eof') { if (terms.includes('EOF')) break; this.err(terms.filter(x => x !== 'NUM').join(' / ') + ' erwartet'); }
      if (t.t === 'id' && terms.includes(t.u)) break;
      if (terms.includes('NUM') && (t.t === 'num' || (t.t === 'op' && t.v === '-' && this.peek().t === 'num'))) break;
      const s = this.stmt(); if (s) out.push(s);
    }
    return out;
  }
  program(errs) {
    const out = [];
    while (this.cur.t !== 'eof') {
      const p0 = this.p;
      try { const s = this.stmt(); if (s) out.push(s); }
      catch (e) { if (!(e instanceof SclError)) throw e; errs.push({ line: e.line, msg: e.msg });
        if (this.p === p0) this.next();
        while (this.cur.t !== 'eof' && !this.isOp(';')) this.next(); if (this.isOp(';')) this.next(); }
    }
    return out;
  }
  signedInt() { let neg = false; if (this.isOp('-')) { this.next(); neg = true; }
    const t = this.cur; if (t.t !== 'num') this.err('Ganzzahl erwartet'); this.next(); return neg ? -t.v : t.v; }
  stmt() {
    const t = this.cur, line = t.line;
    if (this.isOp(';')) { this.next(); return null; }
    if (t.t === 'id') {
      switch (t.u) {
        case 'IF': { this.next(); const br = []; let els = null;
          let c = this.expr(); this.expectKw('THEN'); br.push([c, this.stmtList(['ELSIF', 'ELSE', 'END_IF'])]);
          while (this.isKw('ELSIF')) { this.next(); c = this.expr(); this.expectKw('THEN'); br.push([c, this.stmtList(['ELSIF', 'ELSE', 'END_IF'])]); }
          if (this.isKw('ELSE')) { this.next(); els = this.stmtList(['END_IF']); }
          this.expectKw('END_IF'); this.semi(); return { k: 'if', br, els, line }; }
        case 'CASE': { this.next(); const e = this.expr(); this.expectKw('OF'); const cases = []; let els = null;
          while (!this.isKw('END_CASE') && !this.isKw('ELSE')) {
            const labels = [];
            for (;;) { const a = this.signedInt(); if (this.isOp('..')) { this.next(); labels.push([a, this.signedInt()]); } else labels.push([a, a]);
              if (this.isOp(',')) { this.next(); continue; } break; }
            this.expectOp(':'); cases.push({ labels, body: this.stmtList(['NUM', 'ELSE', 'END_CASE']) }); }
          if (this.isKw('ELSE')) { this.next(); if (this.isOp(':')) this.next(); els = this.stmtList(['END_CASE']); }
          this.expectKw('END_CASE'); this.semi(); return { k: 'case', e, cases, els, line }; }
        case 'FOR': { this.next(); const v = this.ref(); this.expectOp(':='); const from = this.expr(); this.expectKw('TO'); const to = this.expr();
          let by = null; if (this.isKw('BY')) { this.next(); by = this.expr(); } this.expectKw('DO');
          const body = this.stmtList(['END_FOR']); this.expectKw('END_FOR'); this.semi(); return { k: 'for', v, from, to, by, body, line }; }
        case 'WHILE': { this.next(); const c = this.expr(); this.expectKw('DO'); const body = this.stmtList(['END_WHILE']); this.expectKw('END_WHILE'); this.semi(); return { k: 'while', c, body, line }; }
        case 'REPEAT': { this.next(); const body = this.stmtList(['UNTIL']); this.expectKw('UNTIL'); const c = this.expr(); this.expectKw('END_REPEAT'); this.semi(); return { k: 'repeat', c, body, line }; }
        case 'EXIT': case 'CONTINUE': case 'RETURN': this.next(); this.semi(); return { k: t.u.toLowerCase(), line };
        case 'REGION': { this.next(); while (this.cur.line === line && this.cur.t !== 'eof') this.next();
          const body = this.stmtList(['END_REGION']); this.expectKw('END_REGION'); if (this.isOp(';')) this.next(); return { k: 'block', body, line }; }
        case 'ELSE': case 'ELSIF': case 'END_IF': case 'END_FOR': case 'END_WHILE': case 'END_CASE': case 'END_REPEAT': case 'UNTIL': case 'THEN': case 'DO':
          this.err('Unerwartetes Schlüsselwort'); break;
      }
    }
    if (t.t !== 'id' && t.t !== 'qid' && t.t !== 'lid') this.err('Anweisung erwartet');
    const target = this.ref();
    if (this.isOp(':=')) { this.next(); const e = this.expr(); this.semi(); return { k: 'assign', target, e, line }; }
    if (this.isOp('(')) { const args = this.args(); this.semi(); return { k: 'call', target, args, line }; }
    if (this.isOp('=')) this.err('Zuweisung mit „:=“ schreiben, nicht „=“');
    this.err('„:=“ oder Bausteinaufruf erwartet');
  }
  ref() {
    const t = this.cur; let root;
    if (t.t === 'lid') root = { k: 'lid', name: t.v };
    else if (t.t === 'qid') root = { k: 'qid', name: t.v };
    else if (t.t === 'id') root = { k: 'id', name: t.v };
    else this.err('Operand erwartet');
    this.next(); const path = [];
    while (this.isOp('.')) { this.next(); const m = this.cur;
      if (m.t === 'id' || m.t === 'qid') { path.push(m.v); this.next(); } else this.err('Elementname nach „.“ erwartet'); }
    if (this.isOp('[')) this.err('ARRAY-Zugriffe werden nicht unterstützt');
    return { k: 'ref', root, path, line: t.line };
  }
  args() {
    this.expectOp('('); const args = [];
    if (this.isOp(')')) { this.next(); return args; }
    for (;;) {
      const t = this.cur, nx = this.peek();
      if ((t.t === 'id' || t.t === 'lid') && nx.t === 'op' && (nx.v === ':=' || nx.v === '=>')) {
        this.next(); this.next(); const out = nx.v === '=>';
        args.push({ name: t.v, out, e: out ? this.ref() : this.expr(), line: t.line });
      } else args.push({ name: null, e: this.expr(), line: t.line });
      if (this.isOp(',')) { this.next(); continue; }
      this.expectOp(')', '„)“ oder „,“ erwartet'); break;
    }
    return args;
  }
  expr() { return this.orE(); }
  bin(next, ops) { let a = next(); for (;;) { const t = this.cur; let op = null;
      if (t.t === 'id' && ops.includes(t.u)) op = t.u; else if (t.t === 'op' && ops.includes(t.v)) op = t.v;
      if (!op) return a; this.next(); a = { k: 'bin', op: op === '&' ? 'AND' : op, a, b: next(), line: t.line }; } }
  orE() { return this.bin(() => this.xorE(), ['OR']); }
  xorE() { return this.bin(() => this.andE(), ['XOR']); }
  andE() { return this.bin(() => this.cmpE(), ['AND', '&']); }
  cmpE() { return this.bin(() => this.addE(), ['=', '<>', '<', '>', '<=', '>=']); }
  addE() { return this.bin(() => this.mulE(), ['+', '-']); }
  mulE() { return this.bin(() => this.powE(), ['*', '/', 'MOD']); }
  powE() { const a = this.unE(); if (this.isOp('**')) { const l = this.next().line; return { k: 'bin', op: '**', a, b: this.powE(), line: l }; } return a; }
  unE() { const t = this.cur;
    if (this.isKw('NOT')) { this.next(); return { k: 'un', op: 'NOT', a: this.unE(), line: t.line }; }
    if (this.isOp('-')) { this.next(); return { k: 'un', op: '-', a: this.unE(), line: t.line }; }
    if (this.isOp('+')) { this.next(); return this.unE(); }
    return this.prim(); }
  prim() {
    const t = this.cur;
    if (t.t === 'num') { this.next(); return { k: 'lit', v: t.v, t: t.ty, line: t.line }; }
    if (t.t === 'str') { this.next(); return { k: 'lit', v: t.v, t: 'String', line: t.line }; }
    if (this.isKw('TRUE') || this.isKw('FALSE')) { this.next(); return { k: 'lit', v: t.u === 'TRUE', t: 'Bool', line: t.line }; }
    if (this.isOp('(')) { this.next(); const e = this.expr(); this.expectOp(')', '„)“ fehlt'); return e; }
    if (t.t === 'id' || t.t === 'qid' || t.t === 'lid') {
      const r = this.ref();
      if (this.isOp('(')) return { k: 'fcall', ref: r, args: this.args(), line: t.line };
      return r; }
    this.err('Ausdruck erwartet');
  }
}

/* ===================== Compiler ===================== */
const BUILTIN = {
  ABS: { p: ['IN'], f: Math.abs, t: a => a[0] }, SQRT: { p: ['IN'], f: Math.sqrt, t: 'Real' }, SQR: { p: ['IN'], f: x => x * x, t: a => a[0] },
  LN: { p: ['IN'], f: Math.log, t: 'Real' }, EXP: { p: ['IN'], f: Math.exp, t: 'Real' }, SIN: { p: ['IN'], f: Math.sin, t: 'Real' },
  COS: { p: ['IN'], f: Math.cos, t: 'Real' }, TAN: { p: ['IN'], f: Math.tan, t: 'Real' },
  MIN: { p: ['IN1', 'IN2', 'IN3', 'IN4'], min: 2, f: Math.min, t: a => numRes(...a) }, MAX: { p: ['IN1', 'IN2', 'IN3', 'IN4'], min: 2, f: Math.max, t: a => numRes(...a) },
  LIMIT: { p: ['MN', 'IN', 'MX'], f: (mn, v, mx) => Math.min(Math.max(v, mn), mx), t: a => numRes(...a) },
  SEL: { p: ['G', 'IN0', 'IN1'], f: (g, a, b) => g ? b : a, t: a => a[1] },
  TRUNC: { p: ['IN'], f: Math.trunc, t: 'DInt' }, ROUND: { p: ['IN'], f: Math.round, t: 'DInt' },
  CEIL: { p: ['IN'], f: Math.ceil, t: 'DInt' }, FLOOR: { p: ['IN'], f: Math.floor, t: 'DInt' },
  NORM_X: { p: ['MIN', 'VALUE', 'MAX'], f: (mn, v, mx) => mx === mn ? 0 : (v - mn) / (mx - mn), t: 'Real' },
  SCALE_X: { p: ['MIN', 'VALUE', 'MAX'], f: (mn, v, mx) => v * (mx - mn) + mn, t: 'Real' },
};
function numRes(...ts) { if (ts.some(isRealT)) return 'Real'; if (ts.includes('Time')) return 'Time'; if (ts.includes('DInt')) return 'DInt'; return ts[0] === 'any' ? 'any' : 'Int'; }
function coercer(t, st) {
  if (t === 'Bool') return v => !!v;
  if (isRealT(t)) return v => +v;
  const rng = INTR[t];
  if (rng) { const [lo, hi] = rng, span = hi - lo + 1; const rnd = isRealT(st) ? Math.round : Math.trunc;
    return v => { v = rnd(+v) || 0; if (v < lo || v > hi) v = ((v - lo) % span + span) % span + lo; return v; }; }
  return v => v;
}
function checkAssign(t, st, sc, line, what) {
  if (st === 'any' || t === 'any') return;
  if (t === 'Bool' && st !== 'Bool') throw new SclError(`Typkonflikt: ${st} kann nicht ${what || 'nach Bool'} zugewiesen werden`, line);
  if (NUMT.has(t) && st === 'Bool') throw new SclError(`Typkonflikt: Bool kann nicht nach ${t} zugewiesen werden`, line);
  if (NUMT.has(t) && !NUMT.has(st)) throw new SclError(`Typkonflikt: ${st} → ${t}`, line);
  if (isIntT(t) && isRealT(st)) sc.warns.push({ line, msg: `Implizite Konvertierung ${st} → ${t} (es wird gerundet)` });
}
function findVar(list, m, reg) { const v = list.find(v => v.name.toLowerCase() === String(m).toLowerCase()); return v ? { name: v.name, type: canonType(v.type, reg) } : null; }
function ifaceVars(b, secs) { const out = []; for (const s of secs) for (const v of (b.iface && b.iface[s]) || []) out.push(v); return out; }
function memberType(t, m, reg) {
  if (IEC[t]) { const all = { ...IEC[t].ins, ...IEC[t].outs }; const k = Object.keys(all).find(x => x.toLowerCase() === m.toLowerCase()); return k ? { name: k, type: all[k] } : null; }
  if (t.startsWith('DB:')) { const db = reg.blocks.get(t.slice(3).toLowerCase());
    if (db.instanceOf) return memberType(canonType(db.instanceOf, reg), m, reg);
    return findVar(ifaceVars(db, ['Static']), m, reg); }
  const b = reg.blocks.get(t.toLowerCase());
  if (b && b.type === 'FB') return findVar(ifaceVars(b, ['Input', 'Output', 'InOut', 'Static']), m, reg);
  return null;
}
function resolveRoot(r, sc) {
  const { root } = r, name = root.name, lo = name.toLowerCase();
  if (root.k === 'lid') { const v = sc.vars.get(lo); if (!v) throw new SclError(`Lokale Variable „#${name}“ ist nicht deklariert`, r.line); return { base: 'L', key: v.name, t: v.type }; }
  if (root.k === 'id' && sc.vars.has(lo)) { const v = sc.vars.get(lo); return { base: 'L', key: v.name, t: v.type }; }
  const tag = sc.reg.tags.get(lo);
  if (tag) return { base: 'G', key: tag.name, t: canonType(tag.type, sc.reg) };
  const b = sc.reg.blocks.get(lo);
  if (b && b.type === 'DB') return { base: 'D', key: b.name, t: 'DB:' + b.name };
  if (b) return { block: b };
  throw new SclError(root.k === 'qid' ? `PLC-Variable „"${name}"“ ist nicht definiert` : `Bezeichner „${name}“ ist unbekannt (lokal: #${name}, global: "${name}")`, r.line);
}
function compileRef(r, sc) {
  const rr = resolveRoot(r, sc);
  if (rr.block) throw new SclError(`„${rr.block.name}“ ist ein Baustein und kann hier nicht als Operand verwendet werden`, r.line);
  const keys = [rr.key]; let t = rr.t;
  for (const m of r.path) { const mt = memberType(t, m, sc.reg);
    if (!mt) throw new SclError(`„${m}“ ist kein Element von ${t.replace(/^DB:/, '')}`, r.line);
    keys.push(mt.name); t = mt.type; }
  const base = rr.base, n = keys.length, last = keys[n - 1];
  const obj = ctx => { let o = ctx[base]; for (let i = 0; i < n - 1; i++) o = o[keys[i]]; return o; };
  const co = coercer(t);
  return { t, keys, base, line: r.line,
    get: n === 1 ? ctx => ctx[base][last] : ctx => obj(ctx)[last],
    set: (ctx, v) => { obj(ctx)[last] = co(v); },
    kind: typeKind(t, sc.reg) };
}
function compileExpr(e, sc) {
  switch (e.k) {
    case 'lit': { const v = e.v; return { f: () => v, t: e.t }; }
    case 'ref': { const r = compileRef(e, sc);
      if (r.kind === 'iec' || r.kind === 'fb' || r.kind === 'db') throw new SclError(`„${r.keys.join('.')}“ ist strukturiert und kann nicht als Wert verwendet werden`, e.line);
      return { f: r.get, t: r.t }; }
    case 'un': { const a = compileExpr(e.a, sc), f = a.f;
      if (e.op === 'NOT') { if (a.t === 'Bool' || a.t === 'any') return { f: c => !f(c), t: 'Bool' };
        if (isIntT(a.t)) return { f: c => ~f(c), t: a.t };
        throw new SclError('NOT erwartet Bool', e.line); }
      if (a.t === 'Bool') throw new SclError('Vorzeichen bei Bool nicht möglich', e.line);
      return { f: c => -f(c), t: a.t }; }
    case 'bin': {
      const A = compileExpr(e.a, sc), B = compileExpr(e.b, sc), a = A.f, b = B.f, op = e.op;
      if (op === 'AND' || op === 'OR' || op === 'XOR') {
        if (A.t === 'Bool' && B.t === 'Bool' || A.t === 'any' || B.t === 'any') {
          if (op === 'AND') return { f: c => a(c) && b(c), t: 'Bool' };
          if (op === 'OR') return { f: c => a(c) || b(c), t: 'Bool' };
          return { f: c => !!a(c) !== !!b(c), t: 'Bool' }; }
        if (isIntT(A.t) && isIntT(B.t)) { const t = numRes(A.t, B.t);
          if (op === 'AND') return { f: c => a(c) & b(c), t }; if (op === 'OR') return { f: c => a(c) | b(c), t }; return { f: c => a(c) ^ b(c), t }; }
        throw new SclError(`${op}: Operanden ${A.t} und ${B.t} passen nicht zusammen`, e.line); }
      if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
        if ((A.t === 'Bool') !== (B.t === 'Bool') && A.t !== 'any' && B.t !== 'any') throw new SclError(`Vergleich ${A.t} ${op} ${B.t} nicht möglich`, e.line);
        const F = { '=': (x, y) => x === y, '<>': (x, y) => x !== y, '<': (x, y) => x < y, '>': (x, y) => x > y, '<=': (x, y) => x <= y, '>=': (x, y) => x >= y }[op];
        if (A.t === 'Bool') return { f: c => F(!!a(c), !!b(c)), t: 'Bool' };
        return { f: c => F(+a(c), +b(c)), t: 'Bool' }; }
      if (A.t === 'Bool' || B.t === 'Bool') throw new SclError(`Arithmetik („${op}“) mit Bool nicht möglich`, e.line);
      const t = numRes(A.t, B.t), ints = !isRealT(A.t) && !isRealT(B.t);
      switch (op) {
        case '+': return { f: c => a(c) + b(c), t }; case '-': return { f: c => a(c) - b(c), t }; case '*': return { f: c => a(c) * b(c), t };
        case '/': return ints ? { f: c => { const d = b(c); return d === 0 ? 0 : Math.trunc(a(c) / d); }, t } : { f: c => a(c) / b(c), t };
        case 'MOD': if (!ints) throw new SclError('MOD nur für Ganzzahlen', e.line); return { f: c => { const d = b(c); return d === 0 ? 0 : a(c) % d; }, t };
        case '**': return { f: c => Math.pow(a(c), b(c)), t: 'Real' }; }
      throw new SclError('Unbekannter Operator ' + op, e.line); }
    case 'fcall': {
      const r = e.ref, nm = r.root.name.toUpperCase();
      if (r.root.k === 'id' && r.path.length === 0) {
        const conv = /^(\w+?)_TO_(\w+)$/.exec(nm);
        if (conv) { if (e.args.length !== 1) throw new SclError(nm + ' erwartet genau einen Parameter', e.line);
          const A = compileExpr(e.args[0].e, sc), a = A.f, tt = normType(conv[2]);
          if (tt === 'Bool') return { f: c => !!a(c), t: 'Bool' };
          if (!NUMT.has(tt)) throw new SclError('Unbekannte Konvertierung ' + nm, e.line);
          const co = coercer(tt, isRealT(A.t) ? 'Real' : 'Int'); const rnd = isIntT(tt) && isRealT(A.t);
          return { f: rnd ? c => co(Math.round(a(c))) : c => co(+a(c)), t: tt }; }
        const bi = BUILTIN[nm];
        if (bi) { const slots = [];
          e.args.forEach((ar, i) => { let idx = i;
            if (ar.name) { idx = bi.p.findIndex(p => p === ar.name.toUpperCase()); if (idx < 0) throw new SclError(`${nm}: unbekannter Parameter „${ar.name}“`, ar.line); }
            if (ar.out) throw new SclError(`${nm}: Ausgangsparameter nicht möglich`, ar.line);
            if (idx >= bi.p.length) throw new SclError(`${nm}: zu viele Parameter`, ar.line);
            slots[idx] = compileExpr(ar.e, sc); });
          const need = bi.min || bi.p.length; const used = [];
          for (let i = 0; i < bi.p.length; i++) { if (slots[i]) used.push(slots[i]); else if (i < need) throw new SclError(`${nm}: Parameter ${bi.p[i]} fehlt`, e.line); }
          const fs = used.map(s => s.f), ts = used.map(s => s.t), fn = bi.f;
          const t = typeof bi.t === 'function' ? bi.t(ts) : bi.t;
          if (fs.length === 1) { const f0 = fs[0]; return { f: c => fn(f0(c)), t }; }
          return { f: c => fn(...fs.map(f => f(c))), t }; }
      }
      const b = sc.reg.blocks.get(r.root.name.toLowerCase());
      if (b && b.type === 'FC') throw new SclError(`FC „${b.name}“ hat keinen Rückgabewert und kann nur als Anweisung aufgerufen werden`, e.line);
      throw new SclError(`Unbekannte Funktion „${r.root.name}“`, e.line); }
  }
  throw new SclError('Ausdruck nicht unterstützt', e.line);
}
function guard(ctx) { if (++ctx.guard > 3e6) throw new PlcError('Zykluszeitüberwachung angesprochen (Endlosschleife?)'); }
function execList(list, ctx) { for (let i = 0; i < list.length; i++) { const r = list[i](ctx); if (r) return r; } return 0; }
function compileList(ast, sc) {
  return ast.map(s => { try { return compileStmt(s, sc); } catch (e) { if (e instanceof SclError) { sc.errs.push({ line: e.line ?? s.line, msg: e.msg }); return () => 0; } throw e; } });
}
function compileStmt(s, sc) {
  switch (s.k) {
    case 'assign': {
      const r = compileRef(s.target, sc);
      if (!(r.kind === 'bool' || r.kind === 'num')) throw new SclError(`„${r.keys.join('.')}“ kann nichts zugewiesen werden`, s.line);
      const E = compileExpr(s.e, sc); checkAssign(r.t, E.t, sc, s.line, 'nach ' + r.t);
      const co = coercer(r.t, E.t), f = E.f, keys = r.keys, base = r.base;
      if (keys.length === 1) { const k = keys[0]; return c => { c[base][k] = co(f(c)); return 0; }; }
      const set = r.set; return c => { set(c, f(c)); return 0; }; }
    case 'if': { const br = s.br.map(([c, b]) => { const C = compileExpr(c, sc); if (C.t !== 'Bool' && C.t !== 'any') throw new SclError('IF-Bedingung muss Bool sein', c.line || s.line); return [C.f, compileList(b, sc)]; });
      const els = s.els ? compileList(s.els, sc) : null;
      return c => { for (let i = 0; i < br.length; i++) if (br[i][0](c)) return execList(br[i][1], c); return els ? execList(els, c) : 0; }; }
    case 'case': { const E = compileExpr(s.e, sc); if (!isIntT(E.t) && E.t !== 'any') throw new SclError('CASE-Ausdruck muss ganzzahlig sein', s.line);
      const cases = s.cases.map(cs => ({ labels: cs.labels, body: compileList(cs.body, sc) })); const els = s.els ? compileList(s.els, sc) : null; const f = E.f;
      return c => { const v = f(c); for (const cs of cases) for (const [a, b] of cs.labels) if (v >= a && v <= b) return execList(cs.body, c); return els ? execList(els, c) : 0; }; }
    case 'for': { const v = compileRef(s.v, sc); if (!isIntT(v.t)) throw new SclError('Laufvariable muss ganzzahlig sein', s.line);
      const from = compileExpr(s.from, sc).f, to = compileExpr(s.to, sc).f, by = s.by ? compileExpr(s.by, sc).f : null, body = compileList(s.body, sc);
      return c => { const end = to(c), st = by ? by(c) : 1; if (st === 0) throw new PlcError('FOR-Schleife mit Schrittweite 0');
        v.set(c, from(c));
        while (st > 0 ? v.get(c) <= end : v.get(c) >= end) { guard(c); const r = execList(body, c); if (r === 1) break; if (r === 3) return 3; v.set(c, v.get(c) + st); }
        return 0; }; }
    case 'while': { const C = compileExpr(s.c, sc).f, body = compileList(s.body, sc);
      return c => { while (C(c)) { guard(c); const r = execList(body, c); if (r === 1) break; if (r === 3) return 3; } return 0; }; }
    case 'repeat': { const C = compileExpr(s.c, sc).f, body = compileList(s.body, sc);
      return c => { do { guard(c); const r = execList(body, c); if (r === 1) break; if (r === 3) return 3; } while (!C(c)); return 0; }; }
    case 'exit': return () => 1; case 'continue': return () => 2; case 'return': return () => 3;
    case 'block': { const body = compileList(s.body, sc); return c => execList(body, c); }
    case 'call': return compileCall(s, sc);
  }
  throw new SclError('Anweisung nicht unterstützt', s.line);
}
function bindParams(s, sc, P, label) {
  const ins = [], outs = [], ios = [];
  for (const a of s.args) {
    if (!a.name) throw new SclError(`${label}: Parameter mit Namen übergeben (z. B. IN := …)`, a.line);
    const lo = a.name.toLowerCase();
    if (a.out) { const p = P.outs.get(lo); if (!p) throw new SclError(`${label}: „${a.name}“ ist kein Ausgang`, a.line);
      const r = compileRef(a.e, sc); checkAssign(r.t, p.type, sc, a.line, 'nach ' + r.t); outs.push({ k: p.name, set: r.set }); continue; }
    if (P.outs.has(lo)) throw new SclError(`${label}: Ausgang „${a.name}“ mit „=>“ verschalten`, a.line);
    if (P.ios.has(lo)) { const p = P.ios.get(lo); if (a.e.k !== 'ref') throw new SclError(`${label}: InOut „${a.name}“ braucht eine Variable`, a.line);
      const r = compileRef(a.e, sc); ios.push({ k: p.name, get: r.get, set: r.set }); continue; }
    const p = P.ins.get(lo); if (!p) throw new SclError(`${label}: unbekannter Parameter „${a.name}“`, a.line);
    const E = compileExpr(a.e, sc); checkAssign(p.type, E.t, sc, a.line, 'nach ' + p.type);
    ins.push({ k: p.name, f: E.f, co: coercer(p.type, E.t) }); }
  return { ins, outs, ios };
}
function mapOf(entries) { const m = new Map(); for (const [n, t] of entries) m.set(n.toLowerCase(), { name: n, type: t }); return m; }
function compileCall(s, sc) {
  const tg = s.target;
  if (tg.path.length === 0 && tg.root.k !== 'lid' && !(tg.root.k === 'id' && sc.vars.has(tg.root.name.toLowerCase()))) {
    const b = sc.reg.blocks.get(tg.root.name.toLowerCase());
    if (b && b.type === 'FC') {
      const P = { ins: mapOf(ifaceVars(b, ['Input']).map(v => [v.name, canonType(v.type, sc.reg)])), outs: mapOf(ifaceVars(b, ['Output']).map(v => [v.name, canonType(v.type, sc.reg)])), ios: mapOf(ifaceVars(b, ['InOut']).map(v => [v.name, canonType(v.type, sc.reg)])) };
      const { ins, outs, ios } = bindParams(s, sc, P, b.name);
      for (const [lo, p] of P.ins) if (!ins.some(i => i.k.toLowerCase() === lo)) throw new SclError(`${b.name}: Eingang „${p.name}“ nicht versorgt`, s.line);
      for (const [lo, p] of P.ios) if (!ios.some(i => i.k.toLowerCase() === lo)) throw new SclError(`${b.name}: InOut „${p.name}“ nicht versorgt`, s.line);
      const lo = b.name.toLowerCase();
      return c => { const L = c.rt.newLocals(lo);
        for (const i of ins) L[i.k] = i.co(i.f(c)); for (const i of ios) L[i.k] = i.get(c);
        c.rt.exec(lo, L, c);
        for (const o of outs) o.set(c, L[o.k]); for (const i of ios) i.set(c, L[i.k]); return 0; }; }
    if (b && b.type === 'FB') throw new SclError(`FB „${b.name}“ braucht eine Instanz: "${b.name}_DB"(…) oder Multiinstanz #inst(…)`, s.line);
    if (b && b.type === 'OB') throw new SclError('Organisationsbausteine können nicht aufgerufen werden', s.line);
    if (tg.root.k === 'id' && (BUILTIN[tg.root.name.toUpperCase()] || /_TO_/i.test(tg.root.name))) throw new SclError(`Funktion „${tg.root.name}“ liefert einen Wert – Ergebnis zuweisen: x := ${tg.root.name}(…);`, s.line);
  }
  const r = compileRef(tg, sc); let t = r.t;
  if (t.startsWith('DB:')) { const db = sc.reg.blocks.get(t.slice(3).toLowerCase());
    if (!db.instanceOf) throw new SclError(`Global-DB „${db.name}“ kann nicht aufgerufen werden`, s.line); t = canonType(db.instanceOf, sc.reg); }
  const label = r.keys.join('.'), get = r.get;
  if (IEC[t]) { const D = IEC[t];
    const P = { ins: mapOf(Object.entries(D.ins)), outs: mapOf(Object.entries(D.outs)), ios: new Map() };
    const { ins, outs } = bindParams(s, sc, P, label); const run = D.run;
    return c => { const st = get(c); for (const i of ins) st[i.k] = i.co(i.f(c)); run(st, c.now); for (const o of outs) o.set(c, st[o.k]); return 0; }; }
  const fb = sc.reg.blocks.get(t.toLowerCase());
  if (fb && fb.type === 'FB') {
    const P = { ins: mapOf(ifaceVars(fb, ['Input']).map(v => [v.name, canonType(v.type, sc.reg)])), outs: mapOf(ifaceVars(fb, ['Output']).map(v => [v.name, canonType(v.type, sc.reg)])), ios: mapOf(ifaceVars(fb, ['InOut']).map(v => [v.name, canonType(v.type, sc.reg)])) };
    const { ins, outs, ios } = bindParams(s, sc, P, label); const lo = fb.name.toLowerCase();
    return c => { const st = get(c); for (const i of ins) st[i.k] = i.co(i.f(c)); for (const i of ios) st[i.k] = i.get(c);
      c.rt.runFB(lo, st, c); for (const o of outs) o.set(c, st[o.k]); for (const i of ios) i.set(c, st[i.k]); return 0; }; }
  throw new SclError(`„${label}“ (${t}) ist nicht aufrufbar`, s.line);
}
function parseInit(str, type, reg) {
  const s = String(str ?? '').trim(); if (!s) return null;
  const toks = lex(s); let i = 0, neg = false;
  if (toks[0].t === 'op' && toks[0].v === '-') { neg = true; i = 1; }
  const t = toks[i];
  if (t.t === 'id' && (t.u === 'TRUE' || t.u === 'FALSE')) return t.u === 'TRUE';
  if (t.t !== 'num' || toks[i + 1].t !== 'eof') throw new SclError(`Ungültiger Startwert „${s}“`);
  const v = neg ? -t.v : t.v; return type === 'Bool' ? !!v : coercer(type, t.ty)(v);
}
function defVal(type, init, reg, depth = 0) {
  if (depth > 12) throw new SclError('Instanzen zu tief verschachtelt (Rekursion?)');
  const k = typeKind(type, reg);
  if (k === 'bool' || k === 'num') { let v = null; try { v = parseInit(init, type, reg); } catch (e) { v = null; } return v ?? (k === 'bool' ? false : 0); }
  if (k === 'iec') { const o = {}; for (const [n, t] of Object.entries({ ...IEC[type].ins, ...IEC[type].outs })) o[n] = t === 'Bool' ? false : 0; return o; }
  if (k === 'fb') return createInstance(reg.blocks.get(type.toLowerCase()), reg, depth + 1);
  return 0;
}
function createInstance(fb, reg, depth = 0) { const o = {}; for (const v of ifaceVars(fb, ['Input', 'Output', 'InOut', 'Static', 'Temp'])) o[v.name] = defVal(canonType(v.type, reg), v.init, reg, depth); return o; }
function buildReg(P) { const tags = new Map(), blocks = new Map(); for (const t of P.tags) if (t.name) tags.set(t.name.toLowerCase(), t); for (const b of P.blocks) blocks.set(b.name.toLowerCase(), b); return { tags, blocks }; }
function makeScope(b, reg, extra) {
  const vars = new Map();
  if (b) for (const s of SECTIONS[b.type] || []) for (const v of (b.iface && b.iface[s]) || []) if (v.name) vars.set(v.name.toLowerCase(), { name: v.name, type: canonType(v.type, reg), sec: s, init: v.init });
  for (const v of extra || []) vars.set(v.name.toLowerCase(), { name: v.name, type: v.type, sec: 'Temp' });
  return { reg, vars, block: b, errs: [], warns: [] };
}
function compileExprString(str, sc) {
  const p = new Parser(lex(str)); const e = p.expr(); if (p.cur.t !== 'eof') p.err('Ende des Ausdrucks erwartet'); return compileExpr(e, sc);
}
function compileRefString(str, sc) {
  const p = new Parser(lex(str)); const r = p.ref(); if (p.cur.t !== 'eof') p.err('Operand erwartet'); return compileRef(r, sc);
}

/* ===================== KOP / FUP → SCL ===================== */
const CMP_SCL = { '==': '=', '<>': '<>', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };
const ARITH = { ADD: '+', SUB: '-', MUL: '*', DIV: '/' };
function simple(x) { return /^(NOT )?[\w#".]+$/.test(x) || /^\([^()]*\)$/.test(x) || balancedParen(x); }
function balancedParen(x) { if (x[0] !== '(' || x[x.length - 1] !== ')') return false; let d = 0; for (let i = 0; i < x.length; i++) { if (x[i] === '(') d++; else if (x[i] === ')') { d--; if (d === 0 && i < x.length - 1) return false; } } return d === 0; }
function par(x) { return simple(x) ? x : '(' + x + ')'; }
function andX(a, b) { if (a === null) return null; if (a === 'TRUE') return b; return a + ' AND ' + b; }
function emitEl(el, P, emit, err, reg) {
  const o = k => { const v = String(el[k] ?? '').trim(); if (!v) { err(`${elLabel(el.t)}: ${k.toUpperCase()} fehlt`); return 'FALSE'; } return v; };
  const opt = k => String(el[k] ?? '').trim();
  const gd = s => emit(P === 'TRUE' ? s : `IF ${P} THEN ${s} END_IF;`);
  switch (el.t) {
    case 'COIL': emit(`${o('op')} := ${P};`); return P;
    case 'NCOIL': emit(`${o('op')} := NOT ${par(P)};`); return P;
    case 'SET': gd(`${o('op')} := TRUE;`); return P;
    case 'RST': gd(`${o('op')} := FALSE;`); return P;
    case 'TON': case 'TOF': case 'TP': { const i = o('inst'); let s = `${i}(IN := ${P}, PT := ${o('pt')}`;
      if (opt('q')) s += `, Q => ${opt('q')}`; if (opt('et')) s += `, ET => ${opt('et')}`; emit(s + ');'); return `${i}.Q`; }
    case 'CTU': case 'CTD': { const i = o('inst'); let s = el.t === 'CTU' ? `${i}(CU := ${P}, R := ${opt('r') || 'FALSE'}, PV := ${o('pv')}` : `${i}(CD := ${P}, LD := ${opt('ld') || 'FALSE'}, PV := ${o('pv')}`;
      if (opt('q')) s += `, Q => ${opt('q')}`; if (opt('cv')) s += `, CV => ${opt('cv')}`; emit(s + ');'); return `${i}.Q`; }
    case 'MOVE': gd(`${o('out')} := ${o('in')};`); return P;
    case 'ADD': case 'SUB': case 'MUL': case 'DIV': gd(`${o('out')} := ${o('in1')} ${ARITH[el.t]} ${o('in2')};`); return P;
    case 'CALL': {
      const bn = opt('blk').replace(/"/g, ''); const b = bn && reg.blocks.get(bn.toLowerCase());
      if (!b || (b.type !== 'FB' && b.type !== 'FC')) { err(bn ? `Baustein „${bn}“ existiert nicht oder ist kein FB/FC` : 'CALL: Baustein fehlt'); return P; }
      const tgt = b.type === 'FB' ? o('inst') : `"${b.name}"`; const args = []; const pm = el.params || {};
      for (const v of ifaceVars(b, ['Input', 'InOut'])) { const x = String(pm[v.name] ?? '').trim(); if (x) args.push(`${v.name} := ${x}`); else if (b.type === 'FC') err(`${b.name}: Parameter ${v.name} nicht versorgt`); }
      for (const v of ifaceVars(b, ['Output'])) { const x = String(pm[v.name] ?? '').trim(); if (x) args.push(`${v.name} => ${x}`); }
      gd(`${tgt}(${args.join(', ')});`); return P; }
  }
  err('Unbekanntes Element ' + el.t); return P;
}
function elLabel(t) { return ({ NO: 'Schließer', NC: 'Öffner', COIL: 'Spule', NCOIL: 'Neg. Spule', SET: 'Setzen', RST: 'Rücksetzen', CMP: 'Vergleicher', P: 'P-Flanke', N: 'N-Flanke' })[t] || t; }
function ladGen(net, ni, reg, emit, err, temps) {
  const R = net.rows, C = net.cols; let p = Array(R).fill('TRUE'); const dIn = {}, dOut = {}, dLink = {}; let tc = 0;
  const op = (el, k) => { const v = String(el[k] ?? '').trim(); if (!v) { err(`${elLabel(el.t)}: Operand fehlt`); return 'FALSE'; } return v; };
  for (let c = 0; c < C; c++) {
    const out = Array(R).fill(null);
    for (let r = 0; r < R; r++) {
      const key = r + ',' + c, el = net.cells[key], pin = p[r]; if (!el) continue;
      const P = pin === null ? 'FALSE' : pin; dIn[key] = P; let o;
      switch (el.t) {
        case 'W': o = pin; break;
        case 'NO': o = andX(pin, op(el, 'op')); break;
        case 'NC': o = andX(pin, 'NOT ' + op(el, 'op')); break;
        case 'CMP': o = andX(pin, `(${op(el, 'a')} ${CMP_SCL[el.cmp] || '='} ${op(el, 'b')})`); break;
        case 'P': case 'N': { const t = `#__n${ni}_${tc++}`; temps.push({ name: t.slice(1), type: 'Bool' });
          const x = String(el.op ?? '').trim(), m = String(el.mem ?? '').trim();
          if (!x || !m) { err(`${elLabel(el.t)}: ${!x ? 'Operand' : 'Flankenmerker'} fehlt`); o = andX(pin, 'FALSE'); break; }
          emit(el.t === 'P' ? `${t} := ${x} AND NOT ${m};` : `${t} := NOT ${x} AND ${m};`); emit(`${m} := ${x};`); o = andX(pin, t); break; }
        default: o = emitEl(el, P, emit, err, reg); if (o === P && pin === null) o = null;
      }
      out[r] = o ?? null; dOut[key] = o ?? 'FALSE';
    }
    const np = out.slice(); let r = 0;
    while (r < R) { let e = r; while (e < R - 1 && net.links[e + ',' + (c + 1)]) e++;
      if (e > r) { const parts = []; for (let k = r; k <= e; k++) if (out[k] !== null && !parts.includes(out[k])) parts.push(out[k]);
        const v = parts.length === 0 ? null : parts.length === 1 ? parts[0] : '(' + parts.join(' OR ') + ')';
        for (let k = r; k <= e; k++) { np[k] = v; if (k < e) dLink[k + ',' + (c + 1)] = v ?? 'FALSE'; } }
      r = e + 1; }
    p = np;
  }
  return { dIn, dOut, dLink };
}
function fbdExprIn(inp, err, disp) { const x = fbdExprN(inp.n, err, disp); const r = inp.neg ? 'NOT ' + par(x) : x; if (disp) disp.set(inp, r); return r; }
function fbdExprN(n, err, disp) {
  let r;
  if (!n) { err('Eingang leer'); r = 'FALSE'; }
  else if (n.t === 'OP') { const v = String(n.op || '').trim(); if (!v) { err('Operand fehlt'); r = 'FALSE'; } else r = v; }
  else if (n.t === 'CMP') { const a = String(n.a || '').trim(), b = String(n.b || '').trim(); if (!a || !b) err('Vergleicher: Operand fehlt'); r = `(${a || '0'} ${CMP_SCL[n.cmp] || '='} ${b || '0'})`; }
  else { const j = { AND: ' AND ', OR: ' OR ', XOR: ' XOR ' }[n.t]; const parts = (n.ins || []).map(i => par(fbdExprIn(i, err, disp)));
    if (!parts.length) { err('Gatter ohne Eingänge'); r = 'FALSE'; } else r = parts.length === 1 ? parts[0] : '(' + parts.join(j) + ')'; }
  if (disp && n) disp.set(n, r); return r;
}
function blockScl(b, reg) {
  if (b.lang === 'SCL') return { text: b.scl || '', map: null, errs: [], temps: [], disp: null };
  const lines = [], map = [], errs = [], temps = [], disp = [];
  (b.networks || []).forEach((net, ni) => {
    const start = lines.length + 1; lines.push(`// Netzwerk ${ni + 1}: ${(net.title || '').replace(/\n/g, ' ')}`);
    const emit = s => lines.push(s), err = m => errs.push({ net: ni, msg: m });
    if (b.lang === 'LAD') disp.push(ladGen(net, ni, reg, emit, err, temps));
    else { const d = new Map(); const root = net.root || { t: 'COIL', in: { neg: false, n: { t: 'OP', op: '' } } };
      const P = fbdExprIn(root.in, err, d); emitEl(root.t === 'ASSIGN' ? { ...root, t: 'COIL' } : root, P, emit, err, reg); disp.push(d); }
    map.push({ from: start, to: lines.length, net: ni });
  });
  return { text: lines.join('\n'), map, errs, temps, disp };
}

/* ===================== Projekt übersetzen ===================== */
const VALID_ADDR = { Bool: /^%[IQM]\d+\.[0-7]$/i, Byte: /^%[IQM]B\d+$/i, Int: /^%[IQM]W\d+$/i, UInt: /^%[IQM]W\d+$/i, Word: /^%[IQM]W\d+$/i, DInt: /^%[IQM]D\d+$/i, Real: /^%[IQM]D\d+$/i, Time: /^%[IQM]D\d+$/i, LReal: /^%[IQM]D\d+$/i };
function compileProject(P) {
  const reg = buildReg(P), msgs = [], code = new Map();
  const M = (lvl, msg, o = {}) => msgs.push({ lvl, msg, ...o });
  const names = new Map();
  for (const t of P.tags) { if (!t.name) { M('err', 'Variable ohne Namen', { tags: 1 }); continue; }
    const lo = t.name.toLowerCase(); if (names.has(lo)) M('err', `Name „${t.name}“ mehrfach vergeben`, { tags: 1 }); names.set(lo, 1);
    const ty = normType(t.type); if (!BASIC_TYPES.includes(ty)) M('err', `Variable „${t.name}“: Datentyp „${t.type}“ unbekannt`, { tags: 1 });
    if (!t.addr) M('warn', `Variable „${t.name}“ hat keine Adresse`, { tags: 1 });
    else if (VALID_ADDR[ty] && !VALID_ADDR[ty].test(t.addr.trim())) M('warn', `Variable „${t.name}“: Adresse ${t.addr} passt nicht zu ${ty}`, { tags: 1 });
    try { if (t.init) parseInit(t.init, ty, reg); } catch (e) { M('err', `Variable „${t.name}“: ${e.msg}`, { tags: 1 }); } }
  const addrs = new Map(); for (const t of P.tags) if (t.addr) { const a = t.addr.trim().toUpperCase(); if (addrs.has(a)) M('warn', `Adresse ${a} doppelt belegt („${addrs.get(a)}“, „${t.name}“)`, { tags: 1 }); addrs.set(a, t.name); }
  for (const b of P.blocks) { const lo = b.name.toLowerCase(); if (names.has(lo)) M('err', `Name „${b.name}“ mehrfach vergeben (Variable/Baustein)`, { block: b.name }); names.set(lo, 1); }
  const typeOk = (t, sec) => { const c = canonType(t, reg); if (BASIC_TYPES.includes(c)) return true;
    if (IEC[c] || (reg.blocks.get(c.toLowerCase()) || {}).type === 'FB') return sec === 'Static' || sec === 'Temp' || sec === 'InOut'; return false; };
  for (const b of P.blocks) {
    const seen = new Set();
    for (const s of SECTIONS[b.type] || []) for (const v of (b.iface && b.iface[s]) || []) {
      if (!v.name) { M('err', `Schnittstelle ${s}: Variable ohne Namen`, { block: b.name }); continue; }
      if (!/^[A-Za-z_]\w*$/.test(v.name)) M('err', `Ungültiger Name „${v.name}“`, { block: b.name });
      const lo = v.name.toLowerCase(); if (seen.has(lo)) M('err', `Lokaler Name „${v.name}“ doppelt`, { block: b.name }); seen.add(lo);
      if (!typeOk(v.type, s)) M('err', `„${v.name}“: Datentyp „${v.type}“ ${typeKind(canonType(v.type, reg), reg) ? 'hier nicht erlaubt' : 'unbekannt'}`, { block: b.name });
      else if (v.init) { try { parseInit(v.init, canonType(v.type, reg), reg); } catch (e) { M('err', `„${v.name}“: ${e.msg}`, { block: b.name }); } }
      if (canonType(v.type, reg) === b.name) M('err', `FB „${b.name}“ kann sich nicht selbst als Instanz enthalten`, { block: b.name }); }
    if (b.type === 'DB' && b.instanceOf) { const c = canonType(b.instanceOf, reg); if (!IEC[c] && (reg.blocks.get(c.toLowerCase()) || {}).type !== 'FB') M('err', `Instanz-DB „${b.name}“: Typ „${b.instanceOf}“ ist kein FB`, { block: b.name }); }
    if (b.type === 'DB') continue;
    const g = blockScl(b, reg); for (const e of g.errs) M('err', e.msg, { block: b.name, net: e.net });
    const sc = makeScope(b, reg, g.temps); let stmts = [];
    try { const ps = new Parser(lex(g.text)); const perr = []; const ast = ps.program(perr); sc.errs.push(...perr); stmts = compileList(ast, sc); }
    catch (e) { if (e instanceof SclError) sc.errs.push({ line: e.line, msg: e.msg }); else throw e; }
    const where = l => { if (!g.map) return { line: l }; const m = g.map.find(m => l >= m.from && l <= m.to); return { net: m ? m.net : 0 }; };
    for (const e of sc.errs) M('err', e.msg, { block: b.name, ...where(e.line) });
    for (const w of sc.warns) M('warn', w.msg, { block: b.name, ...where(w.line) });
    const localDefs = [...sc.vars.values()].filter(v => b.type === 'FB' ? v.sec === 'Temp' : true);
    code.set(b.name.toLowerCase(), { block: b, stmts, sc, locals: localDefs, gen: g });
  }
  const obs = P.blocks.filter(b => b.type === 'OB');
  if (!obs.some(b => (b.number | 0) === 1 || b.number >= 123)) M('warn', 'Kein Programmzyklus-OB (OB1) vorhanden');
  const errs = msgs.filter(m => m.lvl === 'err').length, warns = msgs.filter(m => m.lvl === 'warn').length;
  M(errs ? 'err' : 'ok', `Übersetzen beendet: ${errs} Fehler, ${warns} Warnungen`);
  return { code, msgs, reg, ok: errs === 0 };
}

/* ===================== Simulierte CPU ===================== */
function mergeMem(n, o) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(n)) if (k in o) {
  if (n[k] && typeof n[k] === 'object') mergeMem(n[k], o[k]); else if (typeof n[k] === typeof o[k]) n[k] = o[k]; } for (const k of Object.keys(o)) if (k[0] === '_' && !(k in n)) n[k] = o[k]; }
class PLC {
  constructor() { this.state = 'STOP'; this.G = {}; this.D = {}; this.prog = null; this.last = {}; this.diag = []; this.cyc = { last: 0, min: 0, max: 0, n: 0 }; this.timer = null; this.onEvent = () => {}; }
  log(msg, lvl = 'info') { this.diag.unshift({ t: new Date(), msg, lvl }); if (this.diag.length > 200) this.diag.pop(); this.onEvent('diag'); }
  initMem(prog, P, keep) {
    const reg = prog.reg, G = {}, D = {};
    for (const t of P.tags) if (t.name) G[t.name] = defVal(normType(t.type), t.init, reg);
    for (const b of P.blocks) if (b.type === 'DB') D[b.name] = b.instanceOf ? defVal(canonType(b.instanceOf, reg), null, reg) : (() => { const o = {}; for (const v of ifaceVars(b, ['Static'])) o[v.name] = defVal(canonType(v.type, reg), v.init, reg); return o; })();
    if (keep) { mergeMem(G, this.G); mergeMem(D, this.D); }
    this.G = G; this.D = D;
  }
  load(prog, P) { this.initMem(prog, P, true); this.prog = prog; this.last = {}; this.log('Programm in CPU geladen (' + prog.code.size + ' Codebausteine)'); }
  memReset(P) { if (!this.prog) return; const wasRun = this.state === 'RUN'; if (wasRun) this.stop('Urlöschen'); this.initMem(this.prog, P, false); this.last = {}; this.log('Urlöschen: Datenwerte auf Startwerte zurückgesetzt'); }
  newLocals(lo) { const cb = this.prog.code.get(lo); const L = {}; for (const v of cb.locals) L[v.name] = defVal(v.type, v.init, this.prog.reg); return L; }
  exec(lo, L, ctx) {
    const cb = this.prog.code.get(lo); if (!cb) throw new PlcError('Baustein „' + lo + '“ nicht geladen');
    if (++ctx.depth > 24) throw new PlcError('Maximale Schachtelungstiefe überschritten');
    const prev = ctx.L, prevB = ctx.blk; ctx.L = L; ctx.blk = cb.block.name;
    try { execList(cb.stmts, ctx); } finally { ctx.L = prev; ctx.blk = prevB; ctx.depth--; }
    this.last[lo] = L;
  }
  runFB(lo, inst, ctx) { const cb = this.prog.code.get(lo); if (!cb) throw new PlcError('FB „' + lo + '“ nicht geladen');
    for (const v of cb.locals) inst[v.name] = defVal(v.type, v.init, this.prog.reg); this.exec(lo, inst, ctx); }
  ctx(now) { return { G: this.G, D: this.D, L: null, now: now ?? (typeof performance !== 'undefined' ? performance.now() : Date.now()), rt: this, guard: 0, depth: 0, blk: null }; }
  runOBs(filter, now) { const obs = [...this.prog.code.values()].filter(c => c.block.type === 'OB' && filter(c.block.number | 0)).sort((a, b) => (a.block.number | 0) - (b.block.number | 0));
    const ctx = this.ctx(now); for (const cb of obs) { ctx.guard = 0; this.exec(cb.block.name.toLowerCase(), this.newLocals(cb.block.name.toLowerCase()), ctx); } return ctx; }
  scan(now) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(); let ctx;
    try { ctx = this.runOBs(n => n === 1 || n >= 123, now); }
    catch (e) { this.stop('Laufzeitfehler' + (e && e.message ? ': ' + e.message : ''), 'err'); if (!(e instanceof PlcError)) console.error(e); return; }
    const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0; const c = this.cyc; c.last = dt; c.n++;
    c.min = c.n === 1 ? dt : Math.min(c.min, dt); c.max = Math.max(c.max, dt);
  }
  start(interval = 10) {
    if (!this.prog) { this.log('Kein Programm geladen', 'warn'); return false; } if (this.state === 'RUN') return true;
    try { this.runOBs(n => n === 100); } catch (e) { this.stop('Fehler im Anlauf-OB: ' + e.message, 'err'); return false; }
    this.state = 'RUN'; this.cyc = { last: 0, min: 0, max: 0, n: 0 }; this.log('Betriebszustand STOP → RUN');
    if (typeof setInterval !== 'undefined' && interval) this.timer = setInterval(() => this.scan(), interval);
    this.onEvent('state'); return true;
  }
  stop(reason, lvl = 'info') { if (this.timer) clearInterval(this.timer); this.timer = null; const was = this.state; this.state = 'STOP';
    this.log((was === 'RUN' ? 'Betriebszustand RUN → STOP' : 'STOP') + (reason ? ' – ' + reason : ''), lvl); this.onEvent('state'); }
}

/* ===================== Externe Quellen (.scl) ===================== */
function indent(s, n = 3) { const p = ' '.repeat(n); return s.split('\n').map(l => l ? p + l : l).join('\n'); }
function declLine(v) { return `${v.name} : ${/^[A-Za-z_]\w*$/.test(v.type) && !IEC[normType(v.type)] && !BASIC_TYPES.includes(normType(v.type)) ? '"' + v.type + '"' : normType(v.type)}${v.init ? ' := ' + v.init : ''};${v.comment ? '   // ' + v.comment : ''}`; }
const SEC_KW = { Input: 'VAR_INPUT', Output: 'VAR_OUTPUT', InOut: 'VAR_IN_OUT', Static: 'VAR', Temp: 'VAR_TEMP' };
function genSource(P) {
  const reg = buildReg(P), out = [];
  const order = { FB: 0, FC: 1, DB: 2, OB: 3 }; const blocks = [...P.blocks].sort((a, b) => order[a.type] - order[b.type] || (a.number | 0) - (b.number | 0));
  for (const b of blocks) {
    const vars = (SECTIONS[b.type] || []).map(s => { const vs = (b.iface && b.iface[s]) || []; if (!vs.length && b.type !== 'DB') return ''; return indent(`${SEC_KW[s]}\n${indent(vs.map(declLine).join('\n'))}\nEND_VAR`) + '\n'; }).join('');
    if (b.type === 'DB') {
      out.push(`DATA_BLOCK "${b.name}"\n{ S7_Optimized_Access := 'TRUE' }\nVERSION : 0.1\nNON_RETAIN\n${b.instanceOf ? (IEC[canonType(b.instanceOf, reg)] ? canonType(b.instanceOf, reg) : '"' + canonType(b.instanceOf, reg) + '"') + '\n' : vars}\nBEGIN\n\nEND_DATA_BLOCK\n`); continue; }
    const g = blockScl(b, reg); let body = g.text; let tempDecl = '';
    if (g.temps.length) tempDecl = indent(`VAR_TEMP\n${indent(g.temps.map(t => `${t.name} : Bool;`).join('\n'))}\nEND_VAR`) + '\n';
    let v2 = vars; if (tempDecl) { if (/VAR_TEMP\n/.test(v2)) v2 = v2.replace(/(VAR_TEMP\n)/, '$1' + g.temps.map(t => `      ${t.name} : Bool;\n`).join('')); else v2 += tempDecl; }
    const hdr = b.type === 'FB' ? `FUNCTION_BLOCK "${b.name}"` : b.type === 'FC' ? `FUNCTION "${b.name}" : Void` : `ORGANIZATION_BLOCK "${b.name}"\nTITLE = "${(b.number | 0) === 100 ? 'Startup' : 'Main Program Sweep (Cycle)'}"`;
    const end = b.type === 'FB' ? 'END_FUNCTION_BLOCK' : b.type === 'FC' ? 'END_FUNCTION' : 'END_ORGANIZATION_BLOCK';
    const note = b.lang !== 'SCL' ? `// Automatisch aus ${b.lang === 'LAD' ? 'KOP' : 'FUP'} erzeugt\n` : '';
    out.push(`${hdr}\n{ S7_Optimized_Access := 'TRUE' }\nVERSION : 0.1\n${v2}\nBEGIN\n${indent(note + body)}\nEND_${end.slice(4)}\n`);
  }
  return out.join('\n');
}
function dedent(s) { const ls = s.replace(/\t/g, '   ').split('\n'); while (ls.length && !ls[0].trim()) ls.shift(); while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
  const ind = Math.min(...ls.filter(l => l.trim()).map(l => l.match(/^ */)[0].length), 99); return ls.map(l => l.slice(Math.min(ind, l.match(/^ */)[0].length))).join('\n'); }
function parseSource(text) {
  const res = [], re = /\b(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK|DATA_BLOCK)\s+("([^"]+)"|([A-Za-z_]\w*))([\s\S]*?)\bEND_\1\b/g; let m;
  const secMap = { VAR_INPUT: 'Input', VAR_OUTPUT: 'Output', VAR_IN_OUT: 'InOut', VAR_TEMP: 'Temp', VAR: 'Static' };
  while ((m = re.exec(text))) {
    const kind = m[1], name = m[3] || m[4]; let rest = m[5];
    const type = { FUNCTION_BLOCK: 'FB', FUNCTION: 'FC', ORGANIZATION_BLOCK: 'OB', DATA_BLOCK: 'DB' }[kind];
    const bi = rest.search(/^\s*BEGIN\b/m); const head = bi >= 0 ? rest.slice(0, bi) : rest; let body = bi >= 0 ? rest.slice(bi).replace(/^\s*BEGIN\b/, '') : '';
    const iface = {}; const vre = /\b(VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_TEMP|VAR)\b(?:\s+(?:RETAIN|NON_RETAIN|CONSTANT|DB_SPECIFIC))?([\s\S]*?)\bEND_VAR\b/g; let v;
    while ((v = vre.exec(head))) { const sec = type === 'DB' ? 'Static' : secMap[v[1]]; iface[sec] = iface[sec] || [];
      const dre = /^\s*"?([A-Za-z_]\w*)"?\s*(?:\{[^}]*\})?\s*:\s*([^;]+?)\s*(?::=\s*([^;]+?))?\s*;[ \t]*(?:\/\/(.*))?$/gm; let d;
      while ((d = dre.exec(v[2]))) { if (/^\s*(STRUCT|ARRAY)/i.test(d[2])) continue; iface[sec].push({ name: d[1], type: normType(d[2]), init: (d[3] || '').trim(), comment: (d[4] || '').trim() }); } }
    const b = { name, type, iface };
    if (type === 'DB') { const rem = head.replace(/\{[^}]*\}/g, '').replace(/\b(VAR[\s\S]*?END_VAR)\b/g, '').replace(/^\s*(VERSION|TITLE|AUTHOR|FAMILY|NAME)\s*[:=].*$/gim, '').replace(/\bNON_RETAIN\b|\bRETAIN\b/g, '').trim();
      if (rem) b.instanceOf = normType(rem.split(/\s+/)[0]); delete b.iface; if (!b.instanceOf) b.iface = { Static: iface.Static || [] }; }
    else { b.lang = 'SCL'; b.scl = dedent(body); }
    res.push(b);
  }
  return res;
}

if (typeof module !== 'undefined') module.exports = { lex, Parser, compileProject, PLC, genSource, parseSource, blockScl, buildReg, compileExprString, makeScope, IEC };
