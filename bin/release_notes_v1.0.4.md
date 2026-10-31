# CopyCat Media Player — Release Notes v1.0.4

### 🚀 What's New in v1.0.4

#### ⏩ Hold to Speed Up 2.0x
- **Spacebar Hold & Tap**:
  - Quickly tapping `Space` (< 220ms) toggles play/pause normally.
  - Holding `Space` (> 220ms) smoothly speeds playback up to 2.0x and displays a floating, animated HUD pill overlay (`2.0x ⏩`).
  - Releasing `Space` smoothly restores your original playback speed without pausing the video.
- **Mouse Long-Press on Video**:
  - Pressing and holding the primary mouse button on the video stage (> 250ms) triggers 2.0x playback speed and the HUD overlay.
  - Releasing the mouse restores normal playback speed and suppresses the standard click toggle.
  - Automatically releases on window blur so speed never gets stuck.

#### ✓ Watched Episode Badges (Queue Only)
- **Queue-Only Scope**:
  - Episodes are marked as watched only when played from the queue (`state.playbackSource === 'queue'`), such as reaching $\ge 90\%$ progress, skipping ending/credits in queue mode, or upon video completion.
  - Watched badges appear **strictly** in the Right Drawer Queue list—never in the library sidebar or bookmarks tab.
- **Unwatched State**:
  - Unwatched episodes are completely clean at rest (no badge or checkmark visible).
  - Hovering over an unwatched episode reveals a subtle `+ Watched` ghost pill.
- **Single, Easy-to-Click Toggle**:
  - Clicking the badge (`+ Watched` when unwatched, `✓ Watched` when watched) toggles watched/unwatched status directly.
  - Sized for easy clicking (`min-height: 22px; padding: 3px 9px; cursor: pointer;`) with active depression feedback.
  - Excluded from queue drag-and-drop detection to prevent accidental dragging when clicking.
  - Context menu right-click on any queue row also toggles watched status.
- **Session Queue Persistence**:
  - Watched paths are tied specifically to restored queue sessions. If you start a fresh queue or don't restore the previous queue, previously watched files will not be marked as watched.

#### ⚙️ Settings & Playback Improvements
- **Standard Playback Speed on Startup**:
  - When closing the app, custom playback speeds reset back to standard `1.0x` on the next launch, while preserving all other user preferences.
- **Reset All Settings to Default**:
  - Added a dedicated "Reset All Settings to Default" button at the top of the Interface & Theme tab to easily restore factory defaults.
- **Encoded Chapter Skipping**:
  - Opening and ending segment skipping relies strictly on encoded file chapters without fragile audio analysis workarounds.
- **Always on Top Slider**:
  - Fixed toggle state synchronization so the switch and window state remain perfectly aligned.

#### 🧹 Codebase Cleanup & Optimization
- Audited the entire codebase, removing dead functions, obsolete element references, and duplicate actions.
- Syntax and DOM ID integrity verified with zero errors.
