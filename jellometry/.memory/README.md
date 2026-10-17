# Project Memory Index — Jellometry

- **Last Updated**: 2026-10-17 22:02:00 +07:00
- **Format Version**: 1.0

## Current State
- Complete, playable Vite + Three.js (`r170`) + `cannon-es` 3D game **"3D Jelly Obstacle Race & Track Builder"** (`jellometry`) built with zero external asset dependencies and direct GitHub Pages compatibility (`importmap` + relative module paths).
- Optimized for both desktop and mobile smartphones (`portrait` and `landscape`), featuring a floating Virtual Analog Thumbstick, 1-Tap Quick-Morph action cluster (`FLAT`, `CUBE`, `TALL`), adaptive `Hor+` portrait camera, collapsible mobile HUD/Inspector drawers, and automatic transparency for passed obstacles in `PLAY_MODE`.

## Active Decisions
- **Volume-Preserving Morph Invariant**: `JellyPlayer` enforces $W \times H \times D = 1.728\,\text{m}^3$ across morph values $m \in [-1, 1]$ and synchronizes `CANNON.Box` `halfExtents` every frame via `updateConvexPolyhedronRepresentation()`.
- **Passed-Obstacle Camera Occlusion Transparency**: `ObstacleFactory.updateVisuals()` smoothly fades obstacles to translucent (`opacity: 0.18` / `0.22`) with `mat.depthWrite = false` once passed by the jelly in `PLAY_MODE`, and restores `1.0` opacity in `EDITOR_MODE`.
- **Three.js r170 `TransformControls` Integration**: Uses `transformControls.getHelper()` to attach the gizmo root `Object3D` to the scene while disabling `OrbitControls` during `dragging-changed`.
- **Material IOR Preservation**: Omitted `reflectivity` override on `THREE.MeshPhysicalMaterial` so `ior` remains strictly `1.4` alongside `transmission: 0.85` and `roughness: 0.15`.

## Open Items / Blockers
- None.

## Recent Entries
- [2026-10-17 22:02:00 — Mobile Smartphone Optimization & Passed-Obstacle Transparency](./2026-10-17/220200-mobile-optimization-and-passed-obstacle-transparency.md)
- [2026-10-17 16:19:00 — Initial Build of 3D Jelly Obstacle Race & Track Builder](./2026-10-17/161900-jellometry-3d-jelly-race-builder.md)
