// src/main/media-editor.js
// Dedicated Media Tools Service: Video Converter, Subtitle Lookup & Embedder, Container Metadata Editor
// Uses bundled FFmpeg & FFprobe executables for fast, local, offline-first media processing.

const fs = require('fs');
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
      if (tags.description) args.push('-metadata', `description=${tags.description}`, '-metadata', `comment=${tags.description}`);
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
    if (/(?:^|[._ -])(de|ger|deutsch|german)(?:[._ -]|$)/i.test(f)) return 'ger';
    if (/(?:^|[._ -])(en|eng|english)(?:[._ -]|$)/i.test(f)) return 'eng';
    if (/(?:^|[._ -])(es|spa|spanish|espanol)(?:[._ -]|$)/i.test(f)) return 'spa';
    if (/(?:^|[._ -])(fr|fre|fra|french|francais)(?:[._ -]|$)/i.test(f)) return 'fre';
    if (/(?:^|[._ -])(it|ita|italian|italiano)(?:[._ -]|$)/i.test(f)) return 'ita';
    return 'eng';
  }

  /**
   * Search for companion subtitles locally and via online OpenSubtitles REST API
   */
  async searchSubtitles({ query, lang = 'eng', filePath = null }) {
    const localResults = [];
    const onlineResults = [];

    // 1. Search local folder companion files if filePath is provided
    if (filePath && fs.existsSync(filePath)) {
      try {
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath)).toLowerCase();
        const files = fs.readdirSync(dir);

        for (const f of files) {
          const ext = path.extname(f).toLowerCase();
          if (['.srt', '.vtt', '.ass', '.sub'].includes(ext)) {
            const fLower = f.toLowerCase();
            if (fLower.includes(baseName) || baseName.includes(path.basename(f, ext).toLowerCase())) {
              localResults.push({
                id: `local_${localResults.length}`,
                source: 'local',
                title: f,
                fileName: f,
                filePath: path.join(dir, f),
                localPath: path.join(dir, f),
                lang: this._detectSubtitleLanguage(f),
                format: ext.replace('.', '').toUpperCase(),
                downloadUrl: null
              });
            }
          }
        }
      } catch (err) {
        logger.debug('Local subtitle search notice:', err.message);
      }
    }

    // 2. Search OpenSubtitles REST API
    const searchQuery = query || (filePath ? path.basename(filePath, path.extname(filePath)).replace(/[-_.]+/g, ' ') : '');
    if (searchQuery && searchQuery.trim().length > 1) {
      try {
        const subLang = lang === 'hu' ? 'hun' : (lang === 'de' ? 'ger' : (lang === 'ja' ? 'jpn' : lang));
        const qTrim = searchQuery.trim();
        const queriesToRun = [qTrim];

        if (filePath) {
          const rawBase = path.basename(filePath, path.extname(filePath)).replace(/[-_.]+/g, ' ').trim();
          if (rawBase && rawBase.toLowerCase() !== qTrim.toLowerCase()) {
            queriesToRun.unshift(rawBase);
          }
        }

        const seenIds = new Set();
        for (const q of queriesToRun) {
          const osList = await this._queryOpenSubtitles(q, subLang);
          for (const item of osList) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              onlineResults.push(item);
            }
          }
        }
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
    return new Promise((resolve) => {
      const url = `https://rest.opensubtitles.org/search/query-${encodeURIComponent(query)}/sublanguageid-${lang}`;
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
                const mapped = list.slice(0, 15).map((item, idx) => ({
                  id: item.IDSubtitleFile || `os_${idx}`,
                  source: 'opensubtitles',
                  title: item.SubFileName || item.MovieName || `Subtitle ${idx + 1}`,
                  fileName: item.SubFileName || `sub_${idx + 1}.srt`,
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
   * Download online subtitle file and gunzip if needed
   */
  async downloadSubtitle(downloadUrl, targetPath) {
    if (!downloadUrl) throw new Error('Download URL required.');
    const outPath = targetPath || path.join(
      process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp',
      `copycat_sub_${Date.now()}.srt`
    );

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
          // Check if gzip compressed (magic bytes 0x1F, 0x8B)
          if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            zlib.gunzip(buf, (err, unzipped) => {
              if (err) return reject(err);
              fs.writeFileSync(outPath, unzipped);
              resolve({ success: true, ok: true, targetPath: outPath, outPath });
            });
          } else {
            fs.writeFileSync(outPath, buf);
            resolve({ success: true, ok: true, targetPath: outPath, outPath });
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
    const {
      inputPath,
      outputPath,
      subPath,
      lang = 'eng',
      title = 'Subtitles',
      isDefault = true,
      mode = 'soft' // 'soft' (lossless container stream) or 'burn' (hardsub)
    } = options;

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

    if (mode === 'burn') {
      // Hardsub filter
      const escapedSub = subPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      args.push('-vf', `subtitles='${escapedSub}'`, '-c:a', 'copy', finalOut);
    } else {
      // Soft subtitle remux
      args.push('-i', subPath, '-map', '0', '-map', '1:0', '-c', 'copy');
      if (ext === '.mp4' || ext === '.m4v') {
        args.push('-c:s', 'mov_text');
      } else {
        args.push('-c:s', 'subrip');
      }
      args.push(
        '-metadata:s:s:0', `language=${lang}`,
        '-metadata:s:s:0', `title=${title}`
      );
      if (isDefault) {
        args.push('-disposition:s:s:0', 'default');
      }
      if (ext === '.mp4') {
        args.push('-movflags', '+faststart');
      }
      args.push(finalOut);
    }

    const jobId = `embed_${Date.now()}`;
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
          resolve({ success: true, ok: true, jobId, outputPath: finalOut });
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
