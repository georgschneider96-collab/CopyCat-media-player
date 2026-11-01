# CopyCat Media Player — Release Notes v1.0.6

### 🚀 What's New in v1.0.6 (Performance & Optimization Edition)

#### ⚡ Direct Composition Zero-Copy Passthrough
- **Zero-Copy Video Composition**: Bypasses CSS filter graph overhead during active playback (`filter: none`), allowing Chromium's Direct Composition swapchain to directly overlay hardware-decoded video surfaces onto the desktop with zero intermediate GPU copy operations.
- **Hardware Acceleration Switches**: Explicitly activates Chromium GPU flags (`enable-accelerated-video-decode` and `enable-accelerated-mjpeg-decode`) for butter-smooth 4K/60fps playback with minimal CPU overhead.

#### 🎯 $O(\log N)$ Subtitle Engine & Cue Caching
- **Binary Search Cue Finding**: Replaced per-frame linear subtitle array scans with an ultra-fast binary interval search, scaling effortlessly even for scripts with thousands of lines.
- **Cue Equality Cache**: Prevents redundant DOM subtitle updates when the active cue has not changed, saving CPU cycles on every frame.

#### ⏩ Arrow Seek Coalescing & Socket Acceleration
- **Rapid Seek Coalescing**: Consecutive arrow-key taps (`←` / `→`) are coalesced via a 110ms micro-debounce, dispatching a single clean seek once tapping finishes rather than stalling the decode pipeline.
- **`TCP_NODELAY` Stream Socket**: Disables Nagle's algorithm on local HTTP streaming sockets for zero-latency audio/video packet transmission.
- **Stream PTS Alignment**: Employs `-avoid_negative_ts make_zero` and strips unnecessary audio/subtitle demux overhead during fast thumbnail scrubbing.

#### 🎛️ 60fps Audio Visualizer Optimization
- **Zero-Allocation Typed Arrays**: Reuses pre-allocated typed arrays for frequency data rather than allocating new arrays every 16ms animation frame.
- **Reflow & Allocation Elimination**: Caches canvas 2D rendering contexts and parsed RGB accent tokens, keeping garbage collection pauses at 0ms.

#### ⚡ I/O & UI Responsiveness
- **Debounced Preferences**: `savePreferences` uses a 250ms debounce window to prevent redundant synchronous disk writes during slider adjustments.
- **$O(N)$ Folder Scanner Cache**: Directory file listings are memoized during folder scanning, turning $O(N^2)$ recursive path checks into lightning-fast $O(N)$ lookups.
- **High-Polling Mousemove Throttling**: Window hover tracking is throttled via `requestAnimationFrame` to avoid UI thrashing on high-refresh-rate / high-polling gaming mice.
- **Seekbar Geometry Deduplication**: Seekbar pointer move handlers now cache bounding geometry, cutting layout reflow calculations in half.
- **Deferred Drawer & Sidebar Rendering**: Collapsed left library and right queue panels defer off-screen DOM calculations until toggled open.

#### 🧹 Lean Footprint
- **Clean Distribution**: Stripped intermediate unpack trees and obsolete files, keeping release builds compact and fast to install.
