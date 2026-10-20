# Jellometry — 3D Jelly Obstacle Race Design Direction

## Identity & Mood
- **Product**: Jellometry ("3D Jelly Obstacle Race")
- **Audience**: Arcade platformer players on desktop and mobile browsers.
- **Visual Language**: Tactile Toybox Workshop — crisp studio lighting, translucent refractive gelatin materials, matte architectural track surfaces, and high-contrast physical instrument HUD panels inspired by tactile hardware synthesizers and studio mixing desks.
- **Dial**: `ENERGY 2 / RHYTHM 2 / MOTION 2`
- **Design Read**: Reading this as: a 3D WebGL arcade obstacle racer for players on phones and desktops, in a Tactile Toybox Workshop style, dial ENERGY 2 / RHYTHM 2 / MOTION 2.

## Color System (R-01, R-25, R-29)
Limited to 3 core surface/structural colors + 1 deliberate focal accent:
1. **Studio Slate (`#141821` / `#1E2432`)**: Deep matte instrument housing for HUD badges, dialogs and compact cards, chosen so translucent 3D jelly colors pop against the sunlit sky without competing UI glare; ensures > 8:1 WCAG AA contrast with `#F4F6FA` text.
2. **Alabaster Track Neutral (`#F4F6FA` / `#CBD2E1`)**: Primary readable text and crisp structural borders.
3. **Gelatin Coral (`#FF4D6D`)**: Default player jelly identity color and the JUMP action accent.
4. **Slime Lime (`#2EC4B6`)**: Functional status color reserved strictly for Bouncy Slime Pads, active Checkpoint indicators, the current course highlight, and the JUMP/DONE confirmation state.

Timer and dial readouts sit at `#FFC857` (record gold) and are never used for body copy.

## Typography (R-06, R-31)
- **UI & Controls (`'Fredoka'`, `'Trebuchet MS'`, system geometric rounded sans)**: Expresses tactile, playful toybox geometry while remaining legible at 13px–18px in compact HUD controls.
- **Telemetry & Numeric Readouts (`'JetBrains Mono'`, `'Consolas'`, monospace)**: Used strictly for the live race timer (`00:00.00`), personal best, morph ratio dimensions (`1.8W x 0.4H`) and course-record badges so rapidly changing digits never jitter horizontally (tabular numerals).

## Layout & Component Decisions (R-05, R-10, R-11, R-12, R-31)
- **One Focal Point**: The 3D WebGL viewport occupies `100vw x 100dvh`. All UI overlays sit cleanly at the perimeter so the track and jelly remain unobstructed.
- **Canvas Sizing**: The renderer is sized from the canvas's own layout box (`clientWidth`/`clientHeight`, `setSize(w, h, false)`) and driven by a `ResizeObserver`. It must never read `window.innerHeight`, which on iOS disagrees with the visual viewport once the toolbar collapses and would write an inline size that beats the CSS box.
- **Touch-Action Scope**: `#app` keeps native gestures (`touch-action: manipulation`) so dialogs can scroll; only the canvas and the thumbstick opt out with `touch-action: none`. `overscroll-behavior: none` stops pull-to-refresh from reloading mid-run.
- **Mobile HUD Stack**: Everything pinned to the top of the viewport lives in one fixed flex stack (`#hud-top-stack`: HUD bar, then toast, then the course briefing card). A floating toast used to be able to land on top of the HUD bar.
- **Thumb Reach**: The action cluster is bottom-right with a large JUMP button; RESET is deliberately placed in the *morph* row above it, styled as a quiet dashed outline, so a panicked thumb cannot hit it by accident. The thumbstick recentres onto the thumb on touch-down and its hit zone extends 24px past the visible ring.
- **Glassmorphism Cap (R-10)**: Backdrop blur is limited strictly to the top HUD bar and the modal cards, and is disabled entirely under `@media (pointer: coarse)` — blur is one of the most expensive things a phone compositor can be asked to do.
- **Border Radius Hierarchy (R-11)**:
  - `12px` for outer floating panels (HUD bar, dialog cards, course briefing card, course cards).
  - `8px` for interactive buttons and toast banners.
  - `999px` for status pills and chips (course chip, NEW COURSE RECORD badge).
  - `4px` for keyboard shortcut keycaps (`[Q]`, `[E]`, `[R]`, `[L]`, `[M]`).
- **Elevation & Shadow (R-12)**: Shadows (`0 8px 24px rgba(10, 14, 22, 0.35)`) are used only on perimeter floating docks to separate 2D controls from the 3D canvas beneath.
- **States (R-27)**:
  - Course Briefing State: auto-dismissing card naming the course, its difficulty stars, its one-line objective and the player's record.
  - Course Select State: a 10-card grid; locked courses grey out with an explicit "clear course N to unlock" line, so the progression is legible without a tooltip.
  - Victory State: course name, finish time, record badge, and a primary action that names the next course (or states that all courses are complete).
  - Performance Mode State: after a sustained frame-time overshoot the renderer drops pixel ratio (and desktop shadows) exactly once and says so in the toast.

## Random Course Generator (R-05, R-11, R-27, R-31)

- **One entry point, two tabs.** The generator lives inside Course Select as a second tab. A separate "Random" button in the top bar would compete with the course chip for the same perimeter space and imply two kinds of play; the tab says "another way to pick a course", which is what it is.
- **Tabs, not a mode switch.** `role="tablist"` with two `role="tab"` buttons and two `role="tabpanel"` panels. Arrow keys, `Home` and `End` move between tabs; only the active tab is in the tab order. The dialog keeps a single `aria-labelledby` title.
- **Segmented buttons, not `<select>`.** Each option group is a row of `role="radio"` buttons (`aria-checked`, roving tabindex). Native selects on mobile open a full-screen sheet, hiding the live preview that makes the controls legible, and turn a one-tap choice into two interactions. Hazard toggles use `aria-pressed` instead, because they are genuinely multi-select.
- **Minimum 40 px controls.** Every segmented button, input and dice button is at least 40 px tall (`32 px` inside the landscape-short block, where the whole dialog has to fit a 390 px viewport). Nothing in the form is a text-sized tap target.
- **Live preview as a status region.** The metrics line is `role="status"` + `aria-live="polite"` and regenerates 120 ms after the last change. It reports the *built* course, not the requested one — length, checkpoint count, per-family counts and measured threat density.
- **Amber means "different", coral means "act".** An out-of-band or unreachable setting colours the preview `#FFC857`; coral stays reserved for the primary action. A failed generation disables `Generate & Play` and says why, rather than silently handing over a course that missed its target.
- **Palette is cosmetic only.** It recolours decks and gate trims. The jelly's own palette is a separate control and stays independent, so a shared course link never changes how *your* jelly looks.
- **Landscape packing.** At `orientation: landscape and max-height: 560px` the form reflows to three columns and the seed hint is dropped, so the 844×390 case scrolls as little as possible. In that block the action row is ordered *before* the preview line so `Generate & Play` stays above the fold. Portrait phones and the 540 px breakpoint fall back to one column and let the backdrop scroll — the panel itself never becomes a second scroll container.
- **Generator Unavailable State:** when a hazard set cannot reach the requested difficulty, the difficulty button is dashed, the preview explains the ceiling, and the course still generates — at the difficulty the hazards can actually deliver.
