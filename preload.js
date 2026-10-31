const { contextBridge, ipcRenderer, webUtils } = require('electron');

const copycatApi = {
  // Window controls
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('win:toggleAlwaysOnTop'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('win:setAlwaysOnTop', flag),
  enterPip: (opts) => ipcRenderer.invoke('win:enterPip', opts),
  leavePip: (opts) => ipcRenderer.invoke('win:leavePip', opts),
  close: () => ipcRenderer.invoke('win:close'),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('win:setOpacity', opacity),
  copyImageToClipboard: (dataUrl) => ipcRenderer.invoke('clipboard:writeImage', dataUrl),
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
  hasDesktopShortcut: () => ipcRenderer.invoke('shortcut:hasDesktop'),
  createDesktopShortcut: () => ipcRenderer.invoke('shortcut:createDesktop'),
  setDefaultPlayer: () => ipcRenderer.invoke('app:setDefaultPlayer'),
  openDefaultAppsSettings: () => ipcRenderer.invoke('app:openDefaultAppsSettings'),

  // Live telemetry + AI bridge
  reportStatus: (status) => ipcRenderer.send('player:statusUpdate', status),
  onWindowState: (cb) => ipcRenderer.on('win:state', (_e, state) => cb(state)),
  onPipExitRequested: (cb) => ipcRenderer.on('pip:exitRequested', () => cb()),
  onAiCommand: (cb) => ipcRenderer.on('ai:command', (_e, cmd) => cb(cmd)),
  onInitialMedia: (cb) => ipcRenderer.on('media:initial', (_e, data) => cb(data)),
  getInitialMedia: () => ipcRenderer.invoke('media:getInitial')
};

contextBridge.exposeInMainWorld('copycat', copycatApi);
contextBridge.exposeInMainWorld('vlcopycat', copycatApi);
