// src/main/media-resolver.js
// Media Detection, Header-Byte Sniffing, Codec Probing and File Indexing for VLCopyCat

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
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

const toolCache = new Map();

/**
 * Locate FFmpeg & FFprobe binaries in package, local bin or system PATH
 * Uses in-memory PATH scanning to completely eliminate synchronous child-process stalls.
 * @param {string} toolName 'ffmpeg' or 'ffprobe'
 * @returns {string|null} Resolved executable path or null
 */
function resolveMediaTool(toolName) {
  if (toolCache.has(toolName)) {
    return toolCache.get(toolName);
  }

  const exe = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const candidates = [
    path.join(process.resourcesPath || '', 'bin', exe),
    path.join(__dirname, '..', '..', 'bin', exe),
    path.join(process.resourcesPath || '', exe)
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      toolCache.set(toolName, c);
      return c;
    }
  }

  // Fast in-memory PATH lookup without spawning child processes (avoids startup event-loop stalls)
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    if (!dir) continue;
    try {
      const candidatePath = path.join(dir, exe);
      if (fs.existsSync(candidatePath)) {
        toolCache.set(toolName, candidatePath);
        return candidatePath;
      }
    } catch (_) {}
  }

  toolCache.set(toolName, null);
  return null;
}

/**
 * Parse an HTTP Range header (RFC 7233) against total file size
 * @param {string|null} rangeHeader
 * @param {number} totalSize
 * @returns {{ isRange: boolean, start: number, end: number, chunkSize: number, total: number }}
 */
function parseByteRange(rangeHeader, totalSize) {
  const total = Math.max(0, totalSize || 0);
  let start = 0;
  let end = Math.max(0, total - 1);
  let isRange = false;

  if (rangeHeader && typeof rangeHeader === 'string') {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      isRange = true;
      const s = match[1] ? parseInt(match[1], 10) : NaN;
      const e = match[2] ? parseInt(match[2], 10) : NaN;
      if (!Number.isNaN(s) && !Number.isNaN(e)) {
        start = Math.max(0, Math.min(s, total - 1));
        end = Math.max(start, Math.min(e, total - 1));
      } else if (!Number.isNaN(s)) {
        start = Math.max(0, Math.min(s, total - 1));
        end = Math.max(start, total - 1);
      } else if (!Number.isNaN(e)) {
        start = Math.max(0, total - e);
        end = Math.max(start, total - 1);
      }
    }
  }

  const chunkSize = total === 0 ? 0 : Math.max(0, end - start + 1);
  return { isRange, start, end, chunkSize, total };
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
 * Asynchronously checks if media file requires FFmpeg live remux / transcoding
 * @param {string} filePath Absolute path to media file
 * @param {string} ext Lowercase extension (.mp4, .mkv, etc.)
 * @returns {Promise<boolean>} True if FFmpeg transcoding/remux stream is required
 */
