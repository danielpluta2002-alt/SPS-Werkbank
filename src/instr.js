'use strict';
/* =====================================================================
   Anweisungskatalog (angelehnt an die TIA-Basisanweisungen),
   Netzwerkmodell für KOP/FUP, SCL- und AWL-Erzeugung, Migration
   ===================================================================== */
const DT_NUM = ['Int', 'DInt', 'Real', 'LReal', 'SInt', 'USInt', 'UInt', 'UDInt'];
const DT_INT = ['Int', 'DInt', 'SInt', 'USInt', 'UInt', 'UDInt'];
const DT_BITS = ['Byte', 'Word', 'DWord'];
const DT_REAL = ['Real', 'LReal'];
const DT_CMP = [...DT_NUM, 'Time', ...DT_BITS];
const DT_MOVE = ['Bool', ...DT_NUM, 'Time', ...DT_BITS];
const CATS = [['bit', 'Bitverknüpfungen'], ['tim', 'Zeiten'], ['cnt', 'Zähler'], ['cmp', 'Vergleicher'], ['math', 'Mathematische Funktionen'],
  ['move', 'Übertragen'], ['conv', 'Umwandlung'], ['prog', 'Programmsteuerung'], ['word', 'Wortverknüpfungen'], ['shift', 'Schieben und Rotieren'], ['user', 'Projektbausteine']];
const pin = (n, t, o) => Object.assign({ n, t }, o || {});
const INS = {};
function ins(id, o) { INS[id] = Object.assign({ id, langs: ['LAD', 'FBD'], ins: [], outs: [] }, o); }

/* ---------- Bitverknüpfungen ---------- */
ins('NO', { cat: 'bit', kind: 'contact', langs: ['LAD'], name: '-| |-', title: 'Schließer', desc: 'Der Schließer leitet den Signalfluss weiter, wenn der Operand den Signalzustand 1 hat. In Reihe geschaltete Kontakte bilden eine UND-Verknüpfung.', scl: '"Operand"', awl: 'U   "Operand"' });
ins('NC', { cat: 'bit', kind: 'contact', langs: ['LAD'], neg: true, name: '-|/|-', title: 'Öffner', desc: 'Der Öffner leitet den Signalfluss weiter, wenn der Operand den Signalzustand 0 hat.', scl: 'NOT "Operand"', awl: 'UN  "Operand"' });
ins('NOT', { cat: 'bit', kind: 'not', langs: ['LAD'], name: '-|NOT|-', title: 'Signalzustand invertieren', desc: 'Invertiert den Signalzustand des Verknüpfungsergebnisses (VKE).', scl: 'NOT ', awl: 'NOT' });
ins('BRANCH', { cat: 'bit', kind: 'branch', langs: ['LAD'], name: '-+ Zweig', title: 'Parallelzweig öffnen', desc: 'Legt einen parallelen Zweig um das markierte Element. Parallele Zweige bilden eine ODER-Verknüpfung.' });
ins('AND', { cat: 'bit', kind: 'gate', langs: ['FBD'], name: '&', title: 'UND-Verknüpfung', desc: 'Der Ausgang ist 1, wenn alle Eingänge 1 sind. Weitere Eingänge lassen sich hinzufügen.', scl: ' AND ', awl: 'U   "Operand"' });
ins('OR', { cat: 'bit', kind: 'gate', langs: ['FBD'], name: '>=1', title: 'ODER-Verknüpfung', desc: 'Der Ausgang ist 1, wenn mindestens ein Eingang 1 ist.', scl: ' OR ', awl: 'O   "Operand"' });
ins('XOR', { cat: 'bit', kind: 'gate', langs: ['FBD'], name: 'X', title: 'EXKLUSIV-ODER-Verknüpfung', desc: 'Der Ausgang ist 1, wenn eine ungerade Anzahl von Eingängen 1 ist (bei zwei Eingängen: genau einer).', scl: ' XOR ', awl: 'X   "Operand"' });
ins('NEGATE', { cat: 'bit', kind: 'not', langs: ['FBD'], name: '-o', title: 'Binären Eingang negieren', desc: 'Negiert den markierten Eingang (Negationskreis am Boxeingang).' });
ins('=', { cat: 'bit', kind: 'coil', k: '=', name: { LAD: '-( )-', FBD: '=' }, title: 'Zuweisung', desc: 'Schreibt das Verknüpfungsergebnis in den angegebenen Operanden.', scl: '"Operand" := ;', awl: '=   "Operand"' });
ins('/=', { cat: 'bit', kind: 'coil', k: '/=', langs: ['LAD'], name: '-(/)-', title: 'Zuweisung negieren', desc: 'Schreibt das invertierte Verknüpfungsergebnis in den Operanden.', scl: '"Operand" := NOT ;', awl: 'NOT\n=   "Operand"' });
ins('S', { cat: 'bit', kind: 'coil', k: 'S', name: { LAD: '-(S)-', FBD: 'S' }, title: 'Ausgang setzen', desc: 'Setzt den Operanden auf 1, wenn das Verknüpfungsergebnis 1 ist. Bei 0 bleibt der Operand unverändert.', scl: 'IF  THEN\n   "Operand" := TRUE;\nEND_IF;', awl: 'S   "Operand"' });
ins('R', { cat: 'bit', kind: 'coil', k: 'R', name: { LAD: '-(R)-', FBD: 'R' }, title: 'Ausgang rücksetzen', desc: 'Setzt den Operanden auf 0, wenn das Verknüpfungsergebnis 1 ist.', scl: 'IF  THEN\n   "Operand" := FALSE;\nEND_IF;', awl: 'R   "Operand"' });
ins('SR', { cat: 'bit', kind: 'ff', name: 'SR', title: 'Flipflop setzen/rücksetzen', desc: 'Setzt den Operanden mit S, setzt ihn mit R1 zurück. Sind beide Eingänge 1, ist Rücksetzen dominant.', ins: [pin('S', 'Bool', { main: 1 }), pin('R1', 'Bool')], outs: [pin('Q', 'Bool', { main: 1, opt: 1 })], scl: 'IF  THEN "Operand" := TRUE; END_IF;\nIF  THEN "Operand" := FALSE; END_IF;', awl: 'U   "Setzen"\nS   "Operand"\nU   "Ruecksetzen"\nR   "Operand"' });
ins('RS', { cat: 'bit', kind: 'ff', name: 'RS', title: 'Flipflop rücksetzen/setzen', desc: 'Setzt den Operanden mit S1 und setzt ihn mit R zurück. Sind beide Eingänge 1, ist Setzen dominant.', ins: [pin('R', 'Bool', { main: 1 }), pin('S1', 'Bool')], outs: [pin('Q', 'Bool', { main: 1, opt: 1 })], scl: 'IF  THEN "Operand" := FALSE; END_IF;\nIF  THEN "Operand" := TRUE; END_IF;', awl: 'U   "Ruecksetzen"\nR   "Operand"\nU   "Setzen"\nS   "Operand"' });
ins('P', { cat: 'bit', kind: 'edge', name: { LAD: '-|P|-', FBD: 'P' }, title: 'Operand auf positive Signalflanke abfragen', desc: 'Liefert für einen Zyklus 1, wenn der Operand von 0 auf 1 wechselt. Der Flankenmerker (M_BIT) speichert den alten Zustand – er muss für jede Flanke eindeutig sein.', scl: '"Flanke" := "Operand" AND NOT "Flankenmerker";\n"Flankenmerker" := "Operand";', awl: 'U   "Operand"\nFP  "Flankenmerker"' });
ins('N', { cat: 'bit', kind: 'edge', neg: true, name: { LAD: '-|N|-', FBD: 'N' }, title: 'Operand auf negative Signalflanke abfragen', desc: 'Liefert für einen Zyklus 1, wenn der Operand von 1 auf 0 wechselt.', scl: '"Flanke" := NOT "Operand" AND "Flankenmerker";\n"Flankenmerker" := "Operand";', awl: 'U   "Operand"\nFN  "Flankenmerker"' });
ins('P=', { cat: 'bit', kind: 'coil', k: 'P=', name: { LAD: '-(P)-', FBD: 'P=' }, title: 'Operand bei positiver Signalflanke setzen', desc: 'Setzt den Operanden für einen Zyklus auf 1, wenn das Verknüpfungsergebnis von 0 auf 1 wechselt.', awl: 'FP  "Flankenmerker"\n=   "Operand"' });
ins('N=', { cat: 'bit', kind: 'coil', k: 'N=', name: { LAD: '-(N)-', FBD: 'N=' }, title: 'Operand bei negativer Signalflanke setzen', desc: 'Setzt den Operanden für einen Zyklus auf 1, wenn das Verknüpfungsergebnis von 1 auf 0 wechselt.', awl: 'FN  "Flankenmerker"\n=   "Operand"' });
ins('P_TRIG', { cat: 'bit', kind: 'trig', name: 'P_TRIG', title: 'VKE auf positive Signalflanke abfragen', desc: 'Liefert am Ausgang Q für einen Zyklus 1, wenn das Verknüpfungsergebnis am CLK-Eingang von 0 auf 1 wechselt.', ins: [pin('CLK', 'Bool', { main: 1 })], outs: [pin('Q', 'Bool', { main: 1, opt: 1 })], awl: 'FP  "Flankenmerker"' });
ins('N_TRIG', { cat: 'bit', kind: 'trig', neg: true, name: 'N_TRIG', title: 'VKE auf negative Signalflanke abfragen', desc: 'Liefert am Ausgang Q für einen Zyklus 1, wenn das Verknüpfungsergebnis am CLK-Eingang von 1 auf 0 wechselt.', ins: [pin('CLK', 'Bool', { main: 1 })], outs: [pin('Q', 'Bool', { main: 1, opt: 1 })], awl: 'FN  "Flankenmerker"' });
ins('R_TRIG', { cat: 'bit', kind: 'iec', iec: 'R_TRIG', name: 'R_TRIG', title: 'Positive Signalflanke erkennen', desc: 'IEC-Baustein mit Instanz: Q ist für einen Zyklus 1, wenn CLK von 0 auf 1 wechselt.', ins: [pin('CLK', 'Bool', { main: 1 })], outs: [pin('Q', 'Bool', { main: 1, opt: 1 })], scl: '#R_TRIG_Instance(CLK := );', awl: 'CALL R_TRIG , "R_TRIG_DB"\n(  CLK := ,\n   Q   := )' });
ins('F_TRIG', { cat: 'bit', kind: 'iec', iec: 'F_TRIG', name: 'F_TRIG', title: 'Negative Signalflanke erkennen', desc: 'IEC-Baustein mit Instanz: Q ist für einen Zyklus 1, wenn CLK von 1 auf 0 wechselt.', ins: [pin('CLK', 'Bool', { main: 1 })], outs: [pin('Q', 'Bool', { main: 1, opt: 1 })], scl: '#F_TRIG_Instance(CLK := );', awl: 'CALL F_TRIG , "F_TRIG_DB"\n(  CLK := ,\n   Q   := )' });

