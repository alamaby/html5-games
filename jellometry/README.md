# Jellometry

**A 3D jelly obstacle race. You are a cube of gelatin that can be squashed flat or stretched tall — and the track is built to punish whichever shape you picked.**

Ten hand-authored courses, six obstacle types, a morph mechanic that changes your collision box every frame, and no assets to download.

[**Play it →**](https://alamaby.github.io/html5-games/jellometry/)

![Three.js](https://img.shields.io/badge/Three.js-r170-000000?logo=three.js&logoColor=white)
![cannon-es](https://img.shields.io/badge/cannon--es-0.20-1e2432)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![No build step](https://img.shields.io/badge/runs%20from%20source-no%20build%20step-2ec4b6)
![Zero assets](https://img.shields.io/badge/external%20assets-zero-ff9f1c)

<!--
  Screenshots: drop PNGs into ./docs/ using the names below, then delete the
  surrounding comment markers. 1280x720 works well.

<p align="center">
  <img src="./docs/screenshot-gameplay.png" width="49%" alt="Gameplay: the jelly crossing a track with a rotating sweeper bar ahead">
  <img src="./docs/screenshot-morph.png" width="49%" alt="Morph comparison: flat jelly fits the wide gate, tall jelly fits the narrow gate">
</p>
<p align="center">
  <img src="./docs/screenshot-courses.png" width="70%" alt="Course Select: ten cards showing difficulty stars, best times and lock state">
</p>
-->

---

## Table of contents

- [What this is](#what-this-is)
- [Features](#features)
- [The morph mechanic](#the-morph-mechanic)
- [Controls](#controls)
- [The ten courses](#the-ten-courses)
- [Random courses](#random-courses)
- [Obstacle vocabulary](#obstacle-vocabulary)
- [Progression and saved data](#progression-and-saved-data)
- [Getting started](#getting-started)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Technical notes](#technical-notes)
- [Authoring a course](#authoring-a-course)
- [Known limitations](#known-limitations)
- [License](#license)

---

## What this is

Jellometry is a browser platformer built with **Three.js** for rendering and **cannon-es** for rigid-body physics. You control a single gelatin body down a linear course, past rotating sweeper bars, over moving bridges, and through shape gates that only accept one silhouette.

The hook is that the jelly has a **fixed volume**. Squashing it flat makes it wide and low; stretching it tall makes it narrow and high. Gates are cut to match exactly one of those shapes, so a course is as much a reading test as a timing test — you have to spot the gate's silhouette and commit to the matching morph *before* you reach it.

Everything is generated at runtime: textures are drawn to canvases, sound is synthesised with the Web Audio API, and the only network requests are the two CDN modules listed in the import map. There is not a single `.png`, `.mp3`, or `.glb` in the repository.

## Features

- **10 distinct courses**, unlocked in order, each with a one-line objective and a 1–5 star difficulty rating.
- **Volume-preserving morph** across a continuous range, not three fixed states — the slider is analogue, the keyboard/touch presets are shortcuts.
- **Six obstacle types** composed into ten layouts: track blocks (including ramps), spinning sweepers, moving platforms on three axes, slime bounce pads, shape gates, and checkpoint/finish arches.
- **Checkpoint respawn** — falling off sends you back to the last arch you touched, not to the start.
- **Seeded random courses** — a six-control generator in Course Select that builds a validated course from a text seed, and a shareable link that reproduces it exactly.
- **Per-course personal bests** with a "new record" badge on the victory screen.
- **Mobile-first input** — a floating thumbstick that recentres onto your thumb, and a morph/JUMP cluster sized for a right thumb. Desktop gets keyboard and mouse wheel.
- **Runs from source.** No bundler required for the live demo; `vite build` is optional.
- **Offline level validator** that proves every course is completable within the player's actual movement envelope.

## The morph mechanic

The jelly's dimensions are derived from a single morph value `m ∈ [-1, 1]`, with the base size `1.2 m` and the volume held at exactly **1.728 m³**:

```
width  = 1.2 × 2^(−0.95 · m)
height = 1.2 × 2^( 0.90 · m)
depth  = 1.728 / (width × height)
```

Because width and height use slightly different exponents, the box does not merely rotate its aspect ratio — the depth changes too, which is what keeps the volume exact while the silhouette morphs.

| Morph value | Profile | Width | Height | Fits `flat_wide` (3.2 × 0.9) | Fits `tall_narrow` (0.9 × 2.65) |
|---|---|---|---|---|---|
| `m = −1` | **Flat-Wide** | 2.32 m | 0.64 m | ✅ | ❌ |
| `m = 0` | **Balanced Cube** | 1.20 m | 1.20 m | ❌ (too tall) | ❌ (too wide) |
| `m = +1` | **Tall-Narrow** | 0.62 m | 2.24 m | ❌ | ✅ |

The cube in the middle is deliberately useless at gates. It is the safe shape for movement and the wrong shape for every cutout, so gate sections force an active decision instead of letting you coast through in the default state.

The collision box is resynchronised from these dimensions on every physics step, so the shape you see is the shape that collides — there is no separate "visual only" morph.

### A note on duck-under bars

Three courses use sweepers with a raised bar (`barHeight: 1.05`). The bar occupies a band from **0.77 m to 1.33 m** above the deck. The flat morph at 0.64 m passes underneath it. A jump also clears it, since the apex is 3.31 m — so this is a hazard with two valid solutions, not a hard gate. The validator only asserts that the flat morph fits.

## Controls

### Desktop

| Input | Action |
|---|---|
| `W` `A` `S` `D` / arrow keys | Move |
| `Space` | Jump |
| `Q` / `E` | Morph toward flat / tall (held) |
| Mouse wheel over the viewport | Morph continuously |
| `R` | Respawn at the last checkpoint |
| `L` | Open / close Course Select |
| `M` | Mute |
| `Esc` | Close the open dialog |

### Touch

| Input | Action |
|---|---|
| Drag anywhere in the thumbstick zone | Steer. If your thumb lands away from the ring, the ring moves to your thumb instead. |
| **JUMP** | Jump |
| **FLAT** / **CUBE** / **TALL** | Snap to a preset morph |
| **RESET** | Respawn at the last checkpoint |

RESET is placed in the *morph* row, above and to the left of JUMP, and styled as a quiet dashed outline — it is deliberately hard to hit by accident.

## The ten courses

Every course is authored in [`src/entities/PresetLevels.js`](src/entities/PresetLevels.js). The `threat` column is the output of the offline difficulty model described in [Authoring a course](#authoring-a-course); `step` is the ratio against the previous course.

| # | Course | `id` | ★ | Length | Sweepers | Platforms | Gates | Pads | Threat | Step |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Jelly Sprout | `beginner_bounce` | ★☆☆☆☆ | 65 m | 1 | 0 | 2 | 1 | 3.47 | — |
| 02 | Warm-Up Weave | `warmup_weave` | ★☆☆☆☆ | 78 m | 1 | 0 | 2 | 1 | 4.22 | 1.216× |
| 03 | Ripple Rhythm | `ripple_rhythm` | ★★☆☆☆ | 77 m | 2 | 0 | 2 | 1 | 5.11 | 1.211× |
| 04 | Squeeze Corridor | `squeeze_corridor` | ★★☆☆☆ | 66 m | 1 | 0 | 3 | 0 | 5.36 | 1.049× |
| 05 | Step It Up | `step_it_up` | ★★★☆☆ | 84 m | 2 | 1 | 2 | 0 | 7.17 | 1.338× |
| 06 | Morph Madness | `morph_madness` | ★★★☆☆ | 76 m | 2 | 1 | 3 | 1 | 9.02 | 1.258× |
| 07 | Slime Cathedral | `slime_cathedral` | ★★★★☆ | 97 m | 3 | 0 | 1 | 2 | 12.53 | 1.389× |
| 08 | Sky Bridges | `sky_bridges` | ★★★★☆ | 109 m | 3 | 3 | 1 | 1 | 13.96 | 1.114× |
| 09 | Vertigo Spiral | `vertigo_spiral` | ★★★★★ | 126 m | 5 | 1 | 1 | 0 | 15.44 | 1.106× |
| 10 | Final Gel Gauntlet | `final_gauntlet` | ★★★★★ | 146 m | 4 | 2 | 3 | 2 | 20.13 | 1.304× |

What each course is actually testing:

| # | Course | Idea |
|---|---|---|
| 01 | Jelly Sprout | Tutorial. One slow bar, two gates, one pad. Teaches that morph changes your silhouette. |
| 02 | Warm-Up Weave | First ramp and first real gap. Forced alternation between the two gate shapes. |
| 03 | Ripple Rhythm | Two bars counter-rotate, so the safe window moves. Teaches reading a rhythm instead of sprinting. |
| 04 | Squeeze Corridor | Three gates spaced 8 m apart — under a second between each at full speed. Pure morph rhythm. |
| 05 | Step It Up | Vertical staircase ending in a lift that carries you to the top deck. |
| 06 | Morph Madness | Gate, gate, pad, then hazards — the first course that asks for a mid-air morph. |
| 07 | Slime Cathedral | Two chained pad launches to a high hall, then duck-under bars. |
| 08 | Sky Bridges | Three moving platforms on the X, Z and Y axes over open air. |
| 09 | Vertigo Spiral | 20 m ramp, a timed lift, then long sweeper arms that swing clear off a narrow ledge. |
| 10 | Final Gel Gauntlet | Every hazard in the game, at full strength, in one 146 m run. |

Course 1 and course 6 keep the `beginner_bounce` and `morph_madness` ids from the two-course version of the game, so existing personal bests still resolve.

## Random courses

Course Select has two tabs: **Campaign** and **Random**. The Random tab builds a fresh course from six controls and plays it immediately. It uses the same six obstacle types as the campaign — the difference is that [`src/core/LevelGenerator.js`](src/core/LevelGenerator.js) assembles them from a seed instead of a human writing them down.

| Control | Options | What it actually does |
|---|---|---|
| **Seed** | free text, or 🎲 | The seed *becomes* the course name (`misty-otter-42` → *Misty Otter 42*). Same seed plus same settings produces the same course on any device, so a seed is a share code. |
| **Difficulty** | Chill / Normal / Spicy / Brutal | Sets a target **threat per metre**, not an absolute threat score, so a 65 m course is judged on the same scale as a 150 m one. |
| **Length** | Short 65–85 m / Medium 95–115 m / Long 125–150 m | A budget. The finished course lands wherever the layout ends, typically inside the range. |
| **Checkpoints** | Minimal / Normal / Generous → 1 / 2 / 3 | Never zero: the validator requires at least one, so the option cannot produce an unfair course. |
| **Hazards** | Sweepers / Gates / Bridges / Pads | Any combination. Families the target difficulty cannot reach are marked before you press play. |
| **Palette** | four schemes | Recolours decks and gate trims. It never changes layout, so a palette swap cannot invalidate a best time. |

A preview line under the controls reports the real length, hazard counts and measured threat density. It turns amber when the requested difficulty sits outside what the selected hazards can reach, or when even the closest course misses the band.

### Sharing a course

`Copy Link` copies a URL like:

```
?course=misty-otter-42&diff=2&len=1&haz=1111&cp=1&pal=0
```

`course` is the seed; `diff`, `len`, `cp` and `pal` are indices into the option tables; `haz` is a four-bit mask in sweepers/gates/bridges/pads order. Opening that link loads the identical course. Unknown or partial values fall back to defaults rather than failing, so a hand-edited URL still opens something playable.

The address bar is kept in step with whatever is loaded: generating a course writes those six params, and switching to a campaign level removes them. Unrelated params such as `unlockAll=1` are preserved, and `replaceState` is used so the back button never walks through old seeds.

### Why difficulty is a band, not a slider

The campaign's own density runs from `0.053` to `0.138` threat per metre. Random difficulties are bands laid over that same measured range:

| Difficulty | Target density | Reached by |
|---|---|---|
| Chill | `0.044–0.070 /m` | Any family. |
| Normal | `0.064–0.099 /m` | Sweepers, gates or bridges; pads alone top out too low. |
| Spicy | `0.088–0.122 /m` | Sweepers, bridges at high counts. |
| Brutal | `0.106–0.156 /m` | Sweepers, effectively mandatory. |

The bands overlap on purpose: hazard counts are integers, so the gap between "one more sweeper" and "one fewer" can be wider than a band.

Per-family ceilings are **measured** by seed sweep, not assumed:

| Family | Sustained max density |
|---|---|
| Sweepers | `~0.148 /m` |
| Bridges | `~0.090 /m` |
| Gates | `~0.079 /m` |
| Pads | `~0.060 /m` |

A pad costs 30–40 m of deck for `0.25` threat, so pads-only is legitimately a Chill experience. The UI says so instead of quietly generating a course that misses the band.

### How an attempt is built

1. Plan a hazard sequence from the target length and difficulty, then add ~22% filler segments so the rhythm is not metronomic.
2. Build decks, hazards, checkpoints and the finish, tracking the running course length.
3. Validate the result with the **same** `validateLevel()` the campaign uses.
4. Accept only if there are zero hard problems, at most two warnings, and the measured density lands in the requested band.

A course gets up to 120 attempts. Each attempt is seeded from `hash(optionsKey + ':' + attempt)` and sweeps hazard density, so a retry searches the budget instead of only rolling the dice again. The first attempt that validates **and** lands in the band wins. If none lands in the band, the closest valid course is returned and the preview says so; only a run where nothing validates returns `null`, which disables the button — it never falls back to an unvalidated course.

### What random mode never does

- It never writes to `jellometry_progress_v1`.
- It never unlocks a campaign course.
- The victory screen offers **New Seed**, not **Next Course**.
- Best times live under a separate key and are capped (see [Progression and saved data](#progression-and-saved-data)).

Checkpoints and the finish ride on ordinary hazard decks rather than dedicated rest decks. A rest deck would cost 8–11 m of zero-threat runway, which caps how dense a short course can be.

### v1 is straight-only

Random courses always run toward −Z with every obstacle at `x = 0`. Turning is designed for but deliberately not shipped:

- Curved tracks are not shipped, but the layout is expressed as an ordered run of decks along −Z where each deck knows its `z` range and top height. That is enough to re-project the whole layout through a heading curve later, so bending can be a post-process rather than a rewrite.
- The validator is one-dimensional — it projects onto `z` and ignores `x` entirely. A curved course could not be validated until that is rewritten to work in arc length.

Shipping turning now would mean both untested code and unverifiable courses in one change. Splitting them keeps every generated course provable.

### Checking the generator

```bash
node scripts/fuzz-generator.mjs --seeds 500
```

This runs 500 seeds × 4 difficulties × 3 lengths, builds every course, and pushes it through the validator. The run fails on any invalid course, missing band, over-budget length, unbuildable settings, broken hazard toggle, or wrong checkpoint count. It also tests the reachability claims: if the UI says Brutal is reachable with gates only, the fuzz has to actually reach that band. Two further assertions guard behaviour the validator cannot see: a palette swap must leave geometry and the course id untouched (only colours may change), and no checkpoint arch may sit within 2.9 m of a sweeper or gate.

## Obstacle vocabulary

All ten courses are built from six types. No new obstacle code was added for the campaign — the later courses simply switch on parameters the original two courses never used.

| Type | What it does | Parameters |
|---|---|---|
| `track_block` | The floor. Optionally a ramp. | `width`, `length`, `height`, `slopeAngle` (0–6°) |
| `spinning_sweeper` | Rotating knockback bar. | `armLength`, `speed` (negative reverses), `barHeight` |
| `moving_platform` | Oscillating bridge. | `width`, `length`, `axis` (`x` / `y` / `z`), `distance`, `speed` |
| `bouncy_pad` | High-restitution launch pad. | `width`, `length`, `bounceForce` |
| `shape_gate` | Wall with a morph-shaped cutout. | `cutoutShape` (`flat_wide` / `tall_narrow`), `wallWidth`, `wallHeight` |
| `checkpoint_finish` | Respawn arch or finish line. | `variant` (`checkpoint` / `finish`), `width` |

Gate walls are always at least 4.0 m proud of the deck, above the 3.31 m jump apex, and never wider than the deck they sit on — so a gate cannot be jumped over or walked around. The validator enforces both.

## Progression and saved data

Three `localStorage` keys, all versioned by suffix:

| Key | Contents |
|---|---|
| `jellometry_best_times_v1` | Map of course `id` → best time in seconds. Unchanged since the two-course version. |
| `jellometry_progress_v1` | `{ version: 1, unlocked, lastPlayed }` |
| `jellometry_random_bests_v1` | Map of generated course `id` (`rnd_<8hex>`) → `{ time, name, options, at }`. |

Random bests are capped at **50 entries**; when the cap is hit, the least recently recorded entry is evicted first. Keeping them in their own key means a generated course falling out of that cap can never look like a deleted campaign record — and campaign code never has to distinguish the two.

On first load with no progress key, the game **migrates** from the best-times map: a recorded time on course *N* implies course *N + 1* was already reachable, so a returning player keeps their unlocked range.

Clearing a campaign course unlocks the next one and records the time if it beats the previous best. Clearing a random course records a time only in `jellometry_random_bests_v1` and leaves progression untouched. All storage access is wrapped in `try`/`catch` — in private browsing the game degrades to session-only progress rather than throwing.

### Unlocking everything for testing

```
?unlockAll=1
```

This is a **non-destructive in-memory override**. It never writes to storage, so removing the query string restores your real progression.

## Getting started

### Requirements

- A browser with WebGL2 and ES module support (any current Chrome, Safari, Firefox, Edge).
- Node.js 18+ and npm — **only** if you want the dev server or a production bundle.

### Run from source, no build step

The entry point loads `./src/main.js` directly, and `three` / `cannon-es` come from jsDelivr via an import map. Any static file server works:

```bash
npx serve .              # http://localhost:3000
# or
python3 -m http.server 8000   # http://localhost:8000
```

Then open the URL the server prints and navigate to `jellometry/` if you started
from the repository root.

> Opening `index.html` via `file://` will not work — ES modules and import maps require an HTTP origin.

### Run with the Vite dev server

```bash
npm install
npm run dev
```

Serves on `http://localhost:5173` with hot module replacement.

### Production bundle

```bash
npm run build     # → dist/
npm run preview   # serve dist/ locally
```

`base` is set to `'./'` in `vite.config.js`, so the bundle works from any subpath.

## Deployment

The live demo is served by **GitHub Pages from the repository root**, using the buildless path — no CI, no build step, no `gh-pages` branch. Pushing to `main` publishes it.

Two things make that work:

1. `index.html` references `./src/main.js` with a relative path, so the app resolves correctly under `/html5-games/jellometry/`.
2. `three` and `cannon-es` are resolved by the browser's import map to absolute CDN URLs, so no bundling is required.

If you would rather deploy a bundle, run `npm run build` and publish `dist/` instead. `dist/` is gitignored, so it is never committed to this repository.

## Project structure

```
jellometry/
├── index.html                  Markup, import map, canvas, HUD, dialogs
├── vite.config.js              Optional bundling; base './' for subpath hosting
├── package.json
│
├── src/
│   ├── main.js                 Game class: viewport, input, HUD, campaign, progression
│   ├── style.css               Layout, mobile breakpoints, coarse-pointer overrides
│   │
│   ├── core/
│   │   ├── PhysicsWorld.js     cannon-es world, gravity, contact materials, preStep dispatch
│   │   ├── ParticleSystem.js   Splash / confetti droplets
│   │   ├── ProceduralTextures.js  Canvas-generated track, slime, hazard and checkered textures
│   │   ├── Rng.js              Seeded PRNG (xmur3 + mulberry32) and stable id hashing
│   │   ├── CourseOptions.js    Random-course options, URL codec, measured density bands
│   │   ├── LevelValidator.js   Shared validator — no Three.js, runs in Node
│   │   └── LevelGenerator.js   Seeded random-course builder
│   │
│   ├── entities/
│   │   ├── JellyPlayer.js      Morph maths, soft-body deformation, movement, jump latch
│   │   ├── ObstacleFactory.js  Builds meshes + rigid bodies for the six obstacle types
│   │   └── PresetLevels.js     The ten courses (data only)
│   │
│   ├── audio/
│   │   └── SoundManager.js     Web Audio synthesis — no audio files
│   │
│   └── editor/
│       └── LevelEditor.js      Dead code. See Known limitations.
│
├── scripts/
│   ├── validate-levels.mjs     Offline reachability + difficulty-curve validator
│   ├── fuzz-generator.mjs      Random-course fuzz harness (6000 courses by default)
│   └── strip-dead-css.mjs      One-off: removed the editor's CSS rules
│
├── plans/                      Design and implementation plans
├── .memory/                    Project memory index and dated entries
└── DESIGN.md                   Visual and component design direction
```

## Technical notes

A few decisions that are load-bearing rather than incidental.

**Physics constants.** Gravity is `−24 m/s²` (steeper than real gravity, to keep jump arcs crisp), jump impulse is `12.6 m/s`, and horizontal top speed is `10.8 m/s` with acceleration of `14.0 m/s²` grounded and `7.5 m/s²` airborne. That yields a jump apex of **3.31 m** and a flat-ground reach of about **11.4 m** — the numbers every course is designed against.

**Canvas sizing.** The renderer is sized from `canvas.clientWidth` / `clientHeight` and calls `setSize(w, h, false)`. It must never read `window.innerHeight`: on iOS that value disagrees with the visual viewport once the browser toolbar collapses, and `setSize` would write an inline style that beats the CSS box and overflows the page.

**Real frame delta to obstacle animation.** Sweepers and platforms are advanced inside the physics `preStep` callback. That callback receives the actual clamped frame delta, not a hardcoded `1/60`. Passing `1/60` made hazards run at double speed on 120 Hz phones.

**Jump latching.** Touch events fire far more often than the fixed 60 Hz physics step, so a tap could land entirely between two substeps and be dropped. `JellyPlayer.queueJump()` latches the intent for 150 ms.

**HUD throttling.** The HUD updates at 16 Hz with per-field change detection instead of every frame — DOM writes were competing with the render loop on low-end phones. An adaptive-quality guard drops pixel ratio (and desktop shadows) once if the rolling average frame time stays above 22 ms.

**Touch-action scoping.** `#app` keeps `touch-action: manipulation` so dialogs can scroll; only the canvas, the thumbstick zone and its base opt out with `touch-action: none`. A global `none` would make any scrollable overlay dead on a phone.

**No external assets.** Textures are drawn with Canvas 2D (`ProceduralTextures`), and every sound is synthesised from oscillators and noise buffers (`SoundManager`). The game has no preload step and no asset pipeline.

## Authoring a course

Courses live in `src/entities/PresetLevels.js` as plain data:

```js
{
  id: 'my_course',
  name: 'My Course',
  difficulty: 3,                 // 1–5 stars
  objective: 'One line shown in the briefing card.',
  description: 'Internal note.',
  spawnPoint: [0, 2.2, 0],
  obstacles: [
    { id: 'k1', type: 'track_block', position: [0, 0, -5], params: { /* … */ } }
  ]
}
```

### Geometry conventions

These are enforced by the validator, so author against them:

- A `track_block` spans `z − length/2` to `z + length/2`. Its walkable surface is `position.y + height/2` (with `height: 0.8`, the top is `y + 0.4`).
- Sweepers, pads and checkpoint arches are positioned at the **receiving deck's top**, not at the deck's centre.
- A sweeper bar collides inside a band of `deckTop + barHeight ± 0.28`.
- Ramps pivot at their centre, so a ramp's `y` is `prevTop − height/2 + (length/2)·sin(slopeAngle)`. Keep slopes at or below 6°.
- Gate `wallHeight` must be at least `3.4 m` — the validator's hard floor, just above the 3.31 m jump apex. The shipped courses use 4.0–4.4 m for margin. `wallWidth` must not exceed the deck width, or the gate can be walked around.

### Validate before shipping

```bash
node scripts/validate-levels.mjs
```

The script is dependency-free and exits non-zero on any hard failure. It checks:

- every obstacle is anchored on a deck;
- every gap is crossable from a standing jump or a pad launch, computed from the real movement envelope;
- moving platforms are boardable and their exit height is reachable;
- ramps join the decks before and after them;
- gates cannot be jumped over or walked around;
- each course has exactly one finish arch and at least one checkpoint;
- the difficulty curve is strictly increasing, with each step inside `1.03×`–`1.40×`.

It also prints a table of the whole campaign, which is where the numbers in [The ten courses](#the-ten-courses) come from.

### On the difficulty model

`threat()` is a weighted score: timing hazards dominate, moving platforms are fall risk, gates are a cheap knowledge test, and narrow decks, wide gaps and tall steps add precision cost. The weights are **a design aid, not ground truth** — they encode intent, and the only thing the validator can actually prove is that the curve is monotone and bounded.

The `1.40×` ceiling exists because a single hazard is worth 1.2–2.2 points. With a tutorial baseline near 3.5, adding one element is unavoidably a 25–35% step; padding the tutorial with extra hazards just to flatten the ratio would make the first course worse to play.

## Known limitations

- **The campaign has not been playtested by a human yet.** Every course passes geometric validation, but the difficulty weights are estimates. Expect one calibration pass after real play.
- **Random courses are straight-only.** Turning is designed for but deferred: the layout is a run of decks with known `z` ranges, so a heading curve can be applied as a post-process — but the validator would need an arc-length rewrite before a curved course could be proven. See [v1 is straight-only](#v1-is-straight-only).
- **Random difficulty bands are measured, not playtested.** The bands come from the campaign's own threat density plus a seed sweep per hazard family. They describe what the generator *builds*, not how hard it *feels*.
- **Mobile layout has not been verified on a physical device.** Portrait and landscape breakpoints, notch insets, dialog scrolling and 120 Hz timing were reasoned from source, not observed on hardware. If you have a phone handy, that is the most useful thing you could test.
- **No automated browser tests.** There is no CI. The three machine checks are `npm run build`, `node scripts/validate-levels.mjs` and `node scripts/fuzz-generator.mjs`.
- **`src/editor/LevelEditor.js` is dead code.** The 3D level builder was removed from the game, but the class is still on disk. It is not imported anywhere, so it is tree-shaken out of the bundle. Deleting it is an open call.
- **Three validator warnings are intentional.** They flag jumps where a full-sprint landing would overshoot the far edge — speed control is part of those challenges, and the warnings exist to show where that demand sits.
- **No lives, no game over.** Falling respawns you at the last checkpoint and keeps the timer running. The game is a time trial, not a survival test.

## License

MIT, matching the rest of the [html5-games](https://github.com/alamaby/html5-games) repository. Feel free to learn from the code.

Note that the repository does not currently ship a `LICENSE` file at its root; the MIT terms are stated in the portfolio README.
