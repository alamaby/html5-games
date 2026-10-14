# HTML5 Games — Portfolio

Playable browser demos built with vanilla JS. No build step, no dependencies —
each game is a single self-contained HTML file, portrait mobile-first.

**Live:** https://alamaby.github.io/html5-games/

## Games

| Game | Status | Tech |
|------|--------|------|
| [Tower Rush](tower-rush/) | ✅ Playable | Canvas 2D, WebAudio synth SFX, touch |
| Helix Drop 3D | 🚧 Planned | Three.js |
| Pull the Pin — Playable | 🚧 Planned | Canvas 2D, playable-ad format |
| Neon Dodge | 🚧 Planned | Canvas 2D, procedural particles |

## Run locally

Any static server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000 — the landing page links to each game.

## GitHub Pages

Served from the `main` branch root. Each game's `index.html` becomes a subpath
automatically (`/stack-rush/`, …). Enable in repo Settings → Pages → Source: `main`, folder `/ (root)`.

## License

MIT — feel free to learn from the code.
