// src/main/server.js
// Local HTTP AI Control Server & Streaming Engine with Dynamic Command Registry

const http = require('http');
const fs = require('fs');
const { createLogger } = require('./logger');

const logger = createLogger('Server');

/**
 * Robust HTTP Response Helper
 */
function sendJson(res, status, obj) {
  try {
    const body = JSON.stringify(obj, null, 2);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
  } catch (err) {
    logger.error('Failed to send JSON response:', err.message);
  }
}

/**
 * Safe Helper to forward commands to the Renderer Process
 */
function forwardToRenderer(window, payload) {
  const win = window.getWindow();
  if (!win || win.isDestroyed()) return;

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.webContents.send('ai:command', payload);
        }
      }, 250);
    });
  } else {
    win.webContents.send('ai:command', payload);
  }
}

/**
 * Dynamic Command Registry (Modular Command Pattern for Port 4500)
 */
class CommandRegistry {
  constructor() {
    this._commands = new Map();
  }

  /**
   * Register an action handler
   * @param {string} action Command / action name (e.g. 'play', 'seek', 'openFile')
   * @param {Object} definition { description, validate?: fn, execute: fn }
   */
  register(action, definition) {
    this._commands.set(action, definition);
    return this;
  }

  has(action) {
    return this._commands.has(action);
  }

  get(action) {
    return this._commands.get(action);
  }

  getSupportedActions() {
    return Array.from(this._commands.keys());
  }

  getDescriptions() {
    const desc = {};
    for (const [action, def] of this._commands.entries()) {
      desc[action] = def.description || '';
    }
    return desc;
  }

  /**
   * Execute registered action with validation and error boundary
   */
  async execute(action, payload, services) {
    const command = this._commands.get(action);
    if (!command) {
      return {
        ok: false,
        status: 400,
        error: `Unknown action "${action}". Supported actions: ${this.getSupportedActions().join(', ')}`
      };
    }

    if (typeof command.validate === 'function') {
      const val = command.validate(payload, services);
      if (!val.valid) {
        return {
          ok: false,
          status: val.status || 400,
          error: val.error
        };
      }
    }

    try {
      const result = await command.execute(payload, services);
      return {
        ok: true,
        status: 200,
        dispatched: action,
        ...(result || {})
      };
    } catch (err) {
      logger.error(`Error executing command "${action}":`, err.stack || err.message);
      return {
        ok: false,
        status: 500,
        error: err.message
      };
    }
  }
}

/**
 * Build the Default Command Registry for VLCopyCat
 * @returns {CommandRegistry}
 */
