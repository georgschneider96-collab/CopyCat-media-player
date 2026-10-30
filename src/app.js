// VLCopyCAT Renderer Application
// Implements Juxtopposed's 25-Year VLC Redesign UI + WebAudio 200% Cone Boost + Local AI Bridge

(() => {
  'use strict';

  const api = window.vlcopycat;
  const ICONS = window.VLC_ICONS;

  // Juxtopposed's 9 Cone Accent Palettes (from 01_cone_palette.png & 12_accent_colors.png)
  const ACCENT_PRESETS = {
    orange:  { label: 'VLC Cone Orange', hex: '#E07A16', hover: '#F59223', rgb: '224, 122, 22' },
    amber:   { label: 'Solar Amber',     hex: '#EAB308', hover: '#FACC15', rgb: '234, 179, 8' },
    lime:    { label: 'Electric Lime',   hex: '#84CC16', hover: '#A3E635', rgb: '132, 204, 22' },
    emerald: { label: 'Emerald Mint',    hex: '#10B981', hover: '#34D399', rgb: '16, 185, 129' },
    cyan:    { label: 'Cyber Cyan',      hex: '#06B6D4', hover: '#22D3EE', rgb: '6, 182, 212' },
    blue:    { label: 'Cobalt Blue',     hex: '#3B82F6', hover: '#60A5FA', rgb: '59, 130, 246' },
    purple:  { label: 'Royal Violet',    hex: '#8B5CF6', hover: '#A78BFA', rgb: '139, 92, 246' },
    magenta: { label: 'Neon Magenta',    hex: '#D946EF', hover: '#E879F9', rgb: '217, 70, 239' },
    rose:    { label: 'Crimson Rose',    hex: '#F43F5E', hover: '#FB7185', rgb: '244, 63, 94' }
  };

  const EQ_PRESETS = {
    flat:   [0, 0, 0],
    bass:   [7.5, 0.5, 1.5],
    cinema: [5.5, -1.0, 4.0],
    vocal:  [-2.5, 5.5, 2.0],
    night:  [-4.5, 2.0, -3.0]
  };

  const STORAGE_KEY = 'vlcopycat_prefs_v1';

  // ==================== STATE ====================
  const state = {
    queue: [],
    queueIndex: -1,
    libraryFolder: null,     // { folderPath, folderName, items }
    libraryFilter: '',
    bookmarks: [],           // { id, title, filePath, time }
    drawerTab: 'queue',      // 'queue' | 'bookmarks'

    playing: false,
    volume: 100,             // 0..200 (200% cone boost)
    muted: false,
    speed: 1.0,
    loop: false,
    showRemainingTime: true,

    // Video filters & aspect
    videoFit: 'contain',
    brightness: 100,
    contrast: 100,
    saturation: 100,

    // Audio & Visualizer
    eqPreset: 'flat',
    visualizerEnabled: false,

    // Subtitles
    subEnabled: true,
    subTimelineBlocks: true,
    subTrackName: null,
    subCues: [],             // [{ start, end, text }]
    subSizePx: 22,
    subOffsetMs: 0,

    // Preferences
    accentKey: 'orange',
    customAccentHex: null,
    showHoverThumb: true,
    autoHideFs: true,
    alwaysOnTop: false,
    autoLoadFolder: true,
    autoLoadSub: true,
    rememberState: true,

    // Window state
    isFullscreen: false,
    isMaximized: false,
    aiPort: 4500,

    // Optional detected reference demo video on Desktop
    demoVideoPath: null
  };

  // ==================== DOM ELEMENTS ====================
  const $ = (id) => document.getElementById(id);

  const el = {
    app: $('app'),
    topBar: $('top-bar'),
    btnCone: $('btn-cone'),
    btnMenu: $('btn-menu'),
    btnSidebar: $('btn-sidebar'),
    btnFolderCrumb: $('btn-folder-crumb'),
    iconFolderCrumb: $('icon-folder-crumb'),
    folderCrumbText: $('folder-crumb-text'),
    mediaTitle: $('media-title'),
    btnPip: $('btn-pip'),
    btnMinimize: $('btn-minimize'),
    btnMaximize: $('btn-maximize'),
    btnFullscreen: $('btn-fullscreen'),
    btnClose: $('btn-close'),

    headerMenu: $('header-menu'),
    menuOpenFile: $('menu-open-file'),
    menuOpenMulti: $('menu-open-multi'),
    menuOpenFolder: $('menu-open-folder'),
    menuOpenSub: $('menu-open-sub'),
    menuPlayDemo: $('menu-play-demo'),
    menuSnapshot: $('menu-snapshot'),
    menuReveal: $('menu-reveal'),
    menuAlwaysTop: $('menu-always-top'),
    menuAlwaysTopLabel: $('menu-always-top-label'),
    menuSettings: $('menu-settings'),

    librarySidebar: $('library-sidebar'),
    libQuickTabs: $('lib-quick-tabs'),
    libSearchIcon: $('lib-search-icon'),
    libSearchInput: $('lib-search-input'),
    libFolderLabel: $('lib-folder-label'),
    btnLibOpenFolder: $('btn-lib-open-folder'),
    btnLibOpenFiles: $('btn-lib-open-files'),
    libList: $('lib-list'),

    videoStage: $('video-stage'),
    video: $('main-video'),
    visualizerCanvas: $('visualizer-canvas'),
    emptyState: $('empty-state'),
    emptyCone: $('empty-cone'),
    btnEmptyOpenFile: $('btn-empty-open-file'),
    btnEmptyOpenFolder: $('btn-empty-open-folder'),
    btnEmptyDemo: $('btn-empty-demo'),
    subtitleOverlay: $('subtitle-overlay'),
    osdToast: $('osd-toast'),
    dropOverlay: $('drop-overlay'),

    rightDrawer: $('right-drawer'),
    tabDrawerQueue: $('tab-drawer-queue'),
    tabDrawerBookmarks: $('tab-drawer-bookmarks'),
    drawerBody: $('drawer-body'),
    btnDrawerAdd: $('btn-drawer-add'),
    btnDrawerBookmark: $('btn-drawer-bookmark'),
    btnDrawerClear: $('btn-drawer-clear'),

    bottomBar: $('bottom-bar'),
    btnPrev: $('btn-prev'),
    btnPlay: $('btn-play'),
    btnNext: $('btn-next'),
    timeElapsed: $('time-elapsed'),
    timeTotal: $('time-total'),
    subSyncMini: $('sub-sync-mini'),
    btnSubEarlier: $('btn-sub-earlier'),
    btnSubLater: $('btn-sub-later'),
    seekbarTrack: $('seekbar-track'),
    seekbarFill: $('seekbar-fill'),
    seekbarSubBlocks: $('seekbar-sub-blocks'),
    seekbarThumb: $('seekbar-thumb'),
    seekHoverCard: $('seek-hover-card'),
    hoverPreviewCanvas: $('hover-preview-canvas'),
    hoverTimeText: $('hover-time-text'),

    btnMute: $('btn-mute'),
    volConeSlider: $('vol-cone-slider'),
    volConeFill: $('vol-cone-fill'),

    btnAudioPop: $('btn-audio-pop'),
    btnSubPop: $('btn-sub-pop'),
    btnGearPop: $('btn-gear-pop'),
    btnQueueDrawer: $('btn-queue-drawer'),

    bottomPopover: $('bottom-popover'),
    lblSpeed: $('lbl-speed'),
    rngSpeed: $('rng-speed'),
    swLoop: $('sw-loop'),
    swSubTimeline: $('sw-sub-timeline'),
    btnPopSnapshot: $('btn-pop-snapshot'),

    selVideoFit: $('sel-video-fit'),
    lblBrightness: $('lbl-brightness'),
    rngBrightness: $('rng-brightness'),
    lblContrast: $('lbl-contrast'),
    rngContrast: $('rng-contrast'),
    lblSaturation: $('lbl-saturation'),
    rngSaturation: $('rng-saturation'),
    btnResetVideo: $('btn-reset-video'),

    lblVolumePop: $('lbl-volume-pop'),
    rngVolumePop: $('rng-volume-pop'),
    selEqPreset: $('sel-eq-preset'),
    swVisualizer: $('sw-visualizer'),

    swSubEnabled: $('sw-sub-enabled'),
    lblSubTrack: $('lbl-sub-track'),
    btnLoadSub: $('btn-load-sub'),
    lblSubSize: $('lbl-sub-size'),
    rngSubSize: $('rng-sub-size'),
    lblSubOffset: $('lbl-sub-offset'),
    btnSubMinus100: $('btn-sub-minus100'),
    btnSubReset: $('btn-sub-reset'),
    btnSubPlus100: $('btn-sub-plus100'),
    btnOpenGlobalPrefs: $('btn-open-global-prefs'),

    settingsBackdrop: $('settings-backdrop'),
    settingsTitle: $('settings-title'),
    btnCloseSettings: $('btn-close-settings'),
    accentSwatches: $('accent-swatches'),
    inpCustomAccent: $('inp-custom-accent'),
    lblActiveAccent: $('lbl-active-accent'),
    swHoverThumb: $('sw-hover-thumb'),
    swAutohideFs: $('sw-autohide-fs'),
    swAlwaysOnTop: $('sw-always-on-top'),
    swAutoloadFolder: $('sw-autoload-folder'),
    swAutoloadSub: $('sw-autoload-sub'),
    swRememberState: $('sw-remember-state'),
    aiEndpointBox: $('ai-endpoint-box'),
    aiSampleCmd: $('ai-sample-cmd'),
    btnCopyAiCmd: $('btn-copy-ai-cmd')
  };

  // ==================== AUDIO ENGINE (200% CONE BOOST + EQ + ANALYSER) ====================
  let audioCtx = null;
  let gainNode = null;
  let analyserNode = null;
  let eqNodes = null;
  let visualizerRaf = null;

  function ensureAudioGraph() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      const source = audioCtx.createMediaElementSource(el.video);

      const bass = audioCtx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 110;

      const mid = audioCtx.createBiquadFilter();
      mid.type = 'peaking';
      mid.Q.value = 1.0;
      mid.frequency.value = 1000;

      const treble = audioCtx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 8000;

      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.82;

      gainNode = audioCtx.createGain();

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(analyserNode);
      analyserNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      eqNodes = [bass, mid, treble];
      applyEqualizer();
      applyVolumeToEngine();
    } catch (err) {
      console.warn('WebAudio fallback active:', err);
    }
  }

  function applyEqualizer() {
    if (!eqNodes) return;
    const gains = EQ_PRESETS[state.eqPreset] || EQ_PRESETS.flat;
    eqNodes[0].gain.value = gains[0];
    eqNodes[1].gain.value = gains[1];
    eqNodes[2].gain.value = gains[2];
  }

  function applyVolumeToEngine() {
    const clamped = Math.max(0, Math.min(200, Math.round(state.volume)));
    state.volume = clamped;

    if (gainNode && audioCtx) {
      el.video.muted = false;
      el.video.volume = 1.0;
      gainNode.gain.value = state.muted ? 0 : clamped / 100;
    } else {
      el.video.muted = state.muted;
      el.video.volume = Math.min(1, clamped / 100);
    }

    // Update cone slider UI (0..200% maps to 0..100% width; 100% sits at 50% tick)
    const fillPct = state.muted ? 0 : clamped / 2;
    el.volConeFill.style.width = `${fillPct}%`;
    el.volConeSlider.classList.toggle('muted', state.muted || clamped === 0);
    el.volConeSlider.title = `Cone Volume Boost: ${state.muted ? 'Muted' : clamped + '%'} (Up to 200%)`;
    el.btnMute.innerHTML = state.muted || clamped === 0 ? ICONS.speakerMute : ICONS.speaker;

    el.rngVolumePop.value = String(clamped);
    el.lblVolumePop.textContent = state.muted ? `Muted (${clamped}%)` : `${clamped}%`;
  }

  // ==================== OFF-SCREEN THUMBNAIL VIDEO ====================
  const thumbVideo = document.createElement('video');
  thumbVideo.muted = true;
  thumbVideo.preload = 'auto';
  thumbVideo.playsInline = true;
  let thumbSeeking = false;
  let pendingThumbTime = null;
  const hoverCtx = el.hoverPreviewCanvas.getContext('2d');

  thumbVideo.addEventListener('seeked', () => {
    drawThumbFrame();
    if (pendingThumbTime !== null && Math.abs(pendingThumbTime - thumbVideo.currentTime) > 0.15) {
      const nextT = pendingThumbTime;
      pendingThumbTime = null;
      try {
        thumbVideo.currentTime = nextT;
      } catch {
        thumbSeeking = false;
      }
    } else {
      pendingThumbTime = null;
      thumbSeeking = false;
    }
  });

  function requestThumbAt(seconds) {
    const currentItem = getCurrentItem();
    if (!currentItem || currentItem.isAudio || !state.showHoverThumb) {
      drawPlaceholderThumb(currentItem?.isAudio ? 'AUDIO TRACK' : 'PREVIEW');
      return;
    }
    if (!thumbVideo.src || thumbVideo.readyState < 1) {
      drawPlaceholderThumb('LOADING...');
      return;
    }
    const clampedT = Math.max(0, Math.min(seconds, (thumbVideo.duration || seconds) - 0.05));
    if (!thumbSeeking) {
      thumbSeeking = true;
      try {
        thumbVideo.currentTime = clampedT;
      } catch {
        thumbSeeking = false;
      }
    } else {
      pendingThumbTime = clampedT;
    }
  }

  function drawThumbFrame() {
    const cw = el.hoverPreviewCanvas.width;
    const ch = el.hoverPreviewCanvas.height;
    hoverCtx.fillStyle = '#090909';
    hoverCtx.fillRect(0, 0, cw, ch);

    const vw = thumbVideo.videoWidth;
    const vh = thumbVideo.videoHeight;
    if (!vw || !vh) return;

    const scale = Math.min(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    hoverCtx.drawImage(thumbVideo, dx, dy, dw, dh);
  }

  function drawPlaceholderThumb(label) {
    const cw = el.hoverPreviewCanvas.width;
    const ch = el.hoverPreviewCanvas.height;
    hoverCtx.fillStyle = '#0D0D0D';
    hoverCtx.fillRect(0, 0, cw, ch);
    hoverCtx.fillStyle = '#555555';
    hoverCtx.font = '600 11px Segoe UI, sans-serif';
    hoverCtx.textAlign = 'center';
    hoverCtx.textBaseline = 'middle';
    hoverCtx.fillText(label, cw / 2, ch / 2);
  }

  // ==================== UTILITIES ====================
  function formatTime(sec, forceHours = false) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const total = Math.floor(sec);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    if (hrs > 0 || forceHours) {
      return `${hrs}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  let toastTimer = null;
  function showToast(msg) {
    el.osdToast.textContent = msg;
    el.osdToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.osdToast.classList.remove('show');
    }, 1700);
  }

  function hexToRgbString(hex) {
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return '224, 122, 22';
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  }

  function brightenHex(hex, amount = 22) {
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return hex;
    const clamp = (n) => Math.max(0, Math.min(255, n));
    const r = clamp((parseInt(clean.slice(0, 2), 16) || 0) + amount);
    const g = clamp((parseInt(clean.slice(2, 4), 16) || 0) + amount);
    const b = clamp((parseInt(clean.slice(4, 6), 16) || 0) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function getCurrentItem() {
    if (state.queueIndex >= 0 && state.queueIndex < state.queue.length) {
      return state.queue[state.queueIndex];
    }
    return null;
  }

  // ==================== THEME & PREFERENCES PERSISTENCE ====================
  function applyAccent(keyOrHex, persist = true) {
    const root = document.documentElement;
    if (ACCENT_PRESETS[keyOrHex]) {
      const p = ACCENT_PRESETS[keyOrHex];
      state.accentKey = keyOrHex;
      state.customAccentHex = null;
      root.style.setProperty('--accent', p.hex);
      root.style.setProperty('--accent-hover', p.hover);
      root.style.setProperty('--accent-rgb', p.rgb);
      el.inpCustomAccent.value = p.hex;
      el.lblActiveAccent.textContent = `${p.hex} (${p.label})`;
    } else if (typeof keyOrHex === 'string' && keyOrHex.startsWith('#')) {
      const hex = keyOrHex.toUpperCase();
      state.accentKey = 'custom';
      state.customAccentHex = hex;
      root.style.setProperty('--accent', hex);
      root.style.setProperty('--accent-hover', brightenHex(hex, 24));
      root.style.setProperty('--accent-rgb', hexToRgbString(hex));
      el.inpCustomAccent.value = hex;
      el.lblActiveAccent.textContent = `${hex} (Custom)`;
    }

    document.querySelectorAll('.swatch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.accent === state.accentKey);
    });

    if (persist) savePreferences();
    pushPlayerStatus();
  }

  function savePreferences() {
    if (!state.rememberState) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data = {
      volume: state.volume,
      accentKey: state.accentKey,
      customAccentHex: state.customAccentHex,
      showHoverThumb: state.showHoverThumb,
      autoHideFs: state.autoHideFs,
      autoLoadFolder: state.autoLoadFolder,
      autoLoadSub: state.autoLoadSub,
      rememberState: state.rememberState,
      subTimelineBlocks: state.subTimelineBlocks,
      subSizePx: state.subSizePx,
      eqPreset: state.eqPreset,
      showRemainingTime: state.showRemainingTime
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.volume === 'number') state.volume = d.volume;
      if (typeof d.showHoverThumb === 'boolean') state.showHoverThumb = d.showHoverThumb;
      if (typeof d.autoHideFs === 'boolean') state.autoHideFs = d.autoHideFs;
      if (typeof d.autoLoadFolder === 'boolean') state.autoLoadFolder = d.autoLoadFolder;
      if (typeof d.autoLoadSub === 'boolean') state.autoLoadSub = d.autoLoadSub;
      if (typeof d.rememberState === 'boolean') state.rememberState = d.rememberState;
      if (typeof d.subTimelineBlocks === 'boolean') state.subTimelineBlocks = d.subTimelineBlocks;
      if (typeof d.subSizePx === 'number') state.subSizePx = d.subSizePx;
      if (typeof d.eqPreset === 'string') state.eqPreset = d.eqPreset;
      if (typeof d.showRemainingTime === 'boolean') state.showRemainingTime = d.showRemainingTime;

      if (d.accentKey === 'custom' && d.customAccentHex) {
        applyAccent(d.customAccentHex, false);
      } else if (d.accentKey && ACCENT_PRESETS[d.accentKey]) {
        applyAccent(d.accentKey, false);
      }
    } catch {}
  }

  function syncSwitchesUI() {
    el.swLoop.classList.toggle('on', state.loop);
    el.swSubTimeline.classList.toggle('on', state.subTimelineBlocks);
    el.swVisualizer.classList.toggle('on', state.visualizerEnabled);
    el.swSubEnabled.classList.toggle('on', state.subEnabled);
    el.swHoverThumb.classList.toggle('on', state.showHoverThumb);
    el.swAutohideFs.classList.toggle('on', state.autoHideFs);
    el.swAlwaysOnTop.classList.toggle('on', state.alwaysOnTop);
    el.swAutoloadFolder.classList.toggle('on', state.autoLoadFolder);
    el.swAutoloadSub.classList.toggle('on', state.autoLoadSub);
    el.swRememberState.classList.toggle('on', state.rememberState);

    el.selEqPreset.value = state.eqPreset;
    el.rngSubSize.value = String(state.subSizePx);
    el.lblSubSize.textContent = `${state.subSizePx}px`;
    el.subtitleOverlay.style.fontSize = `${state.subSizePx}px`;
    el.menuAlwaysTopLabel.textContent = state.alwaysOnTop
      ? '✓ Window Pinned Always on Top'
      : 'Pin Window Always on Top';
  }

  // ==================== SUBTITLE PARSER (.SRT & .VTT) ====================
  function parseTimestampSec(str) {
    const clean = str.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    }
    if (parts.length === 2) {
      return Number(parts[0]) * 60 + Number(parts[1]);
    }
    return 0;
  }

  function parseSubtitles(rawText) {
    if (!rawText) return [];
    const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n\s*\n/);
    const cues = [];

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (!lines.length) continue;
      const arrowIdx = lines.findIndex((l) => l.includes('-->'));
      if (arrowIdx === -1) continue;

      const timeLine = lines[arrowIdx];
      const [startStr, endPart] = timeLine.split('-->');
      if (!startStr || !endPart) continue;
      const endStr = endPart.trim().split(/\s+/)[0];

      const start = parseTimestampSec(startStr);
      const end = parseTimestampSec(endStr);
      const textLines = lines
        .slice(arrowIdx + 1)
        .map((l) => l.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);

      if (textLines.length && end > start) {
        cues.push({ start, end, text: textLines.join('\n') });
      }
    }
    return cues;
  }

  function loadSubtitleData(subObj, notify = true) {
    if (!subObj || !subObj.content) {
      clearSubtitles();
      return;
    }
    state.subCues = parseSubtitles(subObj.content);
    state.subTrackName = subObj.name || 'External Subtitles';
    state.subOffsetMs = 0;
    el.lblSubTrack.textContent = state.subTrackName;
    el.lblSubOffset.textContent = '0 ms';
    el.btnSubPop.classList.toggle('active', state.subEnabled && state.subCues.length > 0);
    renderSubtitleBlocksOnSeekbar();
    updateActiveSubtitleCue();
    if (notify) {
      showToast(`Subtitles loaded: ${state.subTrackName} (${state.subCues.length} lines)`);
    }
  }

  function clearSubtitles() {
    state.subCues = [];
    state.subTrackName = null;
    state.subOffsetMs = 0;
    el.lblSubTrack.textContent = 'No subtitle loaded';
    el.lblSubOffset.textContent = '0 ms';
    el.subtitleOverlay.classList.remove('visible');
    el.subtitleOverlay.textContent = '';
    el.seekbarSubBlocks.innerHTML = '';
    el.subSyncMini.classList.remove('visible');
    el.btnSubPop.classList.remove('active');
  }

  function renderSubtitleBlocksOnSeekbar() {
    el.seekbarSubBlocks.innerHTML = '';
    const dur = el.video.duration;
    const hasSubs = state.subCues.length > 0 && state.subEnabled;
    el.subSyncMini.classList.toggle('visible', hasSubs);

    if (!hasSubs || !state.subTimelineBlocks || !Number.isFinite(dur) || dur <= 0) {
      return;
    }

    const frag = document.createDocumentFragment();
    // Cap rendered DOM segments by merging close cues if massive subtitle file
    const step = Math.max(1, Math.ceil(state.subCues.length / 260));
    for (let i = 0; i < state.subCues.length; i += step) {
      const cue = state.subCues[i];
      const s = Math.max(0, cue.start + state.subOffsetMs / 1000);
      const e = Math.min(dur, cue.end + state.subOffsetMs / 1000);
      if (e <= s || s >= dur) continue;
      const seg = document.createElement('div');
      seg.className = 'sub-block-seg';
      seg.style.left = `${(s / dur) * 100}%`;
      seg.style.width = `${Math.max(0.35, ((e - s) / dur) * 100)}%`;
      frag.appendChild(seg);
    }
    el.seekbarSubBlocks.appendChild(frag);
  }

  function updateActiveSubtitleCue() {
    if (!state.subEnabled || !state.subCues.length || !getCurrentItem()) {
      el.subtitleOverlay.classList.remove('visible');
      return;
    }
    const t = el.video.currentTime - state.subOffsetMs / 1000;
    const active = state.subCues.find((c) => t >= c.start && t <= c.end);
    if (active) {
      el.subtitleOverlay.textContent = active.text;
      el.subtitleOverlay.classList.add('visible');
    } else {
      el.subtitleOverlay.classList.remove('visible');
    }
  }

  // ==================== MEDIA LOADING, QUEUE & LIBRARY ====================
  async function loadMediaItemAtIndex(idx, autoPlay = true) {
    if (idx < 0 || idx >= state.queue.length) return;
    state.queueIndex = idx;
    const item = state.queue[idx];

    clearSubtitles();

    el.video.src = item.fileUrl;
    el.video.playbackRate = state.speed;
    el.video.loop = state.loop;
    el.video.classList.toggle('loaded', !item.isAudio);
    el.emptyState.classList.add('hidden');

    if (!item.isAudio) {
      thumbVideo.src = item.fileUrl;
    } else {
      thumbVideo.removeAttribute('src');
    }

    el.mediaTitle.textContent = item.title || item.name;
    document.title = `${item.title || item.name} — VLCopyCAT`;

    if (item.folderName) {
      el.folderCrumbText.textContent = item.folderName;
      el.btnFolderCrumb.title = item.folderPath;
    }

    // Auto-load matching subtitle if enabled
    if (state.autoLoadSub && item.autoSubPath) {
      const subData = await api.readSubtitle(item.autoSubPath);
      if (subData) loadSubtitleData(subData, false);
    }

    updateVisualizerVisibility();
    renderLibraryList();
    renderRightDrawer();

    if (autoPlay) {
      playMedia();
    } else {
      updateTransportUI();
    }
    pushPlayerStatus();
  }

  function ingestOpenedBundle(bundle, autoPlay = true) {
    if (!bundle) return;
    if (bundle.subtitleOnly) {
      loadSubtitleData(bundle.subtitleOnly, true);
      return;
    }

    const items = bundle.items || [];
    if (!items.length) {
      showToast('No supported media files found');
      return;
    }

    if (bundle.folder) {
      state.libraryFolder = bundle.folder;
      el.libFolderLabel.textContent = bundle.folder.folderName || 'Folder';
      el.folderCrumbText.textContent = bundle.folder.folderName || 'Folder';
    }

    if (items.length === 1 && state.autoLoadFolder && bundle.folder?.items?.length > 1) {
      state.queue = bundle.folder.items;
      const targetIdx = state.queue.findIndex((x) => x.filePath === items[0].filePath);
      loadMediaItemAtIndex(targetIdx >= 0 ? targetIdx : 0, autoPlay);
    } else {
      state.queue = items;
      loadMediaItemAtIndex(0, autoPlay);
    }

    renderLibraryList();
    renderRightDrawer();
  }

  function renderLibraryList() {
    el.libList.innerHTML = '';
    const folderItems = state.libraryFolder?.items || [];
    const q = state.libraryFilter.trim().toLowerCase();
    const filtered = q
      ? folderItems.filter((it) => it.name.toLowerCase().includes(q))
      : folderItems;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:22px 12px;text-align:center;color:var(--text-muted);font-size:12px;';
      empty.textContent = folderItems.length
        ? 'No matching media in this folder.'
        : 'Select a quick folder above or click "+ Folder" to browse.';
      el.libList.appendChild(empty);
      return;
    }

    const currentPath = getCurrentItem()?.filePath;
    const frag = document.createDocumentFragment();

    filtered.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'lib-item' + (item.filePath === currentPath ? ' playing' : '');
      row.title = item.name;

      const badge = document.createElement('div');
      badge.className = 'lib-item-badge';
      badge.textContent = (item.ext || '').replace('.', '').slice(0, 4) || 'FILE';

      const name = document.createElement('div');
      name.className = 'lib-item-name';
      name.textContent = item.title || item.name;

      row.appendChild(badge);
      row.appendChild(name);
      row.addEventListener('click', () => {
        state.queue = folderItems.slice();
        const idx = state.queue.findIndex((x) => x.filePath === item.filePath);
        loadMediaItemAtIndex(idx >= 0 ? idx : 0, true);
      });

      frag.appendChild(row);
    });

    el.libList.appendChild(frag);
  }

  function renderRightDrawer() {
    el.tabDrawerQueue.textContent = `Queue (${state.queue.length})`;
    el.tabDrawerBookmarks.textContent = `Bookmarks (${state.bookmarks.length})`;
    el.tabDrawerQueue.classList.toggle('active', state.drawerTab === 'queue');
    el.tabDrawerBookmarks.classList.toggle('active', state.drawerTab === 'bookmarks');

    el.drawerBody.innerHTML = '';

    if (state.drawerTab === 'queue') {
      if (!state.queue.length) {
        el.drawerBody.innerHTML = `<div style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:12px;">Queue is empty. Open or drop media files to begin.</div>`;
        return;
      }
      const frag = document.createDocumentFragment();
      state.queue.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'lib-item' + (idx === state.queueIndex ? ' playing' : '');

        const badge = document.createElement('div');
        badge.className = 'lib-item-badge';
        badge.textContent = String(idx + 1);

        const name = document.createElement('div');
        name.className = 'lib-item-name';
        name.textContent = item.title || item.name;

        row.appendChild(badge);
        row.appendChild(name);
        row.addEventListener('click', () => loadMediaItemAtIndex(idx, true));
        frag.appendChild(row);
      });
      el.drawerBody.appendChild(frag);
    } else {
      if (!state.bookmarks.length) {
        el.drawerBody.innerHTML = `<div style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:12px;">Press <strong>B</strong> while watching to save timestamp bookmarks.</div>`;
        return;
      }
      const frag = document.createDocumentFragment();
      state.bookmarks.forEach((bm) => {
        const row = document.createElement('div');
        row.className = 'lib-item';

        const badge = document.createElement('div');
        badge.className = 'lib-item-badge';
        badge.style.width = '44px';
        badge.textContent = formatTime(bm.time);

        const name = document.createElement('div');
        name.className = 'lib-item-name';
        name.textContent = bm.title;

        row.appendChild(badge);
        row.appendChild(name);
        row.addEventListener('click', async () => {
          const current = getCurrentItem();
          if (!current || current.filePath !== bm.filePath) {
            const qIdx = state.queue.findIndex((x) => x.filePath === bm.filePath);
            if (qIdx >= 0) {
              await loadMediaItemAtIndex(qIdx, true);
            } else {
              const res = await api.resolvePaths([bm.filePath]);
              if (res) ingestOpenedBundle(res, true);
            }
          }
          setTimeout(() => {
            el.video.currentTime = bm.time;
            showToast(`Jumped to bookmark ${formatTime(bm.time)}`);
          }, 120);
        });
        frag.appendChild(row);
      });
      el.drawerBody.appendChild(frag);
    }
  }

  function addBookmark() {
    const item = getCurrentItem();
    if (!item) return;
    const t = el.video.currentTime || 0;
    state.bookmarks.push({
      id: Date.now(),
      title: item.title || item.name,
      filePath: item.filePath,
      time: t
    });
    renderRightDrawer();
    showToast(`Bookmarked ${formatTime(t)}`);
  }

  // ==================== PLAYBACK & VIDEO CONTROLS ====================
  function playMedia() {
    if (!getCurrentItem()) return;
    ensureAudioGraph();
    el.video.play().catch((err) => console.warn('Play interrupted:', err));
  }

  function pauseMedia() {
    el.video.pause();
  }

  function togglePlay() {
    if (!getCurrentItem()) {
      openFileDialog(false);
      return;
    }
    if (el.video.paused) playMedia();
    else pauseMedia();
  }

  function playPrev() {
    if (!state.queue.length) return;
    if (el.video.currentTime > 4) {
      el.video.currentTime = 0;
      return;
    }
    const prevIdx = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    loadMediaItemAtIndex(prevIdx, true);
  }

  function playNext() {
    if (!state.queue.length) return;
    const nextIdx = (state.queueIndex + 1) % state.queue.length;
    loadMediaItemAtIndex(nextIdx, true);
  }

  function seekToRatio(ratio) {
    const dur = el.video.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    el.video.currentTime = clamped * dur;
    updateTimelineUI();
  }

  function seekByDelta(deltaSec) {
    const dur = el.video.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    el.video.currentTime = Math.max(0, Math.min(dur, el.video.currentTime + deltaSec));
    showToast(`${deltaSec >= 0 ? '+' : ''}${deltaSec}s (${formatTime(el.video.currentTime)})`);
  }

  function setSpeed(nextSpeed, toast = true) {
    const s = Math.max(0.25, Math.min(2.0, Math.round(nextSpeed * 100) / 100));
    state.speed = s;
    el.video.playbackRate = s;
    el.rngSpeed.value = String(s);
    el.lblSpeed.textContent = `${s.toFixed(2)}x`;
    if (toast) showToast(`Speed: ${s.toFixed(2)}x`);
    pushPlayerStatus();
  }

  function applyVideoAppearance() {
    el.video.style.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturation(${state.saturation}%)`;
    el.lblBrightness.textContent = `${state.brightness}%`;
    el.lblContrast.textContent = `${state.contrast}%`;
    el.lblSaturation.textContent = `${state.saturation}%`;

    const fit = state.videoFit;
    el.video.style.width = '100%';
    el.video.style.height = '100%';
    el.video.style.aspectRatio = '';

    if (fit === 'contain' || fit === 'cover' || fit === 'fill') {
      el.video.style.objectFit = fit;
    } else {
      // Forced aspect ratios: 16:9, 4:3, 21:9
      el.video.style.objectFit = 'fill';
      el.video.style.width = 'auto';
      el.video.style.height = 'auto';
      el.video.style.maxWidth = '100%';
      el.video.style.maxHeight = '100%';
      el.video.style.aspectRatio = fit.replace(':', ' / ');
    }
  }

  async function captureSnapshot() {
    const item = getCurrentItem();
    if (!item || item.isAudio || !el.video.videoWidth) {
      showToast('No active video frame to capture');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = el.video.videoWidth;
    canvas.height = el.video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(el.video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const res = await api.saveSnapshot({ dataUrl, baseName: item.title || 'vlcopycat' });
    if (res?.ok) {
      showToast('Snapshot saved to Pictures/VLCopyCAT Snapshots');
    } else {
      showToast('Snapshot failed');
    }
  }

  function updateTransportUI() {
    state.playing = !el.video.paused && !el.video.ended && Boolean(getCurrentItem());
    el.btnPlay.innerHTML = state.playing ? ICONS.pause : ICONS.play;
    el.btnPlay.classList.toggle('is-playing', state.playing);
  }

  function updateTimelineUI() {
    const cur = el.video.currentTime || 0;
    const dur = el.video.duration || 0;
    const forceHrs = dur >= 3600;

    el.timeElapsed.textContent = formatTime(cur, forceHrs);
    if (!Number.isFinite(dur) || dur <= 0) {
      el.timeTotal.textContent = '00:00';
      el.seekbarFill.style.width = '0%';
      el.seekbarThumb.style.left = '0%';
      return;
    }

    el.timeTotal.textContent = state.showRemainingTime
      ? `-${formatTime(Math.max(0, dur - cur), forceHrs)}`
      : formatTime(dur, forceHrs);

    const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
    el.seekbarFill.style.width = `${pct}%`;
    el.seekbarThumb.style.left = `${pct}%`;
    updateActiveSubtitleCue();
  }

  // ==================== AUDIO WAVEFORM VISUALIZER ====================
  function updateVisualizerVisibility() {
    const item = getCurrentItem();
    const shouldShow = Boolean(item && (item.isAudio || state.visualizerEnabled));
    el.visualizerCanvas.classList.toggle('visible', shouldShow);
    el.btnAudioPop.classList.toggle('active', state.visualizerEnabled || state.eqPreset !== 'flat');

    if (shouldShow && !visualizerRaf) {
      drawVisualizerLoop();
    } else if (!shouldShow && visualizerRaf) {
      cancelAnimationFrame(visualizerRaf);
      visualizerRaf = null;
    }
  }

  function drawVisualizerLoop() {
    const canvas = el.visualizerCanvas;
    if (!canvas.classList.contains('visible')) {
      visualizerRaf = null;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (analyserNode) {
      const bins = analyserNode.frequencyBinCount;
      const data = new Uint8Array(bins);
      analyserNode.getByteFrequencyData(data);

      const accentRgb = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-rgb')
        .trim() || '224, 122, 22';

      const barCount = 42;
      const gap = 5;
      const totalWidth = Math.min(w * 0.72, 620);
      const barW = Math.max(3, (totalWidth - gap * (barCount - 1)) / barCount);
      const startX = (w - (barW * barCount + gap * (barCount - 1))) / 2;
      const centerY = h / 2;

      for (let i = 0; i < barCount; i++) {
        const val = data[i % bins] / 255;
        const barH = Math.max(4, val * (h * 0.44));
        const x = startX + i * (barW + gap);
        ctx.fillStyle = `rgba(${accentRgb}, ${0.32 + val * 0.65})`;
        ctx.beginPath();
        ctx.roundRect(x, centerY - barH / 2, barW, barH, 3);
        ctx.fill();
      }
    }

    visualizerRaf = requestAnimationFrame(drawVisualizerLoop);
  }

  // ==================== DIALOG ACTIONS ====================
  async function openFileDialog(multi = false) {
    const bundle = await api.openFiles(multi);
    if (bundle) ingestOpenedBundle(bundle, true);
  }

  async function openFolderDialog() {
    const folder = await api.openFolder();
    if (!folder) return;
    state.libraryFolder = folder;
    el.libFolderLabel.textContent = folder.folderName || 'Folder';
    el.folderCrumbText.textContent = folder.folderName || 'Folder';
    el.librarySidebar.classList.remove('collapsed');
    el.btnSidebar.classList.add('active');
    renderLibraryList();
    if (folder.items?.length) {
      state.queue = folder.items.slice();
      loadMediaItemAtIndex(0, true);
    } else {
      showToast('Folder contains no media files');
    }
  }

  async function openSubtitleDialog() {
    const sub = await api.openSubtitle();
    if (sub) loadSubtitleData(sub, true);
  }

  // ==================== POPOVER & MODAL HELPERS ====================
  function openPopoverTab(tabName) {
    el.headerMenu.classList.remove('open');
    const isAlreadyOpenOnSame =
      el.bottomPopover.classList.contains('open') &&
      document.querySelector(`.pop-tab[data-pop-tab="${tabName}"]`)?.classList.contains('active');

    if (isAlreadyOpenOnSame) {
      el.bottomPopover.classList.remove('open');
      return;
    }

    document.querySelectorAll('.pop-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.popTab === tabName);
    });
    document.querySelectorAll('.pop-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.popPanel === tabName);
    });
    el.bottomPopover.classList.add('open');
  }

  function toggleSettingsModal(forceOpen) {
    el.headerMenu.classList.remove('open');
    el.bottomPopover.classList.remove('open');
    const shouldOpen = typeof forceOpen === 'boolean'
      ? forceOpen
      : !el.settingsBackdrop.classList.contains('open');
    el.settingsBackdrop.classList.toggle('open', shouldOpen);
  }

  // ==================== FULLSCREEN AUTO-HIDE IDLE ====================
  let fsIdleTimer = null;
  function resetFullscreenIdle() {
    el.app.classList.remove('fs-idle');
    clearTimeout(fsIdleTimer);
    if (state.isFullscreen && state.autoHideFs && state.playing) {
      fsIdleTimer = setTimeout(() => {
        if (
          state.isFullscreen &&
          state.playing &&
          !el.bottomPopover.classList.contains('open') &&
          !el.headerMenu.classList.contains('open') &&
          !el.settingsBackdrop.classList.contains('open')
        ) {
          el.app.classList.add('fs-idle');
        }
      }, 2600);
    }
  }

  // ==================== AI CONTROL BRIDGE TELEMETRY & COMMANDS ====================
  function pushPlayerStatus() {
    const item = getCurrentItem();
    api.reportStatus({
      app: 'VLCopyCAT',
      playing: state.playing,
      title: item?.title || null,
      filePath: item?.filePath || null,
      currentTime: Number((el.video.currentTime || 0).toFixed(2)),
      duration: Number((el.video.duration || 0).toFixed(2)),
      volume: state.volume,
      muted: state.muted,
      speed: state.speed,
      accent: state.accentKey === 'custom' ? state.customAccentHex : state.accentKey,
      queueLength: state.queue.length
    });
  }

  function handleAiCommand(cmd) {
    if (!cmd || !cmd.action) return;
    switch (cmd.action) {
      case 'play':
        playMedia();
        showToast('AI Bridge: Play');
        break;
      case 'pause':
        pauseMedia();
        showToast('AI Bridge: Pause');
        break;
      case 'togglePlay':
        togglePlay();
        showToast('AI Bridge: Toggle Play');
        break;
      case 'stop':
        pauseMedia();
        el.video.currentTime = 0;
        showToast('AI Bridge: Stop');
        break;
      case 'next':
        playNext();
        showToast('AI Bridge: Next Track');
        break;
      case 'prev':
        playPrev();
        showToast('AI Bridge: Previous Track');
        break;
      case 'seek':
        if (typeof cmd.delta === 'number') seekByDelta(cmd.delta);
        else if (typeof cmd.value === 'number' && Number.isFinite(el.video.duration)) {
          el.video.currentTime = Math.max(0, Math.min(el.video.duration, cmd.value));
          showToast(`AI Bridge: Seek → ${formatTime(el.video.currentTime)}`);
        }
        break;
      case 'volume':
        if (typeof cmd.value === 'number') {
          state.muted = false;
          state.volume = cmd.value;
          ensureAudioGraph();
          applyVolumeToEngine();
          savePreferences();
          showToast(`AI Bridge: Volume ${state.volume}%`);
        }
        break;
      case 'mute':
        state.muted = typeof cmd.value === 'boolean' ? cmd.value : !state.muted;
        applyVolumeToEngine();
        showToast(state.muted ? 'AI Bridge: Muted' : `AI Bridge: Unmuted (${state.volume}%)`);
        break;
      case 'speed':
        if (typeof cmd.value === 'number') setSpeed(cmd.value, true);
        break;
      case 'setAccent':
        if (cmd.value) {
          applyAccent(cmd.value, true);
          showToast(`AI Bridge: Theme → ${cmd.value}`);
        }
        break;
      case 'toggleFullscreen':
        api.toggleFullscreen();
        break;
      case 'togglePip':
        togglePictureInPicture();
        break;
      case 'openFile':
        if (cmd.resolved) {
          ingestOpenedBundle({ items: [cmd.resolved.item], folder: cmd.resolved.folder }, true);
          showToast(`AI Bridge: Opened ${cmd.resolved.item.name}`);
        }
        break;
      case 'openFolder':
        if (cmd.resolvedFolder) {
          ingestOpenedBundle({ items: cmd.resolvedFolder.items, folder: cmd.resolvedFolder }, true);
          showToast(`AI Bridge: Loaded folder ${cmd.resolvedFolder.folderName}`);
        }
        break;
    }
    pushPlayerStatus();
  }

  async function togglePictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (getCurrentItem() && !getCurrentItem().isAudio && el.video.readyState >= 2) {
        await el.video.requestPictureInPicture();
      } else {
        const pinned = await api.toggleAlwaysOnTop();
        state.alwaysOnTop = pinned;
        syncSwitchesUI();
        showToast(pinned ? 'Pinned Always on Top' : 'Unpinned Always on Top');
      }
    } catch {
      const pinned = await api.toggleAlwaysOnTop();
      state.alwaysOnTop = pinned;
      syncSwitchesUI();
    }
  }

  // ==================== INITIALIZATION & EVENT WIRING ====================
  async function init() {
    // 1. Inject custom crisp SVGs
    el.btnCone.innerHTML = ICONS.cone;
    el.btnMenu.innerHTML = ICONS.dots;
    el.btnSidebar.innerHTML = ICONS.sidebar;
    el.iconFolderCrumb.innerHTML = ICONS.folderPlay;
    el.btnPip.innerHTML = ICONS.pip;
    el.btnMinimize.innerHTML = ICONS.minimize;
    el.btnMaximize.innerHTML = ICONS.maximize;
    el.btnFullscreen.innerHTML = ICONS.fullscreen;
    el.btnClose.innerHTML = ICONS.close;
    el.libSearchIcon.innerHTML = ICONS.search;
    el.emptyCone.innerHTML = ICONS.cone;

    el.btnPrev.innerHTML = ICONS.prev;
    el.btnPlay.innerHTML = ICONS.play;
    el.btnNext.innerHTML = ICONS.next;
    el.btnMute.innerHTML = ICONS.speaker;
    el.btnAudioPop.innerHTML = ICONS.audioWave;
    el.btnSubPop.innerHTML = ICONS.subtitles;
    el.btnGearPop.innerHTML = ICONS.gearPlay;
    el.btnQueueDrawer.innerHTML = ICONS.queue;
    el.btnCloseSettings.innerHTML = ICONS.close;

    // 2. Build 9 Accent Swatches in Settings Modal
    Object.entries(ACCENT_PRESETS).forEach(([key, preset]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn';
      btn.dataset.accent = key;
      btn.style.background = preset.hex;
      btn.title = preset.label;
      btn.addEventListener('click', () => applyAccent(key, true));
      el.accentSwatches.appendChild(btn);
    });

    // 3. Load saved preferences & apply initial UI
    loadPreferences();
    applyAccent(state.accentKey === 'custom' ? state.customAccentHex : state.accentKey, false);
    applyVolumeToEngine();
    syncSwitchesUI();

    // 4. Populate Quick Folders in Left Sidebar + detect reference video on Desktop
    const quickFolders = await api.getQuickFolders();
    quickFolders.forEach((qf) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'lib-tab-pill';
      pill.textContent = qf.label;
      pill.title = qf.path;
      pill.addEventListener('click', async () => {
        document.querySelectorAll('.lib-tab-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const scanned = await api.scanFolder(qf.path);
        if (scanned) {
          state.libraryFolder = scanned;
          el.libFolderLabel.textContent = scanned.folderName;
          renderLibraryList();
        }
      });
      el.libQuickTabs.appendChild(pill);
    });

    const desktopEntry = quickFolders.find((q) => q.label === 'Desktop');
    if (desktopEntry) {
      const desktopScan = await api.scanFolder(desktopEntry.path);
      const demo = desktopScan?.items?.find((it) =>
        it.name.toLowerCase().includes('redesigned vlc') || it.name.includes('ERFeOgqk324')
      );
      if (demo) {
        state.demoVideoPath = demo.filePath;
        el.btnEmptyDemo.style.display = 'inline-block';
        el.menuPlayDemo.style.display = 'flex';
        const playDemo = async () => {
          const res = await api.resolvePaths([state.demoVideoPath]);
          if (res) ingestOpenedBundle(res, true);
        };
        el.btnEmptyDemo.addEventListener('click', playDemo);
        el.menuPlayDemo.addEventListener('click', () => {
          el.headerMenu.classList.remove('open');
          playDemo();
        });
      }
    }

    // 5. Window controls & IPC listeners
    el.btnMinimize.addEventListener('click', () => api.minimize());
    el.btnMaximize.addEventListener('click', () => api.maximize());
    el.btnFullscreen.addEventListener('click', () => api.toggleFullscreen());
    el.btnClose.addEventListener('click', () => api.close());
    el.btnPip.addEventListener('click', togglePictureInPicture);

    api.onWindowState((ws) => {
      state.isMaximized = ws.maximized;
      state.isFullscreen = ws.fullscreen;
      state.alwaysOnTop = ws.alwaysOnTop;
      if (ws.aiPort && ws.aiPort !== state.aiPort) {
        state.aiPort = ws.aiPort;
        el.aiEndpointBox.textContent =
          `Endpoint: http://127.0.0.1:${ws.aiPort}\n` +
          `Status:   GET  http://127.0.0.1:${ws.aiPort}/api/status\n` +
          `Control:  POST http://127.0.0.1:${ws.aiPort}/api/control`;
        el.aiSampleCmd.textContent =
          `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:${ws.aiPort}/api/control -ContentType 'application/json' -Body '{"action":"setAccent","value":"cyan"}'`;
      }
      el.btnPip.classList.toggle('active', state.alwaysOnTop);
      syncSwitchesUI();
      resetFullscreenIdle();
    });

    api.onInitialMedia((data) => {
      if (data?.item) {
        ingestOpenedBundle({ items: [data.item], folder: data.folder }, true);
      }
    });

    api.onAiCommand(handleAiCommand);

    // 6. Top bar & menu actions
    el.btnCone.addEventListener('click', () => toggleSettingsModal());
    el.btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      el.bottomPopover.classList.remove('open');
      el.headerMenu.classList.toggle('open');
    });

    el.btnSidebar.addEventListener('click', () => {
      const collapsed = el.librarySidebar.classList.toggle('collapsed');
      el.btnSidebar.classList.toggle('active', !collapsed);
    });

    el.btnFolderCrumb.addEventListener('click', () => {
      if (state.libraryFolder) {
        const collapsed = el.librarySidebar.classList.toggle('collapsed');
        el.btnSidebar.classList.toggle('active', !collapsed);
      } else {
        openFolderDialog();
      }
    });

    el.menuOpenFile.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      openFileDialog(false);
    });
    el.menuOpenMulti.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      openFileDialog(true);
    });
    el.menuOpenFolder.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      openFolderDialog();
    });
    el.menuOpenSub.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      openSubtitleDialog();
    });
    el.menuSnapshot.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      captureSnapshot();
    });
    el.menuReveal.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      const cur = getCurrentItem();
      if (cur) api.revealInExplorer(cur.filePath);
      else showToast('No media file currently open');
    });
    el.menuAlwaysTop.addEventListener('click', async () => {
      el.headerMenu.classList.remove('open');
      state.alwaysOnTop = await api.toggleAlwaysOnTop();
      syncSwitchesUI();
      showToast(state.alwaysOnTop ? 'Pinned Always on Top' : 'Unpinned Always on Top');
    });
    el.menuSettings.addEventListener('click', () => toggleSettingsModal(true));

    // 7. Library Sidebar & Empty State actions
    el.libSearchInput.addEventListener('input', () => {
      state.libraryFilter = el.libSearchInput.value;
      renderLibraryList();
    });
    el.btnLibOpenFolder.addEventListener('click', openFolderDialog);
    el.btnLibOpenFiles.addEventListener('click', () => openFileDialog(true));
    el.btnEmptyOpenFile.addEventListener('click', () => openFileDialog(false));
    el.btnEmptyOpenFolder.addEventListener('click', openFolderDialog);

    // 8. Right Queue & Bookmarks Drawer
    el.btnQueueDrawer.addEventListener('click', () => {
      const collapsed = el.rightDrawer.classList.toggle('collapsed');
      el.btnQueueDrawer.classList.toggle('active', !collapsed);
    });
    document.querySelectorAll('[data-drawer-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.drawerTab = btn.dataset.drawerTab;
        renderRightDrawer();
      });
    });
    el.btnDrawerAdd.addEventListener('click', () => openFileDialog(true));
    el.btnDrawerBookmark.addEventListener('click', addBookmark);
    el.btnDrawerClear.addEventListener('click', () => {
      if (state.drawerTab === 'queue') {
        pauseMedia();
        el.video.removeAttribute('src');
        el.video.classList.remove('loaded');
        el.emptyState.classList.remove('hidden');
        state.queue = [];
        state.queueIndex = -1;
        el.mediaTitle.textContent = 'VLCopyCAT';
        document.title = 'VLCopyCAT';
        clearSubtitles();
        updateVisualizerVisibility();
        updateTransportUI();
        updateTimelineUI();
      } else {
        state.bookmarks = [];
      }
      renderLibraryList();
      renderRightDrawer();
      pushPlayerStatus();
    });

    // 9. Transport & Video Events
    el.btnPlay.addEventListener('click', togglePlay);
    el.btnPrev.addEventListener('click', playPrev);
    el.btnNext.addEventListener('click', playNext);
    el.timeTotal.addEventListener('click', () => {
      state.showRemainingTime = !state.showRemainingTime;
      updateTimelineUI();
      savePreferences();
    });

    el.video.addEventListener('play', () => {
      updateTransportUI();
      resetFullscreenIdle();
      pushPlayerStatus();
    });
    el.video.addEventListener('pause', () => {
      updateTransportUI();
      resetFullscreenIdle();
      pushPlayerStatus();
    });
    el.video.addEventListener('loadedmetadata', () => {
      updateTimelineUI();
      renderSubtitleBlocksOnSeekbar();
      pushPlayerStatus();
    });
    el.video.addEventListener('timeupdate', updateTimelineUI);
    el.video.addEventListener('ended', () => {
      if (state.loop) return;
      if (state.queue.length > 1 && state.queueIndex < state.queue.length - 1) {
        playNext();
      } else {
        updateTransportUI();
        pushPlayerStatus();
      }
    });

    // Stage click (single-click play/pause, double-click fullscreen)
    let stageClickTimer = null;
    el.videoStage.addEventListener('click', (e) => {
      if (el.headerMenu.classList.contains('open') || el.bottomPopover.classList.contains('open')) {
        el.headerMenu.classList.remove('open');
        el.bottomPopover.classList.remove('open');
        return;
      }
      if (e.target.closest('.empty-state')) return;
      if (!getCurrentItem()) return;

      if (stageClickTimer) {
        clearTimeout(stageClickTimer);
        stageClickTimer = null;
        return;
      }
      stageClickTimer = setTimeout(() => {
        stageClickTimer = null;
        togglePlay();
      }, 200);
    });

    el.videoStage.addEventListener('dblclick', (e) => {
      if (e.target.closest('.empty-state')) return;
      if (stageClickTimer) {
        clearTimeout(stageClickTimer);
        stageClickTimer = null;
      }
      api.toggleFullscreen();
    });

    // Mouse wheel volume on video stage & volume cone
    const onVolumeWheel = (e) => {
      e.preventDefault();
      ensureAudioGraph();
      state.muted = false;
      const step = e.deltaY < 0 ? 5 : -5;
      state.volume = Math.max(0, Math.min(200, state.volume + step));
      applyVolumeToEngine();
      savePreferences();
      showToast(`Volume: ${state.volume}%`);
      pushPlayerStatus();
    };
    el.videoStage.addEventListener('wheel', onVolumeWheel, { passive: false });
    el.volConeSlider.addEventListener('wheel', onVolumeWheel, { passive: false });

    // 10. Thick Seekbar Scrubbing & Live Hover Preview Card
    let isScrubbing = false;
    const calcSeekRatio = (clientX) => {
      const rect = el.seekbarTrack.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    };

    const updateHoverPreview = (clientX) => {
      const dur = el.video.duration;
      if (!Number.isFinite(dur) || dur <= 0 || !getCurrentItem()) {
        el.seekHoverCard.classList.remove('visible');
        return;
      }
      const rect = el.seekbarTrack.getBoundingClientRect();
      const ratio = calcSeekRatio(clientX);
      const hoverSec = ratio * dur;

      const cardHalf = 90;
      const localX = Math.max(cardHalf, Math.min(rect.width - cardHalf, clientX - rect.left));
      el.seekHoverCard.style.left = `${localX}px`;
      el.hoverTimeText.textContent = formatTime(hoverSec, dur >= 3600);
      el.hoverPreviewCanvas.style.display = state.showHoverThumb ? 'block' : 'none';
      el.seekHoverCard.classList.add('visible');

      if (state.showHoverThumb) {
        requestThumbAt(hoverSec);
      }
    };

    el.seekbarTrack.addEventListener('pointerdown', (e) => {
      if (!getCurrentItem()) return;
      isScrubbing = true;
      el.seekbarTrack.setPointerCapture(e.pointerId);
      seekToRatio(calcSeekRatio(e.clientX));
      updateHoverPreview(e.clientX);
    });
    el.seekbarTrack.addEventListener('pointermove', (e) => {
      updateHoverPreview(e.clientX);
      if (isScrubbing) seekToRatio(calcSeekRatio(e.clientX));
    });
    el.seekbarTrack.addEventListener('pointerup', (e) => {
      if (isScrubbing) {
        isScrubbing = false;
        el.seekbarTrack.releasePointerCapture(e.pointerId);
      }
    });
    el.seekbarTrack.addEventListener('pointerleave', () => {
      if (!isScrubbing) el.seekHoverCard.classList.remove('visible');
    });

    // Mini subtitle sync buttons next to seekbar
    const adjustSubOffset = (deltaMs) => {
      state.subOffsetMs += deltaMs;
      el.lblSubOffset.textContent = `${state.subOffsetMs >= 0 ? '+' : ''}${state.subOffsetMs} ms`;
      renderSubtitleBlocksOnSeekbar();
      updateActiveSubtitleCue();
      showToast(`Subtitle Sync: ${state.subOffsetMs >= 0 ? '+' : ''}${state.subOffsetMs} ms`);
    };
    el.btnSubEarlier.addEventListener('click', () => adjustSubOffset(-50));
    el.btnSubLater.addEventListener('click', () => adjustSubOffset(50));

    // 11. Horizontal Cone Volume Slider Dragging
    let isDraggingVol = false;
    const setVolFromPointer = (clientX) => {
      ensureAudioGraph();
      const rect = el.volConeSlider.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      state.muted = false;
      state.volume = Math.round(ratio * 200);
      applyVolumeToEngine();
      showToast(`Volume: ${state.volume}%`);
    };

    el.volConeSlider.addEventListener('pointerdown', (e) => {
      isDraggingVol = true;
      el.volConeSlider.setPointerCapture(e.pointerId);
      setVolFromPointer(e.clientX);
    });
    el.volConeSlider.addEventListener('pointermove', (e) => {
      if (isDraggingVol) setVolFromPointer(e.clientX);
    });
    el.volConeSlider.addEventListener('pointerup', (e) => {
      if (isDraggingVol) {
        isDraggingVol = false;
        el.volConeSlider.releasePointerCapture(e.pointerId);
        savePreferences();
        pushPlayerStatus();
      }
    });

    el.btnMute.addEventListener('click', () => {
      state.muted = !state.muted;
      applyVolumeToEngine();
      showToast(state.muted ? 'Muted' : `Volume: ${state.volume}%`);
      pushPlayerStatus();
    });

    // 12. Bottom-Right 4-Tab Popover Controls
    el.btnAudioPop.addEventListener('click', (e) => {
      e.stopPropagation();
      openPopoverTab('audio');
    });
    el.btnSubPop.addEventListener('click', (e) => {
      e.stopPropagation();
      openPopoverTab('subtitles');
    });
    el.btnGearPop.addEventListener('click', (e) => {
      e.stopPropagation();
      openPopoverTab('playback');
    });

    document.querySelectorAll('.pop-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.popTab;
        document.querySelectorAll('.pop-tab').forEach((b) => b.classList.toggle('active', b === tab));
        document.querySelectorAll('.pop-panel').forEach((p) => {
          p.classList.toggle('active', p.dataset.popPanel === name);
        });
      });
    });

    el.rngSpeed.addEventListener('input', () => setSpeed(Number(el.rngSpeed.value), false));
    document.querySelectorAll('.speed-chip').forEach((chip) => {
      chip.addEventListener('click', () => setSpeed(Number(chip.dataset.speed), true));
    });

    el.swLoop.addEventListener('click', () => {
      state.loop = !state.loop;
      el.video.loop = state.loop;
      syncSwitchesUI();
      showToast(state.loop ? 'Loop: ON' : 'Loop: OFF');
    });

    el.swSubTimeline.addEventListener('click', () => {
      state.subTimelineBlocks = !state.subTimelineBlocks;
      syncSwitchesUI();
      renderSubtitleBlocksOnSeekbar();
      savePreferences();
    });

    el.btnPopSnapshot.addEventListener('click', captureSnapshot);

    el.selVideoFit.addEventListener('change', () => {
      state.videoFit = el.selVideoFit.value;
      applyVideoAppearance();
      showToast(`Video Fit: ${el.selVideoFit.options[el.selVideoFit.selectedIndex].text}`);
    });
    el.rngBrightness.addEventListener('input', () => {
      state.brightness = Number(el.rngBrightness.value);
      applyVideoAppearance();
    });
    el.rngContrast.addEventListener('input', () => {
      state.contrast = Number(el.rngContrast.value);
      applyVideoAppearance();
    });
    el.rngSaturation.addEventListener('input', () => {
      state.saturation = Number(el.rngSaturation.value);
      applyVideoAppearance();
    });
    el.btnResetVideo.addEventListener('click', () => {
      state.videoFit = 'contain';
      state.brightness = 100;
      state.contrast = 100;
      state.saturation = 100;
      el.selVideoFit.value = 'contain';
      el.rngBrightness.value = '100';
      el.rngContrast.value = '100';
      el.rngSaturation.value = '100';
      applyVideoAppearance();
      showToast('Video filters reset');
    });

    el.rngVolumePop.addEventListener('input', () => {
      ensureAudioGraph();
      state.muted = false;
      state.volume = Number(el.rngVolumePop.value);
      applyVolumeToEngine();
      savePreferences();
    });
    el.selEqPreset.addEventListener('change', () => {
      ensureAudioGraph();
      state.eqPreset = el.selEqPreset.value;
      applyEqualizer();
      updateVisualizerVisibility();
      savePreferences();
      showToast(`Equalizer: ${el.selEqPreset.options[el.selEqPreset.selectedIndex].text}`);
    });
    el.swVisualizer.addEventListener('click', () => {
      ensureAudioGraph();
      state.visualizerEnabled = !state.visualizerEnabled;
      syncSwitchesUI();
      updateVisualizerVisibility();
    });

    el.swSubEnabled.addEventListener('click', () => {
      state.subEnabled = !state.subEnabled;
      syncSwitchesUI();
      el.btnSubPop.classList.toggle('active', state.subEnabled && state.subCues.length > 0);
      renderSubtitleBlocksOnSeekbar();
      updateActiveSubtitleCue();
    });
    el.btnLoadSub.addEventListener('click', openSubtitleDialog);
    el.rngSubSize.addEventListener('input', () => {
      state.subSizePx = Number(el.rngSubSize.value);
      el.lblSubSize.textContent = `${state.subSizePx}px`;
      el.subtitleOverlay.style.fontSize = `${state.subSizePx}px`;
      savePreferences();
    });
    el.btnSubMinus100.addEventListener('click', () => adjustSubOffset(-100));
    el.btnSubPlus100.addEventListener('click', () => adjustSubOffset(100));
    el.btnSubReset.addEventListener('click', () => {
      state.subOffsetMs = 0;
      el.lblSubOffset.textContent = '0 ms';
      renderSubtitleBlocksOnSeekbar();
      updateActiveSubtitleCue();
      showToast('Subtitle sync reset to 0 ms');
    });

    el.btnOpenGlobalPrefs.addEventListener('click', () => toggleSettingsModal(true));

    // 13. Global Settings Modal Navigation & Switches
    el.btnCloseSettings.addEventListener('click', () => toggleSettingsModal(false));
    el.settingsBackdrop.addEventListener('click', (e) => {
      if (e.target === el.settingsBackdrop) toggleSettingsModal(false);
    });

    document.querySelectorAll('.settings-nav-btn').forEach((navBtn) => {
      navBtn.addEventListener('click', () => {
        const target = navBtn.dataset.settingsTab;
        document.querySelectorAll('.settings-nav-btn').forEach((b) =>
          b.classList.toggle('active', b === navBtn)
        );
        document.querySelectorAll('.settings-panel').forEach((p) => {
          p.style.display = p.dataset.settingsPanel === target ? 'flex' : 'none';
        });
        el.settingsTitle.textContent = navBtn.innerText.trim();
      });
    });

    el.inpCustomAccent.addEventListener('input', () => {
      applyAccent(el.inpCustomAccent.value, true);
    });
    el.swHoverThumb.addEventListener('click', () => {
      state.showHoverThumb = !state.showHoverThumb;
      syncSwitchesUI();
      savePreferences();
    });
    el.swAutohideFs.addEventListener('click', () => {
      state.autoHideFs = !state.autoHideFs;
      syncSwitchesUI();
      savePreferences();
    });
    el.swAlwaysOnTop.addEventListener('click', async () => {
      state.alwaysOnTop = await api.toggleAlwaysOnTop();
      syncSwitchesUI();
    });
    el.swAutoloadFolder.addEventListener('click', () => {
      state.autoLoadFolder = !state.autoLoadFolder;
      syncSwitchesUI();
      savePreferences();
    });
    el.swAutoloadSub.addEventListener('click', () => {
      state.autoLoadSub = !state.autoLoadSub;
      syncSwitchesUI();
      savePreferences();
    });
    el.swRememberState.addEventListener('click', () => {
      state.rememberState = !state.rememberState;
      syncSwitchesUI();
      savePreferences();
    });

    el.btnCopyAiCmd.addEventListener('click', () => {
      navigator.clipboard.writeText(el.aiSampleCmd.textContent).then(() => {
        showToast('Copied PowerShell AI Control command');
      });
    });

    // Close floating menus when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#header-menu') && !e.target.closest('#btn-menu')) {
        el.headerMenu.classList.remove('open');
      }
      if (
        !e.target.closest('#bottom-popover') &&
        !e.target.closest('#btn-audio-pop') &&
        !e.target.closest('#btn-sub-pop') &&
        !e.target.closest('#btn-gear-pop')
      ) {
        el.bottomPopover.classList.remove('open');
      }
    });

    // 14. Drag & Drop Files / Folders / Subtitles Anywhere
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth++;
      el.dropOverlay.classList.add('active');
    });
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) el.dropOverlay.classList.remove('active');
    });
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragDepth = 0;
      el.dropOverlay.classList.remove('active');

      const files = Array.from(e.dataTransfer?.files || []);
      const paths = files.map((f) => api.getPathForFile(f)).filter(Boolean);
      if (!paths.length) return;

      const resolved = await api.resolvePaths(paths);
      if (resolved) ingestOpenedBundle(resolved, true);
      else showToast('Unsupported file format');
    });

    // 15. Keyboard Shortcuts & Fullscreen Mouse Activity
    window.addEventListener('mousemove', resetFullscreenIdle);

    window.addEventListener('keydown', (e) => {
      resetFullscreenIdle();

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') {
        e.preventDefault();
        openFileDialog(true);
        return;
      }
      if (e.ctrlKey && e.code === 'KeyO') {
        e.preventDefault();
        openFileDialog(false);
        return;
      }
      if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        openFolderDialog();
        return;
      }
      if (e.ctrlKey && e.code === 'KeyP') {
        e.preventDefault();
        toggleSettingsModal();
        return;
      }
      if (e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        captureSnapshot();
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          api.toggleFullscreen();
          break;
        case 'Escape':
          if (el.settingsBackdrop.classList.contains('open')) {
            toggleSettingsModal(false);
          } else if (el.bottomPopover.classList.contains('open') || el.headerMenu.classList.contains('open')) {
            el.bottomPopover.classList.remove('open');
            el.headerMenu.classList.remove('open');
          } else if (state.isFullscreen) {
            api.toggleFullscreen();
          }
          break;
        case 'KeyM':
          e.preventDefault();
          el.btnMute.click();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekByDelta(e.shiftKey ? -15 : -5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekByDelta(e.shiftKey ? 15 : 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          ensureAudioGraph();
          state.muted = false;
          state.volume = Math.min(200, state.volume + 5);
          applyVolumeToEngine();
          savePreferences();
          showToast(`Volume: ${state.volume}%`);
          break;
        case 'ArrowDown':
          e.preventDefault();
          ensureAudioGraph();
          state.muted = false;
          state.volume = Math.max(0, state.volume - 5);
          applyVolumeToEngine();
          savePreferences();
          showToast(`Volume: ${state.volume}%`);
          break;
        case 'BracketLeft':
          e.preventDefault();
          setSpeed(state.speed - 0.1, true);
          break;
        case 'BracketRight':
          e.preventDefault();
          setSpeed(state.speed + 0.1, true);
          break;
        case 'KeyB':
          e.preventDefault();
          addBookmark();
          break;
        case 'KeyN':
          e.preventDefault();
          playNext();
          break;
        case 'KeyP':
          e.preventDefault();
          playPrev();
          break;
      }
    });

    // Periodic status sync for AI Control Bridge
    setInterval(pushPlayerStatus, 1000);
    renderLibraryList();
    renderRightDrawer();
    pushPlayerStatus();
  }

  init();
})();
