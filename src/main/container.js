// src/main/container.js
// Lightweight Service Container & Dependency Injection Registry for VLCopyCat

const { app } = require('electron');
const { createLogger } = require('./logger');
const mediaResolver = require('./media-resolver');
const sessionModule = require('./session');
const updaterModule = require('./updater');
const { createStreamManager } = require('./stream-manager');

const logger = createLogger('Container');

/**
 * Lightweight Service Container (IoC)
 */
class ServiceContainer {
  constructor() {
    this._services = new Map();
    this._factories = new Map();
  }

  register(name, instance) {
    this._services.set(name, instance);
    return this;
  }

  factory(name, factoryFn) {
    this._factories.set(name, factoryFn);
    return this;
  }

  get(name) {
    if (this._services.has(name)) {
      return this._services.get(name);
    }
    if (this._factories.has(name)) {
      const instance = this._factories.get(name)(this);
      this._services.set(name, instance);
      return instance;
    }
    throw new Error(`Service "${name}" is not registered in the ServiceContainer.`);
  }

  has(name) {
    return this._services.has(name) || this._factories.has(name);
  }

  getAll() {
    const all = {};
    for (const [key, value] of this._services.entries()) {
      all[key] = value;
    }
    for (const key of this._factories.keys()) {
      if (!all[key]) {
        all[key] = this.get(key);
      }
    }
    return all;
  }
}

/**
 * Window & Playback State Manager Service
 */
class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.aiServerPort = 4500;
    this.userAlwaysOnTop = false;
    this.isInPipMode = false;
    this.wasFullscreenBeforePip = false;
    this.restoringFromPipLeave = false;
    this.lastPipBounds = null;
    this.pendingInitialMedia = null;

    this.latestPlayerStatus = {
      app: 'CopyCat media player',
      playing: false,
      title: null,
      filePath: null,
      currentTime: 0,
      duration: 0,
      volume: 100,
      muted: false,
      speed: 1,
      accent: 'orange',
      queueLength: 0,
      streamEngine: 'native'
    };
  }

  getWindow() {
    return this.mainWindow;
  }

  setWindow(win) {
    this.mainWindow = win;
  }

  isAvailable() {
    return Boolean(this.mainWindow && !this.mainWindow.isDestroyed());
  }

  /**
   * Bind all window lifecycle and state events (clean separation from main.js)
   * @param {BrowserWindow} win
   */
  attachWindow(win) {
    this.mainWindow = win;

    const forceShowTimer = setTimeout(() => {
      if (this.isAvailable() && !win.isVisible()) {
        this.bringToFront(win);
        this.broadcastState();
      }
    }, 1200);

    win.once('ready-to-show', () => {
      clearTimeout(forceShowTimer);
      this.bringToFront(win);
      this.broadcastState();
      this.updateThumbar(false);

      const initial = this.getInitialMedia();
      if (initial) {
        win.webContents.send('media:initial', initial);
      }
    });

    win.webContents.on('did-finish-load', () => {
      const initial = this.getInitialMedia();
      if (initial) {
        win.webContents.send('media:initial', initial);
      }
    });

    win.on('maximize', () => this.broadcastState());
    win.on('unmaximize', () => this.broadcastState());
    win.on('enter-full-screen', () => this.broadcastState());
    win.on('leave-full-screen', () => this.broadcastState());

    win.on('minimize', () => {
      this.broadcastState();
      if (this.isAvailable()) {
        win.webContents.send('win:minimize');
      }
    });

    win.on('restore', () => {
      this.broadcastState();
      if (this.isAvailable()) {
        win.webContents.send('win:restore');
      }
      if (this.isInPipMode && !this.restoringFromPipLeave && this.isAvailable()) {
        this.isInPipMode = false;
        win.webContents.send('pip:exitRequested');
        if (this.wasFullscreenBeforePip) {
          this.wasFullscreenBeforePip = false;
          win.setFullScreen(true);
        }
      }
    });

    logger.info('Window lifecycle events successfully attached.');
  }

  getPort() {
    return this.aiServerPort;
  }

  setPort(port) {
    this.aiServerPort = port;
  }

  getStatus() {
    return this.latestPlayerStatus;
  }

  setStatus(status) {
    if (status && typeof status === 'object') {
      this.latestPlayerStatus = { ...this.latestPlayerStatus, ...status };
    }
  }

  getInitialMedia() {
    const initial = this.pendingInitialMedia;
    this.pendingInitialMedia = null;
    return initial;
  }

  setInitialMedia(payload) {
    this.pendingInitialMedia = payload;
  }

  getUserAlwaysOnTop() {
    return this.userAlwaysOnTop;
  }

  applyAlwaysOnTop(flag) {
    this.userAlwaysOnTop = Boolean(flag);
    if (this.isAvailable()) {
      try {
        this.mainWindow.setAlwaysOnTop(this.userAlwaysOnTop, 'screen-saver');
      } catch {
        this.mainWindow.setAlwaysOnTop(this.userAlwaysOnTop);
      }
    }
    this.broadcastState();
    return this.userAlwaysOnTop;
  }

  broadcastState() {
    if (!this.isAvailable()) return;
    this.mainWindow.webContents.send('win:state', {
      maximized: this.mainWindow.isMaximized(),
      fullscreen: this.mainWindow.isFullScreen(),
      minimized: this.mainWindow.isMinimized(),
      alwaysOnTop: this.userAlwaysOnTop,
      aiPort: this.aiServerPort,
      hasFfmpeg: mediaResolver.hasFfmpeg()
    });
  }

  async enterPip(aspect = 16 / 9) {
    if (!this.isAvailable()) return false;
    this.isInPipMode = true;

    if (this.mainWindow.isFullScreen()) {
      this.wasFullscreenBeforePip = true;
      this.mainWindow.setFullScreen(false);
    } else {
      this.wasFullscreenBeforePip = false;
    }

    if (!this.mainWindow.isMinimized()) {
      this.mainWindow.minimize();
    }

    const res = await sessionModule.resizePipWindow(this.mainWindow, aspect);
    if (res.bounds) {
      this.lastPipBounds = res.bounds;
    }

    setTimeout(() => {
      if (this.isInPipMode && this.isAvailable()) {
        sessionModule.resizePipWindow(this.mainWindow, aspect);
      }
    }, 120);

    this.broadcastState();
    return res.success;
  }

  leavePip(opts = {}) {
    if (!this.isAvailable()) return false;
    const wasActive = this.isInPipMode;
    this.isInPipMode = false;
    this.lastPipBounds = null;
    const shouldRestore = opts?.restore !== false;

    if (wasActive && shouldRestore) {
      this.restoringFromPipLeave = true;
      try {
        sessionModule.restoreMainWindowWin32(this.mainWindow);
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
        if (this.wasFullscreenBeforePip) {
          this.wasFullscreenBeforePip = false;
          this.mainWindow.setFullScreen(true);
        }
      } finally {
        setTimeout(() => {
          this.restoringFromPipLeave = false;
          this.broadcastState();
        }, 220);
      }
    } else {
      this.wasFullscreenBeforePip = false;
    }

    this.broadcastState();
    return true;
  }

  bringToFront(win = this.mainWindow) {
    sessionModule.bringToFront(win, this.userAlwaysOnTop);
  }

  updateThumbar(isPlaying = false) {
    sessionModule.updateThumbarButtons(this.mainWindow, isPlaying);
  }

  quit() {
    app.quit();
  }
}

