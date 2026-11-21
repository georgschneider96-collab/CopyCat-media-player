// src/main/updater.js
// GitHub Releases Auto-Updater Engine for VLCopyCat

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');
const { spawn } = require('child_process');
const { shell, app } = require('electron');
const { createLogger } = require('./logger');

const logger = createLogger('Updater');
const GITHUB_REPO = 'georgschneider96-collab/CopyCat-media-player';

/**
 * Compare semantic versions (vX.Y.Z) with proper pre-release tag handling
 * @param {string} currentVer
 * @param {string} latestTag
 * @returns {boolean} True if latestTag is newer than currentVer
 */
function isNewerVersion(currentVer, latestTag) {
  if (!latestTag || !currentVer) return false;
  const cleanCurr = (currentVer || '').replace(/^v/i, '').trim();
  const cleanLate = (latestTag || '').replace(/^v/i, '').trim();

  const [coreCurr, preCurr] = cleanCurr.split('-', 2);
  const [coreLate, preLate] = cleanLate.split('-', 2);

  const pCurr = (coreCurr || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pLate = (coreLate || '').split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(pCurr.length, pLate.length); i++) {
    const c = pCurr[i] || 0;
    const l = pLate[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  // Core versions are identical (e.g. 1.3.0 vs 1.3.0-beta.1):
  // A release without pre-release suffix is newer than one with pre-release.
  if (!preCurr && preLate) return false; // 1.3.0 stable is newer than 1.3.0-beta.1
  if (preCurr && !preLate) return true;  // 1.3.0-beta.1 -> 1.3.0 stable is an upgrade
  return false;
}

/**
 * Extract trusted SHA-256 checksum for release asset from release body or companion metadata
 * @param {Object} release
 * @param {Object} asset
 * @returns {string|null}
 */
function extractExpectedSha256(release, asset) {
  if (!release || !asset) return null;
  const body = release.body || '';
  const assetName = asset.name || '';

  // 1. Filename-bound hash: `<hash> *CopyCat-Setup.exe` or `CopyCat-Setup.exe: <hash>`
  if (assetName) {
    const escapedName = assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameBoundPattern = new RegExp(`([a-fA-F0-9]{64})\\s+[*]?${escapedName}|${escapedName}[:\\s]+([a-fA-F0-9]{64})`, 'i');
    const match = body.match(nameBoundPattern);
    if (match) return (match[1] || match[2]).toLowerCase();
  }

  // 2. Explicit SHA-256 tag in release notes: `SHA-256: <hash>` or `Checksum: <hash>`
  const explicitMatch = body.match(/(?:sha[-_]?256|checksum)[\s:=]+([a-fA-F0-9]{64})/i);
  if (explicitMatch) return explicitMatch[1].toLowerCase();

  return null;
}

/**
 * Fetch remote companion .sha256 checksum file
 * @param {string} url
 * @param {number} maxRedirects
 * @returns {Promise<string|null>}
 */
function fetchCompanionSha256(url, maxRedirects = 4) {
  return new Promise((resolve) => {
    if (!url || maxRedirects <= 0) return resolve(null);
    https.get(url, { headers: { 'User-Agent': 'CopyCat-Media-Player' }, timeout: 6000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchCompanionSha256(res.headers.location, maxRedirects - 1).then(resolve);
      }
      if (res.statusCode !== 200) return resolve(null);
      let content = '';
      res.on('data', chunk => content += chunk);
      res.on('end', () => {
        const hashMatch = content.match(/([a-fA-F0-9]{64})/);
        resolve(hashMatch ? hashMatch[1].toLowerCase() : null);
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Query GitHub Releases API for latest release info
 * @returns {Promise<Object>}
 */
function checkForUpdates() {
  const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
  let currentVersion = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    currentVersion = pkg.version || '1.0.0';
  } catch {}

  return new Promise((resolve) => {
    const reqOptions = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'CopyCat-Media-Player',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.get(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            logger.warn(`GitHub API returned status ${res.statusCode}`);
            return resolve({ ok: false, error: `GitHub API status ${res.statusCode}` });
          }

          const release = JSON.parse(data);
          const latestTag = release.tag_name || '';
          const isNewer = isNewerVersion(currentVersion, latestTag);

          let asset = null;
          let checksumAsset = null;
          if (Array.isArray(release.assets) && release.assets.length > 0) {
            asset = release.assets.find((a) => a.name.toLowerCase().includes('setup') && a.name.endsWith('.exe'))
              || release.assets.find((a) => a.name.endsWith('.exe'))
              || release.assets[0];

            checksumAsset = release.assets.find((a) =>
              a.name.endsWith('.sha256') ||
              a.name.toLowerCase().includes('checksums') ||
              a.name.toLowerCase().includes('sha256sums') ||
              a.name === 'latest.yml'
            );
          }

          const expectedSha256 = extractExpectedSha256(release, asset);

          logger.info(`Update check: current=${currentVersion}, latest=${latestTag}, available=${isNewer}`);
          resolve({
            ok: true,
            updateAvailable: isNewer,
            currentVersion: `v${currentVersion.replace(/^v/i, '')}`,
            latestVersion: latestTag,
            releaseName: release.name || latestTag,
            releaseNotes: release.body || '',
            releaseUrl: release.html_url || '',
            asset: asset ? {
              name: asset.name,
              size: asset.size,
              downloadUrl: asset.browser_download_url,
              sha256: expectedSha256,
              checksumUrl: checksumAsset ? checksumAsset.browser_download_url : null
            } : null
          });
        } catch (err) {
          logger.error('Failed to parse update release response:', err.message);
          resolve({ ok: false, error: err.message });
        }
      });
    });

    req.on('error', (err) => {
      logger.warn('Update request network error:', err.message);
      resolve({ ok: false, error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      logger.warn('Update check timed out after 8s');
      resolve({ ok: false, error: 'Request timed out' });
    });
  });
}

/**
 * Download update setup asset with strict HTTPS, atomic staging, SHA-256 verification, and PE binary checks
 * @param {string} downloadUrl
 * @param {string} assetName
 * @param {Function} onProgress
 * @param {string|null} expectedSha256 Optional SHA-256 checksum to verify
 * @param {number} maxRedirects
 * @returns {Promise<string>} Downloaded verified file path
 */
function downloadUpdateAsset(downloadUrl, assetName, onProgress, expectedSha256 = null, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    const finalName = assetName || 'CopyCat-Update-Setup.exe';
    const destPath = path.join(os.tmpdir(), finalName);
    const tempPartPath = path.join(os.tmpdir(), `${finalName}.${Date.now()}.part`);

    function cleanup() {
      try { if (fs.existsSync(tempPartPath)) fs.unlinkSync(tempPartPath); } catch {}
    }

    function get(currentUrl, redirectsLeft) {
      if (redirectsLeft <= 0) {
        cleanup();
        return reject(new Error('Too many redirects while downloading update'));
      }

      const parsed = new URL(currentUrl);
      if (parsed.protocol !== 'https:') {
        cleanup();
        return reject(new Error(`Insecure download protocol rejected: ${parsed.protocol}. Only HTTPS allowed.`));
      }

      https.get({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'CopyCat-Media-Player',
          'Accept': 'application/octet-stream'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, currentUrl).href;
          return get(nextUrl, redirectsLeft - 1);
        }

        if (res.statusCode !== 200) {
          cleanup();
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let transferred = 0;
        let lastReport = 0;
        const hash = crypto.createHash('sha256');
        const fileStream = fs.createWriteStream(tempPartPath);

        res.on('data', (chunk) => {
          transferred += chunk.length;
          hash.update(chunk);
          const now = Date.now();
          if (now - lastReport > 80 || transferred === total) {
            lastReport = now;
            const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
            if (onProgress) onProgress({ percent, transferred, total });
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            try {
              // 1. Content size validation
              if (total > 0 && transferred !== total) {
                cleanup();
                return reject(new Error(`Incomplete download: transferred ${transferred}/${total} bytes`));
              }

              // 2. Computed SHA-256 hash
              const computedSha256 = hash.digest('hex');
              logger.info(`Downloaded asset SHA-256: ${computedSha256}`);

              if (expectedSha256 && computedSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
                cleanup();
                return reject(new Error(`Checksum mismatch! Expected: ${expectedSha256}, Got: ${computedSha256}`));
              }

              // 3. Binary header validation (Windows PE MZ signature: 0x4D, 0x5A)
              const fd = fs.openSync(tempPartPath, 'r');
              const headerBuf = Buffer.alloc(2);
              fs.readSync(fd, headerBuf, 0, 2, 0);
              fs.closeSync(fd);

              if (headerBuf[0] !== 0x4D || headerBuf[1] !== 0x5A) {
                cleanup();
                return reject(new Error('Downloaded asset is not a valid Windows executable (missing MZ signature)'));
              }

              // 4. Atomic move to final destination
              if (fs.existsSync(destPath)) {
                try { fs.unlinkSync(destPath); } catch {}
              }
              fs.renameSync(tempPartPath, destPath);
              logger.info(`Asset verified and atomically placed: ${destPath}`);
              resolve(destPath);
            } catch (postErr) {
              cleanup();
              reject(postErr);
            }
          });
        });

        fileStream.on('error', (err) => {
          cleanup();
          reject(err);
        });
      }).on('error', (err) => {
        cleanup();
        reject(err);
      });
    }

    get(downloadUrl, maxRedirects);
  });
}