async function detectNeedsStreamAsync(filePath, ext) {
  if (!FFMPEG_PATH) return false;
  if (AUDIO_EXTENSIONS.has(ext)) return false;

  if (['.ts', '.m2ts', '.avi', '.flv', '.wmv', '.mpg', '.mpeg', '.vob'].includes(ext)) {
    return true;
  }

  let fh = null;
  try {
    fh = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(196);
    const { bytesRead } = await fh.read(buf, 0, 196, 0);
    if (bytesRead < 8) return false;

    if (buf[0] === 0x47 && (buf[188] === 0x47 || buf[192] === 0x47)) {
      logger.info(`Detected MPEG-TS stream disguised as "${path.extname(filePath)}" via byte sniffer`);
      return true;
    }

    const boxType = buf.toString('ascii', 4, 8);
    if (ISO_BMFF_ATOMS.has(boxType)) {
      return false;
    }
    return true;
  } catch (err) {
    logger.debug(`detectNeedsStreamAsync error on "${filePath}":`, err.message);
    return false;
  } finally {
    if (fh) {
      try { await fh.close(); } catch {}
    }
  }
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
 * Heuristic subtitle language detector from WebVTT/SRT text samples
 * Supports Asian/Middle Eastern scripts and common Latin-script languages
 */
function detectSubtitleLanguage(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text
    .replace(/^WEBVTT[^\r\n]*\r?\n+/i, '')
    .replace(/\d\d:\d\d(?::\d\d)?(?:\.\d+)?\s*-->\s*\d\d:\d\d(?::\d\d)?(?:\.\d+)?/g, '')
    .replace(/<[^>]+>/g, '')
    .slice(0, 15000);

  if (/[\u0e00-\u0e7f]/.test(clean)) return { name: 'Thai', lang: 'tha' };
  if (/[\u3040-\u30ff]/.test(clean)) return { name: 'Japanese', lang: 'jpn' };
  if (/[\uac00-\ud7af]/.test(clean)) return { name: 'Korean', lang: 'kor' };
  if (/[\u0400-\u04ff]/.test(clean)) return { name: 'Russian', lang: 'rus' };
  if (/[\u0600-\u06ff]/.test(clean)) return { name: 'Arabic', lang: 'ara' };
  if (/[\u4e00-\u9fa5]/.test(clean)) return { name: 'Chinese', lang: 'chi' };

  const idMatches = (clean.match(/\b(yang|dan|di|ini|itu|tidak|ada|dari|untuk|kamu|aku|dia|kita|mereka|bisa|sudah|dengan|akan|apa|pada|saya|kau|kami|jangan|bukan)\b/gi) || []).length;
  const deMatches = (clean.match(/\b(und|der|die|das|ich|nicht|sie|ein|eine|ist|wir|haben|mit|dem|den|aber|wie|dass|sich|oder|wenn)\b/gi) || []).length;
  const esMatches = (clean.match(/\b(que|de|no|el|la|es|un|una|los|las|por|con|para|yo|pero|está|como|más|este|esta)\b/gi) || []).length;
  const frMatches = (clean.match(/\b(que|de|ne|pas|le|la|les|un|une|est|et|des|en|du|pour|avec|dans|mais|elle|nous)\b/gi) || []).length;
  const itMatches = (clean.match(/\b(che|di|non|il|la|un|una|per|con|sono|ma|questo|questa|come|cosa|tutto|anche)\b/gi) || []).length;
  const ptMatches = (clean.match(/\b(que|de|não|o|a|os|as|um|uma|com|para|por|em|este|esta|você|isso|mas)\b/gi) || []).length;
  const enMatches = (clean.match(/\b(the|and|you|that|was|for|are|with|his|they|this|have|from|one|had|not|but|what|all|were|when|your|can|there|out|about)\b/gi) || []).length;

  const scores = [
    { name: 'English', lang: 'eng', score: enMatches },
    { name: 'Indonesian', lang: 'ind', score: idMatches },
    { name: 'German', lang: 'ger', score: deMatches },
    { name: 'Spanish', lang: 'spa', score: esMatches },
    { name: 'French', lang: 'fra', score: frMatches },
    { name: 'Italian', lang: 'ita', score: itMatches },
    { name: 'Portuguese', lang: 'por', score: ptMatches }
  ].sort((a, b) => b.score - a.score);

  if (scores[0] && scores[0].score >= 2) {
    return { name: scores[0].name, lang: scores[0].lang };
  }
  return null;
}

/**
 * Deep media probe using ffprobe
 * Extracts video/audio codec, container duration, dimensions, and chapter marks
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
function probeMediaFile(filePath) {
  return new Promise((resolve) => {
    if (!FFPROBE_PATH || !filePath) {
      return resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
    }

    fs.promises.access(filePath, fs.constants.F_OK).then(() => {

    const args = [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration',
      '-show_entries', 'stream=index,codec_type,codec_name,width,height,tags',
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

    proc.on('close', async () => {
      try {
        const parsed = JSON.parse(out || '{}');
        const streams = parsed.streams || [];
        const vStream = streams.find((s) => s.codec_type === 'video');
        const aStream = streams.find((s) => s.codec_type === 'audio');
        const aStreams = streams.filter((s) => s.codec_type === 'audio');
        const animeResolver = require('./anime-skip-resolver');
        const animeParsed = animeResolver.parseAnimeTitleAndEpisode(path.basename(filePath));
        const isAnime = Boolean(animeParsed);
        const isDub = isAnime && /\b(dub|dubbed|english dub)\b/i.test(path.basename(filePath));

        const audioTracks = aStreams.map((s, idx) => {
          let name = (s.tags && (s.tags.title || s.tags.TITLE || s.tags.handler_name)) || '';
          let lang = (s.tags && (s.tags.language || s.tags.LANGUAGE)) || '';
          if (!name || name === 'SoundHandler' || /^Audio Track/i.test(name) || /^Default/i.test(name)) {
            if (/jpn|ja/i.test(lang)) {
              name = 'Japanese (Original)';
            } else if (/eng|en/i.test(lang)) {
              name = 'English (Dub)';
            } else if (isAnime && aStreams.length === 2) {
              name = idx === 0 ? (isDub ? 'English (Dub)' : 'Japanese (Original)') : (isDub ? 'Japanese (Original)' : 'English (Dub)');
              if (!lang) lang = idx === 0 ? (isDub ? 'en' : 'ja') : (isDub ? 'ja' : 'en');
            } else if (isAnime && aStreams.length === 1) {
              name = isDub ? 'English (Dub)' : 'Japanese (Original)';
              if (!lang) lang = isDub ? 'en' : 'ja';
            } else {
              name = `Audio Track ${idx + 1}${lang ? ` [${lang.toUpperCase()}]` : ''}`;
            }
          }
          return {
            index: idx,
            streamIndex: s.index,
            codec: s.codec_name,
            name,
            lang
          };
        });
        const duration = Number(parsed.format?.duration) || 0;
        const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
        let chapters = rawChapters.map((c, idx) => ({
          index: idx,
          start: Math.max(0, Number(c.start_time) || (Number(c.start) / 1000) || 0),
          end: Math.max(0, Number(c.end_time) || (Number(c.end) / 1000) || 0),
          title: (c.tags && (c.tags.title || c.tags.TITLE || c.tags.Title)) || ''
        })).filter((c) => c.end > c.start);

        const subStreams = streams.filter((s) => s.codec_type === 'subtitle');
        const subtitleTracks = subStreams.map((s, idx) => {
          let name = (s.tags && (s.tags.title || s.tags.TITLE || s.tags.handler_name)) || '';
          const lang = (s.tags && (s.tags.language || s.tags.LANGUAGE)) || '';
          if (!name || /^(SubtitleHandler|Timed Text Media Handler|Text|Subtitles|handler)$/i.test(name.trim())) {
            if (/jpn|ja/i.test(lang)) name = 'Japanese';
            else if (/eng|en/i.test(lang)) name = 'English';
            else if (/ger|deu|de/i.test(lang)) name = 'German';
            else if (/spa|es/i.test(lang)) name = 'Spanish';
            else if (/fre|fra|fr/i.test(lang)) name = 'French';
            else if (/ita|it/i.test(lang)) name = 'Italian';
            else if (/rus|ru/i.test(lang)) name = 'Russian';
            else if (/chi|zho|zh/i.test(lang)) name = 'Chinese';
            else if (/kor|ko/i.test(lang)) name = 'Korean';
            else if (/ind|in|id/i.test(lang)) name = 'Indonesian';
            else if (/tha|th/i.test(lang)) name = 'Thai';
            else if (/ara|ar/i.test(lang)) name = 'Arabic';
            else if (/por|pt/i.test(lang)) name = 'Portuguese';
            else if (/vie|vi/i.test(lang)) name = 'Vietnamese';
            else name = `Subtitle Track ${idx + 1}${lang ? ` [${lang}]` : ''}`;
          }
          return {
            index: idx,
            streamIndex: s.index,
            codec: s.codec_name,
            name,
            lang
          };
        });

        // If any subtitle track still has a generic name and unknown language, sample it to detect language
        for (const st of subtitleTracks) {
          if ((!st.name || st.name.startsWith('Subtitle Track')) && (!st.lang || st.lang === 'und')) {
            try {
              const sample = await extractEmbeddedSubtitleVtt(filePath, st.index);
              if (sample && sample.ok && sample.content) {
                const detected = detectSubtitleLanguage(sample.content);
                if (detected) {
                  st.name = detected.name;
                  st.lang = detected.lang;
                }
              }
            } catch {}
          }
        }

        resolve({
          ok: true,
          formatName: parsed.format?.format_name || '',
          duration,
          videoCodec: vStream?.codec_name || null,
          audioCodec: aStream?.codec_name || null,
          width: vStream?.width || 0,
          height: vStream?.height || 0,
          audioTracks,
          subtitleTracks,
          chapters
        });
      } catch (parseErr) {
        logger.warn(`ffprobe output JSON parse error:`, parseErr.message);
        resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
      }
    });
    }).catch(() => {
      resolve({ ok: false, duration: 0, videoCodec: null, audioCodec: null, chapters: [] });
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
 * Uses canonical Chromium URL parser for zero-loss encoding of +, %, #, spaces
 * @param {string} filePath
 * @returns {string}
 */
function toMediaUrl(filePath) {
  if (!filePath) return '';
  const resolved = path.resolve(filePath);
  return pathToFileURL(resolved).href.replace(/^file:\/\//i, 'media://');
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
  for (let i = 1; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.replace(/^["']|["']$/g, '').trim();
    if (!clean || clean.startsWith('-') || clean === '.') continue;
    const resolved = path.resolve(clean);
    const ext = path.extname(clean).toLowerCase() || path.extname(resolved).toLowerCase();
    if (MEDIA_EXTENSIONS.has(ext) && (fs.existsSync(clean) || fs.existsSync(resolved))) {
      const canonicalPath = fs.existsSync(resolved) ? resolved : clean;
      const item = buildMediaItem(canonicalPath);
      const sibling = scanMediaFolder(item.folderPath);
      return { item, folder: sibling };
    }
  }
  return null;
}

/**
 * Extract embedded subtitle stream from a media file directly to WebVTT string
 * Includes safety timeout to prevent hanging the media probe chain on corrupt files.
 */
function extractEmbeddedSubtitleVtt(filePath, trackIndex = 0, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!filePath || !hasFfmpeg()) {
      return resolve({ ok: false, content: null });
    }

    fs.promises.access(filePath, fs.constants.F_OK).then(() => {
      let finished = false;
      let proc = null;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { if (proc) proc.kill(); } catch {}
          logger.warn(`Embedded subtitle extraction timed out after ${timeoutMs}ms: ${filePath}`);
          resolve({ ok: false, content: null });
        }
      }, timeoutMs);

      proc = spawn(FFMPEG_PATH, [
        '-nostdin',
        '-v', 'error',
        '-i', filePath,
        '-map', `0:s:${trackIndex}`,
        '-f', 'webvtt',
        '-'
      ], { windowsHide: true });

      let vtt = '';
      proc.stdout.on('data', (d) => { vtt += d.toString(); });
      proc.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (code === 0 && vtt.trim().length > 0) {
          resolve({ ok: true, content: vtt });
        } else {
          resolve({ ok: false, content: null });
        }
      });
      proc.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        logger.debug('Embedded subtitle extraction error:', err.message);
        resolve({ ok: false, content: null });
      });
    }).catch(() => {
      resolve({ ok: false, content: null });
    });
  });
}

