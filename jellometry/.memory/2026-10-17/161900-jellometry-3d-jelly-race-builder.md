# 3D Jelly Obstacle Race & Track Builder Initial Build

- **Timestamp**: 2026-10-17 16:19:00 +07:00
- **Plan**: [2026-10-17-jellometry-3d-jelly-race-builder.md](../../plans/2026-10-17-jellometry-3d-jelly-race-builder.md)
- **Design**: [DESIGN.md](../../DESIGN.md)

## Task / Problem
Build a modular HTML5 3D game ("3D Jelly Obstacle Race & Track Builder") using Vite, Three.js, and Cannon-es with zero external asset dependencies, featuring a translucent morphing jelly player, 6 obstacle types, a 3D level editor with `OrbitControls` and `TransformControls`, 2 built-in preset courses, and procedural Web Audio SFX.

## Key Files Changed
- `package.json`, `vite.config.js`, `index.html`, `src/style.css`
- `src/main.js`
- `src/audio/SoundManager.js`
- `src/core/ProceduralTextures.js`, `src/core/PhysicsWorld.js`, `src/core/ParticleSystem.js`
- `src/entities/JellyPlayer.js`, `src/entities/ObstacleFactory.js`, `src/entities/PresetLevels.js`
- `src/editor/LevelEditor.js`

## Technical & Business Decisions
- **Volume-Preserving Morphing**: Parameterized width as $W = W_0 \cdot 2^{-0.95m}$, height as $H = H_0 \cdot 2^{0.90m}$, and depth as $D = \frac{V_0}{W \cdot H}$ so volume remains constant ($1.728\,\text{m}^3$) while enabling clearance through `flat_wide` ($0.90\text{m}$ high) and `tall_narrow` ($0.90\text{m}$ wide) `shape_gate` barriers.
- **Snapshot Serialization Between Modes**: Entering `PLAY_MODE` serializes the editor scene into `this.editorSnapshot`, and returning to `EDITOR_MODE` restores the snapshot so kinematic sweepers, moving platforms, and checkpoints return to their exact edited state.

## Assumptions & Risks
- In Three.js r170, setting `reflectivity` after `ior` in `MeshPhysicalMaterial` overwrites `ior`; verified that omitting `reflectivity` preserves `ior === 1.4`.
- In Three.js r170, `TransformControls` is a `Controls` subclass and must be added to the scene via `transformControls.getHelper()`.

## Verification
- Ran `npm run build` (`vite build` succeeded in 2.72s).
- Ran `verify_jellometry.mjs`, `verify_ui_and_contrast.mjs`, and `verify_clickthrough.mjs` verifying physics stepping, volume invariance, all 6 obstacle types, WCAG AA contrast ratios, and all 58 DOM controls.

## Proposed Conventional Commit
`feat(jellometry): build 3D jelly obstacle race and track builder with Three.js and cannon-es`
