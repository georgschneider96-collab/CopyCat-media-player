// VLCopyCAT Renderer Application
// Implements Juxtopposed's 25-Year VLC Redesign UI + Universal FFmpeg Live Stream Engine + 200% Cone Boost + Local AI Bridge

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
    currentItem: null,       // Active media item (from folder, queue, or single file)
    playbackSource: null,    // 'folder' | 'queue' | 'single' | null
    folderPlaylist: [],      // Ordered media items for active left-sidebar folder playback
    folderPlayIndex: -1,
    queue: [],               // Explicit user-built right-sidebar Queue (only via + / Add Files)
    queueIndex: -1,
    libraryFolder: null,     // { folderPath, parentPath, folderName, subfolders, items }
    libraryFilter: '',
    sidebarShortcuts: null,  // [{ label, path }] — customizable user shortcuts
    bookmarks: [],           // { id, title, filePath, time }
    drawerTab: 'queue',      // 'queue' | 'bookmarks'

    playing: false,
    volume: 100,             // 0..200 (200% cone boost)
    muted: false,
    speed: 1.0,
    loop: false,
    showRemainingTime: true,

    // Universal FFmpeg Live Stream state (for MPEG-TS .mp4, MKV, AVI, AC3, Hi10P, etc.)
    hasFfmpeg: true,
    streamMode: false,
    streamOffset: 0,
    streamDuration: 0,
    streamVideoCodec: '',
    streamForceTranscode: false,
    fallbackAttempted: false,
    scrubPreviewTime: null,

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

    // Window & chrome interaction state
    isFullscreen: false,
    isMaximized: false,
    aiPort: 4500,
    hoveringTopBar: false,
    hoveringBottomBar: false,
    hoveringLeftSidebar: false,
    hoveringRightDrawer: false,
    draggingQueueItem: false,
    externalFileDragActive: false,
    dialogOpen: false,
    lastPauseAt: 0,

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
    btnPinShortcut: $('btn-pin-shortcut'),
    btnResetShortcuts: $('btn-reset-shortcuts'),
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

  // ==================== UNIFIED TIME HELPERS ====================
  function getDuration() {
    if (state.streamMode) {
      return state.streamDuration > 0 ? state.streamDuration : 0;
    }
    return Number.isFinite(el.video.duration) && el.video.duration > 0 ? el.video.duration : 0;
  }

  function getCurrentTime() {
    if (state.scrubPreviewTime !== null) {
      return state.scrubPreviewTime;
    }
    if (state.streamMode) {
      const t = state.streamOffset + (el.video.currentTime || 0);
      return state.streamDuration > 0 ? Math.min(state.streamDuration, t) : t;
    }
    return el.video.currentTime || 0;
  }

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

  // ==================== HOVER THUMBNAIL ENGINE (NATIVE + FFMPEG STREAM) ====================
  const thumbVideo = document.createElement('video');
  thumbVideo.muted = true;
  thumbVideo.preload = 'auto';
  thumbVideo.playsInline = true;
  let thumbSeeking = false;
  let pendingThumbTime = null;

  const streamThumbImg = new Image();
  streamThumbImg.crossOrigin = 'anonymous';
  let streamThumbLoading = false;
  let pendingStreamThumbSec = null;
  let lastStreamThumbSec = -999;

  const hoverCtx = el.hoverPreviewCanvas.getContext('2d');

  thumbVideo.addEventListener('seeked', () => {
    drawFittedSourceToHover(thumbVideo, thumbVideo.videoWidth, thumbVideo.videoHeight);
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

  streamThumbImg.addEventListener('load', () => {
    drawFittedSourceToHover(streamThumbImg, streamThumbImg.naturalWidth, streamThumbImg.naturalHeight);
    if (pendingStreamThumbSec !== null && Math.abs(pendingStreamThumbSec - lastStreamThumbSec) >= 1.0) {
      const nextSec = pendingStreamThumbSec;
      pendingStreamThumbSec = null;
      triggerStreamThumbFetch(nextSec);
    } else {
      pendingStreamThumbSec = null;
      streamThumbLoading = false;
    }
  });

  streamThumbImg.addEventListener('error', () => {
    streamThumbLoading = false;
    pendingStreamThumbSec = null;
  });

  function triggerStreamThumbFetch(sec) {
    const item = getCurrentItem();
    if (!item) return;
    streamThumbLoading = true;
    lastStreamThumbSec = sec;
    streamThumbImg.src =
      `http://127.0.0.1:${state.aiPort}/api/thumb?path=${encodeURIComponent(item.filePath)}&t=${sec.toFixed(1)}`;
  }

  function requestThumbAt(seconds) {
    const currentItem = getCurrentItem();
    if (!currentItem || currentItem.isAudio || !state.showHoverThumb) {
      drawPlaceholderThumb(currentItem?.isAudio ? 'AUDIO TRACK' : 'PREVIEW');
      return;
    }

    if (state.streamMode) {
      const rounded = Math.round(seconds * 2) / 2;
      if (Math.abs(rounded - lastStreamThumbSec) < 0.5) return;
      if (!streamThumbLoading) {
        triggerStreamThumbFetch(rounded);
      } else {
        pendingStreamThumbSec = rounded;
      }
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

  function drawFittedSourceToHover(source, sw, sh) {
    const cw = el.hoverPreviewCanvas.width;
    const ch = el.hoverPreviewCanvas.height;
    hoverCtx.fillStyle = '#090909';
    hoverCtx.fillRect(0, 0, cw, ch);
    if (!sw || !sh) return;

    const scale = Math.min(cw / sw, ch / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    hoverCtx.drawImage(source, dx, dy, dw, dh);
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
    return state.currentItem || null;
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
      folderPlaybackV3: true,
      autoLoadSub: state.autoLoadSub,
      rememberState: state.rememberState,
      subTimelineBlocks: state.subTimelineBlocks,
      subSizePx: state.subSizePx,
      eqPreset: state.eqPreset,
      showRemainingTime: state.showRemainingTime,
      sidebarShortcuts: state.sidebarShortcuts
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
      if (d.folderPlaybackV3 && typeof d.autoLoadFolder === 'boolean') {
        state.autoLoadFolder = d.autoLoadFolder;
      } else {
        state.autoLoadFolder = true;
      }
      if (typeof d.autoLoadSub === 'boolean') state.autoLoadSub = d.autoLoadSub;
      if (typeof d.rememberState === 'boolean') state.rememberState = d.rememberState;
      if (typeof d.subTimelineBlocks === 'boolean') state.subTimelineBlocks = d.subTimelineBlocks;
      if (typeof d.subSizePx === 'number') state.subSizePx = d.subSizePx;
      if (typeof d.eqPreset === 'string') state.eqPreset = d.eqPreset;
      if (typeof d.showRemainingTime === 'boolean') state.showRemainingTime = d.showRemainingTime;
      if (Array.isArray(d.sidebarShortcuts)) state.sidebarShortcuts = d.sidebarShortcuts;

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
    const dur = getDuration();
    const hasSubs = state.subCues.length > 0 && state.subEnabled;
    el.subSyncMini.classList.toggle('visible', hasSubs);

    if (!hasSubs || !state.subTimelineBlocks || !Number.isFinite(dur) || dur <= 0) {
      return;
    }

    const frag = document.createDocumentFragment();
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
    const t = getCurrentTime() - state.subOffsetMs / 1000;
    const active = state.subCues.find((c) => t >= c.start && t <= c.end);
    if (active) {
      el.subtitleOverlay.textContent = active.text;
      el.subtitleOverlay.classList.add('visible');
    } else {
      el.subtitleOverlay.classList.remove('visible');
    }
  }

  // ==================== UNIVERSAL FFMPEG LIVE STREAM ENGINE ====================
  function buildStreamUrl(filePath, startSec) {
    const params = new URLSearchParams({
      path: filePath,
      start: startSec.toFixed(2),
      vcodec: state.streamVideoCodec || '',
      transcode: state.streamForceTranscode ? '1' : '0'
    });
    return `http://127.0.0.1:${state.aiPort}/api/stream?${params.toString()}`;
  }

  async function startFfmpegStreamPlayback(item, startSec = 0, autoPlay = true, forceTranscode = false) {
    const probe = await api.probeMedia(item.filePath);
    state.streamMode = true;
    state.streamOffset = startSec;
    state.streamDuration = probe?.duration || 0;
    state.streamVideoCodec = probe?.videoCodec || '';
    state.streamForceTranscode = forceTranscode;
    lastStreamThumbSec = -999;

    thumbVideo.removeAttribute('src');
    el.video.crossOrigin = 'anonymous';
    el.video.loop = false; // Handled manually on 'ended' so loop starts at 0:00
    el.video.src = buildStreamUrl(item.filePath, startSec);
    el.video.playbackRate = state.speed;

    updateTimelineUI();
    renderSubtitleBlocksOnSeekbar();

    if (autoPlay) {
      playMedia();
    } else {
      updateTransportUI();
    }
    pushPlayerStatus();
  }

  function reloadStreamAt(targetSec, shouldPlay) {
    const item = getCurrentItem();
    if (!item || !state.streamMode) return;
    const dur = getDuration();
    const clamped = dur > 0 ? Math.max(0, Math.min(dur - 0.25, targetSec)) : Math.max(0, targetSec);
    state.streamOffset = clamped;
    el.video.crossOrigin = 'anonymous';
    el.video.src = buildStreamUrl(item.filePath, clamped);
    el.video.playbackRate = state.speed;
    updateTimelineUI();
    if (shouldPlay) {
      playMedia();
    }
  }

  // ==================== MEDIA LOADING, FOLDER PLAYBACK & EXPLICIT QUEUE ====================
  async function resetPlayerToIdle() {
    pauseMedia();
    await api.stopStream();
    el.video.removeAttribute('src');
    el.video.classList.remove('loaded');
    el.emptyState.classList.remove('hidden');
    state.currentItem = null;
    state.playbackSource = null;
    state.queueIndex = -1;
    state.folderPlayIndex = -1;
    state.streamMode = false;
    state.streamOffset = 0;
    state.streamDuration = 0;
    el.mediaTitle.textContent = 'VLCopyCAT';
    document.title = 'VLCopyCAT';
    clearSubtitles();
    updateVisualizerVisibility();
    updateTransportUI();
    updateTimelineUI();
    updateChromeSolidity();
  }

  async function loadMediaItem(
    item,
    { autoPlay = true, source = 'single', folderList = null, folderIdx = -1, queueIdx = -1 } = {}
  ) {
    if (!item) return;

    state.currentItem = item;
    state.playbackSource = source;

    if (source === 'folder') {
      if (Array.isArray(folderList)) {
        state.folderPlaylist = folderList.slice();
      }
      state.folderPlayIndex = folderIdx;
      state.queueIndex = -1;
    } else if (source === 'queue') {
      state.queueIndex = queueIdx;
      state.folderPlayIndex = -1;
    } else {
      state.queueIndex = -1;
      state.folderPlayIndex = -1;
      state.folderPlaylist = [];
    }

    await api.stopStream();
    clearSubtitles();

    state.streamMode = false;
    state.streamOffset = 0;
    state.streamDuration = 0;
    state.streamVideoCodec = '';
    state.streamForceTranscode = false;
    state.fallbackAttempted = false;
    state.scrubPreviewTime = null;
    lastStreamThumbSec = -999;

    el.video.classList.toggle('loaded', !item.isAudio);
    el.emptyState.classList.add('hidden');
    updateChromeSolidity();
    applyVideoAppearance();

    el.mediaTitle.textContent = item.title || item.name;
    document.title = `${item.title || item.name} — VLCopyCAT`;

    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.title || item.name,
          artist: item.folderName || 'VLCopyCAT'
        });
      } catch {}
    }

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

    // Proactively use FFmpeg Live Stream for MPEG-TS disguised as .mp4, AVI, TS, FLV, etc.
    if (item.needsStream && state.hasFfmpeg) {
      await startFfmpegStreamPlayback(item, 0, autoPlay, false);
      return;
    }

    // Standard native playback path (ISO MP4, WebM, Audio)
    el.video.removeAttribute('crossorigin');
    el.video.src = item.fileUrl;
    el.video.playbackRate = state.speed;
    el.video.loop = state.loop;

    if (!item.isAudio) {
      thumbVideo.src = item.fileUrl;
    } else {
      thumbVideo.removeAttribute('src');
    }

    if (autoPlay) {
      playMedia();
    } else {
      updateTransportUI();
    }
    pushPlayerStatus();
  }

  async function loadQueueItemAtIndex(idx, autoPlay = true) {
    if (idx < 0 || idx >= state.queue.length) return;
    await loadMediaItem(state.queue[idx], {
      autoPlay,
      source: 'queue',
      queueIdx: idx
    });
  }

  async function loadFolderItemAtIndex(idx, autoPlay = true, folderListOverride = null) {
    const list = Array.isArray(folderListOverride) ? folderListOverride : state.folderPlaylist;
    if (!Array.isArray(list) || idx < 0 || idx >= list.length) return;
    await loadMediaItem(list[idx], {
      autoPlay,
      source: 'folder',
      folderList: Array.isArray(folderListOverride) ? folderListOverride : null,
      folderIdx: idx
    });
  }

  function insertItemsIntoQueueAt(
    items,
    insertIndex,
    { playFirstIfIdle = false, toast = true, isAppend = false } = {}
  ) {
    if (!Array.isArray(items) || !items.length) {
      if (toast) showToast('No supported media files selected');
      return;
    }

    const isPlayerIdle = !getCurrentItem();
    const idx = Math.max(0, Math.min(state.queue.length, insertIndex));
    state.queue.splice(idx, 0, ...items);

    // Keep currently playing Queue item index synchronized if files were inserted at or above it
    if (state.playbackSource === 'queue' && state.queueIndex >= idx) {
      state.queueIndex += items.length;
    }

    renderLibraryList();
    renderRightDrawer();
    pushPlayerStatus();

    if (isPlayerIdle && playFirstIfIdle) {
      loadQueueItemAtIndex(idx, true);
    } else if (toast) {
      if (isAppend) {
        if (items.length === 1) {
          showToast(`Queued: ${items[0].title || items[0].name}`);
        } else {
          showToast(`Added ${items.length} files to queue`);
        }
      } else if (items.length === 1) {
        showToast(`Queued at #${idx + 1}: ${items[0].title || items[0].name}`);
      } else {
        showToast(`Added ${items.length} files at #${idx + 1} in queue`);
      }
    }
  }

  function appendItemsToQueue(items, { playFirstIfIdle = true, toast = true } = {}) {
    insertItemsIntoQueueAt(items, state.queue.length, {
      playFirstIfIdle,
      toast,
      isAppend: true
    });
  }

  async function replaceQueueWithDroppedBundle(bundle) {
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

    if (bundle.folder && !state.libraryFolder) {
      state.libraryFolder = bundle.folder;
      el.libFolderLabel.textContent = bundle.folder.folderName || 'Folder';
      el.folderCrumbText.textContent = bundle.folder.folderName || 'Folder';
      renderSidebarShortcuts();
    }

    state.queue = items.slice();
    await loadQueueItemAtIndex(0, true);

    if (items.length === 1) {
      showToast(`Playing: ${items[0].title || items[0].name}`);
    } else {
      showToast(`Queue refreshed (${items.length} files)`);
    }
  }

  function moveQueueItem(fromIdx, toIdx) {
    if (
      fromIdx < 0 ||
      fromIdx >= state.queue.length ||
      toIdx < 0 ||
      toIdx >= state.queue.length ||
      fromIdx === toIdx
    ) {
      return;
    }
    const [moved] = state.queue.splice(fromIdx, 1);
    state.queue.splice(toIdx, 0, moved);

    if (state.playbackSource === 'queue' && state.queueIndex >= 0) {
      if (state.queueIndex === fromIdx) {
        state.queueIndex = toIdx;
      } else if (fromIdx < state.queueIndex && toIdx >= state.queueIndex) {
        state.queueIndex--;
      } else if (fromIdx > state.queueIndex && toIdx <= state.queueIndex) {
        state.queueIndex++;
      }
    }

    renderRightDrawer();
    pushPlayerStatus();
  }

  async function removeQueueItem(idx) {
    if (idx < 0 || idx >= state.queue.length) return;
    const removed = state.queue[idx];
    state.queue.splice(idx, 1);

    if (state.playbackSource === 'queue') {
      if (state.queue.length === 0) {
        await resetPlayerToIdle();
      } else if (idx < state.queueIndex) {
        state.queueIndex--;
      } else if (idx === state.queueIndex) {
        const nextIdx = Math.min(idx, state.queue.length - 1);
        await loadQueueItemAtIndex(nextIdx, !el.video.paused);
      }
    }

    renderLibraryList();
    renderRightDrawer();
    pushPlayerStatus();
    if (removed) showToast(`Removed from queue: ${removed.title || removed.name}`);
  }

  function ingestOpenedBundle(bundle, autoPlay = true, { append = false } = {}) {
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

    if (bundle.folder && (!append || !state.libraryFolder)) {
      state.libraryFolder = bundle.folder;
      el.libFolderLabel.textContent = bundle.folder.folderName || 'Folder';
      el.folderCrumbText.textContent = bundle.folder.folderName || 'Folder';
    }

    if (append) {
      appendItemsToQueue(items, { playFirstIfIdle: autoPlay, toast: true });
      renderSidebarShortcuts();
      return;
    }

    // Play without adding to the explicit Queue
    if (items.length === 1 && state.autoLoadFolder && bundle.folder?.items?.length > 1) {
      const targetIdx = bundle.folder.items.findIndex((x) => x.filePath === items[0].filePath);
      loadFolderItemAtIndex(targetIdx >= 0 ? targetIdx : 0, autoPlay, bundle.folder.items);
    } else if (items.length > 1) {
      loadFolderItemAtIndex(0, autoPlay, items);
    } else {
      loadMediaItem(items[0], { autoPlay, source: 'single' });
    }

    renderSidebarShortcuts();
    renderLibraryList();
    renderRightDrawer();
  }

  async function navigateLibraryToFolder(folderPath) {
    if (!folderPath) return;
    const scanned = await api.scanFolder(folderPath);
    if (!scanned) return;
    state.libraryFolder = scanned;
    el.libFolderLabel.textContent = scanned.folderName || 'Folder';
    el.libFolderLabel.title = scanned.folderPath || '';
    renderSidebarShortcuts();
    renderLibraryList();
  }

  function renderSidebarShortcuts() {
    el.libQuickTabs.innerHTML = '';
    const list = state.sidebarShortcuts || [];
    const activePath = (state.libraryFolder?.folderPath || '').toLowerCase();

    list.forEach((sc, idx) => {
      const pill = document.createElement('div');
      const isMatch = activePath && sc.path && activePath === sc.path.toLowerCase();
      pill.className = 'lib-tab-pill' + (isMatch ? ' active' : '');
      pill.title = `${sc.path}\n(Click to open • Click × to remove)`;

      const lbl = document.createElement('span');
      lbl.className = 'lib-tab-pill-label';
      lbl.textContent = sc.label;

      const rm = document.createElement('span');
      rm.className = 'lib-tab-pill-remove';
      rm.textContent = '×';
      rm.title = `Remove "${sc.label}" shortcut`;
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        state.sidebarShortcuts.splice(idx, 1);
        savePreferences();
        renderSidebarShortcuts();
        showToast(`Removed shortcut: ${sc.label}`);
      });

      pill.appendChild(lbl);
      pill.appendChild(rm);
      pill.addEventListener('click', () => navigateLibraryToFolder(sc.path));
      el.libQuickTabs.appendChild(pill);
    });
  }

  function renderLibraryList() {
    el.libList.innerHTML = '';
    const folderItems = state.libraryFolder?.items || [];
    const subfolders = state.libraryFolder?.subfolders || [];
    const parentPath = state.libraryFolder?.parentPath || null;
    const q = state.libraryFilter.trim().toLowerCase();

    const filteredDirs = q
      ? subfolders.filter((d) => d.name.toLowerCase().includes(q))
      : subfolders;
    const filteredFiles = q
      ? folderItems.filter((it) => it.name.toLowerCase().includes(q))
      : folderItems;

    const frag = document.createDocumentFragment();

    // Parent folder ".." row when browsing a folder
    if (state.libraryFolder && parentPath && !q) {
      const upRow = document.createElement('div');
      upRow.className = 'lib-item';
      upRow.title = `Up to ${parentPath}`;
      const badge = document.createElement('div');
      badge.className = 'lib-item-badge';
      badge.textContent = '↑';
      const name = document.createElement('div');
      name.className = 'lib-item-name';
      name.textContent = '.. (Parent Folder)';
      upRow.appendChild(badge);
      upRow.appendChild(name);
      upRow.addEventListener('click', () => navigateLibraryToFolder(parentPath));
      frag.appendChild(upRow);
    }

    // Subfolder rows so you can step straight into folders like Love Chunibyo / Filme
    filteredDirs.forEach((dir) => {
      const row = document.createElement('div');
      row.className = 'lib-item';
      row.title = dir.folderPath;

      const badge = document.createElement('div');
      badge.className = 'lib-item-badge';
      badge.style.color = 'var(--accent)';
      badge.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7C3 5.9 3.9 5 5 5H9.2L11.2 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z"/></svg>`;

      const name = document.createElement('div');
      name.className = 'lib-item-name';
      name.textContent = dir.name;

      row.appendChild(badge);
      row.appendChild(name);
      row.addEventListener('click', () => navigateLibraryToFolder(dir.folderPath));
      frag.appendChild(row);
    });

    const currentPath = getCurrentItem()?.filePath;
    const queuedPaths = new Set(state.queue.map((qItem) => qItem.filePath));

    filteredFiles.forEach((item) => {
      const isQueued = queuedPaths.has(item.filePath);
      const row = document.createElement('div');
      row.className = 'lib-item' + (item.filePath === currentPath ? ' playing' : '');
      row.title = `${item.name}\n(Click to play folder from here down • Click + or right-click to add to Queue)`;

      const badge = document.createElement('div');
      badge.className = 'lib-item-badge';
      badge.textContent = (item.ext || '').replace('.', '').slice(0, 4) || 'FILE';

      const name = document.createElement('div');
      name.className = 'lib-item-name';
      name.textContent = item.title || item.name;

      const actions = document.createElement('div');
      actions.className = 'row-actions' + (isQueued ? ' has-queued' : '');
      const btnQueue = document.createElement('button');
      btnQueue.type = 'button';
      btnQueue.className = 'row-act-btn' + (isQueued ? ' is-queued' : '');
      btnQueue.textContent = '+';
      btnQueue.title = isQueued ? 'In Queue (click to add again)' : 'Add to Queue';
      btnQueue.addEventListener('click', (e) => {
        e.stopPropagation();
        appendItemsToQueue([item], { playFirstIfIdle: true, toast: true });
      });
      actions.appendChild(btnQueue);

      row.appendChild(badge);
      row.appendChild(name);
      row.appendChild(actions);

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        appendItemsToQueue([item], { playFirstIfIdle: true, toast: true });
      });

      row.addEventListener('click', () => {
        const idx = folderItems.findIndex((x) => x.filePath === item.filePath);
        if (idx >= 0) {
          loadFolderItemAtIndex(idx, true, folderItems);
        } else {
          loadMediaItem(item, { autoPlay: true, source: 'single' });
        }
      });

      frag.appendChild(row);
    });

    if (!filteredDirs.length && !filteredFiles.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:22px 12px;text-align:center;color:var(--text-muted);font-size:12px;';
      empty.textContent = state.libraryFolder
        ? 'No matching media or subfolders here.'
        : 'Select a shortcut above or click "+ Folder" to browse.';
      frag.appendChild(empty);
    }

    el.libList.appendChild(frag);
  }

  function attachQueueRowDrag(row, item, fromIdx) {
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.row-act-btn')) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const initRect = row.getBoundingClientRect();
      const offsetY = startY - initRect.top;
      const rowWidth = initRect.width;

      let started = false;
      let currentSlot = fromIdx;
      let lastClientX = startX;
      let lastClientY = startY;
      let ghostEl = null;
      let dropLineEl = null;
      let scrollRaf = null;

      function updateDropPosition() {
        if (!started || !dropLineEl || !ghostEl) return;

        const drawerRect = el.drawerBody.getBoundingClientRect();
        ghostEl.style.left = `${Math.round(drawerRect.left + 8)}px`;
        ghostEl.style.top = `${Math.round(lastClientY - offsetY)}px`;

        const rows = Array.from(el.drawerBody.querySelectorAll('.queue-row'));
        if (!rows.length) return;

        let slot = rows.length;
        for (let i = 0; i < rows.length; i++) {
          const rRect = rows[i].getBoundingClientRect();
          const midY = rRect.top + rRect.height / 2;
          if (lastClientY < midY) {
            slot = i;
            break;
          }
        }
        currentSlot = slot;

        let lineTop;
        if (slot === 0) {
          lineTop = rows[0].getBoundingClientRect().top - 1;
        } else if (slot >= rows.length) {
          lineTop = rows[rows.length - 1].getBoundingClientRect().bottom + 1;
        } else {
          const prevBottom = rows[slot - 1].getBoundingClientRect().bottom;
          const nextTop = rows[slot].getBoundingClientRect().top;
          lineTop = (prevBottom + nextTop) / 2;
        }

        const clampedTop = Math.max(drawerRect.top + 2, Math.min(drawerRect.bottom - 2, lineTop));
        dropLineEl.style.left = `${Math.round(drawerRect.left + 10)}px`;
        dropLineEl.style.width = `${Math.max(40, Math.round(drawerRect.width - 20))}px`;
        dropLineEl.style.top = `${Math.round(clampedTop)}px`;
        dropLineEl.style.opacity = (slot === fromIdx || slot === fromIdx + 1) ? '0.28' : '1';
      }

      function autoScrollTick() {
        if (!started) return;
        const drawerRect = el.drawerBody.getBoundingClientRect();
        const edgeZone = 38;
        let delta = 0;

        if (lastClientY < drawerRect.top + edgeZone) {
          delta = -Math.ceil(((drawerRect.top + edgeZone - lastClientY) / edgeZone) * 9);
        } else if (lastClientY > drawerRect.bottom - edgeZone) {
          delta = Math.ceil(((lastClientY - (drawerRect.bottom - edgeZone)) / edgeZone) * 9);
        }

        if (delta !== 0) {
          const prevScroll = el.drawerBody.scrollTop;
          el.drawerBody.scrollTop += delta;
          if (el.drawerBody.scrollTop !== prevScroll) {
            updateDropPosition();
          }
        }
        scrollRaf = requestAnimationFrame(autoScrollTick);
      }

      function onPointerMove(ev) {
        lastClientX = ev.clientX;
        lastClientY = ev.clientY;

        if (!started) {
          if (state.queue.length <= 1) return;
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;

          started = true;
          state.draggingQueueItem = true;
          el.app.classList.add('queue-sorting');
          row.classList.add('is-dragging');
          syncSidebarAutoCollapse();

          ghostEl = document.createElement('div');
          ghostEl.className = 'queue-drag-ghost';
          ghostEl.style.width = `${Math.round(rowWidth)}px`;
          const badgeClone = document.createElement('div');
          badgeClone.className = 'lib-item-badge';
          badgeClone.style.borderColor = 'rgba(var(--accent-rgb), 0.5)';
          badgeClone.style.color = 'var(--accent)';
          badgeClone.textContent = String(fromIdx + 1);
          const titleClone = document.createElement('div');
          titleClone.className = 'queue-drag-ghost-name';
          titleClone.textContent = item.title || item.name;
          ghostEl.appendChild(badgeClone);
          ghostEl.appendChild(titleClone);
          document.body.appendChild(ghostEl);

          dropLineEl = document.createElement('div');
          dropLineEl.className = 'queue-drop-line';
          document.body.appendChild(dropLineEl);

          scrollRaf = requestAnimationFrame(autoScrollTick);
        }

        updateDropPosition();
      }

      function cleanup(commitDrop) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('keydown', onEscapeCancel);
        if (scrollRaf) cancelAnimationFrame(scrollRaf);

        if (ghostEl) ghostEl.remove();
        if (dropLineEl) dropLineEl.remove();
        row.classList.remove('is-dragging');
        el.app.classList.remove('queue-sorting');

        const wasStarted = started;
        started = false;
        state.draggingQueueItem = false;
        syncSidebarAutoCollapse();

        if (!wasStarted) {
          if (commitDrop) loadQueueItemAtIndex(fromIdx, true);
          return;
        }

        if (commitDrop) {
          const toIdx = currentSlot <= fromIdx ? currentSlot : currentSlot - 1;
          if (toIdx !== fromIdx) {
            moveQueueItem(fromIdx, toIdx);
          }
        }
      }

      function onPointerUp() {
        cleanup(true);
      }

      function onPointerCancel() {
        cleanup(false);
      }

      function onEscapeCancel(ke) {
        if (ke.key === 'Escape' && started) {
          ke.stopPropagation();
          cleanup(false);
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      window.addEventListener('keydown', onEscapeCancel, true);
    });
  }

  function renderRightDrawer() {
    el.tabDrawerQueue.textContent = `Queue (${state.queue.length})`;
    el.tabDrawerBookmarks.textContent = `Bookmarks (${state.bookmarks.length})`;
    el.tabDrawerQueue.classList.toggle('active', state.drawerTab === 'queue');
    el.tabDrawerBookmarks.classList.toggle('active', state.drawerTab === 'bookmarks');

    el.drawerBody.innerHTML = '';

    if (state.drawerTab === 'queue') {
      if (!state.queue.length) {
        el.drawerBody.innerHTML = `<div class="queue-empty-msg">Queue is empty.<br/>Drop files here, press <strong>+</strong> next to any file in a folder, or click "+ Add Files".</div>`;
        return;
      }
      const frag = document.createDocumentFragment();

      if (state.playbackSource !== 'queue' && getCurrentItem()) {
        const banner = document.createElement('div');
        banner.className = 'queue-mode-banner';
        const lbl = document.createElement('span');
        lbl.textContent = state.playbackSource === 'folder' ? 'Playing from folder' : 'Playing single file';
        const btnStartQ = document.createElement('button');
        btnStartQ.type = 'button';
        btnStartQ.className = 'lib-add-btn';
        btnStartQ.textContent = 'Play Queue';
        btnStartQ.title = 'Switch playback to item #1 in Queue';
        btnStartQ.addEventListener('click', () => loadQueueItemAtIndex(0, true));
        banner.appendChild(lbl);
        banner.appendChild(btnStartQ);
        frag.appendChild(banner);
      }

      state.queue.forEach((item, idx) => {
        const isQueuePlaying = state.playbackSource === 'queue' && idx === state.queueIndex;
        const row = document.createElement('div');
        row.className = 'lib-item queue-row' + (isQueuePlaying ? ' playing' : '');
        row.title = `${item.name}\n(Click to play from Queue • Drag anywhere to reorder)`;

        const grip = document.createElement('span');
        grip.className = 'queue-grip';
        grip.innerHTML = `<svg viewBox="0 0 10 16" width="10" height="14" fill="currentColor"><circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/></svg>`;

        const badge = document.createElement('div');
        badge.className = 'lib-item-badge';
        badge.textContent = String(idx + 1);

        const name = document.createElement('div');
        name.className = 'lib-item-name';
        name.textContent = item.title || item.name;

        const actions = document.createElement('div');
        actions.className = 'row-actions';

        const btnRm = document.createElement('button');
        btnRm.type = 'button';
        btnRm.className = 'row-act-btn danger';
        btnRm.textContent = '×';
        btnRm.title = 'Remove from Queue';
        btnRm.addEventListener('click', (e) => {
          e.stopPropagation();
          removeQueueItem(idx);
        });
        actions.appendChild(btnRm);

        row.appendChild(grip);
        row.appendChild(badge);
        row.appendChild(name);
        row.appendChild(actions);
        attachQueueRowDrag(row, item, idx);
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
            const fIdx = state.folderPlaylist.findIndex((x) => x.filePath === bm.filePath);
            if (state.playbackSource === 'queue' && qIdx >= 0) {
              await loadQueueItemAtIndex(qIdx, true);
            } else if (fIdx >= 0) {
              await loadFolderItemAtIndex(fIdx, true);
            } else if (qIdx >= 0) {
              await loadQueueItemAtIndex(qIdx, true);
            } else {
              const res = await api.resolvePaths([bm.filePath]);
              if (res) ingestOpenedBundle(res, true);
            }
          }
          setTimeout(() => {
            seekToSeconds(bm.time, true);
            showToast(`Jumped to bookmark ${formatTime(bm.time)}`);
          }, 150);
        });
        frag.appendChild(row);
      });
      el.drawerBody.appendChild(frag);
    }
  }

  function addBookmark() {
    const item = getCurrentItem();
    if (!item) return;
    const t = getCurrentTime();
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
      if (state.queue.length > 0) {
        loadQueueItemAtIndex(0, true);
      } else {
        openFileDialog(false);
      }
      return;
    }
    if (el.video.paused) playMedia();
    else pauseMedia();
  }

  function playPrev() {
    if (!getCurrentItem()) return;
    if (getCurrentTime() > 4) {
      seekToSeconds(0, !el.video.paused);
      return;
    }
    if (state.playbackSource === 'queue' && state.queue.length > 0) {
      const prevIdx = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
      loadQueueItemAtIndex(prevIdx, true);
    } else if (state.playbackSource === 'folder' && state.folderPlaylist.length > 0) {
      const prevIdx = (state.folderPlayIndex - 1 + state.folderPlaylist.length) % state.folderPlaylist.length;
      loadFolderItemAtIndex(prevIdx, true);
    } else {
      seekToSeconds(0, !el.video.paused);
    }
  }

  function playNext() {
    if (state.playbackSource === 'queue' && state.queue.length > 0) {
      const nextIdx = (state.queueIndex + 1) % state.queue.length;
      loadQueueItemAtIndex(nextIdx, true);
    } else if (state.playbackSource === 'folder' && state.folderPlaylist.length > 0) {
      const nextIdx = (state.folderPlayIndex + 1) % state.folderPlaylist.length;
      loadFolderItemAtIndex(nextIdx, true);
    }
  }

  function seekToSeconds(targetSec, shouldPlayAfter = !el.video.paused) {
    const dur = getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    const clamped = Math.max(0, Math.min(dur, targetSec));

    if (!state.streamMode) {
      el.video.currentTime = clamped;
      updateTimelineUI();
      return;
    }

    // In FFmpeg Live Stream mode: check if targetSec is already inside the local buffer
    const rel = clamped - state.streamOffset;
    let inBuffer = false;
    if (rel >= 0) {
      for (let i = 0; i < el.video.buffered.length; i++) {
        if (rel >= el.video.buffered.start(i) && rel <= el.video.buffered.end(i) - 0.25) {
          inBuffer = true;
          break;
        }
      }
    }

    if (inBuffer) {
      el.video.currentTime = rel;
      updateTimelineUI();
      if (shouldPlayAfter && el.video.paused) playMedia();
    } else {
      reloadStreamAt(clamped, shouldPlayAfter);
    }
  }

  function seekToRatio(ratio, shouldPlayAfter = !el.video.paused) {
    const dur = getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    seekToSeconds(Math.max(0, Math.min(1, ratio)) * dur, shouldPlayAfter);
  }

  function seekByDelta(deltaSec) {
    const dur = getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    const target = Math.max(0, Math.min(dur, getCurrentTime() + deltaSec));
    seekToSeconds(target, !el.video.paused);
    showToast(`${deltaSec >= 0 ? '+' : ''}${deltaSec}s (${formatTime(target)})`);
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
    el.video.style.maxWidth = '';
    el.video.style.maxHeight = '';
    el.video.style.aspectRatio = '';

    if (fit === 'contain' || fit === 'cover' || fit === 'fill') {
      el.video.style.width = '100%';
      el.video.style.height = '100%';
      el.video.style.objectFit = fit;
    } else {
      const [rw, rh] = fit.split(':').map(Number);
      const targetRatio = rw && rh ? rw / rh : 16 / 9;
      const stageRect = el.videoStage.getBoundingClientRect();
      const stageRatio = stageRect.height > 0 ? stageRect.width / stageRect.height : targetRatio;
      el.video.style.objectFit = 'fill';
      el.video.style.aspectRatio = `${rw} / ${rh}`;
      if (stageRatio >= targetRatio) {
        el.video.style.height = '100%';
        el.video.style.width = 'auto';
      } else {
        el.video.style.width = '100%';
        el.video.style.height = 'auto';
      }
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
    updateChromeSolidity();
  }

  function updateTimelineUI() {
    const cur = getCurrentTime();
    const dur = getDuration();
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
    state.dialogOpen = true;
    syncSidebarAutoCollapse();
    try {
      const bundle = await api.openFiles(multi);
      if (bundle) ingestOpenedBundle(bundle, true, { append: false });
    } finally {
      state.dialogOpen = false;
      syncSidebarAutoCollapse();
    }
  }

  async function enqueueFilesDialog() {
    state.dialogOpen = true;
    syncSidebarAutoCollapse();
    try {
      const bundle = await api.openFiles(true);
      if (bundle) ingestOpenedBundle(bundle, true, { append: true });
    } finally {
      state.dialogOpen = false;
      syncSidebarAutoCollapse();
    }
  }

  async function openFolderDialog({ browseOnly = false } = {}) {
    state.dialogOpen = true;
    syncSidebarAutoCollapse();
    try {
      const folder = await api.openFolder();
      if (!folder) return;
      state.libraryFolder = folder;
      el.libFolderLabel.textContent = folder.folderName || 'Folder';
      el.folderCrumbText.textContent = folder.folderName || 'Folder';
      el.librarySidebar.classList.remove('collapsed');
      el.btnSidebar.classList.add('active');
      updateChromeSolidity();
      renderSidebarShortcuts();
      renderLibraryList();

      if (browseOnly) {
        return;
      }

      if (folder.items?.length) {
        loadFolderItemAtIndex(0, true, folder.items);
      } else if (!folder.subfolders?.length) {
        showToast('Folder contains no media files');
      }
    } finally {
      state.dialogOpen = false;
      syncSidebarAutoCollapse();
    }
  }

  async function openSubtitleDialog() {
    state.dialogOpen = true;
    syncSidebarAutoCollapse();
    try {
      const sub = await api.openSubtitle();
      if (sub) loadSubtitleData(sub, true);
    } finally {
      state.dialogOpen = false;
      syncSidebarAutoCollapse();
    }
  }

  // ==================== POPOVER, SOLIDITY, SIDEBAR AUTO-CLOSE & FULLSCREEN IDLE ====================
  let fsIdleTimer = null;
  let leftSidebarIdleTimer = null;
  let rightDrawerIdleTimer = null;

  function updateChromeSolidity() {
    const hasMedia = Boolean(getCurrentItem());
    el.app.classList.toggle('has-media', hasMedia);

    const leftSidebarOpen = !el.librarySidebar.classList.contains('collapsed');
    const rightQueueOpen = !el.rightDrawer.classList.contains('collapsed');
    const topMenuOpen = el.headerMenu.classList.contains('open');
    const settingsOpen = el.settingsBackdrop.classList.contains('open');

    // Translucent during playback & bottom-bar interactions; solid only for top bar & sidebars/queue
    const shouldBeSolid =
      !hasMedia ||
      leftSidebarOpen ||
      rightQueueOpen ||
      topMenuOpen ||
      settingsOpen ||
      state.hoveringTopBar;

    el.app.classList.toggle('solid-chrome', shouldBeSolid);
    syncSidebarAutoCollapse();
  }

  function finishSidebarAutoCollapse() {
    updateChromeSolidity();
    applyVideoAppearance();

    const anyPanelOpen =
      !el.librarySidebar.classList.contains('collapsed') ||
      !el.rightDrawer.classList.contains('collapsed') ||
      el.bottomPopover.classList.contains('open') ||
      el.headerMenu.classList.contains('open') ||
      el.settingsBackdrop.classList.contains('open');

    if (
      state.isFullscreen &&
      state.autoHideFs &&
      state.playing &&
      !anyPanelOpen &&
      !state.hoveringTopBar &&
      !state.hoveringBottomBar
    ) {
      clearTimeout(fsIdleTimer);
      el.app.classList.add('fs-idle');
    } else {
      resetFullscreenIdle();
    }
  }

  function syncSidebarAutoCollapse() {
    clearTimeout(leftSidebarIdleTimer);
    clearTimeout(rightDrawerIdleTimer);

    const leftOpen = !el.librarySidebar.classList.contains('collapsed');
    const rightOpen = !el.rightDrawer.classList.contains('collapsed');
    const searchFocused = document.activeElement === el.libSearchInput;

    // Auto-collapse open left library sidebar if mouse doesn't hover over it for 5s while playing
    if (
      leftOpen &&
      state.playing &&
      !state.hoveringLeftSidebar &&
      !searchFocused &&
      !state.dialogOpen
    ) {
      leftSidebarIdleTimer = setTimeout(() => {
        if (
          !el.librarySidebar.classList.contains('collapsed') &&
          state.playing &&
          !state.hoveringLeftSidebar &&
          document.activeElement !== el.libSearchInput &&
          !state.dialogOpen
        ) {
          el.librarySidebar.classList.add('collapsed');
          el.btnSidebar.classList.remove('active');
          finishSidebarAutoCollapse();
        }
      }, 5000);
    }

    // Auto-collapse open right queue/bookmarks drawer if mouse doesn't hover over it for 5s while playing
    if (
      rightOpen &&
      state.playing &&
      !state.hoveringRightDrawer &&
      !state.draggingQueueItem &&
      !state.externalFileDragActive &&
      !state.dialogOpen
    ) {
      rightDrawerIdleTimer = setTimeout(() => {
        if (
          !el.rightDrawer.classList.contains('collapsed') &&
          state.playing &&
          !state.hoveringRightDrawer &&
          !state.draggingQueueItem &&
          !state.externalFileDragActive &&
          !state.dialogOpen
        ) {
          el.rightDrawer.classList.add('collapsed');
          el.btnQueueDrawer.classList.remove('active');
          finishSidebarAutoCollapse();
        }
      }, 5000);
    }
  }

  function openPopoverTab(tabName) {
    el.headerMenu.classList.remove('open');
    updateChromeSolidity();
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
    updateChromeSolidity();
  }

  function resetFullscreenIdle() {
    el.app.classList.remove('fs-idle');
    clearTimeout(fsIdleTimer);
    if (state.isFullscreen && state.autoHideFs && state.playing) {
      fsIdleTimer = setTimeout(() => {
        const anyPanelOpen =
          !el.librarySidebar.classList.contains('collapsed') ||
          !el.rightDrawer.classList.contains('collapsed') ||
          el.bottomPopover.classList.contains('open') ||
          el.headerMenu.classList.contains('open') ||
          el.settingsBackdrop.classList.contains('open');

        if (
          state.isFullscreen &&
          state.playing &&
          !anyPanelOpen &&
          !state.hoveringTopBar &&
          !state.hoveringBottomBar
        ) {
          el.app.classList.add('fs-idle');
        }
      }, 2400);
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
      currentTime: Number(getCurrentTime().toFixed(2)),
      duration: Number(getDuration().toFixed(2)),
      volume: state.volume,
      muted: state.muted,
      speed: state.speed,
      accent: state.accentKey === 'custom' ? state.customAccentHex : state.accentKey,
      playbackSource: state.playbackSource || 'idle',
      queueLength: state.queue.length,
      streamEngine: state.streamMode ? 'ffmpeg-live' : 'native'
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
        seekToSeconds(0, false);
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
        else if (typeof cmd.value === 'number' && getDuration() > 0) {
          seekToSeconds(cmd.value, !el.video.paused);
          showToast(`AI Bridge: Seek → ${formatTime(cmd.value)}`);
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
          ingestOpenedBundle({ items: [cmd.resolved.item], folder: cmd.resolved.folder }, true, { append: false });
          showToast(`AI Bridge: Opened ${cmd.resolved.item.name}`);
        }
        break;
      case 'enqueue':
        if (cmd.resolvedItems?.length) {
          appendItemsToQueue(cmd.resolvedItems, { playFirstIfIdle: true, toast: true });
        }
        break;
      case 'openFolder':
        if (cmd.resolvedFolder) {
          ingestOpenedBundle({ items: cmd.resolvedFolder.items, folder: cmd.resolvedFolder }, true, { append: false });
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
      } else if (getCurrentItem() && !getCurrentItem().isAudio && el.video.readyState >= 1) {
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

    const initWs = await api.getWindowState();
    if (initWs) {
      state.aiPort = initWs.aiPort || 4500;
      state.hasFfmpeg = Boolean(initWs.hasFfmpeg);
    }

    // 4. Populate Customizable Shortcuts in Left Sidebar + detect reference video on Desktop
    const defaultQuickFolders = await api.getQuickFolders();
    if (!Array.isArray(state.sidebarShortcuts)) {
      state.sidebarShortcuts = defaultQuickFolders.map((q) => ({ label: q.label, path: q.path }));
    }
    renderSidebarShortcuts();

    el.btnPinShortcut.addEventListener('click', async () => {
      const curFolder = state.libraryFolder;
      const alreadyPinned = curFolder && state.sidebarShortcuts.some(
        (s) => s.path.toLowerCase() === curFolder.folderPath.toLowerCase()
      );

      let targetFolder = null;
      if (curFolder && !alreadyPinned) {
        targetFolder = curFolder;
      } else {
        state.dialogOpen = true;
        syncSidebarAutoCollapse();
        try {
          targetFolder = await api.openFolder();
        } finally {
          state.dialogOpen = false;
          syncSidebarAutoCollapse();
        }
      }
      if (!targetFolder || !targetFolder.folderPath) return;

      const exists = state.sidebarShortcuts.some(
        (s) => s.path.toLowerCase() === targetFolder.folderPath.toLowerCase()
      );
      if (exists) {
        showToast(`"${targetFolder.folderName}" is already pinned`);
        return;
      }

      state.sidebarShortcuts.push({
        label: targetFolder.folderName || targetFolder.folderPath,
        path: targetFolder.folderPath
      });
      state.libraryFolder = targetFolder;
      el.libFolderLabel.textContent = targetFolder.folderName || 'Folder';
      savePreferences();
      renderSidebarShortcuts();
      renderLibraryList();
      showToast(`Pinned shortcut: ${targetFolder.folderName}`);
    });

    el.btnResetShortcuts.addEventListener('click', () => {
      state.sidebarShortcuts = defaultQuickFolders.map((q) => ({ label: q.label, path: q.path }));
      savePreferences();
      renderSidebarShortcuts();
      showToast('Sidebar shortcuts reset to default');
    });

    const desktopEntry = defaultQuickFolders.find((q) => q.label === 'Desktop');
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
      if (typeof ws.hasFfmpeg === 'boolean') state.hasFfmpeg = ws.hasFfmpeg;
      if (ws.aiPort && ws.aiPort !== state.aiPort) {
        state.aiPort = ws.aiPort;
        el.aiEndpointBox.textContent =
          `Endpoint: http://127.0.0.1:${ws.aiPort}\n` +
          `Status:   GET  http://127.0.0.1:${ws.aiPort}/api/status\n` +
          `Control:  POST http://127.0.0.1:${ws.aiPort}/api/control`;
        el.aiSampleCmd.textContent =
          `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:${ws.aiPort}/api/control -ContentType 'application/json' -Body '{"action":"setAccent","value":"cyan"}'`;
      }
      el.btnPip.classList.toggle('active', Boolean(document.pictureInPictureElement) || state.alwaysOnTop);
      state.hoveringTopBar = false;
      syncSwitchesUI();
      updateChromeSolidity();
      applyVideoAppearance();
      resetFullscreenIdle();
    });

    api.onPipExitRequested(() => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    });

    api.onInitialMedia((data) => {
      if (data?.item) {
        ingestOpenedBundle({ items: [data.item], folder: data.folder }, true);
      }
    });

    api.onAiCommand(handleAiCommand);

    // 6. Top bar, sidebar & bottom bar hover tracking
    el.topBar.addEventListener('mouseenter', () => {
      state.hoveringTopBar = true;
      updateChromeSolidity();
      resetFullscreenIdle();
    });
    el.topBar.addEventListener('mouseleave', () => {
      state.hoveringTopBar = false;
      updateChromeSolidity();
      resetFullscreenIdle();
    });
    el.bottomBar.addEventListener('mouseenter', () => {
      state.hoveringBottomBar = true;
      resetFullscreenIdle();
    });
    el.bottomBar.addEventListener('mouseleave', () => {
      state.hoveringBottomBar = false;
      resetFullscreenIdle();
    });

    el.librarySidebar.addEventListener('mouseenter', () => {
      state.hoveringLeftSidebar = true;
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    el.librarySidebar.addEventListener('mouseleave', () => {
      state.hoveringLeftSidebar = false;
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    el.librarySidebar.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'margin-left') applyVideoAppearance();
    });

    el.rightDrawer.addEventListener('mouseenter', () => {
      state.hoveringRightDrawer = true;
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    el.rightDrawer.addEventListener('mouseleave', () => {
      state.hoveringRightDrawer = false;
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    el.rightDrawer.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'margin-right') applyVideoAppearance();
    });

    el.btnCone.addEventListener('click', () => toggleSettingsModal());
    el.btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      el.bottomPopover.classList.remove('open');
      el.headerMenu.classList.toggle('open');
      updateChromeSolidity();
    });

    el.btnSidebar.addEventListener('click', () => {
      const collapsed = el.librarySidebar.classList.toggle('collapsed');
      el.btnSidebar.classList.toggle('active', !collapsed);
      updateChromeSolidity();
    });

    el.btnFolderCrumb.addEventListener('click', () => {
      if (state.libraryFolder) {
        const collapsed = el.librarySidebar.classList.toggle('collapsed');
        el.btnSidebar.classList.toggle('active', !collapsed);
        updateChromeSolidity();
      } else {
        openFolderDialog();
      }
    });

    el.menuOpenFile.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      openFileDialog(false);
    });
    el.menuOpenMulti.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      enqueueFilesDialog();
    });
    el.menuOpenFolder.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      openFolderDialog();
    });
    el.menuOpenSub.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      openSubtitleDialog();
    });
    el.menuSnapshot.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      captureSnapshot();
    });
    el.menuReveal.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      const cur = getCurrentItem();
      if (cur) api.revealInExplorer(cur.filePath);
      else showToast('No media file currently open');
    });
    el.menuAlwaysTop.addEventListener('click', async () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
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
    el.libSearchInput.addEventListener('focus', syncSidebarAutoCollapse);
    el.libSearchInput.addEventListener('blur', syncSidebarAutoCollapse);
    el.btnLibOpenFolder.addEventListener('click', () => openFolderDialog({ browseOnly: true }));
    el.btnLibOpenFiles.addEventListener('click', enqueueFilesDialog);
    el.btnEmptyOpenFile.addEventListener('click', () => openFileDialog(false));
    el.btnEmptyOpenFolder.addEventListener('click', () => openFolderDialog());

    // 8. Right Queue & Bookmarks Drawer
    el.btnQueueDrawer.addEventListener('click', () => {
      const collapsed = el.rightDrawer.classList.toggle('collapsed');
      el.btnQueueDrawer.classList.toggle('active', !collapsed);
      updateChromeSolidity();
    });
    document.querySelectorAll('[data-drawer-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.drawerTab = btn.dataset.drawerTab;
        renderRightDrawer();
      });
    });
    el.btnDrawerAdd.addEventListener('click', enqueueFilesDialog);
    el.btnDrawerBookmark.addEventListener('click', addBookmark);
    el.btnDrawerClear.addEventListener('click', async () => {
      if (state.drawerTab === 'queue') {
        state.queue = [];
        state.queueIndex = -1;
        if (state.playbackSource === 'queue') {
          await resetPlayerToIdle();
        }
        showToast('Cleared queue');
      } else {
        state.bookmarks = [];
        showToast('Cleared bookmarks');
      }
      renderLibraryList();
      renderRightDrawer();
      pushPlayerStatus();
    });

    // 9. Transport, Video Events, Popup Mini Player & Automatic Codec Fallback
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
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
      pushPlayerStatus();
    });
    el.video.addEventListener('pause', () => {
      state.lastPauseAt = Date.now();
      updateTransportUI();
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
      pushPlayerStatus();
    });
    el.video.addEventListener('loadedmetadata', () => {
      applyVideoAppearance();
      updateTimelineUI();
      renderSubtitleBlocksOnSeekbar();
      pushPlayerStatus();
    });
    el.video.addEventListener('timeupdate', updateTimelineUI);

    // Popup Mini Player (PiP): enlarge slightly & auto-minimize main app on open, restore on return
    el.video.addEventListener('enterpictureinpicture', () => {
      el.btnPip.classList.add('active');
      const vw = el.video.videoWidth || 16;
      const vh = el.video.videoHeight || 9;
      const aspect = vh > 0 ? vw / vh : 16 / 9;
      api.enterPip({ aspect });
    });

    el.video.addEventListener('leavepictureinpicture', () => {
      el.btnPip.classList.toggle('active', state.alwaysOnTop);
      const closedViaX = el.video.paused && Date.now() - state.lastPauseAt < 180;
      api.leavePip({ restore: !closedViaX });
    });

    // MediaSession integration for Popup Mini Player & hardware media keys
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => playMedia());
        navigator.mediaSession.setActionHandler('pause', () => pauseMedia());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        navigator.mediaSession.setActionHandler('seekbackward', () => seekByDelta(-10));
        navigator.mediaSession.setActionHandler('seekforward', () => seekByDelta(10));
      } catch {}
    }

    // Automatic reactive fallback if any native container/codec or Hi10P stream fails
    el.video.addEventListener('error', () => {
      const item = getCurrentItem();
      if (!item || !state.hasFfmpeg) return;

      if (!state.streamMode && !state.fallbackAttempted) {
        state.fallbackAttempted = true;
        startFfmpegStreamPlayback(item, 0, true, false);
      } else if (state.streamMode && !state.streamForceTranscode) {
        // Fallback for 10-bit H.264 (Hi10P) or unusual profiles -> transcode video to yuv420p
        startFfmpegStreamPlayback(item, state.streamOffset, true, true);
      }
    });

    el.video.addEventListener('ended', () => {
      if (state.loop) {
        if (state.streamMode) {
          reloadStreamAt(0, true);
        }
        return;
      }
      if (
        state.playbackSource === 'queue' &&
        state.queueIndex >= 0 &&
        state.queueIndex < state.queue.length - 1
      ) {
        loadQueueItemAtIndex(state.queueIndex + 1, true);
      } else if (
        state.playbackSource === 'folder' &&
        state.folderPlayIndex >= 0 &&
        state.folderPlayIndex < state.folderPlaylist.length - 1
      ) {
        loadFolderItemAtIndex(state.folderPlayIndex + 1, true);
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
        updateChromeSolidity();
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
    let wasPlayingBeforeScrub = false;

    const calcSeekRatio = (clientX) => {
      const rect = el.seekbarTrack.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    };

    const updateHoverPreview = (clientX) => {
      const dur = getDuration();
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
      const dur = getDuration();
      if (!getCurrentItem() || dur <= 0) return;
      isScrubbing = true;
      wasPlayingBeforeScrub = !el.video.paused;
      el.seekbarTrack.setPointerCapture(e.pointerId);

      const targetSec = calcSeekRatio(e.clientX) * dur;
      if (state.streamMode) {
        state.scrubPreviewTime = targetSec;
        updateTimelineUI();
      } else {
        seekToSeconds(targetSec, wasPlayingBeforeScrub);
      }
      updateHoverPreview(e.clientX);
    });

    el.seekbarTrack.addEventListener('pointermove', (e) => {
      updateHoverPreview(e.clientX);
      if (!isScrubbing) return;
      const dur = getDuration();
      if (dur <= 0) return;
      const targetSec = calcSeekRatio(e.clientX) * dur;
      if (state.streamMode) {
        state.scrubPreviewTime = targetSec;
        updateTimelineUI();
      } else {
        seekToSeconds(targetSec, wasPlayingBeforeScrub);
      }
    });

    el.seekbarTrack.addEventListener('pointerup', (e) => {
      if (!isScrubbing) return;
      isScrubbing = false;
      el.seekbarTrack.releasePointerCapture(e.pointerId);

      if (state.streamMode && state.scrubPreviewTime !== null) {
        const finalSec = state.scrubPreviewTime;
        state.scrubPreviewTime = null;
        seekToSeconds(finalSec, wasPlayingBeforeScrub);
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
      el.video.loop = state.streamMode ? false : state.loop;
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
        if (el.headerMenu.classList.contains('open')) {
          el.headerMenu.classList.remove('open');
          updateChromeSolidity();
        }
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

    // 14. External File Drag & Drop: Auto-Open Queue Bar + Player Refresh vs. Positional Queue Insert
    let wasQueueCollapsedBeforeExtDrag = false;
    let externalDropSlot = 0;
    let externalLastClientY = 0;
    let externalOverQueue = false;
    let externalDropLineEl = null;
    let externalScrollRaf = null;

    const isExternalFileDrag = (ev) => Array.from(ev.dataTransfer?.types || []).includes('Files');

    function isOverRightQueueZone(clientX, clientY, target) {
      if (target?.closest?.('#right-drawer')) return true;
      const drawerWidth = el.rightDrawer.offsetWidth || 280;
      return (
        clientX >= window.innerWidth - drawerWidth &&
        clientX <= window.innerWidth &&
        clientY >= 38 &&
        clientY <= window.innerHeight - 50
      );
    }

    function updateExternalQueueDropIndicator(clientY) {
      const rows = Array.from(el.drawerBody.querySelectorAll('.queue-row'));
      if (!rows.length) {
        externalDropSlot = 0;
        if (externalDropLineEl) externalDropLineEl.style.opacity = '0';
        return;
      }

      let slot = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const rRect = rows[i].getBoundingClientRect();
        const midY = rRect.top + rRect.height / 2;
        if (clientY < midY) {
          slot = i;
          break;
        }
      }
      externalDropSlot = slot;

      let lineTop;
      if (slot === 0) {
        lineTop = rows[0].getBoundingClientRect().top - 1;
      } else if (slot >= rows.length) {
        lineTop = rows[rows.length - 1].getBoundingClientRect().bottom + 1;
      } else {
        const prevBottom = rows[slot - 1].getBoundingClientRect().bottom;
        const nextTop = rows[slot].getBoundingClientRect().top;
        lineTop = (prevBottom + nextTop) / 2;
      }

      if (!externalDropLineEl) {
        externalDropLineEl = document.createElement('div');
        externalDropLineEl.className = 'queue-drop-line';
        document.body.appendChild(externalDropLineEl);
      }

      const drawerWidth = el.rightDrawer.offsetWidth || 280;
      const drawerRect = el.drawerBody.getBoundingClientRect();
      const targetLeft = Math.min(drawerRect.left, window.innerWidth - drawerWidth) + 10;
      const clampedTop = Math.max(drawerRect.top + 2, Math.min(drawerRect.bottom - 2, lineTop));

      externalDropLineEl.style.left = `${Math.round(targetLeft)}px`;
      externalDropLineEl.style.width = `${Math.max(40, Math.round(drawerWidth - 20))}px`;
      externalDropLineEl.style.top = `${Math.round(clampedTop)}px`;
      externalDropLineEl.style.opacity = '1';
    }

    function externalAutoScrollTick() {
      if (!state.externalFileDragActive) {
        externalScrollRaf = null;
        return;
      }
      if (externalOverQueue) {
        const drawerRect = el.drawerBody.getBoundingClientRect();
        const edgeZone = 38;
        let delta = 0;

        if (externalLastClientY < drawerRect.top + edgeZone) {
          delta = -Math.ceil(((drawerRect.top + edgeZone - externalLastClientY) / edgeZone) * 9);
        } else if (externalLastClientY > drawerRect.bottom - edgeZone) {
          delta = Math.ceil(((externalLastClientY - (drawerRect.bottom - edgeZone)) / edgeZone) * 9);
        }

        if (delta !== 0) {
          const prevScroll = el.drawerBody.scrollTop;
          el.drawerBody.scrollTop += delta;
          if (el.drawerBody.scrollTop !== prevScroll) {
            updateExternalQueueDropIndicator(externalLastClientY);
          }
        }
      }
      externalScrollRaf = requestAnimationFrame(externalAutoScrollTick);
    }

    function beginExternalFileDrag() {
      if (state.externalFileDragActive) return;
      state.externalFileDragActive = true;
      wasQueueCollapsedBeforeExtDrag = el.rightDrawer.classList.contains('collapsed');

      if (state.drawerTab !== 'queue') {
        state.drawerTab = 'queue';
        renderRightDrawer();
      }
      if (wasQueueCollapsedBeforeExtDrag) {
        el.rightDrawer.classList.remove('collapsed');
        el.btnQueueDrawer.classList.add('active');
      }

      el.dropOverlay.textContent = 'Drop on player to play & refresh Queue';
      resetFullscreenIdle();
      updateChromeSolidity();
      externalScrollRaf = requestAnimationFrame(externalAutoScrollTick);
    }

    function endExternalFileDrag({ restoreCollapsed = false, hoveringQueue = false } = {}) {
      if (!state.externalFileDragActive) return;
      state.externalFileDragActive = false;
      externalOverQueue = false;

      if (externalScrollRaf) {
        cancelAnimationFrame(externalScrollRaf);
        externalScrollRaf = null;
      }
      if (externalDropLineEl) {
        externalDropLineEl.remove();
        externalDropLineEl = null;
      }

      el.rightDrawer.classList.remove('drop-target-active');
      el.dropOverlay.classList.remove('active');

      if (restoreCollapsed && wasQueueCollapsedBeforeExtDrag) {
        el.rightDrawer.classList.add('collapsed');
        el.btnQueueDrawer.classList.remove('active');
        state.hoveringRightDrawer = false;
      } else {
        state.hoveringRightDrawer = hoveringQueue;
      }

      wasQueueCollapsedBeforeExtDrag = false;
      updateChromeSolidity();
      applyVideoAppearance();
    }

    window.addEventListener('dragenter', (e) => {
      if (!isExternalFileDrag(e)) return;
      e.preventDefault();
      beginExternalFileDrag();
    });

    window.addEventListener('dragover', (e) => {
      if (!isExternalFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';

      beginExternalFileDrag();
      externalLastClientY = e.clientY;
      externalOverQueue = isOverRightQueueZone(e.clientX, e.clientY, e.target);

      if (externalOverQueue) {
        el.dropOverlay.classList.remove('active');
        el.rightDrawer.classList.add('drop-target-active');
        updateExternalQueueDropIndicator(e.clientY);
      } else {
        el.rightDrawer.classList.remove('drop-target-active');
        if (externalDropLineEl) externalDropLineEl.style.opacity = '0';
        el.dropOverlay.classList.add('active');
      }
    });

    window.addEventListener('dragleave', (e) => {
      if (!state.externalFileDragActive) return;
      if (!e.relatedTarget || !document.documentElement.contains(e.relatedTarget)) {
        endExternalFileDrag({ restoreCollapsed: true, hoveringQueue: false });
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const droppedOnQueue = isOverRightQueueZone(e.clientX, e.clientY, e.target);
      if (droppedOnQueue) updateExternalQueueDropIndicator(e.clientY);
      const targetSlot = externalDropSlot;
      endExternalFileDrag({ restoreCollapsed: false, hoveringQueue: droppedOnQueue });

      const files = Array.from(e.dataTransfer?.files || []);
      const paths = files.map((f) => api.getPathForFile(f)).filter(Boolean);
      if (!paths.length) return;

      const resolved = await api.resolvePaths(paths);
      if (!resolved) {
        showToast('Unsupported file format');
        return;
      }

      if (resolved.subtitleOnly) {
        loadSubtitleData(resolved.subtitleOnly, true);
        return;
      }

      if (droppedOnQueue) {
        insertItemsIntoQueueAt(resolved.items, targetSlot, {
          playFirstIfIdle: false,
          toast: true
        });
      } else {
        await replaceQueueWithDroppedBundle(resolved);
      }
    });

    // 15. Keyboard Shortcuts & Fullscreen Mouse Activity
    window.addEventListener('mousemove', () => {
      if (state.externalFileDragActive) {
        endExternalFileDrag({ restoreCollapsed: true, hoveringQueue: false });
      }
      resetFullscreenIdle();
    });
    window.addEventListener('resize', applyVideoAppearance);
    window.addEventListener('blur', () => {
      state.hoveringTopBar = false;
      state.hoveringBottomBar = false;
      state.hoveringLeftSidebar = false;
      state.hoveringRightDrawer = false;
      updateChromeSolidity();
    });

    window.addEventListener('keydown', (e) => {
      resetFullscreenIdle();

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') {
        e.preventDefault();
        enqueueFilesDialog();
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
            updateChromeSolidity();
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
    updateChromeSolidity();
    pushPlayerStatus();
  }

  init();
})();
