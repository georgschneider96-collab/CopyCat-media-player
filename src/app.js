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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripLanguageTags(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/\s*[\(\[]\s*(?:English(?:\s*(?:Dub|Sub))?|Japanese(?:\s*(?:Original|Sub))?|Dual(?:\s*Audio)?|Dub|Sub|Eng|Jpn|Jap|Original)\s*[\)\]]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function formatDoubleDigitEpisode(str) {
    if (!str || typeof str !== 'string') return '';
    let result = str.replace(/(\b(?:Episode|Ep\.?|E)\s*[-_]?\s*)(\d+)\b/gi, (match, prefix, num) => {
      return prefix + (num.length === 1 ? `0${num}` : num);
    });
    result = result.replace(/(\s*[-–—]\s*)(\d+)(\s*)$/, (match, prefix, num, suffix) => {
      return prefix + (num.length === 1 ? `0${num}` : num) + suffix;
    });
    return result;
  }

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
    { id: 'cycleAudioTrack', label: 'Cycle Audio Track (Dual Audio)', category: 'Audio', defaults: ['KeyB'] },
    { id: 'addBookmark', label: 'Add Bookmark', category: 'Bookmarks', defaults: ['Ctrl+KeyB', 'Shift+KeyB'] },
    { id: 'snapshot', label: 'Save Snapshot (PNG)', category: 'Tools', defaults: ['Shift+KeyS'] },
    { id: 'cycleAspect', label: 'Cycle Aspect Ratio', category: 'Playback', defaults: ['KeyZ', 'KeyA'] },
    { id: 'openFile', label: 'Open File', category: 'File', defaults: ['Ctrl+KeyO'] },
    { id: 'openFolder', label: 'Open Folder', category: 'File', defaults: ['Ctrl+KeyF'] },
    { id: 'queueFiles', label: 'Enqueue Files', category: 'File', defaults: ['Ctrl+Shift+KeyO'] },
    { id: 'openStream', label: 'Open Network Stream & Downloader', category: 'File', defaults: ['Ctrl+KeyN'] },
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
    { id: 'nextChapter', label: 'Next Chapter', category: 'Navigation', defaults: ['PageDown', 'Ctrl+ArrowRight'] },
    { id: 'prevChapter', label: 'Previous Chapter', category: 'Navigation', defaults: ['PageUp', 'Ctrl+ArrowLeft'] },
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
    ignoredUpdateVersion: null,
    availableUpdate: null,

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
    autoPlaySubtitles: true,
    rememberState: true,
    resumeLastVideo: false,
    autoPauseOnMinimize: true,
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
    probedAudioTracks: [],
    probedSubtitleTracks: [],
    activeEmbeddedSubTrackIndex: -1,
    activeSessionAudioLang: null,      // Tracks user-selected audio language code (e.g. 'ja', 'en', 'de')
    activeSessionAudioTrackName: null, // Tracks user-selected audio track label/name
    activeSessionSubLang: null,        // Tracks user-selected subtitle language code (e.g. 'en', 'de', 'ja')
    userExplicitSubState: null,        // null (follow autoPlaySubtitles) | true (user forced ON) | false (user forced OFF)
    preferredAudioLang: 'en',
    fallbackSubtitles: true,
    embedSubtitlesOnDownload: true,
    autoPlayDownloads: true,
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
    isMinimized: false,
    wasPlayingBeforeMinimize: false,
    bossKeySuppressedResume: false,
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
    btnHeaderStream: $('btn-header-stream'),
    iconHeaderStream: $('icon-header-stream'),
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
    menuCycleAudio: $('menu-cycle-audio'),
    menuSnapshot: $('menu-snapshot'),
    menuCycleAspect: $('menu-cycle-aspect'),
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
    btnLibSearchClear: $('btn-lib-search-clear'),
    libFolderHeader: $('lib-folder-header'),
    libFolderLabel: $('lib-folder-label'),
    libFolderHeaderIcon: $('lib-folder-header-icon'),
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

    updatePromptBanner: $('update-prompt-banner'),
    updatePromptIcon: $('update-prompt-icon'),
    updatePromptBody: $('update-prompt-body'),
    updatePromptTitle: $('update-prompt-title'),
    updatePromptDesc: $('update-prompt-desc'),
    updateBannerProgressWrap: $('update-banner-progress-wrap'),
    updateBannerProgressFill: $('update-banner-progress-fill'),
    updateBannerProgressText: $('update-banner-progress-text'),
    updatePromptActions: $('update-prompt-actions'),
    btnUpdateNow: $('btn-update-now'),
    btnUpdateLater: $('btn-update-later'),
    btnUpdateSkip: $('btn-update-skip'),

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
    selAudioTrack: $('sel-audio-track'),
    lblAudioTrackSub: $('lbl-audio-track-sub'),
    swNightMode: $('sw-night-mode'),
    selEqPreset: $('sel-eq-preset'),
    lblAudioDelay: $('lbl-audio-delay'),
    btnAudioMinus25: $('btn-audio-minus25'),
    btnAudioReset: $('btn-audio-reset'),
    btnAudioPlus25: $('btn-audio-plus25'),
    swVisualizer: $('sw-visualizer'),

    swSubEnabled: $('sw-sub-enabled'),
    rowSubTrack: $('row-sub-track'),
    selSubTrack: $('sel-sub-track'),
    lblSubTrackSub: $('lbl-sub-track-sub'),
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
    swAutoplaySubtitles: $('sw-autoplay-subtitles'),
    selPreferredAudioLang: $('sel-preferred-audio-lang'),
    swFallbackSubtitles: $('sw-fallback-subtitles'),
    swRememberState: $('sw-remember-state'),
    swResumePlayback: $('sw-resume-playback'),
    swAutoPauseMinimize: $('sw-auto-pause-minimize'),
    btnCreateDesktopShortcut: $('btn-create-desktop-shortcut'),
    aiEndpointBox: $('ai-endpoint-box'),
    aiSampleCmd: $('ai-sample-cmd'),
    btnCopyAiCmd: $('btn-copy-ai-cmd'),
    btnCopyFullAiPrompt: $('btn-copy-full-ai-prompt'),
    btnInstallAiSkill: $('btn-install-ai-skill'),

    navBtnUpdates: $('nav-btn-updates'),
    settingsGroupUpdatesLbl: $('settings-group-updates-lbl'),
    settingsUpdateBadge: $('settings-update-badge'),
    updateCard: $('update-card'),
    updateCardTitle: $('update-card-title'),
    updateCardVersions: $('update-card-versions'),
    updateStatusPill: $('update-status-pill'),
    updateCardNotesWrap: $('update-card-notes-wrap'),
    updateCardNotes: $('update-card-notes'),
    updateCardProgressWrap: $('update-card-progress-wrap'),
    updateCardProgressFill: $('update-card-progress-fill'),
    updateCardProgressText: $('update-card-progress-text'),
    updateCardProgressBytes: $('update-card-progress-bytes'),
    btnSettingsUpdateNow: $('btn-settings-update-now'),
    btnSettingsCheckUpdates: $('btn-settings-check-updates'),

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
    menuOpenStream: $('menu-open-stream'),

    streamUrlInput: $('stream-url-input'),
    swStreamEmbedSub: $('sw-stream-embed-sub'),
    btnStreamPaste: $('btn-stream-paste'),
    btnStreamProbe: $('btn-stream-probe'),
    btnStreamNextEp: $('btn-stream-next-ep'),
    btnStreamSeason: $('btn-stream-season'),
    streamSeasonPanel: $('stream-season-panel'),
    seasonFromEp: $('season-from-ep'),
    seasonToEp: $('season-to-ep'),
    seasonFolderName: $('season-folder-name'),
    btnQueueSeason: $('btn-queue-season'),
    btnHaltAllDl: $('btn-halt-all-dl'),
    streamProbeResult: $('stream-probe-result'),
    btnStreamPlay: $('btn-stream-play'),
    btnStreamDownload: $('btn-stream-download'),
    streamIconBadge: $('stream-icon-badge'),
    btnStreamPlayIcon: $('btn-stream-play-icon'),
    btnStreamDlIcon: $('btn-stream-dl-icon'),
    downloadFolderDisplay: $('download-folder-display'),
    btnChooseDlFolder: $('btn-choose-dl-folder'),
    btnOpenDlFolder: $('btn-open-dl-folder'),
    swAutoPlayDl: $('sw-auto-play-dl'),
    dlQueueSection: $('dl-queue-section'),
    dlQueueContainer: $('dl-queue-container'),
    dlEmptyState: $('dl-empty-state'),
    dlQueueCount: $('dl-queue-count'),
    btnClearCompletedDl: $('btn-clear-completed-dl'),
    playerDlHud: $('player-dl-hud'),
    playerDlHudBadge: $('player-dl-hud-badge'),
    playerDlHudTitle: $('player-dl-hud-title'),
    playerDlHudPct: $('player-dl-hud-pct'),
    playerDlHudFill: $('player-dl-hud-fill'),
    playerDlHudStats: $('player-dl-hud-stats'),
    btnPlayerDlPlay: $('btn-player-dl-play'),
    btnPlayerDlQueue: $('btn-player-dl-queue'),
    btnPlayerDlCancel: $('btn-player-dl-cancel'),
    btnPlayerDlDismiss: $('btn-player-dl-dismiss'),
    topDlIndicator: $('top-dl-indicator'),
    topDlTitle: $('top-dl-title'),
    topDlPct: $('top-dl-pct'),
    topDlFill: $('top-dl-fill'),
    streamFilenameInput: $('stream-filename-input'),

    // Media Editor & File Processing Tools
    editorSourcePath: $('editor-source-path'),
    btnEditorBrowseFile: $('btn-editor-browse-file'),
    btnEditorUseCurrent: $('btn-editor-use-current'),
    editorFileBadge: $('editor-file-badge'),
    editorBadgeFilename: $('editor-badge-filename'),
    editorBadgeSize: $('editor-badge-size'),
    editorBadgeFormat: $('editor-badge-format'),
    editorBadgeRes: $('editor-badge-res'),
    editorBadgeDuration: $('editor-badge-duration'),
    editorBadgeAudio: $('editor-badge-audio'),
    editorBadgeSub: $('editor-badge-sub'),
    subpanelConverter: $('subpanel-converter'),
    subpanelSubtitles: $('subpanel-subtitles'),
    subpanelMetadata: $('subpanel-metadata'),
    converterFormatSelect: $('converter-format-select'),
    converterModeSelect: $('converter-mode-select'),
    converterReencodeOptions: $('converter-reencode-options'),
    converterResSelect: $('converter-res-select'),
    converterCrfSelect: $('converter-crf-select'),
    converterOutputPath: $('converter-output-path'),
    btnConverterBrowseDest: $('btn-converter-browse-dest'),
    btnStartConvert: $('btn-start-convert'),
    converterSummaryText: $('converter-summary-text'),
    converterProgressBox: $('converter-progress-box'),
    converterStatusLabel: $('converter-status-label'),
    converterPercentLabel: $('converter-percent-label'),
    converterProgressBar: $('converter-progress-bar'),
    converterStatsLabel: $('converter-stats-label'),
    btnConverterCancel: $('btn-converter-cancel'),
    converterCompleteBanner: $('converter-complete-banner'),
    btnConverterPlayResult: $('btn-converter-play-result'),
    btnConverterShowResult: $('btn-converter-show-result'),
    subSearchQuery: $('sub-search-query'),
    subSearchLang: $('sub-search-lang'),
    btnSubSearchOnline: $('btn-sub-search-online'),
    btnSubDetectLocal: $('btn-sub-detect-local'),
    subResultsContainer: $('sub-results-container'),
    subEmbedFile: $('sub-embed-file'),
    btnSubBrowseLocal: $('btn-sub-browse-local'),
    subEmbedMode: $('sub-embed-mode'),
    subEmbedLang: $('sub-embed-lang'),
    subEmbedTitle: $('sub-embed-title'),
    btnStartSubEmbed: $('btn-start-sub-embed'),
    subEmbedProgressBox: $('sub-embed-progress-box'),
    subEmbedStatusLabel: $('sub-embed-status-label'),
    subEmbedPercentLabel: $('sub-embed-percent-label'),
    subEmbedProgressBar: $('sub-embed-progress-bar'),
    subEmbedStatsLabel: $('sub-embed-stats-label'),
    btnSubEmbedCancel: $('btn-sub-embed-cancel'),
    subEmbedCompleteBanner: $('sub-embed-complete-banner'),
    btnSubEmbedPlayResult: $('btn-sub-embed-play-result'),
    btnSubEmbedShowResult: $('btn-sub-embed-show-result'),
    btnMetaPull: $('btn-meta-pull'),
    btnMetaDetectFn: $('btn-meta-detect-fn'),
    metaFieldTitle: $('meta-field-title'),
    metaFieldShow: $('meta-field-show'),
    metaFieldSeason: $('meta-field-season'),
    metaFieldEpisode: $('meta-field-episode'),
    metaFieldYear: $('meta-field-year'),
    metaFieldArtist: $('meta-field-artist'),
    metaFieldComment: $('meta-field-comment'),
    metaFieldAudioLang: $('meta-field-audio-lang'),
    btnSaveMetadata: $('btn-save-metadata'),
    metaSaveFeedback: $('meta-save-feedback'),

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
  let limiterNode = null;
  let softClipperNode = null;
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

      // Downstream Safety Peak Limiter & Soft-Clipper downstream of the 200% Gain Boost:
      // 1. Fast peak compressor stage: Attenuates heavy gain overshoot with 20:1 ratio and -0.5 dBFS threshold
      limiterNode = audioCtx.createDynamicsCompressor();
      limiterNode.threshold.value = -0.5; // Peak ceiling in dBFS
      limiterNode.knee.value = 0.0;       // Hard knee for rapid response
      limiterNode.ratio.value = 20.0;     // 20:1 high compression ratio
      limiterNode.attack.value = 0.002;   // 2ms ultra-fast attack
      limiterNode.release.value = 0.05;   // 50ms fast recovery to prevent volume pumping

      // 2. Oversampled Soft-Clipper stage: Sigmoid tanh curve catches any instantaneous micro-transients
      // during the 2ms attack window to prevent harsh digital clipping on boosted audio
      softClipperNode = audioCtx.createWaveShaper();
      const clipSamples = 1024;
      const clipCurve = new Float32Array(clipSamples);
      const tanhNorm = Math.tanh(1.25);
      for (let i = 0; i < clipSamples; i++) {
        const x = (i * 2) / clipSamples - 1;
        clipCurve[i] = Math.tanh(x * 1.25) / tanhNorm;
      }
      softClipperNode.curve = clipCurve;
      softClipperNode.oversample = '2x';

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(compressorNode);
      compressorNode.connect(delayNode);
      delayNode.connect(analyserNode);
      analyserNode.connect(gainNode);
      gainNode.connect(limiterNode);
      limiterNode.connect(softClipperNode);
      softClipperNode.connect(audioCtx.destination);

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
      try {
        gainNode.gain.cancelScheduledValues(0);
      } catch {}
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

  // ==================== MULTI-TRACK AUDIO & DUAL AUDIO SWITCHER ====================
  const LANG_PATTERNS = {
    en: /en|eng|english/i,
    ja: /ja|jpn|japanese/i,
    de: /de|deu|ger|german|deutsch/i,
    hu: /hu|hun|hungarian|magyar/i,
    es: /es|spa|spanish|español/i,
    fr: /fr|fre|fra|french|français/i,
    it: /it|ita|italian|italiano/i,
    pt: /pt|por|portuguese|português/i,
    ru: /ru|rus|russian/i,
    zh: /zh|zho|chi|chinese/i,
    ko: /ko|kor|korean/i,
    in: /in|id|ind|indonesian/i,
    th: /th|tha|thai/i
  };

  function detectLanguageCodeFromTrack(trackOrObj) {
    if (!trackOrObj) return null;
    const str = typeof trackOrObj === 'string'
      ? trackOrObj
      : `${trackOrObj.lang || ''} ${trackOrObj.language || ''} ${trackOrObj.name || ''} ${trackOrObj.label || ''} ${trackOrObj.title || ''}`;
    for (const [code, pattern] of Object.entries(LANG_PATTERNS)) {
      if (pattern.test(str)) return code;
    }
    const rawLang = (typeof trackOrObj === 'object' ? (trackOrObj.lang || trackOrObj.language) : null);
    if (rawLang && typeof rawLang === 'string' && rawLang.trim().length >= 2 && rawLang.trim().toLowerCase() !== 'und') {
      return rawLang.trim().toLowerCase();
    }
    return null;
  }

  function normalizeLangCode(codeOrName) {
    if (!codeOrName || typeof codeOrName !== 'string') return null;
    const trimmed = codeOrName.trim().toLowerCase();
    for (const [code, pattern] of Object.entries(LANG_PATTERNS)) {
      if (pattern.test(trimmed)) return code;
    }
    return trimmed;
  }

  function matchesLanguage(track, langCode) {
    if (!track || !langCode || langCode === 'none') return false;
    const pattern = LANG_PATTERNS[langCode];
    const lang = (track.lang || track.language || '').toLowerCase();
    const name = (track.name || track.label || track.title || '').toLowerCase();
    if (pattern) {
      return pattern.test(lang) || pattern.test(name);
    }
    const target = langCode.toLowerCase();
    return lang.includes(target) || name.includes(target);
  }

  function getAudioTracksList() {
    if (state.hls && Array.isArray(state.hls.audioTracks) && state.hls.audioTracks.length > 0) {
      return state.hls.audioTracks.map((t, idx) => ({
        index: idx,
        name: t.name || (t.lang ? t.lang.toUpperCase() : `Audio Track ${idx + 1}`),
        lang: t.lang || '',
        enabled: state.hls.audioTrack === idx
      }));
    }

    const currentItem = getCurrentItem();
    const itemTitle = currentItem?.title || currentItem?.name || currentItem?.filePath || '';
    const isDub = /dub/i.test(itemTitle);
    const isAnime = /(?:\[.*?\]|\b(?:ep(?:isode)?\.?\s*\d+|s\d+\s*e\d+|season\s*\d+|owarimonogatari|monogatari|naruto|piece|bleach|jujutsu|frieren|knight|elaina|witch|slime|re:zero|titan|hero|dungeon|isekai|danmachi|sword|art|online|shield|solo|leveling)\b)/i.test(itemTitle)
      || (state.currentChapters && state.currentChapters.length > 0)
      || (state.currentSegments && state.currentSegments.length > 0)
      || (state.subCues && state.subCues.length > 0)
      || /copycat/i.test(itemTitle);

    const resolveTrackLabel = (rawName, langCode, idx, totalTracks) => {
      let name = rawName || '';
      const lang = (langCode || '').toLowerCase().trim();
      if (!name || name === 'SoundHandler' || /^audio\s*track/i.test(name) || /^track\s*\d+/i.test(name) || /^default/i.test(name)) {
        if (/jpn|ja/i.test(lang)) {
          return 'Japanese (Original)';
        } else if (/eng|en/i.test(lang)) {
          return isDub ? 'English (Dub)' : 'English';
        } else if (/ger|deu|de/i.test(lang)) {
          return 'German';
        } else if (/hungarian|magyar|hun|hu/i.test(lang)) {
          return 'Hungarian';
        } else if (/fra|fre|fr/i.test(lang)) {
          return 'French';
        } else if (/spa|es/i.test(lang)) {
          return 'Spanish';
        } else if (isAnime) {
          if (totalTracks > 1) {
            return idx === 0 ? (isDub ? 'English (Dub)' : 'Japanese (Original)') : (isDub ? 'Japanese (Original)' : 'English (Dub)');
          }
          return isDub ? 'English (Dub)' : 'Japanese (Original)';
        }
        return `Audio Track ${idx + 1}${lang ? ` [${lang.toUpperCase()}]` : ''}`;
      }
      if (/japanese|ja-jp|jpn/i.test(name)) return 'Japanese (Original)';
      if (/english|en-us|eng/i.test(name)) return 'English (Dub)';
      if (/hungarian|magyar|hun/i.test(name)) return 'Hungarian';
      return name;
    };

    if (el.video && el.video.audioTracks && el.video.audioTracks.length > 0) {
      const list = [];
      const totalTracks = el.video.audioTracks.length;
      for (let i = 0; i < totalTracks; i++) {
        const t = el.video.audioTracks[i];
        const probed = state.probedAudioTracks?.[i];
        const rawName = t.label || probed?.name;
        const langCode = t.language || probed?.lang || (isAnime ? (isDub ? (i === 0 ? 'eng' : 'jpn') : (i === 0 ? 'jpn' : 'eng')) : '');
        const name = resolveTrackLabel(rawName, langCode, i, totalTracks);
        list.push({
          index: i,
          name,
          lang: langCode,
          enabled: Boolean(t.enabled)
        });
      }
      return list;
    }

    if (Array.isArray(state.probedAudioTracks) && state.probedAudioTracks.length > 0) {
      const totalTracks = state.probedAudioTracks.length;
      return state.probedAudioTracks.map((p, idx) => {
        const langCode = p.lang || (isAnime ? (isDub ? (idx === 0 ? 'eng' : 'jpn') : (idx === 0 ? 'jpn' : 'eng')) : '');
        const name = resolveTrackLabel(p.name, langCode, idx, totalTracks);
        return {
          index: idx,
          name,
          lang: langCode,
          enabled: idx === 0
        };
      });
    }

    return [];
  }

  function syncAudioTracksDropdown() {
    if (!el.selAudioTrack) return;
    const tracks = getAudioTracksList();
    const currentItem = getCurrentItem();
    const itemTitle = currentItem?.title || currentItem?.name || currentItem?.filePath || '';
    const isDub = /dub/i.test(itemTitle);
    const isAnime = /(?:\[.*?\]|\b(?:ep(?:isode)?\.?\s*\d+|s\d+\s*e\d+|season\s*\d+|owarimonogatari|monogatari|naruto|piece|bleach|jujutsu|frieren|knight|elaina|witch|slime|re:zero|titan|hero|dungeon|isekai|danmachi|sword|art|online|shield|solo|leveling)\b)/i.test(itemTitle)
      || (state.currentChapters && state.currentChapters.length > 0)
      || (state.currentSegments && state.currentSegments.length > 0)
      || (state.subCues && state.subCues.length > 0)
      || /copycat/i.test(itemTitle);

    if (tracks.length <= 1) {
      let label = tracks.length === 1 ? tracks[0].name : '';
      if (!label && state.probedAudioTracks && state.probedAudioTracks.length > 0) {
        label = state.probedAudioTracks[0].name;
      }
      if (!label || /^audio\s*track/i.test(label) || /^default/i.test(label)) {
        label = isAnime ? (isDub ? 'English (Dub)' : 'Japanese (Original)') : 'Default Audio (Stereo)';
      }
      if (el.selAudioTrack.options.length !== 1 || el.selAudioTrack.options[0].textContent !== label) {
        el.selAudioTrack.innerHTML = `<option value="0" selected>${escapeHtml(label)}</option>`;
      }
      el.selAudioTrack.disabled = false;
      if (el.lblAudioTrackSub) el.lblAudioTrackSub.textContent = `${label} • Single audio track`;
      return;
    }

    el.selAudioTrack.disabled = false;
    if (el.lblAudioTrackSub) el.lblAudioTrackSub.textContent = `${tracks.length} audio tracks available (Dual Audio)`;
    const anyEnabled = tracks.some((t) => t.enabled);
    const activeTrack = tracks.find((t) => t.enabled) || tracks[0];

    // Rebuild options only when necessary, preserving focus & preventing dropdown flicker
    if (el.selAudioTrack.options.length !== tracks.length) {
      el.selAudioTrack.innerHTML = tracks.map((t, idx) => {
        let label = t.name;
        if (/japanese|ja/i.test(label) || /jpn/i.test(t.lang || '')) label = 'Japanese (Original)';
        else if (/english|en/i.test(label) || /eng/i.test(t.lang || '')) label = 'English (Dub)';
        const isSelected = anyEnabled ? t.enabled : (idx === 0);
        return `<option value="${t.index}" ${isSelected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('');
    }

    if (activeTrack) {
      el.selAudioTrack.value = String(activeTrack.index);
    }
  }

  function setAudioTrack(trackIndex, isUserInitiated = false, notify = true) {
    const tracks = getAudioTracksList();
    if (tracks.length === 0) return;
    const targetIdx = Math.max(0, Math.min(tracks.length - 1, trackIndex));

    const wasPlaying = !el.video.paused;
    const curTime = el.video.currentTime;

    if (state.hls && Array.isArray(state.hls.audioTracks)) {
      state.hls.audioTrack = targetIdx;
    } else if (el.video && el.video.audioTracks && el.video.audioTracks.length > 0) {
      for (let i = 0; i < el.video.audioTracks.length; i++) {
        el.video.audioTracks[i].enabled = (i === targetIdx);
      }

      // Automatically un-stall Chromium's media demuxer:
      // In Chromium, toggling AudioTrack.enabled on an MP4 leaves the demuxer waiting
      // for new audio packets, stalling video playback until an explicit seek occurs.
      // Performing an imperceptible 10ms micro-seek flushes the demuxer buffers and
      // binds the newly selected audio stream immediately, resuming playback seamlessly.
      const dur = getDuration();
      const nudge = (Number.isFinite(dur) && curTime + 0.01 < dur) ? curTime + 0.01 : Math.max(0, curTime - 0.01);
      try {
        el.video.currentTime = nudge;
      } catch {}

      if (wasPlaying) {
        el.video.play().catch(() => {});
        setTimeout(() => {
          if (wasPlaying && el.video.paused) {
            el.video.play().catch(() => {});
          }
        }, 60);
      }
    }

    // Ensure AudioContext is active and Web Audio gainNode is not muted
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }
    applyVolumeToEngine();

    syncAudioTracksDropdown();
    const active = tracks[targetIdx];
    let label = active?.name || `Track ${targetIdx + 1}`;
    if (/japanese|ja/i.test(label) || /jpn/i.test(active?.lang || '')) label = 'Japanese';
    else if (/english|en/i.test(label) || /eng/i.test(active?.lang || '')) label = 'English';
    else if (/hungarian|magyar|hun|hu/i.test(label) || /hun|hu/i.test(active?.lang || '')) label = 'Hungarian';

    if (isUserInitiated && active) {
      const detectedLang = detectLanguageCodeFromTrack(active);
      if (detectedLang) {
        state.activeSessionAudioLang = detectedLang;
      }
      state.activeSessionAudioTrackName = active.name;
    }

    if (notify) {
      showToast(`Audio Track: ${label} (${targetIdx + 1}/${tracks.length})`);
    }
  }

  function cycleAudioTrack() {
    const tracks = getAudioTracksList();
    if (tracks.length <= 1) {
      showToast(tracks.length === 1 ? `Audio: ${tracks[0].name} (Single Track)` : 'No alternate audio track found');
      return;
    }
    const currentIdx = tracks.findIndex((t) => t.enabled);
    const nextIdx = (currentIdx + 1) % tracks.length;
    setAudioTrack(nextIdx, true, true);
  }

  function detectClientSubtitleLanguage(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text
      .replace(/^WEBVTT[^\r\n]*\r?\n+/i, '')
      .replace(/\d\d:\d\d(?::\d\d)?(?:\.\d+)?\s*-->\s*\d\d:\d\d(?::\d\d)?(?:\.\d+)?/g, '')
      .replace(/<[^>]+>/g, '')
      .slice(0, 15000);

    if (/[\u0e00-\u0e7f]/.test(clean)) return { name: 'Thai', lang: 'tha' };
    if (/[\u3040-\u30ff]/.test(clean)) return { name: 'Japanese', lang: 'jpn' };
    if (/[\uac00-\ud7af]/.test(clean)) return { name: 'Korean', lang: 'kor' };
    if (/[\u0400-\u04ff]/.test(clean)) return { name: 'Russian', lang: 'rus' };
    if (/[\u0600-\u06ff]/.test(clean)) return { name: 'Arabic', lang: 'ara' };
    if (/[\u4e00-\u9fa5]/.test(clean)) return { name: 'Chinese', lang: 'chi' };

    const huMatches = (clean.match(/\b(hogy|nem|egy|van|volt|lesz|mert|csak|még|már|vagy|mint|kell|tudom|lehet|ebben|abban|akkor|most|mindig|nagyon|után|senki|semmi)\b/gi) || []).length;
    const idMatches = (clean.match(/\b(yang|dan|di|ini|itu|tidak|ada|dari|untuk|kamu|aku|dia|kita|mereka|bisa|sudah|dengan|akan|apa|pada|saya|kau|kami|jangan|bukan)\b/gi) || []).length;
    const deMatches = (clean.match(/\b(und|der|die|das|ich|nicht|sie|ein|eine|ist|wir|haben|mit|dem|den|aber|wie|dass|sich|oder|wenn)\b/gi) || []).length;
    const esMatches = (clean.match(/\b(que|de|no|el|la|es|un|una|los|las|por|con|para|yo|pero|está|como|más|este|esta)\b/gi) || []).length;
    const frMatches = (clean.match(/\b(que|de|ne|pas|le|la|les|un|une|est|et|des|en|du|pour|avec|dans|mais|elle|nous)\b/gi) || []).length;
    const itMatches = (clean.match(/\b(che|di|non|il|la|un|una|per|con|sono|ma|questo|questa|come|cosa|tutto|anche)\b/gi) || []).length;
    const ptMatches = (clean.match(/\b(que|de|não|o|a|os|as|um|uma|com|para|por|em|este|esta|você|isso|mas)\b/gi) || []).length;
    const enMatches = (clean.match(/\b(the|and|you|that|was|for|are|with|his|they|this|have|from|one|had|not|but|what|all|were|when|your|can|there|out|about)\b/gi) || []).length;

    const scores = [
      { name: 'Hungarian', lang: 'hun', score: huMatches },
      { name: 'English', lang: 'eng', score: enMatches },
      { name: 'Indonesian', lang: 'ind', score: idMatches },
      { name: 'German', lang: 'ger', score: deMatches },
      { name: 'Spanish', lang: 'spa', score: esMatches },
      { name: 'French', lang: 'fra', score: frMatches },
      { name: 'Italian', lang: 'ita', score: itMatches },
      { name: 'Portuguese', lang: 'por', score: ptMatches }
    ].sort((a, b) => b.score - a.score);

    if (scores[0] && scores[0].score >= 2) {
      return { name: scores[0].name, lang: scores[0].lang };
    }
    return null;
  }

  function syncSubtitleTracksDropdown() {
    if (!el.selSubTrack || !el.rowSubTrack) return;
    const subTracks = state.probedSubtitleTracks || [];
    if (subTracks.length === 0) {
      if (state.subCues && state.subCues.length > 0) {
        el.rowSubTrack.style.display = 'flex';
        if (el.lblSubTrackSub) {
          el.lblSubTrackSub.textContent = '1 subtitle track loaded';
        }
        const langLabel = state.subTrackLanguage
          ? `${state.subTrackLanguage} (Original)`
          : (state.subTrackName || 'Active Subtitles');
        const isOff = !state.subEnabled;
        el.selSubTrack.innerHTML = `
          <option value="0" ${!isOff ? 'selected' : ''} style="background:#181818;color:#fff;">${escapeHtml(langLabel)}</option>
          <option value="-1" ${isOff ? 'selected' : ''} style="background:#181818;color:#aaa;">Off</option>
        `;
        el.selSubTrack.value = isOff ? '-1' : '0';
        return;
      }
      el.rowSubTrack.style.display = 'none';
      return;
    }

    el.rowSubTrack.style.display = 'flex';
    if (el.lblSubTrackSub) {
      el.lblSubTrackSub.textContent = `${subTracks.length} embedded track${subTracks.length > 1 ? 's' : ''} available`;
    }

    const currentIdx = state.activeEmbeddedSubTrackIndex ?? -1;
    let optsHtml = `<option value="-1" ${currentIdx === -1 ? 'selected' : ''} style="background:#181818;color:#aaa;">Off / External</option>`;
    subTracks.forEach((st, idx) => {
      let label = st.name || `Subtitle Track ${idx + 1}`;
      if (st.lang && st.lang !== 'und' && !label.toLowerCase().includes(st.lang.toLowerCase())) {
        label += ` [${st.lang.toUpperCase()}]`;
      }
      optsHtml += `<option value="${idx}" ${currentIdx === idx ? 'selected' : ''} style="background:#181818;color:#fff;">${escapeHtml(label)}</option>`;
    });
    el.selSubTrack.innerHTML = optsHtml;
    el.selSubTrack.value = String(currentIdx);
  }

  async function selectEmbeddedSubtitleTrack(trackIdx, isUserInitiated = false, notify = true) {
    if (!state.currentItem || !state.currentItem.filePath || !api.extractEmbeddedSubtitle) return;
    const subTracks = state.probedSubtitleTracks || [];
    const track = subTracks[trackIdx];
    if (!track) return;

    try {
      if (notify) showToast(`Loading ${track.name || 'embedded'} subtitle...`);
      const res = await api.extractEmbeddedSubtitle(state.currentItem.filePath, track.index !== undefined ? track.index : trackIdx);
      if (res && res.ok && res.content) {
        state.activeEmbeddedSubTrackIndex = trackIdx;
        state.subEnabled = true;
        if (isUserInitiated) {
          state.userExplicitSubState = true;
        }
        if (!track.name || track.name.startsWith('Subtitle Track') || !track.lang || track.lang === 'und') {
          const detected = detectClientSubtitleLanguage(res.content);
          if (detected) {
            track.name = detected.name;
            track.lang = detected.lang;
          }
        }
        const detectedCode = detectLanguageCodeFromTrack(track) || (track.lang ? normalizeLangCode(track.lang) : null);
        if (isUserInitiated && detectedCode) {
          state.activeSessionSubLang = detectedCode;
        }
        loadSubtitleData({
          name: `${track.name || 'Embedded'} Subtitle`,
          content: res.content
        }, notify, isUserInitiated);
        if (el.swSubEnabled) el.swSubEnabled.classList.add('on');
        if (el.subtitleOverlay) el.subtitleOverlay.style.display = 'block';
        syncSubtitleTracksDropdown();
      } else if (notify) {
        showToast('Failed to extract subtitle track');
      }
    } catch (err) {
      console.warn('Failed to extract subtitle track:', err);
      if (notify) showToast('Error extracting subtitle');
    }
  }

  // ==================== PREFERRED LANGUAGE & SESSION SUBTITLES ====================
  let languagePreferenceAppliedAudio = false;
  let languagePreferenceAppliedSub = false;

  async function applyLanguagePreferencesOnLoad(probe = null) {
    if (!state.currentItem) return;

    // 1. Audio Track Preference
    if (!languagePreferenceAppliedAudio) {
      const prefAudio = state.activeSessionAudioLang || state.preferredAudioLang || 'en';
      if (prefAudio !== 'none') {
        const audioTracks = getAudioTracksList();
        if (audioTracks.length > 0) {
          let matchIdx = -1;
          if (state.activeSessionAudioTrackName) {
            matchIdx = audioTracks.findIndex((t) => t.name && t.name.toLowerCase() === state.activeSessionAudioTrackName.toLowerCase());
          }
          if (matchIdx < 0) {
            matchIdx = audioTracks.findIndex((t) => matchesLanguage(t, prefAudio));
          }
          if (matchIdx >= 0) {
            languagePreferenceAppliedAudio = true;
            const currentActive = audioTracks.findIndex((t) => t.enabled);
            if (currentActive !== matchIdx) {
              setAudioTrack(matchIdx, false, false);
            }
          } else if (audioTracks.length > 1) {
            languagePreferenceAppliedAudio = true;
          }
        }
      }
    }

    // 2. Subtitle Track & Visibility Preference
    if (!languagePreferenceAppliedSub) {
      const wantSubtitles = (state.userExplicitSubState !== null)
        ? Boolean(state.userExplicitSubState)
        : Boolean(state.autoPlaySubtitles);

      if (!wantSubtitles) {
        languagePreferenceAppliedSub = true;
        state.subEnabled = false;
        if (el.swSubEnabled) el.swSubEnabled.classList.remove('on');
        if (el.subtitleOverlay) el.subtitleOverlay.style.display = 'none';
        return;
      }

      state.subEnabled = true;
      if (el.swSubEnabled) el.swSubEnabled.classList.add('on');
      if (el.subtitleOverlay) el.subtitleOverlay.style.display = 'block';

      const targetSubLang = state.activeSessionSubLang
        || (state.preferredAudioLang !== 'none' ? state.preferredAudioLang : 'en');

      const subTracks = probe?.subtitleTracks || state.probedSubtitleTracks || [];

      // 2A. Embedded subtitle tracks
      if (subTracks.length > 0 && state.currentItem.filePath && api.extractEmbeddedSubtitle) {
        let matchSubIdx = -1;
        if (targetSubLang && targetSubLang !== 'none') {
          matchSubIdx = subTracks.findIndex((s) => matchesLanguage(s, targetSubLang));
        }
        if (matchSubIdx < 0) {
          matchSubIdx = subTracks.findIndex((s) => matchesLanguage(s, 'en'));
        }
        if (matchSubIdx < 0) {
          matchSubIdx = 0;
        }

        if (matchSubIdx >= 0) {
          languagePreferenceAppliedSub = true;
          await selectEmbeddedSubtitleTrack(matchSubIdx, false, false);
          return;
        }
      }

      // 2B. Companion subtitle (.srt / .vtt)
      if (state.currentItem.autoSubPath) {
        languagePreferenceAppliedSub = true;
        const subData = await api.readSubtitle(state.currentItem.autoSubPath);
        if (subData) {
          loadSubtitleData(subData, false, false);
          return;
        }
      }

      // 2C. Chromium native textTracks
      if (el.video && el.video.textTracks && el.video.textTracks.length > 0) {
        let matchTtIdx = -1;
        if (targetSubLang && targetSubLang !== 'none') {
          for (let i = 0; i < el.video.textTracks.length; i++) {
            if (matchesLanguage(el.video.textTracks[i], targetSubLang)) {
              matchTtIdx = i;
              break;
            }
          }
        }
        if (matchTtIdx < 0) matchTtIdx = 0;
        if (matchTtIdx >= 0) {
          languagePreferenceAppliedSub = true;
          for (let j = 0; j < el.video.textTracks.length; j++) {
            el.video.textTracks[j].mode = (j === matchTtIdx) ? 'showing' : 'disabled';
          }
          return;
        }
      }

      if (probe) {
        languagePreferenceAppliedSub = true;
      }
    }
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
      autoPlaySubtitles: state.autoPlaySubtitles,
      preferredAudioLang: state.preferredAudioLang,
      fallbackSubtitles: state.fallbackSubtitles,
      embedSubtitlesOnDownload: state.embedSubtitlesOnDownload,
      autoPlayDownloads: state.autoPlayDownloads,
      rememberState: state.rememberState,
      resumeLastVideo: state.resumeLastVideo,
      autoPauseOnMinimize: state.autoPauseOnMinimize,
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
      ignoredUpdateVersion: state.ignoredUpdateVersion,
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
      if (typeof d.ignoredUpdateVersion === 'string') state.ignoredUpdateVersion = d.ignoredUpdateVersion;
      if (d.folderPlaybackV3 && typeof d.autoLoadFolder === 'boolean') {
        state.autoLoadFolder = d.autoLoadFolder;
      } else {
        state.autoLoadFolder = true;
      }
      if (typeof d.autoLoadSub === 'boolean') state.autoLoadSub = d.autoLoadSub;
      if (typeof d.autoPlaySubtitles === 'boolean') state.autoPlaySubtitles = d.autoPlaySubtitles;
      if (typeof d.preferredAudioLang === 'string') state.preferredAudioLang = d.preferredAudioLang;
      if (typeof d.fallbackSubtitles === 'boolean') state.fallbackSubtitles = d.fallbackSubtitles;
      if (typeof d.embedSubtitlesOnDownload === 'boolean') state.embedSubtitlesOnDownload = d.embedSubtitlesOnDownload;
      if (typeof d.autoPlayDownloads === 'boolean') state.autoPlayDownloads = d.autoPlayDownloads;
      if (typeof d.rememberState === 'boolean') state.rememberState = d.rememberState;
      if (typeof d.resumeLastVideo === 'boolean') state.resumeLastVideo = d.resumeLastVideo;
      if (typeof d.autoPauseOnMinimize === 'boolean') state.autoPauseOnMinimize = d.autoPauseOnMinimize;
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
    if (el.swAutoplaySubtitles) el.swAutoplaySubtitles.classList.toggle('on', state.autoPlaySubtitles);
    if (el.swFallbackSubtitles) el.swFallbackSubtitles.classList.toggle('on', Boolean(state.fallbackSubtitles));
    if (el.swStreamEmbedSub) el.swStreamEmbedSub.classList.toggle('on', Boolean(state.embedSubtitlesOnDownload));
    if (el.swAutoPlayDl) el.swAutoPlayDl.classList.toggle('on', Boolean(state.autoPlayDownloads));
    if (el.selPreferredAudioLang) el.selPreferredAudioLang.value = state.preferredAudioLang || 'en';
    if (el.swRememberState) el.swRememberState.classList.toggle('on', state.rememberState);
    if (el.swResumePlayback) el.swResumePlayback.classList.toggle('on', Boolean(state.resumeLastVideo));
    if (el.swAutoPauseMinimize) el.swAutoPauseMinimize.classList.toggle('on', Boolean(state.autoPauseOnMinimize));

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
    state.autoPlaySubtitles = true;
    state.embedSubtitlesOnDownload = true;
    state.autoPlayDownloads = true;
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

  function loadSubtitleData(subObj, notify = true, isUserInitiated = false) {
    lastActiveSubCue = null;
    if (!subObj || !subObj.content) {
      clearSubtitles();
      return;
    }
    state.loadedExternalSubData = subObj;
    state.subCues = parseSubtitles(subObj.content);
    const detected = detectClientSubtitleLanguage(subObj.content);
    state.subTrackLanguage = detected ? detected.name : '';
    state.subTrackName = detected ? `${detected.name} Subtitles` : (subObj.name || 'External Subtitles');
    state.subOffsetMs = 0;

    if (isUserInitiated) {
      state.userExplicitSubState = true;
      state.subEnabled = true;
      const detectedCode = detected?.lang ? normalizeLangCode(detected.lang) : detectLanguageCodeFromTrack(subObj.name);
      if (detectedCode) {
        state.activeSessionSubLang = detectedCode;
      }
      if (el.swSubEnabled) el.swSubEnabled.classList.add('on');
      if (el.subtitleOverlay) el.subtitleOverlay.style.display = 'block';
    }

    if (el.lblSubTrack) {
      el.lblSubTrack.textContent = state.subTrackName;
      el.lblSubTrack.title = subObj.name || state.subTrackName;
    }
    if (el.lblSubOffset) el.lblSubOffset.textContent = '0 ms';
    el.btnSubPop.classList.toggle('active', state.subEnabled && state.subCues.length > 0);
    renderSubtitleBlocksOnSeekbar();
    updateActiveSubtitleCue();
    syncSubtitleTracksDropdown();
    if (notify) {
      showToast(`Subtitles loaded: ${state.subTrackName} (${state.subCues.length} lines)`);
    }
  }

  function clearSubtitles() {
    lastActiveSubCue = null;
    state.subCues = [];
    state.subTrackName = null;
    state.subTrackLanguage = '';
    state.subOffsetMs = 0;
    state.activeEmbeddedSubTrackIndex = -1;
    if (el.lblSubTrack) {
      el.lblSubTrack.textContent = 'No subtitle loaded';
      el.lblSubTrack.title = '';
    }
    if (el.lblSubOffset) el.lblSubOffset.textContent = '0 ms';
    el.subtitleOverlay.classList.remove('visible');
    el.subtitleOverlay.textContent = '';
    el.seekbarSubBlocks.innerHTML = '';
    if (el.subSyncMini) el.subSyncMini.classList.remove('visible');
    el.btnSubPop.classList.remove('active');
    syncSubtitleTracksDropdown();
  }

  function renderSubtitleBlocksOnSeekbar() {
    el.seekbarSubBlocks.innerHTML = '';
    const dur = getDuration();
    const hasSubs = state.subCues.length > 0 && state.subEnabled;
    if (el.subSyncMini) el.subSyncMini.classList.remove('visible');

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
  function buildStreamUrl(filePath, startSec, audioPath = '') {
    const params = new URLSearchParams({
      path: filePath,
      start: startSec.toFixed(2),
      vcodec: state.streamVideoCodec || '',
      transcode: state.streamForceTranscode ? '1' : '0'
    });
    if (audioPath) {
      params.set('audio', audioPath);
    }
    return `http://127.0.0.1:${state.aiPort}/api/stream?${params.toString()}`;
  }

  async function startFfmpegStreamPlayback(item, startSec = 0, autoPlay = true, forceTranscode = false) {
    const isNet = Boolean(item.isNetworkStream || /^https?:\/\//i.test(item.filePath || ''));
    const probe = isNet ? null : await api.probeMedia(item.filePath);
    state.streamMode = true;
    state.streamOffset = startSec;
    state.streamDuration = probe?.duration || item.duration || 0;
    state.streamVideoCodec = probe?.videoCodec || item.videoCodec || (isNet ? 'h264' : '');
    state.streamForceTranscode = forceTranscode;
    state.currentChapters = probe?.chapters || [];
    state.currentSegments = classifySegments(state.currentChapters, state.streamDuration, item);
    lastStreamThumbSec = -999;

    thumbVideo.removeAttribute('src');
    el.video.crossOrigin = 'anonymous';
    el.video.loop = false; // Handled manually on 'ended' so loop starts at 0:00
    el.video.src = buildStreamUrl(item.filePath, startSec, item.audioStreamUrl || '');
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
    el.video.src = buildStreamUrl(item.filePath, clamped, item.audioStreamUrl || '');
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

  let activeHls = null;

  function destroyActiveHls() {
    if (activeHls) {
      try {
        activeHls.destroy();
      } catch {}
      activeHls = null;
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
    destroyActiveHls();

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
    state.probedAudioTracks = [];
    state.probedSubtitleTracks = [];
    state.activeEmbeddedSubTrackIndex = -1;
    syncSubtitleTracksDropdown();
    languagePreferenceAppliedAudio = false;
    languagePreferenceAppliedSub = false;
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

    // Auto-load matching local subtitle if enabled
    if (state.autoLoadSub && item.autoSubPath) {
      const subData = await api.readSubtitle(item.autoSubPath);
      if (subData) loadSubtitleData(subData, false, false);
    }

    // Auto-load remote stream subtitle (.vtt / .srt) if captured
    if (Array.isArray(item.subtitles) && item.subtitles.length > 0) {
      const preferredSub = item.subtitles.find((s) => /en|eng|english/i.test(s.label || s.lang || '')) || item.subtitles[0];
      if (preferredSub && preferredSub.url) {
        fetch(preferredSub.url).then((r) => (r.ok ? r.text() : null)).then((vttText) => {
          if (vttText && state.currentItem === item) {
            loadSubtitleData({ name: preferredSub.label || 'Stream Subtitles', content: vttText }, false, false);
          }
        }).catch(() => {});
      }
    }

    // Enforce subtitle autoplay & session preferences
    state.subEnabled = (state.userExplicitSubState !== null)
      ? Boolean(state.userExplicitSubState)
      : Boolean(state.autoPlaySubtitles);
    if (el.swSubEnabled) el.swSubEnabled.classList.toggle('on', state.subEnabled);
    if (el.subtitleOverlay) el.subtitleOverlay.style.display = state.subEnabled ? 'block' : 'none';

    updateVisualizerVisibility();
    renderLibraryList();
    renderRightDrawer();

    // 1. Native Hardware-Accelerated HLS.js MSE Engine for instant .m3u8 playback & zero-latency seeking
    if (item.isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      thumbVideo.removeAttribute('src');
      el.video.removeAttribute('crossorigin');
      el.video.playbackRate = state.speed;
      updateBottomSpeedBadge();
      el.video.loop = state.loop;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        fastAudioTrackSwitch: true
      });
      activeHls = hls;

      const hlsSourceUrl = item.masterUrl || item.fileUrl || item.filePath;
      hls.loadSource(hlsSourceUrl);
      hls.attachMedia(el.video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        if (state.currentItem !== item) return;
        if (item.preferredVideoUrl && Array.isArray(data.levels)) {
          const lvlIdx = data.levels.findIndex((l) =>
            l.url === item.preferredVideoUrl || (Array.isArray(l.url) && l.url.includes(item.preferredVideoUrl))
          );
          if (lvlIdx >= 0) hls.currentLevel = lvlIdx;
        }
        if (autoPlay) {
          playMedia();
        } else {
          updateTransportUI();
        }
        updateTimelineUI();
        pushPlayerStatus();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_evt, data) => {
        if (state.currentItem !== item || !Array.isArray(data.audioTracks)) return;
        if (item.preferredAudioUrl || item.preferredAudioName) {
          const aIdx = data.audioTracks.findIndex((t) =>
            (item.preferredAudioUrl && t.url === item.preferredAudioUrl) ||
            (item.preferredAudioName && t.name === item.preferredAudioName)
          );
          if (aIdx >= 0) hls.audioTrack = aIdx;
        }
      });

      let mediaRecoveries = 0;
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data || !data.fatal || state.currentItem !== item) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries++;
          hls.recoverMediaError();
        } else {
          destroyActiveHls();
          if (state.hasFfmpeg) {
            startFfmpegStreamPlayback(item, 0, autoPlay, false);
          }
        }
      });

      checkSessionPromptsForOpenedItem(item);
      return;
    }

    // 2. Proactively use FFmpeg Live Stream for MPEG-TS disguised as .mp4, AVI, TS, FLV, etc.
    if (item.needsStream && state.hasFfmpeg) {
      await startFfmpegStreamPlayback(item, 0, autoPlay, false);
      checkSessionPromptsForOpenedItem(item);
      return;
    }

    // 3. Standard native playback path (ISO MP4, WebM, Audio)
    el.video.removeAttribute('crossorigin');
    el.video.preload = 'auto';
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

    // Fetch chapters and detect segments via FFprobe asynchronously for local files
    if (!item.isAudio && !item.isNetworkStream && api.probeMedia && item.filePath) {
      api.probeMedia(item.filePath).then((probe) => {
        if (probe && probe.ok && state.currentItem === item) {
          state.currentChapters = probe.chapters || [];
          state.currentSegments = classifySegments(state.currentChapters, probe.duration || getDuration(), item);
          renderChapterMarkersOnSeekbar();
          updateTimelineUI();
          if (Array.isArray(probe.audioTracks) && probe.audioTracks.length > 0) {
            state.probedAudioTracks = probe.audioTracks;
            syncAudioTracksDropdown();
          }
          if (Array.isArray(probe.subtitleTracks)) {
            state.probedSubtitleTracks = probe.subtitleTracks;
            syncSubtitleTracksDropdown();
          }
          applyLanguagePreferencesOnLoad(probe);

          // If no embedded chapters, query AniList/AniSkip asynchronously in the background
          if (state.currentChapters.length === 0 && api.resolveAnimeChapters && (probe.duration || getDuration()) >= 60) {
            api.resolveAnimeChapters(item.filePath, probe.duration || getDuration()).then((bgChapters) => {
              if (Array.isArray(bgChapters) && bgChapters.length > 0 && state.currentItem === item) {
                state.currentChapters = bgChapters;
                state.currentSegments = classifySegments(state.currentChapters, probe.duration || getDuration(), item);
                renderChapterMarkersOnSeekbar();
                updateTimelineUI();
              }
            }).catch(() => {});
          }
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
      loadSubtitleData(bundle.subtitleOnly, true, true);
      return;
    }

    const items = bundle.items || [];
    if (!items.length) {
      showToast('No supported media files found');
      return;
    }

    if (bundle.folder && (!append || !state.libraryFolder)) {
      state.libraryFolder = bundle.folder;
      if (el.libFolderHeader) el.libFolderHeader.style.display = 'flex';
      el.libFolderLabel.textContent = bundle.folder.folderName || 'Folder';
      el.libFolderLabel.title = bundle.folder.folderPath || '';
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
    renderLibraryList({ scrollToTop: true });
    renderRightDrawer();
  }

  async function playLocalFile(filePath, autoPlay = true) {
    if (!filePath || !api.resolvePaths) return false;
    try {
      const res = await api.resolvePaths([filePath]);
      if (res && res.items && res.items.length > 0) {
        toggleSettingsModal(false);
        ingestOpenedBundle(res, autoPlay);
        return true;
      }
    } catch (err) {
      console.warn('Failed to play local file:', err);
    }
    return false;
  }

  function pathsMatch(a, b) {
    if (!a || !b) return false;
    const normA = a.replace(/[\\/]+$/, '').toLowerCase().replace(/\\/g, '/');
    const normB = b.replace(/[\\/]+$/, '').toLowerCase().replace(/\\/g, '/');
    return normA === normB;
  }

  async function navigateLibraryToFolder(folderPath, preserveFilter = false, options = {}) {
    if (!folderPath) return;
    const scanned = await api.scanFolder(folderPath);
    if (!scanned) return;
    state.libraryFolder = scanned;
    if (el.libFolderHeader) el.libFolderHeader.style.display = 'flex';
    if (!preserveFilter) {
      state.libraryFilter = '';
      if (el.libSearchInput) el.libSearchInput.value = '';
      if (el.btnLibSearchClear) el.btnLibSearchClear.style.display = 'none';
    }
    el.libFolderLabel.textContent = scanned.folderName || 'Folder';
    el.libFolderLabel.title = scanned.folderPath || '';
    renderSidebarShortcuts();
    renderLibraryList(options);
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
      pill.addEventListener('click', () => navigateLibraryToFolder(sc.path, false, { scrollToTop: true }));
      el.libQuickTabs.appendChild(pill);
    });
  }

  function setupLibItemScroller(rowEl, nameEl, textString) {
    nameEl.innerHTML = `<span class="lib-item-name-text">${escapeHtml(textString)}</span>`;
    rowEl.addEventListener('mouseenter', () => {
      const textEl = nameEl.querySelector('.lib-item-name-text');
      if (!textEl) return;
      const diff = textEl.scrollWidth - nameEl.clientWidth;
      if (diff > 4) {
        const dur = Math.max(2.6, Math.min(10, diff / 36));
        textEl.style.setProperty('--marquee-x', `-${diff + 6}px`);
        textEl.style.setProperty('--marquee-dur', `${dur}s`);
        rowEl.classList.add('is-scrolling');
      }
    });
    rowEl.addEventListener('mouseleave', () => {
      rowEl.classList.remove('is-scrolling');
    });
  }

  function renderLibraryList(options = {}) {
    if (el.libFolderHeader) {
      el.libFolderHeader.style.display = state.libraryFolder ? 'flex' : 'none';
    }
    if (el.librarySidebar.classList.contains('collapsed')) {
      state.libraryDirty = true;
      return;
    }
    state.libraryDirty = false;
    const previousScrollTop = el.libList.scrollTop;
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

    let targetRowToScroll = null;
    const targetFolderToScroll = options.scrollToFolder || null;
    const targetFolderBaseName = targetFolderToScroll
      ? targetFolderToScroll.replace(/[\\/]+$/, '').split(/[\\/]/).pop()?.toLowerCase()
      : null;

    // Parent folder ".." row when browsing a folder
    if (state.libraryFolder && parentPath) {
      const upRow = document.createElement('div');
      upRow.className = 'lib-item lib-parent-row';
      upRow.title = `Parent folder: ${parentPath}`;
      const badge = document.createElement('div');
      badge.className = 'lib-item-badge';
      badge.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`;
      const name = document.createElement('div');
      name.className = 'lib-item-name';
      name.style.display = 'flex';
      name.style.alignItems = 'center';
      name.style.gap = '6px';
      name.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);flex-shrink:0;"><path d="M3 7C3 5.9 3.9 5 5 5H9.2L11.2 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z"/></svg><span class="lib-parent-dots">..</span>`;
      upRow.appendChild(badge);
      upRow.appendChild(name);
      upRow.addEventListener('click', () => {
        const exitingFolderPath = state.libraryFolder?.folderPath || null;
        navigateLibraryToFolder(parentPath, false, { scrollToFolder: exitingFolderPath });
      });
      frag.appendChild(upRow);
    }

    // Subfolder rows so you can step straight into folders like Love Chunibyo / Filme
    filteredDirs.forEach((dir) => {
      const row = document.createElement('div');
      row.className = 'lib-item';
      row.title = dir.folderPath;

      if (targetFolderToScroll && !targetRowToScroll) {
        const isExactMatch = dir.folderPath && pathsMatch(dir.folderPath, targetFolderToScroll);
        const isNameMatch = dir.name && targetFolderBaseName && dir.name.toLowerCase() === targetFolderBaseName;
        if (isExactMatch || isNameMatch) {
          targetRowToScroll = row;
        }
      }

      const badge = document.createElement('div');
      badge.className = 'lib-item-badge';
      badge.style.color = 'var(--accent)';
      badge.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7C3 5.9 3.9 5 5 5H9.2L11.2 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z"/></svg>`;

      const name = document.createElement('div');
      name.className = 'lib-item-name';
      setupLibItemScroller(row, name, dir.name);

      row.appendChild(badge);
      row.appendChild(name);
      row.addEventListener('click', () => navigateLibraryToFolder(dir.folderPath, false, { scrollToTop: true }));
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
      setupLibItemScroller(row, name, item.title || item.name);

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
      if (q) {
        const msg = document.createElement('div');
        msg.textContent = `No matching media or subfolders for "${q}".`;
        const btnClear = document.createElement('button');
        btnClear.type = 'button';
        btnClear.className = 'lib-mini-link';
        btnClear.style.cssText = 'margin-top:8px;cursor:pointer;display:inline-block;';
        btnClear.textContent = 'Clear search';
        btnClear.addEventListener('click', () => {
          state.libraryFilter = '';
          if (el.libSearchInput) el.libSearchInput.value = '';
          if (el.btnLibSearchClear) el.btnLibSearchClear.style.display = 'none';
          renderLibraryList();
        });
        empty.appendChild(msg);
        empty.appendChild(btnClear);
      } else {
        empty.textContent = state.libraryFolder
          ? 'No media files or subfolders here.'
          : 'Select a shortcut above or click "+ Folder" to browse.';
      }
      frag.appendChild(empty);
    }

    el.libList.appendChild(frag);

    if (targetRowToScroll) {
      requestAnimationFrame(() => {
        try {
          targetRowToScroll.scrollIntoView({ block: 'center', behavior: 'auto' });
          targetRowToScroll.classList.add('nav-highlight');
          setTimeout(() => {
            targetRowToScroll?.classList.remove('nav-highlight');
          }, 1800);
        } catch {}
      });
    } else if (options.scrollToTop) {
      el.libList.scrollTop = 0;
      requestAnimationFrame(() => {
        el.libList.scrollTop = 0;
      });
    } else if (options.preserveScroll !== false && previousScrollTop > 0) {
      el.libList.scrollTop = previousScrollTop;
    }
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
        setupLibItemScroller(row, name, item.title || item.name);

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
  let isAutoPausingForMinimize = false;

  function playMedia() {
    if (!getCurrentItem()) return;
    ensureAudioGraph();
    el.video.play().catch((err) => console.warn('Play interrupted:', err));
  }

  function pauseMedia() {
    if (!isAutoPausingForMinimize) {
      state.wasPlayingBeforeMinimize = false;
    }
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
    state.lastSkippedSegmentId = null;
    const dur = getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    const clamped = Math.max(0, Math.min(dur, targetSec));

    if (!state.streamMode) {
      el.video.currentTime = clamped;
      updateTimelineUI();
      pushPlayerStatus();
      if (shouldPlayAfter && el.video.paused) {
        playMedia();
      }
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

  let deltaSeekDebounceTimer = null;

  function seekByDelta(deltaSec) {
    const dur = getDuration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    const cur = state.scrubPreviewTime !== null ? state.scrubPreviewTime : getCurrentTime();
    const target = Math.max(0, Math.min(dur, cur + deltaSec));
    showToast(`${deltaSec >= 0 ? '+' : ''}${deltaSec}s (${formatTime(target)})`);

    state.scrubPreviewTime = target;
    updateTimelineUI();

    const wasPlaying = !el.video.paused;
    if (state.streamMode) {
      if (streamSeekDebounceTimer) clearTimeout(streamSeekDebounceTimer);
      streamSeekDebounceTimer = setTimeout(() => {
        streamSeekDebounceTimer = null;
        const finalTarget = state.scrubPreviewTime !== null ? state.scrubPreviewTime : target;
        state.scrubPreviewTime = null;
        seekToSeconds(finalTarget, wasPlaying);
      }, 110);
    } else {
      if (deltaSeekDebounceTimer) clearTimeout(deltaSeekDebounceTimer);
      deltaSeekDebounceTimer = setTimeout(() => {
        deltaSeekDebounceTimer = null;
        const finalTarget = state.scrubPreviewTime !== null ? state.scrubPreviewTime : target;
        state.scrubPreviewTime = null;
        seekToSeconds(finalTarget, wasPlaying);
      }, 75);
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

  const ASPECT_RATIO_PRESETS = [
    { id: 'contain', label: 'Contain (Original Aspect)' },
    { id: 'cover', label: 'Cover (Crop Black Bars)' },
    { id: 'fill', label: 'Stretch to Window' },
    { id: '16:9', label: 'Force 16:9 Widescreen' },
    { id: '4:3', label: 'Force 4:3 Standard' },
    { id: '21:9', label: 'Force 21:9 Ultrawide' }
  ];

  function setAspectRatio(fitMode, showOsd = true) {
    const valid = ASPECT_RATIO_PRESETS.find((p) => p.id === fitMode);
    state.videoFit = valid ? valid.id : 'contain';
    applyVideoAppearance();
    savePreferences();
    if (el.selVideoFit) el.selVideoFit.value = state.videoFit;
    if (showOsd) {
      const label = valid ? valid.label : 'Contain (Original Aspect)';
      showToast(`Aspect Ratio: ${label}`);
    }
  }

  function cycleAspectRatio() {
    const currentIndex = ASPECT_RATIO_PRESETS.findIndex((p) => p.id === state.videoFit);
    const nextIndex = (currentIndex + 1) % ASPECT_RATIO_PRESETS.length;
    const nextPreset = ASPECT_RATIO_PRESETS[nextIndex];
    setAspectRatio(nextPreset.id, true);
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
        tick.addEventListener('click', (e) => {
          e.stopPropagation();
          seekToSeconds(ch.start, true);
          showToast(`Chapter: ${ch.title || formatTime(ch.start, dur >= 3600)}`);
        });
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

  function jumpToNextChapter() {
    const cur = getCurrentTime();
    const dur = getDuration();
    if (!state.currentChapters || state.currentChapters.length === 0) {
      seekRelative(30);
      return;
    }
    const nextCh = state.currentChapters.find((c) => c.start > cur + 0.5);
    if (nextCh) {
      seekToSeconds(nextCh.start, true);
      showToast(`Chapter: ${nextCh.title || formatTime(nextCh.start, dur >= 3600)}`);
    } else {
      showToast('End of chapters');
    }
  }

  function jumpToPrevChapter() {
    const cur = getCurrentTime();
    const dur = getDuration();
    if (!state.currentChapters || state.currentChapters.length === 0) {
      seekRelative(-30);
      return;
    }
    const prevChapters = state.currentChapters.filter((c) => c.start < cur - 1.5);
    if (prevChapters.length > 0) {
      const prevCh = prevChapters[prevChapters.length - 1];
      seekToSeconds(prevCh.start, true);
      showToast(`Chapter: ${prevCh.title || formatTime(prevCh.start, dur >= 3600)}`);
    } else {
      seekToSeconds(0, true);
      showToast('Start of video');
    }
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
      state.lastSkippedSegmentId = null;
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

  function updateSkipSegmentPosition() {
    if (!el.btnSkipSegment || !el.seekbarTrack || !el.videoStage) return;
    try {
      const seekbarRect = el.seekbarTrack.getBoundingClientRect();
      const stageRect = el.videoStage.getBoundingClientRect();
      const leftOffset = seekbarRect.left - stageRect.left;
      if (Number.isFinite(leftOffset)) {
        el.btnSkipSegment.style.left = `${Math.round(Math.max(16, leftOffset))}px`;
      }
    } catch {}
  }

  function showSkipSegmentPrompt(seg, cur = getCurrentTime(), dur = getDuration()) {
    if (state.activeSkipSegment && state.activeSkipSegment.id === seg.id && isSkipPromptVisible) {
      return; // Already actively showing prompt for this segment; prevent per-tick DOM thrashing
    }
    state.activeSkipSegment = seg;
    if (!el.btnSkipSegment) return;

    let targetText = 'Skip Segment';
    if (seg.hasAfterCredits) {
      targetText = 'Jump to After-Credits';
    } else if (seg.type === 'opening') {
      targetText = 'Skip Opening';
    } else if (seg.type === 'ending') {
      targetText = 'Skip Ending';
    } else if (seg.type === 'credits') {
      targetText = 'Skip Credits';
    } else if (seg.label) {
      targetText = `Skip ${seg.label}`;
    }

    if (el.skipSegmentLabel && el.skipSegmentLabel.textContent !== targetText) {
      el.skipSegmentLabel.textContent = targetText;
    }
    updateSkipSegmentPosition();
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
    let seg = state.activeSkipSegment;
    const cur = getCurrentTime();
    const dur = getDuration();
    if (!seg && state.currentSegments && state.currentSegments.length > 0) {
      seg = state.currentSegments.find((s) => cur >= s.start && cur < s.end);
    }
    if (!seg) {
      jumpToNextChapter();
      return;
    }
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
    state.bossKeySuppressedResume = true;
    state.wasPlayingBeforeMinimize = false;
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
      if (el.libFolderHeader) el.libFolderHeader.style.display = 'flex';
      el.libFolderLabel.textContent = folder.folderName || 'Folder';
      el.libFolderLabel.title = folder.folderPath || '';
      el.folderCrumbText.textContent = folder.folderName || 'Folder';
      el.librarySidebar.classList.remove('collapsed');
      el.btnSidebar.classList.add('active');
      updateChromeSolidity();
      renderSidebarShortcuts();
      renderLibraryList({ scrollToTop: true });

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
      if (sub) loadSubtitleData(sub, true, true);
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
    if (tabName === 'audio') {
      syncAudioTracksDropdown();
    }
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
        state.userExplicitSubState = state.subEnabled;
        if (el.swSubEnabled) el.swSubEnabled.classList.toggle('on', state.subEnabled);
        if (el.subtitleOverlay) el.subtitleOverlay.style.display = state.subEnabled ? 'block' : 'none';
        showToast(`Subtitles: ${state.subEnabled ? 'ON' : 'OFF'}`);
        break;
      case 'cycleAudioTrack':
        cycleAudioTrack();
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
      case 'openStream':
        openSettingsTab('stream-download');
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
      case 'nextChapter':
        jumpToNextChapter();
        break;
      case 'prevChapter':
        jumpToPrevChapter();
        break;
      case 'toggleStopAfterCurrent':
        toggleStopAfterCurrent();
        break;
      case 'bossKey':
        triggerBossKey();
        break;
      case 'cycleAspect':
        cycleAspectRatio();
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
      case 'cycleAspect':
        cycleAspectRatio();
        break;
      case 'setAspect':
        setAspectRatio(cmd.value);
        break;
      case 'snapshot':
        captureSnapshot();
        break;
      case 'snapshotClipboard':
        copySnapshotToClipboard();
        break;
      case 'setSleepTimer':
        setSleepTimer(cmd.minutes);
        break;
      case 'stop':
        state.wasPlayingBeforeMinimize = false;
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
          state.userExplicitSubState = false;
          clearSubtitles();
          syncPopoverButtonsActive();
          showToast('AI Bridge: Subtitles Off');
        } else if (cmd.filePath && api.readSubtitle) {
          api.readSubtitle(cmd.filePath).then((subData) => {
            if (subData) {
              state.subEnabled = true;
              loadSubtitleData(subData, true, true);
            }
          }).catch(() => {});
        } else if (cmd.value === 'toggle') {
          state.subEnabled = !state.subEnabled;
          state.userExplicitSubState = state.subEnabled;
          renderSubtitleBlocksOnSeekbar();
          updateActiveSubtitleCue();
          syncPopoverButtonsActive();
          showToast(state.subEnabled ? 'AI Bridge: Subtitles Enabled' : 'AI Bridge: Subtitles Disabled');
        }
        break;
      }
      case 'setAudioTrack': {
        if (cmd.value !== undefined) {
          const v = String(cmd.value).toLowerCase();
          const tracks = getAudioTracksList();
          const matchIdx = tracks.findIndex(t => t.name.toLowerCase().includes(v) || (t.lang && t.lang.toLowerCase().includes(v)));
          if (matchIdx >= 0) setAudioTrack(matchIdx, true, true);
          else cycleAudioTrack();
        } else if (typeof cmd.index === 'number') {
          setAudioTrack(cmd.index, true, true);
        } else {
          cycleAudioTrack();
        }
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
    if (el.iconHeaderStream) el.iconHeaderStream.innerHTML = ICONS.stream;
    el.btnPip.innerHTML = ICONS.pip;
    el.btnMinimize.innerHTML = ICONS.minimize;
    el.btnMaximize.innerHTML = ICONS.maximize;
    el.btnFullscreen.innerHTML = ICONS.fullscreen;
    el.btnClose.innerHTML = ICONS.close;
    el.libSearchIcon.innerHTML = ICONS.search;
    if (el.libFolderHeaderIcon) el.libFolderHeaderIcon.innerHTML = ICONS.folderPlay || '';
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

    if (el.streamIconBadge) el.streamIconBadge.innerHTML = ICONS.stream || '';
    if (el.btnStreamPlayIcon) el.btnStreamPlayIcon.innerHTML = ICONS.play || '';
    if (el.btnStreamDlIcon) el.btnStreamDlIcon.innerHTML = ICONS.download || '';

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
      if (el.libFolderHeader) el.libFolderHeader.style.display = 'flex';
      el.libFolderLabel.textContent = targetFolder.folderName || 'Folder';
      el.libFolderLabel.title = targetFolder.folderPath || '';
      savePreferences();
      renderSidebarShortcuts();
      renderLibraryList({ scrollToTop: true });
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

    function handleWindowMinimized() {
      const isPip = Boolean(document.pictureInPictureElement);
      if (state.autoPauseOnMinimize && !isPip) {
        if (state.playing || !el.video.paused) {
          state.wasPlayingBeforeMinimize = true;
          isAutoPausingForMinimize = true;
          pauseMedia();
          isAutoPausingForMinimize = false;
          showToast('Auto-Paused (Window Minimized)');
        }
      }
    }

    function handleWindowRestored() {
      if (state.bossKeySuppressedResume) {
        state.bossKeySuppressedResume = false;
        state.wasPlayingBeforeMinimize = false;
        return;
      }
      if (state.autoPauseOnMinimize && state.wasPlayingBeforeMinimize && !document.pictureInPictureElement) {
        state.wasPlayingBeforeMinimize = false;
        if (el.video.paused) {
          playMedia();
          showToast('Resumed Playback');
        }
      }
    }

    if (api.onWindowMinimize) {
      api.onWindowMinimize(handleWindowMinimized);
    }
    if (api.onWindowRestore) {
      api.onWindowRestore(handleWindowRestored);
    }

    api.onWindowState((ws) => {
      state.isMaximized = ws.maximized;
      state.isFullscreen = ws.fullscreen;
      state.alwaysOnTop = ws.alwaysOnTop;
      if (typeof ws.minimized === 'boolean') {
        const wasMin = Boolean(state.isMinimized);
        state.isMinimized = ws.minimized;
        if (!wasMin && state.isMinimized) {
          handleWindowMinimized();
        } else if (wasMin && !state.isMinimized) {
          handleWindowRestored();
        }
      }
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
        const currentPath = state.currentItem?.filePath || state.currentItem?.path;
        const incomingPath = data?.item?.filePath || data?.item?.path;
        if (data?.item && (!state.currentItem || currentPath !== incomingPath)) {
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

    if (el.btnHeaderStream) {
      el.btnHeaderStream.addEventListener('click', () => {
        openSettingsTab('stream-download');
        if (el.streamUrlInput) {
          setTimeout(() => el.streamUrlInput.focus(), 100);
        }
      });
    }

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
    if (el.menuCycleAudio) {
      el.menuCycleAudio.addEventListener('click', () => {
        el.headerMenu.classList.remove('open');
        updateChromeSolidity();
        cycleAudioTrack();
      });
    }
    el.menuSnapshot.addEventListener('click', () => {
      el.headerMenu.classList.remove('open');
      updateChromeSolidity();
      captureSnapshot();
    });
    if (el.menuCycleAspect) {
      el.menuCycleAspect.addEventListener('click', () => {
        el.headerMenu.classList.remove('open');
        updateChromeSolidity();
        cycleAspectRatio();
      });
    }
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
      if (el.btnLibSearchClear) {
        el.btnLibSearchClear.style.display = el.libSearchInput.value ? 'inline-flex' : 'none';
      }
      if (libSearchTimer) clearTimeout(libSearchTimer);
      libSearchTimer = setTimeout(() => {
        libSearchTimer = null;
        renderLibraryList();
      }, 120);
    });
    if (el.btnLibSearchClear) {
      el.btnLibSearchClear.addEventListener('click', () => {
        state.libraryFilter = '';
        el.libSearchInput.value = '';
        el.btnLibSearchClear.style.display = 'none';
        el.libSearchInput.focus();
        renderLibraryList();
      });
    }
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
      syncAudioTracksDropdown();
      applyLanguagePreferencesOnLoad();
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
      if (activeHls) return;
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
      state.wasPlayingBeforeMinimize = false;
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
      state.scrubPreviewTime = targetSec;
      updateTimelineUI();
      updateHoverPreview(e.clientX, rect);
    });

    el.seekbarTrack.addEventListener('pointermove', (e) => {
      const rect = el.seekbarTrack.getBoundingClientRect();
      updateHoverPreview(e.clientX, rect);
      if (!isScrubbing) return;
      const dur = getDuration();
      if (dur <= 0) return;
      const targetSec = calcSeekRatio(e.clientX, rect) * dur;
      state.scrubPreviewTime = targetSec;
      updateTimelineUI();
    });

    el.seekbarTrack.addEventListener('pointerup', (e) => {
      if (!isScrubbing) return;
      isScrubbing = false;
      el.seekbarTrack.releasePointerCapture(e.pointerId);

      const dur = getDuration();
      const rect = el.seekbarTrack.getBoundingClientRect();
      const fallbackSec = dur > 0 ? calcSeekRatio(e.clientX, rect) * dur : 0;
      const finalSec = state.scrubPreviewTime !== null ? state.scrubPreviewTime : fallbackSec;
      state.scrubPreviewTime = null;
      seekToSeconds(finalSec, wasPlayingBeforeScrub);
    });

    el.seekbarTrack.addEventListener('pointerleave', () => {
      if (!isScrubbing) el.seekHoverCard.classList.remove('visible');
    });

    // Mini subtitle sync buttons next to seekbar
    const adjustSubOffset = (deltaMs) => {
      state.subOffsetMs += deltaMs;
      if (el.lblSubOffset) el.lblSubOffset.textContent = `${state.subOffsetMs >= 0 ? '+' : ''}${state.subOffsetMs} ms`;
      renderSubtitleBlocksOnSeekbar();
      updateActiveSubtitleCue();
      showToast(`Subtitle Sync: ${state.subOffsetMs >= 0 ? '+' : ''}${state.subOffsetMs} ms`);
    };
    el.btnSubEarlier?.addEventListener('click', () => adjustSubOffset(-50));
    el.btnSubLater?.addEventListener('click', () => adjustSubOffset(50));

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

    if (el.swSubTimeline) {
      el.swSubTimeline.addEventListener('click', () => {
        state.subTimelineBlocks = !state.subTimelineBlocks;
        syncSwitchesUI();
        renderSubtitleBlocksOnSeekbar();
        savePreferences();
      });
    }

    el.btnPopSnapshot.addEventListener('click', captureSnapshot);

    el.selVideoFit.addEventListener('change', () => {
      setAspectRatio(el.selVideoFit.value, false);
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

    if (el.selAudioTrack) {
      el.selAudioTrack.addEventListener('change', () => {
        setAudioTrack(Number(el.selAudioTrack.value), true, true);
      });
    }

    if (el.selSubTrack) {
      el.selSubTrack.addEventListener('change', async () => {
        const idx = parseInt(el.selSubTrack.value, 10);
        const subTracks = state.probedSubtitleTracks || [];
        if (idx < 0) {
          state.activeEmbeddedSubTrackIndex = -1;
          state.subEnabled = false;
          state.userExplicitSubState = false;
          syncSwitchesUI();
          if (el.subtitleOverlay) {
            el.subtitleOverlay.classList.remove('visible');
            el.subtitleOverlay.textContent = '';
          }
          if (el.lblSubTrack) el.lblSubTrack.textContent = 'Subtitles Off';
          syncSubtitleTracksDropdown();
          showToast('Subtitles Off');
        } else if (subTracks.length > 0) {
          await selectEmbeddedSubtitleTrack(idx, true, true);
        } else if (state.loadedExternalSubData) {
          state.subEnabled = true;
          state.userExplicitSubState = true;
          syncSwitchesUI();
          loadSubtitleData(state.loadedExternalSubData, true, true);
        }
      });
    }

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
      state.userExplicitSubState = state.subEnabled;
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
    if (el.btnSubMinus100) el.btnSubMinus100.addEventListener('click', () => adjustSubOffset(-100));
    if (el.btnSubPlus100) el.btnSubPlus100.addEventListener('click', () => adjustSubOffset(100));
    if (el.btnSubReset) {
      el.btnSubReset.addEventListener('click', () => {
        state.subOffsetMs = 0;
        if (el.lblSubOffset) el.lblSubOffset.textContent = '0 ms';
        renderSubtitleBlocksOnSeekbar();
        updateActiveSubtitleCue();
        showToast('Subtitle sync reset to 0 ms');
      });
    }

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
        } else if (target === 'stream-download') {
          if (el.streamUrlInput) setTimeout(() => el.streamUrlInput.focus(), 80);
        } else if (target === 'media-editor') {
          // Dedicated tab: only inspect and preload when a file is explicitly placed in this tab
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
    if (el.swAutoplaySubtitles) {
      el.swAutoplaySubtitles.addEventListener('click', () => {
        state.autoPlaySubtitles = !state.autoPlaySubtitles;
        state.userExplicitSubState = state.autoPlaySubtitles;
        syncSwitchesUI();
        savePreferences();
        showToast(state.autoPlaySubtitles ? 'Autoplay Subtitles: ON' : 'Autoplay Subtitles: OFF');
      });
    }
    if (el.selPreferredAudioLang) {
      el.selPreferredAudioLang.addEventListener('change', () => {
        state.preferredAudioLang = el.selPreferredAudioLang.value;
        state.activeSessionAudioLang = el.selPreferredAudioLang.value;
        state.activeSessionAudioTrackName = null;
        savePreferences();
        const selectedLabel = el.selPreferredAudioLang.options[el.selPreferredAudioLang.selectedIndex]?.textContent || state.preferredAudioLang;
        showToast(`Preferred Audio: ${selectedLabel}`);
      });
    }
    if (el.swFallbackSubtitles) {
      el.swFallbackSubtitles.addEventListener('click', () => {
        state.fallbackSubtitles = !state.fallbackSubtitles;
        syncSwitchesUI();
        savePreferences();
        showToast(state.fallbackSubtitles ? 'Fallback Subtitles: Enabled' : 'Fallback Subtitles: Disabled');
      });
    }
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
    if (el.swAutoPauseMinimize) {
      el.swAutoPauseMinimize.addEventListener('click', () => {
        state.autoPauseOnMinimize = !state.autoPauseOnMinimize;
        syncSwitchesUI();
        savePreferences();
        showToast(state.autoPauseOnMinimize ? 'Auto-Pause on Minimize: Enabled' : 'Auto-Pause on Minimize: Disabled');
      });
    }

    if (el.swStreamEmbedSub) {
      el.swStreamEmbedSub.addEventListener('click', () => {
        state.embedSubtitlesOnDownload = !state.embedSubtitlesOnDownload;
        syncSwitchesUI();
        savePreferences();
        showToast(state.embedSubtitlesOnDownload ? 'Embed Subtitles: Enabled for downloads' : 'Embed Subtitles: Disabled for downloads');
      });
    }

    if (el.swAutoPlayDl) {
      el.swAutoPlayDl.addEventListener('click', () => {
        state.autoPlayDownloads = !state.autoPlayDownloads;
        syncSwitchesUI();
        savePreferences();
        showToast(state.autoPlayDownloads ? 'Auto-Play Downloads: Enabled' : 'Auto-Play Downloads: Disabled');
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

    if (el.btnCopyAiCmd) {
      el.btnCopyAiCmd.addEventListener('click', () => {
        navigator.clipboard.writeText(el.aiSampleCmd.textContent).then(() => {
          showToast('Copied PowerShell AI Control command');
        });
      });
    }

    if (el.btnCopyFullAiPrompt) {
      el.btnCopyFullAiPrompt.addEventListener('click', () => {
        const promptText = `You can control CopyCat Media Player on this PC via its local HTTP bridge at http://127.0.0.1:4500.

IMPORTANT: Do not launch CopyCat with Start-Process directly, because background service terminals are blocked by Windows from creating interactive GUI desktop windows.

Instead, launch or open media onto my visible desktop using:
(New-Object -ComObject Shell.Application).ShellExecute("C:\\path\\to\\CopyCat media player.exe", "C:\\path\\to\\video.mp4", "", "open", 1)

Or use the global CLI command:
copycat "C:\\path\\to\\video.mp4"

Wait 2 seconds, then send playback or speed commands via HTTP:
Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -ContentType "application/json" -Body '{"action":"openFile","filePath":"C:\\\\path\\\\to\\\\video.mp4"}'
Invoke-RestMethod -Uri "http://127.0.0.1:4500/api/control" -Method Post -ContentType "application/json" -Body '{"action":"speed","value":1.25}'`;
        navigator.clipboard.writeText(promptText).then(() => {
          showToast('Copied ready-to-paste AI Prompt to clipboard!');
        });
      });
    }

    if (el.btnInstallAiSkill) {
      el.btnInstallAiSkill.addEventListener('click', async () => {
        if (!api.installAiIntegration) return;
        showToast('Installing AI Skill & CLI command...');
        const res = await api.installAiIntegration();
        if (res && res.ok) {
          showToast('AI Skill "copycat-player" and CLI "copycat" installed!');
        } else {
          showToast('AI integration updated');
        }
      });
    }

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

    // ==================== GITHUB AUTO-UPDATER LOGIC ====================
    let sessionDismissedUpdate = false;
    let isDownloadingUpdate = false;

    function renderUpdateDetails(updateInfo) {
      if (!updateInfo) return;
      state.availableUpdate = updateInfo;

      // Reveal Updates tab in Settings
      if (el.navBtnUpdates) el.navBtnUpdates.style.display = 'flex';
      if (el.settingsGroupUpdatesLbl) el.settingsGroupUpdatesLbl.style.display = 'block';

      if (updateInfo.updateAvailable) {
        if (el.settingsUpdateBadge) el.settingsUpdateBadge.style.display = 'inline-block';
        if (el.updateCardTitle) el.updateCardTitle.textContent = `CopyCat Update Available: ${updateInfo.latestVersion}`;
        if (el.updateCardVersions) el.updateCardVersions.textContent = `Current: ${updateInfo.currentVersion} ➔ Latest: ${updateInfo.latestVersion}`;
        if (el.updateStatusPill) {
          el.updateStatusPill.textContent = 'Update Ready';
          el.updateStatusPill.style.color = 'var(--accent)';
          el.updateStatusPill.style.background = 'rgba(var(--accent-rgb), 0.18)';
        }
        if (el.updateCardNotesWrap) el.updateCardNotesWrap.style.display = 'block';
        if (el.updateCardNotes) {
          el.updateCardNotes.textContent = updateInfo.releaseNotes || 'Performance optimizations, bug fixes, and improvements.';
        }
        if (el.btnSettingsUpdateNow) {
          el.btnSettingsUpdateNow.style.display = 'inline-flex';
          el.btnSettingsUpdateNow.disabled = false;
        }
      } else {
        if (el.settingsUpdateBadge) el.settingsUpdateBadge.style.display = 'none';
        if (el.updateCardTitle) el.updateCardTitle.textContent = 'CopyCat Media Player is Up to Date';
        if (el.updateCardVersions) el.updateCardVersions.textContent = `Installed Version: ${updateInfo.currentVersion}`;
        if (el.updateStatusPill) {
          el.updateStatusPill.textContent = 'Latest Version ✓';
          el.updateStatusPill.style.color = '#34D399';
          el.updateStatusPill.style.background = 'rgba(52, 211, 153, 0.18)';
        }
        if (el.updateCardNotesWrap) el.updateCardNotesWrap.style.display = 'none';
        if (el.btnSettingsUpdateNow) el.btnSettingsUpdateNow.style.display = 'none';
      }
    }

    function showUpdatePromptBanner(updateInfo) {
      if (!updateInfo || !updateInfo.updateAvailable) return;
      if (sessionDismissedUpdate) return;
      // If user previously selected "Not Now" / Skip for this specific version, suppress startup prompt
      if (state.ignoredUpdateVersion === updateInfo.latestVersion) {
        renderUpdateDetails(updateInfo);
        return;
      }

      renderUpdateDetails(updateInfo);

      if (el.updatePromptTitle) {
        el.updatePromptTitle.textContent = `Update Available: ${updateInfo.latestVersion}`;
      }
      if (el.updatePromptDesc) {
        const sizeMb = updateInfo.asset?.size ? ` (${(updateInfo.asset.size / (1024 * 1024)).toFixed(1)} MB)` : '';
        el.updatePromptDesc.textContent = `A new version of CopyCat media player is available${sizeMb}.`;
      }
      if (el.updatePromptBanner) {
        el.updatePromptBanner.classList.add('visible');
      }
    }

    function hideUpdatePromptBanner() {
      if (el.updatePromptBanner) {
        el.updatePromptBanner.classList.remove('visible');
      }
    }

    async function triggerUpdateDownload() {
      if (isDownloadingUpdate) return;
      const targetUpdate = state.availableUpdate;
      if (!targetUpdate || !targetUpdate.asset) {
        showToast('No update package found for download');
        return;
      }

      isDownloadingUpdate = true;
      if (el.btnUpdateNow) el.btnUpdateNow.disabled = true;
      if (el.btnSettingsUpdateNow) el.btnSettingsUpdateNow.disabled = true;

      // Show progress in banner
      if (el.updateBannerProgressWrap) el.updateBannerProgressWrap.style.display = 'block';
      if (el.updatePromptActions) el.updatePromptActions.style.display = 'none';

      // Show progress in settings card
      if (el.updateCardProgressWrap) el.updateCardProgressWrap.style.display = 'block';

      showToast(`Downloading update ${targetUpdate.latestVersion}...`);

      if (api.downloadAndInstallUpdate) {
        const res = await api.downloadAndInstallUpdate(targetUpdate.asset);
        if (!res || !res.ok) {
          isDownloadingUpdate = false;
          showToast(`Update error: ${res?.error || 'failed to download'}`);
          if (el.btnUpdateNow) el.btnUpdateNow.disabled = false;
          if (el.btnSettingsUpdateNow) el.btnSettingsUpdateNow.disabled = false;
          if (el.updatePromptActions) el.updatePromptActions.style.display = 'flex';
          if (el.updateBannerProgressWrap) el.updateBannerProgressWrap.style.display = 'none';
          if (el.updateCardProgressWrap) el.updateCardProgressWrap.style.display = 'none';
        }
      }
    }

    if (api.onUpdateDownloadProgress) {
      api.onUpdateDownloadProgress((progress) => {
        const percent = Math.min(100, Math.max(0, progress.percent || 0));
        const transMb = ((progress.transferred || 0) / (1024 * 1024)).toFixed(1);
        const totalMb = ((progress.total || 0) / (1024 * 1024)).toFixed(1);

        if (el.updateBannerProgressFill) el.updateBannerProgressFill.style.width = `${percent}%`;
        if (el.updateBannerProgressText) el.updateBannerProgressText.textContent = `Downloading... ${percent}% (${transMb} MB / ${totalMb} MB)`;

        if (el.updateCardProgressFill) el.updateCardProgressFill.style.width = `${percent}%`;
        if (el.updateCardProgressText) el.updateCardProgressText.textContent = `Downloading update... ${percent}%`;
        if (el.updateCardProgressBytes) el.updateCardProgressBytes.textContent = `${transMb} MB / ${totalMb} MB`;
      });
    }

    if (api.onUpdateDownloadComplete) {
      api.onUpdateDownloadComplete(() => {
        if (el.updateBannerProgressText) el.updateBannerProgressText.textContent = 'Download complete! Starting installer...';
        if (el.updateCardProgressText) el.updateCardProgressText.textContent = 'Download complete! Launching installer...';
        showToast('Download complete. Launching installer...');
      });
    }

    if (api.onUpdateError) {
      api.onUpdateError((err) => {
        isDownloadingUpdate = false;
        showToast(`Update error: ${err?.error || 'Download failed'}`);
        if (el.btnUpdateNow) el.btnUpdateNow.disabled = false;
        if (el.btnSettingsUpdateNow) el.btnSettingsUpdateNow.disabled = false;
        if (el.updatePromptActions) el.updatePromptActions.style.display = 'flex';
        if (el.updateBannerProgressWrap) el.updateBannerProgressWrap.style.display = 'none';
        if (el.updateCardProgressWrap) el.updateCardProgressWrap.style.display = 'none';
      });
    }

    if (el.btnUpdateNow) {
      el.btnUpdateNow.addEventListener('click', triggerUpdateDownload);
    }

    if (el.btnUpdateLater) {
      el.btnUpdateLater.addEventListener('click', () => {
        sessionDismissedUpdate = true;
        hideUpdatePromptBanner();
        if (state.availableUpdate) renderUpdateDetails(state.availableUpdate);
        showToast('Update postponed. Option available in Preferences → Updates.');
      });
    }

    if (el.btnUpdateSkip) {
      el.btnUpdateSkip.addEventListener('click', () => {
        if (state.availableUpdate?.latestVersion) {
          state.ignoredUpdateVersion = state.availableUpdate.latestVersion;
          savePreferences();
        }
        hideUpdatePromptBanner();
        if (state.availableUpdate) renderUpdateDetails(state.availableUpdate);
        showToast(`Don't Ask Again set for ${state.availableUpdate?.latestVersion || 'this version'}. Option remains in Preferences → Updates.`);
      });
    }

    if (el.btnSettingsUpdateNow) {
      el.btnSettingsUpdateNow.addEventListener('click', triggerUpdateDownload);
    }

    if (el.btnSettingsCheckUpdates) {
      el.btnSettingsCheckUpdates.addEventListener('click', async () => {
        el.btnSettingsCheckUpdates.disabled = true;
        el.btnSettingsCheckUpdates.textContent = 'Checking...';
        showToast('Checking for updates on GitHub...');
        try {
          if (api.checkForUpdates) {
            const res = await api.checkForUpdates();
            renderUpdateDetails(res);
            if (res && res.updateAvailable) {
              showToast(`Update available: ${res.latestVersion}`);
            } else {
              showToast(`You are on the latest version (${res?.currentVersion || 'v1.0.6'})`);
            }
          }
        } catch (e) {
          showToast(`Check failed: ${e.message}`);
        } finally {
          el.btnSettingsCheckUpdates.disabled = false;
          el.btnSettingsCheckUpdates.textContent = '🔄 Check for Updates';
        }
      });
    }

    if (api.onUpdateAvailable) {
      api.onUpdateAvailable((updateInfo) => {
        showUpdatePromptBanner(updateInfo);
      });
    }

    // ==========================================
    // Native Stream & Downloader Subsystem
    // ==========================================
    let activeDownloadsMap = new Map();
    let lastProbedData = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function openSettingsTab(tabName) {
      toggleSettingsModal(true);
      const navBtn = document.querySelector(`.settings-nav-btn[data-settings-tab="${tabName}"]`);
      if (navBtn) {
        navBtn.click();
      }
    }

    function playDownloadCompletionChime() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = audioCtx || new Ctx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5 melodic major triad
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          g.gain.setValueAtTime(0, now + idx * 0.12);
          g.gain.linearRampToValueAtTime(0.16, now + idx * 0.12 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.35);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.36);
        });
      } catch {}
    }

    async function initDownloaderUI() {
      if (!api || !api.getDownloadFolder) return;

      try {
        const folder = await api.getDownloadFolder();
        if (el.downloadFolderDisplay) {
          el.downloadFolderDisplay.textContent = folder;
        }
      } catch {}

      try {
        const queue = await api.getDownloadQueue();
        if (Array.isArray(queue) && queue.length > 0) {
          queue.forEach((t) => activeDownloadsMap.set(t.id, t));
          renderDownloadQueue();
        }
      } catch {}

      if (api.onDownloadProgress) {
        api.onDownloadProgress((data) => {
          activeDownloadsMap.set(data.id, { ...(activeDownloadsMap.get(data.id) || {}), ...data });
          renderDownloadQueue();
        });
      }

      if (api.onDownloadComplete) {
        api.onDownloadComplete((data) => {
          const existing = activeDownloadsMap.get(data.id) || {};
          activeDownloadsMap.set(data.id, { ...existing, ...data, status: 'completed', percent: 100 });
          renderDownloadQueue();
          playDownloadCompletionChime();
          showToast(`Download complete: ${data.title || data.fileName}`);

          // Auto-play if enabled
          if (state.autoPlayDownloads !== false && data.outputPath) {
            setTimeout(async () => {
              await playLocalFile(data.outputPath, true);
            }, 500);
          }
        });
      }

      if (api.onDownloadError) {
        api.onDownloadError((data) => {
          const existing = activeDownloadsMap.get(data.id) || {};
          activeDownloadsMap.set(data.id, { ...existing, status: 'error', error: data.error });
          renderDownloadQueue();
          showToast(`Download error: ${data.error || 'Failed'}`);
        });
      }
    }

    const dismissedHudTaskIds = new Set();
    const notifiedCompletedTaskIds = new Set();
    let hudAutoDismissTimer = null;
    let currentHudCompletedTaskId = null;

    function dismissHudCompleted(taskId = null) {
      if (hudAutoDismissTimer) {
        clearTimeout(hudAutoDismissTimer);
        hudAutoDismissTimer = null;
      }
      const targetId = taskId || currentHudCompletedTaskId;
      if (targetId) {
        dismissedHudTaskIds.add(targetId);
      }
      currentHudCompletedTaskId = null;
      if (el.playerDlHud) {
        el.playerDlHud.classList.add('hidden');
        el.playerDlHud.classList.remove('fading');
      }
    }

    function scheduleHudAutoDismiss(taskId, delayMs = 5000) {
      if (hudAutoDismissTimer) {
        clearTimeout(hudAutoDismissTimer);
      }
      hudAutoDismissTimer = setTimeout(() => {
        if (!el.playerDlHud || el.playerDlHud.classList.contains('hidden')) return;
        el.playerDlHud.classList.add('fading');
        setTimeout(() => {
          dismissHudCompleted(taskId);
        }, 350);
      }, delayMs);
    }

    function updatePlayerDownloadHud() {
      const items = Array.from(activeDownloadsMap.values());
      const activeTask = items.find((i) => i.status === 'downloading' || i.status === 'starting');

      // 1. Top Bar Live Download Indicator (Shows in top-right ONLY while downloading)
      if (el.topDlIndicator) {
        if (activeTask) {
          el.topDlIndicator.classList.remove('hidden');
          const pct = activeTask.percent || 0;
          if (el.topDlTitle) {
            el.topDlTitle.textContent = activeTask.title || activeTask.fileName || 'Downloading...';
            el.topDlTitle.title = `${activeTask.title || activeTask.fileName} (${pct}%) — Click to open Download settings`;
          }
          if (el.topDlPct) {
            el.topDlPct.textContent = `${pct}%`;
          }
          if (el.topDlFill) {
            el.topDlFill.style.width = `${pct}%`;
          }
        } else {
          el.topDlIndicator.classList.add('hidden');
        }
      }

      // 2. In-Player Completed Pop-up (Shows ONCE when a download finishes, never re-opens if dismissed)
      if (!el.playerDlHud) return;

      // Find the latest completed task that has NOT been dismissed or notified yet
      const unnotifiedCompleted = [...items].reverse().find(
        (i) => i.status === 'completed' && !dismissedHudTaskIds.has(i.id) && !notifiedCompletedTaskIds.has(i.id)
      );

      if (unnotifiedCompleted) {
        notifiedCompletedTaskIds.add(unnotifiedCompleted.id);
        currentHudCompletedTaskId = unnotifiedCompleted.id;

        el.playerDlHud.classList.remove('hidden');
        el.playerDlHud.classList.add('completed');
        el.playerDlHud.classList.remove('fading');

        if (el.playerDlHudBadge) {
          el.playerDlHudBadge.textContent = '✓ COMPLETED';
        }
        if (el.playerDlHudTitle) {
          // Display the whole file name
          const fullName = unnotifiedCompleted.fileName || unnotifiedCompleted.title || 'Stream Video';
          el.playerDlHudTitle.textContent = fullName;
          el.playerDlHudTitle.title = fullName;
        }
        if (el.playerDlHudPct) {
          el.playerDlHudPct.textContent = '100%';
        }
        if (el.playerDlHudFill) {
          el.playerDlHudFill.style.width = '100%';
        }
        if (el.playerDlHudStats) {
          el.playerDlHudStats.textContent = `${unnotifiedCompleted.sizeFormatted || 'Saved'} • Ready to Play`;
        }
        if (el.btnPlayerDlPlay) {
          el.btnPlayerDlPlay.style.display = unnotifiedCompleted.outputPath ? 'inline-block' : 'none';
          el.btnPlayerDlPlay.dataset.path = unnotifiedCompleted.outputPath || '';
        }
        if (el.btnPlayerDlQueue) {
          el.btnPlayerDlQueue.style.display = unnotifiedCompleted.outputPath ? 'inline-block' : 'none';
          el.btnPlayerDlQueue.dataset.path = unnotifiedCompleted.outputPath || '';
        }
        if (el.btnPlayerDlCancel) {
          el.btnPlayerDlCancel.style.display = 'none';
        }
        if (el.btnPlayerDlDismiss) {
          el.btnPlayerDlDismiss.style.display = 'inline-block';
          el.btnPlayerDlDismiss.dataset.id = unnotifiedCompleted.id;
        }

        scheduleHudAutoDismiss(unnotifiedCompleted.id, 5000);
      } else if (!currentHudCompletedTaskId) {
        el.playerDlHud.classList.add('hidden');
      }
    }

    function renderDownloadQueue() {
      updatePlayerDownloadHud();
      if (!el.dlQueueContainer) return;
      const items = Array.from(activeDownloadsMap.values());

      const activeCount = items.filter((i) => i.status === 'downloading' || i.status === 'starting').length;
      if (el.dlQueueCount) {
        if (activeCount > 0) {
          el.dlQueueCount.textContent = `${activeCount} Active`;
          el.dlQueueCount.style.display = 'inline-block';
        } else {
          el.dlQueueCount.style.display = 'none';
        }
      }

      if (el.btnClearCompletedDl) {
        const hasFinished = items.some((i) => i.status === 'completed' || i.status === 'error' || i.status === 'cancelled');
        el.btnClearCompletedDl.style.display = hasFinished ? 'inline-block' : 'none';
      }

      if (el.btnHaltAllDl) {
        const hasActiveOrQueued = items.some((i) => i.status === 'downloading' || i.status === 'starting' || i.status === 'sniffing' || i.status === 'queued');
        el.btnHaltAllDl.style.display = hasActiveOrQueued ? 'inline-block' : 'none';
      }

      if (items.length === 0) {
        if (el.dlQueueSection) el.dlQueueSection.style.display = 'none';
        el.dlQueueContainer.innerHTML = '';
        return;
      }

      if (el.dlQueueSection) el.dlQueueSection.style.display = 'block';
      el.dlQueueContainer.innerHTML = '';

      items.forEach((task) => {
        const card = document.createElement('div');
        card.className = `dl-item-card ${task.status}`;

        const percent = task.percent || 0;
        const isDone = task.status === 'completed';
        const isErr = task.status === 'error';
        const isCanc = task.status === 'cancelled';
        const isDl = task.status === 'downloading' || task.status === 'starting' || task.status === 'sniffing' || task.status === 'queued';

        const statusLabel = isDone ? '✓ Completed' : (isErr ? '⚠ Skipped (Error)' : (isCanc ? 'Halted' : (task.status === 'sniffing' ? 'Sniffing...' : (task.status === 'queued' ? 'Queued' : `${percent}%`))));
        const segPart = (!isDone && task.segmentsText) ? ` • ${escapeHtml(task.segmentsText)}` : '';
        const etaPart = (!isDone && task.etaFormatted) ? ` • <strong style="color:var(--text-secondary);">${escapeHtml(task.etaFormatted)}</strong>` : '';
        const errPart = (isErr && task.error) ? ` • <span style="color:#ff6b6b;">${escapeHtml(task.error)}</span>` : '';

        card.innerHTML = `
          <div class="dl-item-header">
            <div class="dl-item-title" title="${escapeHtml(task.title || task.fileName)}">${escapeHtml(task.title || task.fileName)}</div>
            <span class="dl-item-status-pill">${statusLabel}</span>
          </div>
          <div class="dl-progress-track">
            <div class="dl-progress-fill" style="width: ${percent}%;"></div>
          </div>
          <div class="dl-item-footer">
            <span>${escapeHtml(task.sizeFormatted || '0 MB')} • ${escapeHtml(task.speed || 'Queued')}${segPart}${etaPart}${errPart}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              ${(isErr || isCanc) ? `<button class="ghost-pill-btn btn-retry-dl" type="button" style="padding:2px 8px;font-size:10.5px;color:var(--accent);" data-id="${escapeHtml(task.id)}">Retry</button>` : ''}
              ${isDone ? `<button class="ghost-pill-btn btn-play-dl" type="button" style="padding:2px 8px;font-size:10.5px;" data-path="${escapeHtml(task.outputPath)}">▶ Play</button>` : ''}
              ${isDone ? `<button class="ghost-pill-btn btn-reveal-dl" type="button" style="padding:2px 8px;font-size:10.5px;" data-path="${escapeHtml(task.outputPath)}">Show in Folder</button>` : ''}
              ${isDl ? `<button class="ghost-pill-btn btn-cancel-dl" type="button" style="padding:2px 8px;font-size:10.5px;color:#ff6b6b;" data-id="${escapeHtml(task.id)}">Cancel</button>` : ''}
            </div>
          </div>
        `;

        const btnRetry = card.querySelector('.btn-retry-dl');
        if (btnRetry) {
          btnRetry.addEventListener('click', async () => {
            const taskId = btnRetry.dataset.id;
            if (taskId && api.retryDownload) {
              await api.retryDownload(taskId);
              showToast('Re-queued download task');
            }
          });
        }

        const btnPlay = card.querySelector('.btn-play-dl');
        if (btnPlay) {
          btnPlay.addEventListener('click', async () => {
            const filePath = btnPlay.dataset.path;
            if (filePath) {
              await playLocalFile(filePath, true);
            }
          });
        }

        const btnReveal = card.querySelector('.btn-reveal-dl');
        if (btnReveal) {
          btnReveal.addEventListener('click', () => {
            const filePath = btnReveal.dataset.path;
            if (filePath && api.revealInExplorer) {
              api.revealInExplorer(filePath);
            }
          });
        }

        const btnCancel = card.querySelector('.btn-cancel-dl');
        if (btnCancel) {
          btnCancel.addEventListener('click', () => {
            if (api.cancelDownload) {
              api.cancelDownload(btnCancel.dataset.id);
            }
          });
        }

        el.dlQueueContainer.appendChild(card);
      });
    }

    function getSelectedProbeOptions(probe) {
      const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
      const isCurrent = Boolean(probe && rawUrl && (probe.url === rawUrl || probe.originalUrl === rawUrl));
      if (!isCurrent) {
        return {
          selectedVideoUrl: '',
          selectedAudioUrl: '',
          selectedAudioName: '',
          dualAudio: false,
          selectedSubtitles: [],
          embedSubtitles: true,
          outputFormat: 'mp4'
        };
      }

      const videoSel = document.getElementById('probe-select-video');
      const audioSel = document.getElementById('probe-select-audio');
      const subSel = document.getElementById('probe-select-sub');

      let selectedVideoUrl = '';
      if (videoSel && videoSel.value && Array.isArray(probe?.videoVariants) && probe.videoVariants.some((v) => v.url === videoSel.value)) {
        selectedVideoUrl = videoSel.value;
      } else {
        selectedVideoUrl = probe?.videoUrl || '';
      }

      const customTitle = el.streamFilenameInput ? el.streamFilenameInput.value.trim() : '';
      const titleHasDual = /dual\s*audio/i.test(customTitle || probe?.title || '');
      const rawAudioVal = audioSel ? audioSel.value : '';
      const dualAudio = rawAudioVal === '__DUAL__' || (titleHasDual && rawAudioVal !== '__NONE__');
      let selectedAudioUrl = '';
      if (dualAudio) {
        selectedAudioUrl = probe?.audioUrl || '';
      } else if (rawAudioVal && Array.isArray(probe?.audioTracks) && probe.audioTracks.some((a) => a.url === rawAudioVal)) {
        selectedAudioUrl = rawAudioVal;
      } else {
        selectedAudioUrl = probe?.audioUrl || '';
      }

      const selectedAudioTrack = Array.isArray(probe?.audioTracks)
        ? probe.audioTracks.find((t) => t.url === selectedAudioUrl)
        : null;

      let embedSubtitles = state.embedSubtitlesOnDownload !== false;
      let selectedSubtitles = [];
      if (subSel) {
        const val = subSel.value;
        if (val === '__NONE__') {
          embedSubtitles = false;
          selectedSubtitles = [];
        } else if (val === '__ALL__') {
          embedSubtitles = true;
          selectedSubtitles = Array.isArray(probe?.subtitles) ? probe.subtitles : [];
        } else if (val) {
          embedSubtitles = true;
          const found = Array.isArray(probe?.subtitles) ? probe.subtitles.find((s) => s.url === val || s.label === val) : null;
          selectedSubtitles = found ? [found] : (probe?.subtitles || []);
        }
      } else if (embedSubtitles && Array.isArray(probe?.subtitles) && probe.subtitles.length > 0) {
        selectedSubtitles = probe.subtitles;
      } else if (!embedSubtitles) {
        selectedSubtitles = [];
      }

      const outputFormat = 'mp4';

      return {
        selectedVideoUrl,
        selectedAudioUrl,
        selectedAudioTrack,
        selectedAudioName: selectedAudioTrack?.name || '',
        dualAudio,
        selectedSubtitles,
        embedSubtitles,
        outputFormat
      };
    }

    async function handleStreamPlayAction() {
      const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
      if (!rawUrl) {
        showToast('Please paste a stream URL first');
        if (el.streamUrlInput) el.streamUrlInput.focus();
        return;
      }

      if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        showToast('URL must start with http:// or https://');
        return;
      }

      // Automatically probe & extract stream if not already probed for this URL
      const matchesProbed = lastProbedData && (lastProbedData.url === rawUrl || lastProbedData.originalUrl === rawUrl);
      if (!matchesProbed) {
        showToast('Extracting & resolving stream...');
        await handleStreamProbeAction();
      }

      const probe = lastProbedData;
      if (probe && (probe.url === rawUrl || probe.originalUrl === rawUrl) && probe.isWebpage && !probe.autoExtracted) {
        showToast('Could not extract a playable video stream from this webpage.');
        return;
      }

      const opts = getSelectedProbeOptions(probe);
      let playUrl = opts.selectedVideoUrl || probe?.videoUrl || probe?.url || rawUrl;
      if (opts.selectedAudioTrack && opts.selectedAudioTrack.streamUrl && !opts.dualAudio) {
        playUrl = opts.selectedAudioTrack.streamUrl;
      }
      const audioUrl = opts.selectedAudioUrl || probe?.audioUrl || '';
      const masterUrl = probe?.masterUrl || probe?.url || playUrl;
      const cleanName = probe?.title || 'Network Stream';
      const isHls = Boolean(probe?.isHls || playUrl.includes('.m3u8') || playUrl.includes('/m/'));
      const isDash = Boolean(probe?.isDash || playUrl.includes('.mpd'));

      showToast(`Streaming: ${cleanName}`);
      toggleSettingsModal(false);

      const streamItem = {
        name: cleanName,
        title: cleanName,
        filePath: playUrl,
        fileUrl: playUrl,
        masterUrl,
        audioStreamUrl: audioUrl,
        preferredVideoUrl: opts.selectedVideoUrl,
        preferredAudioUrl: opts.selectedAudioUrl,
        preferredAudioName: opts.selectedAudioName,
        subtitles: probe?.subtitles || [],
        duration: probe?.durationSec || 0,
        videoCodec: 'h264',
        isAudio: false,
        isHls,
        isNetworkStream: true,
        needsStream: Boolean(isHls || isDash || audioUrl),
        folderName: 'Network Stream',
        folderPath: ''
      };

      loadMediaItem(streamItem, { autoPlay: true });
    }

    async function handleStreamDownloadAction() {
      const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
      if (!rawUrl) {
        showToast('Please paste a stream URL first');
        if (el.streamUrlInput) el.streamUrlInput.focus();
        return;
      }

      if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        showToast('URL must start with http:// or https://');
        return;
      }

      // Automatically probe & extract stream if not already probed for this URL
      const matchesProbed = lastProbedData && (lastProbedData.url === rawUrl || lastProbedData.originalUrl === rawUrl);
      if (!matchesProbed) {
        showToast('Resolving stream tracks...');
        await handleStreamProbeAction();
      }

      const probe = lastProbedData;
      if (probe && (probe.url === rawUrl || probe.originalUrl === rawUrl) && probe.isWebpage && !probe.autoExtracted) {
        showToast('Cannot download webpage. Paste a valid video or stream link.');
        return;
      }

      let downloadUrl = rawUrl;
      let customTitle = formatDoubleDigitEpisode(stripLanguageTags((el.streamFilenameInput && el.streamFilenameInput.value.trim()) || probe?.title || ''));
      if (probe && (probe.url === rawUrl || probe.originalUrl === rawUrl) && probe.autoExtracted && probe.url) {
        downloadUrl = probe.url;
      }

      const opts = getSelectedProbeOptions(probe);
      if (opts.selectedAudioTrack && opts.selectedAudioTrack.streamUrl && !opts.dualAudio) {
        downloadUrl = opts.selectedAudioTrack.streamUrl;
      }

      let audioPreference = 'any';
      if (opts.dualAudio) {
        audioPreference = 'dual';
      } else if (opts.selectedAudioName) {
        if (/english|dub/i.test(opts.selectedAudioName)) audioPreference = 'eng';
        else if (/japanese|jpn/i.test(opts.selectedAudioName)) audioPreference = 'jpn';
      }

      let subPreference = 'any';
      if (!opts.embedSubtitles || (opts.selectedSubtitles && opts.selectedSubtitles.length === 0)) {
        subPreference = 'none';
      } else if (opts.selectedSubtitles && opts.selectedSubtitles.length > 0) {
        const firstSub = opts.selectedSubtitles[0];
        const name = firstSub.label || firstSub.name || '';
        if (/english/i.test(name)) subPreference = 'eng';
        else subPreference = 'any';
      }

      state.lastDownloadPreferences = { audioPreference, subPreference, dualAudio: opts.dualAudio, embedSubtitles: opts.embedSubtitles };

      try {
        showToast('Download started (.mp4) — see live progress bar above');
        const task = await api.startDownload({
          url: downloadUrl,
          title: customTitle,
          audioPreference,
          subPreference,
          selectedVideoUrl: opts.selectedVideoUrl,
          selectedAudioUrl: opts.selectedAudioUrl,
          selectedSubtitles: opts.selectedSubtitles,
          embedSubtitles: opts.embedSubtitles,
          dualAudio: opts.dualAudio,
          dubStreamUrl: probe?.dubStreamUrl || null,
          subStreamUrl: probe?.subStreamUrl || null,
          audioTracks: Array.isArray(probe?.audioTracks) ? probe.audioTracks : [],
          outputFormat: 'mp4'
        });
        if (task) {
          activeDownloadsMap.set(task.id, task);
          renderDownloadQueue();
        }
        if (el.streamUrlInput) el.streamUrlInput.value = '';
        if (el.streamFilenameInput) {
          el.streamFilenameInput.value = '';
          el.streamFilenameInput.dataset.autoFilled = 'false';
        }
        if (el.streamProbeResult) {
          el.streamProbeResult.innerHTML = '';
          el.streamProbeResult.style.display = 'none';
        }
        lastProbedData = null;
      } catch (err) {
        showToast(`Download failed: ${err.message}`);
      }
    }

    function buildProbeTrackSelectorsHtml(probe) {
      const hasVideoChoices = Array.isArray(probe.videoVariants) && probe.videoVariants.length > 1;
      const hasAudioChoices = Array.isArray(probe.audioTracks) && probe.audioTracks.length > 1;
      const hasSubs = Array.isArray(probe.subtitles) && probe.subtitles.length > 0;

      const selectStyle = 'background:rgba(255,255,255,0.06);color:var(--text-primary);border:1px solid var(--border-panel);border-radius:6px;padding:4px 8px;font-size:11.5px;outline:none;cursor:pointer;';

      let html = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">';

      if (hasVideoChoices) {
        const optsHtml = probe.videoVariants.map((v) =>
          `<option value="${escapeHtml(v.url)}" style="background:#181818;color:#fff;">${escapeHtml(v.label)}</option>`
        ).join('');
        html += `
          <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted);">
            <span>Quality:</span>
            <select id="probe-select-video" style="${selectStyle}">${optsHtml}</select>
          </label>
        `;
      }

      const titleCandidate = probe.title || '';
      const isAnimeCandidate = /(?:\[.*?\]|\b(?:ep(?:isode)?\.?\s*\d+|s\d+\s*e\d+|season\s*\d+|owarimonogatari|monogatari|naruto|piece|bleach|jujutsu|frieren|knight|elaina|witch|slime|re:zero|titan|hero|dungeon|isekai|danmachi|sword|art|online|shield|solo|leveling)\b)/i.test(titleCandidate) || (Array.isArray(probe.subtitles) && probe.subtitles.length > 0);
      const isDub = /dub/i.test(titleCandidate);
      const titleHasDual = /dual\s*audio/i.test(titleCandidate);

      const hasJapanese = probe.audioTracks?.some((a) => /japanese|ja/i.test(a.name || '') || /ja/i.test(a.lang || ''));
      const hasEnglish = probe.audioTracks?.some((a) => /english|en/i.test(a.name || '') || /en/i.test(a.lang || ''));
      const canDual = (hasJapanese && hasEnglish) || titleHasDual;

      const preferredAudioPref = state.lastDownloadPreferences?.audioPreference;
      const preferDual = preferredAudioPref ? preferredAudioPref === 'dual' : canDual;
      const preferEng = preferredAudioPref ? (/eng|dub/i.test(preferredAudioPref)) : false;
      const preferJpn = preferredAudioPref ? (/jpn|ja/i.test(preferredAudioPref)) : false;

      let audioOptsHtml = '';
      if (hasAudioChoices) {
        audioOptsHtml = probe.audioTracks.map((a) => {
          let label = a.name;
          const isTrackEng = /english|en/i.test(label) || /eng/i.test(a.lang || '');
          const isTrackJpn = /japanese|ja/i.test(label) || /jpn/i.test(a.lang || '');
          if (isTrackJpn) label = 'Japanese (Original)';
          else if (isTrackEng) label = 'English (Dub)';
          else label = label.replace(/\s*\([^)]*\)/g, '').trim() || label;

          let isSelected = false;
          if (preferDual) {
            isSelected = false;
          } else if (preferEng) {
            isSelected = isTrackEng;
          } else if (preferJpn) {
            isSelected = isTrackJpn;
          } else {
            isSelected = Boolean(a.isDefault);
          }
          return `<option value="${escapeHtml(a.url)}" ${isSelected ? 'selected' : ''} style="background:#181818;color:#fff;">${escapeHtml(label)}</option>`;
        }).join('') + (canDual ? `<option value="__DUAL__" ${preferDual ? 'selected' : ''} style="background:#181818;color:var(--accent);font-weight:600;">Dual Audio (Japanese & English)</option>` : '');
      } else if (Array.isArray(probe.audioTracks) && probe.audioTracks.length === 1) {
        let singleLabel = probe.audioTracks[0].name || '';
        if (/japanese|ja/i.test(singleLabel) || /jpn/i.test(probe.audioTracks[0].lang || '')) singleLabel = 'Japanese (Original)';
        else if (/english|en/i.test(singleLabel) || /eng/i.test(probe.audioTracks[0].lang || '')) singleLabel = 'English (Dub)';
        else singleLabel = singleLabel.replace(/\s*\([^)]*\)/g, '').trim() || (isAnimeCandidate ? (isDub ? 'English (Dub)' : 'Japanese (Original)') : 'Default Audio (Stereo)');
        audioOptsHtml = `<option value="${escapeHtml(probe.audioTracks[0].url || '')}" selected style="background:#181818;color:#fff;">${escapeHtml(singleLabel)}</option>`;
      } else {
        const singleLabel = isAnimeCandidate ? (isDub ? 'English (Dub)' : 'Japanese (Original)') : 'Default Audio (Stereo)';
        audioOptsHtml = `<option value="" selected style="background:#181818;color:#fff;">${escapeHtml(singleLabel)}</option>`;
      }

      html += `
        <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted);">
          <span>Audio:</span>
          <select id="probe-select-audio" style="${selectStyle}">${audioOptsHtml}</select>
        </label>
      `;

      if (hasSubs) {
        const preferredSubPref = state.lastDownloadPreferences?.subPreference;
        const isEmbedOn = preferredSubPref === 'none' ? false : (state.embedSubtitlesOnDownload !== false);
        let subOptsHtml = '';
        if (probe.subtitles.length > 1) {
          subOptsHtml += `<option value="__ALL__" ${isEmbedOn ? 'selected' : ''} style="background:#181818;color:var(--accent);font-weight:600;">Embed All (${probe.subtitles.length} tracks)</option>`;
          subOptsHtml += probe.subtitles.map((s, idx) => {
            let label = s.label || s.name || s.lang || `Track ${idx + 1}`;
            if (/english|en/i.test(label) || /eng/i.test(s.lang || '')) label = 'English';
            else if (/japanese|ja/i.test(label) || /jpn/i.test(s.lang || '')) label = 'Japanese';
            else if (/german|deutsch|de/i.test(label) || /ger|deu/i.test(s.lang || '')) label = 'German';
            else if (/indonesian|indo|in/i.test(label) || /^in$/i.test(s.lang || '')) label = 'Indonesian';
            else if (/thai|th/i.test(label) || /^th$/i.test(s.lang || '')) label = 'Thai';
            const val = s.url || s.label || String(idx);
            return `<option value="${escapeHtml(val)}" style="background:#181818;color:#fff;">${escapeHtml(label)}</option>`;
          }).join('');
          subOptsHtml += `<option value="__NONE__" ${!isEmbedOn ? 'selected' : ''} style="background:#181818;color:#aaa;">No Subtitles (Skip)</option>`;
        } else {
          const s = probe.subtitles[0];
          let label = s.label || s.name || s.lang || 'Subtitle';
          if (/english|en/i.test(label) || /eng/i.test(s.lang || '')) label = 'English';
          else if (/japanese|ja/i.test(label) || /jpn/i.test(s.lang || '')) label = 'Japanese';
          else if (/german|deutsch|de/i.test(label) || /ger|deu/i.test(s.lang || '')) label = 'German';
          subOptsHtml += `<option value="__ALL__" ${isEmbedOn ? 'selected' : ''} style="background:#181818;color:var(--accent);font-weight:600;">Embed Subtitle (${escapeHtml(label)})</option>`;
          subOptsHtml += `<option value="__NONE__" ${!isEmbedOn ? 'selected' : ''} style="background:#181818;color:#aaa;">No Subtitles (Skip)</option>`;
        }

        html += `
          <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted);">
            <span>Subtitles:</span>
            <select id="probe-select-sub" style="${selectStyle}">${subOptsHtml}</select>
          </label>
        `;
      } else {
        html += `
          <span style="font-size:11px;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:2px 7px;border-radius:5px;border:1px solid var(--border-panel);">
            Subtitles: None in stream manifest
          </span>
        `;
      }

      html += '</div>';
      return html;
    }

    let lastHandledStreamUrl = '';
    let lastHandledStreamTime = 0;

    function extractUrlFromText(text) {
      if (!text || typeof text !== 'string') return null;
      const trimmed = text.trim();
      const clean = trimmed.replace(/^["'<(\[]+|["'>)\]]+$/g, '').trim();
      if (/^https?:\/\//i.test(clean)) {
        const firstLine = clean.split(/\r?\n/).map(l => l.trim()).find(l => /^https?:\/\//i.test(l));
        return firstLine || clean;
      }
      const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
      return match ? match[0] : null;
    }

    function handleIncomingStreamUrl(rawUrl) {
      const url = extractUrlFromText(rawUrl);
      if (!url) return false;

      const now = Date.now();
      if (lastHandledStreamUrl === url && now - lastHandledStreamTime < 1000) {
        return true;
      }
      lastHandledStreamUrl = url;
      lastHandledStreamTime = now;

      openSettingsTab('stream-download');

      if (el.streamUrlInput) {
        el.streamUrlInput.value = url;
        el.streamUrlInput.focus();
        el.streamUrlInput.select();
      }

      if (el.streamProbeResult) {
        el.streamProbeResult.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Analyzing stream manifest & renditions...</span>';
        el.streamProbeResult.style.display = 'block';
      }

      showToast('Stream URL detected — analyzing stream...');
      handleStreamProbeAction();
      return true;
    }

    async function handleStreamProbeAction() {
      const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
      if (!rawUrl) {
        showToast('Please paste a stream URL first');
        if (el.streamUrlInput) el.streamUrlInput.focus();
        return;
      }

      if (el.btnStreamProbe) el.btnStreamProbe.textContent = 'Probing...';
      lastProbedData = null;
      if (el.streamProbeResult) {
        el.streamProbeResult.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Analyzing stream manifest & renditions...</span>';
        el.streamProbeResult.style.display = 'block';
      }
      try {
        const probe = await api.probeStreamUrl(rawUrl);
        lastProbedData = probe;
        if (el.streamFilenameInput && probe.title) {
          if (!el.streamFilenameInput.value.trim() || el.streamFilenameInput.dataset.autoFilled === 'true') {
            el.streamFilenameInput.value = formatDoubleDigitEpisode(stripLanguageTags(probe.title));
            el.streamFilenameInput.dataset.autoFilled = 'true';
          }
        }
        if (el.streamProbeResult) {
          el.streamProbeResult.style.display = 'block';
          const durInfo = probe.durationFormatted ? ` • Duration: <strong style="color:var(--text-primary);">${probe.durationFormatted}</strong>` : '';
          const selectorsHtml = buildProbeTrackSelectorsHtml(probe);
          if (probe.autoExtracted) {
            el.streamProbeResult.innerHTML = `
              <div style="font-weight:600;color:var(--accent);margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                <span>✓</span>
                <span>Direct Media Stream Auto-Extracted!</span>
              </div>
              <div style="font-size:12px;color:var(--text-primary);font-weight:600;margin-bottom:3px;">${escapeHtml(probe.title)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">
                Format: <strong style="color:var(--text-primary);">${probe.format}</strong>${durInfo} • 
                Ready to <strong style="color:var(--accent);">Play</strong> or <strong style="color:var(--accent);">Download</strong>
              </div>
              ${selectorsHtml}
            `;
            showToast('Stream auto-extracted from webpage!');
          } else if (probe.isWebpage) {
            el.streamProbeResult.innerHTML = `
              <div style="font-weight:600;color:#ffaa00;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
                <span>⚠️</span>
                <span>Website Page (HTML) Detected</span>
              </div>
              <div style="font-size:11.5px;color:var(--text-secondary);line-height:1.5;">
                This link points to a website page, not a direct video stream.<br>
                To stream or download, copy the direct <strong>.m3u8</strong> or <strong>.mp4</strong> stream URL from the browser's Developer Tools (Network tab &rarr; filter <code>m3u8</code>).
              </div>
            `;
            showToast('Webpage detected (direct media stream link needed)');
          } else {
            el.streamProbeResult.innerHTML = `
              <div style="font-weight:600;color:var(--accent);margin-bottom:2px;">${escapeHtml(probe.title)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">
                Format: <strong style="color:var(--text-primary);">${probe.format}</strong>${durInfo} • 
                Size: <strong style="color:var(--text-primary);">${probe.sizeFormatted}</strong> • 
                Type: <code>${probe.isHls ? 'HLS Playlist (.m3u8)' : (probe.isDash ? 'DASH (.mpd)' : 'Direct Video')}</code>
              </div>
              ${selectorsHtml}
            `;
            showToast('Stream verified!');
          }

          const audioSel = document.getElementById('probe-select-audio');
          if (audioSel && el.streamFilenameInput) {
            audioSel.addEventListener('change', () => {
              if (el.streamFilenameInput.dataset.autoFilled === 'true' && lastProbedData?.title) {
                const baseTitle = formatDoubleDigitEpisode(stripLanguageTags(lastProbedData.title));
                el.streamFilenameInput.value = baseTitle;
              }
            });
          }
        }
      } catch (err) {
        if (el.streamProbeResult) {
          el.streamProbeResult.style.display = 'block';
          el.streamProbeResult.innerHTML = `<span style="color:#ff6b6b;">Error probing stream: ${escapeHtml(err.message)}</span>`;
        }
      } finally {
        if (el.btnStreamProbe) el.btnStreamProbe.textContent = 'Probe';
      }
    }

    if (el.playerDlHud) {
      el.playerDlHud.addEventListener('mouseenter', () => {
        if (hudAutoDismissTimer) {
          clearTimeout(hudAutoDismissTimer);
          hudAutoDismissTimer = null;
        }
        el.playerDlHud.classList.remove('fading');
      });
      el.playerDlHud.addEventListener('mouseleave', () => {
        if (currentHudCompletedTaskId && !el.playerDlHud.classList.contains('hidden')) {
          scheduleHudAutoDismiss(currentHudCompletedTaskId, 4000);
        }
      });
    }

    if (el.btnPlayerDlPlay) {
      el.btnPlayerDlPlay.addEventListener('click', async () => {
        const filePath = el.btnPlayerDlPlay.dataset.path;
        dismissHudCompleted();
        if (filePath) {
          await playLocalFile(filePath, true);
        }
      });
    }

    if (el.btnPlayerDlQueue) {
      el.btnPlayerDlQueue.addEventListener('click', async () => {
        const filePath = el.btnPlayerDlQueue.dataset.path || (el.btnPlayerDlPlay ? el.btnPlayerDlPlay.dataset.path : '');
        dismissHudCompleted();
        if (filePath && api.resolvePaths) {
          try {
            const res = await api.resolvePaths([filePath]);
            if (res && res.items && res.items.length > 0) {
              appendItemsToQueue(res.items, { playFirstIfIdle: false, toast: true });
              el.rightDrawer.classList.remove('collapsed');
              el.btnQueueDrawer.classList.add('active');
              state.drawerTab = 'queue';
              renderRightDrawer();
              showToast(`Added to Queue: ${res.items[0].title || res.items[0].name}`);
              return;
            }
          } catch {}
        }
        openSettingsTab('stream-download');
      });
    }

    if (el.btnPlayerDlCancel) {
      el.btnPlayerDlCancel.addEventListener('click', () => {
        const id = el.btnPlayerDlCancel.dataset.id;
        if (id && api.cancelDownload) {
          api.cancelDownload(id);
        }
      });
    }

    if (el.btnPlayerDlDismiss) {
      el.btnPlayerDlDismiss.addEventListener('click', () => {
        dismissHudCompleted();
      });
    }

    if (el.topDlIndicator) {
      el.topDlIndicator.addEventListener('click', () => {
        openSettingsTab('stream-download');
      });
    }

    // Attach Stream & Downloader UI Event Handlers
    if (el.menuOpenStream) {
      el.menuOpenStream.addEventListener('click', () => {
        el.headerMenu.classList.remove('open');
        updateChromeSolidity();
        openSettingsTab('stream-download');
      });
    }

    if (el.btnStreamPaste) {
      el.btnStreamPaste.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text && el.streamUrlInput) {
            el.streamUrlInput.value = text.trim();
            showToast('Pasted URL from clipboard');
            handleStreamProbeAction();
          } else {
            showToast('Clipboard is empty');
          }
        } catch {
          showToast('Could not access clipboard');
        }
      });
    }

    if (el.btnStreamProbe) {
      el.btnStreamProbe.addEventListener('click', handleStreamProbeAction);
    }
    if (el.btnStreamPlay) {
      el.btnStreamPlay.addEventListener('click', handleStreamPlayAction);
    }
    if (el.btnStreamDownload) {
      el.btnStreamDownload.addEventListener('click', handleStreamDownloadAction);
    }
    if (el.btnStreamNextEp) {
      el.btnStreamNextEp.addEventListener('click', async () => {
        const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
        if (!rawUrl) {
          showToast('Paste or enter an episode URL first');
          return;
        }
        if (!api.incrementEpisodeUrl) return;
        const nextUrl = await api.incrementEpisodeUrl(rawUrl, 1);
        if (!nextUrl || nextUrl === rawUrl) {
          showToast('No episode number found in URL to increment');
          return;
        }
        el.streamUrlInput.value = nextUrl;

        // Also increment filename input if present
        if (el.streamFilenameInput && el.streamFilenameInput.value.trim()) {
          const fn = el.streamFilenameInput.value.trim();
          const nextFn = fn.replace(/(\b(?:ep|episode)?\s*[-_]?\s*)(\d+)/i, (m, p1, p2) => {
            const nextNum = parseInt(p2, 10) + 1;
            return p1 + String(nextNum).padStart(Math.max(2, p2.length), '0');
          });
          if (nextFn !== fn) {
            el.streamFilenameInput.value = formatDoubleDigitEpisode(nextFn);
          }
        }
        lastProbedData = null;
        if (el.streamProbeResult) {
          el.streamProbeResult.innerHTML = '';
          el.streamProbeResult.style.display = 'none';
        }
        showToast('Incremented to next episode (+1)');
      });
    }
    if (el.btnStreamSeason) {
      el.btnStreamSeason.addEventListener('click', () => {
        if (!el.streamSeasonPanel) return;
        const isShown = el.streamSeasonPanel.style.display === 'block';
        el.streamSeasonPanel.style.display = isShown ? 'none' : 'block';
        if (!isShown) {
          // Pre-populate series folder name and episode numbers
          const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
          const customTitle = el.streamFilenameInput ? el.streamFilenameInput.value.trim() : '';
          if (el.seasonFolderName && !el.seasonFolderName.value.trim()) {
            let guess = stripLanguageTags(customTitle.replace(/\s*[-_]\s*episode\s*\d+/i, '').replace(/\s*[-_]\s*ep\s*\d+/i, '').trim());
            if (!guess && rawUrl) {
              try {
                const parts = new URL(rawUrl).pathname.split('/').filter(Boolean);
                for (let i = parts.length - 1; i >= 0; i--) {
                  let seg = parts[i].replace(/\.(html|php|mp4|m3u8)$/i, '').replace(/[-_]?(?:episode|ep)[-_]?\d+/i, '').replace(/[-_]\d+$/, '').replace(/[-_]+/g, ' ').trim();
                  if (seg && !/^(watch|video|play|anime|stream)$/i.test(seg)) {
                    guess = stripLanguageTags(seg.replace(/\b\w/g, c => c.toUpperCase()));
                    break;
                  }
                }
              } catch {}
            }
            el.seasonFolderName.value = guess || 'Anime Series';
          }
        }
      });
    }
    if (el.btnQueueSeason) {
      el.btnQueueSeason.addEventListener('click', async () => {
        const rawUrl = el.streamUrlInput ? el.streamUrlInput.value.trim() : '';
        if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
          showToast('Paste a valid streaming episode URL first');
          return;
        }

        const fromEp = parseInt(el.seasonFromEp?.value, 10) || 1;
        const toEp = parseInt(el.seasonToEp?.value, 10) || 12;
        if (fromEp > toEp) {
          showToast('From Episode must be less than or equal to To Episode');
          return;
        }

        const seriesTitle = stripLanguageTags((el.seasonFolderName?.value || '').trim());
        const opts = getSelectedProbeOptions(lastProbedData);

        let audioPreference = 'any';
        if (opts.dualAudio) {
          audioPreference = 'dual';
        } else if (opts.selectedAudioName) {
          if (/english|dub/i.test(opts.selectedAudioName)) audioPreference = 'eng';
          else if (/japanese|jpn/i.test(opts.selectedAudioName)) audioPreference = 'jpn';
        } else if (state.lastDownloadPreferences?.audioPreference) {
          audioPreference = state.lastDownloadPreferences.audioPreference;
        }

        let subPreference = 'any';
        if (!opts.embedSubtitles || (opts.selectedSubtitles && opts.selectedSubtitles.length === 0)) {
          subPreference = 'none';
        } else if (opts.selectedSubtitles && opts.selectedSubtitles.length > 0) {
          const firstSub = opts.selectedSubtitles[0];
          const name = firstSub.label || firstSub.name || '';
          if (/english/i.test(name)) subPreference = 'eng';
          else subPreference = 'any';
        } else if (state.lastDownloadPreferences?.subPreference) {
          subPreference = state.lastDownloadPreferences.subPreference;
        }

        try {
          showToast(`Queuing ${seriesTitle} (Ep ${fromEp}–${toEp}) in 10-episode sliding window...`);
          const res = await api.queueSeasonDownload({
            url: rawUrl,
            fromEp,
            toEp,
            seriesTitle,
            audioPreference,
            subPreference,
            dualAudio: opts.dualAudio || Boolean(state.lastDownloadPreferences?.dualAudio),
            embedSubtitles: opts.embedSubtitles !== false,
            outputFormat: 'mp4'
          });

          if (res && res.success) {
            showToast(`Season queued: ${res.totalEpisodes} episodes in sliding queue`);
            if (el.streamSeasonPanel) el.streamSeasonPanel.style.display = 'none';
            const q = await api.getDownloadQueue();
            if (Array.isArray(q)) {
              q.forEach(t => activeDownloadsMap.set(t.id, t));
              renderDownloadQueue();
            }
          }
        } catch (err) {
          showToast(`Failed to queue season: ${err.message}`);
        }
      });
    }
    if (el.btnHaltAllDl) {
      el.btnHaltAllDl.addEventListener('click', async () => {
        if (!api.haltAllDownloads) return;
        try {
          const res = await api.haltAllDownloads();
          showToast(`All downloads halted (${res?.haltedCount || 0} stopped)`);
          const q = await api.getDownloadQueue();
          if (Array.isArray(q)) {
            q.forEach(t => activeDownloadsMap.set(t.id, t));
            renderDownloadQueue();
          }
        } catch (err) {
          showToast(`Halt error: ${err.message}`);
        }
      });
    }
    if (el.streamFilenameInput) {
      el.streamFilenameInput.addEventListener('input', () => {
        el.streamFilenameInput.dataset.autoFilled = 'false';
      });
      el.streamFilenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleStreamDownloadAction();
      });
    }
    if (el.streamUrlInput) {
      el.streamUrlInput.addEventListener('input', () => {
        const val = el.streamUrlInput.value.trim();
        if (!lastProbedData || (lastProbedData.url !== val && lastProbedData.originalUrl !== val)) {
          lastProbedData = null;
          if (el.streamFilenameInput && el.streamFilenameInput.dataset.autoFilled === 'true') {
            el.streamFilenameInput.value = '';
          }
          if (el.streamProbeResult) {
            el.streamProbeResult.innerHTML = '';
            el.streamProbeResult.style.display = 'none';
          }
        }
      });
      el.streamUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleStreamPlayAction();
      });
    }

    if (el.btnChooseDlFolder) {
      el.btnChooseDlFolder.addEventListener('click', async () => {
        const folder = await api.chooseDownloadFolder();
        if (folder && el.downloadFolderDisplay) {
          el.downloadFolderDisplay.textContent = folder;
          showToast('Downloads folder updated');
        }
      });
    }

    if (el.btnOpenDlFolder) {
      el.btnOpenDlFolder.addEventListener('click', () => {
        if (api.openDownloadFolder) api.openDownloadFolder();
      });
    }

    if (el.btnClearCompletedDl) {
      el.btnClearCompletedDl.addEventListener('click', () => {
        for (const [id, task] of activeDownloadsMap.entries()) {
          if (task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') {
            activeDownloadsMap.delete(id);
          }
        }
        renderDownloadQueue();
      });
    }

    document.querySelectorAll('.portal-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const portalUrl = btn.dataset.portal;
        if (portalUrl && api.openExternal) {
          api.openExternal(portalUrl);
        }
      });
    });

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

    const isExternalDrag = (ev) => {
      const types = Array.from(ev.dataTransfer?.types || []);
      return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain') || types.includes('URL');
    };
    const isExternalFileDrag = isExternalDrag;

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

      const isEditorOpen = el.settingsBackdrop?.classList.contains('open') &&
        document.querySelector('.settings-panel[data-settings-panel="media-editor"]')?.style.display === 'flex';
      if (isEditorOpen) {
        el.dropOverlay.textContent = 'Drop file here to load into File & Media Tools';
      } else {
        el.dropOverlay.textContent = 'Drop media file or stream URL to play / download';
      }
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

      let droppedText = '';
      if (e.dataTransfer) {
        droppedText = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL') || e.dataTransfer.getData('text/plain') || '';
      }
      const streamUrl = extractUrlFromText(droppedText);

      const files = Array.from(e.dataTransfer?.files || []);
      const paths = files.map((f) => api.getPathForFile(f)).filter(Boolean);

      // If a URL was dropped without local files, open Stream & Download modal
      if (!paths.length && streamUrl) {
        handleIncomingStreamUrl(streamUrl);
        return;
      }

      if (!paths.length) return;

      // When "File & Media Tools" modal is active, load dropped file into editor instead of playing it
      const isEditorOpen = el.settingsBackdrop?.classList.contains('open') &&
        document.querySelector('.settings-panel[data-settings-panel="media-editor"]')?.style.display === 'flex';

      if (isEditorOpen && paths.length > 0) {
        const firstPath = paths[0];
        const ext = (firstPath.split('.').pop() || '').toLowerCase();
        const isSub = ['srt', 'vtt', 'ass', 'ssa', 'sub'].includes(ext);

        if (isSub) {
          if (el.subEmbedFile) el.subEmbedFile.value = firstPath;
          const subBtn = document.querySelector('.editor-subnav-btn[data-editor-subtab="subtitles"]');
          if (subBtn) subBtn.click();
          showToast(`Subtitle loaded into Embedder: ${firstPath.split(/[/\\]/).pop()}`);
          return;
        } else {
          if (el.editorSourcePath) el.editorSourcePath.value = firstPath;
          if (typeof window.mediaEditorInspectTarget === 'function') {
            window.mediaEditorInspectTarget(firstPath);
          }
          return;
        }
      }

      const resolved = await api.resolvePaths(paths);
      if (!resolved) {
        showToast('Unsupported file format');
        return;
      }

      if (resolved.streamUrl) {
        handleIncomingStreamUrl(resolved.streamUrl);
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
      if (isSkipPromptVisible) {
        updateSkipSegmentPosition();
      }
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

    // Global Paste Listener: Instantly open & probe stream URL pasted anywhere in player
    window.addEventListener('paste', (e) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
        return;
      }

      let pastedText = e.clipboardData?.getData('text') || '';
      const streamUrl = extractUrlFromText(pastedText);
      if (streamUrl) {
        e.preventDefault();
        handleIncomingStreamUrl(streamUrl);
      }
    });

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

      // Global Ctrl+V / Cmd+V stream URL paste shortcut
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v' || e.key === 'V')) {
        if (navigator.clipboard?.readText) {
          navigator.clipboard.readText().then((clipText) => {
            const streamUrl = extractUrlFromText(clipText);
            if (streamUrl) {
              handleIncomingStreamUrl(streamUrl);
            }
          }).catch(() => {});
        }
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

    // ==================== FILE & MEDIA TOOLS (CONVERTER, SUBTITLES, METADATA) ====================
    function initMediaEditorUI() {
      let currentProbedMeta = null;
      let activeConvertJobId = null;
      let activeSubJobId = null;
      let lastConvertedPath = null;
      let lastEmbeddedPath = null;

      function formatBytes(bytes) {
        if (!bytes || isNaN(bytes)) return '0 B';
        const k = 1024;
        const dm = 1;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
      }

      function formatDurationSecs(secs) {
        if (!secs || isNaN(secs)) return '00:00';
        const s = Math.floor(secs);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const rem = s % 60;
        if (h > 0) {
          return `${h}:${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
      }

      // Sub-tab switcher
      document.querySelectorAll('.editor-subnav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const subtab = btn.dataset.editorSubtab;
          document.querySelectorAll('.editor-subnav-btn').forEach((b) => {
            const isActive = b === btn;
            b.classList.toggle('active', isActive);
            b.style.background = isActive ? 'var(--accent)' : 'transparent';
            b.style.color = isActive ? '#FFFFFF' : 'var(--text-muted)';
          });
          if (el.subpanelConverter) el.subpanelConverter.style.display = subtab === 'converter' ? 'flex' : 'none';
          if (el.subpanelSubtitles) el.subpanelSubtitles.style.display = subtab === 'subtitles' ? 'flex' : 'none';
          if (el.subpanelMetadata) el.subpanelMetadata.style.display = subtab === 'metadata' ? 'flex' : 'none';
        });
      });

      // Probe selected target media file and auto-preload all tabs
      async function inspectTargetFile(filePath, opts = {}) {
        if (!filePath || !api.probeMediaMetadata) return;
        try {
          const raw = await api.probeMediaMetadata(filePath);
          if (!raw || (raw.success === false && !raw.fileName && !raw.filename)) {
            if (!opts.silent) showToast(raw?.error || 'Failed to inspect media file');
            return;
          }
          const meta = raw;
          currentProbedMeta = meta;

          const fileName = meta.fileName || meta.filename || filePath.split(/[/\\]/).pop();
          const fileSize = meta.sizeFormatted || formatBytes(meta.sizeBytes || meta.size);
          const format = (meta.formatName || meta.format || 'video').toUpperCase();
          const primaryVid = meta.video || meta.videoStream || {};
          const res = primaryVid.resolution || (primaryVid.width ? `${primaryVid.width}x${primaryVid.height}` : 'Audio');
          const fps = primaryVid.fps ? ` (${primaryVid.fps} fps)` : '';
          const codec = primaryVid.codec && primaryVid.codec !== 'unknown' ? ` • ${primaryVid.codec.toUpperCase()}` : '';
          const duration = meta.durationFormatted || formatDurationSecs(meta.durationSec || meta.duration);

          const aTracks = meta.audioTracks || meta.audioStreams || [];
          const aCount = aTracks.length;
          const aLang = aTracks[0]?.language || aTracks[0]?.tags?.language || '';
          const audioLabel = aCount > 0 ? `${aCount} Audio (${aLang && aLang !== 'und' ? aLang.toUpperCase() : 'Track 1'})` : 'No Audio';

          const sTracks = meta.subtitleTracks || meta.subtitleStreams || [];
          const sCount = sTracks.length;
          const subLabel = sCount > 0 ? `${sCount} Subtitle${sCount === 1 ? '' : 's'}` : 'No Subtitles';

          // Update badge in File & Media Tools UI
          if (el.editorFileBadge) el.editorFileBadge.style.display = 'block';
          if (el.editorBadgeFilename) el.editorBadgeFilename.textContent = fileName;
          if (el.editorBadgeSize) el.editorBadgeSize.textContent = fileSize;
          if (el.editorBadgeFormat) el.editorBadgeFormat.textContent = format;
          if (el.editorBadgeRes) el.editorBadgeRes.textContent = `${res}${fps}${codec}`;
          if (el.editorBadgeDuration) el.editorBadgeDuration.textContent = duration;
          if (el.editorBadgeAudio) el.editorBadgeAudio.textContent = audioLabel;
          if (el.editorBadgeSub) el.editorBadgeSub.textContent = subLabel;

          // 1. Auto-update suggested output path for converter
          updateSuggestedOutputPath();

          // 2. Extract metadata & verified series/episode
          const extractedMeta = extractMetadataFromFilename(fileName, meta.tags || {});
          populateMetadataFields(meta, extractedMeta);

          // 3. Auto-populate subtitle query with clean Show + Episode or clean title
          if (el.subSearchQuery) {
            if (extractedMeta.show && extractedMeta.episode) {
              const epPadded = extractedMeta.episode.padStart(2, '0');
              el.subSearchQuery.value = extractedMeta.season && extractedMeta.season !== '1'
                ? `${extractedMeta.show} S${extractedMeta.season.padStart(2, '0')}E${epPadded}`
                : `${extractedMeta.show} ${extractedMeta.episode}`;
            } else if (extractedMeta.title) {
              el.subSearchQuery.value = extractedMeta.title;
            }
          }

          // 4. Trigger Auto Web Subtitle Ripper if series & episode are verified
          if (extractedMeta.show && extractedMeta.episode) {
            triggerAutoWebSubtitleRipper(filePath, extractedMeta);
          }

          if (!opts.silent) {
            showToast(`📊 Analyzed: ${fileName} • ${res} • ${duration} • Preloaded!`);
          }
        } catch (err) {
          console.error('inspectTargetFile error:', err);
        }
      }

      window.mediaEditorInspectTarget = inspectTargetFile;

      function updateSuggestedOutputPath() {
        const src = el.editorSourcePath?.value?.trim();
        if (!src || !el.converterOutputPath) return;
        const fmt = el.converterFormatSelect?.value || 'mp4';
        const lastDot = src.lastIndexOf('.');
        if (lastDot !== -1) {
          el.converterOutputPath.value = src.substring(0, lastDot) + '.' + fmt;
        }
      }

      function extractMetadataFromFilename(filename, existingTags = {}) {
        if (!filename) return {};
        let base = filename.replace(/\.[^/.]+$/, '');

        // 1. Strip release group prefixes like [SubsPlease], [Erai-raws], [HorribleSubs], [Judas]
        base = base.replace(/^\[[^\]]+\]\s*/, '').trim();

        // 2. Strip CRC32 checksums and bracket tags like [98A53B3C] or [720p]
        base = base.replace(/\s*\[[0-9a-fA-F]{8}\]$/, '').trim();
        base = base.replace(/\s*\([^)]*?(?:1080p|720p|480p|2160p|4k|x264|x265|hevc|av1|bluray|web-?dl|aac|flac)[^)]*?\)/gi, '').trim();
        base = base.replace(/\s*\[[^\]]*?(?:1080p|720p|480p|2160p|4k|x264|x265|hevc|av1|bluray|web-?dl|aac|flac)[^\]]*?\]/gi, '').trim();

        // 3. Extract 4-digit release year if present
        let year = existingTags.date || existingTags.year || existingTags.creation_time?.substring(0, 4) || '';
        const yearMatch = base.match(/(?:[._ -]|\b)(19\d\d|20\d\d)(?:[._ -]|\b)/);
        if (!year && yearMatch) {
          year = yearMatch[1];
          base = base.replace(yearMatch[0], ' ');
        }

        // 4. Strip common technical tags
        const techRegex = /\b(?:1080p|720p|480p|2160p|4k|x264|x265|hevc|av1|bluray|bdrip|web-?dl|webrip|hdtv|dvdrip|aac|flac|dual-?audio|multi-?audio|10-?bit)\b/gi;
        base = base.replace(techRegex, '').replace(/\s+/g, ' ').trim();

        let show = existingTags.show || existingTags.SHOW || existingTags.series || '';
        let season = existingTags.season_number || existingTags.season || '';
        let episode = existingTags.episode_sort || existingTags.episode_id || existingTags.track || '';
        let title = existingTags.title || existingTags.TITLE || '';

        const cleanToken = (tok) => {
          if (!tok) return '';
          return tok.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[-–—]+|[-–—]+$/g, '').trim();
        };

        // Pattern A: S01E02 or 1x02
        const seMatch = base.match(/(.*?)(?:[._ -]+|\b)[sS](\d{1,2})[eE](\d{1,4})(?:[._ -]+|\b)(.*)/i)
          || base.match(/(.*?)(?:[._ -]+|\b)(\d{1,2})x(\d{1,4})(?:[._ -]+|\b)(.*)/i);

        if (seMatch) {
          if (!show) show = cleanToken(seMatch[1]);
          if (!season) season = parseInt(seMatch[2], 10).toString();
          if (!episode) episode = parseInt(seMatch[3], 10).toString();
          const epTitlePart = cleanToken(seMatch[4]);
          if (!title) {
            title = epTitlePart || (show ? `${show} - Episode ${episode.padStart(2, '0')}` : `Episode ${episode}`);
          }
        } else {
          // Pattern B: Series - 01 - Episode Title or Series 001 or Series Ep 01
          const epMatch = base.match(/(.*?)(?:[._ -]+|\b)(?:ep|episode|[._ -])\s*(\d{1,4})(?:[._ -]+|\b)(.*)/i)
            || base.match(/(.*?)(?:[._ -]+|\b)-[._ -]+(\d{1,4})(?:[._ -]+|\b)(.*)/i)
            || base.match(/(.*?)\s+(\d{1,4})\s*(.*)/i);

          if (epMatch) {
            if (!show) show = cleanToken(epMatch[1]);
            if (!season) season = '1';
            if (!episode) episode = parseInt(epMatch[2], 10).toString();
            const epTitlePart = cleanToken(epMatch[3]);
            if (!title) {
              title = epTitlePart || (show ? `${show} - Episode ${episode.padStart(2, '0')}` : `Episode ${episode}`);
            }
          } else {
            if (!title) title = cleanToken(base);
            if (!show && year) show = cleanToken(base);
          }
        }

        return { show: show || '', season: season || '', episode: episode || '', title: title || '', year: year || '' };
      }

      function populateMetadataFields(meta, customParsed = null) {
        if (!meta) return;
        const tags = meta.tags || {};
        const parsed = customParsed || extractMetadataFromFilename(meta.filename, tags);

        if (el.metaFieldTitle) el.metaFieldTitle.value = tags.title || tags.TITLE || parsed.title || '';
        if (el.metaFieldShow) el.metaFieldShow.value = tags.show || tags.SHOW || tags.series || parsed.show || '';
        if (el.metaFieldSeason) el.metaFieldSeason.value = tags.season_number || tags.season || parsed.season || '';
        if (el.metaFieldEpisode) el.metaFieldEpisode.value = tags.episode_sort || tags.episode_id || tags.track || parsed.episode || '';
        if (el.metaFieldYear) el.metaFieldYear.value = tags.date || tags.year || parsed.year || '';
        if (el.metaFieldArtist) el.metaFieldArtist.value = tags.artist || tags.ARTIST || tags.composer || tags.creator || '';
        if (el.metaFieldComment) el.metaFieldComment.value = tags.comment || tags.description || tags.synopsis || '';
        if (el.metaFieldAudioLang) el.metaFieldAudioLang.value = meta.audioStreams?.[0]?.lang || 'eng';
      }

      async function triggerAutoWebSubtitleRipper(filePath, extractedMeta) {
        if (!api.searchSubtitles || !api.downloadSubtitle) return;
        const targetLang = el.subSearchLang?.value || 'eng';
        const epPadded = extractedMeta.episode.padStart(2, '0');
        const query = extractedMeta.season && extractedMeta.season !== '1'
          ? `${extractedMeta.show} S${extractedMeta.season.padStart(2, '0')}E${epPadded}`
          : `${extractedMeta.show} ${extractedMeta.episode}`;

        if (el.subResultsContainer) {
          el.subResultsContainer.style.display = 'block';
          el.subResultsContainer.innerHTML = `
            <div style="padding:10px;font-size:11.5px;color:var(--accent);display:flex;align-items:center;gap:6px;">
              <span class="sub-pill">AUTO-RIPPER</span>
              <span>Looking up web subtitles for <strong>${escapeHtml(extractedMeta.show)} Ep ${escapeHtml(extractedMeta.episode)}</strong> (${targetLang.toUpperCase()})...</span>
            </div>
          `;
        }

        try {
          const res = await api.searchSubtitles({ query, lang: targetLang, filePath });
          if (!res || !res.success) return;

          renderSubtitleResults(res.localResults || [], res.onlineResults || []);

          // 1. If local companion subtitle file exists in folder, select it
          if (res.localResults && res.localResults.length > 0) {
            const bestLocal = res.localResults[0];
            if (el.subEmbedFile) el.subEmbedFile.value = bestLocal.filePath;
            if (el.subEmbedLang) el.subEmbedLang.value = bestLocal.lang || targetLang;
            if (el.subEmbedTitle) el.subEmbedTitle.value = `${(bestLocal.lang || targetLang).toUpperCase()} Subtitles`;
            showToast(`Local subtitle auto-selected: ${bestLocal.fileName}`);
            return;
          }

          // 2. If online OpenSubtitles exist, auto-download top result into embedder
          if (res.onlineResults && res.onlineResults.length > 0) {
            const topSub = res.onlineResults[0];
            if (topSub.downloadUrl) {
              const dlRes = await api.downloadSubtitle(topSub.downloadUrl);
              const targetPath = (typeof dlRes === 'string') ? dlRes : (dlRes?.targetPath || dlRes?.outputPath || (dlRes?.success ? dlRes.targetPath : null));
              if (targetPath) {
                if (el.subEmbedFile) el.subEmbedFile.value = targetPath;
                if (el.subEmbedLang) el.subEmbedLang.value = topSub.lang || targetLang;
                if (el.subEmbedTitle) el.subEmbedTitle.value = `${(topSub.lang || targetLang).toUpperCase()} Subtitles`;
                showToast(`⚡ Auto-ripped web subtitle for ${extractedMeta.show} Ep ${extractedMeta.episode}!`);
              }
            }
          }
        } catch (err) {
          console.debug('Auto subtitle ripper notice:', err.message);
        }
      }

      // Browse source video
      if (el.btnEditorBrowseFile) {
        el.btnEditorBrowseFile.addEventListener('click', async () => {
          if (!api.openVideoFileDialog) return;
          const filePath = await api.openVideoFileDialog();
          if (filePath && el.editorSourcePath) {
            el.editorSourcePath.value = filePath;
            inspectTargetFile(filePath);
          }
        });
      }

      // Use currently playing media
      if (el.btnEditorUseCurrent) {
        el.btnEditorUseCurrent.addEventListener('click', () => {
          const cur = state.currentItem?.filePath || state.currentItem?.path || getCurrentItem()?.filePath;
          if (cur && !cur.startsWith('http')) {
            if (el.editorSourcePath) el.editorSourcePath.value = cur;
            inspectTargetFile(cur);
            showToast('Loaded currently playing video into editor');
          } else {
            showToast('No local video currently playing');
          }
        });
      }

      if (el.editorSourcePath) {
        let inspectDebounceTimer = null;
        const triggerInspect = () => {
          const val = el.editorSourcePath.value.trim();
          if (val && val !== currentProbedMeta?.filePath) {
            inspectTargetFile(val);
          }
        };
        el.editorSourcePath.addEventListener('change', triggerInspect);
        el.editorSourcePath.addEventListener('paste', () => setTimeout(triggerInspect, 60));
        el.editorSourcePath.addEventListener('input', () => {
          clearTimeout(inspectDebounceTimer);
          inspectDebounceTimer = setTimeout(triggerInspect, 450);
        });
      }

      // Converter options
      if (el.converterFormatSelect) {
        el.converterFormatSelect.addEventListener('change', () => {
          updateSuggestedOutputPath();
          const fmt = el.converterFormatSelect.value;
          if (fmt === 'mp3' || fmt === 'aac') {
            if (el.converterSummaryText) el.converterSummaryText.textContent = 'Extracts high-fidelity audio stream to separate audio file.';
          } else {
            const mode = el.converterModeSelect?.value || 'remux';
            if (el.converterSummaryText) {
              el.converterSummaryText.textContent = mode === 'remux' 
                ? 'Fast remux preserves 100% original stream bits with no quality loss.'
                : 'Re-encode transcodes video & audio for compatibility or compression.';
            }
          }
        });
      }

      if (el.converterModeSelect) {
        el.converterModeSelect.addEventListener('change', () => {
          const isReencode = el.converterModeSelect.value === 'reencode';
          if (el.converterReencodeOptions) {
            el.converterReencodeOptions.style.display = isReencode ? 'grid' : 'none';
          }
          if (el.converterSummaryText) {
            el.converterSummaryText.textContent = isReencode
              ? 'Re-encode transcodes video & audio for compatibility or compression.'
              : 'Fast remux preserves 100% original stream bits with no quality loss.';
          }
        });
      }

      // Converter browse dest
      if (el.btnConverterBrowseDest) {
        el.btnConverterBrowseDest.addEventListener('click', async () => {
          if (!api.openVideoFileDialog) return;
          const res = await api.openVideoFileDialog();
          if (res && el.converterOutputPath) el.converterOutputPath.value = res;
        });
      }

      // Start conversion
      if (el.btnStartConvert) {
        el.btnStartConvert.addEventListener('click', async () => {
          const inputPath = el.editorSourcePath?.value?.trim();
          if (!inputPath) {
            showToast('Please select a target video file first');
            return;
          }
          const format = el.converterFormatSelect?.value || 'mp4';
          const mode = el.converterModeSelect?.value || 'remux';
          let outputPath = el.converterOutputPath?.value?.trim();
          if (!outputPath) {
            const lastDot = inputPath.lastIndexOf('.');
            outputPath = (lastDot !== -1 ? inputPath.substring(0, lastDot) : inputPath) + '_converted.' + format;
          }

          const crf = el.converterCrfSelect?.value || '23';
          const resolution = el.converterResSelect?.value || 'original';
          activeConvertJobId = 'conv_' + Date.now();

          if (el.converterProgressBox) el.converterProgressBox.style.display = 'block';
          if (el.converterProgressBar) el.converterProgressBar.style.width = '0%';
          if (el.converterPercentLabel) el.converterPercentLabel.textContent = '0%';
          if (el.converterStatusLabel) el.converterStatusLabel.textContent = mode === 'remux' ? 'Fast Remuxing...' : 'Re-encoding...';
          if (el.converterCompleteBanner) el.converterCompleteBanner.style.display = 'none';

          try {
            const res = await api.convertMedia({
              jobId: activeConvertJobId,
              inputPath,
              outputPath,
              format,
              mode,
              crf,
              resolution,
              faststart: true
            });

            if (res && res.success) {
              lastConvertedPath = res.outputPath || outputPath;
              if (el.converterProgressBox) el.converterProgressBox.style.display = 'none';
              if (el.converterCompleteBanner) el.converterCompleteBanner.style.display = 'block';
              showToast('Conversion completed successfully!');
              playDownloadCompletionChime();
            } else {
              showToast(res?.error || 'Conversion failed');
              if (el.converterProgressBox) el.converterProgressBox.style.display = 'none';
            }
          } catch (err) {
            showToast('Conversion error: ' + (err.message || err));
            if (el.converterProgressBox) el.converterProgressBox.style.display = 'none';
          } finally {
            activeConvertJobId = null;
          }
        });
      }

      // Cancel conversion
      if (el.btnConverterCancel) {
        el.btnConverterCancel.addEventListener('click', () => {
          if (activeConvertJobId && api.cancelMediaJob) {
            api.cancelMediaJob(activeConvertJobId);
            showToast('Conversion canceled');
            if (el.converterProgressBox) el.converterProgressBox.style.display = 'none';
            activeConvertJobId = null;
          }
        });
      }

      // Play / Reveal converted file
      if (el.btnConverterPlayResult) {
        el.btnConverterPlayResult.addEventListener('click', async () => {
          if (!lastConvertedPath) return;
          const bundle = await api.resolvePaths([lastConvertedPath]);
          if (bundle) ingestOpenedBundle(bundle, true, { append: false });
          toggleSettingsModal(false);
        });
      }
      if (el.btnConverterShowResult) {
        el.btnConverterShowResult.addEventListener('click', () => {
          if (lastConvertedPath && api.revealInExplorer) api.revealInExplorer(lastConvertedPath);
        });
      }

      // Subtitle Search (Online & Local)
      async function executeSubtitleSearch(query, lang) {
        if (!api.searchSubtitles) return;
        const filePath = el.editorSourcePath?.value?.trim();
        if (el.subResultsContainer) {
          el.subResultsContainer.style.display = 'block';
          el.subResultsContainer.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">Searching for matching subtitles...</div>';
        }

        try {
          const res = await api.searchSubtitles({ query, lang, filePath });
          if (!res || !res.success || (!res.localResults?.length && !res.onlineResults?.length)) {
            if (el.subResultsContainer) {
              el.subResultsContainer.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">No subtitles found. Try refining the search keywords.</div>';
            }
            return;
          }

          renderSubtitleResults(res.localResults || [], res.onlineResults || []);
        } catch (err) {
          if (el.subResultsContainer) {
            el.subResultsContainer.innerHTML = `<div style="padding:12px;font-size:12px;color:#ff6b6b;text-align:center;">Search failed: ${err.message || err}</div>`;
          }
        }
      }

      function renderSubtitleResults(localSubs, onlineSubs) {
        if (!el.subResultsContainer) return;
        el.subResultsContainer.innerHTML = '';

        if (localSubs.length > 0) {
          const secHeader = document.createElement('div');
          secHeader.style.cssText = 'font-size:10.5px;font-weight:700;letter-spacing:0.5px;color:var(--accent);text-transform:uppercase;margin:4px 6px 6px 6px;';
          secHeader.textContent = `Local Companion Subtitles (${localSubs.length})`;
          el.subResultsContainer.appendChild(secHeader);

          localSubs.forEach((sub) => {
            const row = document.createElement('div');
            row.className = 'sub-result-row';
            row.innerHTML = `
              <div style="display:flex;align-items:center;gap:8px;overflow:hidden;flex:1;">
                <span class="sub-pill">${escapeHtml(sub.lang || 'LOCAL')}</span>
                <span style="font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(sub.filePath)}">${escapeHtml(sub.fileName)}</span>
              </div>
              <button class="ghost-pill-btn" style="padding:3px 10px;font-size:11px;font-weight:600;margin-left:8px;" type="button">Use Subtitle</button>
            `;
            row.querySelector('button').addEventListener('click', () => {
              if (el.subEmbedFile) el.subEmbedFile.value = sub.filePath;
              if (el.subEmbedLang) el.subEmbedLang.value = sub.lang || 'eng';
              if (el.subEmbedTitle) el.subEmbedTitle.value = `${sub.lang?.toUpperCase() || 'Local'} Subtitles`;
              showToast(`Selected: ${sub.fileName}`);
            });
            el.subResultsContainer.appendChild(row);
          });
        }

        if (onlineSubs.length > 0) {
          const secHeader = document.createElement('div');
          secHeader.style.cssText = 'font-size:10.5px;font-weight:700;letter-spacing:0.5px;color:var(--accent);text-transform:uppercase;margin:8px 6px 6px 6px;';
          secHeader.textContent = `OpenSubtitles Results (${onlineSubs.length})`;
          el.subResultsContainer.appendChild(secHeader);

          onlineSubs.slice(0, 15).forEach((sub) => {
            const row = document.createElement('div');
            row.className = 'sub-result-row';
            row.innerHTML = `
              <div style="display:flex;align-items:center;gap:8px;overflow:hidden;flex:1;">
                <span class="sub-pill">${escapeHtml(sub.lang || 'SUB')}</span>
                <div style="display:flex;flex-direction:column;overflow:hidden;">
                  <span style="font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(sub.fileName)}">${escapeHtml(sub.fileName)}</span>
                  <span style="font-size:10px;color:var(--text-muted);">${sub.downloads ? sub.downloads.toLocaleString() + ' DLs' : ''} ${sub.format ? '• ' + sub.format.toUpperCase() : ''}</span>
                </div>
              </div>
              <div style="display:flex;gap:6px;margin-left:8px;">
                <button class="ghost-pill-btn btn-dl-sub" style="padding:3px 8px;font-size:11px;" type="button">Download</button>
                <button class="stream-probe-btn btn-use-sub" style="padding:3px 10px;font-size:11px;border-radius:5px;font-weight:600;background:rgba(var(--accent-rgb),0.18);color:var(--accent);" type="button">Use &amp; Embed</button>
              </div>
            `;

            // Download handler
            row.querySelector('.btn-dl-sub').addEventListener('click', async () => {
              if (!sub.downloadUrl || !api.downloadSubtitle) return;
              showToast('Downloading subtitle...');
              const dlRes = await api.downloadSubtitle(sub.downloadUrl);
              const targetPath = (typeof dlRes === 'string') ? dlRes : (dlRes?.targetPath || dlRes?.outputPath || (dlRes?.success ? dlRes.targetPath : null));
              if (targetPath) {
                showToast('Subtitle saved: ' + targetPath);
                if (api.revealInExplorer) api.revealInExplorer(targetPath);
              } else {
                showToast('Failed to download subtitle');
              }
            });

            // Use & Embed handler
            row.querySelector('.btn-use-sub').addEventListener('click', async () => {
              if (!sub.downloadUrl || !api.downloadSubtitle) return;
              showToast('Downloading subtitle for embedder...');
              const dlRes = await api.downloadSubtitle(sub.downloadUrl);
              const targetPath = (typeof dlRes === 'string') ? dlRes : (dlRes?.targetPath || dlRes?.outputPath || (dlRes?.success ? dlRes.targetPath : null));
              if (targetPath) {
                if (el.subEmbedFile) el.subEmbedFile.value = targetPath;
                if (el.subEmbedLang) el.subEmbedLang.value = sub.lang || 'eng';
                if (el.subEmbedTitle) el.subEmbedTitle.value = `${sub.lang?.toUpperCase() || 'Online'} Subtitles`;
                showToast('Subtitle ready for embedding!');
              } else {
                showToast('Failed to fetch subtitle');
              }
            });

            el.subResultsContainer.appendChild(row);
          });
        }
      }

      if (el.btnSubSearchOnline) {
        el.btnSubSearchOnline.addEventListener('click', () => {
          const query = el.subSearchQuery?.value?.trim() || '';
          const lang = el.subSearchLang?.value || 'eng';
          if (!query) {
            showToast('Please enter movie or series name');
            return;
          }
          executeSubtitleSearch(query, lang);
        });
      }

      if (el.btnSubDetectLocal) {
        el.btnSubDetectLocal.addEventListener('click', () => {
          const filePath = el.editorSourcePath?.value?.trim();
          if (!filePath) {
            showToast('Select a video file to look for local companion subtitles');
            return;
          }
          executeSubtitleSearch('', 'all');
        });
      }

      if (el.btnSubBrowseLocal) {
        el.btnSubBrowseLocal.addEventListener('click', async () => {
          if (!api.openSubtitleFileDialog) return;
          const subPath = await api.openSubtitleFileDialog();
          if (subPath && el.subEmbedFile) {
            el.subEmbedFile.value = subPath;
            showToast('Selected subtitle: ' + subPath.split(/[/\\]/).pop());
          }
        });
      }

      // Embed subtitle into video
      if (el.btnStartSubEmbed) {
        el.btnStartSubEmbed.addEventListener('click', async () => {
          const inputPath = el.editorSourcePath?.value?.trim();
          const subPath = el.subEmbedFile?.value?.trim();
          if (!inputPath) {
            showToast('Please select a target video file');
            return;
          }
          if (!subPath) {
            showToast('Please select a subtitle file (.srt, .vtt, .ass) to embed');
            return;
          }

          const mode = el.subEmbedMode?.value || 'soft';
          const lang = el.subEmbedLang?.value?.trim() || 'eng';
          const title = el.subEmbedTitle?.value?.trim() || 'English Subtitles';

          activeSubJobId = 'sub_' + Date.now();

          if (el.subEmbedProgressBox) el.subEmbedProgressBox.style.display = 'block';
          if (el.subEmbedProgressBar) el.subEmbedProgressBar.style.width = '0%';
          if (el.subEmbedPercentLabel) el.subEmbedPercentLabel.textContent = '0%';
          if (el.subEmbedStatusLabel) el.subEmbedStatusLabel.textContent = mode === 'soft' ? 'Remuxing subtitle track...' : 'Burning subtitles into video...';
          if (el.subEmbedCompleteBanner) el.subEmbedCompleteBanner.style.display = 'none';

          try {
            const res = await api.embedSubtitles({
              jobId: activeSubJobId,
              inputPath,
              subPath,
              lang,
              title,
              mode
            });

            if (res && res.success) {
              lastEmbeddedPath = res.outputPath;
              if (el.subEmbedProgressBox) el.subEmbedProgressBox.style.display = 'none';
              if (el.subEmbedCompleteBanner) el.subEmbedCompleteBanner.style.display = 'block';
              showToast('Subtitles embedded successfully!');
              playDownloadCompletionChime();
            } else {
              showToast(res?.error || 'Failed to embed subtitles');
              if (el.subEmbedProgressBox) el.subEmbedProgressBox.style.display = 'none';
            }
          } catch (err) {
            showToast('Embed error: ' + (err.message || err));
            if (el.subEmbedProgressBox) el.subEmbedProgressBox.style.display = 'none';
          } finally {
            activeSubJobId = null;
          }
        });
      }

      if (el.btnSubEmbedCancel) {
        el.btnSubEmbedCancel.addEventListener('click', () => {
          if (activeSubJobId && api.cancelMediaJob) {
            api.cancelMediaJob(activeSubJobId);
            showToast('Subtitle embedding canceled');
            if (el.subEmbedProgressBox) el.subEmbedProgressBox.style.display = 'none';
            activeSubJobId = null;
          }
        });
      }

      if (el.btnSubEmbedPlayResult) {
        el.btnSubEmbedPlayResult.addEventListener('click', async () => {
          if (!lastEmbeddedPath) return;
          const bundle = await api.resolvePaths([lastEmbeddedPath]);
          if (bundle) ingestOpenedBundle(bundle, true, { append: false });
          toggleSettingsModal(false);
        });
      }
      if (el.btnSubEmbedShowResult) {
        el.btnSubEmbedShowResult.addEventListener('click', () => {
          if (lastEmbeddedPath && api.revealInExplorer) api.revealInExplorer(lastEmbeddedPath);
        });
      }

      // Metadata & Tags Editor
      if (el.btnMetaPull) {
        el.btnMetaPull.addEventListener('click', () => {
          const inputPath = el.editorSourcePath?.value?.trim();
          if (!inputPath) {
            showToast('Select a video file first');
            return;
          }
          inspectTargetFile(inputPath);
          showToast('Pulled latest file metadata tags');
        });
      }

      if (el.btnMetaDetectFn) {
        el.btnMetaDetectFn.addEventListener('click', () => {
          const inputPath = el.editorSourcePath?.value?.trim();
          if (!inputPath) {
            showToast('Select a video file first');
            return;
          }
          const fn = inputPath.split(/[/\\]/).pop();
          const parsed = extractMetadataFromFilename(fn, {});
          populateMetadataFields({ filename: fn, tags: {} }, parsed);
          showToast('Parsed show, season & episode from filename');
        });
      }

      if (el.btnSaveMetadata) {
        el.btnSaveMetadata.addEventListener('click', async () => {
          const inputPath = el.editorSourcePath?.value?.trim();
          if (!inputPath) {
            showToast('Please select a target video file first');
            return;
          }
          if (!api.applyMediaMetadata) return;

          const tags = {
            title: el.metaFieldTitle?.value?.trim(),
            show: el.metaFieldShow?.value?.trim(),
            season: el.metaFieldSeason?.value?.trim(),
            episode: el.metaFieldEpisode?.value?.trim(),
            year: el.metaFieldYear?.value?.trim(),
            artist: el.metaFieldArtist?.value?.trim(),
            comment: el.metaFieldComment?.value?.trim(),
            audioLang: el.metaFieldAudioLang?.value?.trim()
          };

          if (el.metaSaveFeedback) el.metaSaveFeedback.textContent = 'Saving metadata tags losslessly...';

          try {
            const res = await api.applyMediaMetadata({ inputPath, tags });
            if (res && res.success) {
              if (el.metaSaveFeedback) el.metaSaveFeedback.textContent = 'Metadata written and integrated successfully!';
              showToast('Metadata saved into video file!');
            } else {
              if (el.metaSaveFeedback) el.metaSaveFeedback.textContent = 'Failed: ' + (res?.error || 'Unknown error');
              showToast('Metadata save error: ' + (res?.error || 'Unknown error'));
            }
          } catch (err) {
            if (el.metaSaveFeedback) el.metaSaveFeedback.textContent = 'Error: ' + err.message;
            showToast('Metadata save error: ' + err.message);
          }
        });
      }

      // Media Editor Progress Listener
      if (api.onMediaEditorProgress) {
        api.onMediaEditorProgress((data) => {
          if (!data || !data.jobId) return;
          if (activeConvertJobId && data.jobId === activeConvertJobId) {
            const pct = Math.min(100, Math.max(0, data.percent || 0));
            if (el.converterProgressBar) el.converterProgressBar.style.width = pct + '%';
            if (el.converterPercentLabel) el.converterPercentLabel.textContent = Math.round(pct) + '%';
            if (el.converterStatsLabel) {
              el.converterStatsLabel.textContent = `Time: ${data.time || '00:00'} | Speed: ${data.speed || '1x'} | ${data.fps || 0} fps`;
            }
          } else if (activeSubJobId && data.jobId === activeSubJobId) {
            const pct = Math.min(100, Math.max(0, data.percent || 0));
            if (el.subEmbedProgressBar) el.subEmbedProgressBar.style.width = pct + '%';
            if (el.subEmbedPercentLabel) el.subEmbedPercentLabel.textContent = Math.round(pct) + '%';
            if (el.subEmbedStatsLabel) {
              el.subEmbedStatsLabel.textContent = `Time: ${data.time || '00:00'} | Speed: ${data.speed || '1x'}`;
            }
          }
        });
      }
    }

    // Periodic status sync for AI Control Bridge
    setInterval(pushPlayerStatus, 1000);
    renderLibraryList({ scrollToTop: true });
    renderRightDrawer();
    updateChromeSolidity();
    pushPlayerStatus();
    initDownloaderUI();
    initMediaEditorUI();

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
