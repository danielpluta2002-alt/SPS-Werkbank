const A = require('./harness');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FEHLER:', m); } else console.log('ok  ', m); };
const run = (P, steps, fn) => { const prog = A.compileProject(P); const errs = prog.msgs.filter(m => m.lvl === 'err'); if (errs.length) console.log(errs); const plc = new A.PLC(); plc.load(prog, P); plc.start(0); let t = 0; const step = (n = 1) => { for (let i = 0; i < n; i++) { t += 10; plc.scan(t); } }; fn(plc, step); return prog; };

// 1) Beispielprojekt
const P = A.exampleProject();
const prog = A.compileProject(P);
console.log(prog.msgs.map(m => `${m.lvl} ${m.block || ''} ${m.net ?? ''} ${m.msg}`).join('\n'));
ok(prog.ok, 'Beispielprojekt übersetzt ohne Fehler');
for (const [k, cb] of prog.code) if (cb.gen && cb.gen.text && cb.block.lang !== 'SCL') console.log('--- ' + k + '\n' + cb.gen.text);
run(P, 0, (plc, step) => {
  step(); plc.G.Start_Taster = true; step(); plc.G.Start_Taster = false; step();
  ok(plc.G.Anlage_Ein === true, 'Selbsthaltung (KOP)');
  plc.G.Niveau_Tief = true; step(); ok(plc.G.Pumpe_1 === true && plc.G.Pumpenstarts === 1, 'Pumpe läuft, Starts = 1 (FB-Aufruf aus KOP)');
  ok(plc.G.Lampe_Betrieb === true, 'Betriebsmeldung (FUP)');
  step(350); ok(plc.D.IDB_Pumpe_1.Stoerung === true && plc.G.Lampe_Stoerung === true, 'Störung nach 3,5 s'); step(200);
  ok(plc.G.Hupe === true, 'Hupe nach 2 s Störung (TON-Box in KOP)');
  plc.G.Druck_Roh = 27648 * 0.9; step(); ok(plc.G.Druck_Hoch === true, 'AWL: Druck > 8 bar');
  plc.G.Quittieren = true; plc.G.Stop_Taster = false; step(); ok(plc.G.Anlage_Ein === false, 'Stop');
  ok(plc.G.Pumpenstarts === 0, 'AWL: Zähler zurückgesetzt (SPBN-Sprung)');
  ok(plc.G.Hupe === false, 'Hupe aus bei Quittieren');
});

// 2) KOP → AWL → KOP
const reg = A.buildReg(P);
const main = P.blocks.find(b => b.name === 'Main');
const sc = A.makeScope(main, reg, []);
for (const [i, n] of main.networks.entries()) { const r = A.netToAwl(n, i, reg, true, sc); console.log(`--- AWL NW${i + 1}\n${r.code}`); if (r.errs.length) console.log(r.errs); }
const n1 = A.netToAwl(main.networks[0], 0, reg, true, sc).code;
const back = A.awlToNet(n1, reg, main); ok(back.roots.length === 1 && back.roots[0].in.n.t === 'AND', 'AWL → KOP Netzwerk 1 rückwandelbar');
console.log(JSON.stringify(back));

// 3) Alle Kataloganweisungen als FUP-Box übersetzbar und ausführbar
const PP = { tags: [
  { name: 'b1', type: 'Bool', addr: '%M0.0' }, { name: 'b2', type: 'Bool', addr: '%M0.1' }, { name: 'q', type: 'Bool', addr: '%M0.2' }, { name: 'm', type: 'Bool', addr: '%M0.3' },
  { name: 'i1', type: 'Int', addr: '%MW2', init: '7' }, { name: 'i2', type: 'Int', addr: '%MW4', init: '3' }, { name: 'io', type: 'Int', addr: '%MW6' },
  { name: 'r1', type: 'Real', addr: '%MD8', init: '2.5' }, { name: 'ro', type: 'Real', addr: '%MD12' }, { name: 'w1', type: 'Word', addr: '%MW16', init: '16#00F0' }, { name: 'wo', type: 'Word', addr: '%MW18' }, { name: 'di', type: 'DInt', addr: '%MD20' }], blocks: [] };
