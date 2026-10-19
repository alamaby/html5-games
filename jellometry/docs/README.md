# Screenshots

Drop three PNGs here, then un-comment the image block near the top of
[`../README.md`](../README.md).

| Filename | Suggested content | Suggested size |
|---|---|---|
| `screenshot-gameplay.png` | Jelly on a track with a sweeper bar ahead | 1280 × 720 |
| `screenshot-morph.png` | Flat vs tall jelly in front of the two gate shapes | 1280 × 720 |
| `screenshot-courses.png` | Course Select modal showing all ten cards | 1280 × 720 (or portrait) |

Keep them under ~400 KB each so the README stays quick to load on GitHub.

## Capturing

The game runs without a build step, so any static server plus a browser is
enough:

```bash
npx serve .
```

Then open `http://localhost:3000/jellometry/`.

Useful shortcuts while capturing:

- `L` opens Course Select.
- `?unlockAll=1` unlocks all ten courses so the modal is fully populated.
- The morph slider on desktop gives you the exact flat/tall poses for the
  comparison shot.
