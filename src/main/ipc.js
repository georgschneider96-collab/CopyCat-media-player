// src/main/ipc.js
// Declarative IPC Registry with Dependency Injection and Defensive Validation for VLCopyCat

const { ipcMain, dialog, shell, clipboard, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');

const logger = createLogger('IPC');

/**
 * Defensive path validation helpers
 */
function isValidPathString(p) {
  return typeof p === 'string' && p.trim().length > 0;
}

function pathExists(p) {
  try {
    return isValidPathString(p) && fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Declarative IPC Handlers Map
 * Each handler receives injected services: { window, media, session, updater }
 */
const IPC_HANDLERS = {
  // ==========================================
  // Window Controls (Injected: window)
  // ==========================================
  'win:minimize': {
    type: 'handle',
    description: 'Minimize main window',
    handler: ({ window }) => {
      const win = window.getWindow();
      if (!win || win.isDestroyed()) return;
      if (win.isFullScreen()) {
        win.setFullScreen(false);
      }
      win.minimize();
      window.broadcastState();
    }
  },

  'win:maximize': {
    type: 'handle',
    description: 'Toggle window maximize/unmaximize',
    handler: ({ window }) => {
      const win = window.getWindow();
      if (!win || win.isDestroyed()) return;
      if (win.isFullScreen()) {
        win.setFullScreen(false);
      } else if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      window.broadcastState();
    }
  },

  'win:toggleFullscreen': {
    type: 'handle',
    description: 'Toggle fullscreen mode',
    handler: ({ window }) => {
      const win = window.getWindow();
      if (!win || win.isDestroyed()) return;
      win.setFullScreen(!win.isFullScreen());
      window.broadcastState();
    }
  },

  'win:exitFullscreenToDrag': {
    type: 'handle',
    description: 'Exit fullscreen to drag coordinates',
    handler: ({ window }, _evt, data = {}) => {
      const win = window.getWindow();
      if (!win || win.isDestroyed()) return null;

      const screenX = Number(data.screenX) || 0;
      const screenY = Number(data.screenY) || 0;
      const ratioX = typeof data.ratioX === 'number' && data.ratioX >= 0 && data.ratioX <= 1 ? data.ratioX : 0.5;

      if (win.isFullScreen()) {
        win.setFullScreen(false);
      }
      if (win.isMaximized()) {
        win.unmaximize();
      }

      let width = 1180;
      let height = 700;
      try {
        const normal = win.getNormalBounds();
        if (normal && normal.width && normal.height) {
          width = normal.width;
          height = normal.height;
        }
      } catch {
        const bounds = win.getBounds();
        width = bounds.width || 1180;
        height = bounds.height || 700;
      }

      const targetX = Math.round(screenX - width * ratioX);
      const targetY = Math.round(screenY - 20);

      win.setBounds({
        x: targetX,
        y: targetY,
        width,
        height
      });

      window.broadcastState();
      return { x: targetX, y: targetY, width, height };
    }
  },

  'win:dragMove': {
    type: 'both',
    description: 'Move window to specified coordinates',
    handler: ({ window }, _evt, coords = {}) => {
      const win = window.getWindow();
      if (!win || win.isDestroyed()) return;
      const x = Number(coords.x);
      const y = Number(coords.y);
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        win.setPosition(Math.round(x), Math.round(y));
      }
    }
  },

  'win:toggleAlwaysOnTop': {
    type: 'handle',
    description: 'Toggle always on top state',
    handler: ({ window }) => {
      return window.applyAlwaysOnTop(!window.getUserAlwaysOnTop());
    }
  },

  'win:setAlwaysOnTop': {
    type: 'handle',
    description: 'Explicitly set always on top flag',
    handler: ({ window }, _evt, flag) => {
      return window.applyAlwaysOnTop(Boolean(flag));
    }
  },

  'win:enterPip': {
    type: 'handle',
    description: 'Enter Picture-in-Picture mode',
    handler: async ({ window }, _evt, opts = {}) => {
      const aspect = Number(opts?.aspect) > 0.1 ? Number(opts.aspect) : 16 / 9;
      return window.enterPip(aspect);
    }
  },

  'win:leavePip': {
    type: 'handle',
    description: 'Leave Picture-in-Picture mode',
    handler: ({ window }, _evt, opts = {}) => {
      return window.leavePip(opts);
    }
  },

  'win:close': {
    type: 'handle',
    description: 'Close main window',
    handler: ({ window }) => {
      const win = window.getWindow();
      if (win && !win.isDestroyed()) {
        win.close();
      }
    }
  },

  'win:setOpacity': {
    type: 'handle',
    description: 'Set window opacity (clamped 0.2..1.0)',
    handler: ({ window }, _evt, opacity) => {
      const win = window.getWindow();
      if (win && !win.isDestroyed()) {
        const val = Math.max(0.2, Math.min(1.0, Number(opacity) || 1.0));
        win.setOpacity(val);
        return val;
      }
      return 1.0;
    }
  },

  'win:getState': {
    type: 'handle',
    description: 'Get live window status',
    handler: ({ window, media }) => {
      const win = window.getWindow();
      return {
        maximized: win?.isMaximized() || false,
        fullscreen: win?.isFullScreen() || false,
        minimized: win?.isMinimized() || false,
        alwaysOnTop: window.getUserAlwaysOnTop(),
        aiPort: window.getPort(),
        hasFfmpeg: media.hasFfmpeg()
      };
    }
  },

  // ==========================================
  // Clipboard
  // ==========================================
  'clipboard:writeImage': {
    type: 'handle',
    description: 'Copy base64 image data to clipboard',
    validate: (dataUrl) => typeof dataUrl === 'string' && dataUrl.startsWith('data:image/'),
    handler: (_deps, _evt, dataUrl) => {
      try {
        const img = nativeImage.createFromDataURL(dataUrl);
        clipboard.writeImage(img);
        return true;
      } catch (err) {
        logger.error('Failed to copy image to clipboard:', err.message);
        return false;
      }
    }
  },

  // ==========================================
  // Media & Streaming (Injected: media, window)
  // ==========================================
  'media:probe': {
    type: 'handle',
    description: 'Probe media file with ffprobe',
    validate: (filePath) => isValidPathString(filePath),
    handler: async ({ media }, _evt, filePath) => {
      return media.probe(filePath);
    }
  },

  'media:stopStream': {
    type: 'handle',
    description: 'Kill active FFmpeg stream and thumbnail worker processes',
    handler: ({ stream, window }) => {
      if (stream) {
        stream.killAll();
      } else {
        window?.killActiveStreamProc?.();
        window?.killActiveThumbProc?.();
      }
      return { ok: true };
    }
  },

  'media:getInitial': {
    type: 'handle',
    description: 'Retrieve pending initial media launched via CLI or association',
    handler: ({ window }) => {
      return window.getInitialMedia();
    }
  },

  // ==========================================
  // Native File/Folder Dialogs (Injected: window, media)
  // ==========================================
  'dialog:openFiles': {
    type: 'handle',
    description: 'Open native file picker dialog for media',
    handler: async ({ window, media }, _evt, multi = false) => {
      const win = window.getWindow();
      const result = await dialog.showOpenDialog(win, {
        title: multi ? 'Open Multiple Media Files' : 'Open Media File',
        properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: [
          {
            name: 'Media Files',
            extensions: Array.from(media.MEDIA_EXTENSIONS).map((e) => e.slice(1))
          },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePaths.length) return null;
      const items = result.filePaths.map((p) => media.buildItem(p));
      const folder = media.scanFolder(items[0].folderPath);
      return { items, folder };
    }
  },

  'dialog:openFolder': {
    type: 'handle',
    description: 'Open native directory picker dialog',
    handler: async ({ window, media }) => {
      const win = window.getWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'Open Media Directory',
        properties: ['openDirectory']
      });

      if (result.canceled || !result.filePaths.length) return null;
      return media.scanFolder(result.filePaths[0]);
    }
  },

  'dialog:openSubtitle': {
    type: 'handle',
    description: 'Open native file picker for subtitle file (.srt, .vtt)',
    handler: async ({ window }) => {
      const win = window.getWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'Load Subtitle File (.srt, .vtt)',
        properties: ['openFile'],
        filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }]
      });

      if (result.canceled || !result.filePaths.length) return null;
      const subPath = result.filePaths[0];
      const content = fs.readFileSync(subPath, 'utf8');
      return { filePath: subPath, name: path.basename(subPath), content };
    }
  },

  // ==========================================
  // Filesystem Operations (Injected: media)
  // ==========================================
  'fs:resolvePaths': {
    type: 'handle',
    description: 'Resolve incoming dropped files/directories and extract media items',
    handler: ({ media }, _evt, paths) => {
      if (!Array.isArray(paths)) return null;
      const valid = paths.filter((p) => pathExists(p));
      if (!valid.length) return null;

      const collectedMediaItems = [];
      let primaryFolder = null;

      for (const p of valid) {
        try {
          const st = fs.statSync(p);
          if (st.isDirectory()) {
            const scanned = media.scanFolder(p);
            if (!primaryFolder) primaryFolder = scanned;
            if (scanned.items && scanned.items.length) {
              collectedMediaItems.push(...scanned.items);
            }
          } else if (st.isFile() && media.MEDIA_EXTENSIONS.has(path.extname(p).toLowerCase())) {
            collectedMediaItems.push(media.buildItem(p));
          }
        } catch (err) {
          logger.warn(`Error resolving path "${p}":`, err.message);
        }
      }

      const subPaths = valid.filter((p) => media.SUB_EXTENSIONS.includes(path.extname(p).toLowerCase()));
      if (!collectedMediaItems.length && subPaths.length) {
        return {
          subtitleOnly: {
            filePath: subPaths[0],
            name: path.basename(subPaths[0]),
            content: fs.readFileSync(subPaths[0], 'utf8')
          }
        };
      }

      if (!collectedMediaItems.length) return null;
      if (!primaryFolder) {
        primaryFolder = media.scanFolder(collectedMediaItems[0].folderPath);
      }
      return { items: collectedMediaItems, folder: primaryFolder };
    }
  },

  'fs:scanFolder': {
    type: 'handle',
    description: 'Scan directory for media items and subfolders',
    validate: (folderPath) => pathExists(folderPath),
    handler: ({ media }, _evt, folderPath) => {
      return media.scanFolder(folderPath);
    }
  },

  'fs:readSubtitle': {
    type: 'handle',
    description: 'Read UTF-8 content of subtitle file',
    validate: (subPath) => pathExists(subPath),
    handler: (_deps, _evt, subPath) => {
      try {
        return {
          filePath: subPath,
          name: path.basename(subPath),
          content: fs.readFileSync(subPath, 'utf8')
        };
      } catch (err) {
        logger.warn(`Failed to read subtitle "${subPath}":`, err.message);
        return null;
      }
    }
  },

  'fs:getQuickFolders': {
    type: 'handle',
    description: 'Retrieve standard OS user folders for media quick navigation',
    handler: () => {
      return [
        { label: 'Videos', path: app.getPath('videos') },
        { label: 'Desktop', path: app.getPath('desktop') },
        { label: 'Downloads', path: app.getPath('downloads') },
        { label: 'Music', path: app.getPath('music') }
      ];
    }
  },

  'fs:saveSnapshot': {
    type: 'handle',
    description: 'Save player snapshot as PNG file to Pictures folder',
    validate: (payload) => payload && typeof payload.dataUrl === 'string' && payload.dataUrl.startsWith('data:image/'),
    handler: (_deps, _evt, { dataUrl, baseName }) => {
      try {
        const picturesDir = path.join(app.getPath('pictures'), 'CopyCat media player Snapshots');
        fs.mkdirSync(picturesDir, { recursive: true });
        const safe = (baseName || 'snapshot').replace(/[<>:"/\\|?*]+/g, '_');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outPath = path.join(picturesDir, `${safe}_${stamp}.png`);
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
        logger.info(`Snapshot saved to: ${outPath}`);
        return { ok: true, outPath };
      } catch (err) {
        logger.error('Failed to save snapshot:', err.message);
        return { ok: false, error: err.message };
      }
    }
  },

  // ==========================================
  // Desktop Shortcuts (Injected: session)
  // ==========================================
  'shortcut:hasDesktop': {
    type: 'handle',
    description: 'Check if desktop shortcut exists',
    handler: ({ session }) => {
      return session.hasShortcut();
    }
  },

  'shortcut:createDesktop': {
    type: 'handle',
    description: 'Create Windows desktop shortcut',
    handler: ({ session }) => {
      return session.createShortcut();
    }
  },

  // ==========================================
  // OS & App Integration (Injected: session)
  // ==========================================
  'app:setDefaultPlayer': {
    type: 'handle',
    description: 'Register file associations for CopyCat media player',
    handler: ({ session }) => {
      return session.registerAssociations(process.execPath);
    }
  },

  'app:installAiIntegration': {
    type: 'handle',
    description: 'Install Antigravity skill & PATH commands',
    handler: ({ session }) => {
      return session.registerAssociations(process.execPath);
    }
  },

  'app:openDefaultAppsSettings': {
    type: 'handle',
    description: 'Open Windows 10/11 Default Apps system settings',
    handler: () => {
      try {
        shell.openExternal('ms-settings:defaultapps');
        return true;
      } catch (err) {
        logger.warn('Failed to open ms-settings:defaultapps:', err.message);
        return false;
      }
    }
  },

  // ==========================================
  // GitHub Auto-Updater (Injected: updater, window)
  // ==========================================
  'updater:check': {
    type: 'handle',
    description: 'Check GitHub releases for updates',
    handler: ({ updater }) => {
      return updater.check();
    }
  },

  'updater:downloadAndInstall': {
    type: 'handle',
    description: 'Download and execute latest release installer',
    handler: ({ updater, window }, _evt, asset) => {
      return updater.downloadAndInstall(asset, window.getWindow());
    }
  },

  // ==========================================
  // Shell Utilities
  // ==========================================
  'shell:reveal': {
    type: 'handle',
    description: 'Reveal item in Windows Explorer',
    validate: (filePath) => pathExists(filePath),
    handler: (_deps, _evt, filePath) => {
      shell.showItemInFolder(filePath);
      return true;
    }
  },

  'shell:openExternal': {
    type: 'handle',
    description: 'Open external URL in default web browser',
    validate: (targetUrl) => typeof targetUrl === 'string' && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://')),
    handler: (_deps, _evt, targetUrl) => {
      shell.openExternal(targetUrl);
      return true;
    }
  },

  // ==========================================
  // Player Status Sync (Injected: window)
  // ==========================================
  'player:statusUpdate': {
    type: 'on',
    description: 'Receive playback telemetry from renderer and update Taskbar thumbar',
    handler: ({ window }, _evt, status) => {
      if (status && typeof status === 'object') {
        window.setStatus(status);
        if (typeof status.playing === 'boolean') {
          window.updateThumbar(status.playing);
        }
      }
    }
  }
};

/**
 * Register all declarative IPC handlers using injected services
 * @param {Object|ServiceContainer} containerOrServices
 */
function registerIpcRegistry(containerOrServices) {
  // Extract typed services from container or object
  const services = {
    window: containerOrServices.has && containerOrServices.has('window')
      ? containerOrServices.get('window')
      : containerOrServices.window,
    stream: containerOrServices.has && containerOrServices.has('stream')
      ? containerOrServices.get('stream')
      : containerOrServices.stream,
    media: containerOrServices.has && containerOrServices.has('media')
      ? containerOrServices.get('media')
      : containerOrServices.media,
    session: containerOrServices.has && containerOrServices.has('session')
      ? containerOrServices.get('session')
      : containerOrServices.session,
    updater: containerOrServices.has && containerOrServices.has('updater')
      ? containerOrServices.get('updater')
      : containerOrServices.updater
  };

  logger.info(`Registering ${Object.keys(IPC_HANDLERS).length} declarative IPC channels with injected services...`);

  for (const [channel, def] of Object.entries(IPC_HANDLERS)) {
    const wrappedHandler = async (evt, ...args) => {
      try {
        if (typeof def.validate === 'function') {
          const isValid = def.validate(...args);
          if (!isValid) {
            logger.warn(`Validation failed for IPC channel "${channel}" with args:`, args);
            return null;
          }
        }
        return await def.handler(services, evt, ...args);
      } catch (err) {
        logger.error(`Error in IPC handler "${channel}":`, err.stack || err.message);
        return { ok: false, error: err.message };
      }
    };

    if (def.type === 'handle' || def.type === 'both') {
      try {
        ipcMain.removeHandler(channel);
      } catch {}
      ipcMain.handle(channel, wrappedHandler);
    }

    if (def.type === 'on' || def.type === 'both') {
      ipcMain.removeAllListeners(channel);
      ipcMain.on(channel, (evt, ...args) => {
        wrappedHandler(evt, ...args).catch(() => {});
      });
    }
  }

  logger.info('Declarative IPC Registry successfully initialized with dependency injection.');
}

module.exports = {
  IPC_HANDLERS,
  registerIpcRegistry
};
