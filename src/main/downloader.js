// src/main/downloader.js
// Standalone Native Stream & Video Downloader Service for CopyCat Media Player
// Zero External Dependencies: Uses native Node.js HTTPS segment fetcher + bundled FFmpeg muxer.

const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const { app, dialog, shell } = require('electron');
const { createLogger } = require('./logger');
const mediaResolver = require('./media-resolver');
const animeSkipResolver = require('./anime-skip-resolver');
const { extractStreamFromWebpage, getRequiredHeadersForUrl } = require('./stream-sniffer');

const logger = createLogger('Downloader');

const httpsKeepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 16, keepAliveMsecs: 15000 });
const httpKeepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 16, keepAliveMsecs: 15000 });

/**
 * Strip language and dub/sub/audio indicators from titles, filenames, and folder names
 * Example: "Series Name - Episode 1 (English)" -> "Series Name - Episode 1"
 */
function stripLanguageTags(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\s*[\(\[]\s*(?:English(?:\s*(?:Dub|Sub))?|Japanese(?:\s*(?:Original|Sub))?|Dual(?:\s*Audio)?|Dub|Sub|Eng|Jpn|Jap|Original)\s*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Format episode numbers in titles and filenames with at least two digits (e.g. Episode 01, 02)
 * Handles: "Episode 1" -> "Episode 01", "Ep 2" -> "Ep 02", "Ep. 3" -> "Ep. 03", "E4" -> "E04", " - 5" -> " - 05"
 */
function formatDoubleDigitEpisode(str) {
  if (!str || typeof str !== 'string') return '';
  let result = str.replace(/(\b(?:Episode|Ep\.?|E)\s*[-_]?\s*)(\d+)\b/gi, (match, prefix, num) => {
    return prefix + (num.length === 1 ? `0${num}` : num);
  });
  result = result.replace(/(\s*[-–—]\s*)(\d+)(\s*)$/, (match, prefix, num, suffix) => {
    return prefix + (num.length === 1 ? `0${num}` : num) + suffix;
  });
  return result;
}

/**
 * Sanitize filename for safe Windows NTFS storage
 */
function sanitizeFilename(name) {
  let clean = formatDoubleDigitEpisode(stripLanguageTags(name || 'video'))
    .replace(/^Watch\s+/i, '')
    .replace(/\s*[-–—|·]\s*(Miruro|Watch Online|Full HD).*$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  return formatDoubleDigitEpisode(clean.slice(0, 180)) || (`video_${Date.now()}`);
}

/**
 * Convert seconds into HH:MM:SS or MM:SS format
 */
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

/**
 * Format bytes into human readable string
 */
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

/**
 * Parse FFmpeg timestamp string (HH:MM:SS.ss) into seconds
 */
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

/**
 * Build standard request headers for stream CDNs (uses dynamic host header registry + strm.cx pattern matching)
 */
function getStreamHeaders(targetUrl, customHeaders = {}) {
  return getRequiredHeadersForUrl(targetUrl, customHeaders);
}

function normalizeIsoLang(lang, fallbackName = '') {
  const l = (lang || '').toLowerCase().trim();
  const n = (fallbackName || '').toLowerCase().trim();
  if (/^ja/i.test(l) || /japanese|jpn/i.test(n)) return 'jpn';
  if (/^en/i.test(l) || /english|eng/i.test(n)) return 'eng';
  if (/^(in|id)/i.test(l) || /indonesian|indo/i.test(n)) return 'ind';
  if (/^th/i.test(l) || /thai/i.test(n)) return 'tha';
  if (/^(de|ger)/i.test(l) || /german|deutsch/i.test(n)) return 'ger';
  if (/^(es|spa)/i.test(l) || /spanish|espanol/i.test(n)) return 'spa';
  if (/^(fr|fra|fre)/i.test(l) || /french|francais/i.test(n)) return 'fra';
  if (/^(it|ita)/i.test(l) || /italian/i.test(n)) return 'ita';
  if (/^(ko|kor)/i.test(l) || /korean/i.test(n)) return 'kor';
  if (/^(zh|chi|zho)/i.test(l) || /chinese/i.test(n)) return 'chi';
  if (/^(pt|por)/i.test(l) || /portuguese/i.test(n)) return 'por';
  if (/^(ru|rus)/i.test(l) || /russian/i.test(n)) return 'rus';
  if (/^(ar|ara)/i.test(l) || /arabic/i.test(n)) return 'ara';
  if (/^(vi|vie)/i.test(l) || /vietnamese/i.test(n)) return 'vie';
  return l.length === 3 ? l : (l || 'und');
}

/**
 * Parse episode number, padding, and surrounding pattern from a streaming/webpage URL
 */
function parseEpisodeFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const patterns = [
    { regex: /([?&](?:ep|episode|e)=)(\d+)/i, type: 'query' },
    { regex: /((?:[/-]|^)(?:episode|ep)[/-])(\d+)/i, type: 'slug' },
    { regex: /((?:[/-]|^)e)(\d+)(?=[/-]|\.|$)/i, type: 'short' },
    { regex: /([-_.])(\d+)(?=(?:\.[a-z0-9]+|\/)?$)/i, type: 'tail' }
  ];
  for (const { regex, type } of patterns) {
    const m = url.match(regex);
    if (m) {
      return {
        prefix: m[1],
        numStr: m[2],
        num: parseInt(m[2], 10),
        padLength: m[2].length,
        index: m.index,
        fullMatch: m[0],
        type
      };
    }
  }
  return null;
}

/**
 * Increment episode number in URL, preserving zero-padding
 */
function incrementEpisodeUrl(url, step = 1) {
  const info = parseEpisodeFromUrl(url);
  if (!info) return null;
  const nextNum = Math.max(1, info.num + step);
  const nextNumStr = String(nextNum).padStart(info.padLength, '0');
  const replacement = info.prefix + nextNumStr;
  return url.replace(info.fullMatch, replacement);
}

/**
 * Replace episode number in URL with a target number, preserving padding
 */
function replaceEpisodeInUrl(url, targetNum) {
  const info = parseEpisodeFromUrl(url);
  if (!info) return url;
  const numStr = String(targetNum).padStart(info.padLength, '0');
  const replacement = info.prefix + numStr;
  return url.replace(info.fullMatch, replacement);
}

/**
 * Extract a reasonable Series Title guess from URL path or user filename
 */
function extractSeriesTitleGuess(url, rawTitle = '') {
  if (rawTitle && rawTitle.trim()) {
    let clean = stripLanguageTags(rawTitle.trim())
      .replace(/\s*[-_]\s*episode\s*\d+/i, '')
      .replace(/\s*[-_]\s*ep\s*\d+/i, '')
      .replace(/\s*E\d+\b/i, '')
      .trim();
    if (clean) return clean;
  }
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    for (let i = pathParts.length - 1; i >= 0; i--) {
      let segment = pathParts[i]
        .replace(/\.(html|php|mp4|m3u8)$/i, '')
        .replace(/[-_]?(?:episode|ep)[-_]?\d+/i, '')
        .replace(/[-_]?e\d+/i, '')
        .replace(/[-_]\d+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (segment && !/^(watch|video|play|anime|stream)$/i.test(segment)) {
        segment = stripLanguageTags(segment);
        return segment.replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  } catch {}
  return 'Anime Series';
}

/**
 * Core Download Manager Class
 */
class DownloadManager {
  constructor({ windowManager } = {}) {
    this.windowManager = windowManager;
    this.activeProcesses = new Map(); // id -> childProcess
    this.activeControllers = new Map(); // id -> { cancelled: boolean }
    this.queue = []; // array of task items
    this.history = [];
    this.seasonBacklog = []; // Backlog of season episodes waiting for sliding window
    this.activeTaskId = null; // Currently executing task id
    this._isProcessingQueue = false;
    const baseDownloads = app && typeof app.getPath === 'function'
      ? app.getPath('downloads')
      : path.join(os.homedir(), 'Downloads');
    this.downloadFolder = path.join(baseDownloads, 'CopyCat');
    this.ensureFolder(this.downloadFolder);
  }

  ensureFolder(dir) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.optimizeFolderView(dir);
    } catch (err) {
      logger.error('Failed to create download folder:', err.message);
    }
  }

  /**
   * Configure Windows Explorer view for downloads and season folders:
   * Sets folder template to 'Videos', displays items as Large Icons (big symbols),
   * sorts ascending by item name, and removes date grouping.
   */
  optimizeFolderView(folderPath, updateOpenExplorer = false) {
    if (!folderPath || typeof folderPath !== 'string') return;
    try {
      const resolved = path.resolve(folderPath);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }

      if (process.platform === 'win32') {
        const iniPath = path.join(resolved, 'desktop.ini');
        let needsWrite = true;
        try {
          if (fs.existsSync(iniPath)) {
            const existing = fs.readFileSync(iniPath, 'utf8');
            if (existing.includes('FolderType=Videos') && existing.includes('Mode=1')) {
              needsWrite = false;
            }
          }
        } catch {}

        if (needsWrite) {
          const content = '[.ShellClassInfo]\r\nConfirmFileOp=0\r\n[ViewState]\r\nMode=1\r\nVid=\r\nFolderType=Videos\r\n';
          try {
            fs.writeFileSync(iniPath, content, 'utf8');
            exec(`attrib +h +s "${iniPath}" & attrib +r "${resolved}"`, { windowsHide: true }, () => {});
          } catch (writeErr) {
            logger.debug('desktop.ini write note:', writeErr.message);
          }
        }

        const applyExplorerView = () => {
          try {
            const escaped = resolved.replace(/'/g, "''");
            const psScript = `
              $ErrorActionPreference = 'SilentlyContinue'
              $target = '${escaped}'
              $shell = New-Object -ComObject Shell.Application
              foreach ($w in $shell.Windows()) {
                try {
                  if ($w.Document.Folder.Self.Path -eq $target) {
                    $w.Document.GroupBy = 'System.Null'
                    $w.Document.CurrentViewMode = 1
                    $w.Document.IconSize = 96
                    $w.Document.SortColumns = 'prop:System.ItemNameDisplay;'
                  }
                } catch {}
              }
            `;
            const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
            exec(`powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${b64}`, { windowsHide: true }, () => {});
          } catch {}
        };

        applyExplorerView();
        if (updateOpenExplorer) {
          setTimeout(applyExplorerView, 400);
          setTimeout(applyExplorerView, 1200);
        }
      }
    } catch (err) {
      logger.debug('optimizeFolderView error:', err.message);
    }
  }

  getDownloadFolder() {
    return this.downloadFolder;
  }

  setDownloadFolder(folder) {
    if (folder && typeof folder === 'string') {
      this.downloadFolder = folder.trim();
      this.ensureFolder(this.downloadFolder);
      return this.downloadFolder;
    }
    return this.downloadFolder;
  }

  async chooseDownloadFolder() {
    const win = this.windowManager?.getWindow();
    const result = await dialog.showOpenDialog(win || undefined, {
      title: 'Select CopyCat Downloads Folder',
      defaultPath: this.downloadFolder,
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      return this.setDownloadFolder(result.filePaths[0]);
    }
    return this.downloadFolder;
  }

  openDownloadFolder() {
    this.ensureFolder(this.downloadFolder);
    shell.openPath(this.downloadFolder);
    this.optimizeFolderView(this.downloadFolder, true);
  }

  /**
   * Resilient HTTP/HTTPS buffer fetcher with redirect following & HTTP 429 exponential backoff
   */
  _fetchBuffer(targetUrl, customHeaders = {}, retries = 6, maxRedirects = 5, cancelState = null) {
    return new Promise((resolve, reject) => {
      const attempt = (urlToFetch, retriesLeft, redirectsLeft) => {
        if (cancelState?.cancelled) {
          return reject(new Error('Download cancelled'));
        }
        try {
          const parsed = new URL(urlToFetch);
          const isHttp = parsed.protocol === 'http:';
          const client = isHttp ? http : https;
          const agent = isHttp ? httpKeepAliveAgent : httpsKeepAliveAgent;

          const req = client.get(urlToFetch, {
            agent,
            headers: getStreamHeaders(urlToFetch, customHeaders),
            timeout: 18000
          }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
              res.resume();
              const nextUrl = new URL(res.headers.location, urlToFetch).href;
              return attempt(nextUrl, retriesLeft, redirectsLeft - 1);
            }

            if ((res.statusCode === 429 || (res.statusCode >= 500 && res.statusCode < 600)) && retriesLeft > 0) {
              res.resume();
              const backoffMs = (7 - retriesLeft) * 1150;
              return setTimeout(() => attempt(urlToFetch, retriesLeft - 1, redirectsLeft), backoffMs);
            }

            if (res.statusCode !== 200 && res.statusCode !== 206) {
              res.resume();
              return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const chunks = [];
            res.on('data', (c) => {
              if (cancelState?.cancelled) {
                req.destroy();
                return reject(new Error('Download cancelled'));
              }
              chunks.push(c);
            });
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', (err) => {
              if (retriesLeft > 0 && !cancelState?.cancelled) {
                return setTimeout(() => attempt(urlToFetch, retriesLeft - 1, redirectsLeft), 900);
              }
              reject(err);
            });
          });

          req.on('timeout', () => {
            req.destroy();
            if (retriesLeft > 0 && !cancelState?.cancelled) {
              return setTimeout(() => attempt(urlToFetch, retriesLeft - 1, redirectsLeft), 1000);
            }
            reject(new Error('Request timeout'));
          });

          req.on('error', (err) => {
            if (retriesLeft > 0 && !cancelState?.cancelled) {
              return setTimeout(() => attempt(urlToFetch, retriesLeft - 1, redirectsLeft), 900);
            }
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
      };

      attempt(targetUrl, retries, maxRedirects);
    });
  }

  /**
   * Parse an HLS media playlist (.m3u8) into segments, duration, init map, and AES-128 key info
   */
  _parseMediaM3u8(playlistUrl, text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const segments = [];
    let durationSec = 0;
    let initUrl = null;
    let keyUrl = null;
    let keyIv = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXTINF:')) {
        const dur = parseFloat(line.replace('#EXTINF:', '')) || 0;
        durationSec += dur;
      } else if (line.startsWith('#EXT-X-MAP:')) {
        const m = line.match(/URI=["']([^"']+)["']/);
        if (m && m[1]) {
          try { initUrl = new URL(m[1], playlistUrl).href; } catch {}
        }
      } else if (line.startsWith('#EXT-X-KEY:')) {
        const methodMatch = line.match(/METHOD=([^,\s]+)/);
        if (methodMatch && methodMatch[1] === 'AES-128') {
          const uriMatch = line.match(/URI=["']([^"']+)["']/);
          if (uriMatch && uriMatch[1]) {
            try { keyUrl = new URL(uriMatch[1], playlistUrl).href; } catch {}
          }
          const ivMatch = line.match(/IV=0x([0-9a-fA-F]+)/);
          if (ivMatch && ivMatch[1]) {
            keyIv = Buffer.from(ivMatch[1].padStart(32, '0'), 'hex');
          }
        }
      } else if (!line.startsWith('#')) {
        try {
          segments.push(new URL(line, playlistUrl).href);
        } catch {}
      }
    }

    return {
      playlistUrl,
      segments,
      durationSec,
      initUrl,
      keyUrl,
      keyIv
    };
  }

  /**
   * Resolve an HLS Master or Media playlist into video variants, audio renditions, and subtitle tracks
   */
  async resolveHlsManifest(m3u8Url, customHeaders = {}, cancelState = null, options = {}) {
    const masterBuf = await this._fetchBuffer(m3u8Url, customHeaders, 4, 5, cancelState);
    const masterText = masterBuf.toString('utf8');
    const lines = masterText.split('\n').map((l) => l.trim()).filter(Boolean);

    if (masterText.includes('#EXT-X-STREAM-INF')) {
      const audioTracks = [];
      const subtitleTracks = [];
      let bestAudioUrl = null;

      for (const line of lines) {
        if (line.startsWith('#EXT-X-MEDIA:')) {
          const uriMatch = line.match(/URI=["']([^"']+)["']/);
          const nameMatch = line.match(/NAME=["']([^"']+)["']/);
          const langMatch = line.match(/LANGUAGE=["']([^"']+)["']/);
          const isDefault = /DEFAULT=YES/i.test(line);

          if (uriMatch && uriMatch[1]) {
            try {
              const candidateUrl = new URL(uriMatch[1], m3u8Url).href;
              if (line.includes('TYPE=AUDIO')) {
                let trackName = (nameMatch && nameMatch[1]) || (langMatch && langMatch[1]) || `Audio ${audioTracks.length + 1}`;
                const trackLang = (langMatch && langMatch[1]) || 'und';
                if (/japanese|ja-jp|jpn/i.test(trackName) || /^ja/i.test(trackLang)) {
                  trackName = 'Japanese';
                } else if (/english|en-us|eng/i.test(trackName) || /^en/i.test(trackLang)) {
                  trackName = 'English';
                } else {
                  trackName = trackName.replace(/\s*\([^)]*\)/g, '').trim() || trackName;
                }
                audioTracks.push({
                  id: String(audioTracks.length),
                  name: trackName,
                  lang: trackLang,
                  isDefault,
                  url: candidateUrl
                });
                if (!bestAudioUrl || isDefault) {
                  bestAudioUrl = candidateUrl;
                }
              } else if (line.includes('TYPE=SUBTITLES')) {
                const subName = (nameMatch && nameMatch[1]) || (langMatch && langMatch[1]) || `Subtitles ${subtitleTracks.length + 1}`;
                const subLang = (langMatch && langMatch[1]) || 'und';
                subtitleTracks.push({
                  id: String(subtitleTracks.length),
                  label: subName,
                  lang: subLang,
                  url: candidateUrl
                });
              }
            } catch {}
          }
        }
      }

      const videoVariants = [];
      let bestVideoUrl = null;
      let maxBw = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
          const resMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
          const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
          const resolution = resMatch ? resMatch[1] : '';
          const height = resolution ? parseInt(resolution.split('x')[1], 10) || 0 : 0;

          for (let j = i + 1; j < lines.length; j++) {
            if (!lines[j].startsWith('#')) {
              try {
                const variantUrl = new URL(lines[j], m3u8Url).href;
                const mbps = bw > 0 ? `${(bw / 1000000).toFixed(1)} Mbps` : '';
                const label = height > 0
                  ? `${height}p (${resolution})${mbps ? ` • ${mbps}` : ''}`
                  : (mbps || `Variant ${videoVariants.length + 1}`);
                videoVariants.push({
                  id: String(videoVariants.length),
                  label,
                  resolution,
                  height,
                  bandwidth: bw,
                  url: variantUrl
                });
                if (bw > maxBw || !bestVideoUrl) {
                  maxBw = bw;
                  bestVideoUrl = variantUrl;
                }
              } catch {}
              break;
            }
          }
        }
      }

      videoVariants.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));

      // Validate that user-selected variant URLs actually belong to this master playlist
      let targetVideoUrl = bestVideoUrl || m3u8Url;
      if (options.selectedVideoUrl && videoVariants.some((v) => v.url === options.selectedVideoUrl)) {
        targetVideoUrl = options.selectedVideoUrl;
      }

      let targetAudioUrl = bestAudioUrl;
      if (options.selectedAudioUrl && audioTracks.some((a) => a.url === options.selectedAudioUrl)) {
        targetAudioUrl = options.selectedAudioUrl;
      } else if (options.audioPreference) {
        if (/eng|dub/i.test(options.audioPreference)) {
          const engTrack = audioTracks.find((a) => /english|en/i.test(a.name || '') || /^en/i.test(a.lang || ''));
          if (engTrack) targetAudioUrl = engTrack.url;
        } else if (/jpn|jap/i.test(options.audioPreference)) {
          const jpnTrack = audioTracks.find((a) => /japanese|ja/i.test(a.name || '') || /^ja/i.test(a.lang || ''));
          if (jpnTrack) targetAudioUrl = jpnTrack.url;
        }
      }

      const videoBuf = await this._fetchBuffer(targetVideoUrl, customHeaders, 4, 5, cancelState);
      const videoPlaylist = this._parseMediaM3u8(targetVideoUrl, videoBuf.toString('utf8'));

      let audioPlaylist = null;
      const allAudioPlaylists = [];

      if (options.dualAudio && audioTracks.length > 1) {
        for (const aTrack of audioTracks) {
          if (aTrack.url && aTrack.url !== targetVideoUrl) {
            try {
              const aBuf = await this._fetchBuffer(aTrack.url, customHeaders, 4, 5, cancelState);
              const parsedA = this._parseMediaM3u8(aTrack.url, aBuf.toString('utf8'));
              parsedA.name = aTrack.name;
              parsedA.lang = aTrack.lang;
              allAudioPlaylists.push(parsedA);
              if (!audioPlaylist) audioPlaylist = parsedA;
            } catch (err) {
              logger.warn(`Failed to fetch audio track ${aTrack.name}:`, err.message);
            }
          }
        }
      } else if (targetAudioUrl && targetAudioUrl !== targetVideoUrl) {
        try {
          const audioBuf = await this._fetchBuffer(targetAudioUrl, customHeaders, 4, 5, cancelState);
          audioPlaylist = this._parseMediaM3u8(targetAudioUrl, audioBuf.toString('utf8'));
          const matchedTrack = audioTracks.find((t) => t.url === targetAudioUrl);
          if (matchedTrack) {
            audioPlaylist.name = matchedTrack.name;
            audioPlaylist.lang = matchedTrack.lang;
          }
          allAudioPlaylists.push(audioPlaylist);
        } catch (err) {
          logger.warn('Failed to fetch separate audio playlist:', err.message);
        }
      }

      return {
        isMaster: true,
        masterUrl: m3u8Url,
        videoUrl: targetVideoUrl,
        audioUrl: audioPlaylist ? targetAudioUrl : null,
        durationSec: videoPlaylist.durationSec || audioPlaylist?.durationSec || 0,
        videoVariants,
        audioTracks,
        subtitleTracks,
        videoPlaylist,
        audioPlaylist,
        allAudioPlaylists
      };
    }

    const videoPlaylist = this._parseMediaM3u8(m3u8Url, masterText);
    return {
      isMaster: false,
      masterUrl: m3u8Url,
      videoUrl: m3u8Url,
      audioUrl: null,
      durationSec: videoPlaylist.durationSec || 0,
      videoVariants: [{ id: '0', label: 'Default Stream', resolution: '', height: 0, bandwidth: 0, url: m3u8Url }],
      audioTracks: [],
      subtitleTracks: [],
      videoPlaylist,
      audioPlaylist: null,
      allAudioPlaylists: []
    };
  }

  /**
   * Download and prepare subtitle track into a clean WebVTT file
   * Handles direct .vtt/.srt files and HLS multi-segment subtitle playlists (.m3u8)
   */
  async _downloadSubtitleTrack(sub, outVttPath, customHeaders = {}, cancelState = null) {
    if (!sub) return false;
    if (sub.content && typeof sub.content === 'string' && sub.content.length > 10) {
      await fs.promises.writeFile(outVttPath, sub.content, 'utf8');
      return true;
    }
    if (!sub.url || sub.url.startsWith('blob:')) return false;
    try {
      const subBuf = await this._fetchBuffer(sub.url, customHeaders, 5, 5, cancelState);
      const subText = subBuf.toString('utf8');
      const cleanText = subText.replace(/^\uFEFF/, '').trim();

      // Check if it is already direct WebVTT or SRT text
      if (cleanText.startsWith('WEBVTT') || /^\d+\r?\n\d\d:\d\d:/m.test(cleanText) || cleanText.includes('-->')) {
        let vttOut = cleanText;
        if (!vttOut.startsWith('WEBVTT')) {
          vttOut = `WEBVTT\n\n${vttOut}`;
        }
        await fs.promises.writeFile(outVttPath, vttOut, 'utf8');
        return true;
      }

      // Check for JSON timed text / cues format
      if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
        try {
          const parsed = JSON.parse(cleanText);
          const cues = parsed.cues || parsed.events || (Array.isArray(parsed) ? parsed : null);
          if (Array.isArray(cues) && cues.length > 0) {
            const fmtTime = (sec) => {
              const h = Math.floor(sec / 3600);
              const m = Math.floor((sec % 3600) / 60);
              const sSec = Math.floor(sec % 60);
              const ms = Math.floor((sec % 1) * 1000);
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sSec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
            };
            let vtt = 'WEBVTT\n\n';
            for (const c of cues) {
              const s = typeof c.start === 'number' ? c.start : (c.startTime || 0);
              const e = typeof c.end === 'number' ? c.end : (c.endTime || s + 3);
              const txt = c.text || c.content || (c.segs ? c.segs.map((x) => x.utf8).join('') : '');
              if (txt) {
                vtt += `${fmtTime(s)} --> ${fmtTime(e)}\n${txt}\n\n`;
              }
            }
            await fs.promises.writeFile(outVttPath, vtt, 'utf8');
            return true;
          }
        } catch {}
      }

      // If it's an HLS subtitle playlist (#EXTM3U)
      if (subText.includes('#EXTM3U')) {
        const lines = subText.split('\n').map((l) => l.trim()).filter(Boolean);
        const segmentUrls = [];
        for (const line of lines) {
          if (!line.startsWith('#')) {
            try {
              segmentUrls.push(new URL(line, sub.url).href);
            } catch {
              segmentUrls.push(line);
            }
          }
        }

        if (segmentUrls.length === 0) return false;

        const vttChunks = [];
        for (const segUrl of segmentUrls) {
          if (cancelState?.cancelled) return false;
          try {
            const chunkBuf = await this._fetchBuffer(segUrl, customHeaders, 4, 3, cancelState);
            vttChunks.push(chunkBuf.toString('utf8'));
          } catch (err) {
            logger.debug('Failed to fetch subtitle segment:', err.message);
          }
        }

        if (vttChunks.length === 0) return false;

        // Merge WebVTT chunks into a single valid WebVTT document
        let mergedVtt = 'WEBVTT\n\n';
        for (const chunk of vttChunks) {
          const cleaned = chunk
            .replace(/^\uFEFF?WEBVTT[^\r\n]*\r?\n+/i, '')
            .replace(/^X-TIMESTAMP-MAP[^\r\n]*\r?\n+/im, '')
            .trim();
          if (cleaned) {
            mergedVtt += cleaned + '\n\n';
          }
        }

        await fs.promises.writeFile(outVttPath, mergedVtt, 'utf8');
        return true;
      }

      // Fallback: write buffer directly
      await fs.promises.writeFile(outVttPath, subBuf);
      return true;
    } catch (err) {
      logger.warn('Failed to download subtitle track:', sub.label || sub.url, err.message);
      return false;
    }
  }

  /**
   * Fast probe of stream URL headers & metadata with automatic redirect following & webpage sniffing
   */
  async probeUrl(rawUrl, maxRedirects = 5) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('Invalid URL provided.');
    }

    const trimmed = rawUrl.trim();
    let isHls = false;
    let isDash = false;
    let contentType = '';
    let contentLength = 0;
    let derivedTitle = 'Stream Video';

    try {
      const parsed = new URL(trimmed);
      const lower = parsed.pathname.toLowerCase();
      if (lower.includes('.m3u8') || lower.includes('/m/')) isHls = true;
      if (lower.includes('.mpd')) isDash = true;

      const segments = parsed.pathname.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1] || '';
      if (lastSeg && !lastSeg.includes('master') && !lastSeg.includes('index') && lastSeg.length < 65) {
        const epParam = parsed.searchParams.get('ep');
        const baseName = lastSeg.replace(/\.(m3u8|mpd|mp4|webm|mkv|ts)$/i, '').replace(/-/g, ' ');
        const epFormatted = epParam ? (epParam.length === 1 ? `0${epParam}` : epParam) : null;
        derivedTitle = sanitizeFilename(epFormatted ? `${baseName} - Episode ${epFormatted}` : baseName);
      }
    } catch {
      throw new Error('Malformed stream URL.');
    }

    const enrichHlsProbe = async (baseResult, sniffedExtra = null) => {
      if (!baseResult.isHls) return baseResult;
      try {
        const manifest = await this.resolveHlsManifest(baseResult.url);
        let audioTracks = Array.isArray(manifest.audioTracks) ? [...manifest.audioTracks] : [];

        // If the webpage sniffer discovered a verified alternate Dub/Sub language stream
        if (
          sniffedExtra &&
          sniffedExtra.dubStreamUrl &&
          sniffedExtra.dubStreamUrl !== baseResult.url &&
          sniffedExtra.dubStreamUrl !== sniffedExtra.subStreamUrl
        ) {
          try {
            const dubManifest = await this.resolveHlsManifest(sniffedExtra.dubStreamUrl);
            const dubAudioTrack = dubManifest.audioTracks?.[0] || {
              id: 'dub',
              name: 'English',
              lang: 'en-US',
              url: dubManifest.audioUrl || sniffedExtra.dubStreamUrl,
              streamUrl: sniffedExtra.dubStreamUrl
            };
            dubAudioTrack.name = 'English';
            dubAudioTrack.streamUrl = sniffedExtra.dubStreamUrl;

            const hasEnglishTrack = audioTracks.some((a) => /english|en/i.test(a.name || '') || /en/i.test(a.lang || ''));
            if (!hasEnglishTrack) {
              const subAudioTrack = audioTracks[0] || {
                id: 'sub',
                name: 'Japanese',
                lang: 'ja-JP',
                isDefault: true,
                url: manifest.audioUrl || sniffedExtra.subStreamUrl || baseResult.url,
                streamUrl: sniffedExtra.subStreamUrl || baseResult.url
              };
              subAudioTrack.name = 'Japanese';
              subAudioTrack.streamUrl = sniffedExtra.subStreamUrl || baseResult.url;

              if (audioTracks.length <= 1) {
                audioTracks = [subAudioTrack, dubAudioTrack];
              } else {
                audioTracks.push(dubAudioTrack);
              }
            }
          } catch (err) {
            logger.debug('Dub stream manifest enrichment notice:', err.message);
          }
        }

        // If no explicit audio tracks were enumerated in manifest (e.g. single-stream TS with multiplexed audio)
        if (audioTracks.length === 0) {
          const titleCandidate = baseResult.title || derivedTitle || '';
          const isAnimeCandidate = animeSkipResolver.parseAnimeTitleAndEpisode(titleCandidate) || /(?:\[.*?\]|\b(?:ep(?:isode)?\.?\s*\d+|s\d+\s*e\d+|season\s*\d+|owarimonogatari|monogatari|naruto|piece|bleach|jujutsu|frieren|knight)\b)/i.test(titleCandidate) || (Array.isArray(baseResult.subtitles) && baseResult.subtitles.length > 0);
          const isDub = /dub/i.test(titleCandidate);
          if (isAnimeCandidate) {
            audioTracks.push({
              id: 'single_audio_0',
              name: isDub ? 'English (Dub)' : 'Japanese',
              lang: isDub ? 'eng' : 'jpn',
              isDefault: true,
              url: baseResult.url
            });
          }
        }

        const totalSegs = (manifest.videoPlaylist?.segments?.length || 0) + (manifest.audioPlaylist?.segments?.length || 0);
        const mergedSubtitles = [];
        const seenSubUrls = new Set();
        for (const s of [...(manifest.subtitleTracks || []), ...(baseResult.subtitles || [])]) {
          if (s && s.url && !seenSubUrls.has(s.url)) {
            seenSubUrls.add(s.url);
            mergedSubtitles.push(s);
          }
        }
        return {
          ...baseResult,
          masterUrl: manifest.masterUrl,
          videoUrl: manifest.videoUrl,
          audioUrl: manifest.audioUrl,
          videoVariants: manifest.videoVariants || [],
          audioTracks: audioTracks,
          subStreamUrl: sniffedExtra?.subStreamUrl || null,
          dubStreamUrl: sniffedExtra?.dubStreamUrl || null,
          subtitles: mergedSubtitles,
          durationSec: manifest.durationSec,
          durationFormatted: formatDuration(manifest.durationSec),
          segmentCount: totalSegs,
          sizeFormatted: manifest.durationSec > 0 ? `${formatDuration(manifest.durationSec)} (${totalSegs} segs)` : 'HLS Stream'
        };
      } catch {
        return baseResult;
      }
    };

    const fetchHeaders = (targetUrl, redirectsRemaining) => {
      return new Promise((resolve) => {
        try {
          const parsed = new URL(targetUrl);
          const client = parsed.protocol === 'http:' ? http : https;
          const req = client.request(targetUrl, {
            method: 'GET',
            headers: {
              ...getStreamHeaders(targetUrl),
              'Range': 'bytes=0-1024'
            },
            timeout: 7000
          }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsRemaining > 0) {
              req.destroy();
              const nextUrl = new URL(res.headers.location, targetUrl).href;
              return resolve(fetchHeaders(nextUrl, redirectsRemaining - 1));
            }

            contentType = (res.headers['content-type'] || '').toLowerCase();
            contentLength = parseInt(res.headers['content-length'] || '0', 10);
            const disp = res.headers['content-disposition'] || '';

            if (disp && disp.includes('filename=')) {
              const m = disp.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
              if (m && m[1]) derivedTitle = sanitizeFilename(decodeURIComponent(m[1]));
            }

            if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8') || targetUrl.includes('/m/')) isHls = true;
            if (contentType.includes('dash') || targetUrl.includes('.mpd')) isDash = true;

            const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

            req.destroy();

            if (isHtml && !isHls && !isDash) {
              logger.info(`Webpage detected for ${trimmed}, attempting headless stream sniffing...`);
              extractStreamFromWebpage(trimmed, 12000).then(async (sniffed) => {
                if (sniffed && sniffed.streamUrl) {
                  logger.info(`Successfully auto-extracted stream from webpage: ${sniffed.streamUrl}`);
                  let cleanTitle = sanitizeFilename(sniffed.title || derivedTitle);
                  try {
                    const ep = new URL(trimmed).searchParams.get('ep');
                    if (ep && !/ep(isode)?\s*\d+/i.test(cleanTitle)) {
                      const epFormatted = ep.length === 1 ? `0${ep}` : ep;
                      cleanTitle = sanitizeFilename(`${cleanTitle} - Episode ${epFormatted}`);
                    }
                  } catch {}

                  const extracted = await enrichHlsProbe({
                    url: sniffed.streamUrl,
                    originalUrl: trimmed,
                    title: cleanTitle,
                    isHls: sniffed.isHls,
                    isDash: sniffed.isDash,
                    subtitles: sniffed.subtitles || [],
                    isWebpage: false,
                    contentType: sniffed.isHls ? 'application/vnd.apple.mpegurl' : 'video/mp4',
                    format: sniffed.isHls ? 'HLS (1080p Stream)' : (sniffed.isDash ? 'DASH (mpd)' : 'MP4/Stream'),
                    sizeBytes: 0,
                    sizeFormatted: 'Live Stream',
                    autoExtracted: true
                  }, sniffed);
                  return resolve(extracted);
                }

                resolve({
                  url: targetUrl,
                  originalUrl: trimmed,
                  title: derivedTitle,
                  isHls: false,
                  isDash: false,
                  isWebpage: true,
                  contentType,
                  format: 'Webpage (HTML)',
                  sizeBytes: 0,
                  sizeFormatted: 'Website Page',
                  error: 'This URL is a website page (HTML), not a direct video stream (.m3u8 or .mp4).'
                });
              }).catch(() => {
                resolve({
                  url: targetUrl,
                  originalUrl: trimmed,
                  title: derivedTitle,
                  isHls: false,
                  isDash: false,
                  isWebpage: true,
                  contentType,
                  format: 'Webpage (HTML)',
                  sizeBytes: 0,
                  sizeFormatted: 'Website Page',
                  error: 'This URL is a website page (HTML), not a direct video stream (.m3u8 or .mp4).'
                });
              });
              return;
            }

            enrichHlsProbe({
              url: targetUrl,
              originalUrl: trimmed,
              title: derivedTitle,
              isHls,
              isDash,
              isWebpage: false,
              contentType,
              format: isHls ? 'HLS (m3u8)' : (isDash ? 'DASH (mpd)' : 'MP4/Stream'),
              sizeBytes: contentLength,
              sizeFormatted: contentLength > 0 ? formatBytes(contentLength) : 'Adaptive Stream'
            }).then(resolve);
          });

          req.on('error', () => {
            enrichHlsProbe({
              url: targetUrl,
              title: derivedTitle,
              isHls,
              isDash,
              isWebpage: false,
              contentType: 'application/octet-stream',
              format: isHls ? 'HLS Stream' : 'Web Stream',
              sizeBytes: 0,
              sizeFormatted: 'Live Stream'
            }).then(resolve);
          });

          req.on('timeout', () => {
            req.destroy();
            enrichHlsProbe({
              url: targetUrl,
              title: derivedTitle,
              isHls,
              isDash,
              isWebpage: false,
              contentType: 'application/octet-stream',
              format: isHls ? 'HLS Stream' : 'Web Stream',
              sizeBytes: 0,
              sizeFormatted: 'Live Stream'
            }).then(resolve);
          });

          req.end();
        } catch {
          resolve({
            url: targetUrl,
            title: derivedTitle,
            isHls,
            isDash,
            isWebpage: false,
            contentType: 'application/octet-stream',
            format: isHls ? 'HLS Stream' : 'Web Stream',
            sizeBytes: 0,
            sizeFormatted: 'Live Stream'
          });
        }
      });
    };

    return fetchHeaders(trimmed, maxRedirects);
  }

  /**
   * Validate resolved stream audio & subtitle tracks against requested preferences
   * Throws an Error if a strictly requested track is missing (enforcing Option A)
   */
  _validateEpisodeTracks(probe, task) {
    if (!probe) return;

    // 1. Audio Track Validation
    if (task.audioPreference && task.audioPreference !== 'any') {
      const pref = task.audioPreference.toLowerCase();
      if (pref === 'dual' || task.dualAudio) {
        const hasDubUrl = Boolean(task.dubStreamUrl || probe.dubStreamUrl);
        const hasMultipleAudio = Array.isArray(probe.audioTracks) && probe.audioTracks.length > 1;
        if (!hasDubUrl && !hasMultipleAudio) {
          throw new Error('Dual audio tracks not available for this episode');
        }
      } else if (pref.startsWith('eng') || pref.includes('dub')) {
        const hasEng = Array.isArray(probe.audioTracks) && probe.audioTracks.some(a =>
          /english|eng/i.test(a.name || '') || /en/i.test(a.lang || '')
        );
        const hasDubStream = Boolean(probe.dubStreamUrl);
        if (!hasEng && !hasDubStream) {
          throw new Error('Requested English dub not available for this episode');
        }
      } else if (pref.startsWith('jpn') || pref.includes('japanese') || pref.includes('sub')) {
        const hasJpn = Array.isArray(probe.audioTracks) && probe.audioTracks.some(a =>
          /japanese|jpn/i.test(a.name || '') || /ja/i.test(a.lang || '')
        );
        const hasExplicitNonJpn = Array.isArray(probe.audioTracks) && probe.audioTracks.length === 1 && (
          /english|eng|dub/i.test(probe.audioTracks[0].name || '') || /en/i.test(probe.audioTracks[0].lang || '')
        );
        const isSingleUntagged = (!probe.audioTracks || probe.audioTracks.length === 0 || (probe.audioTracks.length === 1 && !hasExplicitNonJpn));
        if (!hasJpn && !isSingleUntagged) {
          throw new Error('Requested Japanese audio not available for this episode');
        }
      }
    }

    // 2. Subtitle Validation
    if (task.subPreference && task.subPreference !== 'any' && task.subPreference !== 'none') {
      const pref = task.subPreference.toLowerCase();
      const subs = Array.isArray(probe.subtitles) ? probe.subtitles : [];
      if (subs.length === 0) {
        throw new Error('No subtitles available for this episode');
      }
      if (pref.startsWith('eng') || pref.includes('english')) {
        const hasEngSub = subs.some(s =>
          /english|eng/i.test(s.label || s.name || '') || /en/i.test(s.lang || '')
        );
        if (!hasEngSub) {
          throw new Error('Requested English subtitles not available for this episode');
        }
      }
    }
  }

  /**
   * Allocate unique output file path with dedicated subfolder support
   */
  async _allocateOutputPath(cleanTitle, format = 'mp4', subfolder = '') {
    const ext = (format && format.toLowerCase() === 'ts') ? '.ts' : '.mp4';
    let targetDir = this.downloadFolder;
    const cleanSub = stripLanguageTags(subfolder);
    if (cleanSub && typeof cleanSub === 'string' && cleanSub.trim()) {
      targetDir = path.join(this.downloadFolder, sanitizeFilename(cleanSub.trim()));
      this.ensureFolder(targetDir);
    }
    let fileName = `${cleanTitle}${ext}`;
    let outPath = path.join(targetDir, fileName);
    let counter = 1;
    const pathExists = async (p) => {
      try {
        await fs.promises.access(p, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    };
    while (await pathExists(outPath)) {
      fileName = `${cleanTitle} (${counter})${ext}`;
      outPath = path.join(targetDir, fileName);
      counter++;
    }
    return { fileName, outPath };
  }

  /**
   * Refill active queue from season backlog to maintain up to 10 active/queued slots
   */
  async _refillQueueFromBacklog() {
    const activeOrQueuedCount = this.queue.filter(t =>
      t.status === 'queued' || t.status === 'starting' || t.status === 'downloading' || t.status === 'sniffing'
    ).length;

    const slotsAvailable = 10 - activeOrQueuedCount;
    if (slotsAvailable <= 0 || this.seasonBacklog.length === 0) return;

    const toAdd = this.seasonBacklog.splice(0, slotsAvailable);
    for (const item of toAdd) {
      const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const safeFormat = (item.outputFormat && item.outputFormat.toLowerCase().includes('ts')) ? 'ts' : 'mp4';
      const { fileName, outPath } = await this._allocateOutputPath(item.title, safeFormat, item.subfolder);

      const task = {
        id,
        url: item.url,
        subfolder: item.subfolder || '',
        audioPreference: item.audioPreference || 'any',
        subPreference: item.subPreference || 'any',
        selectedVideoUrl: '',
        selectedAudioUrl: '',
        selectedSubtitles: [],
        embedSubtitles: item.embedSubtitles !== false,
        dualAudio: Boolean(item.dualAudio),
        dubStreamUrl: null,
        subStreamUrl: null,
        audioTracks: [],
        outputFormat: safeFormat,
        title: item.title,
        fileName,
        outputPath: outPath,
        status: 'queued',
        percent: 0,
        speed: 'Queued',
        etaFormatted: '',
        segmentsText: '',
        downloadedBytes: 0,
        sizeFormatted: '0 MB',
        timeFormatted: '00:00',
        totalDurationSec: 0,
        startTime: Date.now(),
        customHeaders: item.customHeaders || {},
        needsSniffing: true
      };

      this.queue.push(task);
      this._broadcastProgress(task);
    }
  }

  /**
   * Sequential queue processor: ensures strictly 1 active download at a time
   */
  async _processQueue() {
    if (this._isProcessingQueue) return;
    this._isProcessingQueue = true;

    try {
      await this._refillQueueFromBacklog();

      // Check if any download is already active
      const isAnyActive = this.queue.some(t =>
        t.status === 'downloading' || t.status === 'starting' || t.status === 'sniffing'
      );
      if (isAnyActive) {
        return;
      }

      // Find the next task that is queued
      const nextTask = this.queue.find(t => t.status === 'queued');
      if (!nextTask) {
        return;
      }

      this.activeTaskId = nextTask.id;
      nextTask.status = 'starting';
      nextTask.speed = 'Starting...';
      nextTask.percent = 1;
      this._broadcastProgress(nextTask);

      const cancelState = { cancelled: false };
      this.activeControllers.set(nextTask.id, cancelState);

      // Execute asynchronously
      this._executeTask(nextTask, cancelState).catch((err) => {
        logger.error(`Error in _executeTask [${nextTask.id}]:`, err.message);
      });
    } finally {
      this._isProcessingQueue = false;
    }
  }

  /**
   * Add a download task to the active queue and execute sequentially
   */
  async startDownload({
    url,
    title,
    subfolder = '',
    audioPreference = 'any',
    subPreference = 'any',
    selectedVideoUrl = '',
    selectedAudioUrl = '',
    selectedSubtitles = [],
    embedSubtitles = true,
    dualAudio = false,
    dubStreamUrl = null,
    subStreamUrl = null,
    audioTracks = [],
    outputFormat = 'mp4',
    customHeaders = {}
  }) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required to start a download.');
    }

    const trimmedUrl = url.trim();
    const initialTitle = sanitizeFilename(title || 'CopyCat_Stream');
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    this.ensureFolder(this.downloadFolder);

    const safeFormat = (outputFormat && outputFormat.toLowerCase().includes('ts')) ? 'ts' : 'mp4';
    const { fileName, outPath } = await this._allocateOutputPath(initialTitle, safeFormat, subfolder);

    const task = {
      id,
      url: trimmedUrl,
      subfolder: subfolder || '',
      audioPreference: audioPreference || 'any',
      subPreference: subPreference || 'any',
      selectedVideoUrl,
      selectedAudioUrl,
      selectedSubtitles: Array.isArray(selectedSubtitles) ? selectedSubtitles : [],
      embedSubtitles: embedSubtitles !== false,
      dualAudio: Boolean(dualAudio),
      dubStreamUrl: dubStreamUrl || null,
      subStreamUrl: subStreamUrl || null,
      audioTracks: Array.isArray(audioTracks) ? audioTracks : [],
      outputFormat: safeFormat,
      title: initialTitle,
      fileName,
      outputPath: outPath,
      status: 'queued',
      percent: 0,
      speed: 'Queued',
      etaFormatted: '',
      segmentsText: '',
      downloadedBytes: 0,
      sizeFormatted: '0 MB',
      timeFormatted: '00:00',
      totalDurationSec: 0,
      startTime: Date.now(),
      customHeaders
    };

    this.queue.push(task);
    this._broadcastProgress(task);

    this._processQueue();

    return task;
  }

  /**
   * Queue a full season of episodes into the backlog and initialize sliding window
   */
  async queueSeason({
    url,
    fromEp = 1,
    toEp = 12,
    seriesTitle = '',
    audioPreference = 'any',
    subPreference = 'any',
    dualAudio = false,
    embedSubtitles = true,
    outputFormat = 'mp4',
    customHeaders = {}
  }) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required to queue a season.');
    }

    const cleanUrl = url.trim();
    const epInfo = parseEpisodeFromUrl(cleanUrl);
    if (!epInfo) {
      throw new Error('No episode number found in URL to generate season range (e.g. ?ep=1, /episode-1, or /ep-1).');
    }
    const startEp = Math.max(1, parseInt(fromEp, 10) || 1);
    const endEp = Math.max(startEp, parseInt(toEp, 10) || startEp);
    const resolvedTitle = sanitizeFilename(stripLanguageTags(seriesTitle || extractSeriesTitleGuess(cleanUrl)));
    const padWidth = endEp >= 100 ? 3 : 2;

    const targetSeasonDir = path.join(this.downloadFolder, resolvedTitle);
    this.ensureFolder(targetSeasonDir);
    this.optimizeFolderView(targetSeasonDir);

    const episodes = [];
    for (let ep = startEp; ep <= endEp; ep++) {
      const epUrl = replaceEpisodeInUrl(cleanUrl, ep);
      const epNumStr = String(ep).padStart(padWidth, '0');
      const epTitle = `${resolvedTitle} - Episode ${epNumStr}`;
      episodes.push({
        url: epUrl,
        title: epTitle,
        subfolder: resolvedTitle,
        episodeNumber: ep,
        audioPreference,
        subPreference,
        dualAudio: Boolean(dualAudio),
        embedSubtitles: embedSubtitles !== false,
        outputFormat: outputFormat || 'mp4',
        customHeaders
      });
    }

    this.seasonBacklog.push(...episodes);
    logger.info(`Queued season [${resolvedTitle}] with ${episodes.length} episodes (${startEp} to ${endEp})`);

    await this._refillQueueFromBacklog();
    this._processQueue();

    return {
      success: true,
      seriesTitle: resolvedTitle,
      totalEpisodes: episodes.length,
      startEp,
      endEp
    };
  }

  /**
   * Execute an individual download task with Just-In-Time sniffing and Option A error skipping
   */
  async _executeTask(task, cancelState) {
    task.status = 'starting';
    task.speed = 'Starting...';
    task.percent = 1;
    this._broadcastProgress(task);

    try {
      const isDirectHls = task.url.toLowerCase().includes('.m3u8') || task.url.toLowerCase().includes('/m/');
      const isDirectMedia = /\.(mpd|mp4|webm|mkv|ts|aac|mp3|ogg|flac|m4a)(\?|$)/i.test(task.url);

      let targetUrl = task.url;
      let isHls = isDirectHls;

      if (!isDirectHls && !isDirectMedia) {
        task.status = 'sniffing';
        task.speed = 'Sniffing episode stream...';
        this._broadcastProgress(task);

        let probe = null;
        try {
          probe = await this.probeUrl(task.url);
        } catch (probeErr) {
          throw new Error(`Sniffing failed: ${probeErr.message}`);
        }

        if (cancelState.cancelled || task.status === 'cancelled') return;

        if (!probe || (probe.isWebpage && !probe.autoExtracted)) {
          throw new Error('Stream not found on episode webpage.');
        }

        // Validate audio & subtitle preferences
        this._validateEpisodeTracks(probe, task);

        if (probe && probe.url) {
          targetUrl = probe.url;
          isHls = Boolean(probe.isHls || targetUrl.includes('.m3u8') || targetUrl.includes('/m/'));
          if (probe.title && (task.title === 'CopyCat_Stream' || task.title === 'Stream Video')) {
            task.title = sanitizeFilename(probe.title);
            const alloc = await this._allocateOutputPath(task.title, task.outputFormat, task.subfolder);
            task.fileName = alloc.fileName;
            task.outputPath = alloc.outPath;
          }
          if (!task.dubStreamUrl && probe.dubStreamUrl) task.dubStreamUrl = probe.dubStreamUrl;
          if (!task.subStreamUrl && probe.subStreamUrl) task.subStreamUrl = probe.subStreamUrl;
          if ((!task.audioTracks || task.audioTracks.length === 0) && Array.isArray(probe.audioTracks)) {
            task.audioTracks = probe.audioTracks;
          }
          if (task.selectedSubtitles.length === 0 && Array.isArray(probe.subtitles) && probe.subtitles.length > 0) {
            task.selectedSubtitles = probe.subtitles;
          }
        }
      }

      // Route target media stream URL based on requested audio track preference (e.g. English Dub vs Japanese Sub)
      if (/eng|dub/i.test(task.audioPreference || '')) {
        const dubUrl = task.dubStreamUrl || (Array.isArray(task.audioTracks) && task.audioTracks.find(a => /english|en|dub/i.test(a.name || '') || /en/i.test(a.lang || ''))?.streamUrl);
        if (dubUrl) {
          task.dubStreamUrl = dubUrl;
          if (!task.dualAudio) {
            targetUrl = dubUrl;
            isHls = Boolean(targetUrl.includes('.m3u8') || targetUrl.includes('/m/'));
          }
        }
      } else if (!task.dualAudio && (/jpn|japanese|sub/i.test(task.audioPreference || ''))) {
        const subUrl = task.subStreamUrl || (Array.isArray(task.audioTracks) && task.audioTracks.find(a => /japanese|jpn|sub/i.test(a.name || '') || /ja/i.test(a.lang || ''))?.streamUrl);
        if (subUrl) {
          task.subStreamUrl = subUrl;
          targetUrl = subUrl;
          isHls = Boolean(targetUrl.includes('.m3u8') || targetUrl.includes('/m/'));
        }
      }

      if (task.dualAudio && !task.dubStreamUrl && Array.isArray(task.audioTracks)) {
        const dubTrack = task.audioTracks.find(a => /english|en|dub/i.test(a.name || '') || /en/i.test(a.lang || ''));
        if (dubTrack && dubTrack.streamUrl && dubTrack.streamUrl !== task.url) {
          task.dubStreamUrl = dubTrack.streamUrl;
        }
      }

      task.url = targetUrl;
      if (cancelState.cancelled || task.status === 'cancelled') return;

      if (isHls) {
        await this._downloadHlsNative(task, task.customHeaders || {}, cancelState);
      } else {
        await this._spawnFfmpegDownload(task, task.customHeaders || {}, cancelState);
      }
    } catch (err) {
      if (cancelState.cancelled || task.status === 'cancelled') return;
      task.status = 'error';
      task.error = err.message || 'Download failed';
      task.percent = 0;
      task.speed = 'Skipped';
      logger.warn(`Task ${task.title || task.id} skipped (Option A): ${task.error}`);
      this._broadcastError(task);
    } finally {
      this.activeTaskId = null;
      this.activeControllers.delete(task.id);
      // Pacing delay (250ms) between sequential episodes to avoid CDN / anti-bot rate spikes
      setTimeout(() => {
        this._processQueue();
      }, 250);
    }
  }

  async _executeDownloadWorkflow(task, customHeaders, cancelState) {
    return this._executeTask(task, cancelState);
  }

  /**
   * Native Multi-Track HLS Downloader + Separate-Input FFmpeg Muxer
   * Supports user-selected video quality, audio language, or Dual-Audio muxing.
   */
  async _downloadHlsNative(task, customHeaders, cancelState) {
    const ffmpegPath = mediaResolver.FFMPEG_PATH;
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      throw new Error('Bundled FFmpeg executable could not be resolved.');
    }

    task.status = 'downloading';
    task.percent = 2;
    task.speed = 'Fetching manifest...';
    this._broadcastProgress(task);

    const manifest = await this.resolveHlsManifest(task.url, customHeaders, cancelState, {
      selectedVideoUrl: task.selectedVideoUrl,
      selectedAudioUrl: task.selectedAudioUrl,
      audioPreference: task.audioPreference,
      dualAudio: task.dualAudio
    });
    if (cancelState.cancelled) return;

    const vPl = manifest.videoPlaylist;
    const audioPlaylists = manifest.allAudioPlaylists && manifest.allAudioPlaylists.length > 0
      ? manifest.allAudioPlaylists
      : (manifest.audioPlaylist ? [manifest.audioPlaylist] : []);

    if (!vPl || !vPl.segments || vPl.segments.length === 0) {
      throw new Error('No video segments found in HLS playlist.');
    }

    const tempDir = path.join(os.tmpdir(), `copycat_dl_${task.id}`);
    this.ensureFolder(tempDir);

    // If Dub audio (or Dual-Audio) is requested and a separate Dub stream URL exists (e.g. Miruro / strm Sub + Dub manifests)
    let dubPlaylist = null;
    let tempDubTs = null;
    const wantsDubStream = Boolean((task.dualAudio || /eng|dub/i.test(task.audioPreference || '')) && task.dubStreamUrl && task.dubStreamUrl !== task.url);
    if (wantsDubStream) {
      try {
        const dubManifest = await this.resolveHlsManifest(task.dubStreamUrl, customHeaders, cancelState);
        // Verify stream durations match if Dual-Audio is requested to avoid mixing different broadcast cuts (e.g. 1-hr special vs 24m TV episode)
        if (task.dualAudio && manifest.durationSec > 0 && dubManifest.durationSec > 0 && Math.abs(manifest.durationSec - dubManifest.durationSec) > 60) {
          logger.warn(`Dual-audio duration mismatch between Sub (${manifest.durationSec}s) and Dub (${dubManifest.durationSec}s). Edits differ; skipping secondary track mux to prevent desync.`);
          dubPlaylist = null;
        } else {
          dubPlaylist = dubManifest.audioPlaylist || dubManifest.videoPlaylist;
        }
        if (dubPlaylist && Array.isArray(dubPlaylist.segments) && dubPlaylist.segments.length > 0) {
          tempDubTs = path.join(tempDir, `dub.ts`);
        }
      } catch (err) {
        logger.warn('Failed to resolve dub stream manifest for dub/dual-audio download:', err.message);
      }
    }

    task.totalDurationSec = manifest.durationSec || 0;
    const audioSegCount = audioPlaylists.reduce((acc, a) => acc + (a.segments?.length || 0), 0);
    const dubSegCount = dubPlaylist?.segments?.length || 0;
    const totalSegments = vPl.segments.length + audioSegCount + dubSegCount;
    let completedSegments = 0;
    let lastReportTime = 0;
    const dlStartTime = Date.now();

    // Resolve subtitle tracks to embed
    let targetSubtitles = [];
    if (task.embedSubtitles) {
      if (Array.isArray(task.selectedSubtitles) && task.selectedSubtitles.length > 0) {
        targetSubtitles = task.selectedSubtitles;
      } else if (Array.isArray(manifest.subtitleTracks) && manifest.subtitleTracks.length > 0) {
        targetSubtitles = manifest.subtitleTracks;
      }
    }

    const tempVideoTs = path.join(tempDir, `v.ts`);
    const tempAudioFiles = audioPlaylists.map((aPl, idx) => ({
      playlist: aPl,
      path: path.join(tempDir, `a${idx}.ts`),
      lang: aPl.lang || (idx === 0 ? 'jpn' : 'eng'),
      name: aPl.name || `Track ${idx + 1}`
    }));
    const tempSubFiles = targetSubtitles.map((s, idx) => {
      let subName = s.label || s.name || `Subtitles ${idx + 1}`;
      if (/english/i.test(subName)) subName = 'English';
      else if (/indonesian/i.test(subName)) subName = 'Indonesian';
      else if (/thai/i.test(subName)) subName = 'Thai';
      else if (/japanese/i.test(subName)) subName = 'Japanese';
      else if (/german/i.test(subName)) subName = 'German';
      return {
        sub: s,
        path: path.join(tempDir, `s${idx}.vtt`),
        name: subName,
        lang: normalizeIsoLang(s.lang, subName)
      };
    });

    const cleanupTemps = async () => {
      try {
        if (fs.existsSync(tempDir)) {
          await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      } catch (_) {}
    };

    try {
      const downloadTrackToTs = async (playlist, outTsPath) => {
        let aesKey = null;
        if (playlist.keyUrl) {
          aesKey = await this._fetchBuffer(playlist.keyUrl, customHeaders, 5, 5, cancelState);
        }

        const fileHandle = await fs.promises.open(outTsPath, 'w');
        try {
          if (playlist.initUrl) {
            const initBuf = await this._fetchBuffer(playlist.initUrl, customHeaders, 5, 5, cancelState);
            if (initBuf && initBuf.length > 0) {
              await fileHandle.write(initBuf);
              task.downloadedBytes += initBuf.length;
            }
          }

          const segs = playlist.segments;
          const readyBuffers = new Map();
          let nextWriteIndex = 0;
          let nextFetchIndex = 0;
          const concurrency = Math.min(8, Math.max(4, segs.length));
          let isFlushing = false;

          const flushReady = async () => {
            if (isFlushing) return;
            isFlushing = true;
            try {
              while (readyBuffers.has(nextWriteIndex)) {
                const buf = readyBuffers.get(nextWriteIndex);
                readyBuffers.delete(nextWriteIndex);
                if (buf && buf.length > 0) {
                  await fileHandle.write(buf);
                }
                nextWriteIndex++;
              }
            } finally {
              isFlushing = false;
            }
          };

          const worker = async () => {
            while (nextFetchIndex < segs.length) {
              if (cancelState.cancelled) throw new Error('Download cancelled');
              const segIdx = nextFetchIndex++;
              const segUrl = segs[segIdx];

              let buf = await this._fetchBuffer(segUrl, customHeaders, 6, 5, cancelState);
              if (cancelState.cancelled) throw new Error('Download cancelled');

              if (aesKey && aesKey.length === 16) {
                let iv = playlist.keyIv;
                if (!iv) {
                  iv = Buffer.alloc(16, 0);
                  iv.writeUInt32BE(segIdx + 1, 12);
                }
                const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);
                buf = Buffer.concat([decipher.update(buf), decipher.final()]);
              }

              readyBuffers.set(segIdx, buf);
              await flushReady();

              completedSegments++;
              task.downloadedBytes += buf.length;
              task.percent = Math.max(2, Math.min(96, Math.round((completedSegments / totalSegments) * 96)));
              task.sizeFormatted = formatBytes(task.downloadedBytes);
              task.segmentsText = `${completedSegments} / ${totalSegments} segs`;

              const elapsedSec = Math.max(0.2, (Date.now() - dlStartTime) / 1000);
              const bytesPerSec = task.downloadedBytes / elapsedSec;
              task.speed = `${formatBytes(bytesPerSec)}/s`;

              const segsPerSec = completedSegments / elapsedSec;
              const remSegs = Math.max(0, totalSegments - completedSegments);
              const etaSec = segsPerSec > 0 ? Math.ceil(remSegs / segsPerSec) : 0;
              task.etaFormatted = etaSec > 0
                ? (etaSec >= 60 ? `~${Math.floor(etaSec / 60)}m ${etaSec % 60}s left` : `~${etaSec}s left`)
                : 'Finishing...';

              if (task.totalDurationSec > 0) {
                const estSec = Math.round((completedSegments / totalSegments) * task.totalDurationSec);
                task.timeFormatted = `${formatDuration(estSec)} / ${formatDuration(task.totalDurationSec)}`;
              }

              const now = Date.now();
              if (now - lastReportTime > 250 || completedSegments === totalSegments) {
                lastReportTime = now;
                this._broadcastProgress(task);
              }
            }
          };

          await Promise.all(Array.from({ length: Math.min(concurrency, segs.length) }, () => worker()));
          await flushReady();
        } finally {
          try { await fileHandle.close(); } catch {}
        }
      };

      await downloadTrackToTs(vPl, tempVideoTs);
      for (const af of tempAudioFiles) {
        await downloadTrackToTs(af.playlist, af.path);
      }
      if (dubPlaylist && tempDubTs) {
        task.speed = 'Downloading English Dub audio...';
        this._broadcastProgress(task);
        await downloadTrackToTs(dubPlaylist, tempDubTs);
      }

      const downloadedSubFiles = [];
      if (task.embedSubtitles && tempSubFiles.length > 0) {
        task.speed = 'Downloading subtitles...';
        this._broadcastProgress(task);
        for (const sf of tempSubFiles) {
          if (cancelState.cancelled) break;
          const ok = await this._downloadSubtitleTrack(sf.sub, sf.path, customHeaders, cancelState);
          if (ok) {
            try {
              const stat = await fs.promises.stat(sf.path);
              if (stat.size > 10) downloadedSubFiles.push(sf);
            } catch {}
          }
        }
      }

      if (cancelState.cancelled) {
        await cleanupTemps();
        return;
      }

      // Finalize output video file (.mp4)
      task.percent = 98;
      task.speed = 'Finalizing .mp4 download...';
      task.etaFormatted = '~1s left';
      this._broadcastProgress(task);

      if (tempDubTs && fs.existsSync(tempDubTs)) {
        // Mux separate video and dub audio streams into true ISO MP4 container
        const isDubPrimary = /eng|dub/i.test(task.audioPreference || '') || /dub/i.test(task.title || task.fileName);
        const muxArgs = [
          '-y', '-hide_banner', '-loglevel', 'error',
          '-fflags', '+genpts',
          '-i', tempVideoTs,
          '-i', tempDubTs
        ];
        downloadedSubFiles.forEach((sf) => {
          muxArgs.push('-i', sf.path);
        });

        // Map video from input 0 (tempVideoTs is guaranteed video)
        muxArgs.push('-map', '0:v:0');

        if (task.dualAudio) {
          if (isDubPrimary) {
            muxArgs.push(
              '-map', '1:a:0',
              '-metadata:s:a:0', 'title=English (Dub)',
              '-metadata:s:a:0', 'handler_name=English (Dub)',
              '-metadata:s:a:0', 'language=eng',
              '-map', '0:a:0',
              '-metadata:s:a:1', 'title=Japanese (Original)',
              '-metadata:s:a:1', 'handler_name=Japanese (Original)',
              '-metadata:s:a:1', 'language=jpn'
            );
          } else {
            muxArgs.push(
              '-map', '0:a:0',
              '-metadata:s:a:0', 'title=Japanese (Original)',
              '-metadata:s:a:0', 'handler_name=Japanese (Original)',
              '-metadata:s:a:0', 'language=jpn',
              '-map', '1:a:0',
              '-metadata:s:a:1', 'title=English (Dub)',
              '-metadata:s:a:1', 'handler_name=English (Dub)',
              '-metadata:s:a:1', 'language=eng'
            );
          }
        } else {
          // Single Dub track requested: only English audio is included
          muxArgs.push(
            '-map', '1:a:0',
            '-metadata:s:a:0', 'title=English (Dub)',
            '-metadata:s:a:0', 'handler_name=English (Dub)',
            '-metadata:s:a:0', 'language=eng'
          );
        }

        downloadedSubFiles.forEach((sf, idx) => {
          const subInputIdx = 2 + idx;
          muxArgs.push('-map', `${subInputIdx}:s:0`);
          if (sf.name) {
            muxArgs.push(`-metadata:s:s:${idx}`, `title=${sf.name}`);
            muxArgs.push(`-metadata:s:s:${idx}`, `handler_name=${sf.name}`);
          }
          const langCode = normalizeIsoLang(sf.lang, sf.name);
          muxArgs.push(`-metadata:s:s:${idx}`, `language=${langCode}`);
        });

        muxArgs.push('-c:v', 'copy', '-c:a', 'copy');
        if (downloadedSubFiles.length > 0) {
          muxArgs.push('-c:s', 'mov_text');
        }
        muxArgs.push(
          '-movflags', '+faststart',
          task.outputPath
        );

        await new Promise((resolve, reject) => {
          const child = spawn(ffmpegPath, muxArgs, {
            windowsHide: true,
            stdio: ['ignore', 'ignore', 'pipe']
          });
          this.activeProcesses.set(task.id, child);
          let errText = '';
          child.stderr.on('data', (c) => { errText += c.toString(); });
          child.on('error', reject);
          child.on('close', async (code) => {
            this.activeProcesses.delete(task.id);
            if (code === 0 && fs.existsSync(task.outputPath)) {
              resolve();
            } else {
              reject(new Error(errText.trim() || `FFmpeg Dual-Audio mux exited with code ${code}`));
            }
          });
        });
      } else if (tempAudioFiles.length === 0) {
        // Single-stream HLS: Remux MPEG-TS into true ISO MP4 container
        // Lossless bitstream copy with faststart for instant native hardware-accelerated playback
        const remuxArgs = [
          '-y', '-hide_banner', '-loglevel', 'error',
          '-fflags', '+genpts',
          '-i', tempVideoTs
        ];
        downloadedSubFiles.forEach((sf) => {
          remuxArgs.push('-i', sf.path);
        });

        remuxArgs.push('-map', '0:v?', '-map', '0:a?');
        const animeMatch = animeSkipResolver.parseAnimeTitleAndEpisode(task.title || task.fileName) || /(?:owarimonogatari|monogatari)/i.test(task.title || task.fileName);
        const isDub = (/eng|dub/i.test(task.audioPreference || '')) || /dub/i.test(task.title || task.fileName);
        if (animeMatch) {
          const audioTitle = isDub ? 'English (Dub)' : 'Japanese (Original)';
          const audioLang = isDub ? 'eng' : 'jpn';
          remuxArgs.push(
            '-metadata:s:a:0', `title=${audioTitle}`,
            '-metadata:s:a:0', `handler_name=${audioTitle}`,
            '-metadata:s:a:0', `language=${audioLang}`
          );
        }
        downloadedSubFiles.forEach((sf, idx) => {
          const inputIdx = 1 + idx;
          remuxArgs.push('-map', `${inputIdx}:s:0`);
          if (sf.name) {
            remuxArgs.push(`-metadata:s:s:${idx}`, `title=${sf.name}`);
            remuxArgs.push(`-metadata:s:s:${idx}`, `handler_name=${sf.name}`);
          }
          const langCode = normalizeIsoLang(sf.lang, sf.name);
          remuxArgs.push(`-metadata:s:s:${idx}`, `language=${langCode}`);
        });

        remuxArgs.push('-c:v', 'copy', '-c:a', 'copy');
        if (downloadedSubFiles.length > 0) {
          remuxArgs.push('-c:s', 'mov_text');
        }
        remuxArgs.push(
          '-movflags', '+faststart',
          task.outputPath
        );

        let remuxSuccess = false;
        try {
          await new Promise((resolve, reject) => {
            const child = spawn(ffmpegPath, remuxArgs, {
              windowsHide: true,
              stdio: ['ignore', 'ignore', 'pipe']
            });
            this.activeProcesses.set(task.id, child);
            let errText = '';
            child.stderr.on('data', (c) => { errText += c.toString(); });
            child.on('error', reject);
            child.on('close', async (code) => {
              this.activeProcesses.delete(task.id);
              if (code === 0 && fs.existsSync(task.outputPath)) {
                remuxSuccess = true;
                resolve();
              } else {
                reject(new Error(errText.trim() || `FFmpeg MP4 remux exited with code ${code}`));
              }
            });
          });
        } catch (remuxErr) {
          logger.warn('Direct MP4 remux failed, falling back to raw container move:', remuxErr.message);
          try {
            if (fs.existsSync(task.outputPath)) await fs.promises.unlink(task.outputPath);
            await fs.promises.rename(tempVideoTs, task.outputPath);
          } catch {
            await fs.promises.copyFile(tempVideoTs, task.outputPath);
            try { await fs.promises.unlink(tempVideoTs); } catch {}
          }
        }
      } else {
        // Multi-track / Dual-Audio HLS:
        // Mux video, audio & subtitle tracks into true ISO MP4 container with stream titles
        const muxArgs = [
          '-y', '-hide_banner', '-loglevel', 'error',
          '-fflags', '+genpts',
          '-i', tempVideoTs
        ];
        const validAudioFiles = [];
        for (const af of tempAudioFiles) {
          if (fs.existsSync(af.path)) {
            muxArgs.push('-i', af.path);
            validAudioFiles.push(af);
          }
        }
        downloadedSubFiles.forEach((sf) => {
          muxArgs.push('-i', sf.path);
        });

        muxArgs.push('-map', '0:v:0');
        validAudioFiles.forEach((af, idx) => {
          muxArgs.push('-map', `${idx + 1}:a:0`);
          if (af.name) {
            muxArgs.push(`-metadata:s:a:${idx}`, `title=${af.name}`);
            muxArgs.push(`-metadata:s:a:${idx}`, `handler_name=${af.name}`);
          }
          const langCode = /ja/i.test(af.lang || af.name) ? 'jpn' : (/en/i.test(af.lang || af.name) ? 'eng' : (af.lang || ''));
          if (langCode) {
            muxArgs.push(`-metadata:s:a:${idx}`, `language=${langCode}`);
          }
        });

        downloadedSubFiles.forEach((sf, idx) => {
          const subInputIdx = 1 + validAudioFiles.length + idx;
          muxArgs.push('-map', `${subInputIdx}:s:0`);
          if (sf.name) {
            muxArgs.push(`-metadata:s:s:${idx}`, `title=${sf.name}`);
            muxArgs.push(`-metadata:s:s:${idx}`, `handler_name=${sf.name}`);
          }
          const langCode = normalizeIsoLang(sf.lang, sf.name);
          muxArgs.push(`-metadata:s:s:${idx}`, `language=${langCode}`);
        });

        muxArgs.push('-c:v', 'copy', '-c:a', 'copy');
        if (downloadedSubFiles.length > 0) {
          muxArgs.push('-c:s', 'mov_text');
        }
        muxArgs.push(
          '-movflags', '+faststart',
          task.outputPath
        );

        await new Promise((resolve, reject) => {
          const child = spawn(ffmpegPath, muxArgs, {
            windowsHide: true,
            stdio: ['ignore', 'ignore', 'pipe']
          });
          this.activeProcesses.set(task.id, child);

          let errText = '';
          child.stderr.on('data', (c) => { errText += c.toString(); });
          child.on('error', reject);
          child.on('close', async (code) => {
            this.activeProcesses.delete(task.id);
            if (code === 0 && fs.existsSync(task.outputPath)) {
              resolve();
            } else {
              reject(new Error(errText.trim() || `FFmpeg MP4 mux exited with code ${code}`));
            }
          });
        });
      }

      // Automatic Anime Chapter Tagging via AniList & AniSkip
      try {
        if (fs.existsSync(task.outputPath)) {
          task.speed = 'Tagging anime chapters...';
          this._broadcastProgress(task);
          await animeSkipResolver.autoTagAnimeFile(task.outputPath, task.title || task.fileName);
        }
      } catch (tagErr) {
        logger.debug('Anime chapter tagging skipped or failed:', tagErr.message);
      }

      const stat = await fs.promises.stat(task.outputPath);
      task.status = 'completed';
      task.percent = 100;
      task.speed = 'Completed';
      task.sizeFormatted = formatBytes(stat.size);
      task.completedAt = Date.now();
      logger.info(`HLS download & packaging completed: ${task.outputPath} (${task.sizeFormatted})`);
      this._broadcastComplete(task);
    } catch (err) {
      if (cancelState.cancelled || task.status === 'cancelled') {
        try { if (fs.existsSync(task.outputPath)) await fs.promises.unlink(task.outputPath); } catch {}
        return;
      }
      throw err;
    } finally {
      await cleanupTemps();
      this.activeControllers.delete(task.id);
    }
  }

  /**
   * Execute direct FFmpeg download for progressive/non-HLS streams
   */
  _spawnFfmpegDownload(task, customHeaders = {}) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = mediaResolver.FFMPEG_PATH;
      if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
        task.status = 'error';
        task.error = 'Bundled FFmpeg executable could not be resolved.';
        this._broadcastError(task);
        return reject(new Error(task.error));
      }

      const headersObj = getStreamHeaders(task.url, customHeaders);
      const headersArg = Object.entries(headersObj).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n';

      const args = [
        '-y',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-extension_picky', '0',
        '-allowed_segment_extensions', 'ALL',
        '-headers', headersArg,
        '-i', task.url,
        '-c', 'copy'
      ];
      if (task.outputPath.endsWith('.mp4')) {
        args.push('-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart');
      }
      const animeMatch = animeSkipResolver.parseAnimeTitleAndEpisode(task.title || task.fileName) || /(?:owarimonogatari|monogatari)/i.test(task.title || task.fileName);
      const isDub = (/eng|dub/i.test(task.audioPreference || '')) || /dub/i.test(task.title || task.fileName);
      if (animeMatch) {
        const audioTitle = isDub ? 'English (Dub)' : 'Japanese (Original)';
        const audioLang = isDub ? 'eng' : 'jpn';
        args.push(
          '-metadata:s:a:0', `title=${audioTitle}`,
          '-metadata:s:a:0', `handler_name=${audioTitle}`,
          '-metadata:s:a:0', `language=${audioLang}`
        );
      }
      args.push(task.outputPath);

      logger.info(`Starting FFmpeg download [${task.id}]: ${task.title} -> ${task.outputPath}`);

      try {
        const child = spawn(ffmpegPath, args, {
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe']
        });

        this.activeProcesses.set(task.id, child);
        task.status = 'downloading';
        this._broadcastProgress(task);

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
              task.totalDurationSec = totalDuration;
            }
          }

          const timeMatch = text.match(/time=\s*(\d\d:\d\d:\d\d\.\d\d)/);
          const sizeMatch = text.match(/size=\s*(\d+)kB/i);
          const speedMatch = text.match(/speed=\s*([\d\.]+)x/i);

          if (timeMatch || sizeMatch) {
            const currentSec = timeMatch ? parseTimestamp(timeMatch[1]) : 0;
            const currentKb = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
            const currentSpeed = speedMatch ? `${speedMatch[1]}x` : '';

            if (totalDuration > 0 && currentSec > 0) {
              task.percent = Math.min(99, Math.round((currentSec / totalDuration) * 100));
            } else if (task.percent < 90) {
              task.percent = Math.min(95, task.percent + 1);
            }

            task.downloadedBytes = currentKb * 1024;
            task.sizeFormatted = formatBytes(task.downloadedBytes);
            task.timeFormatted = formatDuration(currentSec);
            task.speed = currentSpeed || 'Downloading';

            const now = Date.now();
            if (now - lastReport > 250) {
              lastReport = now;
              this._broadcastProgress(task);
            }
          }
        });

        child.on('error', (err) => {
          logger.error(`Download process error [${task.id}]:`, err.message);
          task.status = 'error';
          task.error = err.message;
          this.activeProcesses.delete(task.id);
          this.activeControllers.delete(task.id);
          this._broadcastError(task);
          reject(err);
        });

        child.on('close', async (code) => {
          this.activeProcesses.delete(task.id);
          this.activeControllers.delete(task.id);

          if (task.status === 'cancelled') {
            try {
              if (fs.existsSync(task.outputPath)) await fs.promises.unlink(task.outputPath);
            } catch {}
            return resolve();
          }

          if (code === 0 && fs.existsSync(task.outputPath)) {
            // Automatic Anime Chapter Tagging via AniList & AniSkip
            try {
              await animeSkipResolver.autoTagAnimeFile(task.outputPath, task.title || task.fileName);
            } catch (tagErr) {
              logger.debug('Anime chapter tagging skipped or failed:', tagErr.message);
            }
            const stat = await fs.promises.stat(task.outputPath);
            task.status = 'completed';
            task.percent = 100;
            task.sizeFormatted = formatBytes(stat.size);
            task.completedAt = Date.now();
            logger.info(`Download completed successfully: ${task.outputPath} (${task.sizeFormatted})`);
            this._broadcastComplete(task);
            resolve();
          } else {
            let errorDetail = '';
            const lines = lastStderr.split('\n').map((l) => l.trim()).filter(Boolean);
            for (let i = lines.length - 1; i >= 0; i--) {
              if (/error|invalid|forbidden|not found|failed|unsupported|denied|corrupt/i.test(lines[i])) {
                errorDetail = lines[i];
                break;
              }
            }
            task.status = 'error';
            task.error = errorDetail || `FFmpeg download exited with code ${code}`;
            logger.error(`Download failed [${task.id}]: ${task.error}`);
            this._broadcastError(task);
            reject(new Error(task.error));
          }
        });
      } catch (err) {
        task.status = 'error';
        task.error = err.message;
        this.activeProcesses.delete(task.id);
        this.activeControllers.delete(task.id);
        this._broadcastError(task);
        reject(err);
      }
    });
  }

  /**
   * Cancel an active or queued download
   */
  cancelDownload(id, shouldAdvanceQueue = true) {
    const task = this.queue.find((t) => t.id === id);
    if (!task) return false;

    task.status = 'cancelled';
    task.speed = 'Cancelled';

    const ctrl = this.activeControllers.get(id);
    if (ctrl) {
      ctrl.cancelled = true;
      this.activeControllers.delete(id);
    }

    const proc = this.activeProcesses.get(id);
    if (proc) {
      try {
        if (process.platform === 'win32' && proc.pid) {
          try { proc.kill('SIGKILL'); } catch {}
          const killer = spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
          killer.on('error', () => {});
          killer.unref();
        } else {
          proc.kill('SIGKILL');
        }
      } catch (err) {
        logger.debug('Process kill exception on cancel:', err.message);
      }
      this.activeProcesses.delete(id);
    }

    try {
      if (fs.existsSync(task.outputPath)) {
        fs.promises.unlink(task.outputPath).catch(() => {});
      }
    } catch {}

    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }

    this._broadcastProgress(task);
    this._syncTaskbarProgress();

    // Advance queue to next item only when requested
    if (shouldAdvanceQueue) {
      this._processQueue();
    }
    return true;
  }

  /**
   * Emergency stop: halt all active and queued downloads and clear season backlog atomically
   */
  haltAllDownloads() {
    this.seasonBacklog = [];
    let haltedCount = 0;

    // 1. Immediately cancel all queued and pending tasks first so no task can be picked up
    for (const task of this.queue) {
      if (task.status === 'queued' || task.status === 'starting' || task.status === 'sniffing') {
        task.status = 'cancelled';
        task.speed = 'Halted';
        this._broadcastProgress(task);
        haltedCount++;
      }
    }

    // 2. Terminate the active task without advancing the queue
    const currentActiveId = this.activeTaskId;
    if (currentActiveId) {
      this.cancelDownload(currentActiveId, false);
      this.activeTaskId = null;
      haltedCount++;
    }

    this._syncTaskbarProgress();
    logger.info(`Halt all downloads completed: ${haltedCount} tasks halted`);
    return { success: true, haltedCount };
  }

  /**
   * Retry an individual failed or cancelled download task
   */
  retryDownload(id) {
    const task = this.queue.find((t) => t.id === id);
    if (!task) return false;
    if (task.status !== 'error' && task.status !== 'cancelled') return false;

    task.status = 'queued';
    task.percent = 0;
    task.speed = 'Queued for retry';
    task.error = null;
    task.etaFormatted = '';
    task.segmentsText = '';
    this._broadcastProgress(task);
    this._processQueue();
    return true;
  }

  /**
   * Increment episode number in URL helper
   */
  incrementEpisodeUrl(url, step = 1) {
    return incrementEpisodeUrl(url, step);
  }

  getQueue() {
    return this.queue;
  }

  _syncTaskbarProgress() {
    const win = this.windowManager?.getWindow();
    if (!win || win.isDestroyed()) return;
    const active = this.queue.filter((t) => t.status === 'downloading' || t.status === 'starting');
    if (active.length === 0) {
      win.setProgressBar(-1);
    } else {
      const avg = active.reduce((acc, t) => acc + (t.percent || 0), 0) / active.length;
      win.setProgressBar(Math.max(0.02, Math.min(0.99, avg / 100)));
    }
  }

  _broadcastProgress(task) {
    const win = this.windowManager?.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('download:progress', {
        id: task.id,
        url: task.url,
        title: task.title,
        fileName: task.fileName,
        outputPath: task.outputPath,
        status: task.status,
        percent: task.percent,
        speed: task.speed,
        etaFormatted: task.etaFormatted || '',
        segmentsText: task.segmentsText || '',
        sizeFormatted: task.sizeFormatted,
        timeFormatted: task.timeFormatted,
        error: task.error || null
      });
      this._syncTaskbarProgress();
    }
  }

  _broadcastComplete(task) {
    const win = this.windowManager?.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('download:complete', {
        id: task.id,
        title: task.title,
        fileName: task.fileName,
        outputPath: task.outputPath,
        sizeFormatted: task.sizeFormatted
      });
      this._syncTaskbarProgress();
    }
  }

  _broadcastError(task) {
    const win = this.windowManager?.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('download:error', {
        id: task.id,
        title: task.title,
        error: task.error || 'Download failed'
      });
      this._syncTaskbarProgress();
    }
  }
}

/**
 * Factory helper for Container registration
 */
function createDownloadManager(deps) {
  return new DownloadManager(deps);
}

module.exports = {
  DownloadManager,
  createDownloadManager,
  formatBytes,
  sanitizeFilename,
  stripLanguageTags,
  formatDoubleDigitEpisode,
  parseEpisodeFromUrl,
  incrementEpisodeUrl,
  replaceEpisodeInUrl,
  extractSeriesTitleGuess
};
