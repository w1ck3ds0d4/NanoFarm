<p align="center">
  <img src="assets/banner.svg" alt="NanoFarm" />
</p>

**Idle city builder powered by your coding productivity**

Tiny pixel-art SimCity-style game about growing a city in the corner of your editor. Build a real production chain (farm → mill → workshop → factory → market), keep residents fed / watered / housed / employed, climb a tech tree, and eventually prestige into a new city for a permanent legacy bonus. A Claude Code hook converts real tool calls into in-game raw materials on top of normal production.

Built with Vite 6 + React 19 + TypeScript on a PixiJS 8 canvas. Ships two ways: a VS Code extension that runs in a `WebviewPanel` next to your editor, and a standalone Vite web app.

`Status: SimCity economy live · VS Code extension shipped · prestige loop playable`

---

## Features

### Economy (SimCity-style)

- **17 buildings** across six categories (core / harvest / industry / commerce / people / tech) with construction costs, ongoing upkeep, staffing demand, optional tool boosts, and per-tile production rates
- **Production chains that close**: lumber mill → wood, mine → iron+stone, workshop → tools (boost mines/quarries/mills), factory → goods, market → credits. No building "creates credits" out of thin air; money comes from rent and goods sales
- **Power + water as utilities, not stockpiles**: a windmill / power plant supplies N power per second, a well / water pump supplies N water. Producers that need power/water scale linearly with supply ratio. Free baseline (4 power, 5 water) keeps tiny cities alive
- **Population split by job**: idle, worker, researcher, military. Schools train workers, academies train researchers, barracks train military. Buildings staff from the pool, scale production by available/needed ratio
- **Residents have needs**: food, water, power, goods, jobs. Happiness is the weighted average — survival (food+water) drives most of it, comfort (power/goods/jobs) adds a bonus. Happy residents pay full rent; unhappy ones pay a 30% floor; very unhappy ones leave
- **Multi-tile buildings**: Power Plant (2x2), Wonder (3x3). Footprint-aware rendering, click any cell to interact, sized hover/selection overlays

### Tech and prestige

- **7-node tech tree**: Agriculture, Industry, Engineering, Commerce, Metallurgy, Heavy Industry, Education. Each gates a building tier or adds a passive (Education = +50% lab output)
- **World map with 8 cities** as a hex grid (Verdant Valley → Pinewood / Greenmarsh → Stonehaven / Frostpeak → Iron Reach / Skyhold → Aether Spire). Each has a milestone; meeting it lets you settle and travel to a connected city
- **Legacy currency**: settling a city earns +1 legacy, granting +5% to every producer permanently. Wonder grants +5 legacy on completion. Techs carry across cities; the local map resets

### Rendering and UX

- **150x150 procgen iso map** generated from a single saved seed via value noise. Six biomes: grass, sand, water, forest, mountain, mine_deposit
- **Viewport-culled iso rendering**: only the ~250 tiles in view actually draw at any moment
- **Hover highlight** on placed buildings + sized footprint preview during placement (green = valid, red = blocked)
- **Live flow ticker**: `+1.5/s` / `-0.3/s` tags next to credits + research + every material in the overlay, EMA-smoothed so it doesn't jitter
- **Single-panel HUD**: only one overlay (materials / population / happiness / research / settings / world / build) open at a time
- **Inspector** shows current run ratio + bottleneck ("short on workers / power / iron stockpile") + actual flow rates, plus a pause/resume button per building
- **ESC** closes everything and cancels placement

### Surfaces and persistence

- **VS Code extension** with a `NanoFarm: Open Game` command. Save lives in `extensionContext.workspaceState` (per-workspace city). Hook integration bridges through the extension's Node fs access
- **Standalone Vite web app** with the same bundle. Save lives in `localStorage`. Hook uses the File System Access API
- **Auto-save every 5 seconds** + on tab hide + on page unload. Manual "save now" button in Settings with a "saved 12s ago" indicator
- **Save format versioned + app version persisted** so triage is possible later

### Claude Code hook