const nets = []; const DBs = [];
for (const [id, d] of Object.entries(A.INS)) {
  if (!['en', 'iec', 'fn', 'ff', 'edge', 'trig'].includes(d.kind)) continue;
  const bx = A.newBox(id); const { ins, outs } = A.boxPins(d, bx);
  for (const q of ins) { if (q.en) continue; const t = q.t === 'dt' ? bx.dtype : q.t === 'dt2' ? bx.dtype2 : q.t;
    if (q.t === 'Bool' && !q.val && !q.inout) bx.pins[q.n] = A.leaf('"b1"'); else bx.pins[q.n] = q.inout ? '"io"' : t === 'Real' || t === 'LReal' ? '"r1"' : t === 'Time' ? 'T#1s' : t === 'Word' || t === 'DWord' || t === 'Byte' ? '"w1"' : t === 'Bool' ? '"b2"' : t === 'ANY' ? '"i1"' : '"i2"'; }
  for (const q of outs) { if (q.main || q.n === 'ENO') continue; const t = q.t === 'dt' ? bx.dtype : q.t === 'dt2' ? bx.dtype2 : q.t; bx.outs[q.n] = t === 'Real' || t === 'LReal' ? '"ro"' : t === 'Word' || t === 'DWord' ? '"wo"' : t === 'Time' ? '' : t === 'Bool' ? '"q"' : t === 'DInt' ? '"di"' : '"io"'; }
  if (d.kind === 'iec') { bx.inst = `"I_${id}"`; DBs.push({ name: `I_${id}`, type: 'DB', number: DBs.length + 1, instanceOf: d.iec }); }
  if (d.kind === 'ff' || d.kind === 'edge') bx.op = '"q"'; if (d.kind === 'edge' || d.kind === 'trig') bx.mem = '"m"';
  if (d.kind === 'fn') nets.push({ title: id, roots: [{ k: '=', op: '"q"', in: { neg: false, n: bx } }] }); else nets.push({ title: id, roots: [{ k: 'BOX', box: bx }] });
}
PP.blocks.push({ name: 'Main', type: 'OB', number: 1, lang: 'FBD', iface: { Temp: [] }, networks: nets }, ...DBs);
const pr = A.compileProject(PP); const e = pr.msgs.filter(m => m.lvl === 'err');
if (e.length) console.log(e.map(m => `NW${m.net + 1} ${nets[m.net] && nets[m.net].title}: ${m.msg}`).join('\n'));
ok(e.length === 0, `Alle ${nets.length} Box-Anweisungen übersetzt`);
run(PP, 0, (plc, step) => { step(3); ok(true, 'Alle Box-Anweisungen laufen ohne Laufzeitfehler: ' + plc.state + ' ' + (plc.diag[0] || {}).msg); ok(plc.state === 'RUN', 'CPU bleibt im RUN'); });
// gleiche Netzwerke nach AWL und ausführen
const awlNets = nets.map((n, i) => { const r = A.netToAwl(n, i, A.buildReg(PP), true, A.makeScope(PP.blocks[0], A.buildReg(PP), [])); if (r.errs.length) console.log('AWL-Gen', n.title, r.errs); return { title: n.title, awl: r.code, temps: r.temps }; });
const temps = awlNets.flatMap(n => n.temps);
const PA = { ...PP, blocks: [{ name: 'Main', type: 'OB', number: 1, lang: 'STL', iface: { Temp: temps.map(t => ({ name: t.name, type: t.type })) }, networks: awlNets.map(n => ({ title: n.title, awl: n.awl })) }, ...DBs] };
const pa = A.compileProject(PA); const ea = pa.msgs.filter(m => m.lvl === 'err');
if (ea.length) console.log(ea.map(m => `NW${m.net + 1} ${awlNets[m.net] && awlNets[m.net].title} Z${m.nline}: ${m.msg}\n${awlNets[m.net] && awlNets[m.net].awl}`).join('\n'));
ok(ea.length === 0, 'Alle Box-Anweisungen als AWL übersetzt');
run(PA, 0, (plc, step) => { step(3); ok(plc.state === 'RUN', 'AWL-Version läuft: ' + (plc.diag[0] || {}).msg); });

// 4) Werte prüfen: KOP-Logik und AWL-Semantik
const T = (code, setup, check, msg) => { const Q = { tags: [{ name: 'a', type: 'Bool', addr: '%I0.0' }, { name: 'b', type: 'Bool', addr: '%I0.1' }, { name: 'c', type: 'Bool', addr: '%I0.2' }, { name: 'q', type: 'Bool', addr: '%Q0.0' }, { name: 'x', type: 'Int', addr: '%MW0' }, { name: 'y', type: 'Int', addr: '%MW2' }],
  blocks: [{ name: 'Main', type: 'OB', number: 1, lang: 'STL', iface: { Temp: [] }, networks: [{ title: '', awl: code }] }] };
  const pr = A.compileProject(Q); if (!pr.ok) { console.log(pr.msgs); fails++; return; } const plc = new A.PLC(); plc.load(pr, Q); setup(plc.G); plc.start(0); plc.scan(1); ok(check(plc.G), msg); };