function createDefaultCommandRegistry() {
  const registry = new CommandRegistry();

  // ------------------------------------------
  // Application Lifecycle Commands
  // ------------------------------------------
  registry.register('quit', {
    description: 'Quit CopyCat media player application',
    execute: async (_payload, { window }) => {
      setTimeout(() => {
        const win = window.getWindow();
        if (win && !win.isDestroyed()) win.close();
        else window.quit();
      }, 100);
      return {};
    }
  });

  registry.register('close', {
    description: 'Close active window',
    execute: async (_payload, { window }) => {
      setTimeout(() => {
        const win = window.getWindow();
        if (win && !win.isDestroyed()) win.close();
        else window.quit();
      }, 100);
      return {};
    }
  });

  registry.register('bringToFront', {
    description: 'Bring player window to front and focus',
    execute: async (_payload, { window }) => {
      window.bringToFront();
      return {};
    }
  });

  registry.register('show', {
    description: 'Show and focus window (alias for bringToFront)',
    execute: async (_payload, { window }) => {
      window.bringToFront();
      return {};
    }
  });

  registry.register('focus', {
    description: 'Focus window (alias for bringToFront)',
    execute: async (_payload, { window }) => {
      window.bringToFront();
      return {};
    }
  });

  registry.register('minimize', {
    description: 'Minimize player window',
    execute: async (_payload, { window }) => {
      const win = window.getWindow();
      if (win && !win.isDestroyed()) {
        if (win.isFullScreen()) win.setFullScreen(false);
        win.minimize();
      }
      return {};
    }
  });

  registry.register('restore', {
    description: 'Restore minimized player window',
    execute: async (_payload, { window }) => {
      const win = window.getWindow();
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        window.bringToFront(win);
        window.broadcastState();
      }
      return {};
    }
  });

  registry.register('togglePip', {
    description: 'Toggle Picture-in-Picture window mode',
    execute: async (_payload, { window }) => {
      const win = window.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.executeJavaScript('document.getElementById("btn-pip")?.click()', true).catch(() => {});
      }
      return {};
    }
  });

  registry.register('toggleFullscreen', {
    description: 'Toggle fullscreen playback mode',
    execute: async (payload, { window }) => {
      forwardToRenderer(window, payload);
      return {};
    }
  });

  // ------------------------------------------
  // Media Loading & Navigation Commands
  // ------------------------------------------
  registry.register('openFile', {
    description: 'Open and play a local media file (requires "filePath")',
    validate: (payload) => {
      if (!payload.filePath || typeof payload.filePath !== 'string') {
        return { valid: false, status: 400, error: 'Action "openFile" requires a string "filePath"' };
      }
      if (!fs.existsSync(payload.filePath)) {
        return { valid: false, status: 404, error: `File not found: ${payload.filePath}` };
      }
      return { valid: true };
    },
    execute: async (payload, { window, media }) => {
      const item = media.buildItem(payload.filePath);
      const folder = media.scanFolder(item.folderPath);
      payload.resolved = { item, folder };
      forwardToRenderer(window, payload);
      return { filePath: payload.filePath, title: item.title };
    }
  });

  registry.register('openFolder', {
    description: 'Open a local directory in library sidebar (requires "folderPath")',
    validate: (payload) => {
      if (!payload.folderPath || typeof payload.folderPath !== 'string') {
        return { valid: false, status: 400, error: 'Action "openFolder" requires a string "folderPath"' };
      }
      if (!fs.existsSync(payload.folderPath)) {
        return { valid: false, status: 404, error: `Folder not found: ${payload.folderPath}` };
      }
      return { valid: true };
    },
    execute: async (payload, { window, media }) => {
      payload.resolvedFolder = media.scanFolder(payload.folderPath);
      forwardToRenderer(window, payload);
      return { folderPath: payload.folderPath };
    }
  });

  registry.register('enqueue', {
    description: 'Enqueue one or more media files into the playlist (requires "filePath" or "filePaths")',
    validate: (payload, { media }) => {
      const rawList = Array.isArray(payload.filePaths)
        ? payload.filePaths
        : payload.filePath
          ? [payload.filePath]
          : [];
      const validItems = rawList
        .filter((p) => p && typeof p === 'string' && fs.existsSync(p))
        .map((p) => media.buildItem(p));
      if (!validItems.length) {
        return { valid: false, status: 404, error: 'No valid existing media files found to enqueue' };
      }
      payload.resolvedItems = validItems;
      return { valid: true };
    },
    execute: async (payload, { window }) => {
      forwardToRenderer(window, payload);
      return { count: payload.resolvedItems.length };
    }
  });

  // ------------------------------------------
  // Core Playback Controls
  // ------------------------------------------
  const simplePlaybackActions = ['play', 'pause', 'togglePlay', 'stop', 'next', 'prev', 'mute'];
  for (const act of simplePlaybackActions) {
    registry.register(act, {
      description: `Trigger playback action "${act}"`,
      execute: async (payload, { window }) => {
        forwardToRenderer(window, payload);
        return {};
      }
    });
  }

  registry.register('seek', {
    description: 'Seek playback position (value in seconds, or delta in seconds)',
    validate: (payload) => {
      if (payload.value !== undefined && Number.isNaN(Number(payload.value))) {
        return { valid: false, status: 400, error: 'Seek "value" must be a valid number (seconds)' };
      }
      if (payload.delta !== undefined && Number.isNaN(Number(payload.delta))) {
        return { valid: false, status: 400, error: 'Seek "delta" must be a valid number (seconds)' };
      }
      return { valid: true };
    },
    execute: async (payload, { window }) => {
      forwardToRenderer(window, payload);
      return {};
    }
  });

  registry.register('volume', {
    description: 'Set player volume 0..200 (supports VLC 200% gain boost)',
    validate: (payload) => {
      if (payload.value === undefined || Number.isNaN(Number(payload.value))) {
        return { valid: false, status: 400, error: 'Volume action requires numeric "value" (0..200)' };
      }
      payload.value = Math.max(0, Math.min(200, Number(payload.value)));
      return { valid: true };
    },
    execute: async (payload, { window }) => {
      forwardToRenderer(window, payload);
      return { volume: payload.value };
    }
  });

  registry.register('speed', {
    description: 'Set playback rate 0.25..4.0',
    validate: (payload) => {
      if (payload.value === undefined || Number.isNaN(Number(payload.value))) {
        return { valid: false, status: 400, error: 'Speed action requires numeric "value" (0.25..4.0)' };
      }
      payload.value = Math.max(0.25, Math.min(4.0, Number(payload.value)));
      return { valid: true };
    },
    execute: async (payload, { window }) => {
      forwardToRenderer(window, payload);
      return { speed: payload.value };
    }
  });

  registry.register('setAccent', {
    description: 'Switch accent theme color (orange, amber, lime, emerald, cyan, blue, purple, magenta, rose, or #hex)',
    validate: (payload) => {
      if (!payload.value || typeof payload.value !== 'string') {
        return { valid: false, status: 400, error: 'setAccent action requires a string "value"' };
      }
      return { valid: true };
    },
    execute: async (payload, { window }) => {
      forwardToRenderer(window, payload);
      return { accent: payload.value };
    }
  });

  return registry;
}

