# Jellometry — 3D Jelly Obstacle Race & Track Builder Design Direction

## Identity & Mood
- **Product**: Jellometry ("3D Jelly Obstacle Race & Track Builder")
- **Audience**: Arcade platformer players and creative level builders on desktop and mobile browsers.
- **Visual Language**: Tactile Toybox Workshop — crisp studio lighting, translucent refractive gelatin materials, matte architectural track surfaces, and high-contrast physical instrument HUD panels inspired by tactile hardware synthesizers and studio CAD tools.
- **Dial**: `ENERGY 2 / RHYTHM 2 / MOTION 2`
- **Design Read**: Reading this as: 3D WebGL arcade obstacle racer and CAD-style track editor for players and level creators, in a Tactile Toybox Workshop style, dial ENERGY 2 / RHYTHM 2 / MOTION 2.

## Color System (R-01, R-25, R-29)
Limited to 3 core surface/structural colors + 1 deliberate focal accent:
1. **Studio Slate (`#141821` / `#1E2432`)**: Deep matte instrument housing for editor panels and HUD badges, chosen so translucent 3D jelly colors pop against the sunlit sky without competing UI glare; ensures > 8:1 WCAG AA contrast with `#F4F6FA` text.
2. **Alabaster Track Neutral (`#F4F6FA` / `#CBD2E1`)**: Primary readable text and crisp structural borders.
3. **Gelatin Coral (`#FF4D6D`)**: Default player jelly identity color and primary active-mode CTA accent.
4. **Slime Lime (`#2EC4B6`)**: Functional status color reserved strictly for Bouncy Slime Pads, active Checkpoint indicators, and valid placement confirmation.

## Typography (R-06, R-31)
- **UI & Controls (`'Fredoka'`, `'Trebuchet MS'`, system geometric rounded sans)**: Expresses tactile, playful toybox geometry while remaining legible at 13px–18px in compact editor controls.
- **Telemetry & Numeric Readouts (`'JetBrains Mono'`, `'Consolas'`, monospace)**: Used strictly for live race timer (`00:00.00`), morph ratio dimensions (`1.8W x 0.4H`), and XYZ coordinate inputs so rapidly changing digits never jitter horizontally (tabular numerals).

## Layout & Component Decisions (R-05, R-10, R-11, R-12, R-31)
- **One Focal Point**: The 3D WebGL viewport occupies `100vw x 100vh`. All UI overlays sit cleanly at the perimeter so the track and jelly remain unobstructed.
- **Glassmorphism Cap (R-10)**: Backdrop blur is limited strictly to the top HUD bar and the right-hand Property Inspector panel so the 3D scene remains visible at screen edges without turning every button into frosted glass.
- **Border Radius Hierarchy (R-11)**:
  - `12px` for outer floating panels (HUD bar, Inspector drawer, Bottom Catalog dock).
  - `8px` for interactive tool buttons and obstacle catalog tiles.
  - `4px` for numeric coordinate inputs and keyboard shortcut keycaps (`[G]`, `[R]`, `[S]`, `[Q]`, `[E]`).
- **Elevation & Shadow (R-12)**: Shadows (`0 8px 24px rgba(10, 14, 22, 0.35)`) are used only on the three perimeter floating docks to separate 2D controls from the 3D canvas beneath.
- **States (R-27)**:
  - Empty Selection State in Inspector: explains how to click any obstacle in the 3D viewport or choose a tool from the bottom dock.
  - Import/Export Modal State: provides live validation error messages if pasted JSON is malformed or missing obstacles.
  - Victory & Respawn States: explicit overlay with race time, checkpoint splits, and immediate replay or edit actions.
