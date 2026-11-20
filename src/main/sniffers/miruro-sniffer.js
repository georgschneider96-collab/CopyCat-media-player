// src/main/sniffers/miruro-sniffer.js
// Dedicated Sniffer Strategy for Miruro & strm.cx Anime Streaming Platforms

const { isStrmCdnUrl, logger } = require('./base-sniffer');

const miruroSniffer = {
  name: 'MiruroSniffer',

  /**
   * Determine if this sniffer owns the given URL
   */
  matches(url) {
    if (!url || typeof url !== 'string') return false;
    return isStrmCdnUrl(url) || /miruro|strm\.cx/i.test(url);
  },

  playSelectors: '.vds-play-button, media-player [aria-label*="Play" i]',
  settleDelayMs: 850,

  /**
   * Custom request header handler for Miruro & strm.cx CDN domains
   */
  onBeforeSendHeaders(details, { registerStreamHostHeaders }) {
    const u = details.url;
    if (isStrmCdnUrl(u)) {
      details.requestHeaders['Referer'] = 'https://strm.cx/';
      details.requestHeaders['Origin'] = 'https://strm.cx';
      registerStreamHostHeaders(u, {
        Referer: 'https://strm.cx/',
        Origin: 'https://strm.cx'
      });
      return true;
    }
    return false;
  },

  /**
   * Classify media stream requests (.m3u8, /m/ playlists, /a/ audio, DASH)
   */
  classifyMediaRequest(details, u, lower) {
    const isHls = lower.includes('.m3u8') || lower.includes('/m/') || lower.includes('/pl.');
    const isDash = lower.includes('.mpd');
    const isDirectVideo = /\.(mp4|webm)(\?|$)/i.test(u) || lower.includes('.mp4') || lower.includes('.webm');
    if (isHls || isDash || isDirectVideo) {
      return { isHls, isDash, isDirectVideo };
    }
    return null;
  },

  /**
   * Automated sub/dub alternate stream discovery on first captured rendition
   */
  onStreamCaptured({ capturedStreams, snifferWin, resetSettleTimer, finalizeWithResult, onAlternateLanguageDetected }) {
    if (capturedStreams.length === 1) {
      if (snifferWin && !snifferWin.isDestroyed()) {
        snifferWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            try {
              const langBtn = document.querySelector('button[aria-label="Language"]') || 
                Array.from(document.querySelectorAll('button')).find(b => /^(sub|dub)$/i.test((b.innerText || '').trim()));
              if (!langBtn) return resolve({ hasAlternate: false });
              const currentText = (langBtn.innerText || '').trim().toLowerCase();
              const target = currentText === 'sub' ? 'dub' : 'sub';
              langBtn.click();
              setTimeout(() => {
                try {
                  const candidates = Array.from(document.querySelectorAll(
                    '[role="menuitem"], [role="option"], [data-radix-collection-item], [role="menu"] *, button, div, span'
                  ));
                  const targetEl = candidates.find(el => (el.innerText || '').trim().toLowerCase() === target);
                  if (targetEl) {
                    targetEl.click();
                    return resolve({ hasAlternate: true, current: currentText, target });
                  }
                  langBtn.click();
                  return resolve({ hasAlternate: false, current: currentText });
                } catch {
                  return resolve({ hasAlternate: false });
                }
              }, 350);
            } catch {
              return resolve({ hasAlternate: false });
            }
          });
        `).then((langCheck) => {
          if (langCheck && langCheck.hasAlternate) {
            onAlternateLanguageDetected(langCheck);
            logger.info(`[MiruroSniffer] Detected alternate language track (${langCheck.target}), waiting for alternate stream...`);
            resetSettleTimer(2500, () => finalizeWithResult(langCheck));
          } else {
            resetSettleTimer(850, () => finalizeWithResult(langCheck));
          }
        }).catch(() => {
          resetSettleTimer(850, () => finalizeWithResult());
        });
      } else {
        resetSettleTimer(850, () => finalizeWithResult());
      }
    } else if (capturedStreams.length >= 2) {
      resetSettleTimer(750, () => finalizeWithResult());
    }
  }
};

module.exports = miruroSniffer;
