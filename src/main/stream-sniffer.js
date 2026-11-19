// src/main/stream-sniffer.js
// Headless Webpage Stream & Subtitle Sniffer + Dynamic CDN Header Registry for CopyCat Media Player
// Features:
//  - Dynamic CDN Header Registry: records exact Referer/Origin headers for any sniffed stream host
//  - Universal pattern matching for strm.cx / *.top/(m|a|s)/ CDNs (frostheron, coastowl, keeply, etc.)
//  - 5-minute in-memory sniff cache for instant 0ms re-probes (Probe -> Play -> Download)
//  - 450ms settle window to prioritize Master HLS playlists and capture companion .vtt/.srt subtitles

const { BrowserWindow, session } = require('electron');
const { createLogger } = require('./logger');

const logger = createLogger('StreamSniffer');

const SNIFF_CACHE_TTL_MS = 5 * 60 * 1000;
const sniffCache = new Map(); // webpageUrl -> { timestamp, result }

// Dynamic registry mapping CDN hostnames (e.g. coralarch.coastowl.top) -> { Referer, Origin }
const hostHeaderRegistry = new Map();

/**
 * Check if a URL matches the strm.cx / Miruro CDN pattern (*.top/m/*, *.top/a/*, etc.)
 */
function isStrmCdnUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  return /strm\.cx|miruro|frostheron|coastowl|keeply|\.top\/(m|a|s)\//i.test(targetUrl);
}

/**
 * Register custom Referer / Origin headers for a discovered stream CDN hostname
 */
function registerStreamHostHeaders(targetUrl, headers = {}) {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    if (!host) return;
    const existing = hostHeaderRegistry.get(host) || {};
    hostHeaderRegistry.set(host, {
      Referer: headers.Referer || existing.Referer || 'https://strm.cx/',
      Origin: headers.Origin || existing.Origin || 'https://strm.cx'
    });
  } catch {}
}

/**
 * Resolve the required anti-hotlink Referer & Origin headers for any stream or segment URL
 */
function getRequiredHeadersForUrl(targetUrl, customHeaders = {}) {
  let parsed = null;
  try { parsed = new URL(targetUrl); } catch {}
  const host = parsed ? parsed.hostname.toLowerCase() : '';
  const defaultOrigin = parsed ? parsed.origin : '';

  const registered = host ? hostHeaderRegistry.get(host) : null;
  const isStrm = Boolean(registered || isStrmCdnUrl(targetUrl));

  const referer = customHeaders.Referer
    || registered?.Referer
    || (isStrm ? 'https://strm.cx/' : defaultOrigin);

  const origin = customHeaders.Origin
    || registered?.Origin
    || (isStrm ? 'https://strm.cx' : defaultOrigin);

  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ...(referer ? { 'Referer': referer } : {}),
    ...(origin ? { 'Origin': origin } : {}),
    ...customHeaders
  };
}

/**
 * Sniff and extract the primary media stream and companion subtitles from any webpage URL
 * @param {string} webpageUrl
 * @param {number} timeoutMs
 * @returns {Promise<{ streamUrl: string, title: string, isHls: boolean, isDash: boolean, subtitles: Array<{url: string, label: string}>, pageUrl: string } | null>}
 */