/* ---------- Zeiten ---------- */
const TIMER_IO = { ins: [pin('IN', 'Bool', { main: 1 }), pin('PT', 'Time')], outs: [pin('Q', 'Bool', { main: 1, opt: 1 }), pin('ET', 'Time', { opt: 1 })] };
ins('TP', { cat: 'tim', kind: 'iec', iec: 'TP_TIME', name: 'TP', title: 'Impuls erzeugen', desc: 'Bei steigender Flanke an IN wird Q für die Dauer PT auf 1 gesetzt – unabhängig davon, wie lange IN ansteht. ET zeigt die abgelaufene Zeit.', ...TIMER_IO, scl: '#TP_Instance(IN := ,\n             PT := T#1s,\n             Q => ,\n             ET => );' });
ins('TON', { cat: 'tim', kind: 'iec', iec: 'TON_TIME', name: 'TON', title: 'Einschaltverzögerung erzeugen', desc: 'Q wird 1, wenn IN mindestens die Dauer PT ununterbrochen 1 war. Fällt IN ab, wird Q sofort 0 und die Zeit zurückgesetzt.', ...TIMER_IO, scl: '#TON_Instance(IN := ,\n              PT := T#5s,\n              Q => ,\n              ET => );' });
ins('TOF', { cat: 'tim', kind: 'iec', iec: 'TOF_TIME', name: 'TOF', title: 'Ausschaltverzögerung erzeugen', desc: 'Q folgt IN sofort auf 1. Fällt IN auf 0, bleibt Q noch die Dauer PT auf 1.', ...TIMER_IO, scl: '#TOF_Instance(IN := ,\n              PT := T#5s,\n              Q => ,\n              ET => );' });
ins('TONR', { cat: 'tim', kind: 'iec', iec: 'TONR_TIME', name: 'TONR', title: 'Zeit akkumulieren', desc: 'Summiert die Zeiten, in denen IN = 1 ist. Q wird 1, sobald die Summe PT erreicht. R setzt Zeit und Ausgang zurück.', ins: [pin('IN', 'Bool', { main: 1 }), pin('R', 'Bool', { opt: 1 }), pin('PT', 'Time')], outs: TIMER_IO.outs, scl: '#TONR_Instance(IN := ,\n               R := ,\n               PT := T#10s,\n               Q => ,\n               ET => );' });

/* ---------- Zähler ---------- */
ins('CTU', { cat: 'cnt', kind: 'iec', iec: 'CTU_INT', name: 'CTU', title: 'Vorwärts zählen', desc: 'Jede steigende Flanke an CU erhöht den Zählwert CV um 1. Q ist 1, wenn CV ≥ PV. R setzt CV auf 0.', ins: [pin('CU', 'Bool', { main: 1 }), pin('R', 'Bool', { opt: 1 }), pin('PV', 'Int')], outs: [pin('Q', 'Bool', { main: 1, opt: 1 }), pin('CV', 'Int', { opt: 1 })], scl: '#CTU_Instance(CU := ,\n              R := ,\n              PV := 10,\n              Q => ,\n              CV => );' });
ins('CTD', { cat: 'cnt', kind: 'iec', iec: 'CTD_INT', name: 'CTD', title: 'Rückwärts zählen', desc: 'Jede steigende Flanke an CD verringert CV um 1. LD lädt PV in CV. Q ist 1, wenn CV ≤ 0.', ins: [pin('CD', 'Bool', { main: 1 }), pin('LD', 'Bool', { opt: 1 }), pin('PV', 'Int')], outs: [pin('Q', 'Bool', { main: 1, opt: 1 }), pin('CV', 'Int', { opt: 1 })], scl: '#CTD_Instance(CD := ,\n              LD := ,\n              PV := 10,\n              Q => ,\n              CV => );' });
ins('CTUD', { cat: 'cnt', kind: 'iec', iec: 'CTUD_INT', name: 'CTUD', title: 'Vorwärts und rückwärts zählen', desc: 'CU zählt vorwärts, CD rückwärts. QU = 1 bei CV ≥ PV, QD = 1 bei CV ≤ 0. R setzt zurück, LD lädt PV.', ins: [pin('CU', 'Bool', { main: 1 }), pin('CD', 'Bool', { opt: 1 }), pin('R', 'Bool', { opt: 1 }), pin('LD', 'Bool', { opt: 1 }), pin('PV', 'Int')], outs: [pin('QU', 'Bool', { main: 1, opt: 1 }), pin('QD', 'Bool', { opt: 1 }), pin('CV', 'Int', { opt: 1 })], scl: '#CTUD_Instance(CU := ,\n               CD := ,\n               R := ,\n               LD := ,\n               PV := 10,\n               QU => ,\n               QD => ,\n               CV => );' });

/* ---------- Vergleicher ---------- */
const CMPS = [['CMP_EQ', '==', '=', 'Gleich'], ['CMP_NE', '<>', '<>', 'Ungleich'], ['CMP_GE', '>=', '>=', 'Größer oder gleich'], ['CMP_LE', '<=', '<=', 'Kleiner oder gleich'], ['CMP_GT', '>', '>', 'Größer'], ['CMP_LT', '<', '<', 'Kleiner']];
for (const [id, sym, scl, t] of CMPS) ins(id, { cat: 'cmp', kind: 'fn', name: { LAD: `-|${sym}|-`, FBD: `CMP ${sym}` }, sym, title: t, desc: `Liefert 1, wenn IN1 ${t.toLowerCase()} IN2 ist. In KOP als Vergleichskontakt in Reihe geschaltet.`, dt: { list: DT_CMP, def: 'Int' }, ins: [pin('IN1', 'dt'), pin('IN2', 'dt')], outs: [pin('OUT', 'Bool', { main: 1, hidden: 1 })], expr: p => `${p.IN1} ${scl} ${p.IN2}`, scl: `"Wert1" ${scl} "Wert2"`, awl: `L   "Wert1"\nL   "Wert2"\n${sym}I` });
ins('IN_RANGE', { cat: 'cmp', kind: 'fn', name: 'IN_RANGE', title: 'Wert innerhalb Bereich', desc: 'Liefert 1, wenn MIN ≤ VAL ≤ MAX.', dt: { list: DT_NUM, def: 'Int' }, ins: [pin('MIN', 'dt'), pin('VAL', 'dt'), pin('MAX', 'dt')], outs: [pin('OUT', 'Bool', { main: 1, hidden: 1 })], expr: p => `${p.MIN} <= ${p.VAL} AND ${p.VAL} <= ${p.MAX}`, scl: '"Min" <= "Wert" AND "Wert" <= "Max"' });
ins('OUT_RANGE', { cat: 'cmp', kind: 'fn', name: 'OUT_RANGE', title: 'Wert außerhalb Bereich', desc: 'Liefert 1, wenn VAL < MIN oder VAL > MAX.', dt: { list: DT_NUM, def: 'Int' }, ins: [pin('MIN', 'dt'), pin('VAL', 'dt'), pin('MAX', 'dt')], outs: [pin('OUT', 'Bool', { main: 1, hidden: 1 })], expr: p => `${p.VAL} < ${p.MIN} OR ${p.VAL} > ${p.MAX}`, scl: '"Wert" < "Min" OR "Wert" > "Max"' });
ins('OK', { cat: 'cmp', kind: 'fn', name: 'OK', title: 'Gültigkeit prüfen', desc: 'Liefert 1, wenn der Gleitpunktwert gültig ist (keine ungültige Zahl, nicht unendlich).', dt: { list: DT_REAL, def: 'Real' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'Bool', { main: 1, hidden: 1 })], expr: p => `OK(${p.IN})` });
ins('NOT_OK', { cat: 'cmp', kind: 'fn', name: 'NOT_OK', title: 'Ungültigkeit prüfen', desc: 'Liefert 1, wenn der Gleitpunktwert ungültig ist.', dt: { list: DT_REAL, def: 'Real' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'Bool', { main: 1, hidden: 1 })], expr: p => `NOT OK(${p.IN})` });

