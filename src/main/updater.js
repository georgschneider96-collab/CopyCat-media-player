// src/main/updater.js
// GitHub Releases Auto-Updater Engine for VLCopyCat

const https = require('https');
const http = require('http');
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
 * Compare semantic versions (vX.Y.Z)
 * @param {string} currentVer
 * @param {string} latestTag
 * @returns {boolean} True if latestTag is newer than currentVer
 */
function isNewerVersion(currentVer, latestTag) {
  const cleanCurr = (currentVer || '').replace(/^v/i, '').trim();
  const cleanLate = (latestTag || '').replace(/^v/i, '').trim();
  const pCurr = cleanCurr.split('.').map((n) => parseInt(n, 10) || 0);
  const pLate = cleanLate.split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(pCurr.length, pLate.length); i++) {
    const c = pCurr[i] || 0;
    const l = pLate[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
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
          if (Array.isArray(release.assets) && release.assets.length > 0) {
            asset = release.assets.find((a) => a.name.toLowerCase().includes('setup') && a.name.endsWith('.exe'))
              || release.assets.find((a) => a.name.endsWith('.exe'))
              || release.assets[0];
          }

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
              downloadUrl: asset.browser_download_url
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
 * Download update setup asset with redirect handling and progress events
 * @param {string} downloadUrl
 * @param {string} assetName
 * @param {Function} onProgress
 * @param {number} maxRedirects
 * @returns {Promise<string>} Downloaded file path
 */
function downloadUpdateAsset(downloadUrl, assetName, onProgress, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    const destPath = path.join(os.tmpdir(), assetName || 'CopyCat-Update-Setup.exe');

    function get(currentUrl, redirectsLeft) {
      if (redirectsLeft <= 0) {
        return reject(new Error('Too many redirects while downloading update'));
      }

      const parsed = new URL(currentUrl);
      const proto = parsed.protocol === 'https:' ? https : http;

      proto.get({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
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
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let transferred = 0;
        let lastReport = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          transferred += chunk.length;
          const now = Date.now();
          if (now - lastReport > 80 || transferred === total) {
            lastReport = now;
            const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
            if (onProgress) onProgress({ percent, transferred, total });
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath));
        });

        fileStream.on('error', (err) => {
          try { fs.unlinkSync(destPath); } catch {}
          reject(err);
        });
      }).on('error', reject);
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
    const downloadedPath = await downloadUpdateAsset(
      asset.downloadUrl,
      asset.name,
      (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('updater:downloadProgress', progress);
        }
      }
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
  downloadAndInstallUpdate
};