T('U a\nO b\nU c\n= q', G => { G.a = false; G.b = true; G.c = false; }, G => G.q === false, 'AWL: U a O b U c → a ODER (b UND c) = 0');
T('U a\nO b\nU c\n= q', G => { G.a = true; G.b = false; G.c = false; }, G => G.q === true, 'AWL: U a O b U c mit a=1 → 1');
T('U a\nU b\nO\nU c\n= q', G => { G.a = false; G.b = false; G.c = true; }, G => G.q === true, 'AWL: O ohne Operand');
T('U(\nO a\nO b\n)\nU c\n= q', G => { G.a = true; G.c = true; }, G => G.q === true, 'AWL: Klammer');
T('L 5\nL 7\n+I\nT "x"\nL "x"\nL 12\n==I\n= q', () => {}, G => G.x === 12 && G.q === true, 'AWL: Arithmetik und Vergleich');
T('U %E0.0\n= %A0.0', G => { G.a = true; }, G => G.q === true, 'AWL: Absolutadressen %E/%A');
T('L 0\nT "x"\nM1: L "x"\n+ 1\nT "x"\nL "x"\nL 10\n<I\nSPB M1', () => {}, G => G.x === 10, 'AWL: Schleife mit Rücksprung');
T('CALL SCALE_X\n(  MIN := 0.0,\n   VALUE := 0.5,\n   MAX := 20.0,\n   OUT := "x"\n)', () => {}, G => G.x === 10, 'AWL: CALL SCALE_X');

// 5) Migration altes Format
const old = { name: 'alt', tags: P.tags,  blocks: [{ name: 'Main', type: 'OB', number: 1, lang: 'LAD', iface: { Temp: [] }, networks: [{ title: 'x', rows: 2, cols: 6, cells: { '0,0': { t: 'NO', op: '"Start_Taster"' }, '1,0': { t: 'NO', op: '"Anlage_Ein"' }, '0,1': { t: 'NO', op: '"Stop_Taster"' }, '0,2': { t: 'W' }, '0,3': { t: 'W' }, '0,4': { t: 'W' }, '0,5': { t: 'COIL', op: '"Anlage_Ein"' } }, links: { '0,1': true } }] }] };
A.migrateProject(old); console.log(JSON.stringify(old.blocks[0].networks[0].roots));
ok(old.blocks[0].networks[0].roots[0].k === '=', 'Migration Raster-KOP');

// 6) Quellen
const s1 = A.genSource(P, 'scl'), s2 = A.genSource(P, 'awl'); console.log(s2);
const back2 = A.parseSource(s2); ok(back2[0].lang === 'STL' && back2[0].networks.length === 2, 'AWL-Quelle rückimportiert');
// 7) Projektsprache umstellen
for (const to of ['STL', 'FBD', 'LAD', 'SCL']) {
  const Q = A.exampleProject(); const res = A.convertProject(Q, to);
  console.log(to, res.map(r => `${r.name}:${r.ok ? 'ok' : 'NEIN (' + r.msg + ')'}`).join(' | '));
  run(Q, 0, (plc, step) => { step(); plc.G.Start_Taster = true; step(); plc.G.Start_Taster = false; plc.G.Niveau_Tief = true; step(2);
    ok(plc.G.Anlage_Ein && plc.G.Pumpe_1 && plc.G.Lampe_Betrieb && plc.G.Pumpenstarts === 1, `Beispiel nach ${to} umgewandelt läuft`); step(560); ok(plc.G.Hupe === true, `${to}: Hupe-Timer`); });
}
// AWL → KOP zurück
{ const Q = A.exampleProject(); A.convertProject(Q, 'STL'); const r = A.convertProject(Q, 'LAD'); console.log('STL→LAD', r.map(x => `${x.name}:${x.ok ? 'ok' : x.msg}`).join(' | ')); ok(r.filter(x => x.ok).length === 3, 'AWL→KOP: Main, FC_Meldungen, FC_Analyse zurückgewandelt');
  run(Q, 0, (plc, step) => { step(); plc.G.Start_Taster = true; step(); plc.G.Start_Taster = false; plc.G.Niveau_Tief = true; step(2); ok(plc.G.Pumpe_1 && plc.G.Pumpenstarts === 1, 'KOP→AWL→KOP läuft'); }); console.log(JSON.stringify(Q.blocks.find(b => b.name === 'FC_Analyse').networks[1])); }
console.log(fails ? `\n${fails} FEHLER` : '\nALLE TESTS OK');
