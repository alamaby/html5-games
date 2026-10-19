# Project Memory Index — Jellometry

- **Last Updated**: 2026-10-19 15:40:00 +07:00
- **Format Version**: 1.0

## Current State
- Complete, playable Vite + Three.js (`r170`) + `cannon-es` 3D game **"3D Jelly Obstacle Race"** (`jellometry`) built with zero external asset dependencies and direct GitHub Pages compatibility (`importmap` + relative module paths).
- **10-course campaign** in `src/entities/PresetLevels.js` (`LEVELS`), unlocked sequentially, with a course-select grid, per-course briefing card, personal-best times and record badges.
- Mobile-first HUD: single fixed top stack (`#hud-top-stack`), floating virtual thumbstick with a hit zone wider than the visible ring, quick-morph cluster (`FLAT`, `CUBE`, `TALL`) with JUMP isolated bottom-right, adaptive `Hor+` portrait camera, and transparency for passed obstacles.
- **The 3D Level Builder no longer exists.** `src/editor/LevelEditor.js` is unreferenced dead code on disk; `dist` carries no `OrbitControls`, `TransformControls`, `LevelEditor` or `EDITOR_MODE` symbol. `scripts/strip-dead-css.mjs` records what was removed.

## Active Decisions
- **Volume-Preserving Morph Invariant**: `JellyPlayer` enforces $W \times H \times D = 1.728\,\text{m}^3$ across morph values $m \in [-1, 1]$ and synchronizes `CANNON.Box` `halfExtents` every frame via `updateConvexPolyhedronRepresentation()`.
- **Canvas Owns Its Own Size**: the renderer is sized from `canvas.clientWidth` / `clientHeight` with `setSize(w, h, false)` under a coalesced `ResizeObserver`. `window.innerHeight` must never be used — on iOS it disagrees with the visual viewport and the inline style it writes beats the CSS box.
- **`touch-action` Is Scoped, Not Global**: `#app` keeps `manipulation` so overlays can scroll; only `#game-canvas`, `.joystick-zone` and `.joystick-base` opt out with `none`.
- **Touch Latching**: `JellyPlayer.queueJump()` holds a jump for 0.15 s because touch events fire far more often than the fixed 60 Hz physics step.
- **Real Frame Delta to `preStep`**: `PhysicsWorld.step()` records the clamped delta in `lastStepDt` and hands it to obstacle animation callbacks. Passing a hardcoded `1/60` made sweepers run at double speed on 120 Hz phones.
- **Storage Keys Are Frozen**: `jellometry_best_times_v1` is untouched; progression lives in `jellometry_progress_v1` and migrates from the legacy best-time map. `?unlockAll=1` is an in-memory override that never writes to storage.
- **Difficulty Is Modelled Offline**: `scripts/validate-levels.mjs` derives reachability from the player envelope (10.8 m/s, 12.6 m/s jump impulse, 24 m/s² gravity) and asserts a strictly increasing, bounded threat curve.
- **Passed-Obstacle Camera Occlusion Transparency**: `ObstacleFactory.updateVisuals()` smoothly fades obstacles to translucent (`opacity: 0.18` / `0.22`) with `mat.depthWrite = false` once passed.
- **Material IOR Preservation**: Omitted `reflectivity` override on `THREE.MeshPhysicalMaterial` so `ior` remains strictly `1.4` alongside `transmission: 0.85` and `roughness: 0.15`.

## Open Items / Blockers
- **D4 in the active plan is unverified**: layout, notch insets, course-list scrolling, rotation behaviour and 120 Hz timing have never been observed on a real device. Only `npm run build` (exit 0) and the level validator (exit 0) are machine-checked.
- **The `threat()` weights are a model, not playtest data.** Expect one calibration round after the first play session; the curve ceiling is 1.40x per step.
- `src/editor/LevelEditor.js` is dead code still on disk. Deleting it is an open call.

## Recent Entries
- [2026-10-19 15:40:00 — Mobile UI Campaign, Build Mode Removal & 10-Course Progression](./2026-10-19/154000-mobile-ui-campaign-and-build-mode-removal.md)
- [2026-10-17 22:02:00 — Mobile Smartphone Optimization & Passed-Obstacle Transparency](./2026-10-17/220200-mobile-optimization-and-passed-obstacle-transparency.md)
- [2026-10-17 16:19:00 — Initial Build of 3D Jelly Obstacle Race & Track Builder](./2026-10-17/161900-jellometry-3d-jelly-race-builder.md)
