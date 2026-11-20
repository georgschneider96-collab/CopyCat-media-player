// src/main/sniffers/generic-sniffer.js
// Universal Fallback Sniffer Strategy for General Web Media & HTML5 Video Platforms

const genericSniffer = {
  name: 'GenericSniffer',

  /**
   * Universal catch-all fallback
   */
  matches(_url) {
    return true;
  },

  playSelectors: '#big_play, .bigplay, .play_button, [aria-label*="Play" i], .jw-icon-display, .plyr__control--overlaid',
  settleDelayMs: 850,

  /**
   * Classify universal media stream requests (.m3u8, .mpd, .mp4, .webm, or resourceType === 'media')
   */
  classifyMediaRequest(details, u, lower) {
    const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot|ico)(\?|$)/i.test(u);
    if (isStaticAsset) return null;

    const isHls = lower.includes('.m3u8') || lower.includes('/m/') || lower.includes('/pl.');
    const isDash = lower.includes('.mpd');
    const isDirectVideo = (
      details.resourceType === 'media' ||
      /\.(mp4|webm|m4v|mkv)(\?|$)/i.test(u) ||
      lower.includes('.mp4') ||
      lower.includes('.webm')
    );

    if (isHls || isDash || isDirectVideo) {
      return { isHls, isDash, isDirectVideo };
    }
    return null;
  }
};

module.exports = genericSniffer;