/**
 * Initialize and populate the global Dependency Injection Container
 * @returns {ServiceContainer}
 */
function createAppContainer() {
  const container = new ServiceContainer();

  // 1. Core Window & App State Manager
  const windowManager = new WindowManager();
  container.register('window', windowManager);

  // 2. Stream Process Manager (Dedicated process lifecycle for FFmpeg live streams & preview thumbnails)
  const streamManager = createStreamManager();
  container.register('stream', streamManager);

  // 3. Media Resolver Service
  const mediaService = {
    hasFfmpeg: mediaResolver.hasFfmpeg,
    hasFfprobe: mediaResolver.hasFfprobe,
    getFfmpegPath: () => mediaResolver.FFMPEG_PATH,
    getFfprobePath: () => mediaResolver.FFPROBE_PATH,
    probe: mediaResolver.probeMediaFile,
    buildItem: mediaResolver.buildMediaItem,
    scanFolder: mediaResolver.scanMediaFolder,
    findAutoSubtitle: mediaResolver.findAutoSubtitle,
    detectNeedsStream: mediaResolver.detectNeedsStream,
    resolveCliFile: mediaResolver.resolveCliMediaFile,
    MEDIA_EXTENSIONS: mediaResolver.MEDIA_EXTENSIONS,
    SUB_EXTENSIONS: mediaResolver.SUB_EXTENSIONS
  };
  container.register('media', mediaService);

  // 4. Windows Session Service
  const sessionService = {
    hasShortcut: sessionModule.hasDesktopShortcut,
    createShortcut: sessionModule.createDesktopShortcut,
    registerAssociations: sessionModule.runAssociationsRegistration,
    handleBreakout: sessionModule.handleAiSandboxBreakout,
    bringToFront: sessionModule.bringToFront,
    updateThumbar: (isPlaying) => windowManager.updateThumbar(isPlaying)
  };
  container.register('session', sessionService);

  // 5. GitHub Updater Service
  const updaterService = {
    check: updaterModule.checkForUpdates,
    downloadAndInstall: (asset, win) => updaterModule.downloadAndInstallUpdate(asset, win || windowManager.getWindow())
  };
  container.register('updater', updaterService);

  // 6. Structured Logger Service
  container.register('logger', {
    createLogger,
    mainLogger: createLogger('Main')
  });

  logger.info('Service Container initialized with services: window, stream, media, session, updater, logger');
  return container;
}

module.exports = {
  ServiceContainer,
  WindowManager,
  createAppContainer
};