/**
 * Start the Local HTTP AI Control Server with Injected Services & Command Registry
 * @param {number} port
 * @param {Object|ServiceContainer} containerOrServices
 * @param {CommandRegistry|null} customRegistry Optional custom command registry
 */
function startAiControlServer(port = 4500, containerOrServices, customRegistry = null) {
  // Resolve injected services
  const services = {
    window: containerOrServices.has && containerOrServices.has('window')
      ? containerOrServices.get('window')
      : containerOrServices.window,
    stream: containerOrServices.has && containerOrServices.has('stream')
      ? containerOrServices.get('stream')
      : containerOrServices.stream,
    media: containerOrServices.has && containerOrServices.has('media')
      ? containerOrServices.get('media')
      : containerOrServices.media
  };

  const { window, stream, media } = services;
  const commandRegistry = customRegistry || createDefaultCommandRegistry();

  const server = http.createServer((req, res) => {
    // 1. CORS Preflight Middleware
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const currentPort = window.getPort();
    const urlObj = new URL(req.url || '/', `http://127.0.0.1:${currentPort}`);
    const pathname = urlObj.pathname;

    // 2. GET / (Documentation & Discovery)
    if (req.method === 'GET' && pathname === '/') {
      return sendJson(res, 200, {
        name: 'CopyCat media player Local AI Control Bridge',
        version: '1.2.0',
        port: currentPort,
        ffmpegEnabled: media.hasFfmpeg(),
        endpoints: {
          'GET /api/status': 'Inspect live playback state, title, timestamps, volume, speed, and theme',
          'GET /api/stream': 'Zero-disk FFmpeg fragmented MP4 live stream for MPEG-TS, MKV, AVI, AC3, HEVC, etc.',
          'GET /api/thumb': 'Instant seekbar hover thumbnail preview frame generator',
          'POST /api/control': {
            description: 'Control CopyCat media player from any AI assistant, CLI or local script',
            actions: commandRegistry.getSupportedActions()
          }
        },
        actions: commandRegistry.getDescriptions(),
        status: window.getStatus()
      });
    }

    // 3. GET /api/status or /status
    if (req.method === 'GET' && (pathname === '/api/status' || pathname === '/status')) {
      const win = window.getWindow();
      return sendJson(res, 200, {
        ok: true,
        ...window.getStatus(),
        minimized: win?.isMinimized() || false,
        pipActive: window.isInPipMode,
        pipBounds: window.isInPipMode ? window.lastPipBounds : null
      });
    }

    // 4. GET /api/stream (Delegated to dedicated StreamProcessManager)
    if (req.method === 'GET' && pathname === '/api/stream') {
      return stream.handleStreamRequest(urlObj, req, res, media);
    }

    // 5. GET /api/thumb (Delegated to dedicated StreamProcessManager)
    if (req.method === 'GET' && pathname === '/api/thumb') {
      return stream.handleThumbRequest(urlObj, req, res, media);
    }

    // 6. POST /api/control or /command (Executed via Modular Command Registry)
    if (req.method === 'POST' && (pathname === '/api/control' || pathname === '/command')) {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 1e6) {
          logger.warn('Incoming POST payload exceeded 1MB limit. Destroying connection.');
          req.destroy();
        }
      });

      req.on('end', async () => {
        let payload;
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch (jsonErr) {
          logger.warn('Invalid JSON payload received:', jsonErr.message);
          return sendJson(res, 400, { ok: false, error: 'Malformed JSON payload' });
        }

        // Normalize action / command field
        const action = payload.action || payload.command;
        if (!action || typeof action !== 'string') {
          return sendJson(res, 400, { ok: false, error: 'Missing required "action" field in payload' });
        }
        payload.action = action;

        // Dispatch via Command Registry
        const result = await commandRegistry.execute(action, payload, services);
        const httpStatus = result.status || (result.ok ? 200 : 400);

        logger.info(`Command dispatched: ${action} (HTTP ${httpStatus})`);
        return sendJson(res, httpStatus, result);
      });
      return;
    }

    // 7. Fallback: 404 Not Found
    return sendJson(res, 404, {
      ok: false,
      error: `Endpoint "${pathname}" not found. Visit GET / for full API documentation.`
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 4510) {
      logger.warn(`Port ${port} in use, trying port ${port + 1}...`);
      startAiControlServer(port + 1, services, commandRegistry);
    } else {
      logger.error('HTTP Server error:', err.message);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    window.setPort(port);
    logger.info(`Local AI Control Server running at http://127.0.0.1:${port}`);
    window.broadcastState();
  });

  server.commandRegistry = commandRegistry;
  return server;
}

module.exports = {
  CommandRegistry,
  createDefaultCommandRegistry,
  startAiControlServer
};
