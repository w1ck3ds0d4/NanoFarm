# Changelog

All notable changes to NanoFarm are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Documentation restructured to match the house style used across the rest
  of the operator's projects (BlueFlame, MimicMe, VeilBreak): centered
  banner, sentence-case headings, `## Features` with `### Subcategories`,
  `## Setup` with `### Prerequisites`, `---` dividers between sections.
- This `CHANGELOG.md`.

## Phase 1 - playable prototype

### Added

- pnpm monorepo with `app/` (Vite 6 + React 19 + TypeScript + PixiJS 8) and
  `shared/` (cross-package types). Vite dev server on port 5173.
- 150x150 procgen iso map regenerated from a single saved seed. Six biomes
  (grass, sand, water, forest, mountain, mine_deposit) generated via value
  noise in `shared/src/map.ts`.
- Viewport-culled iso rendering: only the ~250 tiles in view actually
  draw at any moment regardless of the 22,500-tile map size.
- Mouse-driven camera: drag-to-pan with a 4px threshold so a click is not
  mistaken for a tiny pan, scroll-wheel zoom from 0.6x to 3.0x.
- Click-to-place build flow: open the BUILD panel, pick a placeable, click
  a valid tile. Panel auto-closes on selection so the map is clickable.
  ESC cancels.
- Main building (max 1, free) + roads (2 credits each) + BFS connectivity
  from main through orthogonally adjacent road tiles. Disconnected
  buildings render at 45% opacity and produce zero in `computeProduction`.
- Farm and mine buildings with terrain-aware production: farm produces
  1 credit + 0.5 potatoes per second baseline plus wood from adjacent
  forest, water + potato boost from adjacent water; mine produces 0.25
  iron + 0.25 stone per second with +0.4 iron per adjacent `mine_deposit`
  and +0.4 stone per adjacent `mountain`.
- Material subtypes: `wood`, `iron`, `stone`, `water`, `potatoes`. The
  resource bar shows the sum; clicking `materials` toggles a floating
  SVG pie chart over the canvas with per-material values and percentages.
- Claude Code `PostToolUse` hook scripts (`hooks/post-tool-use.sh` and
  `.ps1`) plus `hooks/INSTALL.md`. In-app drainer reads
  `~/.nanofarm/tokens.jsonl` via the File System Access API every second,
  splits the bonus evenly across the four building materials, and
  truncates the file atomically. The file handle is persisted in
  IndexedDB so the connection survives reloads.
- HUD overlay layout: every UI element (header, resource bar, materials
  pie, stage hint, cam + zoom meta, BUILD button, build panel popup) is
  positioned absolute inside the canvas wrap. Nothing renders outside
  the game viewport.
- `localStorage` save / load on a 5-second interval and on tab close,
  with forward migration via `hydrateMissingFields` for older save shapes
  (missing `map`, missing `roads`, missing main building, missing
  material subtypes all get sensible defaults).
- `.github/dependabot.yml`, issue + PR templates, `.editorconfig`.

### Disabled

- Random event popups. The infrastructure (triggers, effects, dialog
  component) is still in the tree; `EVENT_DEFS` is empty until content
  can be re-tuned for the road-based flow.
