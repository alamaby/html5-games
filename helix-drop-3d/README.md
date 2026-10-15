# Helix Drop 3D

Three.js (r149) helix-drop game. Single-file portrait HTML5, WebAudio synth SFX,
CrazyGames SDK v3, bilingual EN/ID (English default).

## Builds

`src/` holds the sources; `src/build.py` assembles them:

- `python3 src/build.py` → `index.html` (23 KB) — Three.js loads from CDN.
  This is the portfolio/GitHub Pages build (committed to the repo).
- `python3 src/build.py --inline` → `helix-drop-3d-submit.html` (617 KB) —
  fully self-contained single file. Rename to `index.html` before uploading
  to the CrazyGames developer portal (it rejects archives; drag the file directly).

Game code (`logic.js` + `game.js`) is identical in both builds.

## Tests

- `tests/test_helix_logic.js` — 33 unit tests for platform generation, sector
  collision math, combo scoring. Run: `node tests/test_helix_logic.js`
- `tests/test_helix_smoke.js` — 9 smoke tests for game.js with stubbed THREE/DOM
  (boot → play → dying → over). Run: `node tests/test_helix_smoke.js`
