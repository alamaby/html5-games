# Random Course Generator

Created: 2026-10-19 15:40:00

## Objective

Let players generate a playable course from a seed, with a small set of customisation options, without breaking the campaign's progression model or shipping a course the physics cannot clear.

The generator is deterministic: the same options plus the same seed always produce the same course, so a course can be shared as a URL instead of a JSON blob.

## Scope

### In scope

- A "Random" tab inside the existing Course Select modal.
- Six options: seed, difficulty, length, hazard toggles, checkpoint density, palette.
- Deterministic generation from a seed string.
- Offline validation of every generated course using the existing 1-D reachability model.
- Live metrics preview before the player commits (length, hazard count, threat score, checkpoint count).
- Shareable URL: `?course=<seed>&diff=&len=&haz=&cp=&pal=`.
- Separate best-time storage: `jellometry_random_bests_v1` (LRU, cap 50).
- Geometry/material/texture disposal when a course is unloaded.

### Out of scope (deliberately deferred)

- **Curved tracks.** v1 is centreline-only (`x = 0`, no heading). A future `bend()` can be applied as a post-process because the layout is an ordered run of decks with known `z` ranges and tops, but no bending is implemented and no camera/input changes are made. Rationale: a rotating camera cannot be verified in this environment, and a straight-only polyline projector would never be exercised.
- A hand-authored level editor (removed in `0a66adc`).
- Persistent course library / saved random courses.
- Online leaderboards.

## Milestones

1. **P1 — Validator as a module.** Extract the pure validation core so the browser generator and the Node CLI share one source of truth.
2. **P2 — Deterministic randomness and options.** Seeded PRNG plus an options schema with URL encoding.
3. **P3a — Generator and fuzz test.** Segment grammar, stitching, retry loop, offline proof.
4. **P4 — Game integration.** Course-agnostic game state, random-course lifecycle, separate storage.
5. **P5 — UI.** Tab, form, live metrics, share link.
6. **P6 — Disposal.** Fix the leak that repeated regeneration would expose.
7. **P7 — Documentation.**

## Tasks

### P1 — Validator extraction

- [x] Create `src/core/LevelValidator.js` exporting `validateLevel(level)` → `{ problems, warnings, metrics }`
- [x] Move `liftWindow`, `extract`, `buildStages`, `padFor`, `checkTransition`, `deckAt`, `checkStructure`, `threat` into the module
- [x] Convert the module-level `fail`/`warn` arrays into per-level closures
- [x] Keep the difficulty-curve check in the CLI, not the module (it only means something for an ordered campaign)
- [x] Add a hard failure when a level declares a non-zero `rotation` — the model ignores rotation, so a rotated level would validate the wrong geometry
- [x] Rewrite `scripts/validate-levels.mjs` as a thin wrapper (same table, same exit codes)
- [x] Verify the CLI output is byte-identical to the pre-refactor output

### P2 — Randomness and options

- [x] Create `src/core/Rng.js` — `hashString` (xmur3), `mulberry32`, and `pick` / `range` / `int` / `chance` helpers
- [x] Create `src/core/CourseOptions.js` — defaults, `normalizeOptions`, `encodeOptions`, `decodeOptions`, `optionsKey`
- [x] Add a readable-name generator (`misty-otter-42`) that doubles as a seed
- [x] `decodeOptions` must be tolerant: missing or invalid params fall back to defaults, never throw

### P3a — Generator

