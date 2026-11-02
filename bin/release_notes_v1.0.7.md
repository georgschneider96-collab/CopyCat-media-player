# CopyCat Media Player — Release Notes v1.0.7

### 🚀 What's New in v1.0.7 (Aspect Ratio, Auto-Updater & AI Integration Edition)

#### 🖥️ Aspect Ratio Cycling & Direct Presets (`Z` / `A`)
- **Quick Cycle Hotkeys**: Press **`Z`** or **`A`** to effortlessly cycle through all video aspect ratio modes in real-time without interrupting playback:
  - **Contain** (Original aspect ratio / letterbox)
  - **Cover** (Crop black bars / fill modern displays)
  - **Stretch** (Fill to exact window dimensions)
  - **Force 16:9** (Standard widescreen)
  - **Force 4:3** (Classic standard television)
  - **Force 21:9** (Ultrawide cinematic presentation)
- **Top Header Menu & Quick Popover**: Dedicated menu item in the main dropdown menu and unified synchronization with the bottom Video popover.
- **HUD Toast Notification**: Instant OSD feedback displaying the active mode upon switching.
- **AI Control Bridge Integration**: Full remote control over aspect ratio via `cycleAspect` and `setAspect` HTTP API commands.

#### 🔄 Integrated GitHub Auto-Updater
- **Silent Startup Update Check**: Automatically and non-blockingly checks GitHub Releases for new updates 2.5s after launch.
- **Interactive Acrylic Update Banner**: Provides clear "Update Now", "Later", and "Don't Ask Again" options.
- **Settings "Updates" Tab**: View current version, latest version, full markdown release notes, and manually trigger update checks.
- **Automated Download & Install**: Streamed chunk download with live percentage progress bar, following redirects and automatically launching the new installer upon completion.

#### 🤖 Resilient AI Assistant Integration & Global CLI
- **Interactive Desktop Launcher**: Universal `copycat` command installed to `%LOCALAPPDATA%\Microsoft\WindowsApps` (on `%PATH%`) and Task Scheduler interactive token to launch directly onto the active Windows desktop from any background terminal or AI agent.
- **Global Antigravity Skill**: Automatically registers `copycat-player` skill into `~/.gemini/config/skills/` for hands-free pair-programming media playback.
- **1-Click AI Prompt Copy**: Settings → AI tab now includes a 1-click button to copy complete agent instructions to the clipboard.
- **Dynamic Executable Discovery**: Resilient resolution across Program Files, registry associations, and desktop portable builds.

#### 🍿 Binge Mode & Intro/Outro Automation
- **Seamless Auto-Skip**: Configurable skip mode for opening and ending sequences (`skip_all`).
- **Up Next Countdown Banner**: 5-second countdown banner auto-advances to the next episode in folder or playlist.

#### 🧹 Stability & Performance Enhancements
- **Crash Log Isolation**: Moved uncaught exception logging into `userData` directory, preventing permission errors in read-only environments.
- **FFmpeg Process Reaping**: Windows process group termination (`taskkill /T /F`) ensures no background transcoding or thumbnail processes are orphaned.
- **Production Console Hygiene**: Suppressed redundant renderer console chatter during normal operation.
