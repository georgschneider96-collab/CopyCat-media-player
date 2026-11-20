const { contextBridge, ipcRenderer, webUtils } = require('electron');

let bufferedInitialMedia = null;
let initialMediaListener = null;

ipcRenderer.on('media:initial', (_e, data) => {
  bufferedInitialMedia = data;
  if (typeof initialMediaListener === 'function') {
    try {
      initialMediaListener(data);
    } catch (err) {
      console.error('Error in onInitialMedia callback:', err);
    }
  }
});

const copycatApi = {
  // Window controls
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  exitFullscreenToDrag: (data) => ipcRenderer.invoke('win:exitFullscreenToDrag', data),
  dragMove: (data) => ipcRenderer.send('win:dragMove', data),
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
  resolveAnimeChapters: (filePath, duration) => ipcRenderer.invoke('media:resolveAnimeChapters', { filePath, duration }),
  extractEmbeddedSubtitle: (filePath, trackIndex) => ipcRenderer.invoke('media:extractEmbeddedSubtitle', { filePath, trackIndex }),
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
  installAiIntegration: () => ipcRenderer.invoke('app:installAiIntegration'),
  openDefaultAppsSettings: () => ipcRenderer.invoke('app:openDefaultAppsSettings'),

  // Native Stream & Downloader
  probeStreamUrl: (url) => ipcRenderer.invoke('stream:probe', url),
  startDownload: (payload) => ipcRenderer.invoke('download:start', payload),
  queueSeasonDownload: (payload) => ipcRenderer.invoke('download:queueSeason', payload),
  haltAllDownloads: () => ipcRenderer.invoke('download:haltAll'),
  retryDownload: (id) => ipcRenderer.invoke('download:retry', id),
  incrementEpisodeUrl: (url, step) => ipcRenderer.invoke('download:incrementUrl', { url, step }),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  getDownloadQueue: () => ipcRenderer.invoke('download:getQueue'),
  getDownloadFolder: () => ipcRenderer.invoke('download:getFolder'),
  setDownloadFolder: (folder) => ipcRenderer.invoke('download:setFolder', folder),
  chooseDownloadFolder: () => ipcRenderer.invoke('download:chooseFolder'),
  openDownloadFolder: () => ipcRenderer.invoke('download:openFolder'),
  onDownloadProgress: (cb) => ipcRenderer.on('download:progress', (_e, data) => cb(data)),
  onDownloadComplete: (cb) => ipcRenderer.on('download:complete', (_e, data) => cb(data)),
  onDownloadError: (cb) => ipcRenderer.on('download:error', (_e, data) => cb(data)),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadAndInstallUpdate: (asset) => ipcRenderer.invoke('updater:downloadAndInstall', asset),
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:available', (_e, data) => cb(data)),
  onUpdateDownloadProgress: (cb) => ipcRenderer.on('updater:downloadProgress', (_e, p) => cb(p)),
  onUpdateDownloadComplete: (cb) => ipcRenderer.on('updater:downloadComplete', (_e, d) => cb(d)),
  onUpdateError: (cb) => ipcRenderer.on('updater:error', (_e, err) => cb(err)),

  // Live telemetry + AI bridge
  reportStatus: (status) => ipcRenderer.send('player:statusUpdate', status),
  onWindowState: (cb) => ipcRenderer.on('win:state', (_e, state) => cb(state)),
  onWindowMinimize: (cb) => ipcRenderer.on('win:minimize', () => cb()),
  onWindowRestore: (cb) => ipcRenderer.on('win:restore', () => cb()),
  onPipExitRequested: (cb) => ipcRenderer.on('pip:exitRequested', () => cb()),
  onAiCommand: (cb) => ipcRenderer.on('ai:command', (_e, cmd) => cb(cmd)),
  onInitialMedia: (cb) => {
    initialMediaListener = cb;
    if (bufferedInitialMedia) {
      try {
        cb(bufferedInitialMedia);
      } catch (err) {
        console.error('Error delivering buffered initial media:', err);
      }
    }
  },
  getInitialMedia: async () => {
    if (bufferedInitialMedia) return bufferedInitialMedia;
    try {
      const initial = await ipcRenderer.invoke('media:getInitial');
      if (initial) bufferedInitialMedia = initial;
      return initial;
    } catch {
      return null;
    }
  }
};

contextBridge.exposeInMainWorld('copycat', copycatApi);
contextBridge.exposeInMainWorld('vlcopycat', copycatApi);