/**
 * Download update and launch the Windows installer
 * @param {Object} asset
 * @param {BrowserWindow} win
 * @returns {Promise<Object>}
 */
async function downloadAndInstallUpdate(asset, win) {
  if (!asset || !asset.downloadUrl) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:error', { error: 'No download asset available' });
    }
    return { ok: false, error: 'No download asset' };
  }

  try {
    logger.info(`Starting download of update asset: ${asset.name}`);
    let expectedSha256 = asset.sha256 || null;
    if (!expectedSha256 && asset.checksumUrl) {
      try {
        expectedSha256 = await fetchCompanionSha256(asset.checksumUrl);
        if (expectedSha256) {
          logger.info(`Retrieved companion SHA-256 checksum: ${expectedSha256}`);
        }
      } catch (chkErr) {
        logger.warn('Failed to fetch companion checksum:', chkErr.message);
      }
    }

    const downloadedPath = await downloadUpdateAsset(
      asset.downloadUrl,
      asset.name,
      (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('updater:downloadProgress', progress);
        }
      },
      expectedSha256
    );

    logger.info(`Download completed successfully: ${downloadedPath}`);
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:downloadComplete', { path: downloadedPath });
    }

    // Launch downloaded installer and quit current app instance
    setTimeout(() => {
      try {
        const child = spawn(downloadedPath, [], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
      } catch (launchErr) {
        logger.warn('Direct launch failed, attempting shell.openPath:', launchErr.message);
        shell.openPath(downloadedPath);
      }
      app.quit();
    }, 1000);

    return { ok: true, path: downloadedPath };
  } catch (err) {
    logger.error('Update download or installation error:', err.message);
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:error', { error: err.message });
    }
    return { ok: false, error: err.message };
  }
}

module.exports = {
  GITHUB_REPO,
  isNewerVersion,
  checkForUpdates,
  downloadUpdateAsset,
  downloadAndInstallUpdate,
  extractExpectedSha256
};
