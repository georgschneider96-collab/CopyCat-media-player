const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('vlcopycat', {
  // Window controls
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('win:toggleAlwaysOnTop'),
  close: () => ipcRenderer.invoke('win:close'),
  getWindowState: () => ipcRenderer.invoke('win:getState'),

  // File & folder dialogs
  openFiles: (multi = false) => ipcRenderer.invoke('dialog:openFiles', multi),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openSubtitle: () => ipcRenderer.invoke('dialog:openSubtitle'),

  // Filesystem helpers
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file?.path || '';
    }
  },
  resolvePaths: (paths) => ipcRenderer.invoke('fs:resolvePaths', paths),
  scanFolder: (folderPath) => ipcRenderer.invoke('fs:scanFolder', folderPath),
  readSubtitle: (subPath) => ipcRenderer.invoke('fs:readSubtitle', subPath),
  getQuickFolders: () => ipcRenderer.invoke('fs:getQuickFolders'),
  saveSnapshot: (payload) => ipcRenderer.invoke('fs:saveSnapshot', payload),
  revealInExplorer: (filePath) => ipcRenderer.invoke('shell:reveal', filePath),

  // Live telemetry + AI bridge
  reportStatus: (status) => ipcRenderer.send('player:statusUpdate', status),
  onWindowState: (cb) => ipcRenderer.on('win:state', (_e, state) => cb(state)),
  onAiCommand: (cb) => ipcRenderer.on('ai:command', (_e, cmd) => cb(cmd)),
  onInitialMedia: (cb) => ipcRenderer.on('media:initial', (_e, data) => cb(data))
});
