// src/main/stream-sniffer.js
// Modular Sniffer Router & Dispatcher for CopyCat Media Player
// Routes stream sniffing tasks to specialized strategies (Miruro, Videa, Generic HTML5)

const {
  isStrmCdnUrl,
  registerStreamHostHeaders,
  getRequiredHeadersForUrl,
  sniffCache,
  SNIFF_CACHE_TTL_MS,
  runSnifferSession,
  logger
} = require('./sniffers/base-sniffer');

const miruroSniffer = require('./sniffers/miruro-sniffer');
const videaSniffer = require('./sniffers/videa-sniffer');
const genericSniffer = require('./sniffers/generic-sniffer');

// Ordered list of specialized sniffer strategies (highest specificity to fallback)
const SNIFFER_STRATEGIES = [
  miruroSniffer,
  videaSniffer,
  genericSniffer
];

/**
 * Resolve the most appropriate sniffer strategy for a given URL
 * @param {string} url
 * @returns {object} The matching sniffer strategy
 */
function getSnifferStrategy(url) {
  if (!url || typeof url !== 'string') return genericSniffer;
  const trimmed = url.trim();
  const matched = SNIFFER_STRATEGIES.find((strategy) => {
    try {
      return typeof strategy.matches === 'function' && strategy.matches(trimmed);
    } catch {
      return false;
    }
  });
  return matched || genericSniffer;
}

/**
 * Sniff and extract the primary media stream and companion subtitles from any webpage URL
 * Automatically routes to the optimal sniffer strategy based on URL pattern and host.
 *
 * @param {string} webpageUrl
 * @param {number} timeoutMs
 * @returns {Promise<{ streamUrl: string, title: string, isHls: boolean, isDash: boolean, subtitles: Array<{url: string, label: string}>, pageUrl: string } | null>}
 */
function extractStreamFromWebpage(webpageUrl, timeoutMs = 9500) {
  const normalizedUrl = (webpageUrl || '').trim();

  // 1. Check in-memory 5-minute sniff cache for instant re-probes
  const cached = sniffCache.get(normalizedUrl);
  if (cached && (Date.now() - cached.timestamp < SNIFF_CACHE_TTL_MS)) {
    if (cached.result && Array.isArray(cached.result.subtitles) && cached.result.subtitles.length > 0) {
      logger.info('Returning cached stream sniff result with subtitles for:', normalizedUrl);
      return Promise.resolve(cached.result);
    }
  }

  // 2. Select specialized sniffer strategy based on URL
  const strategy = getSnifferStrategy(normalizedUrl);
  logger.info(`[Router] Selected sniffer strategy "${strategy.name}" for target: ${normalizedUrl}`);

  // 3. Delegate to core runner with selected strategy
  return runSnifferSession(normalizedUrl, timeoutMs, strategy);
}

module.exports = {
  extractStreamFromWebpage,
  registerStreamHostHeaders,
  getRequiredHeadersForUrl,
  isStrmCdnUrl,
  getSnifferStrategy,
  SNIFFER_STRATEGIES
};
