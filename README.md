# VLCopyCAT 🐈🎬

A modern, hardware-accelerated Windows desktop media player inspired by **Juxtopposed's "I Redesigned VLC After 25 Years"** concept — built with Electron, HTML5 Video/Canvas, and Web Audio API, featuring a built-in **Local AI Control Bridge**.

## Quick Start

```powershell
cd C:\Users\Schual\Desktop\VLCopyCAT
npm start
```

Or launch **`Launch_VLCopyCAT.bat`** directly from the project folder!

## Signature Features
- **Rounded Accent Play Pill & Minimalist 2-Stripe Cone:** Left-aligned transport controls with 9 instant accent color themes (`Settings → General → Accent Color`).
- **Thick Inline Seekbar with Live Hover Video Previews:** Scrub smoothly with a floating live frame preview card + optional **Interactive Subtitle Dialogue Timeline** directly inside the seekbar.
- **Horizontal Traffic-Cone Volume Slider (0% – 200% VLC Boost):** Powered by Web Audio `GainNode` for genuine up-to-200% volume amplification plus multi-band EQ presets & live Audio Visualizer.
- **Consolidated Header & Collapsible Library Sidebar:** Single `...` menu, folder breadcrumb navigation, Always-on-Top PiP pin, and right-side Queue & Timestamp Bookmarks drawer.
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
| `Ctrl + P` | Open Global Settings |
