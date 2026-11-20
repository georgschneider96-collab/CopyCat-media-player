# CopyCat media player — AI Assistant Context & Architecture Guide

> **Purpose of this file:** Give any AI assistant (Gemini, Claude, ChatGPT, GitHub Copilot, Cursor, Antigravity, local Ollama models, or MCP agents) instant, complete understanding of how **CopyCat media player** is structured, how to modify its UI/features, and how to control the running player programmatically via HTTP.

---

## 1. Project Overview
**CopyCat media player** is a standalone frameless Windows desktop media player built with **Electron + Vanilla HTML5/CSS3/JS + Web Audio API**, faithfully implementing Juxtopposed's *VLC After 25 Years* UI redesign with a custom cat icon identity.

Zero build-step complexity: edit any file in `src/` and press `Ctrl + R` inside the app (when Developer Mode is enabled) or restart via `npm start`.

## 2. File Structure
```text
CopyCat media player/
├── package.json          # Electron app manifest (`npm start`, `npm run dist`)
├── main.js               # Electron Main Process: app lifecycle, single instance lock, window creation
├── preload.js            # Electron Preload: exposes `window.copycat` / `window.vlcopycat` IPC bridge securely
├── AI_CONTEXT.md         # This architecture & AI control reference
├── README.md             # User quick-start, hotkeys, and customization guide
├── export_notebooklm.ps1 # Exports complete project into CopyCat-Gesamtprojekt.txt
├── assets/
│   ├── icon.ico          # Multi-resolution Windows icon (16, 24, 32, 48, 64, 128, 256px)
│   └── cat_icon.svg      # Source vector cat design
├── src/
│   ├── main/
│   │   ├── container.js      # Lightweight IoC ServiceContainer & WindowManager (Dependency Injection)
│   │   ├── stream-manager.js # Dedicated FFmpeg live streaming & thumbnail preview worker manager
│   │   ├── logger.js         # Structured, prefixed logger (`[VLCopyCat:...]`) with file backup
│   │   ├── session.js        # Windows session, Taskbar thumbar buttons, desktop shortcuts & AI breakout
│   │   ├── updater.js        # GitHub Releases auto-updater, asset stream downloader & installer runner
│   │   ├── media-resolver.js # Fast local ffprobe media analyzer, byte-range handler & subtitle extraction
│   │   ├── downloader.js     # Native stream downloader, sliding-window season queue, JIT sniffer, Dual-Audio muxer & Explorer view optimizer
│   │   ├── anime-skip-resolver.js # Automated AniList/MyAnimeList & AniSkip resolver with FFmpeg chapter embedding
│   │   ├── ipc.js            # Declarative IPC Registry with input validation & injected services
│   │   └── server.js         # Local HTTP Server (`127.0.0.1:4500`) with dynamic CommandRegistry
│   ├── index.html        # Player DOM: Top Header, Left Library Sidebar, Center Video Stage,
│   │                     #   Right Queue/Bookmarks Drawer, Bottom Bar, Popovers & Settings Modal
│   ├── styles.css        # Design tokens (--accent, --accent-rgb), 9 color themes, cat iconography,
│   │                     #   Juxtopposed [ON|OFF] switches, seekbar & glassmorphic surfaces
│   ├── icons.js          # Crisp inline vector SVGs matching the redesign's iconography & custom cat
│   └── app.js            # Core Player State, Web Audio 200% Gain + EQ + Visualizer, offscreen
│                         #   hover-thumbnail generator, SRT/VTT subtitle engine & AI IPC handler
└── tests/
    └── test-suite.js     # Automated regression test suite (syntax, IoC, security, semver, anime, range)
```

## 3. Design System & Theme Variables (`src/styles.css`)
All accent colors are driven by two CSS custom properties on `:root`:
- `--accent`: Hex or CSS color (default Traffic Cone Orange `#E07A16`)
- `--accent-rgb`: Comma-separated RGB triplet (`224, 122, 22`) used for translucent fills like the signature dark-tinted seekbar fill (`rgba(var(--accent-rgb), 0.28)`).

9 built-in presets in `src/app.js` (`ACCENT_PRESETS`):
`orange`, `amber`, `lime`, `emerald`, `cyan`, `blue`, `purple`, `magenta`, `rose`.

## 4. Built-in Local AI Control API (`http://127.0.0.1:4500`)
While CopyCat media player is running, it hosts a lightweight local JSON HTTP server on `127.0.0.1:4500` so any AI assistant, CLI tool, PowerShell script, or MCP tool can inspect and control playback in real time.

> **Security Model:** Port 4500 strictly binds to `127.0.0.1` (loopback only) and enforces Origin & `Sec-Fetch-Site: cross-site` inspection to reject unauthorized external web browser requests on control/status endpoints with `403 Forbidden`, while permitting internal fragmented MP4 media streaming (`/api/stream`, `/api/thumb`) from Electron's renderer. By design, any local user-level process/script on the host machine can inspect and control the player. Never bridge or expose port 4500 directly to external or public networks.

