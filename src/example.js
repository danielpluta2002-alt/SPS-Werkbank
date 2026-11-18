function exampleProject() {
  const T = (name, type, addr, comment, init = '') => ({ name, type, addr, comment, init });
  const V = (name, type, init = '', comment = '') => ({ name, type, init, comment });
  const L = op => ({ neg: false, n: { t: 'OP', op } });
  const N = op => ({ neg: true, n: { t: 'OP', op } });
  const G = (t, ...ins) => ({ neg: false, n: { t, ins } });
  const NC = { neg: false, n: null };
  return {
    name: 'Pumpstation', cpu: 'CPU 1516-3 PN/DP (Simulation)', version: 2, lang: 'LAD', mnemonic: 'DE',
    tags: [
      T('Start_Taster', 'Bool', '%I0.0', 'Taster Anlage EIN'),
      T('Stop_Taster', 'Bool', '%I0.1', 'Taster Anlage AUS (Öffner, unbetätigt = 1)', 'TRUE'),
      T('Niveau_Tief', 'Bool', '%I0.2', 'Schwimmer: Behälter leer → Pumpe anfordern'),
      T('Niveau_Hoch', 'Bool', '%I0.3', 'Schwimmer: Behälter voll → Pumpe aus'),
      T('Rueckmeldung_P1', 'Bool', '%I0.4', 'Schütz-Rückmeldung Pumpe 1'),
      T('Quittieren', 'Bool', '%I0.5', 'Taster Störung quittieren'),
      T('Druck_Roh', 'Int', '%IW64', 'Druck Analogwert 0…27648'),
      T('Pumpe_1', 'Bool', '%Q0.0', 'Schütz Pumpe 1'),
      T('Lampe_Betrieb', 'Bool', '%Q0.1', 'Meldeleuchte Betrieb'),
      T('Lampe_Stoerung', 'Bool', '%Q0.2', 'Meldeleuchte Störung'),
      T('Hupe', 'Bool', '%Q0.3', 'Hupe bei anstehender Störung'),
      T('Anlage_Ein', 'Bool', '%M0.0', 'Anlage eingeschaltet (Selbsthaltung)'),
      T('Druck_Hoch', 'Bool', '%M0.1', 'Grenzwert Druck > 8 bar'),
      T('Druck_bar', 'Real', '%MD10', 'Druck skaliert in bar'),
      T('Pumpenstarts', 'Int', '%MW20', 'Anzahl Pumpenstarts'),
    ],
    blocks: [
      { name: 'Main', type: 'OB', number: 1, lang: 'LAD', iface: { Temp: [] }, networks: [
        { title: 'Anlage EIN/AUS mit Selbsthaltung', comment: 'Start oder Selbsthaltung, Stop-Taster (Öffner) in Reihe',
          roots: [{ k: '=', op: '"Anlage_Ein"', in: G('AND', G('OR', L('"Start_Taster"'), L('"Anlage_Ein"')), L('"Stop_Taster"')) }] },
        { title: 'Pumpe 1', comment: 'Aufruf des Pumpenbausteins mit Instanz-DB',
          roots: [{ k: 'BOX', box: { t: 'BOX', i: 'CALL', blk: 'FB_Pumpe', inst: '"IDB_Pumpe_1"',
            pins: { EN: NC, Freigabe: L('"Anlage_Ein"'), Niveau_Tief: L('"Niveau_Tief"'), Niveau_Hoch: L('"Niveau_Hoch"'), Rueckmeldung: L('"Rueckmeldung_P1"'), Quittieren: L('"Quittieren"'), Ueberwachungszeit: 'T#3s' },
            outs: { Pumpe_Ein: '"Pumpe_1"', Stoerung: '', Starts: '"Pumpenstarts"' } } }] },
        { title: 'Druck skalieren', comment: '',
          roots: [{ k: 'BOX', box: { t: 'BOX', i: 'CALL', blk: 'FC_Skalierung', pins: { EN: NC, Rohwert: '"Druck_Roh"', Min: '0.0', Max: '10.0' }, outs: { Wert: '"Druck_bar"' } } }] },
        { title: 'Meldungen und Analyse', comment: 'FUP- und AWL-Baustein aufrufen',
          roots: [{ k: 'BOX', box: { t: 'BOX', i: 'CALL', blk: 'FC_Meldungen', pins: { EN: NC }, outs: {} } }, { k: 'BOX', box: { t: 'BOX', i: 'CALL', blk: 'FC_Analyse', pins: { EN: NC }, outs: {} } }] },
        { title: 'Hupe verzögert einschalten', comment: 'Störung steht 2 s an und ist nicht quittiert → Hupe',
          roots: [{ k: '=', op: '"Hupe"', in: { neg: false, n: { t: 'BOX', i: 'TON', inst: '"IEC_Timer_0_DB"', pins: { IN: G('AND', L('"Lampe_Stoerung"'), N('"Quittieren"')), PT: 'T#2s' }, outs: { Q: '', ET: '' } } } }] },
      ] },
      { name: 'FB_Pumpe', type: 'FB', number: 1, lang: 'SCL', iface: {
        Input: [V('Freigabe', 'Bool'), V('Niveau_Tief', 'Bool'), V('Niveau_Hoch', 'Bool'), V('Rueckmeldung', 'Bool'), V('Quittieren', 'Bool'), V('Ueberwachungszeit', 'Time', 'T#3s', 'Max. Zeit bis Rückmeldung')],
        Output: [V('Pumpe_Ein', 'Bool'), V('Stoerung', 'Bool'), V('Starts', 'Int')], InOut: [],
        Static: [V('Anforderung', 'Bool'), V('tRueck', 'TON_TIME', '', 'Rückmeldeüberwachung'), V('rtStart', 'R_TRIG')], Temp: [] },
        scl: `// Zweipunktregelung über Schwimmerschalter
IF #Niveau_Tief THEN
   #Anforderung := TRUE;
ELSIF #Niveau_Hoch THEN
   #Anforderung := FALSE;
END_IF;

// Störung quittieren
IF #Quittieren THEN
   #Stoerung := FALSE;
END_IF;

#Pumpe_Ein := #Freigabe AND #Anforderung AND NOT #Stoerung;

// Rückmeldeüberwachung: Schütz muss innerhalb der Zeit anziehen
#tRueck(IN := #Pumpe_Ein AND NOT #Rueckmeldung,
        PT := #Ueberwachungszeit);
IF #tRueck.Q THEN
   #Stoerung := TRUE;
   #Pumpe_Ein := FALSE;
END_IF;

// Pumpenstarts zählen (positive Flanke)
#rtStart(CLK := #Pumpe_Ein);
IF #rtStart.Q THEN
   #Starts := #Starts + 1;
END_IF;
` },
      { name: 'FC_Skalierung', type: 'FC', number: 1, lang: 'SCL', iface: {
        Input: [V('Rohwert', 'Int'), V('Min', 'Real'), V('Max', 'Real')], Output: [V('Wert', 'Real')], InOut: [], Temp: [V('Norm', 'Real')] },
        scl: `// Analogwert 0…27648 auf Min…Max skalieren
#Norm := NORM_X(MIN := 0, VALUE := #Rohwert, MAX := 27648);
#Wert := SCALE_X(MIN := #Min, VALUE := #Norm, MAX := #Max);
` },
      { name: 'FC_Meldungen', type: 'FC', number: 2, lang: 'FBD', iface: { Input: [], Output: [], InOut: [], Temp: [] }, networks: [
        { title: 'Betriebsmeldung', comment: '', roots: [{ k: '=', op: '"Lampe_Betrieb"', in: G('AND', L('"Pumpe_1"'), L('"Anlage_Ein"')) }] },
        { title: 'Störmeldung', comment: 'Pumpenstörung oder Überdruck > 6 bar',
          roots: [{ k: '=', op: '"Lampe_Stoerung"', in: G('OR', L('"IDB_Pumpe_1".Stoerung'), { neg: false, n: { t: 'BOX', i: 'CMP_GT', dtype: 'Real', pins: { IN1: '"Druck_bar"', IN2: '6.0' }, outs: {} } }) }] },
      ] },
      { name: 'FC_Analyse', type: 'FC', number: 3, lang: 'STL', iface: { Input: [], Output: [], InOut: [], Temp: [] }, networks: [
        { title: 'Grenzwert Druck', comment: 'Vergleich zweier Gleitpunktzahlen im Akku', awl: 'L     "Druck_bar"\nL     8.0\n>R\n=     "Druck_Hoch"' },
        { title: 'Zähler zurücksetzen', comment: 'Bei Quittieren und ausgeschalteter Anlage', awl: 'U     "Quittieren"\nUN    "Anlage_Ein"\nSPBN  M001\nL     0\nT     "Pumpenstarts"\nM001: NOP   0' },
      ] },
      { name: 'IDB_Pumpe_1', type: 'DB', number: 1, instanceOf: 'FB_Pumpe' },
      { name: 'IEC_Timer_0_DB', type: 'DB', number: 2, instanceOf: 'TON_TIME' },
    ],
    watch: [{ expr: '"Anlage_Ein"', ctrl: '' }, { expr: '"Pumpe_1"', ctrl: '' }, { expr: '"IDB_Pumpe_1".Stoerung', ctrl: '' }, { expr: '"IDB_Pumpe_1".tRueck.ET', ctrl: '' }, { expr: '"Druck_bar"', ctrl: '' }, { expr: '"Pumpenstarts"', ctrl: '' }, { expr: '"IEC_Timer_0_DB".ET', ctrl: '' }],
  };
}
if (typeof module !== 'undefined') module.exports = { exampleProject };
