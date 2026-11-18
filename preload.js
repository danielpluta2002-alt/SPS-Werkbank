'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  openFile: opts => ipcRenderer.invoke('open-file', opts),
  saveFile: opts => ipcRenderer.invoke('save-file', opts),
  appInfo: () => ipcRenderer.invoke('app-info'),
  setDirty: d => ipcRenderer.send('set-dirty', !!d),
  setTitle: t => ipcRenderer.send('set-title', String(t)),
  closeNow: () => ipcRenderer.send('close-now'),
  onMenu: cb => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
  onOpenPath: cb => ipcRenderer.on('open-path', (_e, p) => cb(p)),
  onAskClose: cb => ipcRenderer.on('ask-close', () => cb()),
});
