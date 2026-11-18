function exampleProject() {
  const T = (name, type, addr, comment, init = '') => ({ name, type, addr, comment, init });
  const V = (name, type, init = '', comment = '') => ({ name, type, init, comment });
  return {
    name: 'Pumpstation', cpu: 'CPU 1516-3 PN/DP (Simulation)', version: 1,
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
      T('Anlage_Ein', 'Bool', '%M0.0', 'Anlage eingeschaltet (Selbsthaltung)'),
      T('Druck_bar', 'Real', '%MD10', 'Druck skaliert in bar'),
      T('Pumpenstarts', 'Int', '%MW20', 'Anzahl Pumpenstarts'),
    ],
    blocks: [
      { name: 'Main', type: 'OB', number: 1, lang: 'LAD', iface: { Temp: [] }, networks: [
        { title: 'Anlage EIN/AUS mit Selbsthaltung', comment: 'Start oder Selbsthaltung, Stop als Öffner in Reihe', rows: 2, cols: 6,
          cells: { '0,0': { t: 'NO', op: '"Start_Taster"' }, '1,0': { t: 'NO', op: '"Anlage_Ein"' }, '0,1': { t: 'NO', op: '"Stop_Taster"' },
            '0,2': { t: 'W' }, '0,3': { t: 'W' }, '0,4': { t: 'W' }, '0,5': { t: 'COIL', op: '"Anlage_Ein"' } }, links: { '0,1': true } },
        { title: 'Pumpe 1', comment: 'Aufruf des Pumpenbausteins mit Instanz-DB', rows: 1, cols: 3,
          cells: { '0,0': { t: 'CALL', blk: 'FB_Pumpe', inst: '"IDB_Pumpe_1"', params: { Freigabe: '"Anlage_Ein"', Niveau_Tief: '"Niveau_Tief"', Niveau_Hoch: '"Niveau_Hoch"', Rueckmeldung: '"Rueckmeldung_P1"', Quittieren: '"Quittieren"', Ueberwachungszeit: 'T#3s', Pumpe_Ein: '"Pumpe_1"', Starts: '"Pumpenstarts"' } } }, links: {} },
        { title: 'Druck skalieren', comment: '', rows: 1, cols: 3,
          cells: { '0,0': { t: 'CALL', blk: 'FC_Skalierung', params: { Rohwert: '"Druck_Roh"', Min: '0.0', Max: '10.0', Wert: '"Druck_bar"' } } }, links: {} },
        { title: 'Meldungen', comment: '', rows: 1, cols: 3, cells: { '0,0': { t: 'CALL', blk: 'FC_Meldungen', params: {} } }, links: {} },
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
        { title: 'Betriebsmeldung', comment: '', root: { t: 'ASSIGN', op: '"Lampe_Betrieb"', in: { neg: false, n: { t: 'AND', ins: [{ neg: false, n: { t: 'OP', op: '"Pumpe_1"' } }, { neg: false, n: { t: 'OP', op: '"Anlage_Ein"' } }] } } } },
        { title: 'Störmeldung', comment: 'Pumpenstörung oder Überdruck > 6 bar', root: { t: 'ASSIGN', op: '"Lampe_Stoerung"', in: { neg: false, n: { t: 'OR', ins: [{ neg: false, n: { t: 'OP', op: '"IDB_Pumpe_1".Stoerung' } }, { neg: false, n: { t: 'CMP', cmp: '>', a: '"Druck_bar"', b: '6.0' } }] } } } },
      ] },
      { name: 'IDB_Pumpe_1', type: 'DB', number: 1, instanceOf: 'FB_Pumpe' },
    ],
    watch: [{ expr: '"Anlage_Ein"', ctrl: '' }, { expr: '"Pumpe_1"', ctrl: '' }, { expr: '"IDB_Pumpe_1".Stoerung', ctrl: '' }, { expr: '"IDB_Pumpe_1".tRueck.ET', ctrl: '' }, { expr: '"Druck_bar"', ctrl: '' }, { expr: '"Pumpenstarts"', ctrl: '' }],
  };
}
if (typeof module !== 'undefined') module.exports = { exampleProject };
