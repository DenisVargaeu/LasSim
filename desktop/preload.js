'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('optiLabDesktop', {
  isDesktop: true,
  platform: process.platform,

  saveOptpFile(defaultFileName, content) {
    return ipcRenderer.invoke('optilab:save-optp', { defaultFileName, content });
  },

  openOptpDialog() {
    return ipcRenderer.invoke('optilab:open-optp-dialog');
  },

  onMenuAction(callback) {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('optilab:menu-action', (_event, data) => callback(data));
  },

  onOpenOptpContent(callback) {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('optilab:open-optp-content', (_event, data) => callback(data));
  },
});
