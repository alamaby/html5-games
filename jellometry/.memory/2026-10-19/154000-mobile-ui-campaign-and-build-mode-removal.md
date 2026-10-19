# Mobile UI Campaign, Build Mode Removal & 10-Course Progression

- **Date**: 2026-10-19 15:40:00 +07:00
- **Plan**: [`plans/2026-10-19-mobile-ui-campaign-and-build-mode-lockdown.md`](../../plans/2026-10-19-mobile-ui-campaign-and-build-mode-lockdown.md)

## Task

Make the game UI genuinely usable on a phone in both portrait and landscape, remove the 3D Level Builder entirely, and replace the 2-course preset system with a 10-course campaign whose difficulty rises in small measurable steps.

## Problem

Three separate defects were in the way:

1. `#app { touch-action: none }` disabled native gesture handling for **every** descendant, so any future scrollable overlay (a course list, for example) would be dead on a landscape phone.
2. `renderer.setSize(window.innerWidth, window.innerHeight)` wrote an inline element size from the window metrics. On iOS, `innerHeight` disagrees with the visual viewport once the toolbar collapses, and the inline style beat `#app { height: 100dvh }`, so the canvas overflowed the page.
3. The thumbstick mapped its knob against a hardcoded `maxRadius = 36` while the CSS base was 112px (98px on small phones), so the effective radius was 32px or 28px depending on the breakpoint — the knob punched through its own ring.

A fourth defect was found while auditing difficulty rather than layout: `PhysicsWorld` dispatched every `preStep` callback with a hardcoded `1/60` regardless of the real frame delta. Sweeper and platform animation therefore ran at twice the intended speed on a 120 Hz phone. That is a fairness bug, not a cosmetic one.

## Changes

**Viewport (`src/main.js`)**
- `initViewportHandling()` / `applyViewportSize()`: sizing now comes from `canvas.clientWidth` / `canvas.clientHeight` and calls `renderer.setSize(w, h, false)` so CSS keeps ownership of the element box and the `ResizeObserver` cannot feed back into itself. Coalesced into one rAF, with `resize`, `orientationchange` (140 ms + 420 ms, because iOS reports stale metrics after rotation) and `visualViewport` fallbacks.

**Touch (`src/main.js`, `src/entities/JellyPlayer.js`)**
- Thumbstick radius derived from the live DOM box, a `::after` hit zone 24px wider than the visible ring on every side, and a floating recentre: if the thumb lands more than 72% of the base radius from centre, the ring moves to the thumb instead of the thumb having to find the ring.
- `JellyPlayer.queueJump()` latch with a 0.15 s window. Touch events fire far more often than the fixed 60 Hz physics step, so a raw tap could land entirely between two substeps and be dropped.
- RESET moved into the morph row, styled as a quiet dashed outline, deliberately not adjacent to JUMP.

**Physics (`src/core/PhysicsWorld.js`)**
- `step()` stores the clamped real delta in `lastStepDt`; the `preStep` dispatcher passes it to callbacks instead of `1/60`.

**Build mode removed**
- `index.html` rewritten without the editor inspector, bottom catalog dock, JSON modal, mode indicator, preset `<select>`, colour `<select>` or options drawer. The `three/addons/` importmap entry was dropped.
- `main.js` lost the `LevelEditor` import, `this.editor`, `setMode`/`toggleMode`, the inspector renderers, gizmo syncing, JSON import/export and the `custom_saved` pseudo-course.
- 43 dead CSS rules removed by `scripts/strip-dead-css.mjs` (903 → 620 lines before the new sections were added).
- `dist` contains **0 matches** for `OrbitControls`, `TransformControls`, `LevelEditor` and `EDITOR_MODE`.

