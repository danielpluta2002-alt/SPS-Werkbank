'use strict';
/* =====================================================================
   AWL (Anweisungsliste / STL): Parser, Compiler, Laufzeit, Umwandlung
   Deutsche (U, UN, SPB …) und internationale (A, AN, JC …) Mnemonik
   ===================================================================== */
const MN_TO_INT = { U: 'A', UN: 'AN', 'U(': 'A(', 'UN(': 'AN(', SPA: 'JU', SPB: 'JC', SPBN: 'JCN', BEA: 'BEU', BEB: 'BEC', UW: 'AW', UD: 'AD' };
const AWL_BITOPS = ['A', 'AN', 'O', 'ON', 'X', 'XN'];
const AWL_CMP = { '==': (a, b) => a === b, '<>': (a, b) => a !== b, '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b };
const AWL_KNOWN = new Set([...AWL_BITOPS, 'A(', 'AN(', 'O(', 'ON(', 'X(', 'XN(', ')', 'NOT', 'SET', 'CLR', 'SAVE', '=', 'S', 'R', 'FP', 'FN', 'L', 'T', 'TAK',
  '+I', '-I', '*I', '/I', '+D', '-D', '*D', '/D', '+R', '-R', '*R', '/R', 'MOD', '+', 'NEGI', 'NEGD', 'NEGR', 'ABS', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN',
  'ITD', 'DTR', 'ITR', 'RND', 'TRUNC', 'RND+', 'RND-', 'INVI', 'INVD', 'INC', 'DEC', 'AW', 'OW', 'XOW', 'AD', 'OD', 'XOD', 'SLW', 'SRW', 'SLD', 'SRD', 'RLD', 'RRD', 'SSI', 'SSD',
  'JU', 'JC', 'JCN', 'BE', 'BEU', 'BEC', 'NOP', 'CALL',
  ...['I', 'D', 'R'].flatMap(s => Object.keys(AWL_CMP).map(c => c + s))]);
const AWL_HELP = {
  A: 'UND', AN: 'UND NICHT', O: 'ODER', ON: 'ODER NICHT', X: 'EXKLUSIV-ODER', XN: 'EXKLUSIV-ODER NICHT', '=': 'Zuweisung', S: 'Setzen', R: 'Rücksetzen', NOT: 'VKE negieren', SET: 'VKE = 1', CLR: 'VKE = 0',
  FP: 'Flanke positiv', FN: 'Flanke negativ', L: 'Laden in AKKU 1', T: 'Transferieren aus AKKU 1', JU: 'Springe unbedingt', JC: 'Springe bei VKE = 1', JCN: 'Springe bei VKE = 0', BE: 'Bausteinende', BEU: 'Bausteinende unbedingt', BEC: 'Bausteinende bei VKE = 1', CALL: 'Baustein aufrufen'
};

function splitTop(s, sep) { const out = []; let d = 0, q = false, cur = ''; for (const ch of s) { if (ch === '"' || ch === "'") q = !q; if (!q) { if (ch === '(') d++; if (ch === ')') d--; if (ch === sep && d === 0) { out.push(cur); cur = ''; continue; } } cur += ch; } if (cur.trim()) out.push(cur); return out.map(x => x.trim()); }
function stripComment(l) { let q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"' || c === "'") q = !q; if (!q && c === '/' && l[i + 1] === '/') return l.slice(0, i); } return l; }
/** Zerlegt AWL-Code eines Netzwerks in Anweisungen {line, label, op, arg, params} */
function parseAwlCode(code) {
  const raw = String(code || '').split('\n'); const out = []; let pendingLabel = null;
  for (let i = 0; i < raw.length; i++) {
    let t = stripComment(raw[i]).trim().replace(/;\s*$/, '').trim(); if (!t) continue;
    let label = null; const ml = /^([A-Za-z_]\w*)\s*:(?!=)\s*(.*)$/.exec(t);
    if (ml && !/^(T|TIME|S5T)$/i.test(ml[1])) { label = ml[1]; t = ml[2].trim(); if (!t) { pendingLabel = label; continue; } }
    if (pendingLabel) { if (label) out.push({ line: i + 1, label: pendingLabel, op: 'NOP', arg: '0' }); else label = pendingLabel; pendingLabel = null; }
    const mm = /^(\S+)\s*(.*)$/.exec(t); let op = mm[1].toUpperCase(), arg = mm[2].trim();
    if (/^[A-Z]+\($/.test(op) === false && arg === '(' && ['U', 'UN', 'A', 'AN', 'O', 'ON', 'X', 'XN'].includes(op)) { op += '('; arg = ''; }
    if (op.endsWith('(') && op.length > 1 && arg) { /* z. B. "U(" mit Rest */ }
    op = MN_TO_INT[op] || op;
    const ins = { line: i + 1, label, op, arg };
    if (op === 'CALL') {
      const params = []; let a = arg; const pi = a.indexOf('(');
      if (pi >= 0) { const inner = a.slice(pi + 1).replace(/\)\s*$/, ''); a = a.slice(0, pi).trim(); for (const p of splitTop(inner, ',')) { const m = /^([A-Za-z_][\w/]*)\s*:=\s*(.*)$/.exec(p); if (m) params.push([m[1], m[2].trim()]); } }
      else { // Parameter in Folgezeilen
        let j = i + 1;
        while (j < raw.length) { const l = stripComment(raw[j]).trim().replace(/;\s*$/, '').trim(); if (!l) { j++; continue; }
          if (l === '(' || l === ')') { j++; if (l === ')') break; continue; }
          const m = /^\(?\s*([A-Za-z_][\w/]*)\s*:=\s*(.*?)\s*,?\s*(\))?$/.exec(l); if (!m) break;
          params.push([m[1], m[2].replace(/,\s*$/, '').trim()]); j++; if (m[3]) break; }
        i = j - 1; }
      ins.arg = a; ins.params = params;
    }
    out.push(ins);
  }
  if (pendingLabel) out.push({ line: raw.length, label: pendingLabel, op: 'NOP', arg: '0' });
  return out;
}

/* ---------- Laufzeit-Zustand ---------- */
const rloOf = st => st.orP || st.andP;
function bitA(st, v) { if (!st.fc) { st.orP = false; st.andP = v; st.fc = true; } else if (st.grp) { st.andP = v; st.grp = false; } else st.andP = st.andP && v; }
function bitO(st, v) { if (!st.fc) { st.orP = false; st.andP = v; st.fc = true; } else { st.orP = st.orP || st.andP; st.andP = v; } st.grp = false; }
function bitX(st, v) { if (!st.fc) { st.orP = false; st.andP = v; st.fc = true; return; } const r = rloOf(st); st.orP = false; st.andP = r !== v; st.grp = false; }
const BITF = { A: bitA, O: bitO, X: bitX };
const w16 = v => { v = Math.trunc(v) || 0; v = ((v + 32768) % 65536 + 65536) % 65536 - 32768; return v; };
const w32 = v => { v = Math.trunc(v) || 0; return v | 0; };

function compileAwlBlock(b, sc) {
  const instrs = [], errs = [];
  (b.networks || []).forEach((n, ni) => { try { for (const x of parseAwlCode(n.awl)) instrs.push({ ...x, net: ni }); } catch (e) { errs.push({ net: ni, line: 0, msg: String(e.message || e) }); } });
  const labels = new Map(); instrs.forEach((x, i) => { if (x.label) { const k = x.label.toUpperCase(); if (labels.has(k)) errs.push({ net: x.net, line: x.line, msg: `Sprungmarke ${x.label} doppelt` }); labels.set(k, i); } });
  const temps = [];
  const E = (x, msg) => errs.push({ net: x.net, line: x.line, msg });
  const ops = instrs.map((x, idx) => { try { return awlOp(x, idx); } catch (e) { if (e instanceof SclError) { E(x, e.msg); return () => undefined; } throw e; } });
  const mon = { r: new Array(ops.length).fill(null), a1: new Array(ops.length).fill(null), seen: new Array(ops.length).fill(0), instrs, tick: 0 };
  const run = c => {
    const st = { orP: false, andP: false, fc: false, grp: false, nest: [], a1: 0, a2: 0 }; const n = ops.length; let pc = 0; const tick = ++mon.tick;
    while (pc < n) { if (++c.guard > 3e6) throw new PlcError('Zykluszeitüberwachung angesprochen (Endlosschleife in AWL?)');
      const r = ops[pc](st, c); mon.r[pc] = rloOf(st); mon.a1[pc] = st.a1; mon.seen[pc] = tick;
      if (r === -1) break; pc = r === undefined ? pc + 1 : r; }
    return 0;
  };
  return { stmts: [run], errs, temps, mon };

  function boolF(arg, x) { if (!arg) throw new SclError('Operand fehlt'); const e = compileExprString(arg, sc); if (e.t !== 'Bool' && e.t !== 'any') throw new SclError(`Bitoperand erwartet, „${arg}“ ist ${e.t}`); return e.f; }
  function valF(arg) { if (!arg) throw new SclError('Operand fehlt'); return compileExprString(arg, sc); }
  function refW(arg) { if (!arg) throw new SclError('Operand fehlt'); const r = compileRefString(arg, sc); if (r.kind !== 'bool' && r.kind !== 'num') throw new SclError(`„${arg}“ kann nicht beschrieben werden`); return r; }
  function jumpTo(lbl) { const k = String(lbl || '').toUpperCase(); if (!k) throw new SclError('Sprungmarke fehlt'); if (!labels.has(k)) throw new SclError(`Sprungmarke ${lbl} nicht gefunden`); return labels.get(k); }
  function constN(arg) { const t = lex(arg); let neg = false, i = 0; if (t[0].t === 'op' && t[0].v === '-') { neg = true; i = 1; } if (t[i].t !== 'num') throw new SclError('Konstante erwartet'); return neg ? -t[i].v : t[i].v; }
  function awlOp(x, idx) {
    const { op, arg } = x;
    if (op === 'O' && !arg) return st => { st.orP = st.orP || st.andP; st.andP = false; st.grp = true; st.fc = true; };
    if (BITF[op[0]] && /^(A|AN|O|ON|X|XN)$/.test(op)) { const f = boolF(arg), neg = op.endsWith('N'), fn = BITF[op[0]]; return (st, c) => { fn(st, neg ? !f(c) : !!f(c)); }; }
    if (/^(A|AN|O|ON|X|XN)\($/.test(op)) { const neg = op.includes('N'), fn = BITF[op[0]]; return st => { st.nest.push({ fn, neg, orP: st.orP, andP: st.andP, fc: st.fc, grp: st.grp }); st.fc = false; st.grp = false; }; }
    switch (op) {
      case ')': return st => { const s = st.nest.pop(); if (!s) throw new PlcError('„)“ ohne „(“'); let v = rloOf(st); st.orP = s.orP; st.andP = s.andP; st.fc = s.fc; st.grp = s.grp; s.fn(st, s.neg ? !v : v); };
      case 'O': if (!arg) return st => { st.orP = st.orP || st.andP; st.andP = false; st.grp = true; st.fc = true; }; break;
      case 'NOT': return st => { const v = !rloOf(st); st.orP = false; st.andP = v; };
      case 'SET': return st => { st.orP = false; st.andP = true; st.fc = false; };
      case 'CLR': return st => { st.orP = false; st.andP = false; st.fc = false; };
      case 'SAVE': case 'NOP': return () => undefined;
      case '=': { const r = refW(arg); if (r.t !== 'Bool') throw new SclError('Zuweisung „=“ nur auf Bitoperanden'); return (st, c) => { r.set(c, rloOf(st)); st.fc = false; }; }
      case 'S': case 'R': { const r = refW(arg); if (r.t !== 'Bool') throw new SclError(`${op} nur auf Bitoperanden`); const v = op === 'S'; return (st, c) => { if (rloOf(st)) r.set(c, v); st.fc = false; }; }
      case 'FP': case 'FN': { const r = refW(arg); const g = r.get; const pos = op === 'FP'; return (st, c) => { const v = rloOf(st), m = !!g(c); r.set(c, v); const e = pos ? v && !m : !v && m; st.orP = false; st.andP = e; st.fc = true; }; }
      case 'L': { const e = valF(arg), f = e.f; return (st, c) => { st.a2 = st.a1; const v = f(c); st.a1 = typeof v === 'boolean' ? (v ? 1 : 0) : v; }; }
      case 'T': { const r = refW(arg); return (st, c) => { r.set(c, r.t === 'Bool' ? !!st.a1 : st.a1); }; }
      case 'TAK': return st => { const t = st.a1; st.a1 = st.a2; st.a2 = t; };
      case '+': { const k = constN(arg); return st => { st.a1 = st.a1 + k; }; }
      case 'INC': case 'DEC': { const k = arg ? constN(arg) : 1; const s = op === 'INC' ? k : -k; return st => { st.a1 = st.a1 + s; }; }
      case 'MOD': return st => { st.a1 = st.a1 === 0 ? 0 : w32(st.a2 % st.a1); };
      case 'NEGI': return st => { st.a1 = w16(-st.a1); }; case 'NEGD': return st => { st.a1 = w32(-st.a1); }; case 'NEGR': return st => { st.a1 = -st.a1; };
      case 'ABS': return st => { st.a1 = Math.abs(st.a1); };
      case 'ITD': case 'DTR': case 'ITR': return () => undefined;
      case 'RND': return st => { st.a1 = Math.round(st.a1); }; case 'TRUNC': return st => { st.a1 = Math.trunc(st.a1); };
      case 'RND+': return st => { st.a1 = Math.ceil(st.a1); }; case 'RND-': return st => { st.a1 = Math.floor(st.a1); };
      case 'INVI': return st => { st.a1 = (~st.a1) & 0xFFFF; }; case 'INVD': return st => { st.a1 = (~st.a1) >>> 0; };
      case 'AW': case 'OW': case 'XOW': case 'AD': case 'OD': case 'XOD': { const k = arg ? constN(arg) : null; const m = op.endsWith('W') ? 0xFFFF : 0xFFFFFFFF; const o = op[0];
        const F = o === 'A' ? (a, b) => a & b : o === 'O' ? (a, b) => a | b : (a, b) => a ^ b; return st => { const b2 = k === null ? st.a2 : k; st.a1 = (F(b2, st.a1) & m) >>> 0; }; }
      case 'SLW': case 'SRW': case 'SLD': case 'SRD': case 'RLD': case 'RRD': case 'SSI': case 'SSD': { const k = arg ? constN(arg) : null;
        return st => { const n = (k === null ? st.a2 : k) & 31; const v = st.a1;
          switch (op) { case 'SLW': st.a1 = (v << n) & 0xFFFF; break; case 'SRW': st.a1 = (v & 0xFFFF) >>> n; break; case 'SLD': st.a1 = (v << n) >>> 0; break; case 'SRD': st.a1 = (v >>> 0) >>> n; break;
            case 'RLD': st.a1 = ((v << n) | (v >>> (32 - n))) >>> 0; break; case 'RRD': st.a1 = ((v >>> n) | (v << (32 - n))) >>> 0; break; case 'SSI': st.a1 = w16(v) >> n; break; case 'SSD': st.a1 = (v | 0) >> n; break; } }; }
      case 'JU': { const t = jumpTo(arg); return () => t; }
      case 'JC': case 'JCN': { const t = jumpTo(arg); const want = op === 'JC'; return st => { const r = rloOf(st); st.fc = false; st.orP = false; st.andP = true; return r === want ? t : undefined; }; }
      case 'BE': case 'BEU': return () => -1;
      case 'BEC': return st => { if (rloOf(st)) return -1; st.fc = false; st.orP = false; st.andP = true; };
      case 'CALL': return awlCall(x);
    }
    const ar = /^([+\-*/])([IDR])$/.exec(op);
    if (ar) { const o = ar[1], ty = ar[2]; const w = ty === 'I' ? w16 : ty === 'D' ? w32 : v => v;
      const F = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => ty === 'R' ? a / b : (b === 0 ? 0 : Math.trunc(a / b)) }[o];
      return st => { st.a1 = w(F(st.a2, st.a1)); }; }
    const cm = /^(==|<>|>=|<=|>|<)([IDR])$/.exec(op);
    if (cm) { const F = AWL_CMP[cm[1]]; return st => bitA(st, F(st.a2, st.a1)); }
    const fn = { SQR: v => v * v, SQRT: Math.sqrt, EXP: Math.exp, LN: Math.log, SIN: Math.sin, COS: Math.cos, TAN: Math.tan, ASIN: Math.asin, ACOS: Math.acos, ATAN: Math.atan }[op];
    if (fn) return st => { st.a1 = fn(st.a1); };
    throw new SclError(`Unbekannte Anweisung „${x.op}“`);
  }
  function awlCall(x) {
    const parts = splitTop(x.arg, ','); const params = (x.params || []).filter(([k]) => !/_type$/i.test(k));
    if (!parts.length || !parts[0]) throw new SclError('CALL: Baustein fehlt');
    const first = parts[0], up = first.toUpperCase();
    if (parts.length === 1 && /^[A-Za-z_]\w*$/.test(first) && INS[up] && ['en', 'fn'].includes(INS[up].kind)) return catalogCall(up, params);
    const target = parts.length >= 2 ? parts[1] : first;
    const outs = calleeOuts(target);
    const args = params.filter(([, v]) => v !== '').map(([k, v]) => outs.has(k.toLowerCase()) ? `${k} => ${v}` : `${k} := ${v}`);
    return sclStmts(`${target}(${args.join(', ')});`, x, st => { st.fc = false; });
  }
  function calleeOuts(target) {
    const set = new Set(); let r;
    try { const ps = new Parser(lex(target)); const ref = ps.ref();
      if (ref.root.k !== 'lid' && !ref.path.length) { const b = sc.reg.blocks.get(ref.root.name.toLowerCase()); if (b && b.type === 'FC') { ifaceVars(b, ['Output']).forEach(v => set.add(v.name.toLowerCase())); return set; } }
      r = compileRef(ref, sc); } catch (e) { return set; }
    let t = r.t; if (t.startsWith('DB:')) { const db = sc.reg.blocks.get(t.slice(3).toLowerCase()); t = db && db.instanceOf ? canonType(db.instanceOf, sc.reg) : ''; }
    if (IEC[t]) Object.keys(IEC[t].outs).forEach(k => set.add(k.toLowerCase()));
    const fb = sc.reg.blocks.get(String(t).toLowerCase()); if (fb && fb.type === 'FB') ifaceVars(fb, ['Output']).forEach(v => set.add(v.name.toLowerCase()));
    return set;
  }
  function sclStmts(text, x, after) {
    const before = sc.errs.length; const perr = []; const ast = new Parser(lex(text)).program(perr); const st = compileList(ast, sc);
    const all = [...perr, ...sc.errs.splice(before)]; if (all.length) throw new SclError(all[0].msg);
    return (s, c) => { execList(st, c); if (after) after(s); };
  }
  function catalogCall(id, params) {
    const d = INS[id]; const box = newBox(id); const pm = new Map(params.map(([k, v]) => [k.toUpperCase(), v]));
    if (pm.has('TYP')) box.dtype = normType(pm.get('TYP')); if (pm.has('FORMEL')) box.expr = pm.get('FORMEL').replace(/^'|'$/g, '');
    if (d.varIn) box.n = Math.max(d.varIn.min, [...pm.keys()].filter(k => new RegExp('^' + d.varIn.pre + '\\d+$').test(k)).length);
    const { ins, outs } = boxPins(d, box);
    for (const q of ins) { if (q.en) continue; const v = pm.get(q.n.toUpperCase()) || ''; box.pins[q.n] = isLogicPin(q) ? (v ? leaf(v) : { neg: false, n: null }) : v; }
    for (const q of outs) { if (q.main) continue; box.outs[q.n] = pm.get(q.n.toUpperCase()) || ''; }
    const lines = []; const gErr = []; let tc = 0;
    const g = { reg: sc.reg, disp: new Map(), emit: s => lines.push(s), err: m => gErr.push(m), temp: (type = 'Bool') => { const n = `__c${tc++}_${Math.random().toString(36).slice(2, 6)}`; sc.vars.set(n.toLowerCase(), { name: n, type, sec: 'Temp' }); temps.push({ name: n, type }); return '#' + n; }, label: () => 0 };
    const res = genBox(box, g, false); if (gErr.length) throw new SclError(`CALL ${id}: ${gErr[0]}`);
    if (d.kind === 'fn') { const e = compileExprString(res, sc); const f = e.f; return (st, c) => { st.orP = false; st.andP = !!f(c); st.fc = true; }; }
    return sclStmts(lines.join('\n'), null, st => { st.fc = false; });
  }
}

/* ---------- AWL → KOP/FUP ---------- */
const AWL_UNARY = { SQR: 'SQR', SQRT: 'SQRT', EXP: 'EXP', LN: 'LN', SIN: 'SIN', COS: 'COS', TAN: 'TAN', ASIN: 'ASIN', ACOS: 'ACOS', ATAN: 'ATAN', ABS: 'ABS', RND: 'ROUND', TRUNC: 'TRUNC', 'RND+': 'CEIL', 'RND-': 'FLOOR', NEGI: 'NEG', NEGD: 'NEG', NEGR: 'NEG', INVI: 'INVERT', INVD: 'INVERT' };
const AWL_BIN = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' };
function awlToNet(code, reg, blk) {
  const list = parseAwlCode(code); const roots = []; let label = null;
  let st = { andP: null, orP: null, fc: false, grp: false, nest: [], acc: [] };
  const gate = (t, a, b) => { if (a.n && a.n.t === t && !a.neg) return { neg: false, n: { t, ins: [...a.n.ins, b] } }; return { neg: false, n: { t, ins: [a, b] } }; };
  const rlo = () => { if (st.orP && st.andP) return gate('OR', st.orP, st.andP); return st.orP || st.andP || { neg: false, n: null }; };
  const neg = i => ({ neg: !i.neg, n: i.n });
  const A = v => { if (!st.fc) { st.orP = null; st.andP = v; st.fc = true; } else if (st.grp || !st.andP) { st.andP = v; st.grp = false; } else st.andP = gate('AND', st.andP, v); };
  const O = v => { if (!st.fc) { st.orP = null; st.andP = v; st.fc = true; } else { st.orP = st.orP && st.andP ? gate('OR', st.orP, st.andP) : (st.orP || st.andP); st.andP = v; } st.grp = false; };
  const X = v => { if (!st.fc) { st.orP = null; st.andP = v; st.fc = true; return; } const r = rlo(); st.orP = null; st.andP = gate('XOR', r, v); };
  const F = { A, O, X };
  const hasBox = i => { let f = false; if (i && i.n) walkNode(i.n, n => { if (n.t === 'BOX') f = true; }); return f; };
  const clone = o => JSON.parse(JSON.stringify(o));
  let lastOp = null, lastRlo = null, en = null, skip = null, pend = null, move = null;
  const useRlo = () => { const r = rlo(); if (lastRlo === r && hasBox(r) && lastOp) return leaf(lastOp); return clone(r); };
  const withEn = box => { if (en) box.pins.EN = clone(en); return box; };
  const fail = (x, why) => { throw new Error(why || `„${x.op}${x.arg ? ' ' + x.arg : ''}“ ist in KOP/FUP nicht darstellbar`); };
  const later = (i, lbl) => list.slice(i + 1).some(y => y.label && y.label.toUpperCase() === String(lbl).toUpperCase());
  const flushMove = () => { move = null; };
  const iecId = t => { const c = normType(t); return Object.keys(INS).find(k => INS[k].iec === c); };
  list.forEach((x, idx) => {
    if (x.label) { if (idx === 0) label = x.label; else if (skip && x.label.toUpperCase() === skip) { en = null; skip = null; } else fail(x, `Sprungmarke „${x.label}“ mitten im Netzwerk ist in KOP/FUP nicht darstellbar`); }
    const op = x.op, arg = x.arg;
    if (op !== 'T') flushMove();
    if (op === 'O' && !arg) { st.orP = st.orP && st.andP ? gate('OR', st.orP, st.andP) : (st.orP || st.andP); st.andP = null; st.grp = true; return; }
    if (/^(A|AN|O|ON|X|XN)$/.test(op)) { if (!arg) fail(x, 'Operand fehlt'); F[op[0]]({ neg: op.endsWith('N'), n: { t: 'OP', op: arg } }); return; }
    if (/^(A|AN|O|ON|X|XN)\($/.test(op)) { st.nest.push({ f: F[op[0]], neg: op.includes('N'), s: { ...st, nest: null, acc: [] } }); st.fc = false; st.grp = false; st.andP = null; st.orP = null; return; }
    switch (op) {
      case ')': { const s = st.nest.pop(); if (!s) fail(x, '„)“ ohne „(“'); const v = rlo(); const nest = st.nest; Object.assign(st, s.s); st.nest = nest; st.acc = []; s.f(s.neg ? neg(v) : v); return; }
      case 'NOT': { const v = neg(rlo()); st.orP = null; st.andP = v; return; }
      case 'SET': st.orP = null; st.andP = { neg: false, n: null }; st.fc = false; return;
      case 'NOP': case 'SAVE': return;
      case 'L': st.acc.push(arg); pend = null; if (st.acc.length > 2) fail(x, 'Mehr als zwei Ladebefehle hintereinander sind in KOP/FUP nicht darstellbar'); return;
      case 'T': {
        if (pend) { const bx = withEn(newBox(pend.id, pend.dtype ? { dtype: pend.dtype } : {})); const d = INS[pend.id]; const ii = boxPins(d, bx).ins.filter(q => !q.en);
          pend.ins.forEach((v, k) => { if (ii[k]) bx.pins[ii[k].n] = v; }); bx.outs.OUT = arg; roots.push({ k: 'BOX', box: bx }); pend = null; st.acc = []; return; }
        if (move) { move.n = (move.n || 1) + 1; move.outs['OUT' + move.n] = arg; return; }
        if (st.acc.length === 1) { const bx = withEn(newBox('MOVE')); bx.pins.IN = st.acc[0]; bx.outs.OUT1 = arg; roots.push({ k: 'BOX', box: bx }); move = bx; st.acc = []; return; }
        fail(x); }
      case '=': case 'S': case 'R': { if (en) fail(x, 'Zuweisung innerhalb eines EN-Sprungs ist in KOP/FUP nicht darstellbar'); const r = useRlo(); roots.push({ k: op, op: arg, in: r }); lastOp = op === '=' ? arg : null; lastRlo = rlo(); st.fc = false; return; }
      case 'FP': case 'FN': { const bx = newBox(op === 'FP' ? 'P_TRIG' : 'N_TRIG', { mem: arg }); bx.pins.CLK = clone(rlo()); st.orP = null; st.andP = { neg: false, n: bx }; st.fc = true; return; }
      case 'JCN': if (later(idx, arg) && !en) { en = clone(rlo()); skip = String(arg).toUpperCase(); st.fc = false; return; }
        roots.push({ k: 'JMPN', label: arg, in: useRlo() }); st.fc = false; return;
      case 'JC': roots.push({ k: 'JMP', label: arg, in: useRlo() }); st.fc = false; return;
      case 'BEC': roots.push({ k: 'RET', in: useRlo() }); st.fc = false; return;
      case 'CALL': { const bx = callToBox(x); if (INS[bx.i] && INS[bx.i].kind === 'fn') { st.orP = null; st.andP = { neg: false, n: bx }; st.fc = true; } else roots.push({ k: 'BOX', box: withEn(bx) }); st.fc = false; return; }
    }
    const cm = /^(==|<>|>=|<=|>|<)([IDR])$/.exec(op);
    if (cm && st.acc.length === 2) { const id = CMPS.find(c => c[1] === cm[1])[0]; const bx = newBox(id, { dtype: { I: 'Int', D: 'DInt', R: 'Real' }[cm[2]] }); bx.pins.IN1 = st.acc[0]; bx.pins.IN2 = st.acc[1]; st.acc = []; A({ neg: false, n: bx }); return; }
    const ar = /^([+\-*/])([IDR])$/.exec(op);
    if (ar && st.acc.length === 2) { pend = { id: AWL_BIN[ar[1]], dtype: { I: 'Int', D: 'DInt', R: 'Real' }[ar[2]], ins: st.acc.slice() }; st.acc = []; return; }
    if (op === 'MOD' && st.acc.length === 2) { pend = { id: 'MOD', dtype: 'DInt', ins: st.acc.slice() }; st.acc = []; return; }
    if (op === '+' && st.acc.length === 1) { pend = { id: 'ADD', dtype: 'Int', ins: [st.acc[0], arg] }; st.acc = []; return; }
    if (AWL_UNARY[op] && st.acc.length === 1) { pend = { id: AWL_UNARY[op], dtype: /R$/.test(op) || ['SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'RND', 'TRUNC', 'RND+', 'RND-'].includes(op) ? 'Real' : op.endsWith('D') ? 'DInt' : 'Int', ins: [st.acc[0]] }; st.acc = []; return; }
    fail(x);
  });
  if (st.nest.length) throw new Error('Klammer nicht geschlossen');
  if (en) throw new Error('EN-Sprung ohne Sprungziel');
  return { label: label || undefined, roots };

  function callToBox(x) {
    const parts = splitTop(x.arg, ','); const pm = new Map((x.params || []).filter(([k]) => !/_type$/i.test(k)).map(([k, v]) => [k, v]));
    const first = parts[0] || '', up = first.toUpperCase(); let box;
    const fill = bx => { const d = getDef(bx, reg); const { ins, outs } = boxPins(d, bx);
      for (const q of ins) { if (q.en) continue; const v = [...pm].find(([k]) => k.toUpperCase() === q.n.toUpperCase()); const val = v ? v[1] : '';
        bx.pins[q.n] = isLogicPin(q) ? (val ? leaf(val) : { neg: false, n: null }) : val; }
      for (const q of outs) { if (q.main && q.n === 'ENO') continue; const v = [...pm].find(([k]) => k.toUpperCase() === q.n.toUpperCase()); if (v) bx.outs[q.n] = v[1]; }
      return bx; };
    if (parts.length === 1 && /^[A-Za-z_]\w*$/.test(first) && INS[up]) { box = newBox(up); const typ = [...pm].find(([k]) => k.toUpperCase() === 'TYP'); if (typ) box.dtype = normType(typ[1]);
      const fo = [...pm].find(([k]) => k.toUpperCase() === 'FORMEL'); if (fo) box.expr = fo[1].replace(/^'|'$/g, '');
      if (INS[up].varIn) box.n = Math.max(INS[up].varIn.min, [...pm.keys()].filter(k => new RegExp('^' + INS[up].varIn.pre + '\\d+$', 'i').test(k)).length); return fill(box); }
    if (parts.length >= 2) { const id = iecId(first); if (id) return fill(newBox(id, { inst: parts[1] }));
      return fill({ t: 'BOX', i: 'CALL', blk: first.replace(/"/g, ''), inst: parts[1], pins: {}, outs: {} }); }
    if (first.startsWith('#')) { const v = blk && ifaceVars(blk, ['Static']).find(v => v.name.toLowerCase() === first.slice(1).toLowerCase()); if (!v) fail(x, `Multiinstanz ${first} unbekannt`);
      const t = canonType(v.type, reg); const id = iecId(t); if (id) return fill(newBox(id, { inst: first })); return fill({ t: 'BOX', i: 'CALL', blk: t, inst: first, pins: {}, outs: {} }); }
    if (first.startsWith('"')) { const nm = first.replace(/"/g, ''); const db = reg && reg.blocks.get(nm.toLowerCase());
      if (db && db.type === 'DB' && db.instanceOf) { const t = canonType(db.instanceOf, reg); const id = iecId(t); if (id) return fill(newBox(id, { inst: first })); return fill({ t: 'BOX', i: 'CALL', blk: t, inst: first, pins: {}, outs: {} }); }
      return fill({ t: 'BOX', i: 'CALL', blk: nm, pins: {}, outs: {} }); }
    fail(x);
  }
}

if (typeof module !== 'undefined') module.exports = { parseAwlCode, compileAwlBlock, awlToNet, AWL_KNOWN, AWL_HELP };
