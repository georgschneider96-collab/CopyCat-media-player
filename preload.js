const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('vlcopycat', {
  // Window controls
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('win:toggleAlwaysOnTop'),
  enterPip: (opts) => ipcRenderer.invoke('win:enterPip', opts),
  leavePip: (opts) => ipcRenderer.invoke('win:leavePip', opts),
  close: () => ipcRenderer.invoke('win:close'),
  getWindowState: () => ipcRenderer.invoke('win:getState'),

  // File & folder dialogs
  openFiles: (multi = false) => ipcRenderer.invoke('dialog:openFiles', multi),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openSubtitle: () => ipcRenderer.invoke('dialog:openSubtitle'),

  // Media probe & FFmpeg stream lifecycle
  probeMedia: (filePath) => ipcRenderer.invoke('media:probe', filePath),
  stopStream: () => ipcRenderer.invoke('media:stopStream'),

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
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Live telemetry + AI bridge
  reportStatus: (status) => ipcRenderer.send('player:statusUpdate', status),
  onWindowState: (cb) => ipcRenderer.on('win:state', (_e, state) => cb(state)),
  onPipExitRequested: (cb) => ipcRenderer.on('pip:exitRequested', () => cb()),
  onAiCommand: (cb) => ipcRenderer.on('ai:command', (_e, cmd) => cb(cmd)),
  onInitialMedia: (cb) => ipcRenderer.on('media:initial', (_e, data) => cb(data))
});
