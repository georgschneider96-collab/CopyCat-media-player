// Crisp vector SVGs modeled frame-by-frame from Juxtopposed's VLC Redesign

window.VLC_ICONS = {
  // Minimalist flat 2-stripe traffic cone (01_cone_palette.png)
  cone: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.35 3.3C10.62 2.48 11.27 2 12 2C12.73 2 13.38 2.48 13.65 3.3L14.62 6.25C12.92 6.68 11.08 6.68 9.38 6.25L10.35 3.3Z" fill="currentColor"/>
    <path d="M8.32 9.48C10.75 10.12 13.25 10.12 15.68 9.48L16.82 12.95C13.72 13.88 10.28 13.88 7.18 12.95L8.32 9.48Z" fill="currentColor"/>
    <path d="M4.6 15.5H6.34L5.95 16.68C9.82 18.05 14.18 18.05 18.05 16.68L17.66 15.5H19.4C20.15 15.5 20.78 16.01 20.96 16.74L21.78 20.02C22.05 21.08 21.25 22 20.16 22H3.84C2.75 22 1.95 21.08 2.22 20.02L3.04 16.74C3.22 16.01 3.85 15.5 4.6 15.5Z" fill="currentColor"/>
  </svg>`,

  dots: `<svg viewBox="0 0 24 24" fill="none">
    <circle cx="6.5" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="17.5" cy="12" r="1.5" fill="currentColor"/>
  </svg>`,

  sidebar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/>
    <line x1="9" y1="4.5" x2="9" y2="19.5"/>
  </svg>`,

  // Folder with tiny play triangle inside (12_accent_colors.png header)
  folderPlay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6.8C3 5.8 3.8 5 4.8 5H8.9C9.4 5 9.88 5.22 10.2 5.6L11.4 7H19.2C20.2 7 21 7.8 21 8.8V17.2C21 18.2 20.2 19 19.2 19H4.8C3.8 19 3 18.2 3 17.2V6.8Z"/>
    <path d="M10.5 10.6L14.5 13L10.5 15.4V10.6Z" fill="currentColor" stroke="none"/>
  </svg>`,

  prev: `<svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="6" width="2.3" height="12" rx="1.1"/>
    <path d="M18.2 6.55C19 6.05 20 6.62 20 7.56V16.44C20 17.38 19 17.95 18.2 17.45L10.9 12.95C10.15 12.48 10.15 11.52 10.9 11.05L18.2 6.55Z"/>
  </svg>`,

  next: `<svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="16.7" y="6" width="2.3" height="12" rx="1.1"/>
    <path d="M5.8 6.55C5 6.05 4 6.62 4 7.56V16.44C4 17.38 5 17.95 5.8 17.45L13.1 12.95C13.85 12.48 13.85 11.52 13.1 11.05L5.8 6.55Z"/>
  </svg>`,

  play: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.2 5.65C7.35 5.12 6.25 5.73 6.25 6.73V17.27C6.25 18.27 7.35 18.88 8.2 18.35L17.1 13.08C17.93 12.58 17.93 11.42 17.1 10.92L8.2 5.65Z"/>
  </svg>`,

  pause: `<svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6.5" y="5.5" width="3.8" height="13" rx="1.4"/>
    <rect x="13.7" y="5.5" width="3.8" height="13" rx="1.4"/>
  </svg>`,

  // Speaker with 3 ascending straight vertical bars (03_volume_cone.png)
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 9.5V14.5C4 15.1 4.4 15.6 5 15.8L9.8 17.8C10.6 18.1 11.5 17.5 11.5 16.6V7.4C11.5 6.5 10.6 5.9 9.8 6.2L5 8.2C4.4 8.4 4 8.9 4 9.5Z"/>
    <line x1="14.5" y1="10.8" x2="14.5" y2="13.2"/>
    <line x1="17.3" y1="9.2" x2="17.3" y2="14.8"/>
    <line x1="20.1" y1="7.5" x2="20.1" y2="16.5"/>
  </svg>`,

  speakerMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 9.5V14.5C4 15.1 4.4 15.6 5 15.8L9.8 17.8C10.6 18.1 11.5 17.5 11.5 16.6V7.4C11.5 6.5 10.6 5.9 9.8 6.2L5 8.2C4.4 8.4 4 8.9 4 9.5Z"/>
    <line x1="15.2" y1="9.5" x2="20.2" y2="14.5"/>
    <line x1="20.2" y1="9.5" x2="15.2" y2="14.5"/>
  </svg>`,

  // 5-bar waveform icon (06_bottom_controls.png)
  audioWave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <line x1="4.5" y1="10.5" x2="4.5" y2="13.5"/>
    <line x1="8.2" y1="7.5" x2="8.2" y2="16.5"/>
    <line x1="12" y1="4.5" x2="12" y2="19.5"/>
    <line x1="15.8" y1="8" x2="15.8" y2="16"/>
    <line x1="19.5" y1="10.5" x2="19.5" y2="13.5"/>
  </svg>`,

  // Subtitles frame icon (06_bottom_controls.png)
  subtitles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5.5" width="18" height="13" rx="2.5"/>
    <line x1="6.5" y1="12.5" x2="11" y2="12.5"/>
    <line x1="13.8" y1="12.5" x2="17.5" y2="12.5"/>
    <line x1="6.5" y1="15.3" x2="14.5" y2="15.3"/>
  </svg>`,

  // Gear with play icon inside (03_volume_cone.png & 06_bottom_controls.png)
  gearPlay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2.75L13.4 4.45L15.55 4.1L16.1 6.2L18.2 6.75L17.85 8.9L19.55 10.3L18.45 12L19.55 13.7L17.85 15.1L18.2 17.25L16.1 17.8L15.55 19.9L13.4 19.55L12 21.25L10.6 19.55L8.45 19.9L7.9 17.8L5.8 17.25L6.15 15.1L4.45 13.7L5.55 12L4.45 10.3L6.15 8.9L5.8 6.75L7.9 6.2L8.45 4.1L10.6 4.45L12 2.75Z"/>
    <path d="M10.6 9.5L14.6 12L10.6 14.5V9.5Z" fill="currentColor" stroke="none"/>
  </svg>`,

  queue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/>
    <line x1="8.5" y1="7" x2="19.5" y2="7"/>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/>
    <line x1="8.5" y1="12" x2="19.5" y2="12"/>
    <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none"/>
    <line x1="8.5" y1="17" x2="19.5" y2="17"/>
  </svg>`,

  pip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2.2"/>
    <rect x="11.5" y="11" width="7" height="5.5" rx="1" fill="currentColor"/>
  </svg>`,

  minimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
    <line x1="6" y1="12" x2="18" y2="12"/>
  </svg>`,

  maximize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round">
    <rect x="5.5" y="5.5" width="13" height="13" rx="1.6"/>
  </svg>`,

  fullscreen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4.5 9V5.8C4.5 5.08 5.08 4.5 5.8 4.5H9"/>
    <path d="M15 4.5H18.2C18.92 4.5 19.5 5.08 19.5 5.8V9"/>
    <path d="M19.5 15V18.2C19.5 18.92 18.92 19.5 18.2 19.5H15"/>
    <path d="M9 19.5H5.8C5.08 19.5 4.5 18.92 4.5 18.2V15"/>
  </svg>`,

  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
    <line x1="6.5" y1="6.5" x2="17.5" y2="17.5"/>
    <line x1="17.5" y1="6.5" x2="6.5" y2="17.5"/>
  </svg>`,

  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 4.5H18C18.55 4.5 19 4.95 19 5.5V20L12 15.8L5 20V5.5C5 4.95 5.45 4.5 6 4.5Z"/>
  </svg>`,

  snapshot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2.5"/>
    <circle cx="12" cy="12.5" r="3.2"/>
  </svg>`,

  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
    <circle cx="11" cy="11" r="6.5"/>
    <line x1="16" y1="16" x2="20" y2="20"/>
  </svg>`
};
