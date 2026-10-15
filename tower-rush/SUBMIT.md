# Tower Rush — CrazyGames submission package

## Copy-paste metadata (English)

### Short description
```
Stack blocks to the sky in Tower Rush! Tap to drop each sliding block onto the tower — any overhang gets sliced off, so aim carefully. Land perfect drops to keep your blocks full-size, chain combos for bonus points, and unlock 11 achievements. How high can you stack?
```

### Instructions / controls
```
Tap or click anywhere to drop the block. Time your taps to land perfect drops and build combos. The tower gets faster the higher you go — one miss ends the run!
```

### Tags (max 5 — pick from the portal's predefined list)
Arcade, Hypercasual, Timing, Puzzle, 1 Player

## Assets
| Asset | File | Spec |
|---|---|---|
| Cover landscape | `covers/cover-landscape-1920x1080.jpg` | 1920×1080 ✅ |
| Cover portrait | `covers/cover-portrait-800x1200.jpg` | 800×1200 ✅ |
| Cover square | `covers/cover-square-800x800.jpg` | 800×800 ✅ |
| Game build | `tower-rush.zip` | 12 KB, single index.html ✅ |

Cover rules respected: only the game title as text, no borders, no store logos, no copyrighted visuals.

## Submission checklist (developer.crazygames.com)
1. Create a developer account and add a new game.
2. Upload `tower-rush.zip` (or the raw `index.html`).
3. Paste the description + instructions above.
4. Upload the 3 covers. (Optional: record a 15–30 s gameplay trailer on your phone and upload it too — improves the listing.)
5. Run the **Preview / QA tool** in the portal: check the game runs, SDK initializes, and the requirement checker is green.
6. Submit for **Basic Launch** review. SDK is optional at this stage, but it's already integrated — that's a plus for Full Launch later.
7. Test live with `?useLocalSdk=true` on your own host first to confirm the ad flow (overlay placeholder + pause/resume) works.

## Technical notes for QA
- Single self-contained HTML file, no external assets except the CrazyGames SDK script.
- SDK v3: `gameplayStart` on new game, `gameplayStop` on game over, `midgame` ad at the natural game-over break, `happytime` on new best score.
- Graceful degradation: game is fully playable with ad blockers or without the SDK.
- `game.settings.muteAudio` respected (platform mute takes priority over the in-game toggle).
- Portrait-first, touch + mouse + keyboard (Space/↓) input.
- PEGI-12 friendly: no violence, no external links, no login.