/* ---------- Mathematische Funktionen (EN/ENO) ---------- */
const join = (p, box, d, op) => boxPins(d, box).ins.filter(q => q.n.startsWith('IN')).map(q => p[q.n]).join(` ${op} `);
ins('CALCULATE', { cat: 'math', kind: 'en', name: 'CALCULATE', title: 'Berechnen', desc: 'Berechnet den Ausdruck (z. B. „(IN1 + IN2) * IN3“) und schreibt das Ergebnis nach OUT. Eingänge lassen sich hinzufügen.', dt: { list: DT_NUM, def: 'Real' }, varIn: { pre: 'IN', from: 1, min: 2, max: 16 }, ins: [pin('*', 'dt')], outs: [pin('OUT', 'dt')], body: (p, box) => { let e = String(box.expr || 'IN1 + IN2'); e = e.replace(/\bIN(\d+)\b/gi, (m, n) => p['IN' + n] !== undefined ? '(' + p['IN' + n] + ')' : m); return `${p['>OUT']} := ${e};`; }, scl: '"Ergebnis" := ("Wert1" + "Wert2") * "Wert3";' });
ins('ADD', { cat: 'math', kind: 'en', name: 'ADD', title: 'Addieren', desc: 'OUT := IN1 + IN2 (+ …). Weitere Eingänge lassen sich hinzufügen.', dt: { list: [...DT_NUM, 'Time'], def: 'Int' }, varIn: { pre: 'IN', from: 1, min: 2, max: 32 }, ins: [pin('*', 'dt')], outs: [pin('OUT', 'dt')], body: (p, box, d) => `${p['>OUT']} := ${join(p, box, d, '+')};`, scl: '"Ergebnis" := "Wert1" + "Wert2";', awl: 'L   "Wert1"\nL   "Wert2"\n+I\nT   "Ergebnis"' });
ins('SUB', { cat: 'math', kind: 'en', name: 'SUB', title: 'Subtrahieren', desc: 'OUT := IN1 − IN2.', dt: { list: [...DT_NUM, 'Time'], def: 'Int' }, ins: [pin('IN1', 'dt'), pin('IN2', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ${p.IN1} - ${p.IN2};`, scl: '"Ergebnis" := "Wert1" - "Wert2";', awl: 'L   "Wert1"\nL   "Wert2"\n-I\nT   "Ergebnis"' });
ins('MUL', { cat: 'math', kind: 'en', name: 'MUL', title: 'Multiplizieren', desc: 'OUT := IN1 · IN2 (· …).', dt: { list: DT_NUM, def: 'Int' }, varIn: { pre: 'IN', from: 1, min: 2, max: 32 }, ins: [pin('*', 'dt')], outs: [pin('OUT', 'dt')], body: (p, box, d) => `${p['>OUT']} := ${join(p, box, d, '*')};`, scl: '"Ergebnis" := "Wert1" * "Wert2";', awl: 'L   "Wert1"\nL   "Wert2"\n*I\nT   "Ergebnis"' });
ins('DIV', { cat: 'math', kind: 'en', name: 'DIV', title: 'Dividieren', desc: 'OUT := IN1 / IN2. Bei Ganzzahlen wird der Rest abgeschnitten.', dt: { list: DT_NUM, def: 'Int' }, ins: [pin('IN1', 'dt'), pin('IN2', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ${p.IN1} / ${p.IN2};`, scl: '"Ergebnis" := "Wert1" / "Wert2";', awl: 'L   "Wert1"\nL   "Wert2"\n/I\nT   "Ergebnis"' });
ins('MOD', { cat: 'math', kind: 'en', name: 'MOD', title: 'Divisionsrest ermitteln', desc: 'OUT := Rest der Division IN1 / IN2.', dt: { list: DT_INT, def: 'Int' }, ins: [pin('IN1', 'dt'), pin('IN2', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ${p.IN1} MOD ${p.IN2};`, scl: '"Ergebnis" := "Wert1" MOD "Wert2";', awl: 'L   "Wert1"\nL   "Wert2"\nMOD\nT   "Ergebnis"' });
ins('NEG', { cat: 'math', kind: 'en', name: 'NEG', title: 'Zweierkomplement erzeugen', desc: 'Kehrt das Vorzeichen um: OUT := −IN.', dt: { list: ['Int', 'DInt', 'SInt', 'Real', 'LReal'], def: 'Int' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := -(${p.IN});`, scl: '"Ergebnis" := -"Wert";', awl: 'L   "Wert"\nNEGI\nT   "Ergebnis"' });
ins('INC', { cat: 'math', kind: 'en', name: 'INC', title: 'Inkrementieren', desc: 'Erhöht den Operanden an IN/OUT um 1.', dt: { list: DT_INT, def: 'Int' }, ins: [pin('IN/OUT', 'dt', { inout: 1 })], outs: [], body: p => `${p['IN/OUT']} := ${p['IN/OUT']} + 1;`, scl: '"Zaehler" := "Zaehler" + 1;', awl: 'L   "Zaehler"\n+   1\nT   "Zaehler"' });
ins('DEC', { cat: 'math', kind: 'en', name: 'DEC', title: 'Dekrementieren', desc: 'Verringert den Operanden an IN/OUT um 1.', dt: { list: DT_INT, def: 'Int' }, ins: [pin('IN/OUT', 'dt', { inout: 1 })], outs: [], body: p => `${p['IN/OUT']} := ${p['IN/OUT']} - 1;`, scl: '"Zaehler" := "Zaehler" - 1;', awl: 'L   "Zaehler"\n+   -1\nT   "Zaehler"' });
ins('ABS', { cat: 'math', kind: 'en', name: 'ABS', title: 'Absolutwert bilden', desc: 'OUT := Betrag von IN.', dt: { list: ['Int', 'DInt', 'SInt', 'Real', 'LReal'], def: 'Int' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ABS(${p.IN});`, scl: '"Ergebnis" := ABS("Wert");', awl: 'L   "Wert"\nABS\nT   "Ergebnis"' });
ins('MIN', { cat: 'math', kind: 'en', name: 'MIN', title: 'Minimum ermitteln', desc: 'OUT := kleinster Wert der Eingänge.', dt: { list: [...DT_NUM, 'Time'], def: 'Int' }, varIn: { pre: 'IN', from: 1, min: 2, max: 4 }, ins: [pin('*', 'dt')], outs: [pin('OUT', 'dt')], body: (p, box, d) => `${p['>OUT']} := MIN(${join(p, box, d, ',')});`, scl: '"Ergebnis" := MIN(IN1 := "Wert1", IN2 := "Wert2");' });
ins('MAX', { cat: 'math', kind: 'en', name: 'MAX', title: 'Maximum ermitteln', desc: 'OUT := größter Wert der Eingänge.', dt: { list: [...DT_NUM, 'Time'], def: 'Int' }, varIn: { pre: 'IN', from: 1, min: 2, max: 4 }, ins: [pin('*', 'dt')], outs: [pin('OUT', 'dt')], body: (p, box, d) => `${p['>OUT']} := MAX(${join(p, box, d, ',')});`, scl: '"Ergebnis" := MAX(IN1 := "Wert1", IN2 := "Wert2");' });
ins('LIMIT', { cat: 'math', kind: 'en', name: 'LIMIT', title: 'Grenzwert setzen', desc: 'Begrenzt IN auf den Bereich MN … MX.', dt: { list: [...DT_NUM, 'Time'], def: 'Int' }, ins: [pin('MN', 'dt'), pin('IN', 'dt'), pin('MX', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := LIMIT(MN := ${p.MN}, IN := ${p.IN}, MX := ${p.MX});`, scl: '"Ergebnis" := LIMIT(MN := 0, IN := "Wert", MX := 100);' });
for (const [id, t, f] of [['SQR', 'Quadrat bilden', 'SQR'], ['SQRT', 'Quadratwurzel bilden', 'SQRT'], ['LN', 'Natürlichen Logarithmus bilden', 'LN'], ['EXP', 'Exponentialwert bilden', 'EXP'], ['SIN', 'Sinuswert bilden', 'SIN'], ['COS', 'Kosinuswert bilden', 'COS'], ['TAN', 'Tangenswert bilden', 'TAN'], ['ASIN', 'Arkussinus bilden', 'ASIN'], ['ACOS', 'Arkuskosinus bilden', 'ACOS'], ['ATAN', 'Arkustangens bilden', 'ATAN'], ['FRAC', 'Nachkommastellen ermitteln', 'FRAC']])
  ins(id, { cat: 'math', kind: 'en', name: id, title: t, desc: `OUT := ${f}(IN). Gleitpunktwerte (Winkel im Bogenmaß).`, dt: { list: DT_REAL, def: 'Real' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ${f}(${p.IN});`, scl: `"Ergebnis" := ${f}("Wert");`, awl: `L   "Wert"\n${f}\nT   "Ergebnis"` });
ins('EXPT', { cat: 'math', kind: 'en', name: 'EXPT', title: 'Potenzieren', desc: 'OUT := IN1 hoch IN2.', dt: { list: DT_REAL, def: 'Real' }, ins: [pin('IN1', 'dt'), pin('IN2', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ${p.IN1} ** ${p.IN2};`, scl: '"Ergebnis" := "Basis" ** "Exponent";' });

/* ---------- Übertragen ---------- */
ins('MOVE', { cat: 'move', kind: 'en', name: 'MOVE', title: 'Wert kopieren', desc: 'Kopiert IN nach OUT1 (weitere Ausgänge lassen sich hinzufügen).', ins: [pin('IN', 'ANY')], varOut: { pre: 'OUT', from: 1, min: 1, max: 16 }, outs: [pin('*', 'ANY')], body: (p, box, d) => boxPins(d, box).outs.filter(q => q.n.startsWith('OUT') && p['>' + q.n]).map(q => `${p['>' + q.n]} := ${p.IN};`).join(' '), scl: '"Ziel" := "Quelle";', awl: 'L   "Quelle"\nT   "Ziel"' });
ins('SWAP', { cat: 'move', kind: 'en', name: 'SWAP', title: 'Bytes tauschen', desc: 'Vertauscht die Reihenfolge der Bytes von IN.', dt: { list: ['Word', 'DWord'], def: 'Word' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := SWAP(${p.IN});`, scl: '"Ergebnis" := SWAP("Wert");' });

/* ---------- Umwandlung ---------- */
ins('CONVERT', { cat: 'conv', kind: 'en', name: 'CONV', title: 'Wert konvertieren', desc: 'Wandelt IN in den Zieldatentyp um und schreibt das Ergebnis nach OUT (z. B. Int → Real). Gleitpunkt → Ganzzahl wird gerundet.', dt: { list: [...DT_NUM, ...DT_BITS], def: 'Int' }, dt2: { list: [...DT_NUM, ...DT_BITS], def: 'Real' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt2')], body: (p, box) => `${p['>OUT']} := ${(box.dtype || 'Int').toUpperCase()}_TO_${(box.dtype2 || 'Real').toUpperCase()}(${p.IN});`, scl: '"Ziel" := INT_TO_REAL("Quelle");', awl: 'L   "Quelle"\nITD\nDTR\nT   "Ziel"' });
for (const [id, t, f, awl] of [['ROUND', 'Runden', 'ROUND', 'RND'], ['CEIL', 'Aufrunden', 'CEIL', 'RND+'], ['FLOOR', 'Abrunden', 'FLOOR', 'RND-'], ['TRUNC', 'Ganzzahl erzeugen (abschneiden)', 'TRUNC', 'TRUNC']])
  ins(id, { cat: 'conv', kind: 'en', name: id, title: t, desc: `OUT := ${f}(IN) – wandelt einen Gleitpunktwert in eine Ganzzahl.`, dt: { list: DT_REAL, def: 'Real' }, dt2: { list: DT_INT, def: 'DInt' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt2')], body: p => `${p['>OUT']} := ${f}(${p.IN});`, scl: `"Ergebnis" := ${f}("Wert");`, awl: `L   "Wert"\n${awl}\nT   "Ergebnis"` });
ins('SCALE_X', { cat: 'conv', kind: 'en', name: 'SCALE_X', title: 'Skalieren', desc: 'Bildet VALUE (0,0 … 1,0) linear auf den Bereich MIN … MAX ab: OUT := VALUE · (MAX − MIN) + MIN.', dt: { list: DT_NUM, def: 'Real' }, ins: [pin('MIN', 'dt'), pin('VALUE', 'Real'), pin('MAX', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := SCALE_X(MIN := ${p.MIN}, VALUE := ${p.VALUE}, MAX := ${p.MAX});`, scl: '"Ergebnis" := SCALE_X(MIN := 0.0, VALUE := "Normiert", MAX := 100.0);' });
ins('NORM_X', { cat: 'conv', kind: 'en', name: 'NORM_X', title: 'Normieren', desc: 'Normiert VALUE aus dem Bereich MIN … MAX auf 0,0 … 1,0: OUT := (VALUE − MIN) / (MAX − MIN). Typisch für Analogwerte 0 … 27648.', dt: { list: DT_NUM, def: 'Int' }, ins: [pin('MIN', 'dt'), pin('VALUE', 'dt'), pin('MAX', 'dt')], outs: [pin('OUT', 'Real')], body: p => `${p['>OUT']} := NORM_X(MIN := ${p.MIN}, VALUE := ${p.VALUE}, MAX := ${p.MAX});`, scl: '"Normiert" := NORM_X(MIN := 0, VALUE := "Rohwert", MAX := 27648);' });

/* ---------- Programmsteuerung ---------- */
ins('JMP', { cat: 'prog', kind: 'coil', k: 'JMP', name: { LAD: '-(JMP)-', FBD: 'JMP' }, title: 'Springen bei VKE = 1', desc: 'Springt zum Netzwerk mit der angegebenen Sprungmarke, wenn das Verknüpfungsergebnis 1 ist. Die Netzwerke dazwischen werden übersprungen (nur vorwärts).', awl: 'SPB M001' });
ins('JMPN', { cat: 'prog', kind: 'coil', k: 'JMPN', name: { LAD: '-(JMPN)-', FBD: 'JMPN' }, title: 'Springen bei VKE = 0', desc: 'Springt zur Sprungmarke, wenn das Verknüpfungsergebnis 0 ist.', awl: 'SPBN M001' });
ins('LABEL', { cat: 'prog', kind: 'label', name: 'LABEL', title: 'Sprungmarke', desc: 'Kennzeichnet das Netzwerk als Sprungziel. Die Marke steht im Netzwerkkopf.', awl: 'M001: NOP 0' });
ins('RET', { cat: 'prog', kind: 'coil', k: 'RET', name: { LAD: '-(RET)-', FBD: 'RET' }, title: 'Rücksprung', desc: 'Beendet die Bearbeitung des Bausteins, wenn das Verknüpfungsergebnis 1 ist.', scl: 'RETURN;', awl: 'BEB' });

/* ---------- Wortverknüpfungen ---------- */
for (const [id, op, t] of [['W_AND', 'AND', 'UND-Verknüpfung'], ['W_OR', 'OR', 'ODER-Verknüpfung'], ['W_XOR', 'XOR', 'EXKLUSIV-ODER-Verknüpfung']])
  ins(id, { cat: 'word', kind: 'en', name: op, title: t + ' (bitweise)', desc: `Verknüpft die Eingänge bitweise: OUT := IN1 ${op} IN2 (…).`, dt: { list: DT_BITS, def: 'Word' }, varIn: { pre: 'IN', from: 1, min: 2, max: 32 }, ins: [pin('*', 'dt')], outs: [pin('OUT', 'dt')], body: (p, box, d) => `${p['>OUT']} := ${join(p, box, d, op)};`, scl: `"Ergebnis" := "Wort1" ${op} "Wort2";`, awl: `L   "Wort1"\nL   "Wort2"\n${{ AND: 'UW', OR: 'OW', XOR: 'XOW' }[op]}\nT   "Ergebnis"` });
ins('INVERT', { cat: 'word', kind: 'en', name: 'INV', title: 'Einerkomplement bilden', desc: 'Invertiert alle Bits von IN.', dt: { list: [...DT_BITS, ...DT_INT], def: 'Word' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := NOT ${p.IN};`, scl: '"Ergebnis" := NOT "Wort";', awl: 'L   "Wort"\nINVI\nT   "Ergebnis"' });
ins('DECO', { cat: 'word', kind: 'en', name: 'DECO', title: 'Dekodieren', desc: 'Setzt in OUT das Bit, dessen Nummer an IN steht.', dt: { list: DT_BITS, def: 'Word' }, ins: [pin('IN', 'UInt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := DECO(${p.IN});`, scl: '"Ergebnis" := DECO("Bitnummer");' });
ins('ENCO', { cat: 'word', kind: 'en', name: 'ENCO', title: 'Kodieren', desc: 'Liefert die Nummer des niederwertigsten gesetzten Bits von IN.', dt: { list: DT_BITS, def: 'Word' }, ins: [pin('IN', 'dt')], outs: [pin('OUT', 'Int')], body: p => `${p['>OUT']} := ENCO(${p.IN});`, scl: '"Bitnummer" := ENCO("Wort");' });
ins('SEL', { cat: 'word', kind: 'en', name: 'SEL', title: 'Auswählen', desc: 'OUT := IN0, wenn G = 0; OUT := IN1, wenn G = 1.', dt: { list: DT_MOVE, def: 'Int' }, ins: [pin('G', 'Bool', { val: 1 }), pin('IN0', 'dt'), pin('IN1', 'dt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := SEL(G := ${p.G}, IN0 := ${p.IN0}, IN1 := ${p.IN1});`, scl: '"Ergebnis" := SEL(G := "Auswahl", IN0 := "Wert0", IN1 := "Wert1");' });
ins('MUX', { cat: 'word', kind: 'en', name: 'MUX', title: 'Multiplexen', desc: 'Kopiert den Eingang mit der Nummer K nach OUT. Liegt K außerhalb, wird ELSE kopiert.', dt: { list: DT_MOVE, def: 'Int' }, varIn: { pre: 'IN', from: 0, min: 2, max: 32 }, ins: [pin('K', 'UInt'), pin('*', 'dt'), pin('ELSE', 'dt', { opt: 1 })], outs: [pin('OUT', 'dt')],
  body: (p, box, d) => { const ii = boxPins(d, box).ins.filter(q => /^IN\d+$/.test(q.n)); return `CASE ${p.K} OF ${ii.map((q, i) => `${i}: ${p['>OUT']} := ${p[q.n]};`).join(' ')}${p.ELSE ? ` ELSE ${p['>OUT']} := ${p.ELSE};` : ''} END_CASE;`; }, scl: 'CASE "Auswahl" OF\n   0: "Ergebnis" := "Wert0";\n   1: "Ergebnis" := "Wert1";\nELSE\n   "Ergebnis" := 0;\nEND_CASE;' });

/* ---------- Schieben und Rotieren ---------- */
for (const [id, t] of [['SHR', 'Rechts schieben'], ['SHL', 'Links schieben'], ['ROR', 'Rechts rotieren'], ['ROL', 'Links rotieren']])
  ins(id, { cat: 'shift', kind: 'en', name: id, title: t, desc: `${t}: verschiebt die Bits von IN um N Stellen. ${id.startsWith('RO') ? 'Herausgeschobene Bits werden auf der anderen Seite wieder eingefügt.' : 'Freiwerdende Stellen werden mit 0 belegt.'}`, dt: { list: [...DT_BITS, ...DT_INT], def: 'Word' }, ins: [pin('IN', 'dt'), pin('N', 'UInt')], outs: [pin('OUT', 'dt')], body: p => `${p['>OUT']} := ${id}(IN := ${p.IN}, N := ${p.N});`, scl: `"Ergebnis" := ${id}(IN := "Wort", N := 1);`, awl: `L   1\nL   "Wort"\n${{ SHR: 'SRW', SHL: 'SLW', ROR: 'RRD', ROL: 'RLD' }[id]}\nT   "Ergebnis"` });

/* ---------- Bausteinaufruf (dynamisch) ---------- */
function callDef(box, reg) {
  const bn = String(box.blk || '').replace(/"/g, ''); const b = bn && reg && reg.blocks.get(bn.toLowerCase());
  if (!b || (b.type !== 'FB' && b.type !== 'FC')) return { id: 'CALL', cat: 'user', kind: 'en', name: bn || 'FB/FC ?', title: 'Bausteinaufruf', ins: [], outs: [], missing: bn || '?', body: () => '' };
  const ins = [...ifaceVars(b, ['Input']).map(v => pin(v.name, normType(v.type), b.type === 'FB' ? { opt: 1 } : {})), ...ifaceVars(b, ['InOut']).map(v => pin(v.name, normType(v.type), { inout: 1, val: 1 }))];
  const outs = ifaceVars(b, ['Output']).map(v => pin(v.name, normType(v.type), { opt: 1 }));
  return { id: 'CALL', cat: 'user', kind: 'en', name: b.name, title: (b.type === 'FB' ? 'FB' : 'FC') + ' aufrufen', block: b, fb: b.type === 'FB', ins, outs,
    body: (p, bx) => { const args = []; for (const q of ins) { const raw = (bx.pins || {})[q.n]; const unc = raw == null || raw === '' || (typeof raw === 'object' && !raw.n); if (!unc && p[q.n] !== '') args.push(`${q.n} := ${p[q.n]}`); } for (const q of outs) if (p['>' + q.n]) args.push(`${q.n} => ${p['>' + q.n]}`);
      return `${b.type === 'FB' ? (String(bx.inst || '').trim() || '???') : '"' + b.name + '"'}(${args.join(', ')});`; } };
}
function getDef(box, reg) { return box.i === 'CALL' ? callDef(box, reg) : INS[box.i]; }
function boxPins(d, box) {
  let ins = d.ins.slice(), outs = d.outs.slice();
  const expand = (arr, v) => { const i = arr.findIndex(q => q.n === '*'); if (i < 0) return arr; const n = Math.min(v.max, Math.max(v.min, box.n || v.min)); const t = arr[i].t; const add = []; for (let k = 0; k < n; k++) add.push(pin(v.pre + (v.from + k), t)); return [...arr.slice(0, i), ...add, ...arr.slice(i + 1)]; };
  if (d.varIn) ins = expand(ins, d.varIn); if (d.varOut) outs = expand(outs, d.varOut);
  if (d.kind === 'en') { ins = [pin('EN', 'Bool', { main: 1, en: 1 }), ...ins]; outs = [pin('ENO', 'Bool', { main: 1, opt: 1 }), ...outs]; }
  if (d.kind === 'edge') { ins = []; outs = [pin('Q', 'Bool', { main: 1, hidden: 1 })]; }
  return { ins, outs };
}
function isLogicPin(q) { return q.t === 'Bool' && !q.val && !q.inout; }
function mainIn(d, box) { const { ins } = boxPins(d, box); return ins.find(q => q.main) || null; }
function mainOut(d, box) { const { outs } = boxPins(d, box); return outs.find(q => q.main) || null; }
function pinType(q, box) { return q.t === 'dt' ? (box.dtype || 'Int') : q.t === 'dt2' ? (box.dtype2 || 'Real') : q.t; }
function newBox(id, extra) {
  const d = INS[id] || { kind: 'en', ins: [], outs: [] }; const box = { t: 'BOX', i: id, pins: {}, outs: {} };
  if (d.dt) box.dtype = d.dt.def; if (d.dt2) box.dtype2 = d.dt2.def; if (d.varIn) box.n = d.varIn.min; if (d.varOut) box.n = d.varOut.min;
  if (id === 'CALCULATE') box.expr = 'IN1 + IN2';
  if (d.kind === 'ff' || d.kind === 'edge') box.op = '';
  if (d.kind === 'edge' || d.kind === 'trig') box.mem = '';
  if (d.kind === 'iec') box.inst = '';
  for (const q of boxPins(d, box).ins) if (isLogicPin(q)) box.pins[q.n] = { neg: false, n: q.main || q.opt ? null : { t: 'OP', op: '' } }; else box.pins[q.n] = '';
  if (id === 'TON' || id === 'TOF' || id === 'TP' || id === 'TONR') box.pins.PT = 'T#5s';
  if (id === 'CTU' || id === 'CTD' || id === 'CTUD') box.pins.PV = '10';
  return Object.assign(box, extra || {});
}
const leaf = (op = '') => ({ neg: false, n: { t: 'OP', op } });
function newNet(lang) { return lang === 'STL' ? { title: '', comment: '', awl: '' } : { title: '', comment: '', roots: [] }; }

/* ---------- Baum-Hilfen ---------- */
function rootStart(root) { return root.k === 'BOX' ? null : root.in; }
function getInput(root, path) {
  let cur = root.k === 'BOX' ? { n: root.box } : root.in; let i = 0;
  if (root.k === 'BOX') { if (!path.length) return null; cur = root.box.pins[path[0]]; i = 1; }
  for (; i < path.length; i++) { const s = path[i]; if (!cur || !cur.n) return null; cur = typeof s === 'number' ? (cur.n.ins || [])[s] : (cur.n.pins || {})[s]; }
  return cur || null;
}
function walkNode(n, fn) { if (!n) return; fn(n); if (n.ins) n.ins.forEach(i => walkNode(i.n, fn)); if (n.t === 'BOX') for (const v of Object.values(n.pins || {})) if (v && typeof v === 'object') walkNode(v.n, fn); }
function walkNet(net, fn) { for (const r of net.roots || []) { if (r.k === 'BOX') walkNode(r.box, fn); else walkNode(r.in && r.in.n, fn); } }

/* ---------- SCL-Erzeugung ---------- */
function opReq(v, g, what) { const s = String(v ?? '').trim(); if (!s) { g.err(`${what} fehlt (<???>)`); return 'FALSE'; } return s; }
function genInput(inp, g) {
  if (!inp || !inp.n) return null;
  const x = genNode(inp.n, g); const r = inp.neg ? 'NOT ' + par(x) : x; g.disp.set(inp, r); return r;
}
function genNode(n, g) {
  let r;
  if (n.t === 'OP') r = opReq(n.op, g, 'Operand');
  else if (n.t === 'BOX') r = genBox(n, g, false);
  else { const j = { AND: ' AND ', OR: ' OR ', XOR: ' XOR ' }[n.t]; const parts = (n.ins || []).map(i => { const x = genInput(i, g); if (x === null) { g.err('Gattereingang nicht verschaltet'); return 'FALSE'; } return par(x); });
    r = !parts.length ? (g.err('Box ohne Eingänge'), 'FALSE') : parts.length === 1 ? parts[0] : '(' + parts.join(j) + ')'; }
  g.disp.set(n, r); return r;
}
function genBox(box, g, isRoot) {
  const d = getDef(box, g.reg); if (!d) { g.err('Unbekannte Anweisung ' + box.i); return 'FALSE'; }
  if (d.missing) { g.err(`Baustein „${d.missing}“ existiert nicht oder ist kein FB/FC`); return 'FALSE'; }
  const nm = d.name; const { ins, outs } = boxPins(d, box); const p = {};
  for (const q of ins) {
    if (isLogicPin(q)) { let e = genInput(box.pins[q.n], g);
      if (e === null) { if (q.en) e = 'TRUE'; else if (q.opt) e = 'FALSE'; else { g.err(`${nm}: Eingang ${q.n} nicht verschaltet`); e = 'FALSE'; } }
      p[q.n] = e; }
    else { let v = String(box.pins[q.n] ?? '').trim(); if (!v && !q.opt) { g.err(`${nm}: Operand an ${q.n} fehlt (<???>)`); v = '0'; } p[q.n] = v; }
  }
  for (const q of outs) { const v = String((box.outs || {})[q.n] ?? '').trim(); p['>' + q.n] = v; if (!v && !q.opt && !q.main) g.err(`${nm}: Ausgang ${q.n} nicht verschaltet (<???>)`); if (!v && !q.opt && !q.main) p['>' + q.n] = '#__dummy'; }
  const mo = outs.find(q => q.main);
  switch (d.kind) {
    case 'iec': { const inst = opReq(box.inst, g, `${nm}: Instanz`); const a = [];
      for (const q of ins) if (p[q.n] !== '' && !(q.opt && p[q.n] === 'FALSE' && isLogicPin(q) && !(box.pins[q.n] && box.pins[q.n].n))) a.push(`${q.n} := ${p[q.n]}`);
      for (const q of outs) if (p['>' + q.n]) a.push(`${q.n} => ${p['>' + q.n]}`);
      g.emit(`${inst}(${a.join(', ')});`); return `${inst}.${mo.n}`; }
    case 'en': case 'call': {
      if (d.fb && !String(box.inst || '').trim()) g.err(`${nm}: Instanz fehlt`);
      const body = d.body(p, box, d, g); const en = p.EN; let t = 'TRUE';
      if (en === 'TRUE') g.emit(body); else { t = g.temp('Bool'); g.emit(`${t} := ${en};`); g.emit(`IF ${t} THEN ${body} END_IF;`); }
      if (p['>ENO']) g.emit(`${p['>ENO']} := ${t};`); return t; }
    case 'fn': { const e = '(' + d.expr(p, box) + ')'; if (isRoot) g.err(`${nm}: Ergebnis wird nicht verwendet`); return e; }
    case 'ff': { const op = opReq(box.op, g, `${nm}: Operand`);
      if (box.i === 'SR') { g.emit(`IF ${p.S} THEN ${op} := TRUE; END_IF;`); g.emit(`IF ${p.R1} THEN ${op} := FALSE; END_IF;`); }
      else { g.emit(`IF ${p.R} THEN ${op} := FALSE; END_IF;`); g.emit(`IF ${p.S1} THEN ${op} := TRUE; END_IF;`); }
      if (p['>Q']) g.emit(`${p['>Q']} := ${op};`); return op; }
    case 'edge': { const op = opReq(box.op, g, `${nm}: Operand`), m = opReq(box.mem, g, `${nm}: Flankenmerker`); const t = g.temp('Bool');
      g.emit(d.neg ? `${t} := NOT ${op} AND ${m};` : `${t} := ${op} AND NOT ${m};`); g.emit(`${m} := ${op};`); return t; }
    case 'trig': { const m = opReq(box.mem, g, `${nm}: Flankenmerker`); const c = g.temp('Bool'), t = g.temp('Bool');
      g.emit(`${c} := ${p.CLK};`); g.emit(d.neg ? `${t} := NOT ${c} AND ${m};` : `${t} := ${c} AND NOT ${m};`); g.emit(`${m} := ${c};`);
      if (p['>Q']) g.emit(`${p['>Q']} := ${t};`); return t; }
  }
  g.err('Anweisung nicht unterstützt: ' + nm); return 'FALSE';
}
function genRoot(r, g) {
  if (r.k === 'BOX') { const x = genBox(r.box, g, true); g.disp.set(r.box, x); return; }
  let P = genInput(r.in, g); if (P === null) P = 'TRUE'; g.disp.set(r, P);
  const op = () => opReq(r.op, g, 'Operand');
  switch (r.k) {
    case '=': g.emit(`${op()} := ${P};`); break;
    case '/=': g.emit(`${op()} := NOT ${par(P)};`); break;
    case 'S': g.emit(P === 'TRUE' ? `${op()} := TRUE;` : `IF ${P} THEN ${op()} := TRUE; END_IF;`); break;
    case 'R': g.emit(P === 'TRUE' ? `${op()} := FALSE;` : `IF ${P} THEN ${op()} := FALSE; END_IF;`); break;
    case 'P=': case 'N=': { const m = opReq(r.mem, g, 'Flankenmerker'); const c = g.temp('Bool'); g.emit(`${c} := ${P};`);
      g.emit(r.k === 'P=' ? `${op()} := ${c} AND NOT ${m};` : `${op()} := NOT ${c} AND ${m};`); g.emit(`${m} := ${c};`); break; }
    case 'JMP': case 'JMPN': { const k = g.label(r.label); g.emit(`IF ${r.k === 'JMPN' ? 'NOT ' + par(P) : P} THEN #__jmp := ${k}; END_IF;`); break; }
    case 'RET': g.emit(P === 'TRUE' ? 'RETURN;' : `IF ${P} THEN RETURN; END_IF;`); break;
    case 'OPEN': g.err('Strompfad ohne Ausgang – Spule, Zuweisung oder Box anfügen'); break;
    default: g.err('Unbekanntes Ausgangselement ' + r.k);
  }
}
function blockGen(b, reg) {
  const lines = [], map = [], errs = [], temps = [], disp = [];
  const nets = b.networks || [];
  const labels = new Map(); nets.forEach((n, i) => { const l = String(n.label || '').trim(); if (l) { if (labels.has(l.toLowerCase())) errs.push({ net: i, msg: `Sprungmarke „${l}“ doppelt` }); labels.set(l.toLowerCase(), i); } });
  const hasJ = nets.some(n => (n.roots || []).some(r => r.k === 'JMP' || r.k === 'JMPN'));
  if (hasJ) temps.push({ name: '__jmp', type: 'DInt' });
  let needDummy = false;
  nets.forEach((net, ni) => {
    const start = lines.length + 1; lines.push(`// Netzwerk ${ni + 1}: ${(net.title || '').replace(/\n/g, ' ')}`);
    const body = []; let tc = 0; const d = new Map();
    const g = { reg, disp: d, emit: s => body.push(s), err: m => errs.push({ net: ni, msg: m }), temp: (type = 'Bool') => { const n = `__n${ni}_${tc++}`; temps.push({ name: n, type }); return '#' + n; },
      label: l => { const s = String(l || '').trim(); if (!s) { errs.push({ net: ni, msg: 'Sprung: Sprungmarke fehlt' }); return 0; } const t = labels.get(s.toLowerCase());
        if (t === undefined) { errs.push({ net: ni, msg: `Sprungmarke „${s}“ nicht gefunden` }); return 0; } if (t <= ni) { errs.push({ net: ni, msg: `Rückwärtssprung zu „${s}“ wird nicht unterstützt` }); return 0; } return t + 1; } };
    if (b.lang === 'STL') { body.push('// (AWL)'); }
    else for (const r of net.roots || []) genRoot(r, g);
    if (body.some(s => s.includes('#__dummy'))) needDummy = true;
    if (hasJ) { lines.push(`IF #__jmp = 0 OR #__jmp = ${ni + 1} THEN`, '#__jmp := 0;', ...body, 'END_IF;'); } else lines.push(...body);
    disp.push(d); map.push({ from: start, to: lines.length, net: ni });
  });
  if (needDummy) temps.push({ name: '__dummy', type: 'DInt' });
  return { text: lines.join('\n'), map, errs, temps, disp };
}

/* ---------- AWL-Erzeugung aus KOP/FUP ---------- */
const MN_DE = { A: 'U', AN: 'UN', 'A(': 'U(', 'AN(': 'UN(', JU: 'SPA', JC: 'SPB', JCN: 'SPBN', BEU: 'BEA', BEC: 'BEB', AW: 'UW', AD: 'UD' };
function mnem(m, de) { return de ? (MN_DE[m] || m) : m; }
function typeSuffix(t) { return t === 'Real' || t === 'LReal' ? 'R' : t === 'DInt' || t === 'UDInt' || t === 'Time' || t === 'DWord' ? 'D' : 'I'; }
function netToAwl(net, ni, reg, de, sc) {
  const L = [], errs = []; let tc = 0, lc = 0; const err = m => errs.push(m);
  const M = m => mnem(m, de); const I = (m, o) => L.push(o !== undefined && o !== '' ? `${M(m).padEnd(4)}${o}` : M(m));
  const temps = []; const temp = () => { const n = `__a${ni}_${tc++}`; temps.push({ name: n, type: 'Bool' }); return '#' + n; };
  const lbl = () => `M${ni + 1}${String.fromCharCode(65 + lc++)}`;
  const typeOf = (ex, fb) => { try { return compileExprString(ex, sc).t; } catch (e) { return fb || 'Int'; } };
  const hoisted = new Map();
  const req = (v, w) => { const s = String(v ?? '').trim(); if (!s) err(w + ' fehlt'); return s || '???'; };
  // Boxen vorziehen (außer Vergleicher, die inline in Klammern stehen)
  function hoist(n) {
    if (!n) return; if (n.ins) n.ins.forEach(i => hoist(i.n));
    if (n.t !== 'BOX') return;
    const d = getDef(n, reg); if (d && d.kind === 'fn' && /^CMP_/.test(n.i)) { for (const v of Object.values(n.pins)) if (v && typeof v === 'object') hoist(v.n); return; }
    for (const v of Object.values(n.pins || {})) if (v && typeof v === 'object') hoist(v.n);
    hoisted.set(n, awlBox(n, false));
  }
  function logic(inp, op) { // op: 'A' | 'O' | 'X'
    const neg = inp.neg, n = inp.n; const nn = op + (neg ? 'N' : '');
    if (!n) { I(op === 'A' && !neg ? 'SET' : op + (neg ? 'N' : ''), op === 'A' && !neg ? '' : 'TRUE'); return; }
    if (n.t === 'OP') { I(nn, req(n.op, 'Operand')); return; }
    if (n.t === 'BOX' && hoisted.has(n)) { I(nn, hoisted.get(n)); return; }
    if (n.t === 'BOX' && /^CMP_/.test(n.i)) { const d = INS[n.i]; I(nn + '('); const a = req(n.pins.IN1, 'IN1'), b = req(n.pins.IN2, 'IN2'); I('L', a); I('L', b); L.push(d.sym + typeSuffix(n.dtype || typeOf(a))); I(')'); return; }
    if (n.t === 'BOX') { err('Box nicht umwandelbar'); return; }
    const child = n.t === 'AND' ? 'A' : n.t === 'OR' ? 'O' : 'X';
    if (!neg && child === op && op !== 'X') { n.ins.forEach(i => logic(i, child)); return; }
    I(nn + '('); n.ins.forEach(i => logic(i, child)); I(')');
  }
  function top(inp) { if (!inp || !inp.n) { I('SET'); return; } const n = inp.n;
    if (!inp.neg && (n.t === 'AND' || n.t === 'OR' || n.t === 'XOR')) { const c = n.t === 'AND' ? 'A' : n.t === 'OR' ? 'O' : 'X'; n.ins.forEach((i, k) => logic(i, k === 0 && c === 'X' ? 'A' : c)); }
    else logic(inp, 'A'); }
  function boolArg(inp) { if (!inp || !inp.n) return ''; if (!inp.neg && inp.n.t === 'OP') return req(inp.n.op, 'Operand'); if (!inp.neg && inp.n.t === 'BOX' && hoisted.has(inp.n)) return hoisted.get(inp.n); hoist(inp.n); top(inp); const t = temp(); I('=', t); return t; }
  function awlBox(box, isRoot) {
    const d = getDef(box, reg); if (!d || d.missing) { err('Unbekannte Anweisung'); return 'FALSE'; }
    const { ins, outs } = boxPins(d, box); const val = q => String(box.pins[q.n] ?? '').trim(); const out = q => String((box.outs || {})[q.n] ?? '').trim();
    const params = () => { const a = []; for (const q of ins) { if (q.en) continue; const v = isLogicPin(q) ? boolArg(box.pins[q.n]) : val(q); if (v) a.push([q.n, v]); }
      for (const q of outs) { if (q.n === 'ENO') continue; const v = out(q); if (v) a.push([q.n, v]); } return a; };
    const callLines = (head, a) => { L.push(head); if (a.length) { const w = Math.max(...a.map(x => x[0].length)); a.forEach(([k, v], i) => L.push(`${i ? '   ' : '(  '}${k.padEnd(w)} := ${v}${i < a.length - 1 ? ',' : ''}`)); L.push(')'); } };
    switch (d.kind) {
      case 'iec': { const inst = req(box.inst, 'Instanz'); const a = params(); callLines(inst.startsWith('#') ? `CALL ${inst}` : `CALL ${d.name} , ${inst}`, a); return `${inst}.${outs.find(q => q.main).n}`; }
      case 'ff': { const op = req(box.op, 'Operand'); const [s, r] = box.i === 'SR' ? ['S', 'R1'] : ['S1', 'R'];
        const first = box.i === 'SR' ? [s, 'S'] : [r, 'R'], second = box.i === 'SR' ? [r, 'R'] : [s, 'S'];
        hoistPins(box); top(box.pins[first[0]]); I(first[1], op); top(box.pins[second[0]]); I(second[1], op); if (out({ n: 'Q' })) { I('A', op); I('=', out({ n: 'Q' })); } return op; }
      case 'edge': { const t = temp(); I('A', req(box.op, 'Operand')); I(d.neg ? 'FN' : 'FP', req(box.mem, 'Flankenmerker')); I('=', t); return t; }
      case 'trig': { const t = temp(); hoistPins(box); top(box.pins.CLK); I(d.neg ? 'FN' : 'FP', req(box.mem, 'Flankenmerker')); I('=', t); if (out({ n: 'Q' })) I('=', out({ n: 'Q' })); return t; }
      case 'fn': { const t = temp(); const a = params().filter(x => x[0] !== 'OUT'); callLines(`CALL ${box.i}`, a); I('=', t); return t; }
      case 'en': {
        const enIn = box.pins.EN; let t = 'TRUE', skip = null;
        if (enIn && enIn.n) { hoistPins(box, ['EN']); top(enIn); t = temp(); I('=', t); skip = lbl(); I('JCN', skip); }
        const dt = box.dtype || 'Int';
        const simple = { ADD: '+', SUB: '-', MUL: '*', DIV: '/' }[box.i];
        if (box.i === 'MOVE') { I('L', val({ n: 'IN' }) || '???'); outs.filter(q => q.n !== 'ENO' && out(q)).forEach(q => I('T', out(q))); }
        else if (simple && val({ n: 'IN1' })) { const ii = ins.filter(q => /^IN\d+$/.test(q.n)); I('L', val(ii[0])); ii.slice(1).forEach(q => { I('L', val(q) || '???'); L.push(simple + typeSuffix(dt)); }); I('T', out({ n: 'OUT' }) || '???'); }
        else if (box.i === 'NEG') { I('L', val({ n: 'IN' })); L.push('NEG' + typeSuffix(dt)); I('T', out({ n: 'OUT' })); }
        else if (box.i === 'INC' || box.i === 'DEC') { const v = val({ n: 'IN/OUT' }); I('L', v); I('+', box.i === 'INC' ? '1' : '-1'); I('T', v); }
        else if (['SQR', 'SQRT', 'LN', 'EXP', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ABS'].includes(box.i)) { I('L', val({ n: 'IN' })); L.push(box.i); I('T', out({ n: 'OUT' })); }
        else if (['ROUND', 'CEIL', 'FLOOR', 'TRUNC'].includes(box.i)) { I('L', val({ n: 'IN' })); L.push({ ROUND: 'RND', CEIL: 'RND+', FLOOR: 'RND-', TRUNC: 'TRUNC' }[box.i]); I('T', out({ n: 'OUT' })); }
        else if (box.i === 'INVERT') { I('L', val({ n: 'IN' })); L.push(dt === 'DWord' || dt === 'DInt' ? 'INVD' : 'INVI'); I('T', out({ n: 'OUT' })); }
        else if (['W_AND', 'W_OR', 'W_XOR'].includes(box.i)) { const ii = ins.filter(q => /^IN\d+$/.test(q.n)); const m = { W_AND: 'A', W_OR: 'O', W_XOR: 'XO' }[box.i] + (dt === 'DWord' ? 'D' : 'W'); I('L', val(ii[0])); ii.slice(1).forEach(q => { I('L', val(q)); I(m); }); I('T', out({ n: 'OUT' })); }
        else if (box.i === 'CALL') { const a = params(); const b = d.block; callLines(b.type === 'FB' ? (String(box.inst || '').startsWith('#') ? `CALL ${box.inst}` : `CALL "${b.name}" , ${req(box.inst, 'Instanz')}`) : `CALL "${b.name}"`, a); }
        else { const a = params(); if (box.i === 'CALCULATE') a.unshift(['FORMEL', `'${String(box.expr || 'IN1 + IN2').replace(/'/g, '')}'`]); if (d.dt) a.unshift(['TYP', dt]); callLines(`CALL ${box.i}`, a); }
        if (skip) L.push(`${skip}: NOP 0`);
        if (out({ n: 'ENO' })) { I('A', t); I('=', out({ n: 'ENO' })); }
        return t; }
    }
    err('nicht umwandelbar: ' + d.name); return 'FALSE';
  }
  function hoistPins(box, only) { for (const [k, v] of Object.entries(box.pins || {})) if (v && typeof v === 'object' && (!only || only.includes(k))) hoist(v.n); }
  if (net.label) L.push(`${net.label}: NOP 0`);
  for (const r of net.roots || []) {
    if (r.k === 'BOX') { hoistPins(r.box); const d = getDef(r.box, reg); if (d && d.kind === 'fn') err('Vergleicher ohne Ausgang'); awlBox(r.box, true); continue; }
    if (r.in && r.in.n) hoist(r.in.n); top(r.in);
    switch (r.k) {
      case '=': I('=', req(r.op, 'Operand')); break; case '/=': I('NOT'); I('=', req(r.op, 'Operand')); break;
      case 'S': I('S', req(r.op, 'Operand')); break; case 'R': I('R', req(r.op, 'Operand')); break;
      case 'P=': I('FP', req(r.mem, 'Flankenmerker')); I('=', req(r.op, 'Operand')); break;
      case 'N=': I('FN', req(r.mem, 'Flankenmerker')); I('=', req(r.op, 'Operand')); break;
      case 'JMP': I('JC', req(r.label, 'Sprungmarke')); break; case 'JMPN': I('JCN', req(r.label, 'Sprungmarke')); break;
      case 'RET': I('BEC'); break;
      case 'OPEN': err('Strompfad ohne Ausgang'); break;
    }
  }
  return { code: L.map(l => /^\w+:/.test(l) ? l : '      ' + l).join('\n'), errs, temps };
}

/* ---------- Migration alter Projekte (Raster-KOP, alte FUP-Struktur) ---------- */
function migrateBoxEl(el, mainInp) {
  const t = el.t; const ID = { CMP: { '==': 'CMP_EQ', '<>': 'CMP_NE', '>': 'CMP_GT', '<': 'CMP_LT', '>=': 'CMP_GE', '<=': 'CMP_LE' }[el.cmp || '=='] };
  if (t === 'TON' || t === 'TOF' || t === 'TP') { const b = newBox(t, { inst: el.inst || '' }); b.pins.IN = mainInp; b.pins.PT = el.pt || ''; b.outs.Q = el.q || ''; b.outs.ET = el.et || ''; return b; }
  if (t === 'CTU' || t === 'CTD') { const b = newBox(t, { inst: el.inst || '' }); b.pins[t === 'CTU' ? 'CU' : 'CD'] = mainInp; const sec = t === 'CTU' ? 'R' : 'LD'; b.pins[sec] = el[sec.toLowerCase()] ? leaf(el[sec.toLowerCase()]) : { neg: false, n: null }; b.pins.PV = el.pv || ''; b.outs.Q = el.q || ''; b.outs.CV = el.cv || ''; return b; }
  if (t === 'MOVE') { const b = newBox('MOVE'); b.pins.EN = mainInp; b.pins.IN = el.in || ''; b.outs.OUT1 = el.out || ''; return b; }
  if (['ADD', 'SUB', 'MUL', 'DIV'].includes(t)) { const b = newBox(t); b.pins.EN = mainInp; b.pins.IN1 = el.in1 || ''; b.pins.IN2 = el.in2 || ''; b.outs.OUT = el.out || ''; b.dtype = 'Int'; return b; }
  if (t === 'CALL') { const b = { t: 'BOX', i: 'CALL', blk: el.blk || '', inst: el.inst || '', pins: { EN: mainInp }, outs: {}, _params: el.params || {} }; return b; }
  if (t === 'CMP') { const b = newBox(ID.CMP); b.pins.IN1 = el.a || ''; b.pins.IN2 = el.b || ''; return b; }
  return null;
}
function fixCall(b, reg) { if (b.i !== 'CALL' || !b._params) return; const blk = reg.blocks.get(String(b.blk).replace(/"/g, '').toLowerCase());
  for (const [k, v] of Object.entries(b._params)) { const iv = blk && ifaceVars(blk, ['Input', 'InOut', 'Output']).find(x => x.name === k); const sec = blk && ['Input', 'InOut', 'Output'].find(s => (blk.iface[s] || []).includes(iv));
    if (sec === 'Output') b.outs[k] = v; else if (sec === 'Input' && normType(iv.type) === 'Bool') b.pins[k] = v ? leaf(v) : { neg: false, n: null }; else b.pins[k] = v; }
  delete b._params; }
function migrateLad(net) {
  const R = net.rows || 1, C = net.cols || 1; let p = Array(R).fill(null); // null = Schiene, undefined = kein Strom
  const roots = [], boxes = [];
  const and = (a, x) => a === undefined ? undefined : a === null ? x : { neg: false, n: { t: 'AND', ins: [a, x] } };
  for (let c = 0; c < C; c++) {
    const out = Array(R).fill(undefined);
    for (let r = 0; r < R; r++) { const el = (net.cells || {})[r + ',' + c], pin_ = p[r]; if (!el) continue; let o;
      switch (el.t) {
        case 'W': o = pin_; break;
        case 'NO': o = and(pin_, leaf(el.op || '')); break; case 'NC': o = and(pin_, { neg: true, n: { t: 'OP', op: el.op || '' } }); break;
        case 'P': case 'N': o = and(pin_, { neg: false, n: newBox(el.t, { op: el.op || '', mem: el.mem || '' }) }); break;
        case 'CMP': o = and(pin_, { neg: false, n: migrateBoxEl(el) }); break;
        case 'COIL': case 'NCOIL': case 'SET': case 'RST': roots.push({ k: { COIL: '=', NCOIL: '/=', SET: 'S', RST: 'R' }[el.t], op: el.op || '', in: pin_ === undefined ? { neg: false, n: { t: 'OP', op: 'FALSE' } } : (pin_ || { neg: false, n: null }) }); o = pin_; break;
        default: { const bx = migrateBoxEl(el, pin_ === undefined ? leaf('FALSE') : (pin_ || { neg: false, n: null })); if (!bx) { o = pin_; break; } boxes.push(bx); o = { neg: false, n: bx }; }
      }
      out[r] = o; }
    const np = out.slice(); let r = 0;
    while (r < R) { let e = r; while (e < R - 1 && (net.links || {})[e + ',' + (c + 1)]) e++;
      if (e > r) { const parts = []; for (let k = r; k <= e; k++) if (out[k] !== undefined && !parts.includes(out[k])) parts.push(out[k]);
        const v = parts.length === 0 ? undefined : parts.includes(null) ? null : parts.length === 1 ? parts[0] : { neg: false, n: { t: 'OR', ins: parts } }; for (let k = r; k <= e; k++) np[k] = v; }
      r = e + 1; }
    p = np;
  }
  const seen = new Set(); const dedupe = inp => { if (!inp || !inp.n) return inp; const n = inp.n;
    if (n.t === 'BOX') { if (seen.has(n)) { const d = INS[n.i]; return { neg: inp.neg, n: { t: 'OP', op: n.inst && d && d.kind === 'iec' ? `${n.inst}.Q` : 'TRUE' } }; } seen.add(n); for (const [k, v] of Object.entries(n.pins)) if (v && typeof v === 'object') n.pins[k] = dedupe(v); return inp; }
    if (n.ins) return { neg: inp.neg, n: { ...n, ins: n.ins.map(dedupe) } }; return inp; };
  for (const rt of roots) rt.in = dedupe(rt.in);
  for (const bx of boxes) if (!seen.has(bx)) { seen.add(bx); roots.push({ k: 'BOX', box: bx }); }
  return { title: net.title || '', comment: net.comment || '', roots: JSON.parse(JSON.stringify(roots)) };
}
function migrateFbdNode(n) { if (!n) return null; if (n.t === 'OP') return { t: 'OP', op: n.op || '' };
  if (n.t === 'CMP') return migrateBoxEl({ t: 'CMP', cmp: n.cmp, a: n.a, b: n.b });
  return { t: n.t, ins: (n.ins || []).map(i => ({ neg: !!i.neg, n: migrateFbdNode(i.n) })) }; }
function migrateFbd(net) {
  const r = net.root || {}; const inp = r.in ? { neg: !!r.in.neg, n: migrateFbdNode(r.in.n) } : leaf('');
  let root; const k = { ASSIGN: '=', COIL: '=', NCOIL: '/=', SET: 'S', RST: 'R' }[r.t];
  if (k) root = { k, op: r.op || '', in: inp }; else { const bx = migrateBoxEl(r, inp); root = bx ? { k: 'BOX', box: bx } : { k: '=', op: '', in: inp }; }
  return { title: net.title || '', comment: net.comment || '', roots: [root] };
}
function migrateProject(P) {
  if (!P) return P; P.lang = P.lang || (P.blocks.find(b => b.type === 'OB' && b.lang) || {}).lang || 'LAD'; P.mnemonic = P.mnemonic || 'DE';
  const reg = buildReg(P);
  for (const b of P.blocks) {
    if (!b.networks || (b.lang !== 'LAD' && b.lang !== 'FBD')) continue;
    b.networks = b.networks.map(n => n.roots ? n : n.cells ? migrateLad(n) : n.root ? migrateFbd(n) : { title: n.title || '', comment: n.comment || '', roots: [] });
    for (const n of b.networks) walkNet(n, x => { if (x.t === 'BOX') fixCall(x, reg); });
  }
  return P;
}

/* ---------- Sprache eines Bausteins umwandeln ---------- */
const LANG_NAME = { LAD: 'KOP', FBD: 'FUP', SCL: 'SCL', STL: 'AWL' };
function hasXor(b) { let f = false; for (const n of b.networks || []) walkNet(n, x => { if (x.t === 'XOR') f = true; }); return f; }
function convertBlock(b, to, P) {
  const reg = buildReg(P), from = b.lang;
  if (b.type === 'DB' || from === to) return { ok: true, same: true };
  const graphic = l => l === 'LAD' || l === 'FBD';
  const addTemps = temps => { if (!temps.length) return; b.iface.Temp = b.iface.Temp || []; for (const t of temps) if (!b.iface.Temp.some(v => v.name === t.name)) b.iface.Temp.push({ name: t.name, type: t.type, init: '', comment: 'Hilfsvariable (Umwandlung)' }); };
  if (from === 'SCL') return { ok: false, msg: `SCL lässt sich nicht automatisch nach ${LANG_NAME[to]} umwandeln` };
  let nets = b.networks || [];
  if (from === 'STL') { // erst in Netzwerkbaum
    if (to === 'STL') return { ok: true, same: true };
    const conv = []; for (const [i, n] of nets.entries()) { try { const r = awlToNet(n.awl, reg, b); conv.push({ title: n.title || '', comment: n.comment || '', label: r.label, roots: r.roots }); } catch (e) { return { ok: false, msg: `Netzwerk ${i + 1}: ${e.message}` }; } }
    nets = conv; }
  if (graphic(to)) { if (to === 'LAD' && nets.some(n => { let f = false; walkNet(n, x => { if (x.t === 'XOR') f = true; }); return f; })) return { ok: false, msg: 'Enthält XOR – in KOP nicht darstellbar' };
    b.networks = nets; b.lang = to; return { ok: true }; }
  if (to === 'STL') { const sc = makeScope(b, reg, []); const out = [], temps = [];
    for (const [i, n] of nets.entries()) { const r = netToAwl(n, i, reg, P.mnemonic !== 'INT', sc); if (r.errs.length) return { ok: false, msg: `Netzwerk ${i + 1}: ${r.errs[0]}` }; out.push({ title: n.title || '', comment: n.comment || '', awl: r.code }); temps.push(...r.temps); }
    addTemps(temps); b.networks = out; b.lang = 'STL'; return { ok: true }; }
  if (to === 'SCL') { const tmp = { ...b, lang: 'LAD', networks: nets }; const g = blockGen(tmp, reg); if (g.errs.length) return { ok: false, msg: `Netzwerk ${g.errs[0].net + 1}: ${g.errs[0].msg}` };
    addTemps(g.temps); b.scl = g.text.replace(/^\/\/ Netzwerk (\d+): ?/gm, (m, n) => `${n === '1' ? '' : '\n'}// Netzwerk ${n}: `) + '\n'; b.lang = 'SCL'; delete b.networks; return { ok: true }; }
  return { ok: false, msg: 'Umwandlung nicht möglich' };
}
function convertProject(P, to) {
  const res = []; for (const b of P.blocks) { if (b.type === 'DB') continue; const before = JSON.stringify(b); const r = convertBlock(b, to, P); if (!r.ok) Object.assign(b, JSON.parse(before)); res.push({ name: b.name, from: JSON.parse(before).lang, ...r }); }
  P.lang = to; return res;
}

if (typeof module !== 'undefined') module.exports = { convertBlock, convertProject, LANG_NAME, INS, CATS, getDef, boxPins, newBox, newNet, leaf, blockGen, netToAwl, migrateProject, getInput, walkNet, isLogicPin, mainIn, mainOut, pinType, mnem, MN_DE };