- [x] Create `src/core/LevelGenerator.js` exporting `generateCourse(options)` → `{ level, metrics, attempts, id }`
- [x] Implement the cursor and the segment templates: `runway`, `ramp`, `step`, `gap`, `padHop`, `lift`, `bridge`, `sweeperHall`, `gateRun`, `checkpoint`, `finish`
- [x] Enforce the validator's structural constraints at generation time (anchor heights, gate width window, wall height floor, monotonic `z`, one pad per deck)
- [x] Map difficulty presets to `threat()` bands derived from the campaign
- [x] Require at least 2 active hazard families so extreme option combinations can still reach their band — **not enforced**: one family is allowed and `isDifficultyReachable` warns instead of blocking
- [x] Retry loop: 60 attempts, each seeded by `hash(seed + ':' + attempt)` — implemented with 120 attempts plus a density sweep; the observed average is 7.2
- [x] Explicit fallback when the budget is exhausted — never silently return an invalid course
- [x] Create `scripts/fuzz-generator.mjs` — 500 seeds × 4 difficulties × 3 lengths
- [x] Fuzz must assert: zero validation problems, threat inside band, length inside budget, no duplicate obstacle ids

### P4 — Game integration

- [x] Replace `this.levelIndex` with `this.currentCourse = { kind, level, index?, options?, id? }`
- [x] Split `loadLevel(index)` into `loadCampaignLevel(index)` and `loadRandomCourse(options)`
- [x] `updateLevelChip()` shows `RND` for generated courses
- [x] `handleRaceVictory()`: random courses record a best time but never unlock campaign courses and never offer "Next"
- [x] Add starting-course resolution handling `?course=` (`loadStartingCourse`, falling back to the campaign when a link cannot generate)
- [x] Add `jellometry_random_bests_v1` with an LRU cap of 50
- [x] Leave `jellometry_progress_v1` untouched by random courses
- [x] Victory screen for random courses offers **New Seed** instead of **Next Course**

### P5 — UI

- [x] Restructure `#level-modal` into a tablist with `Campaign` and `Random` panels
- [x] Build the form with segmented button groups (not `<select>`)
- [x] Live metrics line, debounced at 120 ms
- [x] `Generate & Play` and `Copy link` actions
- [x] Wire `aria-selected`, `aria-controls`, arrow-key tab navigation
- [ ] Verify the form fits 844×390 landscape without nested scrolling — **not possible offline**: no browser or automation in this environment. Reasoned from source (3-column form at `landscape and max-height: 560px`, single backdrop scroll) but not observed.
- [ ] Verify the 540 px and coarse-pointer breakpoints — same blocker. Falls back to one column; unverified on hardware.

### P6 — Disposal

- [x] Mark cached textures from `ProceduralTextures` as shared — **deviation:** a `WeakSet` (`isShared()`), not `userData.shared = true`. `Texture.clone()` copies `userData`, so a clone would inherit the marker and be skipped, leaking it. WeakSet membership does not survive cloning.
- [x] `removeObstacle()` disposes geometry and materials
- [x] Dispose textures only when not shared (clones are never shared)
- [x] Apply the same fix to `rebuildObstacle()`

### P7 — Documentation

- [x] `README.md`: random courses section (options, URL, storage key, honesty note about threat weights)
- [x] `DESIGN.md`: tab and form decisions
- [x] `.memory/` entry for the task
- [x] Check off tasks and log progress in this file

## Risks

- **Disposal can break rendering.** Disposing a cached texture leaves meshes black. This is a visual failure that no build or unit check catches — it needs a browser.
- **Threat bands may be unreachable** for some option combinations. The fallback must be visible to the player, not silent.
- **The form may not fit** a 390 px-tall landscape viewport once tabs are added.
- **`threat()` is a design model, not playtest data.** Difficulty labels inherit that uncertainty. The README already says this for the campaign; the new section must stay consistent.
- **No human playtest** of generated courses, same as the campaign.
- **No browser automation** in this environment, so camera feel, touch targets and disposal correctness are unverified.

## Progress Log

