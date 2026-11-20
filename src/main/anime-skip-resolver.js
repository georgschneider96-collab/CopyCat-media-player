// src/main/anime-skip-resolver.js
// Automated MyAnimeList & AniSkip Integration for CopyCat Media Player
// Resolves anime title -> MAL ID via AniList GraphQL, queries AniSkip for exact OP/ED intervals,
// and bakes contiguous chapter atoms directly into downloaded or local MP4/MKV files via FFmpeg stream-copy.

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('AnimeSkipResolver');

// In-memory caches to prevent redundant network requests
const malIdCache = new Map(); // seriesTitle.toLowerCase() -> malId
const skipTimesCache = new Map(); // `${malId}_${episode}` -> skipData

/**
 * Perform a resilient HTTPS request with strict timeout
 */
function requestJson(url, options = {}, postData = null, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return reject(e);
    }

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || (postData ? 'POST' : 'GET'),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        ...(postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(options.headers || {})
      },
      timeout: timeoutMs
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json, raw: data });
        } catch {
          resolve({ status: res.statusCode, json: null, raw: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms: ${url}`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Extract series title and integer episode number from raw filename or stream title
 * Handles:
 *  - "The Exiled Heavy Knight Knows How to Game the System - Episode 21"
 *  - "The Exiled Heavy Knight Knows How to Game the System - 21"
 *  - "Solo Leveling S01E08 (1080p)"
 *  - "[Erai-raws] DanMachi Season 5 - Episode 03 [1080p][Multiple Subtitle].mp4"
 */
function parseAnimeTitleAndEpisode(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return null;

  let clean = rawTitle.replace(/\.(mp4|mkv|webm|avi|ts|mov)$/i, '').trim();

  // Strip leading/trailing release group or resolution brackets e.g. [Erai-raws], [1080p]
  clean = clean.replace(/^\[[^\]]+\]\s*/, '').replace(/\s*\[[^\]]+\]$/, '');
  clean = clean.replace(/\s*\([^)]*(1080p|720p|480p|x264|x265|hevc|sub|dub|multi)[^)]*\)/gi, '');
  clean = clean.replace(/\s*\[[^\]]*(1080p|720p|480p|x264|x265|hevc|sub|dub|multi)[^\]]*\]/gi, '');

  let title = '';
  let episode = null;

  // Pattern 1: Title - Episode 21 or Title Ep. 21
  const epWordMatch = clean.match(/^(.*?)(?:[\s\-_]+(?:episode|ep\.?|folge)[\s\-_]*(\d+))(?:\s*\(?.*)?$/i);
  if (epWordMatch) {
    title = epWordMatch[1].trim();
    episode = parseInt(epWordMatch[2], 10);
  }

  // Pattern 2: Title S01E21 or Title S1E21
  if (!episode) {
    const sEpMatch = clean.match(/^(.*?)(?:[\s\-_]+s\d+[\s\-_]*e(\d+))(?:\s*\(?.*)?$/i);
    if (sEpMatch) {
      title = sEpMatch[1].trim();
      episode = parseInt(sEpMatch[2], 10);
    }
  }

  // Pattern 3: Title - 21 (Isolated episode number following a hyphen or separator)
  if (!episode) {
    const hyphenNumMatch = clean.match(/^(.*?)\s*-\s*(\d{1,4})(?:\s*\(?.*)?$/);
    if (hyphenNumMatch) {
      title = hyphenNumMatch[1].trim();
      episode = parseInt(hyphenNumMatch[2], 10);
    }
  }

  // Clean trailing hyphens, colons or spaces from title
  title = title.replace(/[\s\-_:]+$/, '').trim();

  if (title && Number.isInteger(episode) && episode > 0) {
    return { title, episode };
  }
  return null;
}

/**
 * Resolve series title to MyAnimeList ID via AniList GraphQL
 * Fast, free, robust, and requires zero API keys.
 */
async function resolveMalId(seriesTitle) {
  if (!seriesTitle || typeof seriesTitle !== 'string') return null;
  const key = seriesTitle.trim().toLowerCase();
  if (malIdCache.has(key)) {
    return malIdCache.get(key);
  }

  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          idMal
          title {
            english
            romaji
          }
        }
      }
    `;
    const payload = JSON.stringify({
      query,
      variables: { search: seriesTitle.trim() }
    });

    const res = await requestJson('https://graphql.anilist.co', {}, payload, 4000);
    if (res.status === 200 && res.json && res.json.data && res.json.data.Media) {
      const media = res.json.data.Media;
      const malId = media.idMal;
      if (malId) {
        malIdCache.set(key, malId);
        logger.info(`Resolved "${seriesTitle}" -> MAL ID ${malId} ("${media.title.english || media.title.romaji}")`);
        return malId;
      }
    }
  } catch (err) {
    logger.debug(`AniList resolution failed for "${seriesTitle}":`, err.message);
  }

  malIdCache.set(key, null);
  return null;
}

/**
 * Low-level query to AniSkip API for raw skip intervals
 */
async function fetchAniSkipRaw(malId, episodeNumber, durationSec = 1420) {
  try {
    const durParam = Math.round(durationSec > 0 ? durationSec : 1420);
    const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types=op&types=ed&types=mixed-op&types=mixed-ed&types=recap&episodeLength=${durParam}`;
    const res = await requestJson(url, {}, null, 3500);

    if (res.status === 200 && res.json && res.json.found && Array.isArray(res.json.results)) {
      let op = null;
      let ed = null;

      for (const item of res.json.results) {
        if (!item || !item.interval) continue;
        const start = parseFloat(item.interval.startTime);
        const end = parseFloat(item.interval.endTime);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

        if (!op && (item.skipType === 'op' || item.skipType === 'mixed-op')) {
          op = { start, end };
        } else if (!ed && (item.skipType === 'ed' || item.skipType === 'mixed-ed')) {
          ed = { start, end };
        }
      }
      return { op, ed };
    }
  } catch (err) {
    logger.debug(`AniSkip raw fetch failed for MAL ID ${malId} ep ${episodeNumber}:`, err.message);
  }
  return { op: null, ed: null };
}

/**
 * Fetch opening and ending skip intervals from AniSkip API
 * Strictly returns verified community intervals for the requested episode without guessing.
 * @param {number} malId MyAnimeList ID
 * @param {number} episodeNumber Episode number
 * @param {number} durationSec Media duration in seconds (for episode boundary validation)
 * @returns {Promise<{ op: { start: number, end: number } | null, ed: { start: number, end: number } | null } | null>}
 */
async function fetchAnimeSkipTimes(malId, episodeNumber, durationSec = 1420) {
  if (!malId || !episodeNumber) return null;
  const cacheKey = `${malId}_${episodeNumber}`;
  if (skipTimesCache.has(cacheKey)) {
    return skipTimesCache.get(cacheKey);
  }

  const dur = durationSec > 0 ? durationSec : 1420;
  const current = await fetchAniSkipRaw(malId, episodeNumber, dur);
  const op = current.op;
  const ed = current.ed;

  if (op || ed) {
    const result = { op, ed };
    skipTimesCache.set(cacheKey, result);
    logger.info(`Anime skip times resolved for MAL ID ${malId} ep ${episodeNumber}: OP=${JSON.stringify(op)}, ED=${JSON.stringify(ed)}`);
    return result;
  }

  skipTimesCache.set(cacheKey, null);
  return null;
}

/**
 * Build a contiguous, gap-free list of chapters across the full video duration
 * Strictly maps only verified AniSkip intervals (no guessing).
 * Clamps all bounds within [0, totalDurationSec]
 */
function buildContiguousChapters(skipData, totalDurationSec) {
  if (!skipData || (!skipData.op && !skipData.ed)) return [];
  const dur = Math.max(10, totalDurationSec || 1420);
  const chapters = [];

  let curTime = 0;

  // 1. Opening segment
  if (skipData.op && skipData.op.start < dur) {
    const opStart = Math.max(0, Math.min(dur - 5, skipData.op.start));
    const opEnd = Math.max(opStart + 5, Math.min(dur, skipData.op.end));

    if (opStart > 1.5) {
      chapters.push({
        start: 0,
        end: opStart,
        title: 'Prologue'
      });
    }

    chapters.push({
      start: opStart,
      end: opEnd,
      title: 'Opening'
    });
    curTime = opEnd;
  }

  // 2. Main Episode content & Ending (strictly if verified ending was returned)
  if (skipData.ed && skipData.ed.start < dur) {
    const edStart = Math.max(curTime + 5, Math.min(dur - 5, skipData.ed.start));
    const edEnd = Math.max(edStart + 5, Math.min(dur, skipData.ed.end));

    if (edStart > curTime) {
      chapters.push({
        start: curTime,
        end: edStart,
        title: 'Episode'
      });
    }

    chapters.push({
      start: edStart,
      end: edEnd,
      title: 'Ending'
    });
    curTime = edEnd;
  }

  // 3. Remainder / Post-Credits / Preview
  if (curTime < dur - 1.0) {
    const isEndingPresent = chapters.some((c) => c.title === 'Ending');
    chapters.push({
      start: curTime,
      end: dur,
      title: isEndingPresent ? 'Preview' : 'Episode'
    });
  }

  return chapters;
}

/**
 * Format chapters array into standard FFmpeg ffmetadata text
 */
function generateFfmetadataText(chapters, title = '') {
  let out = ';FFMETADATA1\n';
  if (title) {
    out += `title=${title.replace(/[=;#]/g, '')}\n`;
  }
  out += '\n';

  for (const ch of chapters) {
    const startMs = Math.round(ch.start * 1000);
    const endMs = Math.round(ch.end * 1000);
    if (endMs <= startMs) continue;

    out += '[CHAPTER]\n';
    out += 'TIMEBASE=1/1000\n';
    out += `START=${startMs}\n`;
    out += `END=${endMs}\n`;
    out += `title=${(ch.title || 'Chapter').replace(/[=;#]/g, '')}\n\n`;
  }

  return out;
}

/**
 * Embed chapter metadata into an existing media file via FFmpeg stream-copy (-c copy)
 * Fast (~0.2s), lossless, and preserves all audio/video/subtitles and faststart.
 * Features resilient backup staging, safe rollback, and guaranteed temp file cleanup.
 */
async function embedChaptersIntoFile(filePath, chapters, title = '', ffmpegPath = null) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    throw new Error(`Target media file not found: ${filePath}`);
  }

  const ffmpeg = ffmpegPath || require('./media-resolver').FFMPEG_PATH;
  if (!ffmpeg) {
    throw new Error('Bundled FFmpeg executable could not be resolved.');
  }
  try {
    await fs.promises.access(ffmpeg, fs.constants.F_OK);
  } catch {
    throw new Error('Bundled FFmpeg executable could not be resolved.');
  }

  const metaText = generateFfmetadataText(chapters, title);
  const tempMetaPath = path.join(os.tmpdir(), `copycat_meta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`);
  const tempOutPath = path.join(path.dirname(filePath), `copycat_tmp_tagged_${Date.now()}_${path.basename(filePath)}`);
  let backupPath = null;

  const cleanupArtifacts = async () => {
    try {
      if (tempMetaPath) await fs.promises.unlink(tempMetaPath).catch(() => {});
    } catch {}
    try {
      if (tempOutPath) await fs.promises.unlink(tempOutPath).catch(() => {});
    } catch {}
    try {
      if (backupPath) await fs.promises.unlink(backupPath).catch(() => {});
    } catch {}
  };

  await fs.promises.writeFile(tempMetaPath, metaText, 'utf8');

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', filePath,
    '-i', tempMetaPath,
    '-map', '0',
    '-map_metadata', '0',
    '-map_chapters', '1',
    '-c', 'copy',
    '-movflags', '+faststart',
    tempOutPath
  ];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe']
      });

      let errText = '';
      child.stderr.on('data', (d) => { errText += d.toString(); });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', async (code) => {
        if (code === 0 && fs.existsSync(tempOutPath)) {
          try {
            const stat = await fs.promises.stat(tempOutPath);
            if (stat.size < 1024) {
              return reject(new Error('Embedded output file is empty or corrupted. Original file preserved.'));
            }

            // Resilient file replacement with safe rollback on Windows NTFS
            backupPath = path.join(path.dirname(filePath), `.copycat_bak_${Date.now()}_${path.basename(filePath)}`);
            let replaced = false;

            try {
              // Stage 1: Safely rename original file to temporary backup
              await fs.promises.rename(filePath, backupPath);
            } catch (bkErr) {
              // Fallback: If renaming original directly threw (e.g. active read lock), try atomic copy
              try {
                await fs.promises.copyFile(tempOutPath, filePath);
                replaced = true;
              } catch (copyErr) {
                return reject(new Error(`Could not access or replace target media file: ${copyErr.message}`));
              }
            }

            if (!replaced) {
              // Stage 2: Move the new chapter-tagged file to target filePath
              try {
                await fs.promises.rename(tempOutPath, filePath);
                // Stage 3: Successfully placed! Clean up backup
                try {
                  if (backupPath && fs.existsSync(backupPath)) await fs.promises.unlink(backupPath);
                  backupPath = null;
                } catch {}
                replaced = true;
              } catch (mvErr) {
                // Rollback: Restore original from backup to prevent any data loss!
                try {
                  if (fs.existsSync(backupPath)) {
                    await fs.promises.rename(backupPath, filePath);
                  }
                } catch (restoreErr) {
                  try {
                    await fs.promises.copyFile(backupPath, filePath);
                    await fs.promises.unlink(backupPath);
                    backupPath = null;
                  } catch {}
                }
                return reject(new Error(`Failed to place chapter-tagged file: ${mvErr.message}`));
              }
            }

            logger.info(`Successfully embedded ${chapters.length} anime chapters into: ${filePath}`);
            resolve({ success: true, chapters });
          } catch (swapErr) {
            reject(new Error(`Chapter swap error: ${swapErr.message}`));
          }
        } else {
          reject(new Error(errText.trim() || `FFmpeg chapter embed exited with code ${code}`));
        }
      });
    });

    return { success: true, chapters };
  } finally {
    await cleanupArtifacts();
  }
}

