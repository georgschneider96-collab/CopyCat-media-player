# CopyCat media player 🐈🎬

VLC media player CopyCat based on the redesign of Juxtopposed — built with Electron, HTML5 Video/Canvas, and Web Audio API, featuring a custom **Cat Icon** design, desktop shortcut integration, and built-in **Local AI Control Bridge**.

## Quick Start

```powershell
cd C:\Users\Schual\Desktop\VLCopyCAT
npm start
```

Or double-click **`CopyCat media player`** on your desktop, or run **`Launch_CopyCat.exe`** (with the custom Cat icon) directly from the project folder!

## Desktop Shortcut & Packaging
- **Automatic First-Launch Prompt:** If no desktop shortcut exists, CopyCat media player presents an acrylic prompt banner to create one with a single click.
- **Preferences Access:** You can also regenerate the desktop shortcut anytime from **Preferences (Ctrl + P) → Playback & Files**.
- **Stand-alone Installer / Sharing:** Run `npm run dist` to build a Windows setup installer (.exe), or `npm run dist:portable` to create a standalone portable `.exe` ready to share.

## Signature Features
- **Custom Cat Icon & Accent Play Pill:** Inspired by the original cone colors (orange & white stripes) re-imagined as a cat icon, paired with 9 instant accent color themes (`Settings → General → Accent Color`).
- **Thick Inline Seekbar with Live Hover Video Previews:** Scrub smoothly with a floating live frame preview card + optional **Interactive Subtitle Dialogue Timeline** directly inside the seekbar.
- **Horizontal Volume Slider (0% – 200% Boost):** Powered by Web Audio `GainNode` for genuine up-to-200% volume amplification plus multi-band EQ presets & live Audio Visualizer.
- **Auto-Closing Controls & Drawer Gestures:** Audio/EQ, Subtitles & Sync, and Playback popovers automatically close after 5 seconds of inactivity or immediately upon clicking the video stage. Moving near window edges automatically reveals the side drawers.
- **Consolidated Header & Folders / Queue:** Single `...` menu, folder breadcrumb navigation, Always-on-Top PiP pin, and smart folder-to-queue auto-progression.
- **AI-Accessible by Design:** Clean modular vanilla code (`AI_CONTEXT.md`) + live JSON HTTP control server at `http://127.0.0.1:4500`.

## Keyboard Shortcuts
| Key | Action |
| --- | --- |
| `Space` / `K` | Play / Pause |
| `F` or Double-Click | Toggle Fullscreen |
| `M` | Mute / Unmute |
| `←` / `→` | Seek -5s / +5s (`Shift` for ±15s) |
| `↑` / `↓` | Volume +5% / -5% (up to 200%) |
| `[` / `]` | Playback Speed -0.25x / +0.25x |
| `B` | Add Timestamp Bookmark |
| `S` (`Shift+S`) | Save Video Snapshot to Pictures |
| `Ctrl + O` | Open Media File |
| `Ctrl + F` | Open Media Folder |
| `Ctrl + P` | Open Global Settings & Themes |
