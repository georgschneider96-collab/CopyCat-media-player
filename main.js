const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.ogv',
  '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
]);

const SUB_EXTENSIONS = ['.srt', '.vtt'];

let mainWindow = null;
let aiServerPort = 4500;
let latestPlayerStatus = {
  app: 'VLCopyCAT',
  playing: false,
  title: null,
  filePath: null,
  currentTime: 0,
  duration: 0,
  volume: 100,
  muted: false,
  speed: 1,
  accent: 'orange',
  queueLength: 0
};

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function findAutoSubtitle(mediaFilePath) {
  try {
    const dir = path.dirname(mediaFilePath);
    const base = path.basename(mediaFilePath, path.extname(mediaFilePath));
    for (const ext of SUB_EXTENSIONS) {
      const candidate = path.join(dir, base + ext);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const entries = fs.readdirSync(dir);
    const match = entries.find((f) => {
      const lower = f.toLowerCase();
      return (
        lower.startsWith(base.toLowerCase() + '.') &&
        SUB_EXTENSIONS.some((ext) => lower.endsWith(ext))
      );
    });
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

function buildMediaItem(filePath) {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();
  const isAudio = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'].includes(ext);
  const folderPath = path.dirname(resolved);
  const autoSubPath = findAutoSubtitle(resolved);
  return {
    filePath: resolved,
    fileUrl: pathToFileURL(resolved).href,
    name: path.basename(resolved),
    title: path.basename(resolved, path.extname(resolved)),
    ext,
    isAudio,
    folderPath,
    folderName: path.basename(folderPath) || folderPath,
    autoSubPath
  };
}

function scanMediaFolder(folderPath) {
  try {
    const resolvedDir = path.resolve(folderPath);
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const files = entries
      .filter((d) => d.isFile() && MEDIA_EXTENSIONS.has(path.extname(d.name).toLowerCase()))
      .map((d) => d.name)
      .sort(naturalCompare)
      .map((name) => buildMediaItem(path.join(resolvedDir, name)));
    return {
      folderPath: resolvedDir,
      folderName: path.basename(resolvedDir) || resolvedDir,
      items: files
    };
  } catch (err) {
    return { folderPath, folderName: path.basename(folderPath || ''), items: [], error: err.message };
  }
}

function broadcastWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('win:state', {
    maximized: mainWindow.isMaximized(),
    fullscreen: mainWindow.isFullScreen(),
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
    aiPort: aiServerPort
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 700,
    minWidth: 680,
    minHeight: 420,
    frame: false,
    backgroundColor: '#0A0A0A',
    title: 'VLCopyCAT',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    broadcastWindowState();

    // Check if a media file was passed via CLI args
    const cliFile = process.argv.slice(1).find((arg) => {
      if (arg.startsWith('-')) return false;
      const ext = path.extname(arg).toLowerCase();
      return MEDIA_EXTENSIONS.has(ext) && fs.existsSync(arg);
    });
    if (cliFile) {
      const item = buildMediaItem(cliFile);
      const sibling = scanMediaFolder(item.folderPath);
      mainWindow.webContents.send('media:initial', { item, folder: sibling });
    }
  });

  mainWindow.on('maximize', broadcastWindowState);
  mainWindow.on('unmaximize', broadcastWindowState);
  mainWindow.on('enter-full-screen', broadcastWindowState);
  mainWindow.on('leave-full-screen', broadcastWindowState);
}

function startAiControlServer(port = 4500) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const sendJson = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj, null, 2));
    };

    if (req.method === 'GET' && (req.url === '/' || req.url === '/api')) {
      return sendJson(200, {
        name: 'VLCopyCAT Local AI Control Bridge',
        version: '1.0.0',
        port: aiServerPort,
        endpoints: {
          'GET /api/status': 'Inspect live playback state, title, timestamps, volume, speed, and theme',
          'POST /api/control': {
            description: 'Control VLCopyCAT from any AI assistant or local script',
            actions: [
              'play', 'pause', 'togglePlay', 'stop', 'next', 'prev',
              'seek (value in sec or delta in sec)',
              'volume (value 0..200)',
              'mute', 'speed (value 0.25..2)',
              'setAccent (orange|amber|lime|emerald|cyan|blue|purple|magenta|rose or #hex)',
              'toggleFullscreen', 'togglePip',
              'openFile (filePath)', 'openFolder (folderPath)'
            ]
          }
        },
        status: latestPlayerStatus
      });
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      return sendJson(200, latestPlayerStatus);
    }

    if (req.method === 'POST' && req.url === '/api/control') {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 1e6) req.destroy();
      });
      req.on('end', () => {
        try {
          const payload = raw ? JSON.parse(raw) : {};
          if (!payload.action) {
            return sendJson(400, { ok: false, error: 'Missing "action" field' });
          }

          if (payload.action === 'openFile' && payload.filePath) {
            if (!fs.existsSync(payload.filePath)) {
              return sendJson(404, { ok: false, error: `File not found: ${payload.filePath}` });
            }
            const item = buildMediaItem(payload.filePath);
            const folder = scanMediaFolder(item.folderPath);
            payload.resolved = { item, folder };
          } else if (payload.action === 'openFolder' && payload.folderPath) {
            if (!fs.existsSync(payload.folderPath)) {
              return sendJson(404, { ok: false, error: `Folder not found: ${payload.folderPath}` });
            }
            payload.resolvedFolder = scanMediaFolder(payload.folderPath);
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai:command', payload);
          }
          return sendJson(200, { ok: true, dispatched: payload.action });
        } catch (err) {
          return sendJson(400, { ok: false, error: err.message });
        }
      });
      return;
    }

    sendJson(404, { ok: false, error: 'Not found. Visit GET / for API documentation.' });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 4510) {
      startAiControlServer(port + 1);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    aiServerPort = port;
    broadcastWindowState();
  });
}

