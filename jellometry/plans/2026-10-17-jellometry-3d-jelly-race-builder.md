# 3D Jelly Obstacle Race & Track Builder Implementation Plan

Created: 2026-10-17 16:01:30

## Objective
Build a complete, playable, modular HTML5 3D game titled **"3D Jelly Obstacle Race & Track Builder"** (Jellometry) using Vite, Three.js (`three` r160+), and `cannon-es`, featuring a translucent morphing jelly character with soft-body spring-damper wobble physics, 6 modular obstacle types, a full 3D Level Builder with `OrbitControls` and `TransformControls`, two built-in preset courses ("Beginner Bounce" and "Morph Madness"), procedural Canvas textures, particle systems, procedural Web Audio API synthesizer, mobile smartphone optimization, and automatic transparency for passed obstacles.

## Scope
- **Phase 1: Project Setup, Core Engine, Procedural Audio, & Jelly Player**
  - Vite + Vanilla JS ES module architecture (`index.html`, `src/main.js`, `src/core/`, `src/entities/`, `src/editor/`, `src/audio/`).
  - Three.js scene, lighting, procedural sky/environment, procedural canvas textures, and Cannon-es physics world with fixed-timestep stepping.
  - Procedural `SoundManager` using Web Audio API (`AudioContext`) for Jump (boing), Morph (squish), Bounce (high boing), Impact (thud), Checkpoint (chime), Fall/Splash, and Victory (fanfare).
  - `JellyPlayer` entity with `THREE.MeshPhysicalMaterial` (`transmission: 0.85`, `ior: 1.4`, `roughness: 0.15`), procedural eyes/face inside/on the surface, spring-damper squash-and-stretch + sinusoidal vertex wobble, and volume-preserving morphing ($W \times H \times D = \text{const}$) via `Q`/`E`, Mouse Wheel, or touch quick-morph buttons.
- **Phase 2: Modular Obstacle Catalog & Preset Levels**
  - `ObstacleFactory` supporting 6 obstacle types (`track_block`, `spinning_sweeper`, `moving_platform`, `bouncy_pad`, `shape_gate`, `checkpoint_finish`) and 2 built-in preset courses ("Beginner Bounce" and "Morph Madness").
  - Automatic passed-obstacle occlusion transparency: obstacles smoothly fade to translucent (`opacity: 0.18`, `depthWrite: false`) once passed by the jelly in `PLAY_MODE` so they never obstruct the camera view.
- **Phase 3: 3D Level Builder (`EDITOR_MODE`)**
  - Clean state separation between `EDITOR_MODE` and `PLAY_MODE` with full level snapshot serialization on mode entry/exit.
  - `OrbitControls` camera navigation, ground grid plane raycasting with configurable 1-unit / 2-unit grid snapping, and placement preview ghost.
  - Selection system with `THREE.TransformControls`, collapsible Property Inspector bottom sheet for mobile, and LocalStorage/JSON persistence.
- **Phase 4: Gameplay Loop, Juice, Mobile Optimization & Verification (`PLAY_MODE`)**
  - Adaptive third-person follow camera with portrait aspect compensation (`Hor+`) and velocity-based dynamic FOV boost.
  - Mobile ergonomics: Virtual Analog Thumbstick (left thumb) + ergonomic Jump & 1-Tap Morph cluster (`FLAT`, `CUBE`, `TALL` for right thumb), compact single-row mobile HUD with collapsible options drawer, `100dvh` safe-area layout, and mobile GPU shadow/DPR tuning.

## Milestones
1. Phase 1: Project scaffolding, core loop, `SoundManager`, and `JellyPlayer`.
2. Phase 2: `ObstacleFactory` (6 obstacle types) and 2 preset tracks ("Beginner Bounce", "Morph Madness").
3. Phase 3: `LevelEditor` (`OrbitControls`, `TransformControls`, raycast placement, property inspector, JSON import/export).
4. Phase 4: Particle systems, HUD polish, respawn/victory flow, and browser verification.
5. Phase 5: Mobile smartphone optimization & passed-obstacle camera occlusion transparency.

## Tasks
- [x] Phase 1: Scaffold Vite project, install `three` and `cannon-es`, implement `SoundManager`, `PhysicsWorld`, `ProceduralTextures`, and `JellyPlayer`.
- [x] Phase 2: Implement `ObstacleFactory` with all 6 obstacle types and create `PresetLevels.js` ("Beginner Bounce" & "Morph Madness").
- [x] Phase 3: Implement `LevelEditor.js` with `OrbitControls`, `TransformControls`, toolbar placement, inspector, and LocalStorage/JSON serialization.
- [x] Phase 4: Implement `ParticleSystem.js`, HUD/UI states, dynamic FOV camera, respawn/victory sequence, and verify in headless/browser run.
- [x] Phase 5: Implement passed-obstacle transparency fade in `ObstacleFactory`, virtual analog joystick + quick-morph cluster, adaptive portrait camera, collapsible mobile HUD/inspector, and mobile GPU optimizations.

## Risks
- **Transparent Obstacle Depth Sorting with Transmissive Jelly**: When an obstacle fades after being passed by the jelly, leaving `depthWrite: true` on its materials would still occlude the transmissive `MeshPhysicalMaterial` jelly in the depth buffer. Setting `material.depthWrite = false` while `currentFade < 0.85` prevents depth-buffer occlusion.
- **Portrait Aspect Ratio Clipping**: Fixed vertical FOV clips track edges on `9:16` smartphones; compensating camera distance and FOV when `aspect < 1` keeps the full obstacle width visible.

## Progress Log
- 2026-10-17 16:01:30 — Created implementation plan for 3D Jelly Obstacle Race & Track Builder.
- 2026-10-17 16:07:10 — Completed Phase 1: Vite scaffold, `SoundManager`, `ProceduralTextures`, `PhysicsWorld`, and `JellyPlayer`.
- 2026-10-17 16:09:45 — Completed Phase 2: `ObstacleFactory` (all 6 obstacle types) and `PresetLevels` ("Beginner Bounce" and "Morph Madness").
- 2026-10-17 16:13:15 — Completed Phase 3: `LevelEditor` (`OrbitControls`, `TransformControls`, raycast placement, Property Inspector, and JSON/LocalStorage persistence).
- 2026-10-17 16:18:55 — Completed Phase 4: `ParticleSystem`, HUD telemetry, dynamic FOV camera, WCAG AA contrast audit, and full automated verification.
- 2026-10-17 21:43:00 — Started Phase 5: Mobile smartphone optimization & passed-obstacle transparency fade.
- 2026-10-17 22:01:35 — Completed Phase 5: Passed-obstacle transparency fade (`opacity: 0.18`, `depthWrite: false`), Virtual Analog Thumbstick + 1-Tap Morph Cluster, adaptive `Hor+` portrait camera, collapsible mobile HUD/inspector drawers, and full verification.

## Notes
- Follows TOGAF-aligned modular architecture separating presentation (`Three.js`), simulation (`Cannon-es`), domain entities (`JellyPlayer`, `ObstacleFactory`), and editor tooling (`LevelEditor`).