/**
 * Asynchronously probe media file duration via ffprobe without blocking the main event loop
 */
function probeDurationAsync(filePath) {
  return new Promise((resolve) => {
    try {
      const { FFPROBE_PATH } = require('./media-resolver');
      if (!FFPROBE_PATH) return resolve(0);
      fs.promises.access(FFPROBE_PATH, fs.constants.F_OK)
        .then(() => {
          const child = spawn(FFPROBE_PATH, [
            '-v', 'quiet', '-print_format', 'json', '-show_format', filePath
          ], { windowsHide: true });
          let out = '';
          child.stdout.on('data', (d) => { out += d.toString(); });
          child.on('close', (code) => {
            if (code === 0 && out.trim()) {
              try {
                const probeJson = JSON.parse(out);
                const dVal = parseFloat(probeJson.format?.duration || 0);
                return resolve(dVal || 0);
              } catch {}
            }
            resolve(0);
          });
          child.on('error', () => resolve(0));
        })
        .catch(() => resolve(0));
    } catch {
      resolve(0);
    }
  });
}

/**
 * Master automated handler:
 * Resolves anime title + episode number, queries MAL & AniSkip, and bakes chapters into the file.
 * Returns { success: boolean, chapters: Array, animeTitle: string, episode: number }
 */
async function autoTagAnimeFile(filePath, rawTitle = '', durationSec = 0) {
  const fallbackTitle = rawTitle || path.basename(filePath);
  const parsed = parseAnimeTitleAndEpisode(fallbackTitle);

  if (!parsed) {
    logger.debug(`File does not match anime episode naming pattern: "${fallbackTitle}"`);
    return { success: false, reason: 'not_anime_pattern' };
  }

  logger.info(`Detected anime: "${parsed.title}" Episode ${parsed.episode}`);

  // 1. Resolve MyAnimeList ID
  const malId = await resolveMalId(parsed.title);
  if (!malId) {
    logger.info(`No MyAnimeList match found for anime: "${parsed.title}"`);
    return { success: false, reason: 'no_mal_id' };
  }

  // 2. Fetch duration asynchronously if not provided (non-blocking)
  let dur = durationSec;
  if (!dur || dur <= 0) {
    dur = await probeDurationAsync(filePath);
  }
  if (!dur || dur <= 0) dur = 1420;

  // 3. Query AniSkip
  const skipData = await fetchAnimeSkipTimes(malId, parsed.episode, dur);
  if (!skipData || (!skipData.op && !skipData.ed)) {
    logger.info(`No community skip times found on AniSkip for "${parsed.title}" ep ${parsed.episode}`);
    return { success: false, reason: 'no_skip_times', malId };
  }

  // 4. Build contiguous chapters
  const chapters = buildContiguousChapters(skipData, dur);
  if (chapters.length === 0) {
    return { success: false, reason: 'empty_chapters' };
  }

  // 5. Bake chapters into media file
  await embedChaptersIntoFile(filePath, chapters, parsed.title);

  return {
    success: true,
    animeTitle: parsed.title,
    episode: parsed.episode,
    malId,
    chapters
  };
}

module.exports = {
  parseAnimeTitleAndEpisode,
  resolveMalId,
  fetchAnimeSkipTimes,
  buildContiguousChapters,
  generateFfmetadataText,
  embedChaptersIntoFile,
  autoTagAnimeFile
};