- 2026-10-19 15:40:00 — Plan written. Scope fixed at straight-only (v1); curved tracks deferred to v1.1. `CoursePath` abstraction deferred as premature — for a straight track arc-length is `−z`, so the abstraction would ship untested.
- 2026-10-19 16:05:00 — P1 done. `src/core/LevelValidator.js` created; CLI rewritten as a wrapper. Output verified byte-identical to the pre-refactor baseline. Added the rotation guard (campaign levels must not declare rotation) and fixed it to report one clear problem instead of cascading "not anchored" errors.
- 2026-10-19 16:20:00 — P2 done. `Rng.js` (xmur3 + mulberry32) and `CourseOptions.js` verified for determinism, URL round-trip, and tolerant decoding of garbage input.
- 2026-10-19 17:10:00 — P3a done, but the difficulty model needed three corrections:
  1. **Absolute threat bands were unreachable.** A 65 m course cannot score 14 threat; the campaign's own courses span 3.47–20.13 but scale with length. Switched to threat *per metre* (campaign range 0.053–0.138).
  2. **The generator was diluting its own density.** Checkpoints were given dedicated rest decks and the tail was up to 26 m of empty runway. The campaign places arches on hazard decks; doing the same removed 20–30 m of zero-threat length per course.
  3. **`FAMILY_CEILING` was measured from single-seed outliers.** A 40-seed sweep showed platforms peak at 0.090, not 0.095, which had made `isDifficultyReachable` promise Spicy for a platform-only selection that could not deliver it.
  Fuzz now passes 6000/6000 courses (500 seeds × 4 difficulties × 3 lengths) in 4.7 s with zero invalid, zero out-of-band, zero out-of-budget.
- 2026-10-20 — P4 done. `currentLevel` became a getter over `currentCourse`, so campaign code kept working while random mode gained a home. `handleRaceVictory()` split into a campaign path (unchanged arithmetic, now reading `course.index`) and `handleRandomVictory()`, which records into `jellometry_random_bests_v1` and offers **New Seed** instead of **Next**. Escape is now handled before the typing guard — otherwise the seed input would trap the player in the dialog. The Enter-on-victory handler read the focused button twice (global handler + native activation); it now defers to the focused button.
- 2026-10-20 — P5 done, with two accessibility choices worth recording: segmented controls are `role="radio"` buttons with roving tabindex (native `<select>` hides the live preview behind a modal sheet on mobile), and hazard toggles are `aria-pressed` because they are genuinely multi-select. The preview reports the *built* course, not the request.
- 2026-10-20 — Generator corrections found while wiring the UI:
  1. **Pad hops were sized from the pad's own reach**, so the validator could only pass them via the pad — and the pad was placed 6.5–10.5 m *behind* the deck edge, making the required flight longer than the pad's reach. Now the gap is sized from a plain jump and the pad sits 3 m before the edge: the course is always clearable without it, and the pad is a genuine assist (matching the campaign).
  2. **Checkpoints could land on ramps.** An arch is anchored at one height, so on a slope it floats at one end. Sloped decks now defer the arch to the next flat deck; a per-deck slot counter keeps multiple arches from stacking, and a forced flat deck is added if the tail is ramp-heavy.
  3. **`FAMILY_CEILING.pads` was 0.083, measured with all hazards on.** A pads-only sweep tops out at `0.0613`, so the UI promised Normal on pads alone and could not deliver. Corrected to `0.060`.
  Fuzz re-run: 6000/6000 clean, including the hazard-toggle and checkpoint checks.
- 2026-10-20 — P6 done. Cached textures are tracked in a `WeakSet` rather than tagged with `userData.shared`, because `Texture.clone()` copies `userData` — the marker would spread to clones and leak them. `disposeGroup()` walks geometry, materials and unshared texture slots.
- 2026-10-20 — P7 mostly done. `README.md` gained a full Random courses section (options table, URL codec, band/family-ceiling tables with measured numbers, attempt algorithm, what random mode never does, straight-only rationale, fuzz command). `DESIGN.md` gained the tab/form decision list. Two P5 verification tasks remain open: they need a browser.
- 2026-10-20 — Extra verification beyond the plan, since no browser exists here:
  - Every `$('id')` referenced in `main.js` resolves to an element in `index.html` (57 references, 0 missing).
  - 100 generated courses (25 seeds × 4 difficulties) were built through the **real** `ObstacleFactory` with a stubbed canvas/2D context: 1351 obstacles, 0 failures, including a `rebuildObstacle()` round-trip and `clearAll()` disposal.
  - Also removed a pre-existing CSS landmine: a dangling `.btn-secondary.is-active,` selector was applying the fixed-positioning block of `.play-controls-bar` to any active secondary button.