/**
 * Asynchronously query AniList and AniSkip in the background for anime episodes
 * without blocking local media probing or video startup.
 * @param {string} filePath
 * @param {number} duration
 * @returns {Promise<Array>}
 */
async function resolveAnimeChapters(filePath, duration = 0) {
  if (!filePath || typeof filePath !== 'string' || duration < 60) return [];
  try {
    const animeResolver = require('./anime-skip-resolver');
    const animeInfo = animeResolver.parseAnimeTitleAndEpisode(path.basename(filePath));
    if (!animeInfo) return [];
    const malId = await animeResolver.resolveMalId(animeInfo.title);
    if (!malId) return [];
    const skipData = await animeResolver.fetchAnimeSkipTimes(malId, animeInfo.episode, duration);
    if (skipData && (skipData.op || skipData.ed)) {
      const genChapters = animeResolver.buildContiguousChapters(skipData, duration);
      return genChapters.map((gc, i) => ({
        index: i,
        start: gc.start,
        end: gc.end,
        title: gc.title
      }));
    }
  } catch (err) {
    logger.debug('Background anime chapter resolution notice:', err.message);
  }
  return [];
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
  parseByteRange,
  detectNeedsStream,
  detectNeedsStreamAsync,
  probeMediaFile,
  resolveAnimeChapters,
  detectSubtitleLanguage,
  naturalCompare,
  findAutoSubtitle,
  extractEmbeddedSubtitleVtt,
  toMediaUrl,
  buildMediaItem,
  scanMediaFolder,
  resolveCliMediaFile
};
