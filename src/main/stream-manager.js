// src/main/stream-manager.js
// Dedicated Stream & Thumbnail Worker Process Lifecycle Manager for VLCopyCat

const fs = require('fs');
const { spawn } = require('child_process');
const { createLogger } = require('./logger');
const { getRequiredHeadersForUrl } = require('./stream-sniffer');

const logger = createLogger('StreamManager');
const MAX_THUMB_CACHE = 120;

class StreamProcessManager {
  constructor() {
    this.activeStreamProc = null;
    this.activeThumbProc = null;
    this.thumbCache = new Map();
  }

  /**
   * Safely terminate active FFmpeg live stream worker
   */
  killActiveStreamProc() {
    if (this.activeStreamProc) {
      const proc = this.activeStreamProc;
      this.activeStreamProc = null;
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
        logger.debug('Stream process kill notice:', err.message);
      }
    }
  }

  /**
   * Safely terminate active FFmpeg thumbnail worker
   */
  killActiveThumbProc() {
    if (this.activeThumbProc) {
      const proc = this.activeThumbProc;
      this.activeThumbProc = null;
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
        logger.debug('Thumbnail process kill notice:', err.message);
      }
    }
  }

  /**
   * Kill all background media worker processes
   */
  killAll() {
    this.killActiveStreamProc();
    this.killActiveThumbProc();
  }

  /**
   * Build anti-hotlink HTTP headers string for FFmpeg network inputs
   */
  _buildNetworkHeaders(targetUrl) {
    const hdrs = getRequiredHeadersForUrl(targetUrl);
    return Object.entries(hdrs).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n';
  }

  /**
   * Handle incoming HTTP /api/stream requests
   * Streams fragmented MP4 over HTTP using FFmpeg (supports local files and remote HLS/HTTP streams)
   * @param {URL} urlObj
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Object} mediaService
   */
  handleStreamRequest(urlObj, req, res, mediaService) {
    const filePath = urlObj.searchParams.get('path') || '';
    const audioPath = urlObj.searchParams.get('audio') || '';
    const startSec = Math.max(0, Number(urlObj.searchParams.get('start')) || 0);
    const vcodec = (urlObj.searchParams.get('vcodec') || '').toLowerCase();
    const forceTranscode = urlObj.searchParams.get('transcode') === '1';

    const ffmpegPath = mediaService.getFfmpegPath();
    const isHttpUrl = /^https?:\/\//i.test(filePath);
    if (!ffmpegPath || !filePath || (!isHttpUrl && !fs.existsSync(filePath))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Media file or FFmpeg binary not found');
      return;
    }

    this.killActiveStreamProc();

    const canCopyVideo = !forceTranscode && (!vcodec || ['h264', 'avc1', 'mp4v'].includes(vcodec) || isHttpUrl);
    const args = ['-hide_banner', '-loglevel', 'error'];

    if (isHttpUrl) {
      args.push(
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-extension_picky', '0',
        '-allowed_segment_extensions', 'ALL',
        '-headers', this._buildNetworkHeaders(filePath)
      );
    }

    if (startSec > 0.05) {
      args.push('-ss', startSec.toFixed(3));
    }

    args.push('-i', filePath);

    if (audioPath && /^https?:\/\//i.test(audioPath)) {
      args.push(
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-extension_picky', '0',
        '-allowed_segment_extensions', 'ALL',
        '-headers', this._buildNetworkHeaders(audioPath)
      );
      if (startSec > 0.05) {
        args.push('-ss', startSec.toFixed(3));
      }
      args.push('-i', audioPath);
      args.push('-map', '0:v:0?', '-map', '1:a:0?');
    } else {
      args.push('-map', '0:v:0?', '-map', '0:a:0?');
    }

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

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    this.activeStreamProc = proc;

    proc.stdout.pipe(res);

    const cleanup = () => {
      if (this.activeStreamProc === proc) {
        this.activeStreamProc = null;
      }
      try {
        proc.kill('SIGKILL');
      } catch {}
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    proc.on('error', cleanup);
  }

  /**
   * Handle incoming HTTP /api/thumb requests
   * Extracts instant on-demand JPEG frame for timeline hover preview
   * @param {URL} urlObj
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {Object} mediaService
   */
  handleThumbRequest(urlObj, req, res, mediaService) {
    const filePath = urlObj.searchParams.get('path') || '';
    const timeSec = Math.max(0, Number(urlObj.searchParams.get('t')) || 0);

    const ffmpegPath = mediaService.getFfmpegPath();
    const isHttpUrl = /^https?:\/\//i.test(filePath);
    if (!ffmpegPath || !filePath || (!isHttpUrl && !fs.existsSync(filePath))) {
      res.writeHead(404);
      res.end();
      return;
    }

    const cacheKey = `${filePath}:${timeSec.toFixed(1)}`;
    if (this.thumbCache.has(cacheKey)) {
      const cachedBuf = this.thumbCache.get(cacheKey);
      this.thumbCache.delete(cacheKey);
      this.thumbCache.set(cacheKey, cachedBuf);

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=180',
        'Content-Length': cachedBuf.length
      });
      res.end(cachedBuf);
      return;
    }

    this.killActiveThumbProc();

    const args = [
      '-hide_banner',
      '-loglevel', 'error'
    ];

    if (isHttpUrl) {
      args.push(
        '-extension_picky', '0',
        '-allowed_segment_extensions', 'ALL',
        '-headers', this._buildNetworkHeaders(filePath)
      );
    }

    args.push(
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
    );

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=180'
    });

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    this.activeThumbProc = proc;

    const chunks = [];
    proc.stdout.on('data', (c) => chunks.push(c));
    proc.stdout.pipe(res);

    const cleanup = () => {
      if (this.activeThumbProc === proc) {
        this.activeThumbProc = null;
      }
      try {
        proc.kill('SIGKILL');
      } catch {}
    };

    req.on('close', cleanup);
    proc.on('close', () => {
      if (this.activeThumbProc === proc) {
        this.activeThumbProc = null;
      }
      if (chunks.length > 0) {
        const fullBuf = Buffer.concat(chunks);
        if (fullBuf.length > 80) {
          if (this.thumbCache.size >= MAX_THUMB_CACHE) {
            const oldestKey = this.thumbCache.keys().next().value;
            this.thumbCache.delete(oldestKey);
          }
          this.thumbCache.set(cacheKey, fullBuf);
        }
      }
    });
    proc.on('error', cleanup);
  }
}

function createStreamManager() {
  return new StreamProcessManager();
}

module.exports = {
  StreamProcessManager,
  createStreamManager
};
