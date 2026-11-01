const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, clipboard, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// High-Performance Hardware Acceleration & Zero-Copy Compositing
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-background-timer-throttling');

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
  try {
    fs.appendFileSync(path.join(__dirname, 'crash.log'), `[${new Date().toISOString()}] uncaughtException: ${err.stack || err.message}\n`);
  } catch {}
});
process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(__dirname, 'crash.log'), `[${new Date().toISOString()}] unhandledRejection: ${reason?.stack || reason}\n`);
  } catch {}
});
const http = require('http');
const { spawn, spawnSync, execFile } = require('child_process');
const { pathToFileURL } = require('url');

const PIP_HELPER_PATH = (() => {
  const packaged = path.join(process.resourcesPath || '', 'bin', 'pip-helper.exe');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, 'bin', 'pip-helper.exe');
})();

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
let isInPipMode = false;
let wasFullscreenBeforePip = false;
let restoringFromPipLeave = false;

let latestPlayerStatus = {
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

// Locate FFmpeg & FFprobe for VLC-grade universal container/codec support
function resolveMediaTool(toolName) {
  const exe = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const candidates = [
    path.join(process.resourcesPath || '', 'bin', exe),
    path.join(__dirname, 'bin', exe),
    path.join(process.resourcesPath || '', exe),
    path.join('C:\\YTDownload', exe)
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
      return resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
    }
    const args = [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration',
      '-show_entries', 'stream=index,codec_type,codec_name,width,height',
      '-show_chapters',
      '-of', 'json',
      filePath
    ];
    const proc = spawn(FFPROBE_PATH, args, { windowsHide: true });
    let out = '';
    proc.stdout.on('data', (chunk) => { out += chunk.toString(); });
    proc.on('error', () => resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] }));
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(out || '{}');
        const streams = parsed.streams || [];
        const vStream = streams.find((s) => s.codec_type === 'video');
        const aStream = streams.find((s) => s.codec_type === 'audio');
        const duration = Number(parsed.format?.duration) || 0;
        const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
        const chapters = rawChapters.map((c, idx) => ({
          index: idx,
          start: Math.max(0, Number(c.start_time) || (Number(c.start) / 1000) || 0),
          end: Math.max(0, Number(c.end_time) || (Number(c.end) / 1000) || 0),
          title: (c.tags && (c.tags.title || c.tags.TITLE || c.tags.Title)) || ''
        })).filter((c) => c.end > c.start);

        resolve({
          ok: true,
          formatName: parsed.format?.format_name || '',
          duration,
          videoCodec: vStream?.codec_name || null,
          audioCodec: aStream?.codec_name || null,
          width: vStream?.width || 0,
          height: vStream?.height || 0,
          chapters
        });
      } catch {
        resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
      }
    });
  });
}

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function findAutoSubtitle(mediaFilePath, directoryEntries = null) {
  try {
    const dir = path.dirname(mediaFilePath);
    const base = path.basename(mediaFilePath, path.extname(mediaFilePath));
    for (const ext of SUB_EXTENSIONS) {
      const candidate = path.join(dir, base + ext);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const entries = Array.isArray(directoryEntries) ? directoryEntries : fs.readdirSync(dir);
    const baseLower = base.toLowerCase() + '.';
    const match = entries.find((f) => {
      const name = typeof f === 'string' ? f : f?.name;
      if (!name) return false;
      const lower = name.toLowerCase();
      return (
        lower.startsWith(baseLower) &&
        SUB_EXTENSIONS.some((ext) => lower.endsWith(ext))
      );
    });
    if (match) {
      const matchName = typeof match === 'string' ? match : match.name;
      return path.join(dir, matchName);
    }
    return null;
  } catch {
    return null;
  }
}

function toMediaUrl(filePath) {
  if (!filePath) return '';
  const resolved = path.resolve(filePath);
  const normalized = resolved.replace(/\\/g, '/');
  return `media:///${encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

function buildMediaItem(filePath, directoryEntries = null) {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();
  const isAudio = AUDIO_EXTENSIONS.has(ext);
  const folderPath = path.dirname(resolved);
  const autoSubPath = findAutoSubtitle(resolved, directoryEntries);
  const needsStream = detectNeedsStream(resolved, ext);
  return {
    filePath: resolved,
    fileUrl: toMediaUrl(resolved),
    rawFileUrl: pathToFileURL(resolved).href,
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
      .map((name) => buildMediaItem(path.join(resolvedDir, name), entries));
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

let userAlwaysOnTop = false;

function applyAlwaysOnTop(flag) {
  userAlwaysOnTop = Boolean(flag);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setAlwaysOnTop(userAlwaysOnTop, 'screen-saver');
    } catch {
      mainWindow.setAlwaysOnTop(userAlwaysOnTop);
    }
  }
  broadcastWindowState();
  return userAlwaysOnTop;
}

function broadcastWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('win:state', {
    maximized: mainWindow.isMaximized(),
    fullscreen: mainWindow.isFullScreen(),
    alwaysOnTop: userAlwaysOnTop,
    aiPort: aiServerPort,
    hasFfmpeg: Boolean(FFMPEG_PATH)
  });
}

function getMainHwndString() {
  if (!mainWindow || mainWindow.isDestroyed()) return '0';
  try {
    const buf = mainWindow.getNativeWindowHandle();
    if (buf.length >= 8) return buf.readBigUInt64LE(0).toString();
    if (buf.length >= 4) return String(buf.readUInt32LE(0));
  } catch {}
  return '0';
}

let lastPipBounds = null;

function resizePipWindow(aspect = 16 / 9) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !fs.existsSync(PIP_HELPER_PATH)) {
      resolve(false);
      return;
    }
    const args = [
      String(process.pid),
      getMainHwndString(),
      Number(aspect || 1.7778).toFixed(4),
      '0.28'
    ];
    execFile(PIP_HELPER_PATH, args, { windowsHide: true, timeout: 1500 }, (err, stdout) => {
      const out = String(stdout || '').trim();
      if (!err && out.startsWith('OK ')) {
        lastPipBounds = out.slice(3);
        resolve(true);
      } else {
        lastPipBounds = out || (err ? err.message : 'ERR');
        resolve(false);
      }
    });
  });
}

function restoreMainWindowWin32() {
  if (process.platform !== 'win32' || !fs.existsSync(PIP_HELPER_PATH)) return;
  const hwnd = getMainHwndString();
  if (hwnd && hwnd !== '0') {
    execFile(PIP_HELPER_PATH, ['--restore', hwnd], { windowsHide: true, timeout: 1000 }, () => {});
  }
}

let pendingInitialMedia = null;

function bringToFront(win = mainWindow) {
  if (!win || win.isDestroyed()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (!userAlwaysOnTop) {
      try {
        win.setAlwaysOnTop(true, 'screen-saver');
      } catch {
        win.setAlwaysOnTop(true);
      }
      setTimeout(() => {
        if (win && !win.isDestroyed() && !userAlwaysOnTop) {
          win.setAlwaysOnTop(false);
        }
      }, 250);
    }
  } catch {}
}

let currentThumbarPlaying = null;

function updateThumbarButtons(isPlaying = false) {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return;
  const normalizedPlaying = Boolean(isPlaying);
  if (currentThumbarPlaying === normalizedPlaying) return;
  currentThumbarPlaying = normalizedPlaying;

  const prevIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'thumbar-prev.png'));
  const playIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', normalizedPlaying ? 'thumbar-pause.png' : 'thumbar-play.png'));
  const nextIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'thumbar-next.png'));

  try {
    mainWindow.setThumbarButtons([
      {
        tooltip: 'Previous Track',
        icon: prevIcon,
        click() {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai:command', { action: 'prev' });
          }
        }
      },
      {
        tooltip: normalizedPlaying ? 'Pause' : 'Play',
        icon: playIcon,
        click() {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai:command', { action: 'togglePlay' });
          }
        }
      },
      {
        tooltip: 'Next Track',
        icon: nextIcon,
        click() {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ai:command', { action: 'next' });
          }
        }
      }
    ]);
  } catch {}
}

function resolveCliMediaFile(argv) {
  if (!Array.isArray(argv)) return null;
  const match = argv.slice(1).find((arg) => {
    if (!arg || typeof arg !== 'string') return false;
    const clean = arg.replace(/^"|"$/g, '').trim();
    if (!clean || clean.startsWith('-') || clean === '.') return false;
    const ext = path.extname(clean).toLowerCase();
    return MEDIA_EXTENSIONS.has(ext) && fs.existsSync(clean);
  });
  if (match) {
    const clean = match.replace(/^"|"$/g, '').trim();
    const item = buildMediaItem(clean);
    const sibling = scanMediaFolder(item.folderPath);
    return { item, folder: sibling };
  }
  return null;
}

function createMainWindow() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const iconPng = path.join(__dirname, 'assets', 'icon.png');
  const windowIcon = fs.existsSync(icoPath) ? icoPath : (fs.existsSync(iconPng) ? iconPng : undefined);
  mainWindow = new BrowserWindow({
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
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const forceShowTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      bringToFront(mainWindow);
      broadcastWindowState();
    }
  }, 1200);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(forceShowTimer);
    bringToFront(mainWindow);
    broadcastWindowState();
    updateThumbarButtons(false);
    if (pendingInitialMedia) {
      mainWindow.webContents.send('media:initial', pendingInitialMedia);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingInitialMedia) {
      mainWindow.webContents.send('media:initial', pendingInitialMedia);
    }
  });

  mainWindow.on('maximize', broadcastWindowState);
  mainWindow.on('unmaximize', broadcastWindowState);
  mainWindow.on('enter-full-screen', broadcastWindowState);
  mainWindow.on('leave-full-screen', broadcastWindowState);
  mainWindow.on('minimize', broadcastWindowState);
  mainWindow.on('restore', () => {
    broadcastWindowState();
    if (isInPipMode && !restoringFromPipLeave && !mainWindow.isDestroyed()) {
      isInPipMode = false;
      mainWindow.webContents.send('pip:exitRequested');
      if (wasFullscreenBeforePip) {
        wasFullscreenBeforePip = false;
        mainWindow.setFullScreen(true);
      }
    }
  });
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
      '-tune', 'zerolatency',
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
    '-avoid_negative_ts', 'make_zero',
    '-threads', '0',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  );

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  try {
    req.socket?.setNoDelay?.(true);
    res.socket?.setNoDelay?.(true);
  } catch {}

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

// In-Memory LRU Thumbnail Cache for 0ms Timeline Scrubbing Previews
const thumbCache = new Map();
const MAX_THUMB_CACHE = 120;

function handleFfmpegThumbRequest(urlObj, req, res) {
  const filePath = urlObj.searchParams.get('path') || '';
  const timeSec = Math.max(0, Number(urlObj.searchParams.get('t')) || 0);

  if (!FFMPEG_PATH || !filePath || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }

  const cacheKey = `${filePath}:${timeSec.toFixed(1)}`;
  if (thumbCache.has(cacheKey)) {
    const cachedBuf = thumbCache.get(cacheKey);
    // Touch entry for LRU freshness
    thumbCache.delete(cacheKey);
    thumbCache.set(cacheKey, cachedBuf);

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=180',
      'Content-Length': cachedBuf.length
    });
    res.end(cachedBuf);
    return;
  }

  killActiveThumbProc();

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', timeSec.toFixed(2),
    '-i', filePath,
    '-an',
    '-sn',
    '-dn',
    '-frames:v', '1',
    '-vf', 'scale=320:-2',
    '-q:v', '5',
    '-threads', '2',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    'pipe:1'
  ];

  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'max-age=180'
  });

  const proc = spawn(FFMPEG_PATH, args, { windowsHide: true });
  activeThumbProc = proc;

  const chunks = [];
  proc.stdout.on('data', (c) => chunks.push(c));
  proc.stdout.pipe(res);

  const cleanup = () => {
    if (activeThumbProc === proc) activeThumbProc = null;
    try { proc.kill('SIGKILL'); } catch {}
  };

  req.on('close', cleanup);
  proc.on('close', () => {
    if (activeThumbProc === proc) activeThumbProc = null;
    if (chunks.length > 0) {
      const fullBuf = Buffer.concat(chunks);
      if (fullBuf.length > 80) {
        if (thumbCache.size >= MAX_THUMB_CACHE) {
          const oldestKey = thumbCache.keys().next().value;
          thumbCache.delete(oldestKey);
        }
        thumbCache.set(cacheKey, fullBuf);
      }
    }
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
        name: 'CopyCat media player Local AI Control Bridge',
        version: '1.2.0',
        port: aiServerPort,
        ffmpegEnabled: Boolean(FFMPEG_PATH),
        endpoints: {
          'GET /api/status': 'Inspect live playback state, title, timestamps, volume, speed, and theme',
          'GET /api/stream': 'Zero-disk FFmpeg fragmented MP4 live stream for MPEG-TS, MKV, AVI, AC3, HEVC, etc.',
          'POST /api/control': {
            description: 'Control CopyCat media player from any AI assistant or local script',
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
      return sendJson(200, {
        ...latestPlayerStatus,
        minimized: mainWindow?.isMinimized() || false,
        pipActive: isInPipMode,
        pipBounds: isInPipMode ? lastPipBounds : null
      });
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
          } else if (payload.action === 'enqueue') {
            const rawList = Array.isArray(payload.filePaths)
              ? payload.filePaths
              : payload.filePath
                ? [payload.filePath]
                : [];
            const validItems = rawList
              .filter((p) => p && fs.existsSync(p) && MEDIA_EXTENSIONS.has(path.extname(p).toLowerCase()))
              .map(buildMediaItem);
            if (!validItems.length) {
              return sendJson(404, { ok: false, error: 'No valid media files to enqueue' });
            }
            payload.resolvedItems = validItems;
          } else if (payload.action === 'openFolder' && payload.folderPath) {
            if (!fs.existsSync(payload.folderPath)) {
              return sendJson(404, { ok: false, error: `Folder not found: ${payload.folderPath}` });
            }
            payload.resolvedFolder = scanMediaFolder(payload.folderPath);
          }

          if (payload.action === 'quit' || payload.action === 'close') {
            sendJson(200, { ok: true, dispatched: payload.action });
            setTimeout(() => {
              try {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
                else app.quit();
              } catch {
                app.quit();
              }
            }, 100);
            return;
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            if (payload.action === 'bringToFront' || payload.action === 'show' || payload.action === 'focus') {
              bringToFront(mainWindow);
              return sendJson(200, { ok: true, dispatched: payload.action });
            }
            if (payload.action === 'togglePip') {
              mainWindow.webContents.executeJavaScript('document.getElementById("btn-pip")?.click()', true).catch(() => {});
            } else {
              if (mainWindow.webContents.isLoading()) {
                mainWindow.webContents.once('did-finish-load', () => {
                  setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send('ai:command', payload);
                    }
                  }, 250);
                });
              } else {
                mainWindow.webContents.send('ai:command', payload);
              }
            }
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
ipcMain.handle('win:minimize', () => {
  if (!mainWindow) return;
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  mainWindow.minimize();
  broadcastWindowState();
});
ipcMain.handle('win:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  } else if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  broadcastWindowState();
});
ipcMain.handle('win:toggleFullscreen', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  broadcastWindowState();
});
ipcMain.handle('win:exitFullscreenToDrag', (_evt, data = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const { screenX, screenY, ratioX } = data;
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
  let width = 1180;
  let height = 700;
  try {
    const normal = mainWindow.getNormalBounds();
    if (normal && normal.width && normal.height) {
      width = normal.width;
      height = normal.height;
    }
  } catch {
    const bounds = mainWindow.getBounds();
    width = bounds.width || 1180;
    height = bounds.height || 700;
  }
  const rX = typeof ratioX === 'number' && ratioX >= 0 && ratioX <= 1 ? ratioX : 0.5;
  const targetX = Math.round(screenX - width * rX);
  const targetY = Math.round(screenY - 20);
  mainWindow.setBounds({
    x: targetX,
    y: targetY,
    width,
    height
  });
  broadcastWindowState();
  return { x: targetX, y: targetY, width, height };
});
function applyDragMove(coords = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { x, y } = coords;
  if (typeof x === 'number' && typeof y === 'number') {
    mainWindow.setPosition(Math.round(x), Math.round(y));
  }
}
ipcMain.on('win:dragMove', (_evt, coords) => applyDragMove(coords));
ipcMain.handle('win:dragMove', (_evt, coords) => applyDragMove(coords));
ipcMain.handle('win:toggleAlwaysOnTop', () => {
  return applyAlwaysOnTop(!userAlwaysOnTop);
});
ipcMain.handle('win:setAlwaysOnTop', (_evt, flag) => {
  return applyAlwaysOnTop(flag);
});
ipcMain.handle('win:enterPip', async (_evt, opts = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  isInPipMode = true;
  const aspect = Number(opts?.aspect) > 0.1 ? Number(opts.aspect) : 16 / 9;

  if (mainWindow.isFullScreen()) {
    wasFullscreenBeforePip = true;
    mainWindow.setFullScreen(false);
  } else {
    wasFullscreenBeforePip = false;
  }

  if (!mainWindow.isMinimized()) {
    mainWindow.minimize();
  }

  await resizePipWindow(aspect);

  setTimeout(() => {
    if (isInPipMode) resizePipWindow(aspect);
  }, 120);

  broadcastWindowState();
  return true;
});

ipcMain.handle('win:leavePip', (_evt, opts = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const wasActive = isInPipMode;
  isInPipMode = false;
  lastPipBounds = null;
  const shouldRestore = opts?.restore !== false;
  if (wasActive && shouldRestore) {
    restoringFromPipLeave = true;
    try {
      restoreMainWindowWin32();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (wasFullscreenBeforePip) {
        wasFullscreenBeforePip = false;
        mainWindow.setFullScreen(true);
      }
    } finally {
      setTimeout(() => {
        restoringFromPipLeave = false;
        broadcastWindowState();
      }, 220);
    }
  } else {
    wasFullscreenBeforePip = false;
  }
  broadcastWindowState();
  return true;
});

ipcMain.handle('win:close', () => mainWindow?.close());
ipcMain.handle('win:setOpacity', (_e, opacity) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const val = Math.max(0.2, Math.min(1.0, Number(opacity) || 1.0));
    mainWindow.setOpacity(val);
    return val;
  }
  return 1.0;
});
ipcMain.handle('clipboard:writeImage', (_e, dataUrl) => {
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
    return true;
  } catch (err) {
    return false;
  }
});
ipcMain.handle('win:getState', () => ({
  maximized: mainWindow?.isMaximized() || false,
  fullscreen: mainWindow?.isFullScreen() || false,
  alwaysOnTop: userAlwaysOnTop,
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

  const collectedMediaItems = [];
  let primaryFolder = null;

  for (const p of valid) {
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        const scanned = scanMediaFolder(p);
        if (!primaryFolder) primaryFolder = scanned;
        if (scanned.items?.length) {
          collectedMediaItems.push(...scanned.items);
        }
      } else if (st.isFile() && MEDIA_EXTENSIONS.has(path.extname(p).toLowerCase())) {
        collectedMediaItems.push(buildMediaItem(p));
      }
    } catch {}
  }

  const subPaths = valid.filter((p) => SUB_EXTENSIONS.includes(path.extname(p).toLowerCase()));
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
    primaryFolder = scanMediaFolder(collectedMediaItems[0].folderPath);
  }
  return { items: collectedMediaItems, folder: primaryFolder };
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
    const picturesDir = path.join(app.getPath('pictures'), 'CopyCat media player Snapshots');
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

function getDesktopShortcutPath() {
  const desktopPath = app.getPath('desktop');
  return path.join(desktopPath, 'CopyCat media player.lnk');
}

function hasDesktopShortcut() {
  try {
    return fs.existsSync(getDesktopShortcutPath());
  } catch {
    return false;
  }
}

function createDesktopShortcut() {
  try {
    const shortcutPath = getDesktopShortcutPath();
    const icoPath = path.join(__dirname, 'assets', 'icon.ico');
    const exeLauncher = path.join(__dirname, 'Launch_CopyCat.exe');
    const isPackaged = app.isPackaged;
    const targetPath = isPackaged 
      ? process.execPath 
      : (fs.existsSync(exeLauncher) ? exeLauncher : path.join(__dirname, 'Launch_CopyCat.bat'));
    const workingDir = isPackaged ? path.dirname(process.execPath) : __dirname;
    const iconLocation = fs.existsSync(icoPath) ? `${icoPath},0` : `${targetPath},0`;

    const psScript = `
      $ws = New-Object -ComObject WScript.Shell;
      $s = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');
      $s.TargetPath = '${targetPath.replace(/'/g, "''")}';
      $s.WorkingDirectory = '${workingDir.replace(/'/g, "''")}';
      $s.IconLocation = '${iconLocation.replace(/'/g, "''")}';
      $s.Description = 'CopyCat media player';
      $s.Save();
    `;
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      windowsHide: true
    });
    const created = fs.existsSync(shortcutPath);
    return { success: created, ok: created, shortcutPath };
  } catch (err) {
    return { success: false, ok: false, error: err.message };
  }
}

ipcMain.handle('shortcut:hasDesktop', () => hasDesktopShortcut());
ipcMain.handle('shortcut:createDesktop', () => createDesktopShortcut());

ipcMain.handle('media:getInitial', () => {
  const payload = pendingInitialMedia;
  pendingInitialMedia = null;
  return payload;
});

function getAssociationsScriptPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'bin', 'register_associations.ps1'),
    path.join(__dirname, 'bin', 'register_associations.ps1'),
    path.join(__dirname, '..', 'bin', 'register_associations.ps1')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function runAssociationsRegistration(targetExe = process.execPath) {
  return new Promise((resolve) => {
    try {
      const regScript = getAssociationsScriptPath();
      if (!regScript) {
        return resolve({ ok: false, error: 'register_associations.ps1 script not found' });
      }
      const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', regScript];
      if (targetExe && typeof targetExe === 'string' && fs.existsSync(targetExe)) {
        args.push('-TargetExe', targetExe);
      }
      const child = spawn('powershell.exe', args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        resolve({ ok: code === 0, error: stderr });
      });
      child.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

ipcMain.handle('app:setDefaultPlayer', () => {
  return runAssociationsRegistration(process.execPath);
});

ipcMain.handle('app:openDefaultAppsSettings', () => {
  try {
    shell.openExternal('ms-settings:defaultapps');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('shell:reveal', (_evt, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.handle('shell:openExternal', (_evt, targetUrl) => {
  if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
    shell.openExternal(targetUrl);
    return true;
  }
  return false;
});

ipcMain.on('player:statusUpdate', (_evt, status) => {
  latestPlayerStatus = { ...latestPlayerStatus, ...status };
  if (typeof status?.playing === 'boolean') {
    updateThumbarButtons(status.playing);
  }
});

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
} else {
  pendingInitialMedia = resolveCliMediaFile(process.argv);

  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      bringToFront(mainWindow);
      const payload = resolveCliMediaFile(commandLine);
      if (payload) {
        pendingInitialMedia = payload;
        mainWindow.webContents.send('media:initial', payload);
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
        return new Response('Media file not found', { status: 404 });
      }
    });

    startAiControlServer(4500);
    createMainWindow();
    setTimeout(() => {
      runAssociationsRegistration(process.execPath);
    }, 1500);
  });
}

app.on('before-quit', () => {
  killActiveStreamProc();
  killActiveThumbProc();
});

app.on('window-all-closed', () => {
  killActiveStreamProc();
  killActiveThumbProc();
  if (process.platform !== 'darwin') app.quit();
});
