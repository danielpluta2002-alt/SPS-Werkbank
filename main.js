'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isMac = process.platform === 'darwin';
let win = null;
let dirty = false;
let forceClose = false;
let pendingFile = null;

function fileArg(argv) {
  return argv.slice(1).find(a => /\.(spsw|json)$/i.test(a) && fs.existsSync(a)) || null;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const f = fileArg(argv);
    if (f) win.webContents.send('open-path', f);
  });
}

// macOS: Datei per Doppelklick / Drag auf das Dock-Symbol
app.on('open-file', (e, p) => {
  e.preventDefault();
  if (win && !win.webContents.isLoading()) win.webContents.send('open-path', p);
  else pendingFile = p;
});

function send(cmd) { if (win) win.webContents.send('menu', cmd); }

function buildMenu() {
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { label: 'Über SPS-Werkbank', click: () => send('about') }, { type: 'separator' },
      { role: 'services', label: 'Dienste' }, { type: 'separator' },
      { role: 'hide', label: 'SPS-Werkbank ausblenden' }, { role: 'hideOthers', label: 'Andere ausblenden' }, { role: 'unhide', label: 'Alle einblenden' },
      { type: 'separator' }, { role: 'quit', label: 'SPS-Werkbank beenden' }] }] : []),
    { label: 'Projekt', submenu: [
      { label: 'Neues Projekt…', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
      { label: 'Öffnen…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
      ...(isMac ? [{ role: 'recentDocuments', label: 'Zuletzt geöffnet', submenu: [{ role: 'clearRecentDocuments', label: 'Liste leeren' }] }] : []),
      { type: 'separator' },
      { label: 'Speichern', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
      { label: 'Speichern unter…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
      { type: 'separator' },
      { label: 'Externe Quelle exportieren (.scl)…', accelerator: 'CmdOrCtrl+E', click: () => send('exportScl') },
      { label: 'Externe Quelle exportieren (.awl)…', click: () => send('exportAwl') },
      { label: 'Externe Quelle importieren (.scl/.awl)…', accelerator: 'CmdOrCtrl+I', click: () => send('importScl') },
      { type: 'separator' },
      { label: 'Beispielprojekt laden…', click: () => send('example') },
      { label: 'Projektsprache ändern…', click: () => send('lang') },
      ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Beenden' }]),
    ] },
    { label: 'Bearbeiten', submenu: [
      { role: 'undo', label: 'Rückgängig' }, { role: 'redo', label: 'Wiederholen' }, { type: 'separator' },
      { role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einfügen' }, { role: 'selectAll', label: 'Alles auswählen' }] },
    { label: 'Online', submenu: [
      { label: 'Übersetzen', accelerator: 'CmdOrCtrl+B', click: () => send('compile') },
      { label: 'Laden in CPU', accelerator: 'CmdOrCtrl+L', click: () => send('load') },
      { type: 'separator' },
      { label: 'CPU starten (RUN)', accelerator: 'F5', click: () => send('run') },
      { label: 'CPU stoppen (STOP)', accelerator: 'Shift+F5', click: () => send('stop') },
      { type: 'separator' },
      { label: 'Beobachtung & Simulation', accelerator: 'CmdOrCtrl+Shift+W', click: () => send('watch') },
      { label: 'Online & Diagnose', click: () => send('diag') }] },
    { label: 'Ansicht', submenu: [
      { label: 'PLC-Variablen', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('tags') },
      { label: 'Externe Quellen', click: () => send('src') },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Originalgröße' }, { role: 'zoomIn', label: 'Vergrößern' }, { role: 'zoomOut', label: 'Verkleinern' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Vollbild' },
      ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }])] },
    { label: 'Hilfe', role: 'help', submenu: [{ label: 'Über SPS-Werkbank', click: () => send('about') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 560,
    title: 'SPS-Werkbank', backgroundColor: '#e9edf1', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  win.webContents.on('did-finish-load', () => {
    const f = pendingFile || fileArg(process.argv); pendingFile = null;
    if (f) win.webContents.send('open-path', f);
  });
  win.on('close', e => { if (dirty && !forceClose) { e.preventDefault(); win.webContents.send('ask-close'); } });
  win.on('closed', () => { win = null; forceClose = false; dirty = false; });
}

ipcMain.handle('open-file', async (_e, o = {}) => {
  let p = o.path;
  if (!p) {
    const r = await dialog.showOpenDialog(win, { title: o.title || 'Öffnen', filters: o.filters, properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    p = r.filePaths[0];
  }
  try { const content = fs.readFileSync(p, 'utf8'); app.addRecentDocument(p); return { path: p, content }; }
  catch (err) { dialog.showErrorBox('Datei konnte nicht gelesen werden', err.message); return null; }
});
ipcMain.handle('save-file', async (_e, o = {}) => {
  let p = o.path;
  if (!p) {
    const r = await dialog.showSaveDialog(win, { title: o.title || 'Speichern', defaultPath: o.defaultName, filters: o.filters });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  try { fs.writeFileSync(p, o.content, 'utf8'); app.addRecentDocument(p); return { path: p }; }
  catch (err) { dialog.showErrorBox('Speichern fehlgeschlagen', err.message); return null; }
});
ipcMain.handle('app-info', () => ({ version: app.getVersion(), platform: `${process.platform} ${process.arch}`, electron: process.versions.electron }));
ipcMain.on('set-dirty', (_e, d) => { dirty = !!d; if (isMac && win) win.setDocumentEdited(dirty); });
ipcMain.on('set-title', (_e, t) => { if (win) win.setTitle(String(t)); });
ipcMain.on('close-now', () => { forceClose = true; if (win) win.close(); });

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
