const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.ogv',
  '.ts', '.m2ts', '.flv', '.wmv', '.mpg', '.mpeg', '.vob', '.3gp',
  '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
]);

const SUB_EXTENSIONS = ['.srt', '.vtt'];

const ISO_BMFF_ATOMS = new Set([
  'ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot', 'styp'
]);

let mainWindow = null;
let aiServerPort = 4500;
let activeStreamProc = null;
let activeThumbProc = null;

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
  queueLength: 0,
  streamEngine: 'native'
};

// Locate FFmpeg & FFprobe for VLC-grade universal container/codec support
function resolveMediaTool(toolName) {
  const exe = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const candidates = [
    path.join('C:\\YTDownload', exe),
    path.join(__dirname, 'bin', exe),
    path.join(process.resourcesPath || '', 'bin', exe)
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  try {
    const check = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [toolName], {
      encoding: 'utf8',
      windowsHide: true
    });
    if (check.status === 0 && check.stdout) {
      const first = check.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    }
  } catch {}
  return null;
}

const FFMPEG_PATH = resolveMediaTool('ffmpeg');
const FFPROBE_PATH = resolveMediaTool('ffprobe');

function killActiveStreamProc() {
  if (activeStreamProc) {
    try {
      activeStreamProc.kill('SIGKILL');
    } catch {}
    activeStreamProc = null;
  }
}

function killActiveThumbProc() {
  if (activeThumbProc) {
    try {
      activeThumbProc.kill('SIGKILL');
    } catch {}
    activeThumbProc = null;
  }
}

// Fast 0.05ms header byte sniffer to catch MPEG-TS disguised as .mp4 and non-Chromium containers
function detectNeedsStream(filePath, ext) {
  if (!FFMPEG_PATH) return false;
  if (AUDIO_EXTENSIONS.has(ext)) return false;

  if (['.ts', '.m2ts', '.avi', '.flv', '.wmv', '.mpg', '.mpeg', '.vob'].includes(ext)) {
    return true;
  }

  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(196);
    const bytesRead = fs.readSync(fd, buf, 0, 196, 0);
    if (bytesRead < 12) return false;

    // MPEG-TS sync byte 0x47 at offset 0 and offset 188 (common in HLS downloads saved as .mp4)
    if (buf[0] === 0x47 && (bytesRead < 189 || buf[188] === 0x47)) {
      return true;
    }

    // AVI ('RIFF'), FLV ('FLV')
    const head3 = buf.subarray(0, 3).toString('ascii');
    const head4 = buf.subarray(0, 4).toString('ascii');
    if (head4 === 'RIFF' || head3 === 'FLV') {
      return true;
    }

    // Verify ISO Base Media File Format atom for .mp4 / .m4v / .mov
    if (['.mp4', '.m4v', '.mov', '.3gp'].includes(ext)) {
      const atom = buf.subarray(4, 8).toString('ascii');
      if (!ISO_BMFF_ATOMS.has(atom)) {
        return true;
      }
    }
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
  return false;
}

function probeMediaFile(filePath) {
  return new Promise((resolve) => {
    if (!FFPROBE_PATH || !filePath || !fs.existsSync(filePath)) {
      return resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null });
    }
    const args = [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration',
      '-show_entries', 'stream=index,codec_type,codec_name,width,height',
      '-of', 'json',
      filePath
    ];
    const proc = spawn(FFPROBE_PATH, args, { windowsHide: true });
    let out = '';
    proc.stdout.on('data', (chunk) => { out += chunk.toString(); });
    proc.on('error', () => resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null }));
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(out || '{}');
        const streams = parsed.streams || [];
        const vStream = streams.find((s) => s.codec_type === 'video');
        const aStream = streams.find((s) => s.codec_type === 'audio');
        const duration = Number(parsed.format?.duration) || 0;
        resolve({
          ok: true,
          formatName: parsed.format?.format_name || '',
          duration,
          videoCodec: vStream?.codec_name || null,
          audioCodec: aStream?.codec_name || null,
          width: vStream?.width || 0,
          height: vStream?.height || 0
        });
      } catch {
        resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null });
      }
    });
  });
}

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
  const isAudio = AUDIO_EXTENSIONS.has(ext);
  const folderPath = path.dirname(resolved);
  const autoSubPath = findAutoSubtitle(resolved);
  const needsStream = detectNeedsStream(resolved, ext);
  return {
    filePath: resolved,
    fileUrl: pathToFileURL(resolved).href,
    name: path.basename(resolved),
    title: path.basename(resolved, path.extname(resolved)),
    ext,
    isAudio,
    needsStream,
    folderPath,
    folderName: path.basename(folderPath) || folderPath,
    autoSubPath
  };
}