- **`PostToolUse` hook** appends one line per Claude Code tool call to `~/.nanofarm/tokens.jsonl`
- **Game drains the file every second** (via the File System Access API in standalone, via the extension's Node fs in VS Code) and converts each tool call into a basket of materials split across wood / iron / stone / food
- **Additive, not required** — the game plays normally without the hook
- **Privacy**: hook records millisecond timestamp + tool name + schema version. No code, no inputs, no outputs

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/installation) 9+
- Either: VS Code 1.85+ (for the extension), or a Chromium-based browser (for the standalone with hook support — Firefox/Safari work but the hook can't connect there)

### VS Code extension (recommended)

```bash
git clone https://github.com/w1ck3ds0d4/NanoFarm
cd NanoFarm
pnpm install
pnpm --filter nanofarm-extension package      # builds + packages the VSIX
code --install-extension extension/nanofarm-extension-0.1.0.vsix --force
```

Reload your VS Code window, then `Ctrl+Shift+P` → **NanoFarm: Open Game**. Save lives per-workspace.

To pick up game changes after editing the source:

```bash
pnpm --filter nanofarm-extension reinstall    # rebuild + reinstall in one shot
```

Then reload the window.

### Standalone

```bash
pnpm install
pnpm dev
```

Opens on `http://localhost:5173`. Save lives in browser localStorage.

### Wiring up the Claude Code hook (optional)

See [`hooks/INSTALL.md`](hooks/INSTALL.md). About thirty seconds: drop the script path into `~/.claude/settings.json` under `PostToolUse`, run any Claude Code tool call to create the file, and the game picks it up automatically (in the VS Code extension) or via a one-time file picker (in standalone Chromium).

---

## Project structure

```
NanoFarm/
  app/                          standalone game (Vite + React + TS + PixiJS)
    src/
      App.tsx                   game shell, HUD overlays, panel routing
      main.tsx                  entry, mounts <App />
      version.ts                build-time APP_VERSION (Vite define)
      game/
        state.ts                GameState shape + reducer
        simulate.ts             per-tick simulation: services, production,
                                upkeep, rent, needs, happiness, training
        loop.ts                 raf tick: simulateTick + hook drain
        save.ts                 SaveLoop with onSaved callback
        buildings.ts            BuildingDef + BuildingOps for all 17 buildings,
                                tech tree, POP_DEMAND, baselines
        cities.ts               8-city prestige tree + legacyBonus
        events.ts               event-trigger evaluator
        connectivity.ts         BFS from main, multi-tile aware
        population.ts           populationCapacity helper
        tokens.ts               hook drainer (BrowserTokenDrainer +
                                VsCodeTokenDrainer + NullTokenDrainer)
      pixi/
        Stage.tsx               React host for the PixiJS canvas
        scene.ts                viewport-aware scene graph, footprint
                                rendering, hover + selection overlays
        tiles.ts                terrain + iso building draw functions,
                                drawIsoBuildingSized for NxN buildings
      ui/
        BuildPalette.tsx        sidebar-tabbed card grid with ops summary
        BuildingInspector.tsx   live run ratio, bottleneck label, pause,
                                in/out flows, refund preview
        BuildingTooltip.tsx     hover tooltip on placed buildings
        MaterialsOverlay.tsx    pie chart + per-resource flow rate
        PopulationOverlay.tsx   pie chart by job (idle/worker/researcher/mil)
        NeedsPanel.tsx          happiness breakdown by need
        ResearchPanel.tsx       tech tree with prereqs + research bonus
        SettingsPanel.tsx       hook status, save now, recenter, new run
        WorldMapPanel.tsx       hex grid of 8 cities, milestone progress,
                                travel/prestige flow
      adapter/
        storage.ts              LocalStorage + VS Code workspaceState adapters
        vscode.ts               singleton VsCodeApi (acquireVsCodeApi is
                                single-use per document)
    index.html
    vite.config.ts              base: "./" + define: __APP_VERSION__
    package.json
  extension/                    VS Code extension wrapper (ships the same bundle)
    src/extension.ts            WebviewPanel, storage + hook postMessage bridges
    scripts/bundle-dist.mjs     copies app/dist into the VSIX
    package.json
  shared/                       cross-package types
    src/
      state.ts                  GameState, ResourceMap, BuildingId, MapState,
                                PopulationByJob, ServicesSnapshot
      save.ts                   SaveBlob (v2) + hydrateMissingFields
      hook.ts                   HookLine jsonl record
      messages.ts               webview <-> extension envelopes
      map.ts                    procgen value noise
      events.ts                 EventDef, EventChoice, EventTrigger
    package.json
  hooks/
    post-tool-use.sh            bash/zsh/wsl/git bash hook
    post-tool-use.ps1           PowerShell hook
    INSTALL.md                  wiring guide
  pnpm-workspace.yaml
  package.json
  README.md                     this file
  ARCHITECTURE.md               internals
  HOW_IT_WORKS.md               player-facing mechanics
  ROADMAP.md                    phased plan
  CHANGELOG.md                  what shipped when
  SECURITY.md                   scope + reporting
  CONTRIBUTING.md               dev workflow
  COMMERCIAL.md                 dual-license terms
```

## License

This project is dual-licensed:

- **[AGPL v3](LICENSE)** - free for open-source use. Derivatives and SaaS deployments must release their source under AGPL.
- **[Commercial license](COMMERCIAL.md)** - for proprietary / closed-source use or hosted services that do not want to comply with AGPL source-disclosure requirements. Contact for terms.
