const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hnote', {
  getSession: () => ipcRenderer.invoke('session:get'),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseFolder: (kind) => ipcRenderer.invoke('folder:choose', kind),
  exportTab: (tab) => ipcRenderer.invoke('export:tab', tab),
  openHnote: () => ipcRenderer.invoke('hnote:open'),
  openTxt: () => ipcRenderer.invoke('txt:open'),

  onNewTab: (cb) => ipcRenderer.on('menu:new-tab', cb),
  onSaveTab: (cb) => ipcRenderer.on('menu:save-tab', cb),
  onOpenHnote: (cb) => ipcRenderer.on('menu:open-hnote', cb),
  onChangeFolders: (cb) => ipcRenderer.on('menu:change-folders', cb),
});
