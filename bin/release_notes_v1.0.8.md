# CopyCat Media Player — Release Notes v1.0.8

### 🚀 What's New in v1.0.8 (User Comfort & Seamless Multitasking Edition)

#### ⏸️ Auto-Pause When Minimized & Smart Resume
- **Taskbar Multitasking Comfort**: Minimizing CopyCat automatically pauses video playback and displays an unobtrusive toast notification (*"Auto-Paused (Window Minimized)"*).
- **Intelligent Pre-Paused State Tracking**: When restored from the taskbar, playback resumes only if media was actively playing before minimization (`wasPlayingBeforeMinimize`). If you paused the video yourself before minimizing, it stays paused upon return.
- **Picture-in-Picture (PiP) Immunity**: Floating mini-player playback is completely uninterrupted when minimizing the main application window.
- **Boss Key Protection**: Using Boss Key (`F12`) to hide the player automatically suppresses auto-resume, ensuring private sessions remain silent upon window restoration.
- **Dedicated Settings Switch**: Toggle on or off at any time under **Settings → General / Playback**; preferences persist across launches.

#### 🔍 Sidebar Search & Folder Navigation Polish
- **Context-Aware Navigation**: Browsing into subfolders or quick shortcuts automatically clears the search query and resets the view, eliminating disappeared folder content.
- **1-Click Search Clear**: Added interactive clear button (`×`) in the search input for quick resetting.
- **Persistent Parent Navigation**: The `.. (Parent Folder)` navigation row remains accessible even during active filtering.
- **Interactive Empty State**: Direct "Clear search" action when a query yields zero results.

#### 🤖 AI Sandbox & Multi-Desktop Execution Breakout
- **Universal Desktop Injection**: Automatic inter-process breakout via `Shell.Application` COM dispatch onto `WinSta0\Default` when launched from isolated AI sandboxes (e.g. Antigravity runners) without `--desktop-spawned`.
- **Expanded AI Control API**: Added direct `minimize` and `restore` actions to `POST /api/control` and live telemetry inspection.
- **Frame Snapshot Commands**: High-resolution frame capture and clipboard export commands wired directly to the AI bridge.

#### ⚙️ Universal System Path Discovery
- Added `C:\Program Files\CopyCat media player\` to `bin/register_associations.ps1` discovery chains for system-wide installations.