### Endpoints
- **`GET http://127.0.0.1:4500/`** — Self-documenting API schema & available commands.
- **`GET http://127.0.0.1:4500/api/status`** — Returns live player state:
  ```json
  {
    "app": "CopyCat media player",
    "playing": true,
    "title": "example.mp4",
    "filePath": "C:\\Videos\\example.mp4",
    "currentTime": 136.4,
    "duration": 468.0,
    "volume": 100,
    "muted": false,
    "speed": 1,
    "accent": "orange",
    "queueLength": 4,
    "streamEngine": "ffmpeg-live"
  }
  ```
- **`GET http://127.0.0.1:4500/api/stream?path=...&start=0&vcodec=h264`** — Zero-disk FFmpeg fragmented MP4 live stream for non-Chromium containers/codecs.
- **`GET http://127.0.0.1:4500/api/thumb?path=...&t=120`** — Instant on-demand MJPEG seekbar hover preview frame generator for streamed media.
- **`POST http://127.0.0.1:4500/api/control`** — Execute an action:
  ```json
  { "action": "togglePlay" }
  ```
  Supported `action` values:
  - `"play"`, `"pause"`, `"togglePlay"`, `"stop"`, `"next"`, `"prev"`
  - `"seek"` with `"value": 120` (seconds) or `"delta": 10` (relative seconds)
  - `"volume"` with `"value": 125` (`0` to `200`, supports 200% VLC boost!)
  - `"mute"`, `"toggleFullscreen"`, `"togglePip"`
  - `"speed"` with `"value": 1.25` (`0.25` to `2.0`)
  - `"setAccent"` with `"value": "cyan"` (any preset name or `#RRGGBB` hex color!)
  - `"openFile"` with `"filePath": "C:\\path\\to\\video.mp4"`
  - `"openFolder"` with `"folderPath": "C:\\path\\to\\folder"`

### PowerShell One-Liner Examples for AI Agents
```powershell
# Check what is playing
Invoke-RestMethod http://127.0.0.1:4500/api/status

# Switch theme to purple
Invoke-RestMethod -Method Post http://127.0.0.1:4500/api/control -ContentType "application/json" -Body '{"action":"setAccent","value":"purple"}'

# Open a local video file
Invoke-RestMethod -Method Post http://127.0.0.1:4500/api/control -ContentType "application/json" -Body '{"action":"openFile","filePath":"C:\\Users\\Schual\\Desktop\\video.mp4"}'
```

---

## 5. Automated Anime Opening & Ending Skip Architecture
- **AniList & AniSkip Pipeline (`src/main/anime-skip-resolver.js`)**: Automatically extracts clean series titles and episode numbers from video filenames or stream titles, resolves MyAnimeList IDs via AniList's public GraphQL API, and retrieves crowdsourced opening (`op`) and ending (`ed`) interval timestamps via the AniSkip API.
- **Strict Verification (Zero Guessing)**: Metadata strictly uses verified crowdsourced intervals for that specific episode. Incomplete or missing intervals are never fabricated, guessed, or inherited across candidate episodes.
- **Contiguous Chapters & FFmpeg Atoms**: Contiguous chapters (`Prologue` -> `Opening` -> `Episode` [-> `Ending`]) are baked directly into downloaded MP4 files using FFmpeg stream-copy (`-map_chapters 1 -map_metadata 1 -c copy -movflags +faststart`) without re-encoding or quality loss.
- **Hardware-Isolated UI Overlay**: The floating skip button (`.skip-segment-btn` in `src/styles.css`) is styled in signature CopyCat orange (`var(--accent)`), features a tactile `Tab` hotkey badge and vector SVG icon, uses GPU layer isolation (`transform: translateZ(0); will-change: transform, opacity;`), and `showSkipSegmentPrompt` in `src/app.js` guards against per-tick DOM reflows.

## 6. Security & Audio DSP Hardening
- **HTTP Origin Guard & Media Bridge (`src/main/server.js`)**: Port 4500 blocks unauthorized browser requests (`Sec-Fetch-Site: cross-site` and external web domains) on control and discovery routes with `403 Forbidden` to prevent CSRF/rebinding attacks, while seamlessly routing internal fragmented MP4 media streaming (`/api/stream`, `/api/thumb`) for MPEG-TS disguised files and remote HLS streams.
- **Hardware-Accelerated Stream Passthrough (`src/main/stream-manager.js`)**: Real-time FFmpeg live stream automatically detects H.264 video streams and utilizes zero-copy (`-c:v copy`) video passthrough with stereo AAC audio, eliminating CPU transcoding overhead and providing instant playback and seeking for MPEG-TS containers.
- **Web Audio Brickwall Limiter (`src/app.js`)**: A dedicated `DynamicsCompressorNode` positioned downstream of the 200% volume boost node acts as a hard peak limiter (threshold: `-0.5 dBFS`, ratio: `20:1`, attack: `0.002s`, release: `0.05s`), guaranteeing distortion-free amplification.
- **Atomic Updater Integrity (`src/main/updater.js`)**: Enforces HTTPS, stages downloads into atomic `.part` files, streams SHA-256 verification, and validates Windows PE `MZ` binary headers.
- **Automated Regression Suite (`tests/test-suite.js`)**: Run via `npm test` or `npm run lint` across syntax, IoC container, updater semver, security origin filters, and anime contracts.
