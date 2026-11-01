# CopyCat Media Player — Release Notes v1.0.5

### 🚀 What's New in v1.0.5

#### 🛑 Stop After Current Episode (Hotkey `E`)
- **Dedicated Hotkey**: Press `E` anytime to toggle "Stop After Episode" mode with instant on-screen toast feedback (`Stop After Episode: ON` / `OFF`).
- **Clean Single-Episode Playback**: When the currently playing episode completes, playback cleanly pauses and stops rather than advancing to the next file in the folder or queue.
- **Auto-Suppressed Countdown**: The 5-second "Up Next" prompt is suppressed while Stop After Episode is active.
- **Configurable**: Fully remappable under **Settings → Hotkeys** in the *Playback* category.

#### ⏱️ Sleep Timer
- **Playback & Files Tab**: Set an automated sleep timer directly in **Settings → Playback & Files**.
- **Flexible Durations**: Choose between Off, 15m, 30m, 45m, 60m (1 hr), 90m (1.5 hrs), or 120m (2 hrs).
- **Live Countdown Display**: Live status readout under the dropdown (`Active: ~X min remaining`).
- **Gentle Pause**: Gracefully pauses playback and displays a toast notification (`Sleep Timer: Playback Paused`) when time expires.

#### 🛡️ Boss Key / Privacy Mute & Minimize (`F12`)
- **Instant Mute & Hide**: Press `F12` to immediately pause playback, silence audio, exit PiP/Fullscreen, and minimize the window to the taskbar.
- **Reliable in Inputs**: Triggers even if focus is inside search boxes or setting inputs.
- **DevTools Decoupled**: Electron DevTools accelerator cleanly removed so `F12` exclusively triggers the Boss Key.

#### 🪟 Fullscreen Drag-to-Restore & Maximize Controls
- **Top-Bar Dragging**: Click and drag the top title bar downwards while in fullscreen mode to smoothly restore into a floating window right under your cursor.
- **Fullscreen Maximize Button**: Clicking the maximize button while in fullscreen mode smoothly restores the window.
- **`requestAnimationFrame` Smooth Movement**: Window coordinates during drag-restore are throttled to display refresh rate for buttery-smooth movement.

#### 🎬 Native Windows File Associations & Default Apps
- **Registered Media Viewer**: Windows natively recognizes CopyCat media player for 21 media extensions (`.mp4`, `.mkv`, `.ts`, `.m2ts`, `.webm`, `.avi`, `.mov`, `.wmv`, `.flv`, `.m4v`, `.mpg`, `.mpeg`, `.vob`, `.3gp`, `.mp3`, `.flac`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.opus`).
- **Open With Recommended**: Appears directly in the Windows Explorer "Open with" recommended application list.
- **Explorer Context Menu**: Right-click any video, audio file, or folder to "Play with CopyCat media player".
- **Asynchronous Registration**: Background registry verification runs non-blocking upon launch without freezing startup.
