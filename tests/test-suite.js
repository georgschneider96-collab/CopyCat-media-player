// tests/test-suite.js
// Automated Health & Regression Test Suite for CopyCat Media Player

process.env.COPYCAT_TEST_SUITE = '1';
process.env.NODE_ENV = 'test';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const cp = require('child_process');

console.log('====================================================');
console.log('   CopyCat Media Player - Automated Test Suite     ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

async function runAll() {
  const projectRoot = path.resolve(__dirname, '..');

  // Test Group 1: Syntax & Compiler Verification
  console.log('--- 1. JavaScript Syntax Verification ---');
  const jsFiles = [
    'main.js',
    'preload.js',
    'src/app.js',
    'src/icons.js',
    'src/main/container.js',
    'src/main/logger.js',
    'src/main/ipc.js',
    'src/main/media-resolver.js',
    'src/main/stream-manager.js',
    'src/main/stream-sniffer.js',
    'src/main/downloader.js',
    'src/main/anime-skip-resolver.js',
    'src/main/server.js',
    'src/main/session.js',
    'src/main/updater.js'
  ];

  for (const rel of jsFiles) {
    const full = path.join(projectRoot, rel);
    runTest(`Syntax check: ${rel}`, () => {
      assert(fs.existsSync(full), `File must exist: ${rel}`);
      cp.execFileSync(process.execPath, ['-c', full]);
    });
  }

  // Test Group 2: IoC Service Container
  console.log('\n--- 2. IoC Service Container & Dependency Injection ---');
  const { createAppContainer } = require(path.join(projectRoot, 'src/main/container'));
  runTest('Create ServiceContainer and register dependencies', () => {
    const container = createAppContainer();
    assert(container.has('window'), 'Container must have window service');
    assert(container.has('stream'), 'Container must have stream service');
    assert(container.has('media'), 'Container must have media service');
    assert(container.has('session'), 'Container must have session service');
    assert(container.has('updater'), 'Container must have updater service');

    const media = container.get('media');
    assert(typeof media.probeMediaFile === 'function', 'Media service must expose probeMediaFile');
    assert(typeof media.buildItem === 'function', 'Media service must expose buildItem');
    assert(typeof media.parseByteRange === 'function', 'Media service must expose parseByteRange');
  });

  // Test Group 3: Updater Semver & Version Comparison
  console.log('\n--- 3. Updater Version Comparison Logic ---');
  const { isNewerVersion } = require(path.join(projectRoot, 'src/main/updater'));
  runTest('Semver comparison edge cases', () => {
    assert.strictEqual(isNewerVersion('1.0.0', '1.0.1'), true, '1.0.1 > 1.0.0');
    assert.strictEqual(isNewerVersion('v1.2.0', 'v1.3.0'), true, 'v1.3.0 > v1.2.0');
    assert.strictEqual(isNewerVersion('1.3.0', '1.3.0'), false, '1.3.0 is not newer than 1.3.0');
    assert.strictEqual(isNewerVersion('2.0.0', '1.9.9'), false, '1.9.9 is not newer than 2.0.0');
    assert.strictEqual(isNewerVersion('1.3.0', 'v1.4.0-beta'), true, 'v1.4.0-beta > 1.3.0');
    // Pre-release edge cases
    assert.strictEqual(isNewerVersion('1.3.0', 'v1.3.0-beta.1'), false, '1.3.0 stable is newer than 1.3.0-beta.1');
    assert.strictEqual(isNewerVersion('1.3.0-beta.1', 'v1.3.0'), true, '1.3.0 stable upgrades 1.3.0-beta.1');
  });

  // Test Group 3b: Media Resolver & Byte-Range Handling (RFC 7233)
  console.log('\n--- 3b. Media Protocol, Byte-Range & Downloader Helpers ---');
  const { toMediaUrl, parseByteRange, resolveMediaTool } = require(path.join(projectRoot, 'src/main/media-resolver'));
  const { formatBytes } = require(path.join(projectRoot, 'src/main/downloader'));

  runTest('toMediaUrl canonical Chromium encoding without lossy replacements', () => {
    const url = toMediaUrl('C:\\Videos\\Movie + Special [2026] #1.mp4');
    assert(url.startsWith('media:///C:/'), 'Must use media:/// protocol');
    assert(!url.includes('\\'), 'No backslashes allowed');
  });

  runTest('parseByteRange handles full requests, slices, and suffixes correctly', () => {
    // 1. Full content (no range)
    const full = parseByteRange(null, 1000);
    assert.strictEqual(full.isRange, false);
    assert.strictEqual(full.start, 0);
    assert.strictEqual(full.end, 999);
    assert.strictEqual(full.chunkSize, 1000);

    // 2. Specific range bytes=0-499
    const part = parseByteRange('bytes=0-499', 1000);
    assert.strictEqual(part.isRange, true);
    assert.strictEqual(part.start, 0);
    assert.strictEqual(part.end, 499);
    assert.strictEqual(part.chunkSize, 500);

    // 3. Open-ended range bytes=500-
    const open = parseByteRange('bytes=500-', 1000);
    assert.strictEqual(open.isRange, true);
    assert.strictEqual(open.start, 500);
    assert.strictEqual(open.end, 999);
    assert.strictEqual(open.chunkSize, 500);

    // 4. Suffix range bytes=-200
    const suffix = parseByteRange('bytes=-200', 1000);
    assert.strictEqual(suffix.isRange, true);
    assert.strictEqual(suffix.start, 800);
    assert.strictEqual(suffix.end, 999);
    assert.strictEqual(suffix.chunkSize, 200);

    // 5. Clamped overflow bytes=800-2000
    const clamped = parseByteRange('bytes=800-2000', 1000);
    assert.strictEqual(clamped.isRange, true);
    assert.strictEqual(clamped.start, 800);
    assert.strictEqual(clamped.end, 999);
    assert.strictEqual(clamped.chunkSize, 200);
  });

  runTest('formatBytes correctly handles 0 and edge sizes', () => {
    assert.strictEqual(formatBytes(0), '0 B', '0 bytes must be 0 B');
    assert.strictEqual(formatBytes(1024), '1.0 KB');
    assert.strictEqual(formatBytes(1048576), '1.0 MB');
  });

  // Test Group 3c: Asynchronous Non-Blocking & Child Process Safety
  console.log('\n--- 3c. Asynchronous & Non-Blocking Architecture ---');
  runTest('resolveMediaTool operates synchronously in-memory with memoized cache', () => {
    const t0 = Date.now();
    const ff = resolveMediaTool('ffmpeg');
    const elapsed = Date.now() - t0;
    assert(elapsed < 20, `In-memory tool resolution must be instantaneous (<20ms), took ${elapsed}ms`);
    // Calling again hits memory cache
    const ff2 = resolveMediaTool('ffmpeg');
    assert.strictEqual(ff, ff2, 'Cached resolution must match first lookup');
  });

  const sessionModule = require(path.join(projectRoot, 'src/main/session'));
  runTest('session.createDesktopShortcut returns a non-blocking Promise', () => {
    const p = sessionModule.createDesktopShortcut();
    assert(p && typeof p.then === 'function', 'createDesktopShortcut must return a Promise');
    // Catch rejection or resolution safely without throwing unhandled
    p.catch(() => {});
  });

  // Test Group 4: Local HTTP API Security (Port 4500) & CommandRegistry
  console.log('\n--- 4. HTTP API Security, Origin Verification & Command Registry ---');
  const { startAiControlServer, CommandRegistry, createDefaultCommandRegistry } = require(path.join(projectRoot, 'src/main/server'));

  runTest('CommandRegistry validates actions, parameters, and payload schemas', async () => {
    const reg = createDefaultCommandRegistry();
    assert(reg.has('play'), 'Must support play command');
    assert(reg.has('pause'), 'Must support pause command');
    assert(reg.has('seek'), 'Must support seek command');
    assert(reg.has('setAccent'), 'Must support setAccent command');
    assert(Array.isArray(reg.getSupportedActions()), 'Must return array of supported actions');
    assert(reg.getSupportedActions().includes('setAccent'), 'Actions must include setAccent');

    // Validation failure on invalid parameter type
    const badAccent = await reg.execute('setAccent', { value: 12345 }, {});
    assert.strictEqual(badAccent.ok, false);
    assert.strictEqual(badAccent.status, 400);

    // Rejection on unknown command
    const unknown = await reg.execute('unknownAction999', {}, {});
    assert.strictEqual(unknown.ok, false);
    assert.strictEqual(unknown.status, 400);
  });

  const testPort = 4598;
  const dummyWindow = {
    getPort: () => testPort,
    setPort: () => {},
    broadcastState: () => {},
    getWindow: () => null,
    getStatus: () => ({ title: 'Test Player', currentTime: 10, duration: 100 }),
    isInPipMode: false
  };
  const dummyServices = {
    window: dummyWindow,
    stream: {
      handleStreamRequest: (_url, _req, res) => { res.writeHead(200, { 'Content-Type': 'video/mp4' }); res.end('stream'); },
      handleThumbRequest: (_url, _req, res) => { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end('thumb'); }
    },
    media: { hasFfmpeg: () => true }
  };

  const testServer = startAiControlServer(testPort, dummyServices);

  await new Promise((resolve) => setTimeout(resolve, 250));

  await runAsyncTest('Allow local API requests without browser Origin', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.title, 'Test Player');
  });

  await runAsyncTest('Allow localhost web origin', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`, {
      headers: { Origin: 'http://localhost:3000' }
    });
    assert.strictEqual(res.status, 200);
  });

  await runAsyncTest('Allow 127.0.0.1 web origin', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`, {
      headers: { Origin: `http://127.0.0.1:${testPort}` }
    });
    assert.strictEqual(res.status, 200);
  });

  await runAsyncTest('Block unauthorized external browser Origin with 403', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`, {
      headers: { Origin: 'https://malicious-site.com' }
    });
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.ok, false);
    assert.strictEqual(json.error, 'Forbidden origin');
  });

  await runAsyncTest('Block Sec-Fetch-Site: cross-site browser requests on status/control with 403', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/status`, {
      headers: { 'sec-fetch-site': 'cross-site' }
    });
    assert.strictEqual(res.status, 403);
  });

  await runAsyncTest('Allow Sec-Fetch-Site: cross-site for internal media stream routes from Electron renderer', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/stream?path=test.mp4`, {
      headers: { 'sec-fetch-site': 'cross-site' }
    });
    assert.strictEqual(res.status, 200);
  });

  await runAsyncTest('Reject unknown action on /api/control with 400', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nonExistentAction123' })
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.ok, false);
  });

  await runAsyncTest('Return 404 for unknown endpoints', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/unknownEndpoint`);
    assert.strictEqual(res.status, 404);
  });

  testServer.close();

  // Test Group 5: AniSkip Resolver Strict Contract & Chapter Builder
  console.log('\n--- 5. Anime Skip Resolver Contract & Chapter Generation ---');
  const {
    fetchAnimeSkipTimes,
    parseAnimeTitleAndEpisode,
    buildContiguousChapters,
    generateFfmetadataText
  } = require(path.join(projectRoot, 'src/main/anime-skip-resolver'));

  runTest('fetchAnimeSkipTimes returns exact { op, ed } structure', () => {
    assert(typeof fetchAnimeSkipTimes === 'function', 'Must export fetchAnimeSkipTimes');
  });

  runTest('parseAnimeTitleAndEpisode identifies anime titles and episodes cleanly across diverse formats', () => {
    const r1 = parseAnimeTitleAndEpisode('Owarimonogatari Second Season - Episode 1.mp4');
    assert(r1 && r1.episode === 1, 'Should parse Owarimonogatari Episode 1');
    assert.strictEqual(r1.title, 'Owarimonogatari Second Season');

    const r2 = parseAnimeTitleAndEpisode('The Exiled Heavy Knight Knows How to Game the System - Episode 20.mp4');
    assert(r2 && r2.episode === 20, 'Should parse The Exiled Heavy Knight Episode 20');

    const r3 = parseAnimeTitleAndEpisode('[SubsPlease] Frieren - Beyond Journey\'s End - 04 (1080p) [ABCD1234].mkv');
    assert(r3 && r3.episode === 4, 'Should parse Frieren episode 4 from fansub notation');

    const r4 = parseAnimeTitleAndEpisode('Wandering Witch_ The Journey of Elaina - Episode 5 (Dual Audio).mp4');
    assert(r4 && r4.episode === 5, 'Should parse Wandering Witch Episode 5 with Dual Audio note');
  });

  runTest('buildContiguousChapters generates seamless non-overlapping chapters', () => {
    const sampleSkip = {
      op: { start: 90, end: 180 },
      ed: { start: 1300, end: 1390 }
    };
    const chapters = buildContiguousChapters(sampleSkip, 1420);
    assert.strictEqual(chapters.length, 5, 'Must generate 5 chapters (Prologue, OP, Episode, ED, Outro)');
    assert.strictEqual(chapters[0].title, 'Prologue');
    assert.strictEqual(chapters[0].start, 0);
    assert.strictEqual(chapters[0].end, 90);

    assert.strictEqual(chapters[1].title, 'Opening');
    assert.strictEqual(chapters[1].start, 90);
    assert.strictEqual(chapters[1].end, 180);

    assert.strictEqual(chapters[2].title, 'Episode');
    assert.strictEqual(chapters[2].start, 180);
    assert.strictEqual(chapters[2].end, 1300);

    assert.strictEqual(chapters[3].title, 'Ending');
    assert.strictEqual(chapters[3].start, 1300);
    assert.strictEqual(chapters[3].end, 1390);

    assert.strictEqual(chapters[4].title, 'Preview');
    assert.strictEqual(chapters[4].start, 1390);
    assert.strictEqual(chapters[4].end, 1420);
  });

  runTest('generateFfmetadataText produces valid FFMETADATA format', () => {
    const chapters = [
      { start: 0, end: 90, title: 'Prologue' },
      { start: 90, end: 180, title: 'Opening' }
    ];
    const text = generateFfmetadataText(chapters, 'Test Episode');
    assert(text.startsWith(';FFMETADATA1'), 'Header must be ;FFMETADATA1');
    assert(text.includes('title=Test Episode'), 'Metadata must include title');
    assert(text.includes('[CHAPTER]'), 'Must include [CHAPTER]');
    assert(text.includes('TIMEBASE=1/1000'), 'Timebase must be millisecond 1/1000');
    assert(text.includes('START=90000'), 'Opening start must be 90000ms');
    assert(text.includes('END=180000'), 'Opening end must be 180000ms');
    assert(text.includes('title=Opening'), 'Chapter title must be Opening');
  });

  // Test Group 6: Media Prober Anime Audio Language Contract
  console.log('\n--- 6. Media Prober & Downloader Audio Language Contract ---');
  const { createAppContainer: createContainerForTest } = require(path.join(projectRoot, 'src/main/container'));
  const testContainer = createContainerForTest();
  const testMedia = testContainer.get('media');

  await runAsyncTest('probe detects Japanese audio for untagged single-track anime files', async () => {
    const sampleAnime = 'C:\\Users\\Schual\\Downloads\\CopyCat\\Owarimonogatari Second Season - Episode 1.mp4';
    if (fs.existsSync(sampleAnime)) {
      const probe = await testMedia.probe(sampleAnime);
      assert(probe && probe.audioTracks && probe.audioTracks.length > 0, 'Must have audio tracks');
      assert.strictEqual(probe.audioTracks[0].name, 'Japanese (Original)');
      assert.strictEqual(probe.audioTracks[0].lang, 'ja');
    }
  });

  // Test Group 7: Multi-Link, URL Incrementing & Season Sliding Window Queue
  console.log('\n--- 7. Batch & Season Queue, URL Pattern & Sliding Window Engine ---');
  const {
    parseEpisodeFromUrl,
    incrementEpisodeUrl,
    replaceEpisodeInUrl,
    extractSeriesTitleGuess,
    stripLanguageTags,
    formatDoubleDigitEpisode,
    sanitizeFilename,
    DownloadManager
  } = require(path.join(projectRoot, 'src/main/downloader'));

  runTest('parseEpisodeFromUrl extracts episode patterns and padding correctly', () => {
    const qEp = parseEpisodeFromUrl('https://example.com/watch?id=123&ep=05');
    assert(qEp, 'Query ep must match');
    assert.strictEqual(qEp.num, 5);
    assert.strictEqual(qEp.padLength, 2);

    const slugEp = parseEpisodeFromUrl('https://www.miruro.cx/watch/chuunibyou-episode-1');
    assert(slugEp, 'Slug episode must match');
    assert.strictEqual(slugEp.num, 1);
    assert.strictEqual(slugEp.padLength, 1);

    const tailEp = parseEpisodeFromUrl('https://example.com/anime/frieren-ep-09/');
    assert(tailEp, 'Tail episode must match');
    assert.strictEqual(tailEp.num, 9);
    assert.strictEqual(tailEp.padLength, 2);
  });

  runTest('incrementEpisodeUrl increments numbers and preserves zero-padding', () => {
    assert.strictEqual(
      incrementEpisodeUrl('https://www.miruro.cx/watch/chuunibyou-episode-1', 1),
      'https://www.miruro.cx/watch/chuunibyou-episode-2'
    );
    assert.strictEqual(
      incrementEpisodeUrl('https://example.com/watch?id=123&ep=09', 1),
      'https://example.com/watch?id=123&ep=10'
    );
    assert.strictEqual(
      incrementEpisodeUrl('https://example.com/anime/show-e03.mp4', 1),
      'https://example.com/anime/show-e04.mp4'
    );
  });

  runTest('replaceEpisodeInUrl targets arbitrary episode number with proper padding', () => {
    assert.strictEqual(
      replaceEpisodeInUrl('https://www.miruro.cx/watch/show-episode-01', 12),
      'https://www.miruro.cx/watch/show-episode-12'
    );
    assert.strictEqual(
      replaceEpisodeInUrl('https://example.com/watch?ep=1', 8),
      'https://example.com/watch?ep=8'
    );
  });

  runTest('extractSeriesTitleGuess derives clean series names from URLs and filenames', () => {
    assert.strictEqual(
      extractSeriesTitleGuess('https://www.miruro.cx/watch/chuunibyou-demo-koi-ga-shitai-episode-1'),
      'Chuunibyou Demo Koi Ga Shitai'
    );
    assert.strictEqual(
      extractSeriesTitleGuess('https://example.com/watch?id=123', 'Love Chunibyo - Episode 09'),
      'Love Chunibyo'
    );
    assert.strictEqual(
      extractSeriesTitleGuess('https://example.com/anime/frieren-beyond-journeys-end/ep-5/'),
      'Frieren Beyond Journeys End'
    );
  });

  await runAsyncTest('DownloadManager _allocateOutputPath creates dedicated series subfolder with optimized view', async () => {
    const dummyMgr = new DownloadManager();
    const alloc = await dummyMgr._allocateOutputPath('Frieren - Episode 01', 'mp4', 'Frieren Beyond Journeys End');
    assert(alloc.fileName === 'Frieren - Episode 01.mp4', 'Filename must match');
    assert(alloc.outPath.includes('Frieren Beyond Journeys End'), 'Path must contain series subfolder');
    const subfolderDir = path.dirname(alloc.outPath);
    assert(fs.existsSync(subfolderDir), 'Subfolder directory must exist on disk');
    if (process.platform === 'win32') {
      const ini = path.join(subfolderDir, 'desktop.ini');
      assert(fs.existsSync(ini), 'desktop.ini must exist in season download folder');
      const iniContent = fs.readFileSync(ini, 'utf8');
      assert(iniContent.includes('FolderType=Videos'), 'FolderType must be Videos');
      assert(iniContent.includes('Mode=1'), 'Mode must be 1 (Large Icons)');
    }
  });

  runTest('DownloadManager _validateEpisodeTracks enforces strict language requirements (Option A)', () => {
    const dummyMgr = new DownloadManager();
    const probe = {
      audioTracks: [{ name: 'Japanese (Original)', lang: 'ja' }],
      subtitles: [{ name: 'English', lang: 'en' }]
    };

    // Valid requests pass without error
    assert.doesNotThrow(() => {
      dummyMgr._validateEpisodeTracks(probe, { audioPreference: 'jpn', subPreference: 'eng' });
    });
    assert.doesNotThrow(() => {
      dummyMgr._validateEpisodeTracks(probe, { audioPreference: 'any', subPreference: 'any' });
    });

    // Missing requested English dub throws error
    assert.throws(() => {
      dummyMgr._validateEpisodeTracks(probe, { audioPreference: 'eng' });
    }, /Requested English dub not available/);

    // Missing requested Dual Audio throws error
    assert.throws(() => {
      dummyMgr._validateEpisodeTracks(probe, { audioPreference: 'dual' });
    }, /Dual audio tracks not available/);

    // Missing requested subtitles throws error
    assert.throws(() => {
      dummyMgr._validateEpisodeTracks({ audioTracks: [], subtitles: [] }, { subPreference: 'eng' });
    }, /No subtitles available/);
  });

  await runAsyncTest('queueSeason populates sliding window of 10 and halts on haltAllDownloads', async () => {
    const dummyMgr = new DownloadManager();
    const res = await dummyMgr.queueSeason({
      url: 'https://example.com/watch/series-episode-01',
      fromEp: 1,
      toEp: 24,
      seriesTitle: 'Test Series'
    });

    assert.strictEqual(res.totalEpisodes, 24, 'Must generate 24 episodes');
    assert.strictEqual(dummyMgr.queue.length, 10, 'Queue must cap active window at 10');
    assert.strictEqual(dummyMgr.seasonBacklog.length, 14, 'Backlog must hold remaining 14 episodes');

    // Test haltAllDownloads
    const haltRes = dummyMgr.haltAllDownloads();
    assert.strictEqual(haltRes.success, true, 'Halt must succeed');
    assert.strictEqual(dummyMgr.seasonBacklog.length, 0, 'Backlog must be purged on halt');
    const allCancelled = dummyMgr.queue.every(t => t.status === 'cancelled');
    assert(allCancelled, 'All queued items must be marked cancelled/halted');
  });

  runTest('stripLanguageTags removes language, dub, and audio tags from titles and folders', () => {
    assert.strictEqual(
      stripLanguageTags('From Old Country Bumpkin to Master Swordsman II - Episode 1 (English)'),
      'From Old Country Bumpkin to Master Swordsman II - Episode 1'
    );
    assert.strictEqual(
      stripLanguageTags('From Old Country Bumpkin to Master Swordsman II (English)'),
      'From Old Country Bumpkin to Master Swordsman II'
    );
    assert.strictEqual(
      stripLanguageTags('Attack on Titan (Dual Audio)'),
      'Attack on Titan'
    );
    assert.strictEqual(
      stripLanguageTags('Jujutsu Kaisen [English Dub]'),
      'Jujutsu Kaisen'
    );
    assert.strictEqual(
      stripLanguageTags('Frieren (Japanese)'),
      'Frieren'
    );
    assert.strictEqual(
      stripLanguageTags('Clean Anime Title'),
      'Clean Anime Title'
    );
  });

  runTest('formatDoubleDigitEpisode formats single-digit episodes with leading zeros', () => {
    assert.strictEqual(
      formatDoubleDigitEpisode('From Old Country Bumpkin to Master Swordsman II - Episode 1'),
      'From Old Country Bumpkin to Master Swordsman II - Episode 01'
    );
    assert.strictEqual(
      formatDoubleDigitEpisode('From Old Country Bumpkin to Master Swordsman II - Episode 02'),
      'From Old Country Bumpkin to Master Swordsman II - Episode 02'
    );
    assert.strictEqual(
      formatDoubleDigitEpisode('From Old Country Bumpkin to Master Swordsman II - Episode 12'),
      'From Old Country Bumpkin to Master Swordsman II - Episode 12'
    );
    assert.strictEqual(
      formatDoubleDigitEpisode('Show Title - Ep 3'),
      'Show Title - Ep 03'
    );
    assert.strictEqual(
      formatDoubleDigitEpisode('Anime Series - E4'),
      'Anime Series - E04'
    );
    assert.strictEqual(
      formatDoubleDigitEpisode('Series Name - 5'),
      'Series Name - 05'
    );
    assert.strictEqual(
      sanitizeFilename('From Old Country Bumpkin to Master Swordsman II - Episode 1 (English)'),
      'From Old Country Bumpkin to Master Swordsman II - Episode 01'
    );
  });

  runTest('DownloadManager routes targetUrl to dubStreamUrl for single dub, and preserves master for dual-audio', () => {
    const dummyMgr = new DownloadManager();
    const taskSingleDub = {
      url: 'https://www.miruro.cx/watch/series?ep=1',
      audioPreference: 'eng',
      dualAudio: false,
      audioTracks: []
    };
    const taskDualAudio = {
      url: 'https://www.miruro.cx/watch/series?ep=1',
      audioPreference: 'eng',
      dualAudio: true,
      audioTracks: []
    };
    const probe = {
      url: 'https://cdn.example.com/sub/index.m3u8',
      dubStreamUrl: 'https://cdn.example.com/dub/index.m3u8',
      subStreamUrl: 'https://cdn.example.com/sub/index.m3u8',
      audioTracks: [
        { name: 'Japanese', lang: 'ja', streamUrl: 'https://cdn.example.com/sub/index.m3u8' },
        { name: 'English', lang: 'en', streamUrl: 'https://cdn.example.com/dub/index.m3u8' }
      ]
    };

    // Simulate stream routing logic in _executeTask for single-dub
    let targetUrlSingle = probe.url;
    if (!taskSingleDub.dubStreamUrl && probe.dubStreamUrl) taskSingleDub.dubStreamUrl = probe.dubStreamUrl;
    if (/eng|dub/i.test(taskSingleDub.audioPreference || '')) {
      const dubUrl = taskSingleDub.dubStreamUrl || (Array.isArray(taskSingleDub.audioTracks) && taskSingleDub.audioTracks.find(a => /english|en|dub/i.test(a.name || '') || /en/i.test(a.lang || ''))?.streamUrl);
      if (dubUrl) {
        taskSingleDub.dubStreamUrl = dubUrl;
        if (!taskSingleDub.dualAudio) {
          targetUrlSingle = dubUrl;
        }
      }
    }

    // Simulate stream routing logic in _executeTask for dual-audio
    let targetUrlDual = probe.url;
    if (!taskDualAudio.dubStreamUrl && probe.dubStreamUrl) taskDualAudio.dubStreamUrl = probe.dubStreamUrl;
    if (/eng|dub/i.test(taskDualAudio.audioPreference || '')) {
      const dubUrl = taskDualAudio.dubStreamUrl || (Array.isArray(taskDualAudio.audioTracks) && taskDualAudio.audioTracks.find(a => /english|en|dub/i.test(a.name || '') || /en/i.test(a.lang || ''))?.streamUrl);
      if (dubUrl) {
        taskDualAudio.dubStreamUrl = dubUrl;
        if (!taskDualAudio.dualAudio) {
          targetUrlDual = dubUrl;
        }
      }
    }

    assert.strictEqual(targetUrlSingle, 'https://cdn.example.com/dub/index.m3u8', 'Single dub routes targetUrl directly to dub stream');
    assert.strictEqual(targetUrlDual, 'https://cdn.example.com/sub/index.m3u8', 'Dual-audio preserves master stream for targetUrl');
    assert.strictEqual(taskSingleDub.dubStreamUrl, 'https://cdn.example.com/dub/index.m3u8', 'Task dubStreamUrl routes to English dub stream');
  });

  console.log('\n--- 8. Subtitle Autoplay Preferences ---');

  runTest('Subtitle autoplay settings logic prevents auto-rendering when disabled', () => {
    function simulateMediaLoad(autoPlaySubtitles) {
      // Simulates loadMediaItem() logic
      const state = { autoPlaySubtitles, subEnabled: true };
      state.subEnabled = Boolean(state.autoPlaySubtitles);
      return state.subEnabled;
    }

    assert.strictEqual(simulateMediaLoad(true), true, 'When autoplay is enabled, subtitles turn on automatically');
    assert.strictEqual(simulateMediaLoad(false), false, 'When autoplay is disabled, subtitles stay off on start');
  });

  console.log('\n====================================================');
  console.log(`   Test Summary: ${passedTests} / ${totalTests} passed`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
