# Seeded Random Course Generator in Course Select

- **Date**: 2026-10-20 11:54:59 +07:00
- **Plan**: [`plans/2026-10-19-random-course-generator.md`](../../plans/2026-10-19-random-course-generator.md)

## Task

Add a player-facing random course generator: six customisation controls inside Course Select, deterministic courses from a text seed, a shareable URL, and best times that never contaminate campaign progression.

## Problem

Three constraints shaped the work more than the feature request did:

1. **The validator was a script, not a module.** `scripts/validate-levels.mjs` held the only proof that a course is completable. A browser generator cannot spawn Node, so the proof had to become shared code before generation could be trusted.
2. **A generated course can silently be unfair.** Retrying until it "looks fine" produces courses that pass the eye and fail the movement envelope. Every generated course now goes through the same `validateLevel()` the campaign does, and a generator that cannot satisfy it returns `null` rather than an unvalidated course.
3. **Regeneration exposes a leak.** `removeObstacle()` and `rebuildObstacle()` removed meshes from the scene but never disposed geometry, materials or textures. Loading ten levels in a session was tolerable; pressing Generate repetitively is not.

## Changes

**Shared core (`src/core/`)**

- `LevelValidator.js` — the validation core extracted from the CLI. Returns `{ problems, warnings, metrics }`. Module-level `fail`/`warn` arrays became per-level closures, and a rotation guard reports one clear problem instead of cascading "not anchored" errors. The CLI is now a thin wrapper.
- `Rng.js` — `hashString` (xmur3), `mulberry32`, and a small `Rng` with `next/range/int/chance/pick/weighted/shuffle`, plus `hashId`.
- `CourseOptions.js` — the six-option schema, tolerant `normalizeOptions`, URL codec (`encodeOptions`/`decodeOptions`), `optionsKey`, readable seed names, and the measured density bands.
- `LevelGenerator.js` — data-only course builder. Imports nothing from Three.js, so the 120 ms preview and the Node fuzz both run it directly.

**Game (`src/main.js`)**

- `this.levelIndex` became `this.currentCourse = { kind, level, index?, options?, id?, metrics? }`; `currentLevel` is now a getter over it, so campaign code kept working unchanged.
- `loadLevel()` split into `loadCampaignLevel()` and `loadRandomCourse()`, with `applyCourse()` holding the shared lifecycle.
- `loadStartingCourse()` resolves `?course=` and falls back to the campaign, with a toast, if a link cannot generate.
- `handleRaceVictory()` split: campaign path unchanged (now reading `course.index`), random path records into `jellometry_random_bests_v1` and offers **New Seed** instead of **Next Course**.
- Escape is handled before the typing guard, so the seed input cannot trap the player in the dialog.
- The Enter-on-victory handler used to synthesise a click even when the focused button already activates natively; it now defers to the focused button.

**UI (`index.html`, `src/style.css`)**

- `#level-modal` is a `role="tablist"` with **Campaign** and **Random** panels, arrow/Home/End navigation and roving `tabindex`.
- The form uses segmented `role="radio"` button groups with roving tabindex; hazards are `aria-pressed` toggles because they are multi-select.
- Live preview is a `role="status"` region, debounced 120 ms, reporting the **built** course (length, hazard counts, measured threat/m) rather than the request.
- Landscape-short (`orientation: landscape and max-height: 560px`) reflows to three columns; portrait and the 540 px breakpoint fall back to one column.

**Disposal (`src/entities/ObstacleFactory.js`, `src/core/ProceduralTextures.js`)**

- `disposeGroup()` walks geometry, materials and texture slots.
- Cached textures are tracked in a `WeakSet` (`ProceduralTextures.isShared()` / `remember()`), not tagged with `userData.shared`.

## Decisions

- **Difficulty is threat *per metre*, not absolute threat.** An absolute band is unreachable for a short course; a 65 m course cannot score 14. Bands are laid over the campaign's own `0.053–0.138 /m` spread and deliberately overlap, because hazard counts are integers.
- **`FAMILY_CEILING.pads` lowered from 0.083 to 0.060.** The old figure was measured with all hazards on. A pads-only sweep tops out at `0.0613`, so the UI was promising Normal on pads alone and failing to deliver. The fuzz caught it.
- **Straight-only in v1, but bend-ready layout.** Every obstacle sits at `x = 0` with monotonic `z`. The builder keeps an ordered run of decks with known `z` ranges and top heights, which is enough to re-project the whole layout through a heading curve later. Curvature is deferred because the validator is 1-D (projects onto `z`) and would need an arc-length rewrite before a curved course could be proven at all.
- **Checkpoints ride on hazard decks, never dedicated rest decks.** A rest deck costs 8–11 m of zero-threat runway, which caps achievable density on a short course. This matches the campaign's own convention.
- **Pad hops are assists, not gates.** The gap is sized from a plain jump so the deck edge always clears it; the pad (3 m before the edge) is a shortcut. Sizing the gap from the pad's own reach made the course depend on hitting the pad perfectly.
- **Separate storage key, LRU 50.** `jellometry_random_bests_v1` keeps campaign code from ever having to distinguish generated ids, and a random record falling out of the cap cannot look like a deleted campaign best.
- **Segmented buttons, not `<select>`.** Native selects open a modal sheet on mobile that hides the live preview, and turn one tap into two.
- **WeakSet, not `userData.shared`.** `Texture.clone()` copies `userData`, so the marker would spread to every per-obstacle clone and skip disposing them.
- **The palette is excluded from `optionsKey`.** That key is both the RNG seed and the course id, so including a cosmetic option reseeded the layout; two links that differ only in palette must resolve to the same course and the same best-time slot.

