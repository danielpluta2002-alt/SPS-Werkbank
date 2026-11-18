# SPS-Werkbank – Desktop-App für Windows und Linux

Programmierumgebung für KOP, FUP und SCL mit simulierter CPU. Die App läuft komplett offline.
Den Austausch mit dem TIA Portal übernehmen externe SCL-Quellen (`.scl`).

## Installer bauen lassen (empfohlen, über GitHub)

GitHub baut die Installer kostenlos:

1. Ein neues Repository auf GitHub anlegen und den **Inhalt dieses Ordners** hochladen,
   einschließlich des versteckten Ordners `.github`.
2. Im Repository auf **Actions → „Installer bauen“ → Run workflow** klicken.
3. Nach ca. 5 Minuten liegen unten im Workflow-Lauf unter **Artifacts** zwei Pakete:
   - `SPS-Werkbank-Windows`: Installer (`…-win-x64.exe`) und portable Version (`…-portable.exe`)
   - `SPS-Werkbank-Linux`: `.AppImage` und `.deb`

Jeder Lauf legt außerdem ein GitHub-Release **v<Version>** (Version aus `package.json`) mit allen Installern an.
Für eine neue Version die Versionsnummer in `package.json` erhöhen und den Workflow erneut starten.

## Selbst bauen (lokal)

Voraussetzung ist Node.js ab Version 20. Jedes System baut seinen eigenen Installer.

```bash
npm install
npm start            # App direkt starten (Entwicklung)
npm run dist         # Installer für das aktuelle System → Ordner dist/
```

## Installation

| System | Datei | Hinweis |
|---|---|---|
| Windows 10/11 | `SPS-Werkbank-1.0.0-win-x64.exe` | Erscheint „Der Computer wurde durch Windows geschützt“: **Weitere Informationen → Trotzdem ausführen** (die App ist nicht signiert). |
| Linux | `.AppImage` | `chmod +x SPS-Werkbank-*.AppImage` und starten. |
| Debian/Ubuntu | `.deb` | `sudo apt install ./SPS-Werkbank-*.deb` |

Die Windows-Warnung fällt weg, sobald die App mit einem Code-Signing-Zertifikat (Authenticode) signiert wird.

## Funktionen

- **Vier Sprachen wie im TIA Portal:** KOP (Kontaktplan), FUP (Funktionsplan), SCL und AWL (Anweisungsliste, deutsche oder internationale Mnemonik)
- **Projektsprache:** wird beim Anlegen eines neuen Projekts gewählt und lässt sich jederzeit für das ganze Projekt umstellen (Projektmenü am Logo). KOP ↔ FUP verlustfrei, KOP/FUP → AWL/SCL, AWL → KOP/FUP für darstellbare Netzwerke
- **Anweisungsbibliothek** rechts, nach Kategorien wie die TIA-Basisanweisungen (Bitverknüpfungen, Zeiten, Zähler, Vergleicher, Mathematik, Übertragen, Umwandlung, Programmsteuerung, Wortverknüpfungen, Schieben/Rotieren, Projektbausteine) mit Suche, Beschreibung und Parameterliste; Einfügen per Klick oder Ziehen
- **Boxen wie im Original:** EN/ENO, Instanz-DB über der Box, Datentyp unter dem Namen, erweiterbare Eingänge (ADD, MUL, AND …), negierbare Eingänge, Operanden direkt in der Grafik bearbeiten
- **Simulierte CPU** mit RUN/STOP, Beobachten (Signalfluss in KOP/FUP, VKE und AKKU 1 je AWL-Zeile), Beobachtungstabelle und Simulation der Ein- und Ausgänge
- **Variablentabelle** mit Registern Alle / Eingänge / Ausgänge / Merker
- Austausch mit dem TIA Portal über externe Quellen (.scl und .awl)

### Desktop-Version

- Menüleiste: Projekt, Bearbeiten, Online, Ansicht, Hilfe
- Projektdateien `.spsw` (Doppelklick öffnet sie in der App)
- Tastenkürzel: Strg+N / O / S / Umschalt+S für Neu, Öffnen, Speichern, Speichern unter
  - Strg+B: Übersetzen · Strg+L: Laden in CPU · F5: RUN · Umschalt+F5: STOP
  - Strg+E / Strg+I: externe Quelle exportieren/importieren
- Rückfrage bei ungespeicherten Änderungen beim Schließen

## Aufbau

```
main.js        Hauptprozess: Fenster, Menü, Datei-Dialoge
preload.js     sichere Brücke zwischen Oberfläche und Dateisystem
app/index.html komplette Oberfläche mit Editoren, Compiler und CPU-Simulation
build/icon.png App-Symbol (wird für alle Systeme umgewandelt)
.github/workflows/build.yml  automatischer Build für alle drei Systeme
```

SPS-Werkbank ist kein Produkt der Siemens AG. „TIA Portal“ ist eine Marke der Siemens AG.

## Quellcode der Oberfläche

`app/index.html` wird aus `src/` erzeugt:

- `src/core.js`: SCL-Lexer, Parser und Compiler, simulierte CPU, Import/Export externer Quellen
- `src/instr.js`: Anweisungskatalog, Netzwerkmodell für KOP/FUP, Codeerzeugung, Sprachumwandlung
- `src/awl.js`: AWL-Parser, -Compiler und -Laufzeit, Rückwandlung AWL → KOP/FUP
- `src/editor.js`: grafische Editoren KOP/FUP, AWL-Editor, Anweisungsbibliothek
- `src/ui.js`: Oberfläche (Projektmenü, Dialoge, Variablentabelle, Beobachtung, Desktop-Anbindung)
- `src/example.js`: Beispielprojekt „Pumpstation“
- `src/shell.html`: HTML-Gerüst und Stylesheet

Nach Änderungen in `src/` neu erzeugen mit `python3 tools/build_html.py` (erzeugt auch `web/index.html`).
Tests des Kerns: `node tools/test_core.js`.