function extractStreamFromWebpage(webpageUrl, timeoutMs = 9500) {
  const normalizedUrl = (webpageUrl || '').trim();
  const cached = sniffCache.get(normalizedUrl);
  if (cached && (Date.now() - cached.timestamp < SNIFF_CACHE_TTL_MS)) {
    logger.info('Returning cached stream sniff result for:', normalizedUrl);
    return Promise.resolve(cached.result);
  }

  const pageIsMiruro = /miruro|strm\.cx/i.test(normalizedUrl);
  let pageOrigin = '';
  try { pageOrigin = new URL(normalizedUrl).origin; } catch {}

  return new Promise((resolve) => {
    let finished = false;
    let snifferWin = null;
    let timer = null;
    let settleTimer = null;

    const capturedStreams = [];
    const capturedSubtitles = [];
    let activeLangCheck = null;

    const finalize = (result) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (settleTimer) clearTimeout(settleTimer);
      if (snifferWin && !snifferWin.isDestroyed()) {
        try {
          snifferWin.destroy();
        } catch {}
      }
      snifferWin = null;

      if (result && result.streamUrl) {
        sniffCache.set(normalizedUrl, {
          timestamp: Date.now(),
          result
        });
      }
      resolve(result);
    };

    const buildResultFromCaptured = (langCheck = null) => {
      if (capturedStreams.length === 0) return null;
      const primary = capturedStreams[0];
      const pageTitle = snifferWin && !snifferWin.isDestroyed() ? snifferWin.webContents.getTitle() : '';
      const check = langCheck || activeLangCheck;

      let subStreamUrl = primary.url;
      let dubStreamUrl = null;

      if (capturedStreams.length >= 2 && check && check.hasAlternate) {
        if (check.current === 'sub') {
          subStreamUrl = primary.url;
          dubStreamUrl = capturedStreams[1].url;
        } else {
          dubStreamUrl = primary.url;
          subStreamUrl = capturedStreams[1].url;
        }
      }

      return {
        streamUrl: primary.url,
        subStreamUrl,
        dubStreamUrl,
        title: pageTitle || 'Extracted Video Stream',
        isHls: primary.isHls,
        isDash: primary.isDash,
        subtitles: capturedSubtitles.slice(0, 8),
        pageUrl: normalizedUrl
      };
    };

    timer = setTimeout(() => {
      logger.debug('Sniffer timeout reached');
      finalize(buildResultFromCaptured());
    }, timeoutMs);

    try {
      const partition = `sniffer-${Date.now()}`;
      const sniffSession = session.fromPartition(partition);

      sniffSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const u = details.url;
        if (isStrmCdnUrl(u)) {
          details.requestHeaders['Referer'] = 'https://strm.cx/';
          details.requestHeaders['Origin'] = 'https://strm.cx';
          registerStreamHostHeaders(u, {
            Referer: 'https://strm.cx/',
            Origin: 'https://strm.cx'
          });
        } else {
          // Record any live Referer/Origin that the embedded player sets on media CDN hosts
          const ref = details.requestHeaders['Referer'] || details.requestHeaders['referer'] || details.referrer || '';
          const orig = details.requestHeaders['Origin'] || details.requestHeaders['origin'] || '';
          if (ref || orig || pageIsMiruro) {
            const effectiveRef = pageIsMiruro ? 'https://strm.cx/' : (ref || (pageOrigin ? `${pageOrigin}/` : ''));
            const effectiveOrig = pageIsMiruro ? 'https://strm.cx' : (orig || pageOrigin || '');
            if (effectiveRef && (/\.m3u8|\/m\/|\/a\/|\.mpd|\.mp4/i.test(u))) {
              registerStreamHostHeaders(u, {
                Referer: effectiveRef,
                Origin: effectiveOrig
              });
            }
          }
        }
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      });

      sniffSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        const u = details.url;
        const lower = u.toLowerCase();

        const isAd = (
          lower.includes('google-analytics') ||
          lower.includes('doubleclick') ||
          lower.includes('adservice') ||
          lower.includes('popads') ||
          lower.includes('exoclick')
        );

        if (!isAd && !finished) {
          // 1. Check for subtitle tracks (.vtt / .srt)
          if ((/\.(vtt|srt)(\?|$)/i.test(u) || lower.includes('/sub.vtt')) && !lower.includes('thumb') && !lower.includes('sprite')) {
            if (!capturedSubtitles.some((s) => s.url === u)) {
              let subLabel = 'Subtitle';
              try {
                const seg = new URL(u).pathname.split('/').pop() || '';
                subLabel = seg.replace(/\.(vtt|srt)$/i, '') || `Track ${capturedSubtitles.length + 1}`;
              } catch {}
              capturedSubtitles.push({ url: u, label: subLabel });
            }
          }

          // 2. Check for media streams (.m3u8, .mpd, .mp4, .webm)
          const isHls = lower.includes('.m3u8') || lower.includes('/m/') || lower.includes('/pl.');
          const isDash = lower.includes('.mpd');
          const isDirectVideo = /\.(mp4|webm)(\?|$)/i.test(u);

          if (isHls || isDash || isDirectVideo) {
            if (pageIsMiruro || isStrmCdnUrl(u)) {
              registerStreamHostHeaders(u, {
                Referer: 'https://strm.cx/',
                Origin: 'https://strm.cx'
              });
            }
            if (!capturedStreams.some((s) => s.url === u)) {
              logger.info('Sniffer captured media stream:', u);
              capturedStreams.push({ url: u, isHls, isDash });

              if (capturedStreams.length === 1 && (pageIsMiruro || isStrmCdnUrl(u))) {
                if (snifferWin && !snifferWin.isDestroyed()) {
                  snifferWin.webContents.executeJavaScript(`
                    (() => {
                      try {
                        const langBtn = document.querySelector('button[aria-label="Language"]') || 
                          Array.from(document.querySelectorAll('button')).find(b => /^(sub|dub)$/i.test(b.innerText.trim()));
                        if (!langBtn) return { hasAlternate: false };
                        const currentText = (langBtn.innerText || '').trim().toLowerCase();
                        const target = currentText === 'sub' ? 'dub' : 'sub';
                        langBtn.click();
                        setTimeout(() => {
                          try {
                            const candidates = Array.from(document.querySelectorAll('[role="option"], [data-radix-collection-item], button, div, span'));
                            const targetEl = candidates.find(el => el.innerText && el.innerText.trim().toLowerCase() === target);
                            if (targetEl) targetEl.click();
                          } catch {}
                        }, 250);
                        return { hasAlternate: true, current: currentText, target };
                      } catch {
                        return { hasAlternate: false };
                      }
                    })()
                  `).then((langCheck) => {
                    activeLangCheck = langCheck;
                    if (langCheck && langCheck.hasAlternate) {
                      logger.info(`Detected alternate language track (${langCheck.target}), waiting for alternate stream...`);
                      if (settleTimer) clearTimeout(settleTimer);
                      settleTimer = setTimeout(() => {
                        finalize(buildResultFromCaptured(langCheck));
                      }, 2500);
                    } else if (!settleTimer) {
                      settleTimer = setTimeout(() => {
                        finalize(buildResultFromCaptured());
                      }, 450);
                    }
                  }).catch(() => {
                    if (!settleTimer) {
                      settleTimer = setTimeout(() => {
                        finalize(buildResultFromCaptured());
                      }, 450);
                    }
                  });
                } else if (!settleTimer) {
                  settleTimer = setTimeout(() => {
                    finalize(buildResultFromCaptured());
                  }, 450);
                }
              } else if (capturedStreams.length >= 2) {
                if (settleTimer) clearTimeout(settleTimer);
                settleTimer = setTimeout(() => {
                  finalize(buildResultFromCaptured(activeLangCheck || { hasAlternate: true, current: 'sub', target: 'dub' }));
                }, 350);
              } else if (!settleTimer) {
                settleTimer = setTimeout(() => {
                  finalize(buildResultFromCaptured());
                }, 450);
              }
            }
          }
        }

        callback({});
      });

      snifferWin = new BrowserWindow({
        show: false,
        width: 1280,
        height: 720,
        webPreferences: {
          session: sniffSession,
          webSecurity: false,
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      snifferWin.webContents.setAudioMuted(true);

      snifferWin.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          if (finished || !snifferWin || snifferWin.isDestroyed() || capturedStreams.length > 0) return;
          snifferWin.webContents.executeJavaScript(`
            try {
              const v = document.querySelector('video');
              if (v) { v.muted = true; v.play().catch(() => {}); }
              const playBtn = document.querySelector('[aria-label*="Play" i], .vds-play-button, .jw-icon-display, .plyr__control--overlaid');
              if (playBtn) playBtn.click();
            } catch {}
          `).catch(() => {});
        }, 700);
      });

      snifferWin.loadURL(normalizedUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }).catch((err) => {
        logger.debug('Sniffer page load notice:', err.message);
      });
    } catch (err) {
      logger.error('Failed to launch stream sniffer:', err.message);
      finalize(null);
    }
  });
}

module.exports = {
  extractStreamFromWebpage,
  registerStreamHostHeaders,
  getRequiredHeadersForUrl,
  isStrmCdnUrl
};
