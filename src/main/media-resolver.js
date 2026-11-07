// src/main/media-resolver.js
// Media Detection, Header-Byte Sniffing, Codec Probing and File Indexing for VLCopyCat

const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { createLogger } = require('./logger');

const logger = createLogger('MediaResolver');

// Recognized media file extensions
const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.ogv',
  '.ts', '.m2ts', '.flv', '.wmv', '.mpg', '.mpeg', '.vob', '.3gp',
  '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
]);

// Dedicated audio formats
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'
]);

// Supported subtitle file formats
const SUB_EXTENSIONS = ['.srt', '.vtt'];

// Known ISO Base Media File Format box / atom types
const ISO_BMFF_ATOMS = new Set([
  'ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot', 'styp'
]);

/**
 * Locate FFmpeg & FFprobe binaries in package, local bin or system PATH
 * @param {string} toolName 'ffmpeg' or 'ffprobe'
 * @returns {string|null} Resolved executable path or null
 */
function resolveMediaTool(toolName) {
  const exe = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const candidates = [
    path.join(process.resourcesPath || '', 'bin', exe),
    path.join(__dirname, '..', '..', 'bin', exe),
    path.join(process.resourcesPath || '', exe)
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }

  try {
    const check = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [toolName], {
      encoding: 'utf8',
      windowsHide: true
    });
    if (check.status === 0 && check.stdout) {
      const first = check.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (first && fs.existsSync(first)) {
        return first;
      }
    }
  } catch (err) {
    logger.debug(`Error checking PATH for ${toolName}:`, err.message);
  }

  return null;
}

const FFMPEG_PATH = resolveMediaTool('ffmpeg');
const FFPROBE_PATH = resolveMediaTool('ffprobe');

function hasFfmpeg() {
  return Boolean(FFMPEG_PATH);
}

function hasFfprobe() {
  return Boolean(FFPROBE_PATH);
}

/**
 * Fast 0.05ms header byte sniffer to catch MPEG-TS disguised as .mp4 and non-Chromium containers
 * @param {string} filePath Absolute path to media file
 * @param {string} ext Lowercase extension (.mp4, .mkv, etc.)
 * @returns {boolean} True if FFmpeg transcoding/remux stream is required
 */
function detectNeedsStream(filePath, ext) {
  if (!FFMPEG_PATH) return false;
  if (AUDIO_EXTENSIONS.has(ext)) return false;

  // Formats known to require remuxing/transcoding for Chromium video tag
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
  } catch (err) {
    logger.debug(`detectNeedsStream error on "${filePath}":`, err.message);
    return false;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }

  return false;
}

/**
 * Deep media probe using ffprobe
 * Extracts video/audio codec, container duration, dimensions, and chapter marks
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
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

    proc.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });

    proc.on('error', (err) => {
      logger.warn(`ffprobe execution error for "${filePath}":`, err.message);
      resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
    });

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
      } catch (parseErr) {
        logger.warn(`ffprobe output JSON parse error:`, parseErr.message);
        resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
      }
    });
  });
}

/**
 * Natural alphabetical + numeric sorting comparison
 */
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Automatically locate matching subtitle file in directory
 * @param {string} mediaFilePath
 * @param {Array|null} directoryEntries
 * @returns {string|null}
 */
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
  } catch (err) {
    logger.debug(`findAutoSubtitle error:`, err.message);
    return null;
  }
}

/**
 * Generate privileged media:// custom protocol URL
 * @param {string} filePath
 * @returns {string}
 */
function toMediaUrl(filePath) {
  if (!filePath) return '';
  const resolved = path.resolve(filePath);
  const normalized = resolved.replace(/\\/g, '/');
  return `media:///${encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

/**
 * Construct fully resolved media item descriptor
 * @param {string} filePath
 * @param {Array|null} directoryEntries
 * @returns {Object}
 */
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

/**
 * Scan directory recursively for media items and subdirectories
 * @param {string} folderPath
 * @returns {Object}
 */
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
    logger.warn(`Failed to scan media folder "${folderPath}":`, err.message);
    return {
      folderPath,
      parentPath: null,
      folderName: path.basename(folderPath || ''),
      subfolders: [],
      items: [],
      error: err.message
    };
  }
}

/**
 * Extract media item and sibling folder from command line arguments
 * @param {Array} argv
 * @returns {Object|null}
 */
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

module.exports = {
  MEDIA_EXTENSIONS,
  AUDIO_EXTENSIONS,
  SUB_EXTENSIONS,
  ISO_BMFF_ATOMS,
  FFMPEG_PATH,
  FFPROBE_PATH,
  hasFfmpeg,
  hasFfprobe,
  resolveMediaTool,
  detectNeedsStream,
  probeMediaFile,
  naturalCompare,
  findAutoSubtitle,
  toMediaUrl,
  buildMediaItem,
  scanMediaFolder,
  resolveCliMediaFile
};
