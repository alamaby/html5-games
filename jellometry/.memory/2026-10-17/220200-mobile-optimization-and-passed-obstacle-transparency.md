# Mobile Smartphone Optimization & Passed-Obstacle Transparency

- **Timestamp**: 2026-10-17 22:02:00 +07:00
- **Related Plan**: [2026-10-17-jellometry-3d-jelly-race-builder.md](../../plans/2026-10-17-jellometry-3d-jelly-race-builder.md)

## Task / Problem
Optimize **Jellometry (3D Jelly Obstacle Race & Track Builder)** for mobile smartphones (both portrait and landscape orientations) and ensure obstacles automatically fade to transparent once passed by the jelly player so they never obstruct the third-person camera view.

## Key Files Modified
- `src/entities/ObstacleFactory.js`: Added `isObstaclePassedByPlayer(obstacle, player)`, `applyObstacleFade(obstacle, fadeValue)`, and smooth exponential opacity interpolation (`0.18` for gates/sweepers/arches, `0.22` for cleared/overhead platforms) in `updateVisuals()` during `PLAY_MODE`. Restores `1.0` opacity in `EDITOR_MODE` and `resetAllForModeSwitch()`.
- `src/entities/JellyPlayer.js`: Added `analogInput` (`THREE.Vector2`) merged with keyboard input in `updateMovement(dt)` for smooth proportional 360-degree thumbstick control.
- `src/editor/LevelEditor.js`: Enlarged `TransformControls` gizmo size (`1.35`) on coarse-pointer (`(pointer: coarse)`) touch screens and increased tap-vs-drag threshold to `14px`.
- `index.html`, `src/style.css`, `src/main.js`:
  - Added `viewport-fit=cover`, `height: 100dvh`, `touch-action: none`, and safe-area-inset padding.
  - Replaced 4-button D-Pad with a floating Virtual Analog Thumbstick (`#joystick-zone`, `#joystick-base`, `#joystick-knob`) for the left thumb and an ergonomic Jump + 1-Tap Quick-Morph Cluster (`FLAT`, `CUBE`, `TALL`, `R`) for the right thumb.
  - Added collapsible mobile options drawer (`#top-options-drawer`, `#btn-mobile-options`) in `.top-bar` and collapsible bottom-sheet Property Inspector (`#inspector-body`, `#btn-toggle-inspector`) on mobile.
  - Added portrait aspect ratio (`Hor+`) camera FOV and follow-distance compensation in `updatePlayCamera(dt)` when `camera.aspect < 1`.
  - Added mobile GPU optimizations (`pixelRatio` capped at `1.5`, `1024x1024` shadow map on mobile/coarse pointer).

## Technical & Business Decisions
- **Disabling `depthWrite` on Faded Obstacles**: Because the jelly uses `THREE.MeshPhysicalMaterial` with `transmission: 0.85`, Three.js renders transmissive objects in a separate pass. If a passed obstacle only lowers `opacity` while keeping `depthWrite: true`, the obstacle still writes to the depth buffer and hides the jelly behind it. Setting `mat.depthWrite = fadeValue > 0.85` ensures the jelly remains crystal-clear behind passed obstacles.
- **Overhead Platform Occlusion Detection**: In addition to fading obstacles with `playerPos.z < worldPos.z - 0.15`, elevated `track_block` and `moving_platform` obstacles that sit higher than `playerPos.y + 0.75` and behind the player (`worldPos.z > playerPos.z - 0.5`) also fade so falling below an upper deck never blocks the camera.

## Assumptions & Risks
- Assumed mobile players benefit from both continuous desktop slider morphing and instant 1-tap `FLAT` (`-1`), `CUBE` (`0`), and `TALL` (`+1`) preset buttons on touch screens.

## Blockers / Open Items
- None.

## Verification Performed
- `node verify_jellometry.mjs`: Passed all physics, morph volume preservation, and level serialization checks.
- `node verify_ui_and_contrast.mjs`: Passed `R-02` (zero em-dashes) and `R-25` (all WCAG AA contrast pairs >= 4.5:1).
- `node verify_clickthrough.mjs`: Passed 70 DOM ID checks, `SoundManager` synthesis, `analogInput` velocity response, and passed-obstacle transparency (`currentFade < 0.25`, `depthWrite === false`, and `1.0` reset on mode switch).
- `npm run build`: Succeeded cleanly in 2.75s.

## Proposed Conventional Commit
`feat(mobile): add virtual analog joystick, responsive mobile UI, and passed-obstacle transparency`