## Assumptions & Risks

- **Disposal correctness is browser-only.** No build or Node check can see a black mesh. The Node smoke test proves the calls do not throw and the shared/clone split is exercised, but not that the rendered result is right.
- **The form's 844×390 landscape fit is reasoned, not observed.** Three-column reflow plus backdrop scrolling should keep it to one scroll container; nobody has looked at it.
- **The bands describe what the generator builds, not how hard it feels.** They are derived from `threat()`, which is itself a design model.
- **`threat()` under-weights pads.** At `0.25` each they are almost free, so a pads-only course is legitimately Chill. That is now stated in the UI instead of hidden.
- **Seed names collide eventually.** Two different seeds never produce the same course, but a 40-char cap means long text seeds are truncated to the same 40 characters. Documented behaviour of `normalizeOptions`, not a bug, but worth remembering before treating seeds as unique identities.

## Review Pass

A second read of every changed file (not a re-summary) found five defects that the first pass missed:

1. **The palette changed the layout.** `optionsKey()` included `palette`, and that key seeds the RNG, so choosing a colour produced a different course (`111 m` vs `103 m`) with a new `rnd_<id>`. Removed from the key; the fuzz now asserts identical geometry, obstacle ids and course id across palettes while colours still differ.
2. **Checkpoints could spawn next to a hazard.** A 25–35 m sweeper/gate deck can cross two checkpoint thresholds; the second arch went to `zMax − 7` while content starts at `zMax − 6`. Hazard decks now accept one arch, empty decks still take three. Proven by disabling the cap: the new clearance assertion failed on 10 of 720 probe courses, exactly 1.0 m from a hazard.
3. **Clearing the seed left the form stuck.** `blur` restored the canonical seed but never re-ran the preview, leaving `Generate & Play` disabled with the error text still visible.
4. **`L` opened Course Select behind the victory dialog**, sending focus into a panel the player could not see.
5. **`decodeOptions` returned defaults instead of `null` on a parse error**, which would have silently loaded a random course.

Also removed the dead `addTail()`, and corrected a comment claiming an in-band attempt "prefers the midpoint" — the first in-band attempt wins and the midpoint only ranks fallbacks.

## Verification

- `node scripts/fuzz-generator.mjs --seeds 500` — **6000/6000 courses clean**: 0 invalid, 0 out-of-band, 0 out-of-budget, 0 warnings-over-2, 0 null, 0 hazard-toggle failures, 0 checkpoint-count failures, 0 palette failures, 0 checkpoint-clearance failures. Avg 7.2 attempts, max 79. Band means: Chill `0.0565`, Normal `0.0752`, Spicy `0.0973`, Brutal `0.1171`.
- `node scripts/validate-levels.mjs` — exit 0, output unchanged from before the refactor (same 3 intentional overshoot warnings).
- `npm run build` — exit 0.
- Every `$('id')` in `main.js` resolves to an element in `index.html` (57 references, 0 missing).
- **Extra, beyond the plan:** 100 generated courses (25 seeds × 4 difficulties) built through the real `ObstacleFactory` with a stubbed canvas/2D context — 1351 obstacles, 0 failures, including a `rebuildObstacle()` round-trip and `clearAll()` disposal.
- Not verified: anything requiring a browser (layout at 844×390, touch targets, texture disposal appearance, camera feel).

## Files

- `src/core/LevelValidator.js`, `src/core/Rng.js`, `src/core/CourseOptions.js`, `src/core/LevelGenerator.js` — new.
- `src/core/ProceduralTextures.js` — `remember()` / `isShared()` WeakSet.
- `src/entities/ObstacleFactory.js` — `TEXTURE_SLOTS`, `disposeGroup()`, disposal in `removeObstacle()` / `rebuildObstacle()`.
- `src/main.js` — course lifecycle, random panel, tabs, random bests, victory split.
- `index.html` — tablist + random form + **New Seed** button.
- `src/style.css` — tabs, segmented controls, form, metrics, responsive rules; removed a dangling `.btn-secondary.is-active,` selector that was applying fixed positioning to active secondary buttons.
- `scripts/fuzz-generator.mjs` — new fuzz harness.
- `README.md`, `DESIGN.md` — random-course sections.
- `plans/2026-10-19-random-course-generator.md` — plan of record.

## Commit

`feat(jellometry): add seeded random course generator with shareable URLs`
