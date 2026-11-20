// src/main/sniffers/videa-sniffer.js
// Dedicated Sniffer Strategy for Hungarian Anime & Video Streaming Hosts (Videa, JobbMintATv, Indavideo)

const videaSniffer = {
  name: 'VideaSniffer',

  /**
   * Determine if this sniffer owns the given URL
   */
  matches(url) {
    if (!url || typeof url !== 'string') return false;
    return /videa\.hu|jobbmintatv\.pro|indavideo\.hu/i.test(url);
  },

  playSelectors: '.vjs-big-play-button, #big_play, .play_button, .vjs-play-control',
  settleDelayMs: 650,

  /**
   * Filter out known video ad networks common on Hungarian aggregator sites
   */
  isAdUrl(url, _details) {
    const lower = url.toLowerCase();
    return (
      lower.includes('adocean') ||
      lower.includes('2mdn.net') ||
      lower.includes('indidata.com') ||
      lower.includes('gemius.pl') ||
      lower.includes('cfusion-internet.com')
    );
  },

  /**
   * Register host headers for Videa and Indavideo CDN edges
   */
  onBeforeSendHeaders(details, { registerStreamHostHeaders, pageOrigin }) {
    const u = details.url;
    const lower = u.toLowerCase();
    const ref = details.requestHeaders['Referer'] || details.requestHeaders['referer'] || details.referrer || '';
    const orig = details.requestHeaders['Origin'] || details.requestHeaders['origin'] || '';

    if (lower.includes('videa.hu')) {
      const effectiveRef = ref || 'https://videa.hu/';
      const effectiveOrig = orig || 'https://videa.hu';
      registerStreamHostHeaders(u, { Referer: effectiveRef, Origin: effectiveOrig });
      return true;
    }

    if (lower.includes('indavideo.hu')) {
      const effectiveRef = ref || 'https://embed.indavideo.hu/';
      const effectiveOrig = orig || 'https://embed.indavideo.hu';
      registerStreamHostHeaders(u, { Referer: effectiveRef, Origin: effectiveOrig });
      return true;
    }

    if (ref || orig) {
      registerStreamHostHeaders(u, {
        Referer: ref || (pageOrigin ? `${pageOrigin}/` : ''),
        Origin: orig || pageOrigin || ''
      });
      return true;
    }

    return false;
  },

  /**
   * Classify progressive MP4 media streams or HLS playlists from Videa & Indavideo
   */
  classifyMediaRequest(details, u, lower) {
    const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot|ico)(\?|$)/i.test(u);
    if (isStaticAsset) return null;

    const isHls = lower.includes('.m3u8') || lower.includes('/m/');
    const isDash = lower.includes('.mpd');
    const isDirectVideo = (
      details.resourceType === 'media' ||
      /\.(mp4|webm|m4v)(\?|$)/i.test(u) ||
      lower.includes('.mp4') ||
      (lower.includes('video') && /\/static\/[0-9]+p\//.test(lower)) ||
      (lower.includes('indavideo.hu') && details.resourceType === 'media')
    );

    if (isHls || isDash || isDirectVideo) {
      return { isHls, isDash, isDirectVideo };
    }
    return null;
  }
};

module.exports = videaSniffer;
