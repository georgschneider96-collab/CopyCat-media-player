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

const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

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

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
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
    width: 1180,
    height: 700,
    minWidth: 680,
    minHeight: 420,
    frame: false,
    backgroundColor: '#0A0A0A',
    title: 'CopyCat media player',
    icon: windowIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2 || process.env.COPYCAT_DEBUG) {
      mainLogger.debug(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
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
        let pathname = decodeURIComponent(request.url.replace(/^media:\/\/\/?/i, ''));
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathname)) {
          pathname = pathname.slice(1);
        }
        return net.fetch(pathToFileURL(path.resolve(pathname)).href);
      } catch (err) {
        mainLogger.warn('Media protocol error:', err.message);
        return new Response('Media file not found', { status: 404 });
      }
    });

    startAiControlServer(4500, container);
    createMainWindow();

    setTimeout(() => {
      sessionService.registerAssociations(process.execPath);
    }, 1500);

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
});

app.on('window-all-closed', () => {
  streamManager.killAll();
  if (process.platform !== 'darwin') app.quit();
});
