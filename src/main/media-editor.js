// src/main/media-editor.js
// Dedicated Media Tools Service: Video Converter, Subtitle Lookup & Embedder, Container Metadata Editor
// Uses bundled FFmpeg & FFprobe executables for fast, local, offline-first media processing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { spawn, execFile } = require('child_process');
const mediaResolver = require('./media-resolver');
const { createLogger } = require('./logger');

const logger = createLogger('MediaEditor');

function parseTimestamp(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    return (parseFloat(parts[0]) * 3600) + (parseFloat(parts[1]) * 60) + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
  }
  return parseFloat(timeStr) || 0;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return i === 0 ? `${Math.round(val)} B` : `${val.toFixed(1)} ${units[i]}`;
}

function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

class MediaEditor {
  constructor() {
    this.activeJobs = new Map(); // jobId -> childProcess
    this.stagedTempFiles = new Set(); // Track staged temp subtitle files for automatic cleanup
    this.cleanupTempFiles();
  }

  _getTempDir() {
    return process.env.TEMP || process.env.TMP || os.tmpdir() || 'C:\\Windows\\Temp';
  }

  _isTempSubFile(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    if (this.stagedTempFiles.has(filePath)) return true;
    const base = path.basename(filePath).toLowerCase();
    return base.startsWith('copycat_sub_');
  }

  /**
   * Sweep and delete temporary staged subtitle files (and leftover builder .tmp.ico artifacts)
   */
  cleanupTempFiles(specificPath = null) {
    if (specificPath) {
      if (this._isTempSubFile(specificPath)) {
        try {
          if (fs.existsSync(specificPath)) fs.unlinkSync(specificPath);
        } catch {}
        this.stagedTempFiles.delete(specificPath);
      }
      return;
    }

    for (const f of this.stagedTempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    this.stagedTempFiles.clear();

    try {
      const tmpDir = this._getTempDir();
      if (tmpDir && fs.existsSync(tmpDir)) {
        const entries = fs.readdirSync(tmpDir);
        for (const name of entries) {
          const lower = name.toLowerCase();
          if (lower.startsWith('copycat_sub_') || lower.endsWith('.tmp.ico')) {
            try {
              fs.unlinkSync(path.join(tmpDir, name));
            } catch {}
          }
        }
      }
    } catch {}
  }

  /**
   * Resolve the official CopyCat Subtitles download subfolder (Downloads\CopyCat\Subtitles)
   */
  getSubtitlesDownloadFolder(customBaseDir = null) {
    let baseCopyCatDir = customBaseDir;
    if (!baseCopyCatDir) {
      try {
        const { app } = require('electron');
        const dlRoot = (app && typeof app.getPath === 'function')
          ? app.getPath('downloads')
          : path.join(os.homedir(), 'Downloads');
        baseCopyCatDir = path.join(dlRoot, 'CopyCat');
      } catch {
        baseCopyCatDir = path.join(os.homedir(), 'Downloads', 'CopyCat');
      }
    }
    const subDir = path.join(baseCopyCatDir, 'Subtitles');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    return subDir;
  }

  /**
   * Cancel an active conversion or embedding task
   */
  cancelJob(jobId) {
    const child = this.activeJobs.get(jobId);
    if (child) {
      try {
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
        } else {
          child.kill('SIGKILL');
        }
      } catch {}
      this.activeJobs.delete(jobId);
      logger.info(`Cancelled media editor job [${jobId}]`);
      return true;
    }
    return false;
  }

