# VLCopyCAT — AI Assistant Context & Architecture Guide

> **Purpose of this file:** Give any AI assistant (Gemini, Claude, ChatGPT, GitHub Copilot, Cursor, Antigravity, local Ollama models, or MCP agents) instant, complete understanding of how **VLCopyCAT** is structured, how to modify its UI/features, and how to control the running player programmatically via HTTP.

---

## 1. Project Overview
**VLCopyCAT** is a standalone frameless Windows desktop media player built with **Electron + Vanilla HTML5/CSS3/JS + Web Audio API**, faithfully implementing Juxtopposed's *VLC After 25 Years* UI redesign.

Zero build-step complexity: edit any file in `src/` and press `Ctrl + R` inside the app (when Developer Mode is enabled) or restart via `npm start`.

## 2. File Structure
```text
VLCopyCAT/
├── package.json        # Electron app manifest (`npm start` runs the desktop player)
├── main.js             # Electron Main Process: frameless window, native file/folder dialogs,
│                       #   auto-subtitle (.srt/.vtt) discovery, and Local AI HTTP API (port 4500)
├── preload.js          # Electron Preload: exposes `window.vlcopycat` IPC bridge securely
├── AI_CONTEXT.md       # This architecture & AI control reference
├── README.md           # User quick-start, hotkeys, and customization guide
└── src/
    ├── index.html      # Player DOM: Top Header, Left Library Sidebar, Center Video Stage,
    │                   #   Right Queue/Bookmarks Drawer, Bottom Bar, Popovers & Settings Modal
    ├── styles.css      # Design tokens (--accent, --accent-rgb), 9 color themes, cone slider,
    │                   #   Juxtopposed [ON|OFF] switches, seekbar & glassmorphic surfaces
    ├── icons.js        # Crisp inline vector SVGs matching the redesign's iconography
    └── app.js          # Core Player State, Web Audio 200% Gain + EQ + Visualizer, offscreen
                        #   hover-thumbnail generator, SRT/VTT subtitle engine & AI IPC handler
```

## 3. Design System & Theme Variables (`src/styles.css`)
All accent colors are driven by two CSS custom properties on `:root`:
- `--accent`: Hex or CSS color (default Traffic Cone Orange `#E07A16`)
- `--accent-rgb`: Comma-separated RGB triplet (`224, 122, 22`) used for translucent fills like the signature dark-tinted seekbar fill (`rgba(var(--accent-rgb), 0.28)`).

9 built-in presets in `src/app.js` (`ACCENT_PRESETS`):
`orange`, `amber`, `lime`, `emerald`, `cyan`, `blue`, `purple`, `magenta`, `rose`.

## 4. Built-in Local AI Control API (`http://127.0.0.1:4500`)
While VLCopyCAT is running, it hosts a lightweight local JSON HTTP server on `127.0.0.1:4500` so any AI assistant, CLI tool, PowerShell script, or MCP tool can inspect and control playback in real time.

### Endpoints
- **`GET http://127.0.0.1:4500/`** — Self-documenting API schema & available commands.
- **`GET http://127.0.0.1:4500/api/status`** — Returns live player state:
  ```json
  {
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
- **`GET http://127.0.0.1:4500/api/stream?path=...&start=0&vcodec=h264`** — Zero-disk FFmpeg fragmented MP4 live stream for non-Chromium containers/codecs (such as HLS `mpegts` streams saved with `.mp4` extensions, `.mkv`, `.avi`, `.ts`, `AC3`/`DTS` audio, or `Hi10P` anime encodes).
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
