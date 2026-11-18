# SPS-Werkbank – Desktop-App für Windows, macOS und Linux

Programmierumgebung für KOP, FUP und SCL mit simulierter CPU. Die App läuft komplett offline.
Den Austausch mit dem TIA Portal übernehmen externe SCL-Quellen (`.scl`).

## Installer bauen lassen (empfohlen, über GitHub)

GitHub baut alle drei Installer kostenlos:

1. Ein neues Repository auf GitHub anlegen und den **Inhalt dieses Ordners** hochladen,
   einschließlich des versteckten Ordners `.github`.
2. Im Repository auf **Actions → „Installer bauen“ → Run workflow** klicken.
3. Nach ca. 5–10 Minuten liegen unten im Workflow-Lauf unter **Artifacts** drei Pakete:
   - `SPS-Werkbank-Windows`: Installer (`…-win-x64.exe`) und portable Version (`…-portable.exe`)
   - `SPS-Werkbank-macOS`: `.dmg` für Intel (`x64`) und Apple Silicon (`arm64`)
   - `SPS-Werkbank-Linux`: `.AppImage` und `.deb`

Ein Git-Tag wie `v1.0.0` legt zusätzlich automatisch ein GitHub-Release mit allen Dateien an:
`git tag v1.0.0 && git push --tags`.

## Selbst bauen (lokal)

Voraussetzung ist Node.js ab Version 20. Jedes System baut seinen eigenen Installer, einen macOS-Installer gibt es also nur auf einem Mac.

```bash
npm install
npm start            # App direkt starten (Entwicklung)
npm run dist         # Installer für das aktuelle System → Ordner dist/
```

## Installation

| System | Datei | Hinweis |
|---|---|---|
| Windows 10/11 | `SPS-Werkbank-1.0.0-win-x64.exe` | Erscheint „Der Computer wurde durch Windows geschützt“: **Weitere Informationen → Trotzdem ausführen** (die App ist nicht signiert). |
| macOS 11+ | `.dmg` (`arm64` = M1/M2/M3/M4, `x64` = Intel) | App in „Programme“ ziehen. Beim ersten Start: Rechtsklick → **Öffnen**. Meldet macOS „beschädigt“, im Terminal ausführen: `xattr -cr /Applications/SPS-Werkbank.app` |
| Linux | `.AppImage` | `chmod +x SPS-Werkbank-*.AppImage` und starten. |
| Debian/Ubuntu | `.deb` | `sudo apt install ./SPS-Werkbank-*.deb` |

Die Warnungen bei Windows und macOS fallen weg, sobald die App mit einem Code-Signing-Zertifikat signiert wird
(Windows: Authenticode-Zertifikat, macOS: Apple-Developer-Konto mit Notarisierung).

## Funktionen der Desktop-Version

- Menüleiste: Projekt, Bearbeiten, Online, Ansicht, Hilfe
- Projektdateien `.spsw` (Doppelklick öffnet sie in der App)
- Tastenkürzel: Strg+N / O / S / Umschalt+S für Neu, Öffnen, Speichern, Speichern unter
  - Strg+B: Übersetzen · Strg+L: Laden in CPU · F5: RUN · Umschalt+F5: STOP
  - Strg+E / Strg+I: externe Quelle exportieren/importieren
- Rückfrage bei ungespeicherten Änderungen beim Schließen
- Auf dem Mac gilt **Cmd** statt Strg

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

- `src/core.js`: SCL-Lexer, Parser und Compiler, KOP/FUP→SCL, simulierte CPU, Import/Export externer Quellen
- `src/ui.js`: Oberfläche (Editoren, Beobachtung, Desktop-Anbindung)
- `src/example.js`: Beispielprojekt „Pumpstation“
- `src/shell.html`: HTML-Gerüst und Stylesheet

Nach Änderungen in `src/` neu erzeugen mit `python3 tools/build_html.py`.
