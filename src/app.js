// CopyCat media player — Renderer Application
// Modern Desktop Media Player with 200% Cone Boost, Universal FFmpeg Stream Engine & Local AI Bridge

(() => {
  'use strict';

  const api = window.copycat || window.vlcopycat;
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

  const DEFAULT_HOTKEY_SETTINGS = {
    volumeStep: 5,        // 1% to 25%
    seekSmallSec: 5,      // 1s to 60s
    seekLargeSec: 15,     // 5s to 300s
    speedStep: 0.10       // 0.01x to 0.50x
  };

  const ACTION_DEFINITIONS = [
    { id: 'togglePlay', label: 'Play / Pause', category: 'Playback', defaults: ['Space', 'KeyK'] },
    { id: 'toggleFullscreen', label: 'Toggle Fullscreen', category: 'Playback', defaults: ['KeyF'] },
    { id: 'seekBackward', label: 'Seek Backward (Small)', category: 'Seek', defaults: ['ArrowLeft'] },
    { id: 'seekForward', label: 'Seek Forward (Small)', category: 'Seek', defaults: ['ArrowRight'] },
    { id: 'seekBackwardLarge', label: 'Seek Backward (Large)', category: 'Seek', defaults: ['Shift+ArrowLeft'] },
    { id: 'seekForwardLarge', label: 'Seek Forward (Large)', category: 'Seek', defaults: ['Shift+ArrowRight'] },
    { id: 'volumeUp', label: 'Volume Up', category: 'Audio', defaults: ['ArrowUp'] },
    { id: 'volumeDown', label: 'Volume Down', category: 'Audio', defaults: ['ArrowDown'] },
    { id: 'mute', label: 'Mute / Unmute', category: 'Audio', defaults: ['KeyM'] },
    { id: 'speedDown', label: 'Speed Down', category: 'Playback', defaults: ['BracketLeft'] },
    { id: 'speedUp', label: 'Speed Up', category: 'Playback', defaults: ['BracketRight'] },
    { id: 'speedReset', label: 'Reset Speed (1.0x)', category: 'Playback', defaults: ['Backspace'] },
    { id: 'nextTrack', label: 'Next Video', category: 'Navigation', defaults: ['KeyN'] },
    { id: 'prevTrack', label: 'Previous Video', category: 'Navigation', defaults: ['KeyP'] },
    { id: 'toggleSub', label: 'Toggle Subtitles', category: 'Subtitles', defaults: ['KeyC'] },
    { id: 'addBookmark', label: 'Add Bookmark', category: 'Bookmarks', defaults: ['KeyB'] },
    { id: 'snapshot', label: 'Save Snapshot (PNG)', category: 'Tools', defaults: ['Shift+KeyS'] },
    { id: 'openFile', label: 'Open File', category: 'File', defaults: ['Ctrl+KeyO'] },
    { id: 'openFolder', label: 'Open Folder', category: 'File', defaults: ['Ctrl+KeyF'] },
    { id: 'queueFiles', label: 'Enqueue Files', category: 'File', defaults: ['Ctrl+Shift+KeyO'] },
    { id: 'toggleSettings', label: 'Open Settings', category: 'System', defaults: ['Ctrl+KeyP'] },
    { id: 'toggleTheme', label: 'Toggle Dark / Light Theme', category: 'Interface', defaults: ['KeyT'] },
    { id: 'stepFrameForward', label: 'Step 1 Frame Forward', category: 'Playback', defaults: ['Period'] },
    { id: 'stepFrameBackward', label: 'Step 1 Frame Backward', category: 'Playback', defaults: ['Comma'] },
    { id: 'toggleAbLoop', label: 'Set / Clear A-B Loop Point', category: 'Playback', defaults: ['KeyL'] },
    { id: 'clearAbLoop', label: 'Clear A-B Loop', category: 'Playback', defaults: ['Shift+KeyL'] },
    { id: 'cycleRepeat', label: 'Cycle Repeat (Off / All / One)', category: 'Navigation', defaults: ['KeyR'] },
    { id: 'toggleShuffle', label: 'Toggle Shuffle Queue', category: 'Navigation', defaults: ['KeyS'] },
    { id: 'toggleNightMode', label: 'Toggle Night Mode (DRC)', category: 'Audio', defaults: ['KeyH'] },
    { id: 'toggleGhostMode', label: 'Toggle Ghost Window Mode', category: 'Interface', defaults: ['KeyG'] },
    { id: 'snapshotClipboard', label: 'Copy Snapshot to Clipboard', category: 'Tools', defaults: ['Alt+KeyS'] },
    { id: 'skipIntroCredits', label: 'Skip Intro / Outro / Segment', category: 'Playback', defaults: ['Tab'] },
    { id: 'toggleStopAfterCurrent', label: 'Stop After Current Episode', category: 'Playback', defaults: ['KeyE'] },
    { id: 'bossKey', label: 'Boss Key (Mute & Minimize)', category: 'System', defaults: ['F12'] }
  ];

  function cloneDefaultKeybindings() {
    const kb = {};
    for (const def of ACTION_DEFINITIONS) {
      kb[def.id] = [...def.defaults];
    }
    return kb;
  }

  const STORAGE_KEY = 'copycat_media_player_prefs_v1';

  // ==================== STATE ====================
  const state = {
    keybindings: null,
    hotkeySettings: { ...DEFAULT_HOTKEY_SETTINGS },
    currentItem: null,       // Active media item (from folder, queue, or single file)
    playbackSource: null,    // 'folder' | 'queue' | 'single' | null
    folderPlaylist: [],      // Ordered media items for active left-sidebar folder playback
    folderPlayIndex: -1,
    queue: [],               // Explicit user-built right-sidebar Queue (only via + / Add Files)
    queueIndex: -1,
    queuedNextIndex: -1,     // Armed Queue index to play automatically next after current folder/single video
    libraryFolder: null,     // { folderPath, parentPath, folderName, subfolders, items }
    libraryFilter: '',
    sidebarShortcuts: null,  // [{ label, path }] — customizable user shortcuts
    bookmarks: [],           // { id, title, filePath, time }
    history: [],             // [{ filePath, name, title, duration, lastPlayedAt }]
    drawerTab: 'queue',      // 'queue' | 'bookmarks' | 'history'
    dismissShortcutPrompt: false,

    playing: false,
    volume: 100,             // 0..200 (200% cone boost)
    muted: false,
    speed: 1.0,
    loop: false,
    repeatMode: 'off',       // 'off' | 'all' | 'one'
    shuffle: false,
    abLoop: { a: null, b: null, active: false },
    nightMode: false,
    audioDelayMs: 0,
    showRemainingTime: true,
    stopAfterCurrent: false,
    sleepTimer: { minutes: 0, targetTime: 0, timerId: null, intervalId: null },

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
    themeMode: 'dark', // 'dark' (default) | 'light'
    accentKey: 'orange',
    customAccentHex: null,
    showHoverThumb: true,
    autoHideFs: true,
    alwaysOnTop: false,
    autoLoadFolder: true,
    autoLoadSub: true,
    rememberState: true,
    resumeLastVideo: false,
    seekbarThumbStyle: 'pill', // 'cone' | 'paw' | 'pill'
    visualizerStyle: 'bars',   // 'bars' | 'waveform' | 'aura'
    isGhostMode: false,
    ghostOpacity: 75,
    bottomBarIcons: {
      step: false,
      shuffle: false,
      repeat: false,
      ab: false,
      night: false,
      snapshot: false
    },
    subFont: "'Segoe UI Variable Text', system-ui, sans-serif",
    subColor: '#FFFFFF',
    subBgStyle: 'shadow',      // 'shadow' | 'box-translucent' | 'box-solid'
    speedChipsVisible: ['0.5', '0.75', '1', '1.25', '1.5', '2'],
    skipMode: 'prompt',        // 'prompt' | 'never' | 'skip_ending' | 'skip_all'
    watchedQueuePaths: [],     // File paths of items watched in Queue
    currentChapters: [],
    currentSegments: [],
    activeSkipSegment: null,
    upNextDismissed: false,
    lastSkippedSegmentId: null,
    savedLastItem: null,
    savedLastPosition: 0,
    savedLastFolder: null,
    savedLastQueue: null,
    savedLastQueueIndex: -1,
    savedLastQueueWatched: [],

    // Window & chrome interaction state
    isFullscreen: false,
    isMaximized: false,
    aiPort: 4500,
    hoveringTopBar: false,
    hoveringBottomBar: false,
    hoveringLeftSidebar: false,
    hoveringRightDrawer: false,
    hoveringBottomPopover: false,
    interactingBottomPopover: false,
    bottomPopoverSelectOpen: false,
    leftOpenedByEdge: false,
    rightOpenedByEdge: false,
    leftEdgeCooldownUntil: 0,
    rightEdgeCooldownUntil: 0,
    draggingQueueItem: false,
    externalFileDragActive: false,
    dialogOpen: false,
    lastPauseAt: 0
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
    subtitleOverlay: $('subtitle-overlay'),
    osdToast: $('osd-toast'),
    dropOverlay: $('drop-overlay'),
    shortcutBanner: $('shortcut-banner'),
    shortcutBannerIcon: $('shortcut-banner-icon'),
    btnBannerCreateShortcut: $('btn-banner-create-shortcut'),
    btnBannerDismissShortcut: $('btn-banner-dismiss-shortcut'),

    resumePromptBanner: $('resume-prompt-banner'),
    resumePromptIcon: $('resume-prompt-icon'),
    resumePromptDesc: $('resume-prompt-desc'),
    btnResumeContinue: $('btn-resume-continue'),

    queuePromptBanner: $('queue-prompt-banner'),
    queuePromptIcon: $('queue-prompt-icon'),
    queuePromptDesc: $('queue-prompt-desc'),
    btnRestoreQueueConfirm: $('btn-restore-queue-confirm'),

    rightDrawer: $('right-drawer'),
    tabDrawerQueue: $('tab-drawer-queue'),
    tabDrawerBookmarks: $('tab-drawer-bookmarks'),
    tabDrawerHistory: $('tab-drawer-history'),
    drawerBody: $('drawer-body'),
    btnDrawerAdd: $('btn-drawer-add'),
    btnDrawerBookmark: $('btn-drawer-bookmark'),
    btnDrawerClear: $('btn-drawer-clear'),

    bottomBar: $('bottom-bar'),
    btnBottomStepBack: $('btn-bottom-step-back'),
    btnPrev: $('btn-prev'),
    btnPlay: $('btn-play'),
    btnNext: $('btn-next'),
    btnBottomStepFwd: $('btn-bottom-step-fwd'),
    timeElapsed: $('time-elapsed'),
    timeTotal: $('time-total'),
    bottomSpeedBadge: $('bottom-speed-badge'),
    subSyncMini: $('sub-sync-mini'),
    btnSubEarlier: $('btn-sub-earlier'),
    btnSubLater: $('btn-sub-later'),
    seekbarTrack: $('seekbar-track'),
    seekbarFill: $('seekbar-fill'),
    seekbarAbRange: $('seekbar-ab-range'),
    seekbarSubBlocks: $('seekbar-sub-blocks'),
    seekbarThumb: $('seekbar-thumb'),
    seekHoverCard: $('seek-hover-card'),
    hoverPreviewCanvas: $('hover-preview-canvas'),
    hoverTimeText: $('hover-time-text'),

    btnMute: $('btn-mute'),
    volConeSlider: $('vol-cone-slider'),
    volConeFill: $('vol-cone-fill'),

    btnBottomShuffle: $('btn-bottom-shuffle'),
    btnBottomRepeat: $('btn-bottom-repeat'),
    btnBottomAb: $('btn-bottom-ab'),
    btnBottomNight: $('btn-bottom-night'),
    btnBottomSnapshot: $('btn-bottom-snapshot'),
    btnAudioPop: $('btn-audio-pop'),
    btnSubPop: $('btn-sub-pop'),
    btnGearPop: $('btn-gear-pop'),
    btnQueueDrawer: $('btn-queue-drawer'),

    bottomPopover: $('bottom-popover'),
    lblSpeed: $('lbl-speed'),
    rngSpeed: $('rng-speed'),
    quickSpeedChipsWrap: $('quick-speed-chips-wrap'),
    btnRepeatModeCycle: $('btn-repeat-mode-cycle'),
    swShuffle: $('sw-shuffle'),
    lblAbStatus: $('lbl-ab-status'),
    btnAbSetA: $('btn-ab-set-a'),
    btnAbSetB: $('btn-ab-set-b'),
    btnAbClear: $('btn-ab-clear'),
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
    swNightMode: $('sw-night-mode'),
    selEqPreset: $('sel-eq-preset'),
    lblAudioDelay: $('lbl-audio-delay'),
    btnAudioMinus25: $('btn-audio-minus25'),
    btnAudioReset: $('btn-audio-reset'),
    btnAudioPlus25: $('btn-audio-plus25'),
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
    selSubFont: $('sel-sub-font'),
    subColorSwatches: $('sub-color-swatches'),
    selSubBg: $('sel-sub-bg'),
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
    swResumePlayback: $('sw-resume-playback'),
    btnCreateDesktopShortcut: $('btn-create-desktop-shortcut'),
    aiEndpointBox: $('ai-endpoint-box'),
    aiSampleCmd: $('ai-sample-cmd'),
    btnCopyAiCmd: $('btn-copy-ai-cmd'),

    inpTuneVol: $('inp-tune-vol'),
    inpTuneSeekSmall: $('inp-tune-seek-small'),
    inpTuneSeekLarge: $('inp-tune-seek-large'),
    inpTuneSpeed: $('inp-tune-speed'),
    btnResetHotkeys: $('btn-reset-hotkeys'),
    btnResetAllSettings: $('btn-reset-all-settings'),
    hotkeysTableContainer: $('hotkeys-table-container'),

    btnThemeDark: $('btn-theme-dark'),
    btnThemeLight: $('btn-theme-light'),
    menuToggleTheme: $('menu-toggle-theme'),
    menuThemeLabel: $('menu-theme-label'),

    btnThumbCone: $('btn-thumb-cone'),
    btnThumbPaw: $('btn-thumb-paw'),
    btnThumbPill: $('btn-thumb-pill'),
    previewThumbCone: $('preview-thumb-cone'),
    previewThumbPaw: $('preview-thumb-paw'),
    selVisualizerStyle: $('sel-visualizer-style'),
    swGhostMode: $('sw-ghost-mode'),
    lblGhostOpacity: $('lbl-ghost-opacity'),
    rngGhostOpacity: $('rng-ghost-opacity'),

    chkBarStep: $('chk-bar-step'),
    chkBarShuffle: $('chk-bar-shuffle'),
    chkBarRepeat: $('chk-bar-repeat'),
    chkBarAb: $('chk-bar-ab'),
    chkBarNight: $('chk-bar-night'),
    chkBarSnapshot: $('chk-bar-snapshot'),
    btnSpeedChipsAll: $('btn-speed-chips-all'),
    btnSpeedChipsNone: $('btn-speed-chips-none'),

    btnSkipSegment: $('btn-skip-segment'),
    skipSegmentLabel: $('skip-segment-label'),
    upNextBanner: $('up-next-banner'),
    upNextCountdownNum: $('up-next-countdown-num'),
    upNextTitle: $('up-next-title'),
    upNextProgressFill: $('up-next-progress-fill'),
    btnUpNextPlay: $('btn-up-next-play'),
    btnUpNextDismiss: $('btn-up-next-dismiss'),
    selSkipMode: $('sel-skip-mode'),
    selPopSkipMode: $('sel-pop-skip-mode'),
    seekbarChapters: $('seekbar-chapters'),
    holdSpeedBadge: $('hold-speed-badge'),
    selSleepTimer: $('sel-sleep-timer'),
    sleepTimerDesc: $('sleep-timer-desc')
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
  let compressorNode = null;
  let delayNode = null;
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

      compressorNode = audioCtx.createDynamicsCompressor();
      delayNode = audioCtx.createDelay(2.0);

      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.82;

      gainNode = audioCtx.createGain();

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(compressorNode);
      compressorNode.connect(delayNode);
      delayNode.connect(analyserNode);
      analyserNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      eqNodes = [bass, mid, treble];
      applyEqualizer();
      applyNightModeAndDelay();
      applyVolumeToEngine();
    } catch (err) {
      console.warn('WebAudio fallback active:', err);
    }
  }

  function applyNightModeAndDelay() {
    if (!compressorNode || !delayNode || !audioCtx) return;
    try {
      if (state.nightMode) {
        compressorNode.threshold.setValueAtTime(-24, audioCtx.currentTime);
        compressorNode.knee.setValueAtTime(30, audioCtx.currentTime);
        compressorNode.ratio.setValueAtTime(12, audioCtx.currentTime);
        compressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
        compressorNode.release.setValueAtTime(0.25, audioCtx.currentTime);
      } else {
        compressorNode.ratio.setValueAtTime(1, audioCtx.currentTime);
        compressorNode.threshold.setValueAtTime(0, audioCtx.currentTime);
      }
      const delaySec = Math.max(0, Math.min(2.0, (state.audioDelayMs || 0) / 1000));
      delayNode.delayTime.setValueAtTime(delaySec, audioCtx.currentTime);
    } catch {}
  }

  function applyEqualizer() {
    if (!eqNodes) return;
    const gains = EQ_PRESETS[state.eqPreset] || EQ_PRESETS.flat;
    eqNodes[0].gain.value = gains[0];
    eqNodes[1].gain.value = gains[1];
    eqNodes[2].gain.value = gains[2];
  }

  let lastMutedIconState = null;

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
    const isMuted = state.muted || clamped === 0;
    el.volConeSlider.classList.toggle('muted', isMuted);
    el.volConeSlider.title = `Cone Volume Boost: ${state.muted ? 'Muted' : clamped + '%'} (Up to 200%)`;
    if (isMuted !== lastMutedIconState) {
      el.btnMute.innerHTML = isMuted ? ICONS.speakerMute : ICONS.speaker;
      lastMutedIconState = isMuted;
    }

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
  function applyThemeMode(mode, persist = true) {
    const targetMode = mode === 'light' ? 'light' : 'dark';
    state.themeMode = targetMode;
    const root = document.documentElement;
    root.setAttribute('data-theme', targetMode);
    if (el.app) el.app.setAttribute('data-theme', targetMode);

    if (el.btnThemeDark) {
      el.btnThemeDark.classList.toggle('active', targetMode === 'dark');
    }
    if (el.btnThemeLight) {
      el.btnThemeLight.classList.toggle('active', targetMode === 'light');
    }
    if (el.menuThemeLabel) {
      el.menuThemeLabel.textContent = targetMode === 'dark' ? 'Dark' : 'Light';
    }

    if (persist) savePreferences();
    updateChromeSolidity();
    pushPlayerStatus();
  }

  let cachedAccentRgb = '224, 122, 22';

  function applyAccent(keyOrHex, persist = true) {
    const root = document.documentElement;
    if (ACCENT_PRESETS[keyOrHex]) {
      const p = ACCENT_PRESETS[keyOrHex];
      state.accentKey = keyOrHex;
      state.customAccentHex = null;
      root.style.setProperty('--accent', p.hex);
      root.style.setProperty('--accent-hover', p.hover);
      root.style.setProperty('--accent-rgb', p.rgb);
      cachedAccentRgb = p.rgb;
      el.inpCustomAccent.value = p.hex;
      el.lblActiveAccent.textContent = `${p.hex} (${p.label})`;
    } else if (typeof keyOrHex === 'string' && keyOrHex.startsWith('#')) {
      const hex = keyOrHex.toUpperCase();
      state.accentKey = 'custom';
      state.customAccentHex = hex;
      root.style.setProperty('--accent', hex);
      root.style.setProperty('--accent-hover', brightenHex(hex, 24));
      const rgb = hexToRgbString(hex);
      root.style.setProperty('--accent-rgb', rgb);
      cachedAccentRgb = rgb;
      el.inpCustomAccent.value = hex;
      el.lblActiveAccent.textContent = `${hex} (Custom)`;
    }

    document.querySelectorAll('.swatch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.accent === state.accentKey);
    });

    if (persist) savePreferences();
    pushPlayerStatus();
  }

  let savePrefsTimer = null;

  function savePreferences(immediate = false) {
    if (immediate) {
      if (savePrefsTimer) {
        clearTimeout(savePrefsTimer);
        savePrefsTimer = null;
      }
      savePreferencesSync();
      return;
    }
    if (savePrefsTimer) return;
    savePrefsTimer = setTimeout(() => {
      savePrefsTimer = null;
      savePreferencesSync();
    }, 250);
  }

  function savePreferencesSync() {
    if (savePrefsTimer) {
      clearTimeout(savePrefsTimer);
      savePrefsTimer = null;
    }
    if (!state.rememberState) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const curTime = getCurrentTime();
    const data = {
      volume: state.volume,
      themeMode: state.themeMode,
      accentKey: state.accentKey,
      customAccentHex: state.customAccentHex,
      showHoverThumb: state.showHoverThumb,
      autoHideFs: state.autoHideFs,
      autoLoadFolder: state.autoLoadFolder,
      folderPlaybackV3: true,
      autoLoadSub: state.autoLoadSub,
      rememberState: state.rememberState,
      resumeLastVideo: state.resumeLastVideo,
      subTimelineBlocks: state.subTimelineBlocks,
      subSizePx: state.subSizePx,
      subEnabled: state.subEnabled,
      subFont: state.subFont,
      subColor: state.subColor,
      subBgStyle: state.subBgStyle,
      eqPreset: state.eqPreset,
      visualizerEnabled: state.visualizerEnabled,
      visualizerStyle: state.visualizerStyle,
      showRemainingTime: state.showRemainingTime,
      sidebarShortcuts: state.sidebarShortcuts,
      dismissShortcutPrompt: state.dismissShortcutPrompt,
      keybindings: state.keybindings,
      hotkeySettings: state.hotkeySettings,
      repeatMode: state.repeatMode,
      loop: state.loop,
      shuffle: state.shuffle,
      nightMode: state.nightMode,
      audioDelayMs: state.audioDelayMs,
      history: state.history,
      seekbarThumbStyle: state.seekbarThumbStyle,
      ghostOpacity: state.ghostOpacity,
      bottomBarIcons: state.bottomBarIcons,
      speedChipsVisible: state.speedChipsVisible,
      skipMode: state.skipMode,
      watchedQueuePaths: state.queue && state.queue.length > 0 ? (state.watchedQueuePaths || []) : (state.savedLastQueueWatched || []),
      videoFit: state.videoFit,
      brightness: state.brightness,
      contrast: state.contrast,
      saturation: state.saturation,
      alwaysOnTop: state.alwaysOnTop,
      lastMediaItem: state.currentItem || state.savedLastItem || null,
      lastFolder: state.libraryFolder || state.savedLastFolder || null,
      lastPositionSec: curTime > 3 ? curTime : (state.savedLastPosition || 0),
      lastQueue: state.queue && state.queue.length > 0 ? state.queue.slice() : (state.savedLastQueue || null),
      lastQueueIndex: state.queue && state.queue.length > 0 ? state.queueIndex : (state.savedLastQueueIndex ?? -1)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('vlcopycat_prefs_v1');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.volume === 'number') state.volume = d.volume;
      if (d.themeMode === 'light' || d.themeMode === 'dark') {
        state.themeMode = d.themeMode;
      } else {
        state.themeMode = 'dark';
      }
      applyThemeMode(state.themeMode, false);
      if (typeof d.showHoverThumb === 'boolean') state.showHoverThumb = d.showHoverThumb;
      if (typeof d.autoHideFs === 'boolean') state.autoHideFs = d.autoHideFs;
      if (typeof d.dismissShortcutPrompt === 'boolean') state.dismissShortcutPrompt = d.dismissShortcutPrompt;
      if (d.folderPlaybackV3 && typeof d.autoLoadFolder === 'boolean') {
        state.autoLoadFolder = d.autoLoadFolder;
      } else {
        state.autoLoadFolder = true;
      }
      if (typeof d.autoLoadSub === 'boolean') state.autoLoadSub = d.autoLoadSub;
      if (typeof d.rememberState === 'boolean') state.rememberState = d.rememberState;
      if (typeof d.resumeLastVideo === 'boolean') state.resumeLastVideo = d.resumeLastVideo;
      if (typeof d.subTimelineBlocks === 'boolean') state.subTimelineBlocks = d.subTimelineBlocks;
      if (typeof d.subSizePx === 'number') state.subSizePx = d.subSizePx;
      if (typeof d.subEnabled === 'boolean') state.subEnabled = d.subEnabled;
      if (typeof d.visualizerEnabled === 'boolean') state.visualizerEnabled = d.visualizerEnabled;
      if (typeof d.alwaysOnTop === 'boolean') state.alwaysOnTop = d.alwaysOnTop;
      if (typeof d.videoFit === 'string') state.videoFit = d.videoFit;
      if (typeof d.brightness === 'number') state.brightness = d.brightness;
      if (typeof d.contrast === 'number') state.contrast = d.contrast;
      if (typeof d.saturation === 'number') state.saturation = d.saturation;
      if (typeof d.eqPreset === 'string') state.eqPreset = d.eqPreset;
      if (typeof d.showRemainingTime === 'boolean') state.showRemainingTime = d.showRemainingTime;
      if (Array.isArray(d.sidebarShortcuts)) state.sidebarShortcuts = d.sidebarShortcuts;
      if (['off', 'all', 'one'].includes(d.repeatMode)) state.repeatMode = d.repeatMode;
      if (typeof d.loop === 'boolean') state.loop = d.loop;
      if (typeof d.shuffle === 'boolean') state.shuffle = d.shuffle;
      if (typeof d.nightMode === 'boolean') state.nightMode = d.nightMode;
      if (typeof d.audioDelayMs === 'number') state.audioDelayMs = d.audioDelayMs;
      if (Array.isArray(d.history)) state.history = d.history.slice(0, 30);
      if (['cone', 'paw', 'pill'].includes(d.seekbarThumbStyle)) {
        state.seekbarThumbStyle = d.seekbarThumbStyle;
      } else {
        state.seekbarThumbStyle = 'pill';
      }
      if (['bars', 'waveform', 'aura'].includes(d.visualizerStyle)) state.visualizerStyle = d.visualizerStyle;
      if (typeof d.ghostOpacity === 'number') state.ghostOpacity = d.ghostOpacity;
      if (d.bottomBarIcons && typeof d.bottomBarIcons === 'object') {
        state.bottomBarIcons = { ...state.bottomBarIcons, ...d.bottomBarIcons };
      }
      if (typeof d.subFont === 'string') state.subFont = d.subFont;
      if (typeof d.subColor === 'string') state.subColor = d.subColor;
      if (['shadow', 'box-translucent', 'box-solid'].includes(d.subBgStyle)) state.subBgStyle = d.subBgStyle;
      if (Array.isArray(d.speedChipsVisible)) state.speedChipsVisible = d.speedChipsVisible;
      if (['prompt', 'never', 'skip_ending', 'skip_all'].includes(d.skipMode)) {
        state.skipMode = d.skipMode;
      } else {
        state.skipMode = 'prompt';
      }
      state.watchedQueuePaths = [];
      if (Array.isArray(d.watchedQueuePaths)) {
        state.savedLastQueueWatched = d.watchedQueuePaths.slice(0, 300);
      }

      // Playback speed always reverts to standard 1.0 after closing the app
      state.speed = 1.0;

      if (d.hotkeySettings && typeof d.hotkeySettings === 'object') {
        state.hotkeySettings = {
          volumeStep: typeof d.hotkeySettings.volumeStep === 'number' ? d.hotkeySettings.volumeStep : DEFAULT_HOTKEY_SETTINGS.volumeStep,
          seekSmallSec: typeof d.hotkeySettings.seekSmallSec === 'number' ? d.hotkeySettings.seekSmallSec : DEFAULT_HOTKEY_SETTINGS.seekSmallSec,
          seekLargeSec: typeof d.hotkeySettings.seekLargeSec === 'number' ? d.hotkeySettings.seekLargeSec : DEFAULT_HOTKEY_SETTINGS.seekLargeSec,
          speedStep: typeof d.hotkeySettings.speedStep === 'number' ? d.hotkeySettings.speedStep : DEFAULT_HOTKEY_SETTINGS.speedStep
        };
      } else {
        state.hotkeySettings = { ...DEFAULT_HOTKEY_SETTINGS };
      }

      if (d.keybindings && typeof d.keybindings === 'object') {
        state.keybindings = { ...cloneDefaultKeybindings(), ...d.keybindings };
      } else {
        state.keybindings = cloneDefaultKeybindings();
      }

      if (d.rememberState) {
        if (d.lastMediaItem) state.savedLastItem = d.lastMediaItem;
        if (d.lastFolder) state.savedLastFolder = d.lastFolder;
        if (typeof d.lastPositionSec === 'number') state.savedLastPosition = d.lastPositionSec;
        if (Array.isArray(d.lastQueue) && d.lastQueue.length > 0) {
          state.savedLastQueue = d.lastQueue;
          state.savedLastQueueIndex = typeof d.lastQueueIndex === 'number' ? d.lastQueueIndex : -1;
        }
      }

      if (d.accentKey === 'custom' && d.customAccentHex) {
        applyAccent(d.customAccentHex, false);
      } else if (d.accentKey && ACCENT_PRESETS[d.accentKey]) {
        applyAccent(d.accentKey, false);
      }
    } catch {}
  }

  function syncSwitchesUI() {
    if (el.swSubTimeline) el.swSubTimeline.classList.toggle('on', state.subTimelineBlocks);
    if (el.swVisualizer) el.swVisualizer.classList.toggle('on', state.visualizerEnabled);
    if (el.swSubEnabled) el.swSubEnabled.classList.toggle('on', state.subEnabled);
    if (el.swHoverThumb) el.swHoverThumb.classList.toggle('on', state.showHoverThumb);
    if (el.swAutohideFs) el.swAutohideFs.classList.toggle('on', state.autoHideFs);
    if (el.swAlwaysOnTop) el.swAlwaysOnTop.classList.toggle('on', state.alwaysOnTop);
    if (el.swAutoloadFolder) el.swAutoloadFolder.classList.toggle('on', state.autoLoadFolder);
    if (el.swAutoloadSub) el.swAutoloadSub.classList.toggle('on', state.autoLoadSub);
    if (el.swRememberState) el.swRememberState.classList.toggle('on', state.rememberState);
    if (el.swResumePlayback) el.swResumePlayback.classList.toggle('on', Boolean(state.resumeLastVideo));

    if (el.selEqPreset) el.selEqPreset.value = state.eqPreset;
    if (el.selSkipMode) el.selSkipMode.value = state.skipMode;
    if (el.selPopSkipMode) el.selPopSkipMode.value = state.skipMode;
    if (el.selSleepTimer) el.selSleepTimer.value = String(state.sleepTimer?.minutes || 0);
    if (el.rngSubSize) el.rngSubSize.value = String(state.subSizePx);
    if (el.lblSubSize) el.lblSubSize.textContent = `${state.subSizePx}px`;
    if (el.subtitleOverlay) el.subtitleOverlay.style.fontSize = `${state.subSizePx}px`;

    if (el.selVideoFit) el.selVideoFit.value = state.videoFit || 'contain';
    if (el.rngBrightness) el.rngBrightness.value = String(state.brightness ?? 100);
    if (el.lblBrightness) el.lblBrightness.textContent = `${state.brightness ?? 100}%`;
    if (el.rngContrast) el.rngContrast.value = String(state.contrast ?? 100);
    if (el.lblContrast) el.lblContrast.textContent = `${state.contrast ?? 100}%`;
    if (el.rngSaturation) el.rngSaturation.value = String(state.saturation ?? 100);
    if (el.lblSaturation) el.lblSaturation.textContent = `${state.saturation ?? 100}%`;
    if (el.menuAlwaysTopLabel) {
      el.menuAlwaysTopLabel.textContent = state.alwaysOnTop
        ? '✓ Window Pinned Always on Top'
        : 'Pin Window Always on Top';
    }
  }

  async function resetAllSettingsToDefault() {
    state.volume = 100;
    state.muted = false;
    state.speed = 1.0;
    state.loop = false;
    state.repeatMode = 'off';
    state.shuffle = false;
    state.nightMode = false;
    state.audioDelayMs = 0;
    state.showRemainingTime = true;

    state.videoFit = 'contain';
    state.brightness = 100;
    state.contrast = 100;
    state.saturation = 100;

    state.eqPreset = 'flat';
    state.visualizerEnabled = false;
    state.visualizerStyle = 'bars';

    state.subEnabled = true;
    state.subTimelineBlocks = true;
    state.subSizePx = 22;
    state.subOffsetMs = 0;
    state.subFont = "'Segoe UI Variable Text', system-ui, sans-serif";
    state.subColor = '#FFFFFF';
    state.subBgStyle = 'shadow';

    state.themeMode = 'dark';
    state.accentKey = 'orange';
    state.customAccentHex = null;
    state.showHoverThumb = true;
    state.autoHideFs = true;
    state.alwaysOnTop = false;
    state.autoLoadFolder = true;
    state.autoLoadSub = true;
    state.rememberState = true;
    state.resumeLastVideo = false;
    state.seekbarThumbStyle = 'pill';
    state.isGhostMode = false;
    state.ghostOpacity = 75;
    state.bottomBarIcons = {
      step: false,
      shuffle: false,
      repeat: false,
      ab: false,
      night: false,
      snapshot: false
    };
    state.speedChipsVisible = ['0.5', '0.75', '1', '1.25', '1.5', '2'];
    state.skipMode = 'prompt';
    state.watchedQueuePaths = [];
    state.stopAfterCurrent = false;
    setSleepTimer(0);

    state.hotkeySettings = { ...DEFAULT_HOTKEY_SETTINGS };
    state.keybindings = cloneDefaultKeybindings();

    if (api && api.getQuickFolders) {
      try {
        const defaultQuickFolders = await api.getQuickFolders();
        state.sidebarShortcuts = defaultQuickFolders.map((q) => ({ label: q.label, path: q.path }));
        renderSidebarShortcuts();
      } catch {}
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('vlcopycat_prefs_v1');
    } catch {}

    applyThemeMode('dark', false);
    applyAccent('orange', false);
    applyVolumeToEngine();
    applyVideoAppearance();
    applySeekbarThumbStyle('pill', false);
    applySubtitleAppearance(false);
    applyEqualizer();
    applyNightModeAndDelay();
    setSpeed(1.0, false);
    toggleGhostMode(false);
    setGhostOpacity(75, false);

    if (el.selVisualizerStyle) el.selVisualizerStyle.value = 'bars';

    if (api && api.setAlwaysOnTop) {
      api.setAlwaysOnTop(false).catch(() => {});
    }

    syncSwitchesUI();
    syncRepeatUI();
    syncNightModeUI();
    syncBottomBarIconsUI(false);
    syncSpeedChipsUI(false);
    syncHotkeyInputsUI();
    renderHotkeysTable();
    updateVisualizerVisibility();
    updateBottomSpeedBadge();

    savePreferences();
    showToast('All settings reset to default');
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
    cues.sort((a, b) => a.start - b.start);
    return cues;
  }

  function loadSubtitleData(subObj, notify = true) {
    lastActiveSubCue = null;
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
    lastActiveSubCue = null;
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

  let lastActiveSubCue = null;

  function findSubtitleCueAtTime(cues, t) {
    if (!cues || !cues.length) return null;
    let low = 0;
    let high = cues.length - 1;
    let idx = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (cues[mid].start <= t) {
        idx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (idx !== -1 && t <= cues[idx].end) {
      return cues[idx];
    }
    if (idx > 0 && t <= cues[idx - 1].end && t >= cues[idx - 1].start) {
      return cues[idx - 1];
    }
    return null;
  }

  function updateActiveSubtitleCue() {
    if (!state.subEnabled || !state.subCues.length || !getCurrentItem()) {
      if (lastActiveSubCue !== null) {
        lastActiveSubCue = null;
        el.subtitleOverlay.classList.remove('visible');
        el.subtitleOverlay.textContent = '';
      }
      return;
    }
    const t = getCurrentTime() - state.subOffsetMs / 1000;
    const active = findSubtitleCueAtTime(state.subCues, t);
    if (active === lastActiveSubCue) {
      return;
    }
    lastActiveSubCue = active;
    if (active) {
      el.subtitleOverlay.textContent = active.text;
      el.subtitleOverlay.classList.add('visible');
    } else {
      el.subtitleOverlay.classList.remove('visible');
      el.subtitleOverlay.textContent = '';
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
    state.currentChapters = probe?.chapters || [];
    state.currentSegments = classifySegments(state.currentChapters, state.streamDuration, item);
    lastStreamThumbSec = -999;

    thumbVideo.removeAttribute('src');
    el.video.crossOrigin = 'anonymous';
    el.video.loop = false; // Handled manually on 'ended' so loop starts at 0:00
    el.video.src = buildStreamUrl(item.filePath, startSec);
    el.video.playbackRate = state.speed;
    updateBottomSpeedBadge();

    updateTimelineUI();
    renderSubtitleBlocksOnSeekbar();
    renderChapterMarkersOnSeekbar();

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

  // ==================== SESSION RESTORE & PROMPT HELPERS ====================
  let resumePromptTimer = null;
  let queuePromptTimer = null;

  function isSameMediaItem(a, b) {
    if (!a || !b) return false;
    const pathA = (a.filePath || a.path || '').toLowerCase();
    const pathB = (b.filePath || b.path || '').toLowerCase();
    if (pathA && pathB && pathA === pathB) return true;
    const nameA = (a.name || a.title || '').toLowerCase();
    const nameB = (b.name || b.title || '').toLowerCase();
    if (nameA && nameB && nameA === nameB) return true;
    return false;
  }

  function updateBannerStacking() {
    const resumeVisible = el.resumePromptBanner && el.resumePromptBanner.classList.contains('visible');
    if (el.queuePromptBanner) {
      el.queuePromptBanner.classList.toggle('stacked-above', resumeVisible);
    }
  }

  function hideResumePrompt() {
    if (resumePromptTimer) {
      clearTimeout(resumePromptTimer);
      resumePromptTimer = null;
    }
    if (el.resumePromptBanner) {
      el.resumePromptBanner.classList.remove('visible');
    }
    updateBannerStacking();
  }

  function hideQueuePrompt() {
    if (queuePromptTimer) {
      clearTimeout(queuePromptTimer);
      queuePromptTimer = null;
    }
    if (el.queuePromptBanner) {
      el.queuePromptBanner.classList.remove('visible');
    }
    updateBannerStacking();
  }

  function checkSessionPromptsForOpenedItem(item) {
    if (!item) return;

    // 1. Resume prompt: if this opened item matches previous session file and saved progress > 4s
    if (state.savedLastItem && state.savedLastPosition > 4 && isSameMediaItem(item, state.savedLastItem)) {
      const resumePos = Math.max(0, Math.round(state.savedLastPosition) - 5);
      if (el.resumePromptDesc) {
        el.resumePromptDesc.textContent = `Resume playback at ${formatTime(resumePos)}?`;
      }
      if (el.resumePromptBanner) {
        el.resumePromptBanner.classList.add('visible');
        updateBannerStacking();
        if (resumePromptTimer) clearTimeout(resumePromptTimer);
        resumePromptTimer = setTimeout(hideResumePrompt, 7000);
      }
    }

    // 2. Previous queue prompt: if previous session had a queue and this item was part of it
    if (
      Array.isArray(state.savedLastQueue) &&
      state.savedLastQueue.length > 0 &&
      (!state.queue || state.queue.length === 0)
    ) {
      const matchIdx = state.savedLastQueue.findIndex((q) => isSameMediaItem(q, item));
      if (matchIdx !== -1) {
        if (el.queuePromptDesc) {
          el.queuePromptDesc.textContent = `This video was part of your previous queue (${state.savedLastQueue.length} videos).`;
        }
        if (el.queuePromptBanner) {
          el.queuePromptBanner.classList.add('visible');
          updateBannerStacking();
          if (queuePromptTimer) clearTimeout(queuePromptTimer);
          queuePromptTimer = setTimeout(hideQueuePrompt, 7000);
        }
      }
    }
  }

  // ==================== MEDIA LOADING, FOLDER PLAYBACK & EXPLICIT QUEUE ====================
  async function resetPlayerToIdle() {
    stopHold2x();
    hideResumePrompt();
    hideQueuePrompt();
    pauseMedia();
    await api.stopStream();
    el.video.removeAttribute('src');
    el.video.classList.remove('loaded');
    el.emptyState.classList.remove('hidden');
    state.currentItem = null;
    state.playbackSource = null;
    state.queueIndex = -1;
    state.queuedNextIndex = -1;
    state.folderPlayIndex = -1;
    state.streamMode = false;
    state.streamOffset = 0;
    state.streamDuration = 0;
    el.mediaTitle.textContent = 'CopyCat media player';
    document.title = 'CopyCat media player';
    clearSubtitles();
    updateVisualizerVisibility();
    updateTransportUI();
    updateTimelineUI();
    updateChromeSolidity();

    if (!state.dismissShortcutPrompt && api.hasDesktopShortcut) {
      api.hasDesktopShortcut().then((has) => {
        if (!has && !state.currentItem && el.shortcutBanner) {
          el.shortcutBanner.classList.add('visible');
        }
      }).catch(() => {});
    }
  }

  async function loadMediaItem(
    item,
    { autoPlay = true, source = 'single', folderList = null, folderIdx = -1, queueIdx = -1 } = {}
  ) {
    if (!item) return;

    stopHold2x();
    hideResumePrompt();
    hideQueuePrompt();

    state.currentItem = item;
    state.playbackSource = source;
    state.queuedNextIndex = -1;
    addCurrentToHistory(item);
    clearAbLoop();

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

    state.upNextDismissed = false;
    state.lastSkippedSegmentId = null;
    state.activeSkipSegment = null;
    hideSkipSegmentPrompt();
    hideUpNextBanner();
    state.currentChapters = [];
    state.currentSegments = [];
    renderChapterMarkersOnSeekbar();

    el.video.classList.toggle('loaded', !item.isAudio);
    el.emptyState.classList.add('hidden');
    if (el.shortcutBanner) {
      el.shortcutBanner.classList.remove('visible');
    }
    updateChromeSolidity();
    applyVideoAppearance();

    el.mediaTitle.textContent = item.title || item.name;
    document.title = `${item.title || item.name} — CopyCat media player`;

    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.title || item.name,
          artist: item.folderName || 'CopyCat media player'
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
      checkSessionPromptsForOpenedItem(item);
      return;
    }

    // Standard native playback path (ISO MP4, WebM, Audio)
    el.video.removeAttribute('crossorigin');
    el.video.src = item.fileUrl;
    el.video.playbackRate = state.speed;
    updateBottomSpeedBadge();
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
    checkSessionPromptsForOpenedItem(item);

    // Fetch chapters and detect segments via FFprobe asynchronously
    if (!item.isAudio && api.probeMedia && item.filePath) {
      api.probeMedia(item.filePath).then((probe) => {
        if (probe && probe.ok && state.currentItem === item) {
          state.currentChapters = probe.chapters || [];
          state.currentSegments = classifySegments(state.currentChapters, probe.duration || getDuration(), item);
          renderChapterMarkersOnSeekbar();
          updateTimelineUI();
        }
      }).catch(() => {});
    }
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

    // When playing from a folder (or single file) and adding to Queue, arm the Queue to play next automatically
    if (!isPlayerIdle && state.playbackSource !== 'queue') {
      if (state.queuedNextIndex < 0 || idx <= state.queuedNextIndex) {
        state.queuedNextIndex = idx;
      }
    }

    renderLibraryList();
    renderRightDrawer();
    pushPlayerStatus();

    if (isPlayerIdle && playFirstIfIdle) {
      loadQueueItemAtIndex(idx, true);
    } else if (toast) {
      if (isAppend) {
        if (items.length === 1) {
          const prefix =
            state.playbackSource !== 'queue' && state.queuedNextIndex === idx
              ? 'Up next in queue'
              : 'Added to queue';
          showToast(`${prefix}: ${items[0].title || items[0].name}`);
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

    if (state.queuedNextIndex >= 0) {
      if (fromIdx > state.queuedNextIndex && toIdx <= state.queuedNextIndex) {
        state.queuedNextIndex = toIdx;
      } else if (fromIdx === state.queuedNextIndex && toIdx < fromIdx) {
        state.queuedNextIndex = toIdx;
      } else if (fromIdx < state.queuedNextIndex && toIdx >= state.queuedNextIndex) {
        state.queuedNextIndex--;
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
    } else if (state.queuedNextIndex >= 0) {
      if (idx < state.queuedNextIndex) {
        state.queuedNextIndex--;
      }
      if (state.queuedNextIndex >= state.queue.length) {
        state.queuedNextIndex = -1;
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
    if (el.librarySidebar.classList.contains('collapsed')) {
      state.libraryDirty = true;
      return;
    }
    state.libraryDirty = false;
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
      if (e.button !== 0 || e.target.closest('.row-act-btn, .queue-watched-badge, button')) return;
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

  function markQueueItemWatched(filePath) {
    if (!filePath) return;
    if (!Array.isArray(state.watchedQueuePaths)) {
      state.watchedQueuePaths = [];
    }
    if (!state.watchedQueuePaths.includes(filePath)) {
      state.watchedQueuePaths.push(filePath);
      savePreferences();
      if (state.drawerTab === 'queue') {
        renderRightDrawer();
      }
    }
  }

  function toggleWatchedQueuePath(filePath) {
    if (!filePath) return;
    if (!Array.isArray(state.watchedQueuePaths)) {
      state.watchedQueuePaths = [];
    }
    const idx = state.watchedQueuePaths.indexOf(filePath);
    if (idx >= 0) {
      state.watchedQueuePaths.splice(idx, 1);
      showToast('Marked as unwatched in Queue');
    } else {
      state.watchedQueuePaths.push(filePath);
      showToast('Marked as watched in Queue');
    }
    savePreferences();
    renderRightDrawer();
  }

  function renderRightDrawer() {
    el.tabDrawerQueue.textContent = `Queue (${state.queue.length})`;
    el.tabDrawerBookmarks.textContent = `Bookmarks (${state.bookmarks.length})`;
    syncHistoryBadge();
    el.tabDrawerQueue.classList.toggle('active', state.drawerTab === 'queue');
    el.tabDrawerBookmarks.classList.toggle('active', state.drawerTab === 'bookmarks');
    if (el.tabDrawerHistory) {
      el.tabDrawerHistory.classList.toggle('active', state.drawerTab === 'history');
    }

    if (el.rightDrawer.classList.contains('collapsed')) {
      state.rightDrawerDirty = true;
      return;
    }
    state.rightDrawerDirty = false;

    el.drawerBody.innerHTML = '';

    if (state.drawerTab === 'queue') {
      if (!state.queue.length) {
        el.drawerBody.innerHTML = `<div class="queue-empty-msg">Queue is empty.<br/>Drop files here, press <strong>+</strong> next to any file in a folder, or click "+ Add Files".</div>`;
        return;
      }
      const frag = document.createDocumentFragment();

      const armedIdx =
        state.playbackSource !== 'queue' &&
        state.queuedNextIndex >= 0 &&
        state.queuedNextIndex < state.queue.length
          ? state.queuedNextIndex
          : -1;

      if (state.playbackSource !== 'queue' && getCurrentItem()) {
        const banner = document.createElement('div');
        banner.className = 'queue-mode-banner' + (armedIdx >= 0 ? ' armed' : '');
        const lbl = document.createElement('span');
        if (armedIdx >= 0) {
          lbl.textContent = `Up next: Queue #${armedIdx + 1}`;
        } else {
          lbl.textContent =
            state.playbackSource === 'folder' ? 'Playing from folder' : 'Playing single file';
        }
        const btnStartQ = document.createElement('button');
        btnStartQ.type = 'button';
        btnStartQ.className = 'lib-add-btn';
        btnStartQ.textContent = armedIdx >= 0 ? 'Play Now' : 'Play Queue';
        btnStartQ.title =
          armedIdx >= 0
            ? `Switch immediately to Queue #${armedIdx + 1}`
            : 'Switch playback to item #1 in Queue';
        btnStartQ.addEventListener('click', () =>
          loadQueueItemAtIndex(armedIdx >= 0 ? armedIdx : 0, true)
        );
        banner.appendChild(lbl);
        banner.appendChild(btnStartQ);
        frag.appendChild(banner);
      }

      state.queue.forEach((item, idx) => {
        const isQueuePlaying = state.playbackSource === 'queue' && idx === state.queueIndex;
        const isUpNext = !isQueuePlaying && armedIdx === idx;
        const isWatched = Array.isArray(state.watchedQueuePaths) && state.watchedQueuePaths.includes(item.filePath);
        const row = document.createElement('div');
        row.className =
          'lib-item queue-row' +
          (isQueuePlaying ? ' playing' : '') +
          (isUpNext ? ' up-next' : '') +
          (isWatched ? ' watched' : '');
        row.title = `${item.name}\n(Click to play from Queue • Right-click to toggle watched • Drag to reorder)`;
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          toggleWatchedQueuePath(item.filePath);
        });

        const grip = document.createElement('span');
        grip.className = 'queue-grip';
        grip.innerHTML = `<svg viewBox="0 0 10 16" width="10" height="14" fill="currentColor"><circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/></svg>`;

        const badge = document.createElement('div');
        badge.className = 'lib-item-badge';
        badge.textContent = String(idx + 1);

        const name = document.createElement('div');
        name.className = 'lib-item-name';
        name.textContent = item.title || item.name;

        row.appendChild(grip);
        row.appendChild(badge);
        row.appendChild(name);

        // Watched badge: permanent when watched; on unwatched rows, a ghost mark-pill appears on hover
        if (isWatched) {
          const watchedBadge = document.createElement('button');
          watchedBadge.type = 'button';
          watchedBadge.className = 'queue-watched-badge';
          watchedBadge.innerHTML = '<span class="watched-check-icon">✓</span> Watched';
          watchedBadge.title = 'Watched in Queue (Click to mark unwatched)';
          watchedBadge.addEventListener('pointerdown', (e) => e.stopPropagation());
          watchedBadge.addEventListener('pointerup', (e) => e.stopPropagation());
          watchedBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWatchedQueuePath(item.filePath);
          });
          row.appendChild(watchedBadge);
        } else {
          const ghostBadge = document.createElement('button');
          ghostBadge.type = 'button';
          ghostBadge.className = 'queue-watched-badge unwatched-ghost';
          ghostBadge.innerHTML = '<span class="watched-check-icon">+</span> Watched';
          ghostBadge.title = 'Click to mark as watched in Queue';
          ghostBadge.addEventListener('pointerdown', (e) => e.stopPropagation());
          ghostBadge.addEventListener('pointerup', (e) => e.stopPropagation());
          ghostBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWatchedQueuePath(item.filePath);
          });
          row.appendChild(ghostBadge);
        }

        const actions = document.createElement('div');
        actions.className = 'row-actions';

        const btnRm = document.createElement('button');
        btnRm.type = 'button';
        btnRm.className = 'row-act-btn danger';
        btnRm.textContent = '×';
        btnRm.title = 'Remove from Queue';
        btnRm.addEventListener('pointerdown', (e) => e.stopPropagation());
        btnRm.addEventListener('pointerup', (e) => e.stopPropagation());
        btnRm.addEventListener('click', (e) => {
          e.stopPropagation();
          removeQueueItem(idx);
        });
        actions.appendChild(btnRm);

        row.appendChild(actions);
        attachQueueRowDrag(row, item, idx);
        frag.appendChild(row);
      });
      el.drawerBody.appendChild(frag);
    } else if (state.drawerTab === 'bookmarks') {
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
    } else if (state.drawerTab === 'history') {
      if (!state.history || !state.history.length) {
        el.drawerBody.innerHTML = `<div style="padding:24px 12px;text-align:center;color:var(--text-muted);font-size:12px;">No recently played files yet.<br/>Play any video or audio to see it here.</div>`;
        return;
      }
      const frag = document.createDocumentFragment();
      state.history.forEach((h, idx) => {
        const row = document.createElement('div');
        row.className = 'history-row';
        row.title = `${h.title || h.name}\n${h.filePath}\nClick to play`;

        const info = document.createElement('div');
        info.className = 'history-info';

        const title = document.createElement('div');
        title.className = 'history-title';
        title.textContent = h.title || h.name;

        const sub = document.createElement('div');
        sub.className = 'history-sub';
        let subText = '';
        if (h.lastPlayedAt) {
          const d = new Date(h.lastPlayedAt);
          subText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (h.duration > 0) {
          subText += (subText ? ' • ' : '') + formatTime(h.duration);
        }
        sub.textContent = subText || 'Recent file';

        info.appendChild(title);
        info.appendChild(sub);

        const actions = document.createElement('div');
        actions.className = 'row-actions';

        const btnRm = document.createElement('button');
        btnRm.type = 'button';
        btnRm.className = 'row-act-btn danger';
        btnRm.textContent = '×';
        btnRm.title = 'Remove from History';
        btnRm.addEventListener('click', (e) => {
          e.stopPropagation();
          state.history.splice(idx, 1);
          syncHistoryBadge();
          renderRightDrawer();
          savePreferences();
        });
        actions.appendChild(btnRm);

        row.appendChild(info);
        row.appendChild(actions);

        row.addEventListener('click', async () => {
          const res = await api.resolvePaths([h.filePath]);
          if (res) ingestOpenedBundle(res, true);
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

  function getNextMediaItem() {
    if (state.repeatMode === 'one' || state.loop) {
      return state.currentItem;
    }
    if (
      state.playbackSource !== 'queue' &&
      state.queuedNextIndex >= 0 &&
      state.queuedNextIndex < state.queue.length
    ) {
      return state.queue[state.queuedNextIndex];
    }
    if (state.playbackSource === 'queue' && state.queue.length > 0) {
      if (state.shuffle && state.queue.length > 1) {
        const other = state.queue.find((_, i) => i !== state.queueIndex);
        return other || state.queue[0];
      }
      if (state.queueIndex < state.queue.length - 1) {
        return state.queue[state.queueIndex + 1];
      } else if (state.repeatMode === 'all') {
        return state.queue[0];
      }
    } else if (state.playbackSource === 'folder' && state.folderPlaylist.length > 0) {
      if (state.shuffle && state.folderPlaylist.length > 1) {
        const other = state.folderPlaylist.find((_, i) => i !== state.folderPlayIndex);
        return other || state.folderPlaylist[0];
      }
      if (state.folderPlayIndex < state.folderPlaylist.length - 1) {
        return state.folderPlaylist[state.folderPlayIndex + 1];
      } else if (state.repeatMode === 'all') {
        return state.folderPlaylist[0];
      }
    }
    return null;
  }

  function playNext() {
    if (state.playbackSource === 'queue' && state.currentItem && state.currentItem.filePath) {
      const cur = getCurrentTime();
      const dur = getDuration();
      if (dur >= 15 && cur / dur >= 0.75) {
        markQueueItemWatched(state.currentItem.filePath);
      }
    }
    if (
      state.playbackSource !== 'queue' &&
      state.queuedNextIndex >= 0 &&
      state.queuedNextIndex < state.queue.length
    ) {
      const startIdx = state.queuedNextIndex;
      state.queuedNextIndex = -1;
      loadQueueItemAtIndex(startIdx, true);
      return;
    }
    if (state.playbackSource === 'queue' && state.queue.length > 0) {
      if (state.shuffle && state.queue.length > 1) {
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * state.queue.length);
        } while (nextIdx === state.queueIndex && state.queue.length > 1);
        loadQueueItemAtIndex(nextIdx, true);
      } else {
        const nextIdx = (state.queueIndex + 1) % state.queue.length;
        loadQueueItemAtIndex(nextIdx, true);
      }
    } else if (state.playbackSource === 'folder' && state.folderPlaylist.length > 0) {
      if (state.shuffle && state.folderPlaylist.length > 1) {
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * state.folderPlaylist.length);
        } while (nextIdx === state.folderPlayIndex && state.folderPlaylist.length > 1);
        loadFolderItemAtIndex(nextIdx, true);
      } else {
        const nextIdx = (state.folderPlayIndex + 1) % state.folderPlaylist.length;
        loadFolderItemAtIndex(nextIdx, true);
      }
    }
  }

  let streamSeekDebounceTimer = null;

  function seekToSeconds(targetSec, shouldPlayAfter = !el.video.paused) {
    if (streamSeekDebounceTimer) {
      clearTimeout(streamSeekDebounceTimer);
      streamSeekDebounceTimer = null;
    }
    state.scrubPreviewTime = null;
    lastActiveSubCue = null;
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
    const cur = getCurrentTime();
    const target = Math.max(0, Math.min(dur, cur + deltaSec));
    showToast(`${deltaSec >= 0 ? '+' : ''}${deltaSec}s (${formatTime(target)})`);

    if (state.streamMode) {
      state.scrubPreviewTime = target;
      updateTimelineUI();
      const wasPlaying = !el.video.paused;
      if (streamSeekDebounceTimer) clearTimeout(streamSeekDebounceTimer);
      streamSeekDebounceTimer = setTimeout(() => {
        streamSeekDebounceTimer = null;
        const finalTarget = state.scrubPreviewTime !== null ? state.scrubPreviewTime : target;
        state.scrubPreviewTime = null;
        seekToSeconds(finalTarget, wasPlaying);
      }, 110);
    } else {
      seekToSeconds(target, !el.video.paused);
    }
  }

  function setSpeed(nextSpeed, toast = true) {
    const s = Math.max(0.25, Math.min(2.0, Math.round(nextSpeed * 100) / 100));
    state.speed = s;
    el.video.playbackRate = s;
    el.rngSpeed.value = String(s);
    el.lblSpeed.textContent = `${s.toFixed(2)}x`;
    updateBottomSpeedBadge();
    if (toast) showToast(`Speed: ${s.toFixed(2)}x`);
    pushPlayerStatus();
  }

  function updateBottomSpeedBadge() {
    if (!el.bottomSpeedBadge) return;
    const isStandard = Math.abs(state.speed - 1.0) < 0.01;
    el.bottomSpeedBadge.classList.toggle('hidden', isStandard);
    if (!isStandard) {
      const formatted = state.speed % 1 === 0 ? state.speed.toFixed(1) : state.speed.toFixed(2).replace(/0$/, '');
      el.bottomSpeedBadge.textContent = `${formatted}x`;
      el.bottomSpeedBadge.title = `Playback Speed: ${formatted}x (Click to reset to 1.0x)`;
    }
  }

  // ==================== HOLD TO 2X SPEED CONTROLLER ====================
  const hold2xState = {
    active: false,
    source: null,         // 'space' | 'pointer'
    preHoldSpeed: 1.0,
    timer: null,
    pending: false,
    suppressClickUntil: 0
  };

  function startHold2x(source) {
    if (!getCurrentItem()) return;
    if (hold2xState.active || hold2xState.pending) return;

    hold2xState.source = source;
    hold2xState.pending = true;
    hold2xState.preHoldSpeed = Number(state.speed) || 1.0;

    const delay = source === 'space' ? 220 : 250;
    hold2xState.timer = setTimeout(() => {
      triggerActiveHold2x();
    }, delay);
  }

  function triggerActiveHold2x() {
    if (!hold2xState.pending && !hold2xState.active) return;
    hold2xState.active = true;
    hold2xState.pending = false;

    if (el.video.paused) {
      playMedia();
    }

    el.video.playbackRate = 2.0;
    if (el.holdSpeedBadge) {
      el.holdSpeedBadge.classList.remove('hidden');
    }
  }

  function stopHold2x(source) {
    if (source && hold2xState.source !== source) {
      return false;
    }

    if (hold2xState.timer) {
      clearTimeout(hold2xState.timer);
      hold2xState.timer = null;
    }

    const wasActive = hold2xState.active;
    const wasSource = hold2xState.source;

    hold2xState.active = false;
    hold2xState.pending = false;
    hold2xState.source = null;

    if (wasActive) {
      const restoreSpeed = Math.max(0.25, Math.min(2.0, hold2xState.preHoldSpeed || 1.0));
      el.video.playbackRate = restoreSpeed;

      if (el.holdSpeedBadge) {
        el.holdSpeedBadge.classList.add('hidden');
      }

      if (wasSource === 'pointer') {
        hold2xState.suppressClickUntil = Date.now() + 350;
      }
      return true;
    }

    return false;
  }

  function applyVideoAppearance() {
    const isDefaultFilter = state.brightness === 100 && state.contrast === 100 && state.saturation === 100;
    el.video.style.filter = isDefaultFilter
      ? 'none'
      : `brightness(${state.brightness}%) contrast(${state.contrast}%) saturation(${state.saturation}%)`;
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
    const res = await api.saveSnapshot({ dataUrl, baseName: item.title || 'copycat' });
    if (res?.ok) {
      showToast('Snapshot saved to Pictures/CopyCat media player Snapshots');
    } else {
      showToast('Snapshot failed');
    }
  }

  async function copySnapshotToClipboard() {
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
    if (api && api.copyImageToClipboard) {
      const ok = await api.copyImageToClipboard(dataUrl);
      if (ok) {
        showToast('Snapshot copied to clipboard');
      } else {
        showToast('Failed to copy snapshot to clipboard');
      }
    } else {
      showToast('Clipboard copy not supported');
    }
  }

  function stepFrame(delta) {
    if (!getCurrentItem()) return;
    if (!el.video.paused) {
      pauseMedia();
    }
    const cur = getCurrentTime();
    const frameDur = 1 / 30;
    seekToSeconds(Math.max(0, cur + delta * frameDur), false);
    showToast(delta > 0 ? 'Frame Forward' : 'Frame Backward');
  }

  function setAbLoopPoint(point) {
    const cur = getCurrentTime();
    if (point === 'A') {
      state.abLoop.a = cur;
      if (state.abLoop.b !== null && state.abLoop.b <= state.abLoop.a) {
        state.abLoop.b = null;
        state.abLoop.active = false;
      }
      showToast(`Point A set at ${formatTime(cur)}`);
    } else if (point === 'B') {
      if (state.abLoop.a === null) {
        showToast('Set Point A first');
        return;
      }
      if (cur <= state.abLoop.a) {
        showToast('Point B must be after Point A');
        return;
      }
      state.abLoop.b = cur;
      state.abLoop.active = true;
      showToast(`Point B set at ${formatTime(cur)} (A-B Loop Active)`);
    }
    renderAbLoopUI();
  }

  function clearAbLoop() {
    state.abLoop = { a: null, b: null, active: false };
    renderAbLoopUI();
  }

  function cycleAbLoop() {
    if (state.abLoop.a === null) {
      setAbLoopPoint('A');
    } else if (state.abLoop.b === null) {
      setAbLoopPoint('B');
    } else {
      clearAbLoop();
      showToast('A-B Loop Cleared');
    }
  }

  function renderAbLoopUI() {
    if (el.lblAbStatus) {
      if (state.abLoop.active && state.abLoop.a !== null && state.abLoop.b !== null) {
        el.lblAbStatus.textContent = `${formatTime(state.abLoop.a)} ➔ ${formatTime(state.abLoop.b)}`;
      } else if (state.abLoop.a !== null) {
        el.lblAbStatus.textContent = `A: ${formatTime(state.abLoop.a)} (Waiting for B)`;
      } else {
        el.lblAbStatus.textContent = 'Off';
      }
    }
    if (el.btnBottomAb) {
      el.btnBottomAb.classList.toggle('active', Boolean(state.abLoop.active));
    }

    if (el.seekbarAbRange) {
      const dur = getDuration();
      if (dur > 0 && state.abLoop.a !== null) {
        const startPct = Math.max(0, Math.min(100, (state.abLoop.a / dur) * 100));
        const endSec = state.abLoop.b !== null ? state.abLoop.b : getCurrentTime();
        const endPct = Math.max(startPct, Math.min(100, (endSec / dur) * 100));
        el.seekbarAbRange.style.display = 'block';
        el.seekbarAbRange.style.left = `${startPct}%`;
        el.seekbarAbRange.style.width = `${endPct - startPct}%`;
      } else {
        el.seekbarAbRange.style.display = 'none';
      }
    }
  }

  function cycleRepeatMode() {
    if (state.repeatMode === 'off') {
      state.repeatMode = 'all';
    } else if (state.repeatMode === 'all') {
      state.repeatMode = 'one';
    } else {
      state.repeatMode = 'off';
    }
    syncRepeatUI();
    savePreferences();
    showToast(
      state.repeatMode === 'one'
        ? 'Repeat: Current Track'
        : state.repeatMode === 'all'
        ? 'Repeat: All Tracks'
        : 'Repeat: Off'
    );
  }

  function toggleShuffle(force) {
    state.shuffle = typeof force === 'boolean' ? force : !state.shuffle;
    syncRepeatUI();
    savePreferences();
    showToast(state.shuffle ? 'Shuffle: Enabled' : 'Shuffle: Disabled');
  }

  function syncRepeatUI() {
    if (el.swShuffle) el.swShuffle.classList.toggle('on', state.shuffle);
    if (el.btnBottomShuffle) el.btnBottomShuffle.classList.toggle('active', state.shuffle);

    if (el.btnRepeatModeCycle) {
      el.btnRepeatModeCycle.textContent =
        state.repeatMode === 'one'
          ? 'Repeat: One'
          : state.repeatMode === 'all'
          ? 'Repeat: All'
          : 'Repeat: Off';
    }

    if (el.btnBottomRepeat) {
      el.btnBottomRepeat.classList.toggle('active', state.repeatMode !== 'off');
      el.btnBottomRepeat.innerHTML = state.repeatMode === 'one' ? ICONS.repeatOne : ICONS.repeat;
    }
  }

  function toggleNightMode(force) {
    state.nightMode = typeof force === 'boolean' ? force : !state.nightMode;
    applyNightModeAndDelay();
    syncNightModeUI();
    savePreferences();
    showToast(state.nightMode ? 'Night Mode (DRC) Enabled' : 'Night Mode (DRC) Disabled');
  }

  function syncNightModeUI() {
    if (el.swNightMode) el.swNightMode.classList.toggle('on', state.nightMode);
    if (el.btnBottomNight) el.btnBottomNight.classList.toggle('active', state.nightMode);
  }

  function adjustAudioDelay(deltaMs) {
    if (deltaMs === 0) {
      state.audioDelayMs = 0;
    } else {
      state.audioDelayMs = Math.max(-500, Math.min(500, state.audioDelayMs + deltaMs));
    }
    applyNightModeAndDelay();
    if (el.lblAudioDelay) {
      el.lblAudioDelay.textContent = `${state.audioDelayMs > 0 ? '+' : ''}${state.audioDelayMs} ms`;
    }
    savePreferences();
    showToast(`Audio Delay: ${state.audioDelayMs > 0 ? '+' : ''}${state.audioDelayMs} ms`);
  }

  function applySeekbarThumbStyle(style, persist = true) {
    const valid = ['cone', 'paw', 'pill'].includes(style) ? style : 'pill';
    state.seekbarThumbStyle = valid;
    el.seekbarThumb.classList.remove('thumb-cone', 'thumb-paw', 'thumb-pill');
    el.seekbarThumb.classList.add(`thumb-${valid}`);

    if (valid === 'cone') {
      el.seekbarThumb.innerHTML = ICONS.cone || '';
    } else if (valid === 'paw') {
      el.seekbarThumb.innerHTML = ICONS.catPaw || '';
    } else {
      el.seekbarThumb.innerHTML = '';
    }

    if (el.btnThumbCone) el.btnThumbCone.classList.toggle('active', valid === 'cone');
    if (el.btnThumbPaw) el.btnThumbPaw.classList.toggle('active', valid === 'paw');
    if (el.btnThumbPill) el.btnThumbPill.classList.toggle('active', valid === 'pill');

    if (persist) savePreferences();
  }

  function applySubtitleAppearance(persist = true) {
    if (!el.subtitleOverlay) return;
    el.subtitleOverlay.style.fontFamily = state.subFont || "'Segoe UI Variable Text', system-ui, sans-serif";
    el.subtitleOverlay.style.color = state.subColor || '#FFFFFF';

    el.subtitleOverlay.classList.remove('style-shadow', 'style-box-translucent', 'style-box-solid');
    el.subtitleOverlay.classList.add(`style-${state.subBgStyle || 'shadow'}`);

    if (el.selSubFont) el.selSubFont.value = state.subFont;
    if (el.selSubBg) el.selSubBg.value = state.subBgStyle;
    if (el.subColorSwatches) {
      el.subColorSwatches.querySelectorAll('.sub-color-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.color === state.subColor);
      });
    }

    if (persist) savePreferences();
  }

  function toggleGhostMode(force) {
    state.isGhostMode = typeof force === 'boolean' ? force : !state.isGhostMode;
    const targetOpacity = state.isGhostMode ? Math.max(30, Math.min(95, state.ghostOpacity)) / 100 : 1.0;
    if (api && api.setWindowOpacity) {
      api.setWindowOpacity(targetOpacity);
    }
    if (el.app) {
      el.app.classList.toggle('ghost-active', state.isGhostMode);
    }
    if (el.swGhostMode) {
      el.swGhostMode.classList.toggle('on', state.isGhostMode);
    }
    showToast(state.isGhostMode ? `Ghost Mode: ${Math.round(targetOpacity * 100)}% Opacity` : 'Ghost Mode: Disabled');
  }

  function setGhostOpacity(pct, persist = true) {
    const clamped = Math.max(30, Math.min(95, Math.round(pct)));
    state.ghostOpacity = clamped;
    if (el.lblGhostOpacity) el.lblGhostOpacity.textContent = `${clamped}%`;
    if (el.rngGhostOpacity) el.rngGhostOpacity.value = String(clamped);
    if (state.isGhostMode && api && api.setWindowOpacity) {
      api.setWindowOpacity(clamped / 100);
    }
    if (persist) savePreferences();
  }

  function syncBottomBarIconsUI(persist = true) {
    const b = state.bottomBarIcons;
    if (el.btnBottomStepBack) el.btnBottomStepBack.style.display = b.step ? 'inline-flex' : 'none';
    if (el.btnBottomStepFwd) el.btnBottomStepFwd.style.display = b.step ? 'inline-flex' : 'none';
    if (el.btnBottomShuffle) el.btnBottomShuffle.style.display = b.shuffle ? 'inline-flex' : 'none';
    if (el.btnBottomRepeat) el.btnBottomRepeat.style.display = b.repeat ? 'inline-flex' : 'none';
    if (el.btnBottomAb) el.btnBottomAb.style.display = b.ab ? 'inline-flex' : 'none';
    if (el.btnBottomNight) el.btnBottomNight.style.display = b.night ? 'inline-flex' : 'none';
    if (el.btnBottomSnapshot) el.btnBottomSnapshot.style.display = b.snapshot ? 'inline-flex' : 'none';

    if (el.chkBarStep) el.chkBarStep.checked = Boolean(b.step);
    if (el.chkBarShuffle) el.chkBarShuffle.checked = Boolean(b.shuffle);
    if (el.chkBarRepeat) el.chkBarRepeat.checked = Boolean(b.repeat);
    if (el.chkBarAb) el.chkBarAb.checked = Boolean(b.ab);
    if (el.chkBarNight) el.chkBarNight.checked = Boolean(b.night);
    if (el.chkBarSnapshot) el.chkBarSnapshot.checked = Boolean(b.snapshot);

    if (persist) savePreferences();
  }

  function syncSpeedChipsUI(persist = true) {
    if (el.quickSpeedChipsWrap) {
      el.quickSpeedChipsWrap.querySelectorAll('.speed-chip').forEach((chip) => {
        const sp = chip.dataset.speed;
        const visible = state.speedChipsVisible.includes(sp);
        chip.style.display = visible ? 'inline-flex' : 'none';
      });
    }
    document.querySelectorAll('.chk-speed-chip').forEach((chk) => {
      chk.checked = state.speedChipsVisible.includes(chk.dataset.speed);
    });
    if (persist) savePreferences();
  }

  function addCurrentToHistory(item) {
    if (!item || !item.filePath) return;
    state.history = state.history.filter((h) => h.filePath !== item.filePath);
    state.history.unshift({
      filePath: item.filePath,
      name: item.name || '',
      title: item.title || item.name || 'Untitled',
      duration: getDuration() || item.duration || 0,
      lastPlayedAt: Date.now()
    });
    if (state.history.length > 30) {
      state.history = state.history.slice(0, 30);
    }
    syncHistoryBadge();
    if (state.drawerTab === 'history') {
      renderRightDrawer();
    }
    savePreferences();
  }

  function syncHistoryBadge() {
    if (el.tabDrawerHistory) {
      el.tabDrawerHistory.textContent = `History (${state.history ? state.history.length : 0})`;
    }
  }

  function updateTransportUI() {
    state.playing = !el.video.paused && !el.video.ended && Boolean(getCurrentItem());
    el.btnPlay.innerHTML = state.playing ? ICONS.pause : ICONS.play;
    el.btnPlay.classList.toggle('is-playing', state.playing);
    updateChromeSolidity();
  }

  let lastElapsedStr = '';
  let lastTotalStr = '';

  function updateTimelineUI() {
    const cur = getCurrentTime();
    const dur = getDuration();
    const forceHrs = dur >= 3600;

    // Check A-B repeat loop
    if (state.abLoop.active && state.abLoop.a !== null && state.abLoop.b !== null) {
      if (cur >= state.abLoop.b) {
        seekToSeconds(state.abLoop.a, true);
        return;
      }
    }

    const elapsedStr = formatTime(cur, forceHrs);
    if (elapsedStr !== lastElapsedStr) {
      el.timeElapsed.textContent = elapsedStr;
      lastElapsedStr = elapsedStr;
    }
    if (!Number.isFinite(dur) || dur <= 0) {
      if (lastTotalStr !== '00:00') {
        el.timeTotal.textContent = '00:00';
        lastTotalStr = '00:00';
      }
      el.seekbarFill.style.width = '0%';
      el.seekbarThumb.style.left = '0%';
      if (state.abLoop.active || state.abLoop.a !== null) renderAbLoopUI();
      return;
    }

    const totalStr = state.showRemainingTime
      ? `-${formatTime(Math.max(0, dur - cur), forceHrs)}`
      : formatTime(dur, forceHrs);
    if (totalStr !== lastTotalStr) {
      el.timeTotal.textContent = totalStr;
      lastTotalStr = totalStr;
    }

    const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
    el.seekbarFill.style.width = `${pct}%`;
    el.seekbarThumb.style.left = `${pct}%`;
    if (state.abLoop.active || state.abLoop.a !== null) renderAbLoopUI();
    updateActiveSubtitleCue();
    checkSegmentSkipping(cur, dur);
    checkUpNextCountdown(cur, dur);

    // Automatically mark as watched if played >= 90% in Queue mode
    if (state.playbackSource === 'queue' && state.currentItem && state.currentItem.filePath && dur >= 15) {
      if (cur / dur >= 0.90) {
        markQueueItemWatched(state.currentItem.filePath);
      }
    }
  }

  // ==================== ENCODED CHAPTER DETECTION & SEGMENT SKIPPING ====================
  function classifySegments(chapters = [], duration = 0) {
    const segments = [];
    const dur = duration > 0 ? duration : getDuration();

    // Only imply skipping when chapters are encoded in the file
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return segments;
    }

    const opRegex = /(^|\b|_)(op|opening|intro|theme)(\b|_|\d|$)/i;
    const edRegex = /(^|\b|_)(ed|ending|outro|credits?|closing)(\b|_|\d|$)/i;
    const postCreditsRegex = /(^|\b|_)(preview|after[- _]?credits?|post[- _]?credits?|stinger|epilogue|next\s*episode|omake)(\b|_|\d|$)/i;
    const genericChapterRegex = /^chapter\s*\d+$/i;

    let foundOp = false;
    let foundEd = false;

    // 1. Explicit chapter title matching
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const title = (ch.title || '').trim();

      if (!foundOp && !postCreditsRegex.test(title) && opRegex.test(title)) {
        foundOp = true;
        segments.push({
          id: `op_${i}`,
          index: i,
          type: 'opening',
          label: title || 'Opening',
          start: ch.start,
          end: ch.end,
          skipTarget: ch.end,
          hasAfterCredits: false
        });
        continue;
      }

      if (!foundEd && !postCreditsRegex.test(title) && edRegex.test(title)) {
        foundEd = true;
        const nextCh = chapters[i + 1];
        let hasAfter = false;
        let target = ch.end;

        if (nextCh && (dur <= 0 || nextCh.start < dur - 4)) {
          const nextTitle = nextCh.title || '';
          const isNextPostCredits = postCreditsRegex.test(nextTitle);
          if (isNextPostCredits || !edRegex.test(nextTitle)) {
            hasAfter = true;
            target = nextCh.start;
          }
        }

        segments.push({
          id: `ed_${i}`,
          index: i,
          type: title.toLowerCase().includes('credit') ? 'credits' : 'ending',
          label: title || 'Ending',
          start: ch.start,
          end: ch.end,
          skipTarget: target,
          hasAfterCredits: hasAfter
        });
        continue;
      }
    }

    // 2. Generic anime chapter patterns (e.g. Chapter 1, Chapter 2... where OP/ED are standard ~90s)
    if (!foundOp || !foundEd) {
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const title = (ch.title || '').trim();
        const isGeneric = !title || genericChapterRegex.test(title);
        const chDur = ch.end - ch.start;

        if (!foundOp && isGeneric && chDur >= 75 && chDur <= 105 && ch.start <= 360) {
          foundOp = true;
          segments.push({
            id: `op_gen_${i}`,
            index: i,
            type: 'opening',
            label: 'Opening',
            start: ch.start,
            end: ch.end,
            skipTarget: ch.end,
            hasAfterCredits: false
          });
        }

        if (!foundEd && isGeneric && chDur >= 75 && chDur <= 105 && dur > 600 && ch.start >= dur - 420) {
          foundEd = true;
          const nextCh = chapters[i + 1];
          let hasAfter = false;
          let target = ch.end;
          if (nextCh && nextCh.start < dur - 4) {
            hasAfter = true;
            target = nextCh.start;
          }
          segments.push({
            id: `ed_gen_${i}`,
            index: i,
            type: 'ending',
            label: 'Ending',
            start: ch.start,
            end: ch.end,
            skipTarget: target,
            hasAfterCredits: hasAfter
          });
        }
      }
    }

    segments.sort((a, b) => a.start - b.start);
    return segments;
  }

  function renderChapterMarkersOnSeekbar() {
    if (!el.seekbarChapters) return;
    el.seekbarChapters.innerHTML = '';
    const dur = getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;

    const frag = document.createDocumentFragment();

    // Render chapters if present
    if (state.currentChapters && state.currentChapters.length > 1) {
      state.currentChapters.forEach((ch, idx) => {
        if (idx === 0 && ch.start === 0) return;
        const pct = Math.max(0, Math.min(100, (ch.start / dur) * 100));
        const tick = document.createElement('div');
        tick.className = 'seekbar-chapter-tick';
        tick.style.left = `${pct}%`;
        tick.title = `${ch.title ? ch.title + ' — ' : ''}${formatTime(ch.start, dur >= 3600)}`;
        frag.appendChild(tick);
      });
    }

    // Render segment highlight zones
    if (state.currentSegments && state.currentSegments.length > 0) {
      state.currentSegments.forEach((seg) => {
        const leftPct = Math.max(0, Math.min(100, (seg.start / dur) * 100));
        const widthPct = Math.max(0.5, Math.min(100 - leftPct, ((seg.end - seg.start) / dur) * 100));
        const zone = document.createElement('div');
        zone.className = `seekbar-segment-zone seg-${seg.type}`;
        zone.style.left = `${leftPct}%`;
        zone.style.width = `${widthPct}%`;
        zone.title = `${seg.label}: ${formatTime(seg.start, dur >= 3600)} - ${formatTime(seg.end, dur >= 3600)}`;
        frag.appendChild(zone);
      });
    }

    el.seekbarChapters.appendChild(frag);
  }

  function checkSegmentSkipping(cur, dur) {
    if (!state.currentSegments || state.currentSegments.length === 0 || dur <= 0) {
      hideSkipSegmentPrompt();
      return;
    }

    const activeSeg = state.currentSegments.find(
      (s) => cur >= s.start && cur < (s.end - 0.25)
    );

    if (!activeSeg) {
      hideSkipSegmentPrompt();
      return;
    }

    // If this exact segment was already skipped in this playback run, do not re-trigger
    if (state.lastSkippedSegmentId === activeSeg.id) {
      return;
    }

    if (state.skipMode === 'never') {
      hideSkipSegmentPrompt();
      return;
    }

    if (state.skipMode === 'skip_all') {
      state.lastSkippedSegmentId = activeSeg.id;
      hideSkipSegmentPrompt();
      if (activeSeg.skipTarget >= dur - 1 && !activeSeg.hasAfterCredits) {
        if (state.stopAfterCurrent) {
          state.stopAfterCurrent = false;
          pauseMedia();
          seekToSeconds(dur, false);
          showToast('Playback stopped (Stop After Episode)');
          updateTransportUI();
          pushPlayerStatus();
        } else {
          playNext();
        }
      } else {
        seekToSeconds(activeSeg.skipTarget, true);
        showToast(activeSeg.hasAfterCredits ? 'Jumped to After-Credits Scene' : `Auto-Skipped ${activeSeg.label}`);
      }
      return;
    }

    if (state.skipMode === 'skip_ending') {
      if (activeSeg.type === 'ending' || activeSeg.type === 'credits') {
        state.lastSkippedSegmentId = activeSeg.id;
        hideSkipSegmentPrompt();
        if (activeSeg.skipTarget >= dur - 1 && !activeSeg.hasAfterCredits) {
          if (state.stopAfterCurrent) {
            state.stopAfterCurrent = false;
            pauseMedia();
            seekToSeconds(dur, false);
            showToast('Playback stopped (Stop After Episode)');
            updateTransportUI();
            pushPlayerStatus();
          } else {
            playNext();
          }
        } else {
          seekToSeconds(activeSeg.skipTarget, true);
          showToast(activeSeg.hasAfterCredits ? 'Jumped to After-Credits Scene' : `Auto-Skipped ${activeSeg.label}`);
        }
        return;
      } else if (activeSeg.type === 'opening') {
        showSkipSegmentPrompt(activeSeg, cur, dur);
        return;
      }
    }

    if (state.skipMode === 'prompt') {
      showSkipSegmentPrompt(activeSeg, cur, dur);
    }
  }

  let isSkipPromptVisible = false;

  function showSkipSegmentPrompt(seg, cur = getCurrentTime(), dur = getDuration()) {
    state.activeSkipSegment = seg;
    if (!el.btnSkipSegment) return;

    if (seg.hasAfterCredits) {
      el.skipSegmentLabel.textContent = 'Jump to After-Credits';
    } else if (seg.type === 'opening') {
      el.skipSegmentLabel.textContent = 'Skip Opening';
    } else if (seg.type === 'ending') {
      el.skipSegmentLabel.textContent = 'Skip Ending';
    } else if (seg.type === 'credits') {
      el.skipSegmentLabel.textContent = 'Skip Credits';
    } else {
      el.skipSegmentLabel.textContent = `Skip ${seg.label || 'Segment'}`;
    }
    if (!isSkipPromptVisible) {
      el.btnSkipSegment.classList.remove('hidden');
      isSkipPromptVisible = true;
    }
  }

  function hideSkipSegmentPrompt() {
    if (!isSkipPromptVisible && state.activeSkipSegment === null) return;
    state.activeSkipSegment = null;
    isSkipPromptVisible = false;
    if (el.btnSkipSegment) {
      el.btnSkipSegment.classList.add('hidden');
    }
  }

  function triggerCurrentSegmentSkip() {
    if (!state.activeSkipSegment) return;
    const seg = state.activeSkipSegment;
    const cur = getCurrentTime();
    const dur = getDuration();
    state.lastSkippedSegmentId = seg.id;
    hideSkipSegmentPrompt();

    const target = seg.skipTarget;
    if (state.playbackSource === 'queue' && state.currentItem && state.currentItem.filePath) {
      if (seg.type === 'ending' || seg.type === 'credits' || target >= dur - 1) {
        markQueueItemWatched(state.currentItem.filePath);
      }
    }
    if (target >= dur - 1 && !seg.hasAfterCredits) {
      if (state.stopAfterCurrent) {
        state.stopAfterCurrent = false;
        pauseMedia();
        seekToSeconds(dur, false);
        showToast('Playback stopped (Stop After Episode)');
        updateTransportUI();
        pushPlayerStatus();
      } else {
        playNext();
      }
    } else {
      seekToSeconds(target, true);
      if (seg.hasAfterCredits) {
        showToast('Jumped to After-Credits Scene');
      } else if (seg.type === 'opening') {
        showToast('Skipped Opening');
      } else if (seg.type === 'ending') {
        showToast('Skipped Ending');
      } else {
        showToast(`Skipped ${seg.label || 'Segment'}`);
      }
    }
  }

  function checkUpNextCountdown(cur, dur) {
    if (dur <= 5.0 || state.stopAfterCurrent) {
      hideUpNextBanner();
      return;
    }
    const rem = dur - cur;
    const nextItem = getNextMediaItem();

    if (rem > 5.5) {
      if (state.upNextDismissed) {
        state.upNextDismissed = false;
      }
      hideUpNextBanner();
      return;
    }

    if (rem <= 5.0 && rem > 0.1 && nextItem && !state.upNextDismissed) {
      showUpNextBanner(nextItem, rem);
    } else {
      hideUpNextBanner();
    }
  }

  let isUpNextVisible = false;

  function showUpNextBanner(nextItem, remainingSec) {
    if (!el.upNextBanner) return;
    const title = nextItem.title || nextItem.name || (nextItem.filePath ? nextItem.filePath.split(/[\\/]/).pop() : 'Next File');
    if (el.upNextTitle) el.upNextTitle.textContent = title;
    const count = Math.max(1, Math.ceil(remainingSec));
    if (el.upNextCountdownNum) el.upNextCountdownNum.textContent = String(count);
    const progressRatio = Math.max(0, Math.min(1, (5.0 - remainingSec) / 5.0));
    if (el.upNextProgressFill) {
      el.upNextProgressFill.style.width = `${progressRatio * 100}%`;
    }
    if (!isUpNextVisible) {
      el.upNextBanner.classList.remove('hidden');
      isUpNextVisible = true;
    }
  }

  function hideUpNextBanner() {
    if (!isUpNextVisible) return;
    isUpNextVisible = false;
    if (el.upNextBanner) {
      el.upNextBanner.classList.add('hidden');
    }
  }

  // ==================== STOP AFTER CURRENT & SLEEP TIMER ====================
  function toggleStopAfterCurrent(forceState) {
    state.stopAfterCurrent = typeof forceState === 'boolean' ? forceState : !state.stopAfterCurrent;
    showToast(state.stopAfterCurrent ? 'Stop After Episode: ON' : 'Stop After Episode: OFF');
    pushPlayerStatus();
  }

  function setSleepTimer(minutes) {
    if (state.sleepTimer && state.sleepTimer.timerId) {
      clearTimeout(state.sleepTimer.timerId);
    }
    if (state.sleepTimer && state.sleepTimer.intervalId) {
      clearInterval(state.sleepTimer.intervalId);
    }
    const mins = parseInt(minutes, 10) || 0;
    if (mins <= 0) {
      state.sleepTimer = { minutes: 0, targetTime: 0, timerId: null, intervalId: null };
      if (el.sleepTimerDesc) {
        el.sleepTimerDesc.textContent = 'Automatically pause playback after a set duration';
      }
      if (el.selSleepTimer) {
        el.selSleepTimer.value = '0';
      }
      showToast('Sleep Timer: Off');
      pushPlayerStatus();
      return;
    }

    const targetTime = Date.now() + mins * 60 * 1000;
    const updateDesc = () => {
      const remainingSec = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
      const remainingMin = Math.ceil(remainingSec / 60);
      if (el.sleepTimerDesc) {
        if (remainingSec > 60) {
          el.sleepTimerDesc.textContent = `Active: ~${remainingMin} min remaining`;
        } else if (remainingSec > 0) {
          el.sleepTimerDesc.textContent = `Active: ${remainingSec}s remaining`;
        } else {
          el.sleepTimerDesc.textContent = 'Automatically pause playback after a set duration';
        }
      }
    };

    updateDesc();
    const intervalId = setInterval(updateDesc, 1000);
    const timerId = setTimeout(() => {
      if (state.sleepTimer && state.sleepTimer.intervalId) {
        clearInterval(state.sleepTimer.intervalId);
      }
      state.sleepTimer = { minutes: 0, targetTime: 0, timerId: null, intervalId: null };
      if (el.selSleepTimer) el.selSleepTimer.value = '0';
      if (el.sleepTimerDesc) el.sleepTimerDesc.textContent = 'Automatically pause playback after a set duration';
      pauseMedia();
      showToast('Sleep Timer: Playback Paused');
      pushPlayerStatus();
    }, mins * 60 * 1000);

    state.sleepTimer = { minutes: mins, targetTime, timerId, intervalId };
    if (el.selSleepTimer) el.selSleepTimer.value = String(mins);
    showToast(`Sleep Timer: ${mins}m`);
    pushPlayerStatus();
  }

  function triggerBossKey() {
    pauseMedia();
    state.muted = true;
    applyVolumeToEngine();
    updateTransportUI();
    savePreferences();
    pushPlayerStatus();
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (state.isFullscreen) {
      api.toggleFullscreen().catch(() => {});
    }
    if (api && api.minimize) {
      api.minimize();
    }
    showToast('Boss Key: Muted & Minimized');
  }

  // ==================== AUDIO WAVEFORM VISUALIZER ====================
  function updateVisualizerVisibility() {
    const item = getCurrentItem();
    const shouldShow = Boolean(item && (item.isAudio || state.visualizerEnabled));
    el.visualizerCanvas.classList.toggle('visible', shouldShow);
    syncPopoverButtonsActive();

    if (shouldShow && !el.video.paused && !document.hidden && !visualizerRaf) {
      drawVisualizerLoop();
    } else if ((!shouldShow || el.video.paused || document.hidden) && visualizerRaf) {
      cancelAnimationFrame(visualizerRaf);
      visualizerRaf = null;
    }
  }

  function checkResumeVisualizer() {
    const canvas = el.visualizerCanvas;
    if (canvas && canvas.classList.contains('visible') && !el.video.paused && !document.hidden && !visualizerRaf) {
      drawVisualizerLoop();
    }
  }

  let visCtx = null;
  let cachedVisWaveData = null;
  let cachedVisFreqData = null;

  function drawVisualizerLoop() {
    const canvas = el.visualizerCanvas;
    if (!canvas.classList.contains('visible') || el.video.paused || document.hidden) {
      visualizerRaf = null;
      return;
    }
    const cw = canvas.clientWidth || 300;
    const ch = canvas.clientHeight || 150;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    if (!visCtx) {
      visCtx = canvas.getContext('2d');
    }
    const ctx = visCtx;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (analyserNode) {
      const accentRgb = cachedAccentRgb || '224, 122, 22';

      if (state.visualizerStyle === 'waveform') {
        const bufferLength = analyserNode.fftSize;
        if (!cachedVisWaveData || cachedVisWaveData.length !== bufferLength) {
          cachedVisWaveData = new Uint8Array(bufferLength);
        }
        analyserNode.getByteTimeDomainData(cachedVisWaveData);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgb(${accentRgb})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${accentRgb}, 0.75)`;
        ctx.beginPath();

        const sliceWidth = w / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = cachedVisWaveData[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (state.visualizerStyle === 'aura') {
        const bins = analyserNode.frequencyBinCount;
        if (!cachedVisFreqData || cachedVisFreqData.length !== bins) {
          cachedVisFreqData = new Uint8Array(bins);
        }
        analyserNode.getByteFrequencyData(cachedVisFreqData);

        let sum = 0;
        for (let i = 0; i < bins; i++) sum += cachedVisFreqData[i];
        const avg = sum / (bins || 1) / 255;

        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = Math.min(w, h) * 0.16;
        const pulseRadius = baseRadius + avg * (Math.min(w, h) * 0.22);

        const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, pulseRadius * 1.3);
        grad.addColorStop(0, `rgba(${accentRgb}, ${0.55 + avg * 0.4})`);
        grad.addColorStop(0.5, `rgba(${accentRgb}, ${0.25 + avg * 0.3})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius * 1.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 3.5;
        ctx.strokeStyle = `rgba(${accentRgb}, 0.9)`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = `rgba(${accentRgb}, 0.95)`;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        const bins = analyserNode.frequencyBinCount;
        if (!cachedVisFreqData || cachedVisFreqData.length !== bins) {
          cachedVisFreqData = new Uint8Array(bins);
        }
        analyserNode.getByteFrequencyData(cachedVisFreqData);

        const barCount = 42;
        const gap = 5;
        const totalWidth = Math.min(w * 0.72, 620);
        const barW = Math.max(3, (totalWidth - gap * (barCount - 1)) / barCount);
        const startX = (w - (barW * barCount + gap * (barCount - 1))) / 2;
        const centerY = h / 2;

        for (let i = 0; i < barCount; i++) {
          const val = cachedVisFreqData[i % bins] / 255;
          const barH = Math.max(4, val * (h * 0.44));
          const x = startX + i * (barW + gap);
          ctx.fillStyle = `rgba(${accentRgb}, ${0.32 + val * 0.65})`;
          ctx.beginPath();
          ctx.roundRect(x, centerY - barH / 2, barW, barH, 3);
          ctx.fill();
        }
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
  let bottomPopoverIdleTimer = null;

  function syncPopoverButtonsActive() {
    const popOpen = el.bottomPopover.classList.contains('open');
    const activeTab = document.querySelector('.pop-tab.active')?.dataset?.popTab || '';
    el.btnAudioPop.classList.toggle(
      'active',
      (popOpen && activeTab === 'audio') || state.visualizerEnabled || state.eqPreset !== 'flat'
    );
    el.btnSubPop.classList.toggle(
      'active',
      (popOpen && activeTab === 'subtitles') || (state.subEnabled && state.subCues.length > 0)
    );
    el.btnGearPop.classList.toggle(
      'active',
      popOpen && (activeTab === 'playback' || activeTab === 'video')
    );
  }

  function closeBottomPopover({ refreshLayout = false } = {}) {
    clearTimeout(bottomPopoverIdleTimer);
    bottomPopoverIdleTimer = null;
    const wasOpen = el.bottomPopover.classList.contains('open');
    el.bottomPopover.classList.remove('open');
    state.hoveringBottomPopover = false;
    state.interactingBottomPopover = false;
    state.bottomPopoverSelectOpen = false;
    syncPopoverButtonsActive();
    if (wasOpen) {
      if (refreshLayout) {
        finishSidebarAutoCollapse();
      } else {
        updateChromeSolidity();
      }
    }
  }

  function updateChromeSolidity() {
    const hasMedia = Boolean(getCurrentItem());
    el.app.classList.toggle('has-media', hasMedia);
    el.app.classList.toggle('is-maximized', Boolean(state.isMaximized));
    el.app.classList.toggle('is-fullscreen', Boolean(state.isFullscreen));

    const leftSidebarOpen = !el.librarySidebar.classList.contains('collapsed');
    const rightQueueOpen = !el.rightDrawer.classList.contains('collapsed');
    const topMenuOpen = el.headerMenu.classList.contains('open');
    const settingsOpen = el.settingsBackdrop.classList.contains('open');

    // Translucent during playback in windowed mode; solid when maximized, on top/sidebars/queue, or no media
    const shouldBeSolid =
      !hasMedia ||
      Boolean(state.isMaximized) ||
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
    clearTimeout(bottomPopoverIdleTimer);

    const leftOpen = !el.librarySidebar.classList.contains('collapsed');
    const rightOpen = !el.rightDrawer.classList.contains('collapsed');
    const popOpen = el.bottomPopover.classList.contains('open');
    const searchFocused = document.activeElement === el.libSearchInput;

    // Auto-collapse open left library sidebar if mouse doesn't hover over it (5s while playing, 3.2s if edge-opened while paused/idle)
    if (
      leftOpen &&
      (state.playing || state.leftOpenedByEdge) &&
      !state.hoveringLeftSidebar &&
      !searchFocused &&
      !state.dialogOpen
    ) {
      const delayMs = state.playing ? 5000 : 3200;
      leftSidebarIdleTimer = setTimeout(() => {
        if (
          !el.librarySidebar.classList.contains('collapsed') &&
          (state.playing || state.leftOpenedByEdge) &&
          !state.hoveringLeftSidebar &&
          document.activeElement !== el.libSearchInput &&
          !state.dialogOpen
        ) {
          el.librarySidebar.classList.add('collapsed');
          el.btnSidebar.classList.remove('active');
          state.leftOpenedByEdge = false;
          state.leftEdgeCooldownUntil = Date.now() + 450;
          finishSidebarAutoCollapse();
        }
      }, delayMs);
    }

    // Auto-collapse open right queue/bookmarks drawer if mouse doesn't hover over it (5s while playing, 3.2s if edge-opened while paused/idle)
    if (
      rightOpen &&
      (state.playing || state.rightOpenedByEdge) &&
      !state.hoveringRightDrawer &&
      !state.draggingQueueItem &&
      !state.externalFileDragActive &&
      !state.dialogOpen
    ) {
      const delayMs = state.playing ? 5000 : 3200;
      rightDrawerIdleTimer = setTimeout(() => {
        if (
          !el.rightDrawer.classList.contains('collapsed') &&
          (state.playing || state.rightOpenedByEdge) &&
          !state.hoveringRightDrawer &&
          !state.draggingQueueItem &&
          !state.externalFileDragActive &&
          !state.dialogOpen
        ) {
          el.rightDrawer.classList.add('collapsed');
          el.btnQueueDrawer.classList.remove('active');
          state.rightOpenedByEdge = false;
          state.rightEdgeCooldownUntil = Date.now() + 450;
          finishSidebarAutoCollapse();
        }
      }, delayMs);
    }

    // Auto-close bottom popover (Audio & Equalizer, Subtitles & Sync, Playback & Video) after 5s when unhovered & uninteracted
    if (
      popOpen &&
      !state.hoveringBottomPopover &&
      !state.interactingBottomPopover &&
      !state.bottomPopoverSelectOpen &&
      !state.dialogOpen
    ) {
      bottomPopoverIdleTimer = setTimeout(() => {
        if (
          el.bottomPopover.classList.contains('open') &&
          !state.hoveringBottomPopover &&
          !state.interactingBottomPopover &&
          !state.bottomPopoverSelectOpen &&
          !state.dialogOpen
        ) {
          closeBottomPopover({ refreshLayout: true });
        }
      }, 5000);
    }
  }

  function openPopoverTab(tabName) {
    el.headerMenu.classList.remove('open');
    const activeTab = document.querySelector('.pop-tab.active')?.dataset?.popTab || '';
    const isAlreadyOpenOnSame =
      el.bottomPopover.classList.contains('open') &&
      (activeTab === tabName || (tabName === 'playback' && activeTab === 'video'));

    if (isAlreadyOpenOnSame) {
      closeBottomPopover();
      return;
    }

    document.querySelectorAll('.pop-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.popTab === tabName);
    });
    document.querySelectorAll('.pop-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.popPanel === tabName);
    });
    el.bottomPopover.classList.add('open');
    syncPopoverButtonsActive();
    updateChromeSolidity();
    resetFullscreenIdle();
  }

  // ==================== KEYBOARD SHORTCUTS & TUNING ENGINE ====================
  let recordingState = null; // { actionId, index }

  function normalizeKeyCombo(e) {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return null;
    }
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    parts.push(e.code);
    return parts.join('+');
  }

  function formatKeyCombo(combo) {
    if (!combo) return '';
    return combo
      .replace(/Key([A-Z0-9])/g, '$1')
      .replace(/Digit([0-9])/g, '$1')
      .replace(/ArrowLeft/g, 'Left')
      .replace(/ArrowRight/g, 'Right')
      .replace(/ArrowUp/g, 'Up')
      .replace(/ArrowDown/g, 'Down')
      .replace(/BracketLeft/g, '[')
      .replace(/BracketRight/g, ']')
      .replace(/Backslash/g, '\\')
      .replace(/Slash/g, '/')
      .replace(/Period/g, '.')
      .replace(/Comma/g, ',')
      .replace(/Semicolon/g, ';')
      .replace(/Quote/g, "'")
      .replace(/Minus/g, '-')
      .replace(/Equal/g, '=');
  }

  function syncHotkeyInputsUI() {
    if (!state.hotkeySettings) state.hotkeySettings = { ...DEFAULT_HOTKEY_SETTINGS };
    if (el.inpTuneVol) el.inpTuneVol.value = state.hotkeySettings.volumeStep;
    if (el.inpTuneSeekSmall) el.inpTuneSeekSmall.value = state.hotkeySettings.seekSmallSec;
    if (el.inpTuneSeekLarge) el.inpTuneSeekLarge.value = state.hotkeySettings.seekLargeSec;
    if (el.inpTuneSpeed) el.inpTuneSpeed.value = Number(state.hotkeySettings.speedStep).toFixed(2);
  }

  function renderHotkeysTable() {
    if (!el.hotkeysTableContainer) return;
    el.hotkeysTableContainer.innerHTML = '';

    if (!state.keybindings) {
      state.keybindings = cloneDefaultKeybindings();
    }

    ACTION_DEFINITIONS.forEach((def) => {
      const row = document.createElement('div');
      row.className = 'hotkey-row';

      const labelWrap = document.createElement('div');
      labelWrap.className = 'hotkey-label';

      const catBadge = document.createElement('span');
      catBadge.className = 'hotkey-cat-badge';
      catBadge.textContent = def.category;

      const titleSpan = document.createElement('span');
      titleSpan.textContent = def.label;

      labelWrap.appendChild(catBadge);
      labelWrap.appendChild(titleSpan);

      const badgeList = document.createElement('div');
      badgeList.className = 'hotkey-badge-list';

      const keys = state.keybindings[def.id] || [];

      keys.forEach((keyCombo, idx) => {
        const badgeWrap = document.createElement('div');
        badgeWrap.style.display = 'inline-flex';
        badgeWrap.style.alignItems = 'center';

        const badge = document.createElement('span');
        badge.className = 'hotkey-badge';
        const isThisRecording = recordingState && recordingState.actionId === def.id && recordingState.index === idx;
        if (isThisRecording) {
          badge.classList.add('recording');
          badge.textContent = 'Press key...';
        } else {
          badge.textContent = formatKeyCombo(keyCombo);
        }

        badge.title = 'Click to record a new key combination';
        badge.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (recordingState && recordingState.actionId === def.id && recordingState.index === idx) {
            recordingState = null;
          } else {
            recordingState = { actionId: def.id, index: idx };
          }
          renderHotkeysTable();
        });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'hotkey-clear-btn';
        clearBtn.title = 'Remove shortcut';
        clearBtn.innerHTML = '&#215;';
        clearBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          state.keybindings[def.id].splice(idx, 1);
          if (recordingState && recordingState.actionId === def.id) {
            recordingState = null;
          }
          savePreferences();
          renderHotkeysTable();
        });

        badgeWrap.appendChild(badge);
        badgeWrap.appendChild(clearBtn);
        badgeList.appendChild(badgeWrap);
      });

      // If less than 2 shortcuts assigned, allow adding an alternate key
      if (keys.length < 2) {
        const isAdding = recordingState && recordingState.actionId === def.id && recordingState.index === keys.length;
        const addBadge = document.createElement('span');
        addBadge.className = 'hotkey-badge add-btn';
        if (isAdding) {
          addBadge.classList.add('recording');
          addBadge.textContent = 'Press key...';
        } else {
          addBadge.textContent = '+ Key';
        }
        addBadge.title = 'Click to add a keybind';
        addBadge.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (isAdding) {
            recordingState = null;
          } else {
            recordingState = { actionId: def.id, index: keys.length };
          }
          renderHotkeysTable();
        });
        badgeList.appendChild(addBadge);
      }

      row.appendChild(labelWrap);
      row.appendChild(badgeList);
      el.hotkeysTableContainer.appendChild(row);
    });
  }

  function executeHotkeyAction(actionId) {
    if (!state.hotkeySettings) state.hotkeySettings = { ...DEFAULT_HOTKEY_SETTINGS };
    switch (actionId) {
      case 'togglePlay':
        togglePlay();
        break;
      case 'toggleFullscreen':
        api.toggleFullscreen();
        break;
      case 'seekBackward':
        seekByDelta(-state.hotkeySettings.seekSmallSec);
        break;
      case 'seekForward':
        seekByDelta(state.hotkeySettings.seekSmallSec);
        break;
      case 'seekBackwardLarge':
        seekByDelta(-state.hotkeySettings.seekLargeSec);
        break;
      case 'seekForwardLarge':
        seekByDelta(state.hotkeySettings.seekLargeSec);
        break;
      case 'volumeUp':
        ensureAudioGraph();
        state.muted = false;
        state.volume = Math.min(200, state.volume + state.hotkeySettings.volumeStep);
        applyVolumeToEngine();
        savePreferences();
        showToast(`Volume: ${state.volume}%`);
        break;
      case 'volumeDown':
        ensureAudioGraph();
        state.muted = false;
        state.volume = Math.max(0, state.volume - state.hotkeySettings.volumeStep);
        applyVolumeToEngine();
        savePreferences();
        showToast(`Volume: ${state.volume}%`);
        break;
      case 'mute':
        el.btnMute.click();
        break;
      case 'speedDown':
        setSpeed(state.speed - state.hotkeySettings.speedStep, true);
        break;
      case 'speedUp':
        setSpeed(state.speed + state.hotkeySettings.speedStep, true);
        break;
      case 'speedReset':
        setSpeed(1.0, true);
        break;
      case 'nextTrack':
        playNext();
        break;
      case 'prevTrack':
        playPrev();
        break;
      case 'toggleSub':
        state.subEnabled = !state.subEnabled;
        if (el.swSubEnabled) el.swSubEnabled.classList.toggle('on', state.subEnabled);
        if (el.subtitleOverlay) el.subtitleOverlay.style.display = state.subEnabled ? 'block' : 'none';
        showToast(`Subtitles: ${state.subEnabled ? 'ON' : 'OFF'}`);
        break;
      case 'addBookmark':
        addBookmark();
        break;
      case 'snapshot':
        captureSnapshot();
        break;
      case 'openFile':
        openFileDialog(false);
        break;
      case 'openFolder':
        openFolderDialog();
        break;
      case 'queueFiles':
        enqueueFilesDialog();
        break;
      case 'toggleSettings':
        toggleSettingsModal();
        break;
      case 'toggleTheme': {
        const next = state.themeMode === 'dark' ? 'light' : 'dark';
        applyThemeMode(next, true);
        showToast(`Theme: ${next === 'dark' ? 'Dark Mode' : 'Light Mode'}`);
        break;
      }
      case 'stepFrameForward':
        stepFrame(1);
        break;
      case 'stepFrameBackward':
        stepFrame(-1);
        break;
      case 'toggleAbLoop':
        cycleAbLoop();
        break;
      case 'clearAbLoop':
        clearAbLoop();
        break;
      case 'cycleRepeat':
        cycleRepeatMode();
        break;
      case 'toggleShuffle':
        toggleShuffle();
        break;
      case 'toggleNightMode':
        toggleNightMode();
        break;
      case 'toggleGhostMode':
        toggleGhostMode();
        break;
      case 'snapshotClipboard':
        copySnapshotToClipboard();
        break;
      case 'skipIntroCredits':
        triggerCurrentSegmentSkip();
        break;
      case 'toggleStopAfterCurrent':
        toggleStopAfterCurrent();
        break;
      case 'bossKey':
        triggerBossKey();
        break;
    }
  }

  function toggleSettingsModal(forceOpen) {
    el.headerMenu.classList.remove('open');
    closeBottomPopover();
    const shouldOpen = typeof forceOpen === 'boolean'
      ? forceOpen
      : !el.settingsBackdrop.classList.contains('open');
    el.settingsBackdrop.classList.toggle('open', shouldOpen);
    if (shouldOpen) {
      syncHotkeyInputsUI();
      renderHotkeysTable();
    } else if (recordingState) {
      recordingState = null;
      renderHotkeysTable();
    }
    updateChromeSolidity();
  }

  function resetFullscreenIdle() {
    if (el.app.classList.contains('fs-idle')) {
      el.app.classList.remove('fs-idle');
    }
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
  function syncMediaSessionState() {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
        const dur = getDuration();
        const cur = getCurrentTime();
        if ('setPositionState' in navigator.mediaSession && Number.isFinite(dur) && dur > 0 && Number.isFinite(cur) && cur >= 0) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, dur),
            playbackRate: state.speed || 1,
            position: Math.min(Math.max(0, cur), dur)
          });
        }
      } catch {}
    }
  }

  function pushPlayerStatus() {
    syncMediaSessionState();
    const item = getCurrentItem();
    api.reportStatus({
      app: 'CopyCat media player',
      playing: state.playing,
      title: item?.title || null,
      filePath: item?.filePath || null,
      currentTime: Number(getCurrentTime().toFixed(2)),
      duration: Number(getDuration().toFixed(2)),
      volume: state.volume,
      muted: state.muted,
      speed: state.speed,
      accent: state.accentKey === 'custom' ? state.customAccentHex : state.accentKey,
      themeMode: state.themeMode,
      playbackSource: state.playbackSource || 'idle',
      queueLength: state.queue.length,
      queuedNextIndex: state.queuedNextIndex,
      stopAfterCurrent: Boolean(state.stopAfterCurrent),
      sleepTimerMinutes: state.sleepTimer?.minutes || 0,
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
      case 'toggleStopAfterCurrent':
        toggleStopAfterCurrent(cmd.enabled);
        break;
      case 'bossKey':
        triggerBossKey();
        break;
      case 'setSleepTimer':
        setSleepTimer(cmd.minutes);
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
        else if (typeof cmd.value === 'number') {
          const target = cmd.value;
          const trySeek = (attempts = 0) => {
            if (getDuration() > 0 || state.streamDuration > 0) {
              seekToSeconds(target, true);
              showToast(`AI Bridge: Seek → ${formatTime(target)}`);
            } else if (attempts < 15) {
              setTimeout(() => trySeek(attempts + 1), 200);
            }
          };
          trySeek();
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
          showToast(`AI Bridge: Accent → ${cmd.value}`);
        }
        break;
      case 'setTheme':
        if (cmd.value === 'light' || cmd.value === 'dark') {
          applyThemeMode(cmd.value, true);
          showToast(`AI Bridge: Theme → ${cmd.value}`);
        }
        break;
      case 'toggleTheme': {
        const next = state.themeMode === 'dark' ? 'light' : 'dark';
        applyThemeMode(next, true);
        showToast(`AI Bridge: Theme → ${next}`);
        break;
      }
      case 'toggleFullscreen':
        api.toggleFullscreen();
        break;
      case 'togglePip':
        togglePictureInPicture();
        break;
      case 'repeat':
        if (cmd.value === 'off' || cmd.value === 'all' || cmd.value === 'one') {
          state.repeatMode = cmd.value;
          syncRepeatUI();
          savePreferences();
          showToast(`AI Bridge: Repeat → ${state.repeatMode}`);
        } else {
          cycleRepeatMode();
        }
        break;
      case 'shuffle':
        toggleShuffle(cmd.value);
        break;
      case 'nightMode':
        toggleNightMode(cmd.value);
        break;
      case 'ghostMode':
        toggleGhostMode(cmd.value);
        break;
      case 'abLoop':
        if (cmd.action === 'a') setAbLoopPoint('A');
        else if (cmd.action === 'b') setAbLoopPoint('B');
        else if (cmd.action === 'clear') clearAbLoop();
        else cycleAbLoop();
        break;
      case 'step':
        stepFrame(typeof cmd.delta === 'number' ? cmd.delta : 1);
        break;
      case 'openFile':
        if (cmd.resolved) {
          ingestOpenedBundle({ items: [cmd.resolved.item], folder: cmd.resolved.folder }, true, { append: false });
          if (typeof cmd.seek === 'number' && cmd.seek >= 0) {
            const targetSeek = cmd.seek;
            const tryOpenSeek = (attempts = 0) => {
              if (getDuration() > 0 || state.streamDuration > 0) {
                seekToSeconds(targetSeek, true);
                showToast(`AI Bridge: Seek → ${formatTime(targetSeek)}`);
              } else if (attempts < 20) {
                setTimeout(() => tryOpenSeek(attempts + 1), 200);
              }
            };
            setTimeout(tryOpenSeek, 250);
          }
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
      case 'restoreSession': {
        const queueToRestore = cmd.resolvedItems || state.savedLastQueue;
        if (Array.isArray(queueToRestore) && queueToRestore.length > 0) {
          state.queue = queueToRestore.slice();
          state.queueIndex = -1;
          renderRightDrawer();
        }

        const itemToRestore = cmd.resolved?.item || state.savedLastItem || (state.history && state.history[0]) || (state.queue && state.queue[0]);
        const targetPos = typeof cmd.seek === 'number' ? cmd.seek : (state.savedLastPosition || 0);
        const targetSpeed = typeof cmd.speed === 'number' ? cmd.speed : state.speed;

        if (typeof targetSpeed === 'number' && targetSpeed > 0 && targetSpeed !== state.speed) {
          setSpeed(targetSpeed, true);
        }

        if (itemToRestore) {
          const folder = cmd.resolved?.folder || state.savedLastFolder;
          ingestOpenedBundle({ items: [itemToRestore], folder }, true, { append: false });
          if (targetPos > 0) {
            const tryRestoreSeek = (attempts = 0) => {
              if (getDuration() > 0 || state.streamDuration > 0) {
                seekToSeconds(targetPos, true);
                showToast(`AI Bridge: Session Restored at ${formatTime(targetPos)}`);
              } else if (attempts < 20) {
                setTimeout(() => tryRestoreSeek(attempts + 1), 200);
              }
            };
            setTimeout(tryRestoreSeek, 300);
          } else {
            showToast('AI Bridge: Session Restored');
          }
        }
        break;
      }
      case 'setSubtitleTrack': {
        if (cmd.value === 'off' || cmd.enabled === false) {
          state.subEnabled = false;
          clearSubtitles();
          syncPopoverButtonsActive();
          showToast('AI Bridge: Subtitles Off');
        } else if (cmd.filePath && api.readSubtitle) {
          api.readSubtitle(cmd.filePath).then((subData) => {
            if (subData) {
              state.subEnabled = true;
              loadSubtitleData(subData, true);
            }
          }).catch(() => {});
        } else if (cmd.value === 'toggle') {
          state.subEnabled = !state.subEnabled;
          renderSubtitleBlocksOnSeekbar();
          updateActiveSubtitleCue();
          syncPopoverButtonsActive();
          showToast(state.subEnabled ? 'AI Bridge: Subtitles Enabled' : 'AI Bridge: Subtitles Disabled');
        }
        break;
      }
      case 'setAudioTrack': {
        showToast(`AI Bridge: Audio Track → ${cmd.value || cmd.index || 'Default'}`);
        break;
      }
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
        const target = !state.alwaysOnTop;
        state.alwaysOnTop = target;
        syncSwitchesUI();
        const pinned = api.setAlwaysOnTop ? await api.setAlwaysOnTop(target) : await api.toggleAlwaysOnTop();
        state.alwaysOnTop = pinned;
        syncSwitchesUI();
        savePreferences();
        showToast(pinned ? 'Pinned Always on Top' : 'Unpinned Always on Top');
      }
    } catch {
      const target = !state.alwaysOnTop;
      state.alwaysOnTop = target;
      syncSwitchesUI();
      const pinned = api.setAlwaysOnTop ? await api.setAlwaysOnTop(target) : await api.toggleAlwaysOnTop();
      state.alwaysOnTop = pinned;
      syncSwitchesUI();
      savePreferences();
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
    if (el.shortcutBannerIcon) el.shortcutBannerIcon.innerHTML = ICONS.cone;
    if (el.resumePromptIcon) el.resumePromptIcon.innerHTML = ICONS.play;
    if (el.queuePromptIcon) el.queuePromptIcon.innerHTML = ICONS.queue;

    el.btnPrev.innerHTML = ICONS.prev;
    el.btnPlay.innerHTML = ICONS.play;
    el.btnNext.innerHTML = ICONS.next;
    el.btnMute.innerHTML = ICONS.speaker;
    el.btnAudioPop.innerHTML = ICONS.audioWave;
    el.btnSubPop.innerHTML = ICONS.subtitles;
    el.btnGearPop.innerHTML = ICONS.gearPlay;
    el.btnQueueDrawer.innerHTML = ICONS.queue;
    el.btnCloseSettings.innerHTML = ICONS.close;

    if (el.btnBottomStepBack) el.btnBottomStepBack.innerHTML = ICONS.stepBack;
    if (el.btnBottomStepFwd) el.btnBottomStepFwd.innerHTML = ICONS.stepFwd;
    if (el.btnBottomShuffle) el.btnBottomShuffle.innerHTML = ICONS.shuffle;
    if (el.btnBottomRepeat) el.btnBottomRepeat.innerHTML = ICONS.repeat;
    if (el.btnBottomAb) el.btnBottomAb.innerHTML = ICONS.abLoop;
    if (el.btnBottomNight) el.btnBottomNight.innerHTML = ICONS.nightMode;
    if (el.btnBottomSnapshot) el.btnBottomSnapshot.innerHTML = ICONS.snapshot;
    if (el.previewThumbCone) el.previewThumbCone.innerHTML = ICONS.cone;
    if (el.previewThumbPaw) el.previewThumbPaw.innerHTML = ICONS.catPaw;

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
    setSpeed(1.0, false);
    applyThemeMode(state.themeMode, false);
    applyAccent(state.accentKey === 'custom' ? state.customAccentHex : state.accentKey, false);
    applyVolumeToEngine();
    applyVideoAppearance();
    syncSwitchesUI();
    syncRepeatUI();
    syncNightModeUI();
    syncBottomBarIconsUI(false);
    syncSpeedChipsUI(false);
    applySeekbarThumbStyle(state.seekbarThumbStyle, false);
    updateBottomSpeedBadge();
    applySubtitleAppearance(false);
    syncHistoryBadge();
    if (el.selVisualizerStyle) el.selVisualizerStyle.value = state.visualizerStyle;
    if (el.rngGhostOpacity) {
      el.rngGhostOpacity.value = String(state.ghostOpacity);
      if (el.lblGhostOpacity) el.lblGhostOpacity.textContent = `${state.ghostOpacity}%`;
    }
    if (state.alwaysOnTop && api.setAlwaysOnTop) {
      await api.setAlwaysOnTop(true).catch(() => {});
    }

    const initWs = await api.getWindowState();
    if (initWs) {
      state.isMaximized = Boolean(initWs.maximized);
      state.isFullscreen = Boolean(initWs.fullscreen);
      if (typeof initWs.alwaysOnTop === 'boolean') {
        state.alwaysOnTop = initWs.alwaysOnTop;
      }
      state.aiPort = initWs.aiPort || 4500;
      state.hasFfmpeg = Boolean(initWs.hasFfmpeg);
      updateChromeSolidity();
    }

    // 4. Populate Customizable Shortcuts in Left Sidebar
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

    // Open external links safely via shell.openExternal
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[target="_blank"]');
      if (link && link.href) {
        e.preventDefault();
        api.openExternal(link.href);
      }
    });

    // 5. Window controls & IPC listeners
    el.btnMinimize.addEventListener('click', () => api.minimize());
    el.btnMaximize.addEventListener('click', () => api.maximize());
    el.btnFullscreen.addEventListener('click', () => api.toggleFullscreen());
    el.btnClose.addEventListener('click', () => api.close());
    el.btnPip.addEventListener('click', togglePictureInPicture);
    if (el.topBar) {
      el.topBar.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, .icon-btn, .folder-crumb-btn')) return;
        api.maximize();
      });

      // Drag-from-fullscreen handler
      let fsDragActive = false;
      let fsDragStart = null;
      let fsDragOffset = { x: 0, y: 0 };
      let dragMoveRaf = null;
      let pendingDragMove = null;

      el.topBar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, .icon-btn, .folder-crumb-btn')) return;

        if (state.isFullscreen) {
          fsDragStart = {
            screenX: e.screenX,
            screenY: e.screenY,
            ratioX: e.clientX / Math.max(1, window.innerWidth)
          };
          fsDragActive = false;
        }
      });

      window.addEventListener('pointermove', async (e) => {
        if (!fsDragStart) return;
        if (e.buttons === 0) {
          if (dragMoveRaf) {
            cancelAnimationFrame(dragMoveRaf);
            dragMoveRaf = null;
          }
          pendingDragMove = null;
          fsDragStart = null;
          fsDragActive = false;
          return;
        }

        if (!fsDragActive) {
          const dist = Math.hypot(e.screenX - fsDragStart.screenX, e.screenY - fsDragStart.screenY);
          if (dist >= 6) {
            fsDragActive = true;
            try {
              const res = await api.exitFullscreenToDrag({
                screenX: e.screenX,
                screenY: e.screenY,
                ratioX: fsDragStart.ratioX
              });
              if (res) {
                fsDragOffset = {
                  x: e.screenX - res.x,
                  y: e.screenY - res.y
                };
              }
            } catch (err) {
              console.error('Failed to exit fullscreen to drag:', err);
            }
          }
        } else {
          pendingDragMove = {
            x: e.screenX - fsDragOffset.x,
            y: e.screenY - fsDragOffset.y
          };
          if (!dragMoveRaf) {
            dragMoveRaf = requestAnimationFrame(() => {
              if (pendingDragMove) {
                api.dragMove(pendingDragMove);
              }
              dragMoveRaf = null;
            });
          }
        }
      });

      window.addEventListener('pointerup', (e) => {
        if (dragMoveRaf) {
          cancelAnimationFrame(dragMoveRaf);
          dragMoveRaf = null;
        }
        pendingDragMove = null;
        if (fsDragActive) {
          if (e.screenY <= 4) {
            api.maximize();
          }
        }
        fsDragStart = null;
        fsDragActive = false;
      });

      window.addEventListener('pointercancel', (e) => {
        if (dragMoveRaf) {
          cancelAnimationFrame(dragMoveRaf);
          dragMoveRaf = null;
        }
        pendingDragMove = null;
        if (e.buttons === 0) {
          fsDragStart = null;
          fsDragActive = false;
        }
      });
    }

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

    let hasLoadedMediaOnStartup = false;

    api.onInitialMedia((data) => {
      if (data?.item) {
        hasLoadedMediaOnStartup = true;
        ingestOpenedBundle({ items: [data.item], folder: data.folder }, true);
      }
    });

    if (api.getInitialMedia) {
      api.getInitialMedia().then((data) => {
        if (data?.item && (!state.currentItem || state.currentItem.path !== data.item.path)) {
          hasLoadedMediaOnStartup = true;
          ingestOpenedBundle({ items: [data.item], folder: data.folder }, true);
        } else if (!hasLoadedMediaOnStartup && !state.currentItem && state.resumeLastVideo && state.savedLastItem && state.savedLastFolder) {
          // Reopen last session if enabled in Settings (will prompt to continue where left off)
          ingestOpenedBundle({ items: [state.savedLastItem], folder: state.savedLastFolder }, false);
        }
      }).catch(() => {});
    }

    window.addEventListener('beforeunload', () => {
      state.speed = 1.0;
      savePreferences();
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

    el.bottomPopover.addEventListener('mouseenter', () => {
      state.hoveringBottomPopover = true;
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    el.bottomPopover.addEventListener('mouseleave', () => {
      state.hoveringBottomPopover = false;
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    el.bottomPopover.addEventListener('pointerdown', (e) => {
      state.interactingBottomPopover = true;
      if (e.target.closest('select')) {
        state.bottomPopoverSelectOpen = true;
      }
      syncSidebarAutoCollapse();
      resetFullscreenIdle();
    });
    ['input', 'change', 'click', 'keydown', 'wheel'].forEach((evName) => {
      el.bottomPopover.addEventListener(
        evName,
        (e) => {
          if (evName === 'change' && e.target.closest('select')) {
            state.bottomPopoverSelectOpen = false;
          }
          syncSidebarAutoCollapse();
          resetFullscreenIdle();
        },
        { passive: true }
      );
    });
    [el.selVideoFit, el.selEqPreset].forEach((sel) => {
      sel.addEventListener('blur', () => {
        if (state.bottomPopoverSelectOpen) {
          state.bottomPopoverSelectOpen = false;
          syncSidebarAutoCollapse();
        }
      });
    });
    const endPopoverPointerInteraction = () => {
      if (state.interactingBottomPopover) {
        state.interactingBottomPopover = false;
        syncSidebarAutoCollapse();
      }
    };
    window.addEventListener('pointerup', endPopoverPointerInteraction);
    window.addEventListener('pointercancel', endPopoverPointerInteraction);

    el.btnCone.addEventListener('click', () => toggleSettingsModal());
    el.btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      closeBottomPopover();
      el.headerMenu.classList.toggle('open');
      updateChromeSolidity();
    });

    el.btnSidebar.addEventListener('click', () => {
      const collapsed = el.librarySidebar.classList.toggle('collapsed');
      el.btnSidebar.classList.toggle('active', !collapsed);
      state.leftOpenedByEdge = false;
      if (collapsed) {
        state.leftEdgeCooldownUntil = Date.now() + 450;
      } else if (state.libraryDirty) {
        renderLibraryList();
      }
      updateChromeSolidity();
    });

    el.btnFolderCrumb.addEventListener('click', () => {
      if (state.libraryFolder) {
        const collapsed = el.librarySidebar.classList.toggle('collapsed');
        el.btnSidebar.classList.toggle('active', !collapsed);
        state.leftOpenedByEdge = false;
        if (collapsed) {
          state.leftEdgeCooldownUntil = Date.now() + 450;
        } else if (state.libraryDirty) {
          renderLibraryList();
        }
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
      const target = !state.alwaysOnTop;
      state.alwaysOnTop = target;
      syncSwitchesUI();
      const confirmed = api.setAlwaysOnTop ? await api.setAlwaysOnTop(target) : await api.toggleAlwaysOnTop();
      state.alwaysOnTop = confirmed;
      syncSwitchesUI();
      savePreferences();
      showToast(state.alwaysOnTop ? 'Always on Top: Pinned' : 'Always on Top: Unpinned');
    });
    el.menuSettings.addEventListener('click', () => toggleSettingsModal(true));

    // 7. Library Sidebar & Empty State actions
    let libSearchTimer = null;
    el.libSearchInput.addEventListener('input', () => {
      state.libraryFilter = el.libSearchInput.value;
      if (libSearchTimer) clearTimeout(libSearchTimer);
      libSearchTimer = setTimeout(() => {
        libSearchTimer = null;
        renderLibraryList();
      }, 120);
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
      state.rightOpenedByEdge = false;
      if (collapsed) {
        state.rightEdgeCooldownUntil = Date.now() + 450;
      } else if (state.rightDrawerDirty) {
        renderRightDrawer();
      }
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
        state.queuedNextIndex = -1;
        state.watchedQueuePaths = [];
        state.savedLastQueue = null;
        state.savedLastQueueWatched = [];
        savePreferences();
        if (state.playbackSource === 'queue') {
          await resetPlayerToIdle();
        }
        renderRightDrawer();
        showToast('Cleared queue');
      } else if (state.drawerTab === 'bookmarks') {
        state.bookmarks = [];
        showToast('Cleared bookmarks');
      } else if (state.drawerTab === 'history') {
        state.history = [];
        syncHistoryBadge();
        showToast('Cleared recent playback history');
      }
      renderLibraryList();
      renderRightDrawer();
      pushPlayerStatus();
      savePreferences();
    });

    // 9. Transport, Video Events, Popup Mini Player & Automatic Codec Fallback
    el.btnPlay.addEventListener('click', togglePlay);
    el.btnPrev.addEventListener('click', playPrev);
    el.btnNext.addEventListener('click', playNext);
    if (el.btnBottomStepBack) el.btnBottomStepBack.addEventListener('click', () => stepFrame(-1));
    if (el.btnBottomStepFwd) el.btnBottomStepFwd.addEventListener('click', () => stepFrame(1));
    if (el.btnBottomShuffle) el.btnBottomShuffle.addEventListener('click', () => toggleShuffle());
    if (el.btnBottomRepeat) el.btnBottomRepeat.addEventListener('click', () => cycleRepeatMode());
    if (el.btnBottomAb) el.btnBottomAb.addEventListener('click', () => cycleAbLoop());
    if (el.btnBottomNight) el.btnBottomNight.addEventListener('click', () => toggleNightMode());
    if (el.btnBottomSnapshot) el.btnBottomSnapshot.addEventListener('click', () => copySnapshotToClipboard());
    if (el.bottomSpeedBadge) {
      el.bottomSpeedBadge.addEventListener('click', () => {
        setSpeed(1.0, true);
      });
    }
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
      if (!state.currentSegments || state.currentSegments.length === 0 || (state.currentChapters && state.currentChapters.length > 0)) {
        state.currentSegments = classifySegments(state.currentChapters || [], getDuration(), getCurrentItem());
        renderChapterMarkersOnSeekbar();
      }
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
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (typeof details?.seekTime === 'number') {
            seekToSeconds(details.seekTime, !el.video.paused);
          }
        });
      } catch {}
    }

    // Zero-CPU idle sleep wiring for audio visualizers
    el.video.addEventListener('play', checkResumeVisualizer);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkResumeVisualizer();
      } else if (visualizerRaf) {
        cancelAnimationFrame(visualizerRaf);
        visualizerRaf = null;
      }
    });

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
      if (state.playbackSource === 'queue' && state.currentItem && state.currentItem.filePath) {
        markQueueItemWatched(state.currentItem.filePath);
      }
      if (state.stopAfterCurrent) {
        state.stopAfterCurrent = false;
        pauseMedia();
        showToast('Playback stopped (Stop After Episode)');
        updateTransportUI();
        pushPlayerStatus();
        return;
      }
      if (state.repeatMode === 'one' || state.loop) {
        if (state.streamMode) {
          reloadStreamAt(0, true);
        } else {
          el.video.currentTime = 0;
          playMedia();
        }
        return;
      }
      if (
        state.playbackSource !== 'queue' &&
        state.queuedNextIndex >= 0 &&
        state.queuedNextIndex < state.queue.length
      ) {
        const startIdx = state.queuedNextIndex;
        state.queuedNextIndex = -1;
        loadQueueItemAtIndex(startIdx, true);
      } else if (state.playbackSource === 'queue' && state.queue.length > 0) {
        if (state.shuffle && state.queue.length > 1) {
          let nextIdx;
          do {
            nextIdx = Math.floor(Math.random() * state.queue.length);
          } while (nextIdx === state.queueIndex && state.queue.length > 1);
          loadQueueItemAtIndex(nextIdx, true);
        } else if (state.queueIndex < state.queue.length - 1) {
          loadQueueItemAtIndex(state.queueIndex + 1, true);
        } else if (state.repeatMode === 'all') {
          loadQueueItemAtIndex(0, true);
        } else {
          updateTransportUI();
          pushPlayerStatus();
        }
      } else if (state.playbackSource === 'folder' && state.folderPlaylist.length > 0) {
        if (state.shuffle && state.folderPlaylist.length > 1) {
          let nextIdx;
          do {
            nextIdx = Math.floor(Math.random() * state.folderPlaylist.length);
          } while (nextIdx === state.folderPlayIndex && state.folderPlaylist.length > 1);
          loadFolderItemAtIndex(nextIdx, true);
        } else if (state.folderPlayIndex < state.folderPlaylist.length - 1) {
          loadFolderItemAtIndex(state.folderPlayIndex + 1, true);
        } else if (state.repeatMode === 'all') {
          loadFolderItemAtIndex(0, true);
        } else {
          updateTransportUI();
          pushPlayerStatus();
        }
      } else {
        if (state.repeatMode === 'all') {
          seekToSeconds(0, true);
        } else {
          updateTransportUI();
          pushPlayerStatus();
        }
      }
    });

    // Stage click (immediately close open sidebars, Audio/Subtitles/Playback popover & menus; otherwise single-click play/pause, double-click fullscreen)
    let stageClickTimer = null;
    let suppressDblClickUntil = 0;
    let dismissedOverlayOnPointerDown = false;

    const dismissOpenStageOverlays = () => {
      const leftOpen = !el.librarySidebar.classList.contains('collapsed');
      const rightOpen = !el.rightDrawer.classList.contains('collapsed');
      const headerMenuOpen = el.headerMenu.classList.contains('open');
      const bottomPopOpen = el.bottomPopover.classList.contains('open');

      if (!leftOpen && !rightOpen && !headerMenuOpen && !bottomPopOpen) {
        return false;
      }

      if (stageClickTimer) {
        clearTimeout(stageClickTimer);
        stageClickTimer = null;
      }
      if (leftOpen) {
        clearTimeout(leftSidebarIdleTimer);
        el.librarySidebar.classList.add('collapsed');
        el.btnSidebar.classList.remove('active');
        state.leftOpenedByEdge = false;
        state.hoveringLeftSidebar = false;
        state.leftEdgeCooldownUntil = Date.now() + 450;
      }
      if (rightOpen) {
        clearTimeout(rightDrawerIdleTimer);
        el.rightDrawer.classList.add('collapsed');
        el.btnQueueDrawer.classList.remove('active');
        state.rightOpenedByEdge = false;
        state.hoveringRightDrawer = false;
        state.rightEdgeCooldownUntil = Date.now() + 450;
      }
      if (headerMenuOpen) {
        el.headerMenu.classList.remove('open');
      }
      if (bottomPopOpen) {
        closeBottomPopover();
      }
      suppressDblClickUntil = Date.now() + 550;
      updateChromeSolidity();
      applyVideoAppearance();
      resetFullscreenIdle();
      return true;
    };

    el.videoStage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      dismissedOverlayOnPointerDown = dismissOpenStageOverlays();
      if (dismissedOverlayOnPointerDown) return;
      if (e.target.closest('.empty-state, .bottom-bar, .top-bar, .bottom-popover, .queue-prompt-banner, .resume-prompt-banner, .shortcut-banner, .osd-toast, #subtitle-overlay span')) return;
      if (getCurrentItem()) {
        startHold2x('pointer');
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) {
        stopHold2x('pointer');
      }
    });

    window.addEventListener('pointercancel', () => {
      stopHold2x('pointer');
    });

    el.videoStage.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (Date.now() < hold2xState.suppressClickUntil) {
        return;
      }
      if (dismissedOverlayOnPointerDown) {
        dismissedOverlayOnPointerDown = false;
        return;
      }
      if (dismissOpenStageOverlays()) return;

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
      if (e.target.closest('button')) return;
      if (Date.now() < suppressDblClickUntil) {
        suppressDblClickUntil = 0;
        return;
      }
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

    const calcSeekRatio = (clientX, trackRect = null) => {
      const rect = trackRect || el.seekbarTrack.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    };

    const updateHoverPreview = (clientX, trackRect = null) => {
      const dur = getDuration();
      if (!Number.isFinite(dur) || dur <= 0 || !getCurrentItem()) {
        el.seekHoverCard.classList.remove('visible');
        return;
      }
      const rect = trackRect || el.seekbarTrack.getBoundingClientRect();
      const ratio = calcSeekRatio(clientX, rect);
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

      const rect = el.seekbarTrack.getBoundingClientRect();
      const targetSec = calcSeekRatio(e.clientX, rect) * dur;
      if (state.streamMode) {
        state.scrubPreviewTime = targetSec;
        updateTimelineUI();
      } else {
        seekToSeconds(targetSec, wasPlayingBeforeScrub);
      }
      updateHoverPreview(e.clientX, rect);
    });

    el.seekbarTrack.addEventListener('pointermove', (e) => {
      const rect = el.seekbarTrack.getBoundingClientRect();
      updateHoverPreview(e.clientX, rect);
      if (!isScrubbing) return;
      const dur = getDuration();
      if (dur <= 0) return;
      const targetSec = calcSeekRatio(e.clientX, rect) * dur;
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
        syncPopoverButtonsActive();
        syncSidebarAutoCollapse();
      });
    });

    el.rngSpeed.addEventListener('input', () => setSpeed(Number(el.rngSpeed.value), false));
    document.querySelectorAll('.speed-chip').forEach((chip) => {
      chip.addEventListener('click', () => setSpeed(Number(chip.dataset.speed), true));
    });

    if (el.btnRepeatModeCycle) el.btnRepeatModeCycle.addEventListener('click', () => cycleRepeatMode());
    if (el.swShuffle) el.swShuffle.addEventListener('click', () => toggleShuffle());
    if (el.btnAbSetA) el.btnAbSetA.addEventListener('click', () => setAbLoopPoint('A'));
    if (el.btnAbSetB) el.btnAbSetB.addEventListener('click', () => setAbLoopPoint('B'));
    if (el.btnAbClear) el.btnAbClear.addEventListener('click', () => clearAbLoop());

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
      savePreferences();
      showToast(`Video Fit: ${el.selVideoFit.options[el.selVideoFit.selectedIndex].text}`);
    });
    el.rngBrightness.addEventListener('input', () => {
      state.brightness = Number(el.rngBrightness.value);
      applyVideoAppearance();
    });
    el.rngBrightness.addEventListener('change', () => {
      savePreferences();
    });
    el.rngContrast.addEventListener('input', () => {
      state.contrast = Number(el.rngContrast.value);
      applyVideoAppearance();
    });
    el.rngContrast.addEventListener('change', () => {
      savePreferences();
    });
    el.rngSaturation.addEventListener('input', () => {
      state.saturation = Number(el.rngSaturation.value);
      applyVideoAppearance();
    });
    el.rngSaturation.addEventListener('change', () => {
      savePreferences();
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
      savePreferences();
      showToast('Video filters reset');
    });

    el.rngVolumePop.addEventListener('input', () => {
      ensureAudioGraph();
      state.muted = false;
      state.volume = Number(el.rngVolumePop.value);
      applyVolumeToEngine();
      savePreferences();
    });
    if (el.swNightMode) el.swNightMode.addEventListener('click', () => toggleNightMode());
    if (el.btnAudioMinus25) el.btnAudioMinus25.addEventListener('click', () => adjustAudioDelay(-25));
    if (el.btnAudioPlus25) el.btnAudioPlus25.addEventListener('click', () => adjustAudioDelay(25));
    if (el.btnAudioReset) el.btnAudioReset.addEventListener('click', () => adjustAudioDelay(0));

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
      savePreferences();
    });

    el.swSubEnabled.addEventListener('click', () => {
      state.subEnabled = !state.subEnabled;
      syncSwitchesUI();
      syncPopoverButtonsActive();
      renderSubtitleBlocksOnSeekbar();
      updateActiveSubtitleCue();
      savePreferences();
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

    if (el.selSubFont) {
      el.selSubFont.addEventListener('change', () => {
        state.subFont = el.selSubFont.value;
        applySubtitleAppearance(true);
      });
    }
    if (el.selSubBg) {
      el.selSubBg.addEventListener('change', () => {
        state.subBgStyle = el.selSubBg.value;
        applySubtitleAppearance(true);
      });
    }
    if (el.subColorSwatches) {
      el.subColorSwatches.querySelectorAll('.sub-color-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          if (pill.dataset.color) {
            state.subColor = pill.dataset.color;
            applySubtitleAppearance(true);
          }
        });
      });
    }

    if (el.btnThumbCone) el.btnThumbCone.addEventListener('click', () => applySeekbarThumbStyle('cone', true));
    if (el.btnThumbPaw) el.btnThumbPaw.addEventListener('click', () => applySeekbarThumbStyle('paw', true));
    if (el.btnThumbPill) el.btnThumbPill.addEventListener('click', () => applySeekbarThumbStyle('pill', true));

    if (el.selVisualizerStyle) {
      el.selVisualizerStyle.addEventListener('change', () => {
        state.visualizerStyle = el.selVisualizerStyle.value;
        savePreferences();
      });
    }

    if (el.swGhostMode) el.swGhostMode.addEventListener('click', () => toggleGhostMode());
    if (el.rngGhostOpacity) {
      el.rngGhostOpacity.addEventListener('input', () => {
        setGhostOpacity(Number(el.rngGhostOpacity.value), false);
      });
      el.rngGhostOpacity.addEventListener('change', () => {
        setGhostOpacity(Number(el.rngGhostOpacity.value), true);
      });
    }

    const barChks = [
      { chk: el.chkBarStep, key: 'step' },
      { chk: el.chkBarShuffle, key: 'shuffle' },
      { chk: el.chkBarRepeat, key: 'repeat' },
      { chk: el.chkBarAb, key: 'ab' },
      { chk: el.chkBarNight, key: 'night' },
      { chk: el.chkBarSnapshot, key: 'snapshot' }
    ];
    barChks.forEach(({ chk, key }) => {
      if (chk) {
        chk.addEventListener('change', () => {
          state.bottomBarIcons[key] = chk.checked;
          syncBottomBarIconsUI(true);
        });
      }
    });

    if (el.btnSpeedChipsAll) {
      el.btnSpeedChipsAll.addEventListener('click', () => {
        state.speedChipsVisible = ['0.5', '0.75', '1', '1.25', '1.5', '2'];
        syncSpeedChipsUI(true);
      });
    }
    if (el.btnSpeedChipsNone) {
      el.btnSpeedChipsNone.addEventListener('click', () => {
        state.speedChipsVisible = [];
        syncSpeedChipsUI(true);
      });
    }
    document.querySelectorAll('.chk-speed-chip').forEach((chk) => {
      chk.addEventListener('change', () => {
        const checkedSpeeds = [];
        document.querySelectorAll('.chk-speed-chip').forEach((c) => {
          if (c.checked && c.dataset.speed) checkedSpeeds.push(c.dataset.speed);
        });
        state.speedChipsVisible = checkedSpeeds;
        syncSpeedChipsUI(true);
      });
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
        if (target === 'shortcuts') {
          syncHotkeyInputsUI();
          renderHotkeysTable();
        }
      });
    });

    if (el.btnResetAllSettings) {
      el.btnResetAllSettings.addEventListener('click', resetAllSettingsToDefault);
    }

    if (el.btnThemeDark) {
      el.btnThemeDark.addEventListener('click', () => {
        applyThemeMode('dark', true);
        showToast('Theme: Dark Mode');
      });
    }
    if (el.btnThemeLight) {
      el.btnThemeLight.addEventListener('click', () => {
        applyThemeMode('light', true);
        showToast('Theme: Light Mode');
      });
    }
    if (el.menuToggleTheme) {
      el.menuToggleTheme.addEventListener('click', () => {
        const next = state.themeMode === 'dark' ? 'light' : 'dark';
        applyThemeMode(next, true);
        el.headerMenu.classList.remove('open');
        updateChromeSolidity();
        showToast(`Theme: ${next === 'dark' ? 'Dark Mode' : 'Light Mode'}`);
      });
    }

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
      const target = !state.alwaysOnTop;
      state.alwaysOnTop = target;
      syncSwitchesUI();
      const confirmed = api.setAlwaysOnTop ? await api.setAlwaysOnTop(target) : await api.toggleAlwaysOnTop();
      state.alwaysOnTop = confirmed;
      syncSwitchesUI();
      savePreferences();
      showToast(state.alwaysOnTop ? 'Always on Top: Pinned' : 'Always on Top: Disabled');
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
    if (el.swResumePlayback) {
      el.swResumePlayback.addEventListener('click', () => {
        state.resumeLastVideo = !state.resumeLastVideo;
        syncSwitchesUI();
        savePreferences();
        showToast(state.resumeLastVideo ? 'Resume on Startup: Enabled' : 'Resume on Startup: Disabled (Starts with clean Cat)');
      });
    }

    if (el.btnSkipSegment) {
      el.btnSkipSegment.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerCurrentSegmentSkip();
      });
    }

    if (el.btnUpNextPlay) {
      el.btnUpNextPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        hideUpNextBanner();
        playNext();
      });
    }

    if (el.btnUpNextDismiss) {
      el.btnUpNextDismiss.addEventListener('click', (e) => {
        e.stopPropagation();
        state.upNextDismissed = true;
        hideUpNextBanner();
      });
    }

    const onSkipModeChanged = (val) => {
      state.skipMode = val;
      syncSwitchesUI();
      savePreferences();
      const labels = {
        prompt: 'Prompt to Skip',
        never: 'Always Play Full Video',
        skip_ending: 'Skip Ending & Credits',
        skip_all: 'Skip Opening, Ending & Credits'
      };
      showToast(`Skipping Mode: ${labels[val] || val}`);
      if (val === 'never') {
        hideSkipSegmentPrompt();
      } else {
        checkSegmentSkipping(getCurrentTime(), getDuration());
      }
    };

    if (el.selSkipMode) {
      el.selSkipMode.addEventListener('change', () => onSkipModeChanged(el.selSkipMode.value));
    }
    if (el.selPopSkipMode) {
      el.selPopSkipMode.addEventListener('change', () => onSkipModeChanged(el.selPopSkipMode.value));
    }
    if (el.selSleepTimer) {
      el.selSleepTimer.addEventListener('change', () => {
        setSleepTimer(parseInt(el.selSleepTimer.value, 10));
      });
    }

    el.btnCopyAiCmd.addEventListener('click', () => {
      navigator.clipboard.writeText(el.aiSampleCmd.textContent).then(() => {
        showToast('Copied PowerShell AI Control command');
      });
    });

    // Desktop Shortcut creation handlers
    async function triggerCreateShortcut() {
      if (!api.createDesktopShortcut) return;
      const res = await api.createDesktopShortcut();
      if (res && res.success) {
        showToast('Desktop shortcut "CopyCat media player" created!');
        if (el.shortcutBanner) el.shortcutBanner.classList.remove('visible');
      } else {
        showToast(`Shortcut error: ${res?.error || 'failed'}`);
      }
    }

    if (el.btnBannerCreateShortcut) {
      el.btnBannerCreateShortcut.addEventListener('click', triggerCreateShortcut);
    }
    if (el.btnCreateDesktopShortcut) {
      el.btnCreateDesktopShortcut.addEventListener('click', triggerCreateShortcut);
    }
    if (el.btnBannerDismissShortcut) {
      el.btnBannerDismissShortcut.addEventListener('click', () => {
        state.dismissShortcutPrompt = true;
        savePreferences();
        if (el.shortcutBanner) el.shortcutBanner.classList.remove('visible');
      });
    }

    // Resume Playback Prompt Banner handlers
    if (el.btnResumeContinue) {
      el.btnResumeContinue.addEventListener('click', () => {
        const resumePos = Math.max(0, state.savedLastPosition - 5);
        if (state.savedLastPosition > 0 && state.currentItem) {
          if (state.streamMode) {
            startFfmpegStreamPlayback(state.currentItem, resumePos, true, false);
          } else {
            el.video.currentTime = resumePos;
            playMedia();
          }
          showToast(`Resumed at ${formatTime(resumePos)}`);
        }
        state.savedLastPosition = 0;
        hideResumePrompt();
      });
    }

    // Restore Previous Queue Prompt Banner handlers
    if (el.btnRestoreQueueConfirm) {
      el.btnRestoreQueueConfirm.addEventListener('click', () => {
        if (Array.isArray(state.savedLastQueue) && state.savedLastQueue.length > 0) {
          state.queue = state.savedLastQueue.slice();
          state.watchedQueuePaths = Array.isArray(state.savedLastQueueWatched)
            ? state.savedLastQueueWatched.slice()
            : [];
          const matchIdx = state.queue.findIndex((q) => isSameMediaItem(q, state.currentItem));
          state.queueIndex = matchIdx !== -1 ? matchIdx : 0;
          state.playbackSource = 'queue';
          savePreferences();
          renderRightDrawer();
          showToast(`Restored previous queue (${state.queue.length} videos)`);
        }
        state.savedLastQueue = null;
        state.savedLastQueueWatched = [];
        hideQueuePrompt();
      });
    }

    el.seekbarTrack.addEventListener('pointerdown', hideResumePrompt);

    const btnSetDefaultPlayer = document.getElementById('btn-set-default-player');
    const btnOpenDefaultApps = document.getElementById('btn-open-default-apps');
    if (btnSetDefaultPlayer) {
      btnSetDefaultPlayer.addEventListener('click', async () => {
        if (!api.setDefaultPlayer) return;
        showToast('Setting CopyCat media player as default video player...');
        const res = await api.setDefaultPlayer();
        if (res?.ok) {
          showToast('CopyCat media player is now the default video player!');
        } else {
          showToast(`Default setup: ${res?.error || 'Associations registered'}`);
        }
      });
    }
    if (btnOpenDefaultApps) {
      btnOpenDefaultApps.addEventListener('click', () => {
        if (api.openDefaultAppsSettings) api.openDefaultAppsSettings();
      });
    }

    // Hotkey Step & Tuning inputs
    function setupHotkeyTuning() {
      syncHotkeyInputsUI();
      renderHotkeysTable();

      function updateTuneVol() {
        const val = Math.max(1, Math.min(25, Math.round(Number(el.inpTuneVol.value) || 5)));
        el.inpTuneVol.value = val;
        state.hotkeySettings.volumeStep = val;
        savePreferences();
        showToast(`Volume Step: ${val}%`);
      }
      function updateTuneSeekSmall() {
        const val = Math.max(1, Math.min(60, Math.round(Number(el.inpTuneSeekSmall.value) || 5)));
        el.inpTuneSeekSmall.value = val;
        state.hotkeySettings.seekSmallSec = val;
        savePreferences();
        showToast(`Seek Small: ${val}s`);
      }
      function updateTuneSeekLarge() {
        const val = Math.max(5, Math.min(300, Math.round(Number(el.inpTuneSeekLarge.value) || 15)));
        el.inpTuneSeekLarge.value = val;
        state.hotkeySettings.seekLargeSec = val;
        savePreferences();
        showToast(`Seek Large: ${val}s`);
      }
      function updateTuneSpeed() {
        const raw = Math.max(0.01, Math.min(0.50, Number(el.inpTuneSpeed.value) || 0.10));
        const val = parseFloat(raw.toFixed(2));
        el.inpTuneSpeed.value = val.toFixed(2);
        state.hotkeySettings.speedStep = val;
        savePreferences();
        showToast(`Speed Increment: ${val}x`);
      }

      if (el.inpTuneVol) el.inpTuneVol.addEventListener('change', updateTuneVol);
      if (el.inpTuneSeekSmall) el.inpTuneSeekSmall.addEventListener('change', updateTuneSeekSmall);
      if (el.inpTuneSeekLarge) el.inpTuneSeekLarge.addEventListener('change', updateTuneSeekLarge);
      if (el.inpTuneSpeed) el.inpTuneSpeed.addEventListener('change', updateTuneSpeed);

      if (el.btnResetHotkeys) {
        el.btnResetHotkeys.addEventListener('click', () => {
          state.keybindings = cloneDefaultKeybindings();
          state.hotkeySettings = { ...DEFAULT_HOTKEY_SETTINGS };
          syncHotkeyInputsUI();
          recordingState = null;
          renderHotkeysTable();
          savePreferences();
          showToast('Keyboard shortcuts & steps reset to factory defaults');
        });
      }
    }
    setupHotkeyTuning();

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
        closeBottomPopover();
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
      if (el.rightDrawer.classList.contains('collapsed')) return false;
      if (target?.closest?.('#right-drawer')) return true;
      const drawerRect = el.rightDrawer.getBoundingClientRect();
      return (
        clientX >= drawerRect.left &&
        clientX <= drawerRect.right &&
        clientY >= drawerRect.top &&
        clientY <= drawerRect.bottom
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
        if (state.rightDrawerDirty) renderRightDrawer();
      }

      el.dropOverlay.textContent = 'Drop here to play video';
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
      endExternalFileDrag({ restoreCollapsed: !droppedOnQueue, hoveringQueue: droppedOnQueue });

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
        ingestOpenedBundle(resolved, true);
      }
    });

    // 15. Keyboard Shortcuts, Edge-Hover Auto-Open & Fullscreen Mouse Activity
    let leftEdgeHoverTimer = null;
    let rightEdgeHoverTimer = null;
    let leftEdgeOpenedAt = 0;
    let rightEdgeOpenedAt = 0;
    let lastClientX = -1;
    let lastClientY = -1;
    let pointerInWindow = false;

    const clearEdgeHoverTimers = () => {
      if (leftEdgeHoverTimer) {
        clearTimeout(leftEdgeHoverTimer);
        leftEdgeHoverTimer = null;
      }
      if (rightEdgeHoverTimer) {
        clearTimeout(rightEdgeHoverTimer);
        rightEdgeHoverTimer = null;
      }
    };

    const isPointInElement = (elem, x, y) => {
      if (!pointerInWindow || x < 0 || y < 0) return false;
      const r = elem.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const handleEdgeAutoOpen = (e) => {
      if (
        isScrubbing ||
        isDraggingVol ||
        state.draggingQueueItem ||
        state.externalFileDragActive ||
        state.dialogOpen ||
        el.settingsBackdrop.classList.contains('open')
      ) {
        clearEdgeHoverTimers();
        return;
      }

      const EDGE_PX = 16;
      const inVerticalZone = e.clientY > 40 && e.clientY < window.innerHeight - 52;

      // Left edge -> auto-open Folder sidebar
      const nearLeftEdge =
        inVerticalZone &&
        e.clientX >= 0 &&
        e.clientX <= EDGE_PX &&
        el.librarySidebar.classList.contains('collapsed') &&
        Date.now() > state.leftEdgeCooldownUntil;

      if (nearLeftEdge) {
        if (!leftEdgeHoverTimer) {
          leftEdgeHoverTimer = setTimeout(() => {
            leftEdgeHoverTimer = null;
            if (
              !pointerInWindow ||
              !el.librarySidebar.classList.contains('collapsed') ||
              Date.now() <= state.leftEdgeCooldownUntil ||
              state.dialogOpen ||
              el.settingsBackdrop.classList.contains('open')
            ) {
              return;
            }
            el.librarySidebar.classList.remove('collapsed');
            el.btnSidebar.classList.add('active');
            state.leftOpenedByEdge = true;
            state.hoveringLeftSidebar = true;
            leftEdgeOpenedAt = Date.now();
            if (state.libraryDirty) renderLibraryList();
            updateChromeSolidity();
            resetFullscreenIdle();

            setTimeout(() => {
              if (!el.librarySidebar.classList.contains('collapsed')) {
                const inside = isPointInElement(el.librarySidebar, lastClientX, lastClientY);
                if (state.hoveringLeftSidebar !== inside) {
                  state.hoveringLeftSidebar = inside;
                  syncSidebarAutoCollapse();
                }
              }
            }, 260);
          }, 85);
        }
      } else if (leftEdgeHoverTimer) {
        clearTimeout(leftEdgeHoverTimer);
        leftEdgeHoverTimer = null;
      }

      // Right edge -> auto-open Queue / Bookmarks drawer
      const nearRightEdge =
        inVerticalZone &&
        e.clientX >= window.innerWidth - EDGE_PX &&
        e.clientX <= window.innerWidth &&
        el.rightDrawer.classList.contains('collapsed') &&
        Date.now() > state.rightEdgeCooldownUntil;

      if (nearRightEdge) {
        if (!rightEdgeHoverTimer) {
          rightEdgeHoverTimer = setTimeout(() => {
            rightEdgeHoverTimer = null;
            if (
              !pointerInWindow ||
              !el.rightDrawer.classList.contains('collapsed') ||
              Date.now() <= state.rightEdgeCooldownUntil ||
              state.dialogOpen ||
              el.settingsBackdrop.classList.contains('open')
            ) {
              return;
            }
            el.rightDrawer.classList.remove('collapsed');
            el.btnQueueDrawer.classList.add('active');
            state.rightOpenedByEdge = true;
            state.hoveringRightDrawer = true;
            rightEdgeOpenedAt = Date.now();
            if (state.rightDrawerDirty) renderRightDrawer();
            updateChromeSolidity();
            resetFullscreenIdle();

            setTimeout(() => {
              if (!el.rightDrawer.classList.contains('collapsed')) {
                const inside = isPointInElement(el.rightDrawer, lastClientX, lastClientY);
                if (state.hoveringRightDrawer !== inside) {
                  state.hoveringRightDrawer = inside;
                  syncSidebarAutoCollapse();
                }
              }
            }, 260);
          }, 85);
        }
      } else if (rightEdgeHoverTimer) {
        clearTimeout(rightEdgeHoverTimer);
        rightEdgeHoverTimer = null;
      }
    };

    let mouseMovePending = false;
    let lastMouseMoveEvt = null;

    window.addEventListener('mousemove', (e) => {
      pointerInWindow = true;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      lastMouseMoveEvt = e;

      if (mouseMovePending) return;
      mouseMovePending = true;

      requestAnimationFrame(() => {
        mouseMovePending = false;
        const evt = lastMouseMoveEvt;
        if (!evt) return;

        if (state.externalFileDragActive) {
          endExternalFileDrag({ restoreCollapsed: true, hoveringQueue: false });
        }
        if (!el.librarySidebar.classList.contains('collapsed') && Date.now() - leftEdgeOpenedAt > 260) {
          const insideLeft = el.librarySidebar.contains(evt.target);
          if (state.hoveringLeftSidebar !== insideLeft) {
            state.hoveringLeftSidebar = insideLeft;
            syncSidebarAutoCollapse();
          }
        }
        if (!el.rightDrawer.classList.contains('collapsed') && Date.now() - rightEdgeOpenedAt > 260) {
          const insideRight = el.rightDrawer.contains(evt.target);
          if (state.hoveringRightDrawer !== insideRight) {
            state.hoveringRightDrawer = insideRight;
            syncSidebarAutoCollapse();
          }
        }
        if (el.bottomPopover.classList.contains('open')) {
          const insidePop = el.bottomPopover.contains(evt.target);
          if (state.hoveringBottomPopover !== insidePop) {
            state.hoveringBottomPopover = insidePop;
            syncSidebarAutoCollapse();
          }
        }
        handleEdgeAutoOpen(evt);
        resetFullscreenIdle();
      });
    }, { passive: true });
    document.addEventListener('mouseleave', () => {
      pointerInWindow = false;
      clearEdgeHoverTimers();
      state.hoveringLeftSidebar = false;
      state.hoveringRightDrawer = false;
      state.hoveringBottomPopover = false;
      syncSidebarAutoCollapse();
    });
    window.addEventListener('resize', () => {
      applyVideoAppearance();
    });
    window.addEventListener('blur', () => {
      stopHold2x('space');
      stopHold2x('pointer');
      pointerInWindow = false;
      clearEdgeHoverTimers();
      state.hoveringTopBar = false;
      state.hoveringBottomBar = false;
      state.hoveringLeftSidebar = false;
      state.hoveringRightDrawer = false;
      state.hoveringBottomPopover = false;
      updateChromeSolidity();
    });
    window.addEventListener('beforeunload', () => savePreferencesSync());

    window.addEventListener('keydown', (e) => {
      resetFullscreenIdle();

      // If currently recording a custom shortcut key
      if (recordingState) {
        if (e.key === 'Escape') {
          e.preventDefault();
          recordingState = null;
          renderHotkeysTable();
          showToast('Key recording cancelled');
          return;
        }
        const combo = normalizeKeyCombo(e);
        if (!combo) return; // Modifier only (Ctrl, Alt, Shift), wait for complete combination
        e.preventDefault();
        const { actionId, index } = recordingState;

        // Prevent collisions: remove this combo if mapped to another action
        for (const act of Object.keys(state.keybindings)) {
          state.keybindings[act] = (state.keybindings[act] || []).filter((c) => c !== combo);
        }

        if (!Array.isArray(state.keybindings[actionId])) {
          state.keybindings[actionId] = [];
        }
        if (index >= 0 && index < state.keybindings[actionId].length) {
          state.keybindings[actionId][index] = combo;
        } else {
          state.keybindings[actionId].push(combo);
        }

        const actDef = ACTION_DEFINITIONS.find((a) => a.id === actionId);
        recordingState = null;
        savePreferences();
        renderHotkeysTable();
        showToast(`Bound "${actDef?.label || actionId}" to ${formatKeyCombo(combo)}`);
        return;
      }

      // Ignore regular typing in text inputs or selects
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
          if (el.bottomPopover.contains(e.target)) {
            closeBottomPopover();
          }
        } else if (e.code === 'F12') {
          e.preventDefault();
          e.target.blur();
          triggerBossKey();
        }
        return;
      }

      // Escape key handles closing modals and fullscreen
      if (e.code === 'Escape') {
        if (el.settingsBackdrop.classList.contains('open')) {
          toggleSettingsModal(false);
        } else if (el.bottomPopover.classList.contains('open') || el.headerMenu.classList.contains('open')) {
          closeBottomPopover();
          el.headerMenu.classList.remove('open');
          updateChromeSolidity();
        } else if (state.isFullscreen) {
          api.toggleFullscreen();
        }
        return;
      }

      // Look up current key combo in configured keybindings
      const combo = normalizeKeyCombo(e);
      if (!combo) return;

      if (!state.keybindings) {
        state.keybindings = cloneDefaultKeybindings();
      }

      // Special handling for Spacebar: Hold to speed up 2x, tap to toggle play/pause
      const isSpaceTogglePlay = combo === 'Space' && Array.isArray(state.keybindings.togglePlay) && state.keybindings.togglePlay.includes('Space');
      if (isSpaceTogglePlay) {
        e.preventDefault();
        if (e.repeat) {
          if (hold2xState.pending) {
            triggerActiveHold2x();
          }
          return;
        }
        if (!getCurrentItem()) {
          executeHotkeyAction('togglePlay');
          return;
        }
        startHold2x('space');
        return;
      }

      for (const [actionId, keys] of Object.entries(state.keybindings)) {
        if (Array.isArray(keys) && keys.includes(combo)) {
          e.preventDefault();
          executeHotkeyAction(actionId);
          return;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        if (hold2xState.source === 'space') {
          const wasActiveHold = stopHold2x('space');
          e.preventDefault();
          if (!wasActiveHold) {
            togglePlay();
          }
        }
      }
    });

    // Periodic status sync for AI Control Bridge
    setInterval(pushPlayerStatus, 1000);
    renderLibraryList();
    renderRightDrawer();
    updateChromeSolidity();
    pushPlayerStatus();

    // Check if desktop shortcut exists; if missing and not dismissed, show prompt banner
    setTimeout(async () => {
      try {
        if (!state.dismissShortcutPrompt && !state.currentItem && api.hasDesktopShortcut) {
          const has = await api.hasDesktopShortcut();
          if (!has && el.shortcutBanner && !state.currentItem) {
            el.shortcutBanner.classList.add('visible');
          }
        }
      } catch (err) {
        console.warn('Desktop shortcut check:', err);
      }
    }, 600);
  }

  init();
})();
