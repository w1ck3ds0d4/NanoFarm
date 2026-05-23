# Architecture

NanoFarm is a SimCity-style idle game with two delivery surfaces off the same source: a VS Code extension that hosts the game in a `WebviewPanel`, and a standalone Vite web app. There is no server. Game state is computed entirely in the browser / webview and persisted locally.

This document describes the current shipped shape.

## Tech stack

- **Game**: TypeScript + React 19, Vite 6 for dev server and bundling
- **Render**: [PixiJS v8](https://pixijs.com/) on a canvas for the iso tile grid and pixel-art sprites. React owns the UI chrome (HUD overlays, dialogs); the two coexist with the React app rendering above the PixiJS canvas via absolute positioning. Pixi v8 needs `pixi.js/unsafe-eval` imported eagerly in `main.tsx` so the strict webview CSP doesn't kill shader codegen
- **Extension**: TypeScript + the `vscode` API. Packaged as a VSIX via `@vscode/vsce`
- **Shared types**: a small `shared/` package re-exported from both sides
- **Claude Code hook**: a tiny shell / PowerShell script appends one line per tool call to a JSONL file. The game reads + truncates that file every second (via the File System Access API standalone, via the extension's Node fs in VS Code)
- **Package manager**: pnpm workspaces (one lockfile, three packages)
- No backend, no database, no auth, no network calls at runtime

## Top-level layout

```
NanoFarm/
  app/                          standalone game
    src/
      main.tsx                  entry; imports "pixi.js/unsafe-eval" first
      App.tsx                   game shell, HUD, single-panel routing
      version.ts                build-time APP_VERSION (Vite define)
      game/
        state.ts                GameState shape + reducer
        simulate.ts             per-tick simulation engine
        loop.ts                 raf tick: simulateTick + hook drain + events
        save.ts                 SaveLoop w/ onSaved callback, loadOrInit
        buildings.ts            BuildingDef + BuildingOps for 17 buildings,
                                tech tree, POP_DEMAND, baselines, costs
        cities.ts               8-city prestige tree + legacyBonus
        connectivity.ts         BFS from main, multi-tile aware
        events.ts               trigger evaluator
        population.ts           populationCapacity helper
        tokens.ts               hook drainer with three impls
      pixi/
        Stage.tsx               React host for the PixiJS canvas
        scene.ts                viewport-aware scene graph + culling,
                                hover/selection overlays, footprint draws
        tiles.ts                terrain + iso building draw, all 17 palettes
      ui/
        BuildPalette.tsx        sidebar-tabbed card grid w/ ops summary
        BuildingInspector.tsx   run ratio, bottleneck label, pause, flows
        BuildingTooltip.tsx     hover tooltip
        MaterialsOverlay.tsx    pie chart + per-resource flow rate
        PopulationOverlay.tsx   pie chart by job
        NeedsPanel.tsx          happiness breakdown
        ResearchPanel.tsx       tech tree + bonus display
        SettingsPanel.tsx       hook status, save now, recenter, new run
        WorldMapPanel.tsx       hex grid of 8 cities, milestone, travel
      adapter/
        storage.ts              LocalStorage + VsCodeStorageAdapter
        vscode.ts               singleton VsCodeApi (single-use per doc)
    index.html
    vite.config.ts              base: "./" + define __APP_VERSION__
    package.json                "@nanofarm/app"
  extension/                    VS Code extension wrapper
    src/extension.ts            WebviewPanel + storage. + hook. bridges
    scripts/bundle-dist.mjs     copies app/dist into the VSIX
    package.json                "nanofarm-extension"
  shared/
    src/
      state.ts                  GameState, ResourceMap, BuildingId, MapState,
                                PopulationByJob, ServicesSnapshot, TechId,
                                CityId, WorldState
      save.ts                   SaveBlob (v2) + hydrateMissingFields
      hook.ts                   HookLine
      messages.ts               webview <-> extension envelopes
      map.ts                    procgen value noise
      events.ts                 EventDef + EventChoice + EventTrigger
    package.json
  hooks/
    post-tool-use.sh
    post-tool-use.ps1
    INSTALL.md
  pnpm-workspace.yaml
  package.json
```

## App architecture in layers

The game runs in clear layers, each one calling into the layer below:

1. **State** (`game/state.ts`) — a plain TypeScript object plus a reducer. All gameplay mutations go through reducer actions. No side effects inside reducers.
2. **Simulation** (`game/simulate.ts`) — pure function `simulateTick(state, connected, dtSec)` returns a `TickResult` with resource deltas, population delta, training conversions, happiness, services snapshot. Replaces the old `computeProduction` + `computePopulation` pair.
3. **Tick** (`game/loop.ts`) — the `requestAnimationFrame` driver. Computes `dt` (clamped to 1s), calls `simulateTick`, dispatches a single `tick` action, drains the hook file once per second.
4. **Render** (`pixi/scene.ts`) — reads state, paints terrain + roads + buildings. Viewport-culled. Handles multi-tile footprints, hover outline, selection ring, placement preview.
5. **UI** (`ui/*.tsx`) — React components for the HUD overlays + panels. Drive actions via reducer dispatch.
6. **Persist** (`game/save.ts` + `adapter/storage.ts`) — writes the current `SaveBlob` through the storage adapter on a 5-second interval, on visibility change, on page unload, and on demand.

State is the only source of truth. The simulate layer is the only mutator that runs on its own; everything else mutates in response to a user action.

## Per-tick simulation (`game/simulate.ts`)

The economy is computed in seven passes per tick:

1. **Enumerate live buildings**: connected origin tiles only (multi-tile non-origin tiles are skipped; paused buildings are skipped here but tracked separately for upkeep).
2. **Staffing demand**: sum worker/researcher/military demand across live buildings, divide by available pop, derive `workerRatio` / `researcherRatio` / `militaryRatio`.
3. **Power supply / demand**: `FREE_POWER_BASELINE (4)` + every power plant's supply scaled by its staff ratio. Demand = residents × 0.02 + every powered building's need. Compute `powerRatio`.
4. **Water supply / demand**: `FREE_WATER_BASELINE (5)` + every water pump's supply scaled by both staff AND power ratios (pump needs power). Same for demand. Compute `waterRatio`.
5. **Input availability**: sum global demand for each consumable resource this tick (scaled by staff + utility ratios), divide by stockpile, derive per-resource `inputRatio`.
6. **Production + consumption**: for each live building, compute `runRatio = min(staff, power, water, every input ratio)`. Consume inputs × runRatio. Produce outputs × runRatio × `legacyMult` × granaryBonus (for farms) × techMult (e.g. Education → +50% lab) × boostMult (optional tools boost for harvest buildings, drained per tick when active). Apply upkeep × max(0.3, runRatio). Paused buildings pay 50% upkeep.
7. **People**: resident food + goods consumption (capped at stockpile via inputRatio). Compute happiness from per-need ratios with survival 80% / comfort 20% weighting. Rent = residents × 0.1 × max(0.3, happiness/100) × dtSec. Population grows when happiness ≥ 70 with housing slack; shrinks when < 50; bleeds excess when over capacity. Schools / academies / barracks convert idle into trained jobs.

The output `TickResult` carries:
- `resourceDeltas: Partial<Record<ResourceId, number>>` — signed
- `populationDelta: number` + `training: { worker, researcher, military }` — applied via `applyPopulationDelta` in the reducer
- `happiness: number` (0-100)
- `services: ServiceStatus` (supply/demand/ratio snapshot for HUD)
- `needs: NeedsStatus` (per-need breakdown)

The reducer's `tick` case applies the deltas, persists `services + happiness` on `meta`, and updates an EMA-smoothed `flow: Record<ResourceId, number>` for the HUD ticker.

## Building definitions (`game/buildings.ts`)

Each building has a `BuildingOps` block:

```ts
interface BuildingOps {
  consumes?: Partial<Record<ResourceId, number>>;   // per-second
  produces?: Partial<Record<ResourceId, number>>;   // per-second
  upkeep?: number;                                  // cr/s drain
  powerNeed?: number;
  waterNeed?: number;
  powerSupply?: number;                             // for plants/windmills
  waterSupply?: number;                             // for pumps/wells
  boost?: OptionalBoost;                            // e.g. tools → +60%
}
```

Plus surrounding metadata:

```ts
interface BuildingDef {
  id: BuildingId;
  label: string;
  category: BuildingCategory;        // core | harvest | industry | commerce | people | tech
  baseCost: number;                  // construction credits (grows w/ count)
  costGrowth: number;
  materialCost?: MaterialCost;       // construction materials (flat, no growth)
  maxCount?: number;
  unlock?: { resource, gte };        // credits gate
  requiresTech?: TechId;             // tech tree gate
  staffNeed?: StaffNeed;             // workers/researchers/military
  size?: number;                     // 1 (default), 2 (Power Plant), 3 (Wonder)
  ops: BuildingOps;
}
```

`productionFor()` is kept as a legacy helper that returns the ops's `produces` slice + adjacency bonuses, used by a couple of UI callers. The real simulation lives in `simulate.ts`.

## Multi-tile buildings

Schema additions in `MapState`:

```ts
placed: Record<string, BuildingId>;              // every footprint tile stamped
multiTileOrigin?: Record<string, string>;        // covered tile -> origin tile
disabled?: Record<string, true>;                 // paused buildings (by origin key)
```

For an NxN building at origin (ox, oy):
- All N×N footprint tiles get the same id in `placed`
- Non-origin tiles map to origin via `multiTileOrigin`
- Click / hover / inspect normalize to origin via `origins[k] ?? k`
- Render skips non-origin tiles (only the origin draws the bigger sprite)
- Connectivity, production, and staffing count the building once at the origin

`drawIsoBuildingSized(g, kind, size)` draws the NxN sprite anchored at the origin tile, with footprint diamond corners at `(TILE_W/2, 0)`, `((N+1)·TILE_W/2, N·TILE_H/2)`, `(TILE_W/2, N·TILE_H)`, `(-(N-1)·TILE_W/2, N·TILE_H/2)`.

## Save format and versioning

```ts
interface SaveBlob {
  version: 2;                  // bumped from 1 with the SimCity rebuild
  savedAt: number;             // ms since epoch
  state: GameState;
  appVersion?: string;         // build's package.json version (triage aid)
}
```

The loader (`loadOrInit`) drops saves with mismatching versions on the floor and starts fresh. There's no v1 → v2 migration — the economies are too different. Future schema bumps will follow the same approach for major shifts and use `hydrateMissingFields` for additive ones.

The `appVersion` field is read at build time from `app/package.json` via a Vite `define`, exposed through `app/src/version.ts` as `APP_VERSION`. Settings panel renders it next to the title.

## Storage adapter (`adapter/storage.ts`)

```ts
interface StorageAdapter {
  load(): Promise<SaveBlob | null>;
  save(blob: SaveBlob): Promise<void>;
  clear(): Promise<void>;
}
```

Two implementations:

- **LocalStorageAdapter** — standalone Vite. Reads/writes `localStorage["nanofarm.save"]`. Synchronous under the hood but wrapped in promises for parity.
- **VsCodeStorageAdapter** — extension. Posts messages to the host; host stores in `extensionContext.workspaceState` under `nanofarm.save`.

Detection happens in `createStorageAdapter()`: if `getVsCodeApi()` returns a handle, use the VS Code adapter; otherwise localStorage. The handle comes from `adapter/vscode.ts`, which caches `window.acquireVsCodeApi()` so multiple callers (storage + token drainer) share it (the API is single-use per document).

## VS Code extension host (`extension/src/extension.ts`)

The extension registers one command (`nanofarm.open`) and one webview panel. Two postMessage bridges connect the sandboxed webview to native APIs:

### Storage bridge

```
webview → ext:  { type: "storage.load"|"save"|"clear", reqId, blob? }
ext → webview:  { type: "storage.result", reqId, blob? }
```

### Hook bridge

```
webview → ext:  { type: "hook.status"|"connect"|"drain"|"set-path", reqId, path? }
ext → webview:  { type: "hook.result", reqId, available, connected, lines?, path?, error? }
```

The hook bridge reads + truncates `~/.nanofarm/tokens.jsonl` (default; overridable via `set-path`) using Node `fs.promises`. Race with the hook script is benign — anything written between read and truncate gets dropped (rare, low-stakes).

### HTML rewrite

The extension loads `app/dist/index.html`, rewrites every `./asset` URL through `webview.asWebviewUri`, strips the `crossorigin` attribute that Vite emits on script/link tags (vscode-resource doesn't return CORS headers, so crossorigin causes the browser to refuse to execute the script), and stamps a CSP meta tag:

```
default-src 'none';
img-src ${cspSource} https: data: blob:;
script-src ${cspSource} 'unsafe-inline' 'wasm-unsafe-eval';
style-src ${cspSource} 'unsafe-inline';
font-src ${cspSource} data:;
worker-src ${cspSource} blob:;
connect-src ${cspSource} blob: data:;
```

`'wasm-unsafe-eval'` keeps PixiJS v8 happy for the renderer codepaths that compile shaders.

### Build flow

```bash
pnpm --filter nanofarm-extension package    # tsc + vite build + bundle-dist + vsce package
code --install-extension extension/nanofarm-extension-0.1.0.vsix --force
```

The `bundle-dist` script copies `app/dist` into `extension/dist` so the VSIX is self-contained.

## Token drainer (`game/tokens.ts`)

Three implementations, picked by `createDrainer()`:

1. **VsCodeTokenDrainer** — preferred when running in the webview (`getVsCodeApi()` returns a handle). Posts hook.status / connect / drain messages to the extension; awaits the matching `hook.result` keyed by `reqId`.
2. **BrowserTokenDrainer** — standalone Vite + Chromium. Uses the File System Access API (`showOpenFilePicker`). Persists the chosen `FileSystemFileHandle` in IndexedDB so the connection survives reloads.
3. **NullTokenDrainer** — Firefox / Safari / anywhere FSA isn't available. `connect()` throws; `drain()` returns `[]`.

The game tick calls `drainer.drain()` once per second (`HOOK_DRAIN_INTERVAL_MS = 1000`). Returned lines get applied via the `grant-ai-tokens` reducer action, which distributes the materials evenly across `["wood", "iron", "stone", "food"]`.

## Per-tile connectivity

`computeConnected(state)` runs a BFS from the main building through orthogonally-adjacent road tiles. For each non-main building, it checks if any footprint tile touches main, a reachable road, or another placed building (outside its own footprint). Multi-tile buildings are handled by grouping footprint tiles by origin and marking all-or-none in the connected set, so the renderer and production code treat the whole building uniformly.

## What is intentionally not in scope

- No server. No shared state across devices.
- No cloud save. The save is local-only.
- No analytics, no crash reporter, no remote config.
- No anti-cheat. Memory-editing your own save is allowed.
- No tactical combat. Wars, if added, will resolve via a stat formula.
- No multiplayer.
- No microtransactions, no ads.
- No read of code or tool I/O by the hook. Counts only.
