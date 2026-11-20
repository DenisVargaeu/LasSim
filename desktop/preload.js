'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lasSimDesktop', {
  isDesktop: true,
  platform: process.platform,

  saveOptpFile(defaultFileName, content) {
    return ipcRenderer.invoke('lassim:save-optp', { defaultFileName, content });
  },

  openOptpDialog() {
    return ipcRenderer.invoke('lassim:open-optp-dialog');
  },

  onMenuAction(callback) {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('lassim:menu-action', (_event, data) => callback(data));
  },

  onOpenOptpContent(callback) {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('lassim:open-optp-content', (_event, data) => callback(data));
  },
});
