# 3D Jelly Obstacle Race & Track Builder Implementation Plan

Created: 2026-10-17 16:01:30

## Objective
Build a complete, playable, modular HTML5 3D game titled **"3D Jelly Obstacle Race & Track Builder"** (Jellometry) using Vite, Three.js (`three` r160+), and `cannon-es`, featuring a translucent morphing jelly character with soft-body spring-damper wobble physics, 6 modular obstacle types, a full 3D Level Builder with `OrbitControls` and `TransformControls`, two built-in preset courses ("Beginner Bounce" and "Morph Madness"), procedural Canvas textures, particle systems, and a procedural Web Audio API synthesizer.

## Scope
- **Phase 1: Project Setup, Core Engine, Procedural Audio, & Jelly Player**
  - Vite + Vanilla JS ES module architecture (`index.html`, `src/main.js`, `src/core/`, `src/entities/`, `src/editor/`, `src/audio/`).
  - Three.js scene, lighting, procedural sky/environment, procedural canvas textures, and Cannon-es physics world with fixed-timestep stepping.
  - Procedural `SoundManager` using Web Audio API (`AudioContext`) for Jump (boing), Morph (squish), Bounce (high boing), Impact (thud), Checkpoint (chime), Fall/Splash, and Victory (fanfare).
  - `JellyPlayer` entity with `THREE.MeshPhysicalMaterial` (`transmission: 0.85`, `ior: 1.4`, `roughness: 0.15`), procedural eyes/face inside/on the surface, spring-damper squash-and-stretch + sinusoidal vertex wobble, and volume-preserving morphing ($W \times H \times D = \text{const}$) via `Q`/`E` or Mouse Wheel with smooth collider resizing.
- **Phase 2: Modular Obstacle Catalog & Preset Levels**
  - `ObstacleFactory` supporting 6 obstacle types with both visual meshes, Cannon-es bodies, kinematic update loops, and snapshot reset logic:
    1. `track_block` (Track Block / Sloped Ramp with customizable width, length, thickness, slope angle)
    2. `spinning_sweeper` (Kinematic rotating cylinder hammer/bar with configurable RPM and arm length)
    3. `moving_platform` (Kinematic oscillating platform between local waypoints with configurable speed and travel axis/distance)
    4. `bouncy_pad` (High-restitution slime pad with squash-pulse visual feedback and upward launch impulse)
    5. `shape_gate` (Jelly Shift Wall with `tall_narrow`, `flat_wide`, or `standard` cutout requiring the player to morph dimensions to pass through)
    6. `checkpoint_finish` (Checkpoint Pad & Finish Line Arch updating respawn transform or triggering race completion + confetti)
  - 2 built-in playable preset courses: **"Beginner Bounce"** and **"Morph Madness"**.
- **Phase 3: 3D Level Builder (`EDITOR_MODE`)**
  - Clean state separation between `EDITOR_MODE` and `PLAY_MODE` with full level snapshot serialization on mode entry/exit.
  - `OrbitControls` camera navigation, ground grid plane raycasting with configurable 1-unit / 2-unit grid snapping, and placement preview ghost.
  - Selection system with `THREE.TransformControls` (`[G]` Translate, `[R]` Rotate, `[S]` Scale, `[Del/Backspace]` Delete, `[Ctrl+D]` Duplicate).
  - Right-hand Property Inspector panel to edit obstacle parameters (dimensions, slope, rotation speed, travel distance, gate cutout profile, color tint).
  - Level persistence: `Save to LocalStorage`, `Export Level JSON` (clipboard + file download), `Import Level JSON` modal/file loader, and preset switcher.
- **Phase 4: Gameplay Loop, Juice, Particles & Verification (`PLAY_MODE`)**
  - Third-person follow camera with smooth damping, look-ahead, and velocity-based dynamic FOV boost.
  - HUD with race timer, best time record, speed & live 3D morph ratio indicator, checkpoint banner, and instant `[ESC / Edit Track]` mode toggle.
  - Out-of-bounds detection ($Y < -10$) with splash sound, droplet burst, and checkpoint respawn + jelly reform animation.
  - Particle systems for collision jelly droplets, slime bounce rings, and finish line victory confetti.
  - Full verification across `PLAY_MODE` and `EDITOR_MODE` to ensure zero console errors, no physics/visual desync, and clean memory disposal.

## Milestones
1. Phase 1: Project scaffolding, core loop, `SoundManager`, and `JellyPlayer`.
2. Phase 2: `ObstacleFactory` (6 obstacle types) and 2 preset tracks ("Beginner Bounce", "Morph Madness").
3. Phase 3: `LevelEditor` (`OrbitControls`, `TransformControls`, raycast placement, property inspector, JSON import/export).
4. Phase 4: Particle systems, HUD polish, respawn/victory flow, and browser verification.

## Tasks
- [x] Phase 1: Scaffold Vite project, install `three` and `cannon-es`, implement `SoundManager`, `PhysicsWorld`, `ProceduralTextures`, and `JellyPlayer`.
- [x] Phase 2: Implement `ObstacleFactory` with all 6 obstacle types and create `PresetLevels.js` ("Beginner Bounce" & "Morph Madness").
- [x] Phase 3: Implement `LevelEditor.js` with `OrbitControls`, `TransformControls`, toolbar placement, inspector, and LocalStorage/JSON serialization.
- [x] Phase 4: Implement `ParticleSystem.js`, HUD/UI states, dynamic FOV camera, respawn/victory sequence, and verify in headless/browser run.

## Risks
- **Physics Collider Resizing in Cannon-es**: Updating `CANNON.Box` halfExtents dynamically during jelly morphing requires calling `shape.updateConvexPolyhedronRepresentation()` and `body.updateBoundingRadius()` so collisions with `shape_gate` walls remain accurate in real time.
- **TransformControls vs OrbitControls Conflict**: Dragging gizmo handles in `EDITOR_MODE` must disable `OrbitControls` while `dragging-changed` is active, and prevent accidental deselection on pointer-up.
- **Kinematic Bodies in Cannon-es**: Rotating sweepers and moving platforms must update both `body.position`/`body.quaternion` and `body.velocity`/`body.angularVelocity` in `preStep` so the player receives realistic physical momentum when standing on platforms or struck by a sweeper.

## Progress Log
- 2026-10-17 16:01:30 — Created implementation plan for 3D Jelly Obstacle Race & Track Builder.
- 2026-10-17 16:07:10 — Completed Phase 1: Vite scaffold, `SoundManager`, `ProceduralTextures`, `PhysicsWorld`, and `JellyPlayer`.
- 2026-10-17 16:09:45 — Completed Phase 2: `ObstacleFactory` (all 6 obstacle types) and `PresetLevels` ("Beginner Bounce" and "Morph Madness").
- 2026-10-17 16:13:15 — Completed Phase 3: `LevelEditor` (`OrbitControls`, `TransformControls`, raycast placement, Property Inspector, and JSON/LocalStorage persistence).
- 2026-10-17 16:18:55 — Completed Phase 4: `ParticleSystem`, HUD telemetry, dynamic FOV camera, WCAG AA contrast audit, and full automated verification.

## Notes
- Follows TOGAF-aligned modular architecture separating presentation (`Three.js`), simulation (`Cannon-es`), domain entities (`JellyPlayer`, `ObstacleFactory`), and editor tooling (`LevelEditor`).