- 2026-10-20 — Two late additions while reviewing the flow:
  1. **The address bar now tracks the loaded course.** Opening a shared `?course=` link and then picking a campaign level used to leave the params in the URL, so an F5 dropped the player back into the old random course. `syncCourseParamsToUrl()` writes the params for random runs, strips them for campaign runs, preserves unrelated params (`unlockAll`), and uses `replaceState`.
  2. **Landscape action order.** The three-column form is still a few pixels taller than 390 px, so in the landscape-short block the action row is ordered before the metrics line. `Generate & Play` stays above the fold; the status line remains directly below it.
  Also corrected the docs claim that the generator stores a per-segment `heading` — it does not. The honest statement is that the layout is an ordered run of decks with known `z` ranges, which is what makes a later bend pass possible.
- 2026-10-20 — **Review pass** (re-read every changed file instead of re-summarising). Five real defects found and fixed:
  1. **The palette reseeded the layout.** `optionsKey()` included `palette`, and that key is the RNG seed, so picking a colour handed the player a different course (111 m vs 103 m) under a new `rnd_<id>` — contradicting README and DESIGN, and detaching any recorded best time. Palette removed from the key; the fuzz now asserts that geometry, obstacle ids and the course id are identical across palettes while colours still change.
  2. **Checkpoints could land 1 m from a hazard.** A long sweeper/gate deck holds two threshold crossings; the second arch went to `zMax − 7` while content starts at `zMax − 6`, dropping the respawn point next to a spinning bar and growing its pillars through a gate wall. Hazard decks now accept one arch; empty decks still take up to three. Verified by disabling the cap and watching the new fuzz assertion fail on 10 courses, then restoring it.
  3. **Clearing the seed left the form stuck.** `blur` restored the canonical seed but never re-ran the preview, so the field showed a valid seed while `Generate & Play` stayed disabled with the error text still on screen.
  4. **`L` opened Course Select behind the victory dialog**, moving focus into a panel the player could not see. Guarded while the victory modal is open.
  5. **`decodeOptions` returned default options on a parse error** instead of `null`, which would have silently loaded a random course. Now returns `null`.
  Also removed the unused `addTail()`, and corrected a comment that claimed an in-band attempt "prefers the midpoint" — the first in-band attempt wins; the midpoint only ranks fallbacks.
  Re-verified: fuzz 6000/6000 clean (avg 7.2 attempts, max 79) with 0 palette, 0 checkpoint-count and 0 checkpoint-clearance failures; `validate-levels.mjs` exit 0; `npm run build` exit 0.

## Notes

### Why straight-only in v1

The validator is a 1-D model: `checkTransition` compares `from.exit - to.entry` in `z` and heights, and `deckAt` anchors by `z` range. Curved tracks would require rewriting both. A rigid per-segment rotation would preserve distances, so the existing validator could still prove crossability *before* bending — but the camera, input mapping, trigger volumes and occlusion fade all assume a world aligned to `−Z`.

Deferring curvature isolates the one part that needs a human on a device from the part that can be proven offline.

### Why the generator is data-only

`LevelGenerator.js` imports nothing from Three.js. That keeps generation under a few milliseconds, allows the metrics preview to run on every option change, and lets `fuzz-generator.mjs` run in Node without a DOM.

### Deviations from the original sketch

- `CoursePath` was proposed for v1 so v1.1 would be cheap. Dropped: a polyline projector that only ever sees a straight line is untested code, and the migration is small enough to do later while testing real curves.
- Checkpoint option is `Minimal / Normal / Generous`, not `None`. The validator hard-requires at least one checkpoint (`no checkpoint in course`); loosening that rule to serve a UI toggle would be the wrong trade.
