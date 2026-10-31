# CopyCat media player v1.0.3 🐱⚡

### What's New in v1.0.3:

#### 🎮 Fully Customizable Keyboard Shortcuts
- Rebind any keyboard shortcut directly in **Settings → Keyboard Shortcuts**.
- Simply click any key badge and press your new key combination (supports single keys like `Space`, `F`, `M`, arrow keys, bracket keys, or multi-key combos like `Ctrl+O`, `Shift+S`, `Ctrl+Shift+O`).
- Add secondary alternate keys (up to 2 bindings per action) with the `+ Key` badge.
- Instant shortcut removal with the `×` button.
- Conflict prevention: assigning a key combination automatically reclaims it from any prior action.
- Press `Esc` anytime while recording to cancel.

#### 🎛️ Customizable Step Increments & Tuning
- **Volume Step**: Customize how much the volume increases or decreases per keypress (1% to 25%, default 5%).
- **Seek Step (Small)**: Fine seek time for Left / Right arrow keys (1s to 60s, default 5s).
- **Seek Step (Large)**: Coarse seek time for Shift + Left / Right arrows (5s to 300s, default 15s).
- **Speed Increment**: Playback speed ratio adjustment step for `[` and `]` brackets (0.01x to 0.50x, default 0.10x).

#### ⏱️ Smart Resume & Queue Restore Prompts
- **Resume where you left off prompt**: When reopening a file from a previous session, CopyCat shows a sleek prompt: *"Continue where you left off? Resume playback at MM:SS"* with **[Continue]** and **[Start Over]** buttons.
- **Previous Queue Restore prompt**: If you had a playlist/queue in your previous session and open any video that belonged to it, CopyCat detects it and asks: *"Restore previous queue? This video was part of your previous queue (N videos)."* with **[Restore]** and **[Dismiss]** buttons.
- Prompts gracefully stack together without overlapping and auto-dismiss after a generous timeout or if you scrub the timeline.

#### 🔄 One-Click Factory Reset & Clean Settings
- "Reset Defaults" button in the Keyboard Shortcuts panel restores all default shortcuts and step tuning in a single click.
- Clean menu labels: "Open File", "Open Folder", "Enqueue Files", and "Open Settings".
- All customizations persist automatically across restarts.

---
### Downloads:
- **Installer:** `CopyCat-media-player-Setup-1.0.3.exe` (Full NSIS Windows installer with start menu & desktop shortcut)
- **Portable App:** `CopyCat-media-player-1.0.3-portable.exe` (Zero install, standalone single file with bundled FFmpeg)
- **Portable ZIP:** `CopyCat-media-player-v1.0.3-portable.zip`