// IPC Handlers
ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  broadcastWindowState();
});
ipcMain.handle('win:toggleFullscreen', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  broadcastWindowState();
});
ipcMain.handle('win:toggleAlwaysOnTop', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next);
  broadcastWindowState();
  return next;
});
ipcMain.handle('win:close', () => mainWindow?.close());
ipcMain.handle('win:getState', () => ({
  maximized: mainWindow?.isMaximized() || false,
  fullscreen: mainWindow?.isFullScreen() || false,
  alwaysOnTop: mainWindow?.isAlwaysOnTop() || false,
  aiPort: aiServerPort
}));

ipcMain.handle('dialog:openFiles', async (_evt, multi = false) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: multi ? 'Open Multiple Media Files' : 'Open Media File',
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [
      {
        name: 'Media Files',
        extensions: Array.from(MEDIA_EXTENSIONS).map((e) => e.slice(1))
      },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const items = result.filePaths.map(buildMediaItem);
  const folder = scanMediaFolder(items[0].folderPath);
  return { items, folder };
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Media Directory',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return scanMediaFolder(result.filePaths[0]);
});

ipcMain.handle('dialog:openSubtitle', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Subtitle File (.srt, .vtt)',
    properties: ['openFile'],
    filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const subPath = result.filePaths[0];
  const content = fs.readFileSync(subPath, 'utf8');
  return { filePath: subPath, name: path.basename(subPath), content };
});

ipcMain.handle('fs:resolvePaths', (_evt, paths) => {
  const valid = (paths || []).filter((p) => p && fs.existsSync(p));
  if (!valid.length) return null;
  const stat0 = fs.statSync(valid[0]);
  if (stat0.isDirectory()) {
    const folder = scanMediaFolder(valid[0]);
    return { items: folder.items, folder };
  }
  const mediaPaths = valid.filter((p) => {
    try {
      return fs.statSync(p).isFile() && MEDIA_EXTENSIONS.has(path.extname(p).toLowerCase());
    } catch {
      return false;
    }
  });
  const subPaths = valid.filter((p) => SUB_EXTENSIONS.includes(path.extname(p).toLowerCase()));
  if (!mediaPaths.length && subPaths.length) {
    return {
      subtitleOnly: {
        filePath: subPaths[0],
        name: path.basename(subPaths[0]),
        content: fs.readFileSync(subPaths[0], 'utf8')
      }
    };
  }
  if (!mediaPaths.length) return null;
  const items = mediaPaths.map(buildMediaItem);
  const folder = scanMediaFolder(items[0].folderPath);
  return { items, folder };
});

ipcMain.handle('fs:scanFolder', (_evt, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) return null;
  return scanMediaFolder(folderPath);
});

ipcMain.handle('fs:readSubtitle', (_evt, subPath) => {
  try {
    if (!subPath || !fs.existsSync(subPath)) return null;
    return {
      filePath: subPath,
      name: path.basename(subPath),
      content: fs.readFileSync(subPath, 'utf8')
    };
  } catch {
    return null;
  }
});

ipcMain.handle('fs:getQuickFolders', () => {
  const desktop = app.getPath('desktop');
  const videos = app.getPath('videos');
  const downloads = app.getPath('downloads');
  const music = app.getPath('music');
  return [
    { label: 'Videos', path: videos },
    { label: 'Desktop', path: desktop },
    { label: 'Downloads', path: downloads },
    { label: 'Music', path: music }
  ];
});

ipcMain.handle('fs:saveSnapshot', (_evt, { dataUrl, baseName }) => {
  try {
    const picturesDir = path.join(app.getPath('pictures'), 'VLCopyCAT Snapshots');
    fs.mkdirSync(picturesDir, { recursive: true });
    const safe = (baseName || 'snapshot').replace(/[<>:"/\\|?*]+/g, '_');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(picturesDir, `${safe}_${stamp}.png`);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
    return { ok: true, outPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('shell:reveal', (_evt, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.on('player:statusUpdate', (_evt, status) => {
  latestPlayerStatus = { ...latestPlayerStatus, ...status };
});

app.whenReady().then(() => {
  startAiControlServer(4500);
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
