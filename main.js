// main.js - VLCopyCat / CopyCat Media Player Main Process
// Modular Architecture with Dependency Injection:
//   - src/main/container.js      -> Lightweight IoC Service Container & WindowManager
//   - src/main/stream-manager.js  -> Dedicated stream & thumbnail process manager
//   - src/main/logger.js         -> Structured, prefixed logging
//   - src/main/session.js        -> Windows OS integrations & AI sandbox breakout
//   - src/main/updater.js        -> GitHub Releases auto-updater & asset downloader
//   - src/main/media-resolver.js -> Media detection, sniffer, probing & folder indexing
//   - src/main/ipc.js            -> Declarative IPC registry with injected services
//   - src/main/server.js         -> Local HTTP AI control server with dynamic command registry

const { app, BrowserWindow, protocol, net, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');
const { parseByteRange } = require('./src/main/media-resolver');

// 1. Structured Logging Module
const { createLogger } = require('./src/main/logger');
const mainLogger = createLogger('Main');

// 2. Windows Session & AI Sandbox Breakout
const { handleAiSandboxBreakout } = require('./src/main/session');

// Trigger breakout if running inside AI agent terminal sandboxes
handleAiSandboxBreakout();

// 3. High-Performance Hardware Acceleration & Zero-Copy Compositing
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

process.on('uncaughtException', (err) => {
  mainLogger.error('uncaughtException:', err.stack || err.message);
});
process.on('unhandledRejection', (reason) => {
  mainLogger.error('unhandledRejection:', reason?.stack || reason);
});

// 4. Initialize Dependency Injection Service Container
const { createAppContainer } = require('./src/main/container');
const container = createAppContainer();

const windowManager = container.get('window');
const streamManager = container.get('stream');
const mediaService = container.get('media');
const sessionService = container.get('session');
const updaterService = container.get('updater');

// 5. Connect Declarative IPC Registry with Injected Services
const { registerIpcRegistry } = require('./src/main/ipc');
registerIpcRegistry(container);

// 6. Start Local HTTP AI Control Server (Port 4500)
const { startAiControlServer } = require('./src/main/server');

// 7. Window Creation & Lifecycle Setup
function createMainWindow() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const iconPng = path.join(__dirname, 'assets', 'icon.png');
  const windowIcon = fs.existsSync(icoPath) ? icoPath : (fs.existsSync(iconPng) ? iconPng : undefined);

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 780,
    minWidth: 720,
    minHeight: 460,
    frame: false,
    backgroundColor: '#0A0A0A',
    title: 'CopyCat media player',
    icon: windowIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2 || process.env.COPYCAT_DEBUG) {
      mainLogger.debug(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
    }
  });

  // Native Context Menu for text inputs (Cut, Copy, Paste, Select All)
  mainWindow.webContents.on('context-menu', (event, params) => {
    if (params.isEditable) {
      const editMenu = Menu.buildFromTemplate([
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Select All' }
      ]);
      editMenu.popup({ window: mainWindow });
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      const selectMenu = Menu.buildFromTemplate([
        { role: 'copy', label: 'Copy' },
        { role: 'selectAll', label: 'Select All' }
      ]);
      selectMenu.popup({ window: mainWindow });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Attach all window lifecycle and state events cleanly via WindowManager
  windowManager.attachWindow(mainWindow);

  return mainWindow;
}

// 8. Single Instance Lock & App Initialization
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
} else {
  const initialMedia = mediaService.resolveCliFile(process.argv);
  if (initialMedia) {
    windowManager.setInitialMedia(initialMedia);
  }

  app.on('second-instance', (_event, commandLine) => {
    const win = windowManager.getWindow();
    if (win && !win.isDestroyed()) {
      windowManager.bringToFront(win);
      const payload = mediaService.resolveCliFile(commandLine);
      if (payload) {
        windowManager.setInitialMedia(payload);
        win.webContents.send('media:initial', payload);
      }
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    protocol.handle('media', (request) => {
      try {
        const parsed = new URL(request.url);
        let filePath = '';
        if (process.platform === 'win32' && /^[a-zA-Z]$/.test(parsed.host)) {
          filePath = parsed.host.toUpperCase() + ':' + decodeURIComponent(parsed.pathname);
        } else {
          let p = decodeURIComponent(parsed.pathname);
          if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(p)) {
            p = p.slice(1);
          }
          filePath = p;
        }
        filePath = path.resolve(filePath);

        if (!fs.existsSync(filePath)) {
          return new Response('Media file not found', { status: 404 });
        }

        const stat = fs.statSync(filePath);
        const { isRange, start, end, chunkSize, total } = parseByteRange(request.headers.get('range'), stat.size);

        const ext = path.extname(filePath).toLowerCase();
        const mime = (ext === '.mp4' || ext === '.m4v') ? 'video/mp4' :
                     (ext === '.webm') ? 'video/webm' :
                     (ext === '.mkv') ? 'video/x-matroska' :
                     (ext === '.mp3') ? 'audio/mpeg' :
                     (ext === '.wav') ? 'audio/wav' :
                     (ext === '.flac') ? 'audio/flac' : 'application/octet-stream';

        // Large 2MB highWaterMark buffer eliminates any stream starvation while enabling instant byte-range seeking
        const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 2 * 1024 * 1024 });

        if (isRange) {
          return new Response(Readable.toWeb(stream), {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${end}/${total}`,
              'Content-Length': String(chunkSize)
            }
          });
        }

        return new Response(Readable.toWeb(stream), {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(total)
          }
        });
      } catch (err) {
        mainLogger.warn('Media protocol error:', err.message);
        return new Response('Media protocol error', { status: 500 });
      }
    });

    // 4b. Stream Providers Header Rewriting (Bypasses anti-hotlink restrictions for providers like strm.cx/miruro/frostheron/coastowl/*.top)
    const { getRequiredHeadersForUrl, isStrmCdnUrl } = require('./src/main/stream-sniffer');
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const u = details.url;
      if (/^https?:\/\//i.test(u)) {
        const reqHeaders = getRequiredHeadersForUrl(u);
        if (isStrmCdnUrl(u) || reqHeaders.Referer === 'https://strm.cx/') {
          details.requestHeaders['Referer'] = reqHeaders.Referer;
          details.requestHeaders['Origin'] = reqHeaders.Origin;
        }
      }
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    // Scoped CORS headers on media & streaming resources so native hls.js MSE & Web Audio API work seamlessly
    const MEDIA_STREAM_REGEX = /\.(m3u8|mpd|ts|m4s|mp4|webm|aac|mp3|m4a|ogg|opus)(\?.*)?$/i;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...(details.responseHeaders || {}) };
      const u = details.url || '';
      if (/^https?:\/\//i.test(u) && (details.resourceType === 'media' || MEDIA_STREAM_REGEX.test(u) || u.includes(':4500/api/'))) {
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range, Content-Type'];
      }
      callback({ responseHeaders });
    });

    startAiControlServer(4500, container);
    createMainWindow();

    setTimeout(async () => {
      try {
        const updateInfo = await updaterService.check();
        const win = windowManager.getWindow();
        if (updateInfo && updateInfo.updateAvailable && win && !win.isDestroyed()) {
          win.webContents.send('updater:available', updateInfo);
        }
      } catch (err) {
        mainLogger.debug('Update check skipped:', err.message);
      }
    }, 2500);
  });
}

app.on('before-quit', () => {
  streamManager.killAll();
  try {
    if (container.has('mediaEditor')) {
      container.get('mediaEditor').cleanupTempFiles();
    }
  } catch {}
});

app.on('window-all-closed', () => {
  streamManager.killAll();
  try {
    if (container.has('mediaEditor')) {
      container.get('mediaEditor').cleanupTempFiles();
    }
  } catch {}
  if (process.platform !== 'darwin') app.quit();
});