function scanMediaFolder(folderPath) {
  try {
    const resolvedDir = path.resolve(folderPath);
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const subfolders = entries
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('$'))
      .map((d) => d.name)
      .sort(naturalCompare)
      .map((name) => ({
        name,
        folderPath: path.join(resolvedDir, name)
      }));
    const files = entries
      .filter((d) => d.isFile() && MEDIA_EXTENSIONS.has(path.extname(d.name).toLowerCase()))
      .map((d) => d.name)
      .sort(naturalCompare)
      .map((name) => buildMediaItem(path.join(resolvedDir, name)));
    const parentDir = path.dirname(resolvedDir);
    return {
      folderPath: resolvedDir,
      parentPath: parentDir !== resolvedDir ? parentDir : null,
      folderName: path.basename(resolvedDir) || resolvedDir,
      subfolders,
      items: files
    };
  } catch (err) {
    return { folderPath, parentPath: null, folderName: path.basename(folderPath || ''), subfolders: [], items: [], error: err.message };
  }
}

function broadcastWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('win:state', {
    maximized: mainWindow.isMaximized(),
    fullscreen: mainWindow.isFullScreen(),
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
    aiPort: aiServerPort,
    hasFfmpeg: Boolean(FFMPEG_PATH)
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

function handleFfmpegStreamRequest(urlObj, req, res) {
  const filePath = urlObj.searchParams.get('path') || '';
  const startSec = Math.max(0, Number(urlObj.searchParams.get('start')) || 0);
  const vcodec = (urlObj.searchParams.get('vcodec') || '').toLowerCase();
  const forceTranscodeVideo = urlObj.searchParams.get('transcode') === '1';

  if (!FFMPEG_PATH || !filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Media file or FFmpeg binary not found');
    return;
  }

  killActiveStreamProc();

  const canCopyVideo = !forceTranscodeVideo && vcodec === 'h264';
  const args = ['-hide_banner', '-loglevel', 'error'];

  if (startSec > 0.05) {
    args.push('-ss', startSec.toFixed(3));
  }

  args.push('-i', filePath);
  args.push('-map', '0:v:0?', '-map', '0:a:0?');

  if (canCopyVideo) {
    args.push('-c:v', 'copy');
  } else {
    args.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p'
    );
  }

  args.push(
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
    '-sn',
    '-dn',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  );

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });

  const proc = spawn(FFMPEG_PATH, args, { windowsHide: true });
  activeStreamProc = proc;

  proc.stdout.pipe(res);

  const cleanup = () => {
    if (activeStreamProc === proc) activeStreamProc = null;
    try { proc.kill('SIGKILL'); } catch {}
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  proc.on('error', cleanup);
}

function handleFfmpegThumbRequest(urlObj, req, res) {
  const filePath = urlObj.searchParams.get('path') || '';
  const timeSec = Math.max(0, Number(urlObj.searchParams.get('t')) || 0);

  if (!FFMPEG_PATH || !filePath || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }

  killActiveThumbProc();

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', timeSec.toFixed(2),
    '-i', filePath,
    '-frames:v', '1',
    '-vf', 'scale=320:-2',
    '-q:v', '5',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    'pipe:1'
  ];

  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'max-age=30'
  });

  const proc = spawn(FFMPEG_PATH, args, { windowsHide: true });
  activeThumbProc = proc;
  proc.stdout.pipe(res);

  const cleanup = () => {
    if (activeThumbProc === proc) activeThumbProc = null;
    try { proc.kill('SIGKILL'); } catch {}
  };

  req.on('close', cleanup);
  proc.on('close', () => {
    if (activeThumbProc === proc) activeThumbProc = null;
  });
  proc.on('error', cleanup);
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

    const urlObj = new URL(req.url || '/', `http://127.0.0.1:${aiServerPort}`);
    const pathname = urlObj.pathname;

    const sendJson = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj, null, 2));
    };

    // Universal FFmpeg Live Stream & Thumbnail Endpoints
    if (req.method === 'GET' && pathname === '/api/stream') {
      return handleFfmpegStreamRequest(urlObj, req, res);
    }
    if (req.method === 'GET' && pathname === '/api/thumb') {
      return handleFfmpegThumbRequest(urlObj, req, res);
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/api')) {
      return sendJson(200, {
        name: 'VLCopyCAT Local AI Control Bridge',
        version: '1.1.0',
        port: aiServerPort,
        ffmpegEnabled: Boolean(FFMPEG_PATH),
        endpoints: {
          'GET /api/status': 'Inspect live playback state, title, timestamps, volume, speed, and theme',
          'GET /api/stream': 'Zero-disk FFmpeg fragmented MP4 live stream for MPEG-TS, MKV, AVI, AC3, HEVC, etc.',
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

    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(200, latestPlayerStatus);
    }

    if (req.method === 'POST' && pathname === '/api/control') {
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
  aiPort: aiServerPort,
  hasFfmpeg: Boolean(FFMPEG_PATH)
}));

ipcMain.handle('media:probe', (_evt, filePath) => probeMediaFile(filePath));
ipcMain.handle('media:stopStream', () => {
  killActiveStreamProc();
  killActiveThumbProc();
});

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
  const videos = app.getPath('videos');
  const desktop = app.getPath('desktop');
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

app.on('before-quit', () => {
  killActiveStreamProc();
  killActiveThumbProc();
});

app.on('window-all-closed', () => {
  killActiveStreamProc();
  killActiveThumbProc();
  if (process.platform !== 'darwin') app.quit();
});