  /**
   * Read container metadata, stream details and tags using ffprobe
   */
  async probeMetadata(filePath) {
    filePath = String(filePath || '').trim().replace(/^["']+|["']+$/g, '').trim();
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const ffprobePath = mediaResolver.FFPROBE_PATH;
    if (!ffprobePath || !fs.existsSync(ffprobePath)) {
      throw new Error('Bundled FFprobe binary could not be found.');
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        '-show_chapters',
        filePath
      ];

      execFile(ffprobePath, args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err) {
          return reject(new Error(`Failed to probe media metadata: ${err.message}`));
        }

        try {
          const data = JSON.parse(stdout || '{}');
          const fmt = data.format || {};
          const streams = data.streams || [];
          const tags = fmt.tags || {};

          const videoStreams = streams.filter((s) => s.codec_type === 'video');
          const audioStreams = streams.filter((s) => s.codec_type === 'audio');
          const subtitleStreams = streams.filter((s) => s.codec_type === 'subtitle');

          const primaryVideo = videoStreams[0] || {};
          const duration = parseFloat(fmt.duration || primaryVideo.duration || '0');
          const sizeBytes = parseInt(fmt.size || '0', 10) || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

          const result = {
            success: true,
            ok: true,
            filePath,
            fileName: path.basename(filePath),
            filename: path.basename(filePath),
            formatName: fmt.format_name || path.extname(filePath).replace('.', '').toLowerCase(),
            format: fmt.format_name || path.extname(filePath).replace('.', '').toLowerCase(),
            durationSec: duration,
            duration: duration,
            durationFormatted: formatDuration(duration),
            sizeBytes,
            size: sizeBytes,
            sizeFormatted: formatBytes(sizeBytes),
            bitRate: parseInt(fmt.bit_rate || '0', 10),
            chaptersCount: (data.chapters || []).length,
            tags: {
              title: tags.title || tags.TITLE || '',
              show: tags.show || tags.SHOW || tags.album || '',
              season: tags.season_number || tags.SEASON_NUMBER || tags.season || '',
              episode: tags.episode_sort || tags.EPISODE_SORT || tags.episode || '',
              artist: tags.artist || tags.ARTIST || tags.author || '',
              year: tags.date || tags.DATE || tags.year || tags.creation_time?.slice(0, 4) || '',
              description: tags.description || tags.comment || tags.COMMENT || ''
            },
            video: {
              codec: primaryVideo.codec_name || 'unknown',
              width: primaryVideo.width || 0,
              height: primaryVideo.height || 0,
              resolution: primaryVideo.width ? `${primaryVideo.width}x${primaryVideo.height}` : 'Unknown',
              fps: (() => {
                if (!primaryVideo.r_frame_rate) return 0;
                const parts = String(primaryVideo.r_frame_rate).split('/').map(Number);
                if (parts.length === 2 && parts[1] > 0) return Math.round(parts[0] / parts[1]);
                return Math.round(parts[0] || 0);
              })()
            },
            videoStream: primaryVideo,
            audioTracks: audioStreams.map((a, i) => ({
              index: a.index,
              trackNumber: i + 1,
              codec: a.codec_name || 'unknown',
              channels: a.channels || 2,
              language: a.tags?.language || a.tags?.lang || 'und',
              title: a.tags?.title || a.tags?.handler_name || `Audio Track ${i + 1}`,
              isDefault: Boolean(a.disposition?.default)
            })),
            audioStreams: audioStreams.map((a, i) => ({
              index: a.index,
              trackNumber: i + 1,
              codec: a.codec_name || 'unknown',
              channels: a.channels || 2,
              language: a.tags?.language || a.tags?.lang || 'und',
              title: a.tags?.title || a.tags?.handler_name || `Audio Track ${i + 1}`,
              isDefault: Boolean(a.disposition?.default)
            })),
            subtitleTracks: subtitleStreams.map((s, i) => ({
              index: s.index,
              trackNumber: i + 1,
              codec: s.codec_name || 'unknown',
              language: s.tags?.language || s.tags?.lang || 'und',
              title: s.tags?.title || s.tags?.handler_name || `Subtitle ${i + 1}`,
              isDefault: Boolean(s.disposition?.default)
            })),
            subtitleStreams: subtitleStreams.map((s, i) => ({
              index: s.index,
              trackNumber: i + 1,
              codec: s.codec_name || 'unknown',
              language: s.tags?.language || s.tags?.lang || 'und',
              title: s.tags?.title || s.tags?.handler_name || `Subtitle ${i + 1}`,
              isDefault: Boolean(s.disposition?.default)
            }))
          };

          resolve(result);
        } catch (parseErr) {
          reject(new Error(`Failed to parse probe JSON output: ${parseErr.message}`));
        }
      });
    });
  }

  /**
   * Fast metadata rewrite using FFmpeg lossless container remux
   */
  async applyMetadata({ inputPath, outputPath, tags, audioTracks = [] }, onProgress = null) {
    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }

    const ffmpegPath = mediaResolver.FFMPEG_PATH;
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      throw new Error('Bundled FFmpeg executable could not be resolved.');
    }

    const outPath = outputPath || path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}_tagged${path.extname(inputPath)}`
    );

    const args = ['-y', '-i', inputPath, '-map', '0', '-c', 'copy'];

    if (tags) {
      if (tags.title) args.push('-metadata', `title=${tags.title}`);
      if (tags.show) args.push('-metadata', `show=${tags.show}`, '-metadata', `album=${tags.show}`);
      if (tags.season) args.push('-metadata', `season_number=${tags.season}`);
      if (tags.episode) args.push('-metadata', `episode_sort=${tags.episode}`);
      if (tags.artist) args.push('-metadata', `artist=${tags.artist}`);
      if (tags.year) args.push('-metadata', `date=${tags.year}`);
      const desc = tags.description || tags.comment;
      if (desc) args.push('-metadata', `description=${desc}`, '-metadata', `comment=${desc}`);
      if (tags.audioLang && String(tags.audioLang).trim()) {
        args.push('-metadata:s:a:0', `language=${String(tags.audioLang).trim()}`);
      }
    }

    if (Array.isArray(audioTracks)) {
      audioTracks.forEach((tr, i) => {
        if (tr.language) args.push(`-metadata:s:a:${i}`, `language=${tr.language}`);
        if (tr.title) args.push(`-metadata:s:a:${i}`, `title=${tr.title}`);
      });
    }

    if (outPath.toLowerCase().endsWith('.mp4')) {
      args.push('-movflags', '+faststart');
    }

    args.push(outPath);

    return new Promise((resolve, reject) => {
      const jobId = `meta_${Date.now()}`;
      logger.info(`Applying metadata [${jobId}]: ${inputPath} -> ${outPath}`);

      const child = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      this.activeJobs.set(jobId, child);

      let errText = '';
      child.stderr.on('data', (d) => { errText += d.toString(); });
      child.on('error', (err) => {
        this.activeJobs.delete(jobId);
        reject(err);
      });

      child.on('close', (code) => {
        this.activeJobs.delete(jobId);
        if (code === 0 && fs.existsSync(outPath)) {
          resolve({ success: true, ok: true, outputPath: outPath });
        } else {
          reject(new Error(errText.trim() || `FFmpeg exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Convert video/audio file to a different format or container
   */
  async convertMedia(options, onProgress = null) {
    const {
      inputPath,
      outputPath,
      targetFormat = 'mp4',
      mode = 'copy', // 'copy' (fast remux) or 'transcode' (re-encode)
      crf = 20,
      preset = 'medium',
      audioOnly = false
    } = options;

    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }

    const ffmpegPath = mediaResolver.FFMPEG_PATH;
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      throw new Error('Bundled FFmpeg executable could not be resolved.');
    }

    const ext = audioOnly ? (targetFormat === 'mp3' ? '.mp3' : '.aac') : `.${targetFormat.toLowerCase().replace('.', '')}`;
    const defaultOut = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}_converted${ext}`
    );
    const finalOut = outputPath || defaultOut;

    const args = ['-y', '-i', inputPath];

    if (audioOnly) {
      args.push('-vn');
      if (ext === '.mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', '256k');
      } else {
        args.push('-c:a', 'aac', '-b:a', '256k');
      }
    } else if (mode === 'copy') {
      args.push('-c', 'copy');
      if (ext === '.mp4') {
        args.push('-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart');
      }
    } else {
      // Re-encode video
      if (ext === '.webm') {
        args.push('-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k');
      } else {
        args.push('-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-c:a', 'aac', '-b:a', '192k');
        if (ext === '.mp4') {
          args.push('-movflags', '+faststart');
        }
      }
    }

    args.push(finalOut);

    const jobId = `conv_${Date.now()}`;
    logger.info(`Starting media conversion [${jobId}]: ${inputPath} -> ${finalOut} (${mode})`);

    return new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      this.activeJobs.set(jobId, child);

      let totalDuration = 0;
      let lastReport = 0;
      let lastStderr = '';

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        lastStderr = (lastStderr + text).slice(-3000);

        if (!totalDuration) {
          const durMatch = text.match(/Duration:\s*(\d\d:\d\d:\d\d\.\d\d)/);
          if (durMatch && durMatch[1]) {
            totalDuration = parseTimestamp(durMatch[1]);
          }
        }

        const timeMatch = text.match(/time=(\d\d:\d\d:\d\d\.\d\d)/);
        if (timeMatch && timeMatch[1]) {
          const currentTime = parseTimestamp(timeMatch[1]);
          const percent = totalDuration > 0 ? Math.min(100, Math.round((currentTime / totalDuration) * 100)) : 0;
          const speedMatch = text.match(/speed=\s*([\d\.]+)x/);
          const fpsMatch = text.match(/fps=\s*([\d\.]+)/);

          const now = Date.now();
          if (now - lastReport > 250 && typeof onProgress === 'function') {
            lastReport = now;
            onProgress({
              jobId,
              percent,
              currentTimeFormatted: formatDuration(currentTime),
              totalDurationFormatted: formatDuration(totalDuration),
              speed: speedMatch ? `${speedMatch[1]}x` : '',
              fps: fpsMatch ? fpsMatch[1] : ''
            });
          }
        }
      });

      child.on('error', (err) => {
        this.activeJobs.delete(jobId);
        reject(err);
      });

      child.on('close', (code) => {
        this.activeJobs.delete(jobId);
        if (code === 0 && fs.existsSync(finalOut)) {
          if (typeof onProgress === 'function') {
            onProgress({ jobId, percent: 100, status: 'completed' });
          }
          resolve({ success: true, ok: true, jobId, outputPath: finalOut });
        } else {
          reject(new Error(lastStderr.trim() || `Conversion process exited with code ${code}`));
        }
      });
    });
  }

  _detectSubtitleLanguage(filename) {
    const f = String(filename || '').toLowerCase();
    if (/(?:^|[._ -])(hu|hun|magyar)(?:[._ -]|$)/i.test(f)) return 'hun';
    if (/(?:^|[._ -])(ja|jp|jpn|japanese)(?:[._ -]|$)/i.test(f)) return 'jpn';
    if (/(?:^|[._ -])(de|ger|deu|deutsch|german)(?:[._ -]|$)/i.test(f)) return 'ger';
    if (/(?:^|[._ -])(en|eng|english)(?:[._ -]|$)/i.test(f)) return 'eng';
    if (/(?:^|[._ -])(es|spa|spanish|espanol)(?:[._ -]|$)/i.test(f)) return 'spa';
    if (/(?:^|[._ -])(fr|fre|fra|french|francais)(?:[._ -]|$)/i.test(f)) return 'fre';
    if (/(?:^|[._ -])(it|ita|italian|italiano)(?:[._ -]|$)/i.test(f)) return 'ita';
    if (/(?:^|[._ -])(pt|por|pob|portuguese|pt-br)(?:[._ -]|$)/i.test(f)) return 'por';
    if (/(?:^|[._ -])(ru|rus|russian)(?:[._ -]|$)/i.test(f)) return 'rus';
    if (/(?:^|[._ -])(ko|kor|korean)(?:[._ -]|$)/i.test(f)) return 'kor';
    if (/(?:^|[._ -])(zh|chi|zho|chs|cht|chinese)(?:[._ -]|$)/i.test(f)) return 'chi';
    if (/(?:^|[._ -])(ar|ara|arabic)(?:[._ -]|$)/i.test(f)) return 'ara';
    if (/(?:^|[._ -])(pl|pol|polish)(?:[._ -]|$)/i.test(f)) return 'pol';
    if (/(?:^|[._ -])(tr|tur|turkish)(?:[._ -]|$)/i.test(f)) return 'tur';
    if (/(?:^|[._ -])(hi|hin|hindi)(?:[._ -]|$)/i.test(f)) return 'hin';
    if (/(?:^|[._ -])(nl|dut|nld|dutch)(?:[._ -]|$)/i.test(f)) return 'nld';
    return 'eng';
  }

  _normalizeSubtitleLangCode(lang = 'eng') {
    const map = {
      en: 'eng',
      hu: 'hun',
      de: 'ger',
      deu: 'ger',
      ja: 'jpn',
      es: 'spa',
      fr: 'fre',
      fra: 'fre',
      it: 'ita',
      pt: 'por',
      pob: 'por',
      ru: 'rus',
      ko: 'kor',
      zh: 'chi',
      zho: 'chi',
      ar: 'ara',
      pl: 'pol',
      tr: 'tur',
      hi: 'hin',
      nl: 'nld',
      dut: 'nld'
    };
    const c = String(lang || 'eng').trim().toLowerCase();
    return map[c] || c || 'eng';
  }

  /**
   * Compute the 64-bit OpenSubtitles binary hash (moviehash + moviebytesize) for frame-accurate matching
   */
  _computeOpenSubtitlesHash(filePath) {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      const size = stat.size;
      const chunkSize = 65536;
      if (size < chunkSize * 2) return null;

      const fd = fs.openSync(filePath, 'r');
      const head = Buffer.alloc(chunkSize);
      const tail = Buffer.alloc(chunkSize);
      try {
        fs.readSync(fd, head, 0, chunkSize, 0);
        fs.readSync(fd, tail, 0, chunkSize, size - chunkSize);
      } finally {
        fs.closeSync(fd);
      }

      const mask = 0xFFFFFFFFFFFFFFFFn;
      let hash = BigInt(size) & mask;
      for (let i = 0; i < chunkSize; i += 8) {
        hash = (hash + head.readBigUInt64LE(i)) & mask;
        hash = (hash + tail.readBigUInt64LE(i)) & mask;
      }

      return {
        moviehash: hash.toString(16).padStart(16, '0'),
        moviebytesize: size
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolve a show or movie name to its official IMDb ID (ttXXXXXXX) via IMDb's public keyless suggestion API
   */
  _resolveImdbId(searchName, isEpisode = false) {
    return new Promise((resolve) => {
      const clean = String(searchName || '')
        .replace(/[^\w\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      if (!clean || clean.length < 2) return resolve(null);

      const firstCharMatch = clean.match(/[a-z0-9]/);
      const firstChar = firstCharMatch ? firstCharMatch[0] : 'a';
      const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(clean)}.json`;

      const req = https.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 4500
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data || '{}');
            const items = Array.isArray(json.d) ? json.d.filter((x) => x && /^tt\d+$/.test(x.id)) : [];
            if (items.length === 0) return resolve(null);

            let best = null;
            let bestScore = -999;
            for (const item of items) {
              let s = 0;
              const label = String(item.l || '').toLowerCase().trim();
              const qType = String(item.q || item.qid || '').toLowerCase();

              if (label === clean) s += 60;
              else if (label.startsWith(clean)) s += 30;
              else if (label.includes(clean)) s += 15;

              if (isEpisode) {
                if (qType.includes('tv') || qType.includes('series')) s += 35;
                else if (qType.includes('feature') || qType.includes('movie')) s -= 20;
              } else {
                if (qType.includes('feature') || qType.includes('movie')) s += 25;
              }

              if (s > bestScore) {
                bestScore = s;
                best = item;
              }
            }

            if (!best) return resolve(null);
            return resolve({
              imdbId: best.id,
              imdbDigits: best.id.replace(/^tt/i, ''),
              title: best.l || searchName,
              year: best.y || null
            });
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Query the OpenSubtitles v3 Community Index (opensubtitles-v3.strem.io) by IMDb ID with zero API key required
   */
  _queryStremioOpenSubtitlesV3(imdbInfo, season, episode, subLang = 'eng') {
    return new Promise((resolve) => {
      if (!imdbInfo || !imdbInfo.imdbId) return resolve([]);
      const isEp = episode !== null && episode !== undefined;
      const sNum = season || 1;
      const endpoint = isEp
        ? `https://opensubtitles-v3.strem.io/subtitles/series/${imdbInfo.imdbId}:${sNum}:${episode}.json`
        : `https://opensubtitles-v3.strem.io/subtitles/movie/${imdbInfo.imdbId}.json`;

      const req = https.get(endpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 5500
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data || '{}');
            const list = Array.isArray(json.subtitles) ? json.subtitles : [];
            const filtered = list.filter((item) => {
              if (!item || !item.url) return false;
              if (!subLang || subLang === 'all') return true;
              const itemLang = this._normalizeSubtitleLangCode(item.lang || '');
              return itemLang === subLang;
            });

            const safeShow = String(imdbInfo.title || 'Media').replace(/\s+/g, '.');
            const epTag = isEp
              ? `.S${String(sNum).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
              : (imdbInfo.year ? `.${imdbInfo.year}` : '');

            const mapped = filtered.slice(0, 25).map((item, idx) => {
              const langCode = this._normalizeSubtitleLangCode(item.lang || subLang);
              const subId = item.id || `v3_${idx + 1}`;
              const urlFileMatch = String(item.url || '').match(/\/file\/(\d+)/);
              const canonicalId = urlFileMatch ? urlFileMatch[1] : `osv3_${subId}`;
              const constructedName = item.subtitleFileName || item.filename
                || `${safeShow}${epTag}.OpenSubtitlesV3-${subId}.${langCode}.srt`;
              return {
                id: canonicalId,
                source: 'opensubtitles-v3',
                matchedBy: 'imdbid',
                title: constructedName,
                fileName: constructedName,
                movieName: imdbInfo.title || '',
                movieKind: isEp ? 'episode' : 'movie',
                seriesSeason: isEp ? String(sNum) : '0',
                seriesEpisode: isEp ? String(episode) : '0',
                downloads: 500 - idx * 10,
                subBad: '0',
                lang: langCode,
                format: 'SRT',
                downloadUrl: item.url,
                rating: '0'
              };
            });
            return resolve(mapped);
          } catch {
            resolve([]);
          }
        });
      });
      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
    });
  }

  /**
   * Extract show, season, and episode tokens from a filename or search query for ranking
   */
  _parseSearchContext(queryStr = '', filePath = null, explicit = {}) {
    const rawBase = filePath ? path.basename(filePath, path.extname(filePath)) : '';
    const sourceText = rawBase || queryStr || '';
    let clean = sourceText
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/\s*\[[0-9a-fA-F]{8}\]$/, '')
      .replace(/\b(?:19\d\d|20\d\d|480p|720p|1080p|2160p|4k|x264|h264|x265|hevc|av1|aac\d*(?:\.\d+)?|flac|5\.1|2\.0|10-?bit|bluray|bdrip|web-?dl|webrip|hdtv|dcp\w*|2d|2k)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let show = explicit.show || '';
    let season = explicit.season ? parseInt(explicit.season, 10) : null;
    let episode = explicit.episode ? parseInt(explicit.episode, 10) : null;
    let rawEpToken = explicit.episode ? String(explicit.episode) : null;

    const se = clean.match(/^(.*?)(?:[._ -]+|\b)[sS](\d{1,2})[_.-]?[eE](\d{1,4})\b/)
      || clean.match(/^(.*?)(?:[._ -]+|\b)(\d{1,2})x(\d{1,4})\b/i);
    if (se) {
      if (!show) show = se[1].replace(/[._-]+/g, ' ').trim();
      if (!season) season = parseInt(se[2], 10);
      if (episode === null) episode = parseInt(se[3], 10);
      if (!rawEpToken) rawEpToken = se[3];
    } else {
      const epM = clean.match(/^(.*?)(?:[._ -]+|\b)(?:ep|episode|tv_|-)?\s*(0*\d{1,4})(?:\b|$)/i);
      if (epM && epM[1].trim().length > 0) {
        if (!show) show = epM[1].replace(/[._-]+/g, ' ').trim();
        if (!season) season = 1;
        if (episode === null) episode = parseInt(epM[2], 10);
        if (!rawEpToken) rawEpToken = epM[2];
      } else if (!show) {
        show = clean.replace(/[._-]+/g, ' ').trim();
      }
    }

    // Also inspect rawBase specifically for zero-padded episode tokens like "001"
    if (rawBase && episode !== null) {
      const rawEpM = rawBase.match(/(?:[._ -]|ep|episode)(0+\d{1,4})(?:\b|[._ -])/i);
      if (rawEpM && parseInt(rawEpM[1], 10) === episode) {
        rawEpToken = rawEpM[1];
      }
    }

    return {
      show: show.trim(),
      season: season || 1,
      episode: Number.isNaN(episode) ? null : episode,
      rawEpToken,
      rawBase: rawBase.replace(/[._-]+/g, ' ').trim()
    };
  }

  /**
   * Extract season and episode number from a candidate subtitle filename
   */
  _extractCandidateEpisode(fileName = '') {
    let clean = String(fileName).replace(/\.[^/.]+$/, '');
    clean = clean.replace(/OpenSubtitlesV3-\d+/gi, ' ');
    clean = clean.replace(/\s*\[[0-9a-fA-F]{8}\]/g, ' ');
    clean = clean.replace(/\b(?:19\d\d|20\d\d|480p|720p|1080p|2160p|4k|x264|h264|x265|hevc|av1|aac\d*(?:\.\d+)?|5\.1|2\.0|10-?bit|bluray|bdrip|web-?dl|webrip|dcp\w*|2d|2k)\b/gi, ' ');

    const se = clean.match(/\bS(\d{1,2})[_.-]?E(\d{1,4})\b/i) || clean.match(/\b(\d{1,2})x(\d{1,4})\b/i);
    if (se) {
      return { season: parseInt(se[1], 10), ep: parseInt(se[2], 10), rawEp: se[2] };
    }
    const sAndEp = clean.match(/Season\s*(\d{1,2})\s*[-_ ]\s*(\d{1,4})\b/i);
    if (sAndEp) {
      return { season: parseInt(sAndEp[1], 10), ep: parseInt(sAndEp[2], 10), rawEp: sAndEp[2] };
    }
    const epM = clean.match(/(?:[-_ ]|ep|episode|tv_)\s*(0*\d{1,4})(?=\b|[._ \-[])/i);
    if (epM) {
      return { season: null, ep: parseInt(epM[1], 10), rawEp: epM[1] };
    }
    return { season: null, ep: null, rawEp: null };
  }

  /**
   * Score an online subtitle candidate from Best to Worst against the target media context
   */
  _scoreSubtitleCandidate(item, ctx) {
    let score = 50;
    const fn = item.fileName || '';
    const fnLower = fn.toLowerCase();
    const movie = item.movieName || '';
    const movieLower = movie.toLowerCase();
    const kind = (item.movieKind || '').toLowerCase();
    const matchedBy = (item.matchedBy || '').toLowerCase();
    const dl = parseInt(item.downloads || '0', 10) || 0;
    const rating = parseFloat(item.rating || '0') || 0;
    const targetShow = (ctx.show || '').toLowerCase();
    const targetEp = ctx.episode;
    const targetSeason = ctx.season || 1;

    // 0. Exact binary video hash or IMDb ID match bonus
    if (matchedBy === 'moviehash') {
      score += 90;
    } else if (matchedBy === 'imdbid') {
      score += 20;
    }

    const parsed = this._extractCandidateEpisode(fn);

    if (targetEp !== null && targetEp !== undefined) {
      // 1. Filename episode number match / mismatch
      if (parsed.ep !== null) {
        if (parsed.ep === targetEp) {
          score += 60;
          if (ctx.rawEpToken && parsed.rawEp === ctx.rawEpToken) {
            score += 25; // Exact padding match e.g. "001" === "001"
          }
        } else {
          score -= 80; // Explicitly a different episode (e.g. ep 227 or 101 vs ep 1)
        }
      }

      // 2. Season match / mismatch
      if (parsed.season !== null && parsed.season !== targetSeason) {
        score -= 40;
      }

      // 3. OpenSubtitles structured episode & season metadata
      const osEp = parseInt(item.seriesEpisode || '0', 10);
      const osSeason = parseInt(item.seriesSeason || '0', 10);
      if (osEp === targetEp) score += 25;
      else if (osEp > 0 && osEp !== targetEp) score -= 45;
      if (osSeason === targetSeason) score += 10;

      // 4. Media Kind (Episode/TV vs Movie)
      if (kind === 'episode' || kind === 'tv series') score += 20;
      if (kind === 'movie' || /\bmovie\b/i.test(fn)) score -= 50;
    } else {
      // Movie search bonuses
      if (kind === 'movie') score += 25;
      else if (kind === 'episode') score -= 35;
    }

    // 5. Show title match & spin-off differentiation
    if (targetShow) {
      if (movieLower.startsWith(`"${targetShow}"`) || movieLower === targetShow) {
        score += 35;
      } else if (movieLower.includes(':') && !targetShow.includes(':')) {
        score -= 25; // Spin-off or sequel subtitle (e.g. "Bleach: Thousand-Year Blood War" when searching "Bleach")
      } else if (fnLower.startsWith(targetShow) || fnLower.includes(targetShow)) {
        score += 15;
      }
    }

    // 6. Format & quality bonuses
    const fmt = (item.format || '').toLowerCase();
    if (fmt === 'srt') score += 8;
    else if (fmt === 'vtt') score += 6;
    else if (fmt === 'ass' || fmt === 'ssa') score += 5;

    if (item.subBad === '1') score -= 80;

    // Popularity & rating tie-breakers
    score += Math.min(12, Math.round(Math.log10(dl + 1) * 2.5));
    score += Math.min(5, Math.round(rating * 0.5));

    const hasEpisodeTarget = targetEp !== null && targetEp !== undefined;
    const bestThreshold = hasEpisodeTarget ? 165 : 135;
    const goodThreshold = hasEpisodeTarget ? 110 : 95;

    let matchTier = 'low';
    let matchLabel = 'PARTIAL';
    if (matchedBy === 'moviehash') {
      matchTier = 'best';
      matchLabel = '★ EXACT FILE HASH';
    } else if (score >= bestThreshold) {
      matchTier = 'best';
      matchLabel = '★ BEST MATCH';
    } else if (score >= goodThreshold) {
      matchTier = 'good';
      matchLabel = 'GOOD MATCH';
    }

    return { score, matchTier, matchLabel };
  }

  /**
   * Scan the video folder, common subtitle subfolders (Subs, Subtitles), and CopyCat's Subtitles folder
   */
  _scanLocalSubtitles(filePath, ctx) {
    const localResults = [];
    const seenPaths = new Set();
    const supportedExts = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];

    const addCandidate = (fullPath, isDedicatedSubfolder = false) => {
      const norm = path.resolve(fullPath).toLowerCase();
      if (seenPaths.has(norm)) return;
      const f = path.basename(fullPath);
      const ext = path.extname(f).toLowerCase();
      if (!supportedExts.includes(ext)) return;

      const fLower = f.toLowerCase();
      const subBase = path.basename(f, ext).toLowerCase();
      const videoBase = filePath ? path.basename(filePath, path.extname(filePath)).toLowerCase() : '';

      let isMatch = isDedicatedSubfolder;
      if (!isMatch && videoBase) {
        if (fLower.includes(videoBase) || videoBase.includes(subBase)) {
          isMatch = true;
        }
      }
      if (!isMatch && ctx && ctx.show) {
        const showLower = ctx.show.toLowerCase();
        if (fLower.includes(showLower)) {
          if (ctx.episode !== null && ctx.episode !== undefined) {
            const parsed = this._extractCandidateEpisode(f);
            if (parsed.ep === ctx.episode) isMatch = true;
          } else {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        seenPaths.add(norm);
        localResults.push({
          id: `local_${localResults.length}`,
          source: 'local',
          title: f,
          fileName: f,
          filePath: fullPath,
          localPath: fullPath,
          lang: this._detectSubtitleLanguage(f),
          format: ext.replace('.', '').toUpperCase(),
          downloadUrl: null,
          matchScore: 999,
          matchTier: 'best',
          matchLabel: '★ LOCAL MATCH'
        });
      }
    };

    try {
      const foldersToScan = [];
      if (filePath && fs.existsSync(filePath)) {
        const dir = path.dirname(filePath);
        const videoRawBase = path.basename(filePath, path.extname(filePath));
        foldersToScan.push({ dir, dedicated: false });
        for (const subDirName of ['Subs', 'Subtitles', 'Sub', 'subs', 'subtitles']) {
          foldersToScan.push({ dir: path.join(dir, subDirName), dedicated: false });
          foldersToScan.push({ dir: path.join(dir, subDirName, videoRawBase), dedicated: true });
        }
      }

      const officialSubsDir = this.getSubtitlesDownloadFolder();
      if (officialSubsDir && fs.existsSync(officialSubsDir)) {
        foldersToScan.push({ dir: officialSubsDir, dedicated: false });
      }

      const visitedDirs = new Set();
      for (const entry of foldersToScan) {
        if (!entry.dir || !fs.existsSync(entry.dir)) continue;
        const normDir = path.resolve(entry.dir).toLowerCase();
        if (visitedDirs.has(normDir)) continue;
        visitedDirs.add(normDir);

        const files = fs.readdirSync(entry.dir);
        for (const f of files) {
          const full = path.join(entry.dir, f);
          try {
            if (fs.statSync(full).isFile()) {
              addCandidate(full, entry.dedicated);
            }
          } catch {}
        }
      }
    } catch (err) {
      logger.debug('Local subtitle search notice:', err.message);
    }

    return localResults;
  }

  /**
   * Search for companion subtitles locally and across broadened online sources, sorted Best to Worst
   */
  async searchSubtitles({ query, lang = 'eng', filePath = null, show = null, season = null, episode = null }) {
    filePath = filePath ? String(filePath).trim().replace(/^["']+|["']+$/g, '').trim() : null;
    const searchQuery = query || (filePath ? path.basename(filePath, path.extname(filePath)).replace(/[-_.]+/g, ' ') : '');
    const subLang = this._normalizeSubtitleLangCode(lang);
    const ctx = this._parseSearchContext(searchQuery, filePath, { show, season, episode });

    // 1. Broadened local subtitle discovery (video directory, Subs/Subtitles subfolders, and Downloads\CopyCat\Subtitles)
    const localResults = this._scanLocalSubtitles(filePath, ctx);
    const onlineResults = [];

    // 2. Broadened multi-source online search (64-bit File Hash + IMDb ID + OpenSubtitles REST + OpenSubtitles v3 Index)
    if ((searchQuery && searchQuery.trim().length > 1) || (filePath && fs.existsSync(filePath))) {
      try {
        const langSuffix = (subLang && subLang !== 'all') ? `/sublanguageid-${subLang}` : '';
        const restQueries = [];
        const addRestQuery = (pathStr, matchedByHint = '') => {
          if (pathStr && !restQueries.some((q) => q.path === pathStr)) {
            restQueries.push({ path: pathStr, matchedBy: matchedByHint });
          }
        };

        // A. 64-bit OpenSubtitles Binary Video File Hash query
        const hashInfo = filePath ? this._computeOpenSubtitlesHash(filePath) : null;
        if (hashInfo) {
          addRestQuery(
            `moviebytesize-${hashInfo.moviebytesize}/moviehash-${hashInfo.moviehash}${langSuffix}`,
            'moviehash'
          );
        }

        // B. Resolve IMDb ID in parallel for authoritative episode/movie queries + OpenSubtitles v3
        const imdbLookupTarget = ctx.show || searchQuery;
        const imdbInfo = await this._resolveImdbId(imdbLookupTarget, ctx.episode !== null);
        if (imdbInfo && imdbInfo.imdbDigits) {
          if (ctx.episode !== null) {
            addRestQuery(
              `episode-${ctx.episode}/imdbid-${imdbInfo.imdbDigits}/season-${ctx.season || 1}${langSuffix}`,
              'imdbid'
            );
          } else {
            addRestQuery(
              `imdbid-${imdbInfo.imdbDigits}${langSuffix}`,
              'imdbid'
            );
          }
        }

        // C. Raw filename base query (e.g. "bleach 001")
        if (ctx.rawBase && ctx.rawBase.length > 1) {
          addRestQuery(`query-${encodeURIComponent(ctx.rawBase.toLowerCase())}${langSuffix}`);
        }

        // D. Structured episode + show + season query & common episode notation variants
        if (ctx.show && ctx.episode !== null) {
          const sNum = ctx.season || 1;
          const showClean = ctx.show.toLowerCase();
          addRestQuery(
            `episode-${ctx.episode}/query-${encodeURIComponent(showClean)}/season-${sNum}${langSuffix}`
          );
          const sxxexx = `${showClean} s${String(sNum).padStart(2, '0')}e${String(ctx.episode).padStart(2, '0')}`;
          addRestQuery(`query-${encodeURIComponent(sxxexx)}${langSuffix}`);
          const padded2 = `${showClean} ${String(ctx.episode).padStart(2, '0')}`;
          addRestQuery(`query-${encodeURIComponent(padded2)}${langSuffix}`);
        }

        // E. User query string
        if (searchQuery && searchQuery.trim().length > 1) {
          addRestQuery(`query-${encodeURIComponent(searchQuery.trim().toLowerCase())}${langSuffix}`);
        }

        // Execute all OpenSubtitles REST queries + OpenSubtitles v3 Community Index query in parallel
        const [restLists, v3List] = await Promise.all([
          Promise.all(restQueries.map((q) => this._queryOpenSubtitlesPath(q.path, subLang, { matchedBy: q.matchedBy }))),
          imdbInfo ? this._queryStremioOpenSubtitlesV3(imdbInfo, ctx.season || 1, ctx.episode, subLang) : Promise.resolve([])
        ]);

        const allLists = [...restLists, v3List];
        const seenIds = new Set();
        const candidates = [];

        for (const list of allLists) {
          for (const item of list) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              const { score, matchTier, matchLabel } = this._scoreSubtitleCandidate(item, ctx);
              candidates.push({
                ...item,
                matchScore: score,
                matchTier,
                matchLabel
              });
            }
          }
        }

        // Sort strictly from Best to Worst (highest matchScore first, tie-break by download count)
        candidates.sort((a, b) => {
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
          return (b.downloads || 0) - (a.downloads || 0);
        });

        onlineResults.push(...candidates.slice(0, 45));
      } catch (err) {
        logger.debug('Online subtitle search notice:', err.message);
      }
    }

    return {
      success: true,
      results: [...localResults, ...onlineResults],
      localResults,
      onlineResults
    };
  }

  _queryOpenSubtitles(query, lang = 'eng') {
    const subLang = this._normalizeSubtitleLangCode(lang);
    const langSuffix = (subLang && subLang !== 'all') ? `/sublanguageid-${subLang}` : '';
    const pathSuffix = `query-${encodeURIComponent(String(query || '').trim().toLowerCase())}${langSuffix}`;
    return this._queryOpenSubtitlesPath(pathSuffix, subLang);
  }

  _queryOpenSubtitlesPath(pathSuffix, lang = 'eng', meta = {}) {
    return new Promise((resolve) => {
      const url = `https://rest.opensubtitles.org/search/${pathSuffix}`;
      const fetchJson = (targetUrl, redirectsRemaining = 4) => {
        const req = https.get(targetUrl, {
          headers: { 'User-Agent': 'TemporaryUserAgent' },
          timeout: 6000
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsRemaining > 0) {
            req.destroy();
            return fetchJson(res.headers.location, redirectsRemaining - 1);
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const list = JSON.parse(data || '[]');
              if (Array.isArray(list)) {
                const mapped = list.slice(0, 35).map((item, idx) => ({
                  id: item.IDSubtitleFile || `os_${idx}`,
                  source: 'opensubtitles',
                  matchedBy: (item.MatchedBy || meta.matchedBy || '').toLowerCase(),
                  title: item.SubFileName || item.MovieName || `Subtitle ${idx + 1}`,
                  fileName: item.SubFileName || `sub_${idx + 1}.srt`,
                  movieName: (item.MovieName || '').replace(/\s+/g, ' ').trim(),
                  movieKind: item.MovieKind || '',
                  seriesSeason: item.SeriesSeason || '0',
                  seriesEpisode: item.SeriesEpisode || '0',
                  downloads: parseInt(item.SubDownloadsCnt || '0', 10) || 0,
                  subBad: item.SubBad || '0',
                  lang: item.SubLanguageID || lang,
                  format: item.SubFormat ? item.SubFormat.toUpperCase() : 'SRT',
                  downloadUrl: item.SubDownloadLink || item.ZipDownloadLink,
                  rating: item.SubRating || '0'
                }));
                return resolve(mapped);
              }
            } catch {}
            resolve([]);
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
      };

      fetchJson(url);
    });
  }

  /**
   * Strip HTML tags and normalize entities in online metadata synopses
   */
  _stripHtmlSynopsis(html) {
    if (!html) return '';
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\.\.+/g, '. ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
  }

  _fetchJsonHttps(targetUrl, redirectsRemaining = 3) {
    return new Promise((resolve) => {
      const req = https.get(targetUrl, {
        headers: { 'User-Agent': 'CopyCatMediaPlayer/1.3.1' },
        timeout: 5000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsRemaining > 0) {
          req.destroy();
          return resolve(this._fetchJsonHttps(res.headers.location, redirectsRemaining - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  _queryAniListMetadata(searchName) {
    return new Promise((resolve) => {
      if (!searchName) return resolve(null);
      const query = 'query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } startDate { year } studios(isMain: true) { nodes { name } } description(asHtml: false) } }';
      const body = JSON.stringify({ query, variables: { search: searchName } });
      const req = https.request('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'CopyCatMediaPlayer/1.3.1',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data)?.data?.Media || null);
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  }

  /**
   * Look up rich online metadata (Episode Title, Show Name, Year, Studio/Creator, Plot Synopsis)
   * using TVMaze, AniList GraphQL, and iTunes Movie APIs without requiring an API key.
   */
  async lookupOnlineMetadata({ show = '', season = '', episode = '', title = '', year = '', filePath = null } = {}) {
    const ctx = this._parseSearchContext(show || title, filePath, { show, season, episode });
    const searchName = (ctx.show || show || title || '').trim();
    if (!searchName) {
      return { success: false, found: false, error: 'No show or media title provided for online metadata lookup.' };
    }

    const epNum = ctx.episode !== null ? ctx.episode : (episode ? parseInt(episode, 10) : null);
    const sNum = ctx.season || (season ? parseInt(season, 10) : 1);

    try {
      const queries = [
        this._fetchJsonHttps(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(searchName)}&embed=episodes`),
        this._queryAniListMetadata(searchName)
      ];
      if (epNum === null) {
        queries.push(this._fetchJsonHttps(`https://itunes.apple.com/search?term=${encodeURIComponent(searchName)}&entity=movie&limit=3`));
      }

      const [tvmaze, anilist, itunes] = await Promise.all(queries);

      // 1. Match specific episode from TVMaze embedded episode list
      let matchedEp = null;
      const episodes = tvmaze?._embedded?.episodes || [];
      if (epNum !== null && episodes.length > 0) {
        matchedEp = episodes.find((e) => e.season === sNum && e.number === epNum)
          || episodes.find((e) => e.number === epNum)
          || (epNum > 0 && epNum <= episodes.length ? episodes[epNum - 1] : null);
      }

      // 2. Build Studio / Network / Creator string
      const studioParts = [];
      if (anilist?.studios?.nodes?.length) {
        for (const node of anilist.studios.nodes) {
          if (node?.name && !studioParts.includes(node.name)) {
            studioParts.push(node.name);
          }
        }
      }
      const networkName = tvmaze?.network?.name || tvmaze?.webChannel?.name;
      if (networkName && !studioParts.some((s) => s.toLowerCase() === networkName.toLowerCase())) {
        studioParts.push(networkName);
      }

      const movieTrack = itunes?.results?.[0] || null;
      if (!studioParts.length && movieTrack?.artistName) {
        studioParts.push(movieTrack.artistName);
      }

      // 3. Resolve fields
      const resolvedShow = tvmaze?.name || anilist?.title?.english || anilist?.title?.romaji || (epNum !== null ? searchName : '');
      const resolvedTitle = matchedEp?.name
        || (epNum === null ? (movieTrack?.trackName || tvmaze?.name || anilist?.title?.english || title || searchName) : (title || `${resolvedShow} - Episode ${String(epNum).padStart(2, '0')}`));

      // Note: TVMaze sometimes uses 4-digit broadcast year (e.g. 2004) as e.season for long-running anime
      const resolvedSeason = epNum !== null
        ? ((matchedEp?.season && matchedEp.season < 100) ? String(matchedEp.season) : String(sNum || 1))
        : '';
      const resolvedEpisode = epNum !== null ? String(epNum) : '';

      const resolvedYear = (matchedEp?.airdate || tvmaze?.premiered || movieTrack?.releaseDate || '')?.slice(0, 4)
        || (anilist?.startDate?.year ? String(anilist.startDate.year) : '')
        || year
        || '';

      const resolvedArtist = studioParts.join(' / ');
      const rawSynopsis = matchedEp?.summary
        || (epNum === null && (movieTrack?.longDescription || movieTrack?.shortDescription))
        || tvmaze?.summary
        || anilist?.description
        || '';
      const resolvedDescription = this._stripHtmlSynopsis(rawSynopsis);

      const foundAny = Boolean(matchedEp || tvmaze || anilist || movieTrack);

      return {
        success: true,
        ok: true,
        found: foundAny,
        metadata: {
          title: resolvedTitle,
          show: resolvedShow,
          season: resolvedSeason,
          episode: resolvedEpisode,
          year: resolvedYear,
          artist: resolvedArtist,
          description: resolvedDescription
        }
      };
    } catch (err) {
      logger.debug('Online metadata lookup notice:', err.message);
      return { success: false, found: false, error: err.message };
    }
  }

  /**
   * Sanitize a subtitle filename for saving into Downloads\CopyCat\Subtitles
   */
  _sanitizeSubFileName(rawName, fallbackExt = '.srt') {
    if (!rawName || typeof rawName !== 'string') {
      return `subtitle_${Date.now()}${fallbackExt}`;
    }
    let clean = rawName
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.\s]+$/, '');
    const ext = path.extname(clean).toLowerCase();
    if (!['.srt', '.ass', '.ssa', '.vtt', '.sub'].includes(ext)) {
      clean += fallbackExt;
    }
    return clean || `subtitle_${Date.now()}${fallbackExt}`;
  }

  /**
   * Download online subtitle file and gunzip if needed.
   * - When opts.saveToDownloads is true: saves to Downloads\CopyCat\Subtitles\<fileName>
   * - When opts.temporary is true (default for staging): cleans previous staged temp files,
   *   stages in Temp, and tracks for automatic cleanup after embedding or app exit.
   */
  async downloadSubtitle(downloadUrl, targetOrOpts = null) {
    if (!downloadUrl) throw new Error('Download URL required.');

    let outPath = null;
    let isTemp = false;

    if (typeof targetOrOpts === 'string' && targetOrOpts.trim()) {
      outPath = targetOrOpts.trim();
      isTemp = this._isTempSubFile(outPath);
    } else {
      const opts = (targetOrOpts && typeof targetOrOpts === 'object') ? targetOrOpts : {};
      const extMatch = String(opts.fileName || '').match(/\.(srt|ass|ssa|vtt|sub)$/i);
      const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.srt';

      if (opts.targetPath) {
        outPath = opts.targetPath;
        isTemp = this._isTempSubFile(outPath);
      } else if (opts.saveToDownloads) {
        const subFolder = this.getSubtitlesDownloadFolder(opts.baseDownloadFolder || null);
        const safeName = this._sanitizeSubFileName(opts.fileName, ext);
        outPath = path.join(subFolder, safeName);
        isTemp = false;
      } else {
        // Temporary staging for auto-ripper / embedder: clear any previous temp subtitle first
        this.cleanupTempFiles();
        outPath = path.join(this._getTempDir(), `copycat_sub_${Date.now()}${ext}`);
        isTemp = true;
      }
    }

    return new Promise((resolve, reject) => {
      const req = https.get(downloadUrl, { headers: { 'User-Agent': 'TemporaryUserAgent' }, timeout: 10000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          req.destroy();
          return this.downloadSubtitle(res.headers.location, outPath).then(resolve).catch(reject);
        }

        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const finalizeWrite = (contentBuf) => {
            try {
              const dir = path.dirname(outPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(outPath, contentBuf);
              if (isTemp) {
                this.stagedTempFiles.add(outPath);
              }
              resolve({ success: true, ok: true, targetPath: outPath, outPath, isTemp });
            } catch (writeErr) {
              reject(writeErr);
            }
          };

          // Check if gzip compressed (magic bytes 0x1F, 0x8B)
          if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            zlib.gunzip(buf, (err, unzipped) => {
              if (err) return reject(err);
              finalizeWrite(unzipped);
            });
          } else {
            finalizeWrite(buf);
          }
        });
      });
      req.on('error', reject);
    });
  }

  /**
   * Embed subtitle file into video container (Soft subremux or Hardsub burn-in)
   */
  async embedSubtitles(options, onProgress = null) {
    let {
      inputPath,
      outputPath,
      subPath,
      lang = 'eng',
      title = 'Subtitles',
      isDefault = true,
      mode = 'soft' // 'soft' (lossless container stream) or 'burn' / 'hard' (hardsub)
    } = options;

    inputPath = String(inputPath || '').trim().replace(/^["']+|["']+$/g, '').trim();
    subPath = String(subPath || '').trim().replace(/^["']+|["']+$/g, '').trim();

    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error(`Input video does not exist: ${inputPath}`);
    }
    if (!subPath || !fs.existsSync(subPath)) {
      throw new Error(`Subtitle file does not exist: ${subPath}`);
    }

    const ffmpegPath = mediaResolver.FFMPEG_PATH;
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      throw new Error('Bundled FFmpeg executable could not be resolved.');
    }

    const ext = path.extname(inputPath).toLowerCase();
    const defaultOut = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, ext)}_subbed${ext}`
    );
    const finalOut = outputPath || defaultOut;

    const args = ['-y', '-i', inputPath];

    if (mode === 'burn' || mode === 'hard') {
      // Hardsub filter
      const escapedSub = subPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
      args.push('-vf', `subtitles='${escapedSub}'`, '-c:a', 'copy', finalOut);
    } else {
      // Soft subtitle remux
      args.push('-i', subPath, '-map', '0:v?', '-map', '0:a?', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy');
      const subExt = path.extname(subPath).toLowerCase();
      if (ext === '.mp4' || ext === '.m4v' || ext === '.mov') {
        args.push('-c:s', 'mov_text');
      } else if (ext === '.webm') {
        args.push('-c:s', 'webvtt');
      } else if (subExt === '.ass' || subExt === '.ssa') {
        args.push('-c:s', 'ass');
      } else {
        args.push('-c:s', 'subrip');
      }
      args.push(
        '-metadata:s:s:0', `language=${lang}`,
        '-metadata:s:s:0', `title=${title}`
      );
      if (isDefault) {
        args.push('-disposition:s:0', 'default');
      }
      if (ext === '.mp4' || ext === '.m4v') {
        args.push('-movflags', '+faststart');
      }
      args.push(finalOut);
    }

    const jobId = options.jobId || `embed_${Date.now()}`;
    logger.info(`Embedding subtitles [${jobId}]: ${subPath} into ${inputPath} -> ${finalOut} (${mode})`);

    return new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      this.activeJobs.set(jobId, child);

      let lastStderr = '';
      child.stderr.on('data', (d) => { lastStderr += d.toString(); });
      child.on('error', (err) => {
        this.activeJobs.delete(jobId);
        reject(err);
      });

      child.on('close', (code) => {
        this.activeJobs.delete(jobId);
        if (code === 0 && fs.existsSync(finalOut)) {
          // Automatically remove temporary staged subtitle file once embedding succeeds
          const cleanedTemp = this._isTempSubFile(subPath);
          if (cleanedTemp) {
            this.cleanupTempFiles(subPath);
          }
          resolve({ success: true, ok: true, jobId, outputPath: finalOut, cleanedTemp });
        } else {
          reject(new Error(lastStderr.trim() || `FFmpeg subtitle embed failed with code ${code}`));
        }
      });
    });
  }
}

const mediaEditorInstance = new MediaEditor();

module.exports = {
  MediaEditor,
  mediaEditor: mediaEditorInstance
};
