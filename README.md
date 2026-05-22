<p align="center">
  <img src="assets/banner.svg" alt="NanoFarm" />
</p>

**Idle city builder powered by your coding productivity**

Tiny pixel-art idle game about growing a civilization in the corner of your editor. Start with one city, expand to a nation, settle other planets. Progress comes from idle building production and a Claude Code hook that converts real-world tool calls into in-game materials. Without the hook it still plays as a regular idle clicker; the hook is a multiplier on top, not a gate.

Built with Vite 6 + React 19 + TypeScript on a PixiJS 8 canvas. Standalone web app today; VS Code extension surface planned for phase 3.

`Status: phase 1 in progress (playable prototype)`

---

## Features

### World and rendering

- **150x150 procgen map** - biome layout (grass, sand, water, forest, mountain, mine deposits) generated from a single saved seed via value noise. Terrain is regenerated on load so the save stays a few hundred bytes
- **Isometric pixel-art rendering** - 32x16 diamond tiles, depth-sorted building sprites, viewport-culled so only the ~250 tiles in view actually draw at any moment
- **Mouse-driven camera** - drag to pan, scroll to zoom (0.6x to 3.0x). ESC cancels a placement selection

### Building and economy

- **Main building + roads + connectivity** - place the main building first, then chain roads out from it. Any building adjacent to main or to a connected road tile is "active"; disconnected buildings render at 45% opacity and produce zero
- **Click-to-place flow** - open the BUILD panel, pick a placeable, click a valid tile. The panel auto-closes so the map is clickable. ESC cancels
- **Material subtypes from terrain** - farms produce credits + potatoes baseline, plus wood from adjacent forest tiles and water + extra potatoes from adjacent water. Mines produce iron + stone with bonuses for adjacent `mine_deposit` and `mountain`
- **Materials pie chart HUD** - click `materials` in the resource bar to toggle a floating SVG pie chart over the canvas showing the wood / iron / stone / water / potatoes breakdown with percentages

### Claude Code hook

- **`PostToolUse` hook** - a small `bash` or `powershell` script wired into `~/.claude/settings.json` appends one line per Claude Code tool call to `~/.nanofarm/tokens.jsonl`
- **In-app drainer** - the game tick reads new lines from that file every second via the File System Access API, converts them to bonus materials evenly split across `wood`, `iron`, `stone`, `water`, and truncates the file atomically
- **Additive, not required** - the game is fully playable without the hook. With it, active coding sessions noticeably accelerate material accrual
- **Privacy** - the hook records only a millisecond timestamp + the tool name + a schema version. No code, no tool input, no tool output, no network calls

### Persistence and surfaces

- **`localStorage` save** - versioned JSON blob, written every 5 seconds and on tab close. Older saves auto-migrate forward via `hydrateMissingFields`
- **No telemetry, no server, no account** - everything lives on the device
- **Two surfaces** - standalone Vite web app today, VS Code `WebviewPanel` extension planned for phase 3 (same bundle, different save adapter)

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/installation) 9+
- A modern Chromium-based browser if you want the Claude Code hook to work (File System Access API is required and Firefox / Safari do not implement it yet)

### Clone and install

```bash
git clone https://github.com/w1ck3ds0d4/NanoFarm
cd NanoFarm
pnpm install
pnpm dev
```

The dev server boots on `http://localhost:5173`.

### Wiring up the Claude Code hook (optional)

See [`hooks/INSTALL.md`](hooks/INSTALL.md). About thirty seconds: drop the script path into `~/.claude/settings.json` under `PostToolUse`, click "connect claude code hook" in the top-right of the game, point the file picker at `~/.nanofarm/tokens.jsonl`.

---

## Project Structure

```
NanoFarm/
  app/                          Standalone game (Vite + React + TS + PixiJS)
    src/
      App.tsx                   Game shell, HUD overlays, camera state
      main.tsx                  Entry, mounts <App />
      game/
        state.ts                GameState shape, reducer, computeProduction
        loop.ts                 raf tick: accrual, hook drain, event check
        save.ts                 Serialize + migrate + persist
        buildings.ts            Building defs, terrain bonuses, ROAD_COST
        events.ts               Event-decision defs (empty in phase 1)
        connectivity.ts         BFS from main through adjacent roads
        tokens.ts               Claude Code hook drainer (FSA + IndexedDB)
      pixi/
        Stage.tsx               React host for the PixiJS canvas
        scene.ts                Viewport-aware scene graph + culling
        tiles.ts                Terrain + iso building draw functions
      ui/
        BuildPalette.tsx        Placeable picker (main, road, farm, mine)
        MaterialsOverlay.tsx    Floating SVG pie chart over the canvas
        EventDialog.tsx         Decision popup (unused in phase 1)
      adapter/
        storage.ts              Storage adapter (localStorage today)
    index.html
    vite.config.ts
    package.json
  shared/                       Cross-package types
    src/
      state.ts                  GameState, ResourceMap, BuildingId, MapState
      save.ts                   SaveBlob + hydrateMissingFields
      hook.ts                   HookLine jsonl record shape
      messages.ts               Extension <-> webview message envelopes
      map.ts                    Procgen value noise + terrain helpers
      events.ts                 EventDef, EventChoice, EventTrigger
    package.json
  hooks/
    post-tool-use.sh            Bash hook for zsh / wsl / git bash
    post-tool-use.ps1           PowerShell hook for windows
    INSTALL.md                  Wiring guide for ~/.claude/settings.json
  assets/
    banner.svg                  Repo banner
  pnpm-workspace.yaml
  package.json
  README.md
  ARCHITECTURE.md
  HOW_IT_WORKS.md
  ROADMAP.md
  SECURITY.md
  CONTRIBUTING.md
  COMMERCIAL.md
  CHANGELOG.md
```

## License

This project is dual-licensed:

- **[AGPL v3](LICENSE)** - free for open-source use. Derivatives and SaaS deployments must release their source under AGPL.
- **[Commercial license](COMMERCIAL.md)** - for proprietary / closed-source use or hosted services that do not want to comply with AGPL source-disclosure requirements. Contact for terms.
