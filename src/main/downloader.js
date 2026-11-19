// src/main/downloader.js
// Standalone Native Stream & Video Downloader Service for CopyCat Media Player
// Zero External Dependencies: Uses native Node.js HTTPS segment fetcher + bundled FFmpeg muxer.

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { app, dialog, shell } = require('electron');
const { createLogger } = require('./logger');
const mediaResolver = require('./media-resolver');
const { extractStreamFromWebpage, getRequiredHeadersForUrl } = require('./stream-sniffer');

const logger = createLogger('Downloader');

const httpsKeepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 6 });
const httpKeepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 6 });

/**
 * Sanitize filename for safe Windows NTFS storage
 */
function sanitizeFilename(name) {
  let clean = (name || 'video')
    .replace(/^Watch\s+/i, '')
    .replace(/\s*[-–—|·]\s*(Miruro|Watch Online|Full HD).*$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  return clean.slice(0, 85) || (`video_${Date.now()}`);
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
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
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
    this.downloadFolder = path.join(app.getPath('downloads'), 'CopyCat');
    this.ensureFolder(this.downloadFolder);
  }

  ensureFolder(dir) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      logger.error('Failed to create download folder:', err.message);
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
        derivedTitle = sanitizeFilename(epParam ? `${baseName} - Episode ${epParam}` : baseName);
      }
    } catch {
      throw new Error('Malformed stream URL.');
    }

    const enrichHlsProbe = async (baseResult, sniffedExtra = null) => {
      if (!baseResult.isHls) return baseResult;
      try {
        const manifest = await this.resolveHlsManifest(baseResult.url);
        let audioTracks = Array.isArray(manifest.audioTracks) ? [...manifest.audioTracks] : [];

        // If the webpage sniffer discovered an alternate Dub/Sub language stream
        if (sniffedExtra && sniffedExtra.dubStreamUrl) {
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
            } else if (!audioTracks.some((a) => /english/i.test(a.name))) {
              audioTracks.push(dubAudioTrack);
            }
          } catch (err) {
            logger.debug('Dub stream manifest enrichment notice:', err.message);
          }
        }

        const totalSegs = (manifest.videoPlaylist?.segments?.length || 0) + (manifest.audioPlaylist?.segments?.length || 0);
        const mergedSubtitles = [
          ...(baseResult.subtitles || []),
          ...(manifest.subtitleTracks || [])
        ];
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
                      cleanTitle = sanitizeFilename(`${cleanTitle} - Episode ${ep}`);
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
   * Add a download task to the active queue and start execution immediately
   */
  async startDownload({ url, title, selectedVideoUrl = '', selectedAudioUrl = '', dualAudio = false, outputFormat = 'ts', customHeaders = {} }) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required to start a download.');
    }

    const trimmedUrl = url.trim();
    const initialTitle = sanitizeFilename(title || 'CopyCat_Stream');
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    this.ensureFolder(this.downloadFolder);

    const safeFormat = (outputFormat && outputFormat.toLowerCase().includes('ts')) ? 'ts' : 'mp4';
    const { fileName, outPath } = this._allocateOutputPath(initialTitle, safeFormat);

    const task = {
      id,
      url: trimmedUrl,
      selectedVideoUrl,
      selectedAudioUrl,
      dualAudio: Boolean(dualAudio),
      outputFormat: safeFormat,
      title: initialTitle,
      fileName,
      outputPath: outPath,
      status: 'starting',
      percent: 1,
      speed: 'Resolving stream...',
      etaFormatted: '',
      segmentsText: '',
      downloadedBytes: 0,
      sizeFormatted: '0 MB',
      timeFormatted: '00:00',
      totalDurationSec: 0,
      startTime: Date.now()
    };

    const cancelState = { cancelled: false };
    this.activeControllers.set(id, cancelState);

    this.queue.unshift(task);
    this._broadcastProgress(task);

    // Run download workflow asynchronously so UI immediately renders the progress card
    this._executeDownloadWorkflow(task, customHeaders, cancelState).catch((err) => {
      if (cancelState.cancelled || task.status === 'cancelled') return;
      task.status = 'error';
      task.error = err.message || 'Download failed';
      this._broadcastError(task);
    });

    return task;
  }

  _allocateOutputPath(cleanTitle, format = 'mp4') {
    const ext = (format && format.toLowerCase() === 'ts') ? '.ts' : '.mp4';
    let fileName = `${cleanTitle}${ext}`;
    let outPath = path.join(this.downloadFolder, fileName);
    let counter = 1;
    while (fs.existsSync(outPath)) {
      fileName = `${cleanTitle} (${counter})${ext}`;
      outPath = path.join(this.downloadFolder, fileName);
      counter++;
    }
    return { fileName, outPath };
  }

  async _executeDownloadWorkflow(task, customHeaders, cancelState) {
    const isDirectHls = task.url.toLowerCase().includes('.m3u8') || task.url.toLowerCase().includes('/m/');
    const isDirectMedia = /\.(mpd|mp4|webm|mkv|ts|aac|mp3|ogg|flac|m4a)(\?|$)/i.test(task.url);

    let targetUrl = task.url;
    let isHls = isDirectHls;

    if (!isDirectHls && !isDirectMedia) {
      const probe = await this.probeUrl(task.url);
      if (cancelState.cancelled) return;

      if (probe && probe.isWebpage && !probe.autoExtracted) {
        throw new Error('Could not extract a direct video stream from this webpage.');
      }

      if (probe && probe.url) {
        targetUrl = probe.url;
        isHls = Boolean(probe.isHls || targetUrl.includes('.m3u8') || targetUrl.includes('/m/'));
        if (probe.title && (task.title === 'CopyCat_Stream' || task.title === 'Stream Video')) {
          task.title = sanitizeFilename(probe.title);
          const alloc = this._allocateOutputPath(task.title, task.outputFormat);
          task.fileName = alloc.fileName;
          task.outputPath = alloc.outPath;
        }
      }
    }

    task.url = targetUrl;
    if (cancelState.cancelled) return;

    if (isHls) {
      await this._downloadHlsNative(task, customHeaders, cancelState);
    } else {
      this._spawnFfmpegDownload(task, customHeaders);
    }
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

    task.totalDurationSec = manifest.durationSec || 0;
    const audioSegCount = audioPlaylists.reduce((acc, a) => acc + (a.segments?.length || 0), 0);
    const totalSegments = vPl.segments.length + audioSegCount;
    let completedSegments = 0;
    let lastReportTime = 0;
    const dlStartTime = Date.now();

    const tempVideoTs = path.join(this.downloadFolder, `.temp_${task.id}_v.ts`);
    const tempAudioFiles = audioPlaylists.map((aPl, idx) => ({
      playlist: aPl,
      path: path.join(this.downloadFolder, `.temp_${task.id}_a${idx}.ts`),
      lang: aPl.lang || (idx === 0 ? 'jpn' : 'eng'),
      name: aPl.name || `Track ${idx + 1}`
    }));

    const cleanupTemps = () => {
      try { if (fs.existsSync(tempVideoTs)) fs.unlinkSync(tempVideoTs); } catch {}
      for (const af of tempAudioFiles) {
        try { if (fs.existsSync(af.path)) fs.unlinkSync(af.path); } catch {}
      }
    };

    try {
      const downloadTrackToTs = async (playlist, outTsPath) => {
        let aesKey = null;
        if (playlist.keyUrl) {
          aesKey = await this._fetchBuffer(playlist.keyUrl, customHeaders, 5, 5, cancelState);
        }

        const fd = fs.openSync(outTsPath, 'w');
        try {
          if (playlist.initUrl) {
            const initBuf = await this._fetchBuffer(playlist.initUrl, customHeaders, 5, 5, cancelState);
            fs.writeSync(fd, initBuf);
            task.downloadedBytes += initBuf.length;
          }

          const segs = playlist.segments;
          const readyBuffers = new Map();
          let nextWriteIndex = 0;
          let nextFetchIndex = 0;
          const concurrency = 4;

          const flushReady = () => {
            while (readyBuffers.has(nextWriteIndex)) {
              const buf = readyBuffers.get(nextWriteIndex);
              readyBuffers.delete(nextWriteIndex);
              if (buf && buf.length > 0) {
                fs.writeSync(fd, buf);
              }
              nextWriteIndex++;
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
              flushReady();

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
          flushReady();
        } finally {
          try { fs.closeSync(fd); } catch {}
        }
      };

      await downloadTrackToTs(vPl, tempVideoTs);
      for (const af of tempAudioFiles) {
        await downloadTrackToTs(af.playlist, af.path);
      }

      if (cancelState.cancelled) {
        cleanupTemps();
        return;
      }

      // Finalize output video file (.mp4)
      task.percent = 98;
      task.speed = 'Finalizing .mp4 download...';
      task.etaFormatted = '~1s left';
      this._broadcastProgress(task);

      if (tempAudioFiles.length === 0) {
        // Single-stream HLS (Japanese or English):
        // tempVideoTs contains the pristine video and audio stream from the CDN.
        // Direct move/rename to task.outputPath (.mp4) with 0% CPU overhead and 100% native clock sync!
        try {
          if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath);
          fs.renameSync(tempVideoTs, task.outputPath);
        } catch {
          fs.copyFileSync(tempVideoTs, task.outputPath);
          try { fs.unlinkSync(tempVideoTs); } catch {}
        }
      } else {
        // Multi-track / Dual-Audio HLS:
        // Mux video & audio cleanly using MPEG-TS container directly into task.outputPath (.mp4)
        // to preserve microsecond-accurate PTS timestamp synchronization without FFmpeg MP4 desync!
        const muxArgs = ['-y', '-hide_banner', '-loglevel', 'error', '-i', tempVideoTs];
        for (const af of tempAudioFiles) {
          if (fs.existsSync(af.path)) {
            muxArgs.push('-i', af.path);
          }
        }
        muxArgs.push('-map', '0:v:0');
        tempAudioFiles.forEach((af, idx) => {
          muxArgs.push('-map', `${idx + 1}:a:0`);
          if (af.name) {
            muxArgs.push(`-metadata:s:a:${idx}`, `title=${af.name}`);
          }
        });
        muxArgs.push('-f', 'mpegts', '-c', 'copy', task.outputPath);

        await new Promise((resolve, reject) => {
          const child = spawn(ffmpegPath, muxArgs, {
            windowsHide: true,
            stdio: ['ignore', 'ignore', 'pipe']
          });
          this.activeProcesses.set(task.id, child);

          let errText = '';
          child.stderr.on('data', (c) => { errText += c.toString(); });
          child.on('error', reject);
          child.on('close', (code) => {
            this.activeProcesses.delete(task.id);
            if (code === 0 && fs.existsSync(task.outputPath)) {
              resolve();
            } else {
              reject(new Error(errText.trim() || `FFmpeg TS mux exited with code ${code}`));
            }
          });
        });
      }

      cleanupTemps();
      this.activeControllers.delete(task.id);

      const stat = fs.statSync(task.outputPath);
      task.status = 'completed';
      task.percent = 100;
      task.speed = 'Completed';
      task.sizeFormatted = formatBytes(stat.size);
      task.completedAt = Date.now();
      logger.info(`HLS download & packaging completed: ${task.outputPath} (${task.sizeFormatted})`);
      this._broadcastComplete(task);
    } catch (err) {
      cleanupTemps();
      this.activeControllers.delete(task.id);
      if (cancelState.cancelled || task.status === 'cancelled') {
        try { if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath); } catch {}
        return;
      }
      throw err;
    }
  }

  /**
   * Execute direct FFmpeg download for progressive/non-HLS streams
   */
  _spawnFfmpegDownload(task, customHeaders = {}) {
    const ffmpegPath = mediaResolver.FFMPEG_PATH;
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      task.status = 'error';
      task.error = 'Bundled FFmpeg executable could not be resolved.';
      this._broadcastError(task);
      return;
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
      });

      child.on('close', (code) => {
        this.activeProcesses.delete(task.id);
        this.activeControllers.delete(task.id);

        if (task.status === 'cancelled') {
          try {
            if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath);
          } catch {}
          return;
        }

        if (code === 0 && fs.existsSync(task.outputPath)) {
          const stat = fs.statSync(task.outputPath);
          task.status = 'completed';
          task.percent = 100;
          task.sizeFormatted = formatBytes(stat.size);
          task.completedAt = Date.now();
          logger.info(`Download completed successfully: ${task.outputPath} (${task.sizeFormatted})`);
          this._broadcastComplete(task);
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
        }
      });
    } catch (err) {
      task.status = 'error';
      task.error = err.message;
      this.activeProcesses.delete(task.id);
      this.activeControllers.delete(task.id);
      this._broadcastError(task);
    }
  }

  /**
   * Cancel an active or queued download
   */
  cancelDownload(id) {
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
          spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
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
        fs.unlinkSync(task.outputPath);
      }
    } catch {}

    this._broadcastProgress(task);
    this._syncTaskbarProgress();
    return true;
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
        timeFormatted: task.timeFormatted
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
  createDownloadManager
};
