# Changelog

All notable changes to NanoFarm are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Docs (`README.md`, `HOW_IT_WORKS.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
  `CHANGELOG.md`, `hooks/INSTALL.md`) refreshed to match the shipped
  SimCity-style economy, the VS Code extension, and the hook bridge.

## Phase 3 - VS Code extension + economy polish

### Added

- **VS Code extension** (`extension/`) packaged as a VSIX via
  `@vscode/vsce`. `NanoFarm: Open Game` command opens a `WebviewPanel`
  next to the editor. Save lives in `extensionContext.workspaceState`
  (per-workspace).
- **Hook bridge through the extension**: the webview iframe can't
  reach the File System Access API, so the extension reads + truncates
  `~/.nanofarm/tokens.jsonl` itself via Node fs and ships lines back
  over postMessage. The "connect hook" button now works in VS Code.
- **Three-tier token drainer**: `VsCodeTokenDrainer` (extension
  bridge), `BrowserTokenDrainer` (standalone Chromium FSA), or
  `NullTokenDrainer` (fallback). `createDrainer()` picks the best
  available impl.
- **Shared `acquireVsCodeApi()` singleton** in `app/src/adapter/vscode.ts`
  so the storage adapter and the token drainer can both grab the same
  handle (the VS Code API is single-use per document).
- **Manual save now button** + last-saved timestamp in the settings
  panel. The game has always auto-saved every 5 seconds; the visible
  indicator is new.
- **App version** read from `app/package.json` at build time via Vite
  `define` (`__APP_VERSION__` → `APP_VERSION`). Persisted on `SaveBlob`
  and shown next to the SETTINGS title.
- **Inline confirm dialogs** for `new run` and city travel - the VS
  Code webview disables `window.confirm` so a yes/no row replaces it.
- **Multi-tile buildings** (2x2 Power Plant, 3x3 Wonder). Schema
  additions: `multiTileOrigin`, footprint-aware reducer place/remove,
  `drawIsoBuildingSized` for the NxN sprite, footprint outlines on
  placement preview + selection + hover, connectivity treats all
  footprint tiles uniformly.
- **Hover outline** on placed buildings - thin white footprint ring
  when the cursor is over any tile of a building, suppressed during
  placement mode and when the same building is in the inspector.
- **Per-building pause toggle** (Inspector button). Paused buildings
  stop producing/consuming/staffing but still pay 50% upkeep. Map
  dims them like disconnected.
- **Mutually-exclusive HUD panels** - one panel (build/research/world/
  settings/needs/materials/population) open at a time; opening
  another closes the previous.
- **Themed scrollbars** on in-game panels (dark olive track, lime
  thumb) via both `scrollbar-color` and `::-webkit-scrollbar`.
- **Build panel sized to fit** between top + bottom HUD; cards lane
  scrolls inside.
- **Live flow ticker** next to credits + research HUD cells and on
  every materials overlay row. EMA-smoothed (α=0.15) so the number
  doesn't jitter. Renders `0.0/s` in a dim olive when flat so the
  layout doesn't shift.
- **Free roads** (was 2 cr each). Adjacency rule kept so the network
  must grow contiguously.
- **Basic infrastructure tier**: Well (60 cr, 4 water/s, no tech)
  and Windmill (120 cr, 6 power/s, no tech) for early-game services
  before the Engineering / Heavy Industry tech branches.
- **Tools loop closed**: Workshops produce tools; mines / quarries /
  lumber mills consume tools as an optional +60% boost. Falls back
  to base rate if stockpile empties.
- **Wonder grants +5 legacy** on completion in addition to its
  vanity production.

### Changed

- **Bootstrap budget bumped** to 120 cr / 15 wood / 15 food + School
  cost dropped to 60 cr so the first ~30 seconds reach a working
  worker / wood pipeline.
- **Free baseline utilities**: 4 power + 5 water always available
  without infrastructure, so tiny cities don't insta-softlock on
  zero power.
- **Happiness rebalance**: survival (food + water) weighted 80%,
  comfort (power + goods + jobs) weighted 20%. Empty city or
  survival-met city sits in the growth band.
- **Upkeep scales with run ratio** (floored at 30%) so dead
  buildings don't bleed full upkeep. Main building produces +0.5
  cr/s baseline so a broken city always has trickle income.
- **Rent has a 30% floor**: even angry residents pay something so
  happiness collapse doesn't also zero income.
- **Stone unblock**: mine produces 0.1 stone/s byproduct; quarry,
  academy, market dropped stone from their construction costs.
- **Academy ungated**: was behind Education tech (which required
  research that only labs could produce, which needed academy
  graduates - softlock). Education tech repurposed as a passive
  +50% lab output bonus.
- **Hexagonal world map** with 8 cities (Verdant Valley, Pinewood,
  Greenmarsh, Stonehaven, Frostpeak, Iron Reach, Skyhold, Aether
  Spire) in a connected prereq tree.
- **HUD condensed**: shorter labels (`CR`, `MAT`, `POP`, `HPY`,
  `PW`, `WT`, `RS`), tighter cell padding, flex-wrap for narrow
  canvases.
- **ESC** closes every panel + cancels placement + closes the
  inspector in one press.

### Fixed

- **Sandbox CSP issues** preventing the bundle from booting in the
  webview: stripped `crossorigin` from `<script>` / `<link>`,
  added `wasm-unsafe-eval` to the CSP, imported `pixi.js/unsafe-eval`
  in `main.tsx` so PixiJS doesn't trip strict CSP.
- **Singleton `acquireVsCodeApi`** so storage adapter + token
  drainer don't both call it (second call throws).

## Phase 2 - SimCity economy rebuild

Big-bang rewrite of the per-tick simulation. Save format jumped from
v1 to v2; old saves are discarded on load.

### Added

- **Per-tick simulation engine** in `game/simulate.ts`. Pure
  function that computes resource deltas, population delta,
  training, happiness, services snapshot, and needs breakdown
  in seven ordered passes (live enumeration, staffing ratios,
  power service, water service, input availability, production +
  consumption, people).
- **17 buildings** with `BuildingOps` blocks declaring `consumes`,
  `produces`, `upkeep`, `powerNeed`, `waterNeed`, `powerSupply`,
  `waterSupply`, optional `boost`.
- **Resources**: `credits`, `research`, `wood`, `iron`, `stone`,
  `food`, `goods`, `tools`. Replaces the old `wood/iron/stone/water/
  potatoes/credits/research/electricity` set.
- **Services**: power and water are computed live each tick from
  building supply + free baseline + demand from industries + residents.
  Producers scale by `min(staffing, power, water, every input ratio)`.
- **Population by job**: idle / worker / researcher / military.
  Schools train workers, academies train researchers, barracks train
  military. Buildings staff from the pool; output scales by
  available / needed ratio.
- **Resident needs** (food, water, power, goods, jobs) checked every
  tick. Happiness drives rent multiplier + grow/leave rate.
- **Rent + market sales as money sources**. No building "creates
  credits" anymore.
- **7-node tech tree**: Agriculture, Industry, Engineering, Commerce,
  Metallurgy, Heavy Industry, Education. Each gates a building tier
  or adds a passive.
- **World map + prestige** (`WorldMapPanel`): 8 cities, milestones,
  travel between cities wipes local map but keeps techs + accumulates
  +5%/legacy production bonus.
- **People-category buildings**: school, academy, barracks for
  training each job type.
- **PopulationOverlay** pie chart by job.
- **NeedsPanel** with per-need progress bars.

### Removed

- Old `productionFor` / `computePopulation` split, replaced by
  `simulateTick`. The helper `productionFor` is kept as a small
  facade for a couple of UI callers.
- Stockpiled `electricity` and `water` resources. Both became
  services. `potatoes` renamed to `food` for generality.

## Phase 1 - playable prototype

### Added

- pnpm monorepo with `app/` (Vite 6 + React 19 + TypeScript + PixiJS 8)
  and `shared/` (cross-package types). Vite dev server on port 5173.
- 150x150 procgen iso map regenerated from a single saved seed. Six
  biomes (grass, sand, water, forest, mountain, mine_deposit) generated
  via value noise in `shared/src/map.ts`.
- Viewport-culled iso rendering: only the ~250 tiles in view actually
  draw at any moment regardless of the 22,500-tile map size.
- Mouse-driven camera: drag-to-pan with a 4px threshold, scroll-wheel
  zoom from 0.6x to 3.0x.
- Click-to-place build flow: open the BUILD panel, pick a placeable,
  click a valid tile. Panel auto-closes on selection. ESC cancels.
- Main building (max 1, free) + roads + BFS connectivity from main.
  Disconnected buildings render at 45% opacity and produce zero.
- Farm + mine buildings with terrain-aware production.
- Materials pie chart HUD.
- Claude Code `PostToolUse` hook scripts + `hooks/INSTALL.md`.
  In-app drainer reads `~/.nanofarm/tokens.jsonl` via the File System
  Access API every second, splits the bonus evenly across building
  materials.
- HUD overlay layout: everything positioned absolute inside the
  canvas wrap.
- `localStorage` save / load on a 5-second interval and on tab close,
  with forward migration via `hydrateMissingFields`.
- `.github/dependabot.yml`, issue + PR templates, `.editorconfig`.