**Campaign**
- `src/entities/PresetLevels.js` exports `LEVELS` (10 courses). Each entry carries `id`, `name`, `difficulty`, `objective`, `description`, `spawnPoint`, `obstacles`. Ids `beginner_bounce` and `morph_madness` are preserved so existing best times still resolve.
- New obstacles were **not** added. All ten courses are built from the existing six types by switching on parameters the two legacy courses never used: `slopeAngle`, `moving_platform` on the `y` and `z` axes, negative sweeper `speed`, low `barHeight` for duck-under, and sweeper arms that overhang the deck edge.
- `scripts/validate-levels.mjs` proves geometric reachability from the player envelope (10.8 m/s, 12.6 m/s jump impulse, 24 m/s² gravity) and checks curve monotonicity.
- Course Select is a 10-card grid; the victory dialog names the next course. Progression lives in `jellometry_progress_v1` with a one-time migration that derives `unlocked` from the legacy best-time map. `?unlockAll=1` overrides in memory only and never writes to storage. `jellometry_best_times_v1` is untouched.

## Decisions

- **Delete the builder rather than hide it.** Gating it behind a flag would have left the editor in the bundle and kept the code path alive for no user benefit.
- **Keep `src/editor/LevelEditor.js` on disk** as unreferenced dead code. It is not imported, so Vite tree-shakes it out; deleting it is a separate call.
- **Difficulty is modelled offline, then validated.** A weighted `threat(level)` score with a strictly increasing curve and a bounded step is the only monotonicity evidence available without a playtest harness.
- **Curve ceiling raised from 1.30 to 1.40.** One hazard is worth 1.2–2.2 threat points, so once the tutorial baseline sits at 3.47 an element-sized addition is unavoidably a 25–35% step. Padding the tutorial with extra hazards just to flatten the ratio would have made the first course worse to play.
- **Slime Cathedral and Sky Bridges were swapped** to positions 7 and 8. The platform-heavy course scores about 1.4x the pad/duck course, which broke monotonicity at position 7.
- **Duck-under bars are a two-solution hazard, not a gate.** A `barHeight` of 1.05 leaves a 0.77–1.33 m band; the flat morph (0.643 m) passes underneath, but a jump (apex 3.31 m) clears it too. Both are valid reads, and the validator only asserts the flat morph fits.

## Assumptions & Risks

- **The threat weights are a model, not playtest data.** Every constant in `threat()` is an estimate. The curve is monotone and bounded, which is all the validator can actually prove. One calibration round after the first real play session is expected.
- **No browser automation was available in this session.** Layout, notch insets, course-list scrolling, rotation behaviour and 120 Hz timing have not been observed on a real device. Only `npm run build` (exit 0) and the level validator (exit 0) are machine-verified.
- **The three validator warnings are intentional.** They flag jumps where a full-sprint landing would overshoot the far edge. Speed control is part of the challenge, and the warnings exist so the designer can see where that demand sits.
- **Silent `localStorage` failure.** Every read/write is wrapped in `try`/`catch`; in private mode best times and progression degrade to session-only memory with no user-visible signal.

## Verification

- `npm run build` — exit 0, 13 modules, no `three/addons` chunk, no editor symbols in `dist`.
- `node scripts/validate-levels.mjs` — exit 0. All reachability, ramp-alignment, gate-width, single-finish and overlap checks pass. Threat curve: `3.47 → 4.22 → 5.11 → 5.36 → 7.17 → 9.02 → 12.53 → 13.96 → 15.44 → 20.13`, steps `1.049x … 1.389x`.
- Not verified: anything requiring a browser. Manual device checklist still open under D4 in the plan.

## Files

- `index.html` — rewritten; no build-mode markup.
- `src/main.js` — rewritten; viewport, joystick, campaign, progression, throttled HUD, adaptive quality.
- `src/style.css` — editor CSS stripped; mobile shell, HUD stack, course intro, course grid, landscape breakpoint, coarse-pointer blur cap.
- `src/entities/PresetLevels.js` — rewritten as `LEVELS` (10 courses).
- `src/entities/JellyPlayer.js` — `queueJump()` latch.
- `src/entities/ObstacleFactory.js` — low-bar sweeper hub (base plate + spindle + collar).
- `src/core/PhysicsWorld.js` — real frame delta to `preStep`.
- `scripts/validate-levels.mjs`, `scripts/strip-dead-css.mjs` — new tooling.
- `DESIGN.md` — retitled; glassmorphism cap and state list updated for the removed builder.
- `plans/2026-10-19-mobile-ui-campaign-and-build-mode-lockdown.md` — plan of record.

## Commit

`refactor: remove build mode and ship 10-course campaign with mobile-first UI`
