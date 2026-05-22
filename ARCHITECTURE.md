# Architecture

NanoFarm is a tiny pixel-art idle game with two delivery surfaces off the same source: a standalone Vite web app and a VS Code extension that hosts the same bundle in a `WebviewPanel`. There is no server. Game state is computed entirely in the browser / webview and persisted locally.

This document describes the shipped phase 1 shape plus the extension layer that is still pending.

## Tech stack

- **Game**: TypeScript + React 19, Vite 6 for dev server and bundling.
- **Render**: [PixiJS v8](https://pixijs.com/) on a canvas for the iso tile grid and pixel-art sprites. React owns the UI chrome (HUD overlays, dialogs); the two coexist with the React app rendering above the PixiJS canvas via absolute positioning.
- **Extension** (phase 3): TypeScript, the `vscode` extension API, esbuild or `tsc` for the host module.
- **Shared types**: a small `shared/` package re-exported from both sides.
- **Claude Code hook**: a tiny shell / PowerShell script appends one line per tool call to a JSONL file. The game tick reads and drains that file via the File System Access API.
- **Package manager**: pnpm workspaces (one lockfile, three packages).
- No backend, no database, no auth, no network calls at runtime.

## Top-level layout

```
NanoFarm/
  app/                          standalone game (vite + react + ts + pixijs)
    src/
      main.tsx                  entry, mounts <App />
      App.tsx                   game shell, HUD overlays
      game/
        state.ts                GameState shape, reducer, computeProduction
        loop.ts                 raf tick: accrual, hook drain, event check
        save.ts                 serialize, migrate, persist
        buildings.ts            building definitions, terrain bonuses
        events.ts               event-decision definitions (currently empty)
        connectivity.ts         bfs from main through roads
        tokens.ts               claude code hook drainer
      pixi/
        Stage.tsx               react component that hosts the pixi app
        scene.ts                viewport-aware scene graph + culling
        tiles.ts                terrain + building draw functions
      ui/
        BuildPalette.tsx        placeable picker (main, road, farm, mine)
        EventDialog.tsx         decision popup (unused in phase 1)
        MaterialsOverlay.tsx    floating pie chart over the canvas
      adapter/
        storage.ts              storage adapter interface + localStorage impl
    public/
      assets/                   pixel-art sprites
    index.html
    vite.config.ts
    package.json
  extension/                    vs code extension wrapper (phase 3)
  shared/
    src/
      state.ts                  GameState, ResourceMap, BuildingId, MapState
      events.ts                 EventDef, EventChoice, EventTrigger
      save.ts                   SaveBlob, hydrateMissingFields
      messages.ts               extension <-> webview message envelopes
      hook.ts                   HookLine jsonl record shape
      map.ts                    procgen value noise + terrain helpers
    package.json
  hooks/
    post-tool-use.sh
    post-tool-use.ps1
    INSTALL.md
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

## App architecture in layers

The game runs in clear layers, each one calling into the layer below:

1. **State** (`game/state.ts`) - a plain TypeScript object plus a reducer. All gameplay mutations go through reducer actions. No side effects inside reducers.
2. **Tick** (`game/loop.ts`) - the `requestAnimationFrame` driver. Computes `dt`, accrues resources, drains the hook file, throttles React re-renders.
3. **Render** (`pixi/scene.ts`) - reads state, paints terrain + roads + buildings. Viewport-culled so only the ~250 tiles in view actually draw.
4. **UI** (`ui/*.tsx`) - React components for the HUD overlays, build palette, event dialog, materials pie. Drive actions via reducer dispatch.
5. **Persist** (`game/save.ts` + `adapter/storage.ts`) - writes the current `SaveBlob` through the storage adapter on a 5-second interval and on visibility change.

State is the only source of truth. Render and UI both read from it. The tick layer is the only mutator that runs on its own; everything else mutates in response to a user action or a tick event.

## Game tick loop

The loop is fully client-side. There is no server-authoritative state. Cheating your own save is uninteresting and we do not try to prevent it.

Model:

1. `loop.ts` schedules a `requestAnimationFrame` callback.
2. Each frame computes `dt = now - lastTickAt`, clamped to 1 second per frame so a thawed background tab does not jump.
3. Connectivity: `computeConnected(state)` runs a BFS from the main building through orthogonally adjacent road tiles. The returned set is the active building set.
4. Production: for each placed building, if it is in the connected set, accumulate its per-second rates (including neighbor-terrain bonuses) scaled by `dt`.
5. Hook drain: once per second (not every frame), call `tokens.drain()`. It reads new lines from the connected `tokens.jsonl`, converts them to bonus materials evenly across `wood / iron / stone / water`, and atomically truncates the file.
6. React state updates are throttled to about 4 Hz so the DOM does not re-render every frame.
7. On visibility change or every 5 seconds, `save.ts` writes the current `SaveBlob` through the storage adapter.

Building purchases, road placements, and event choices are reducer actions dispatched from UI, not from the tick loop.

## Claude Code hook integration

The hook is what makes NanoFarm distinctive. It lets real-world Claude Code usage show up in the game.

Flow:

1. The user adds a `PostToolUse` entry to `~/.claude/settings.json` pointing at `hooks/post-tool-use.sh` or `.ps1`. See [hooks/INSTALL.md](hooks/INSTALL.md).
2. Claude Code fires the hook on every tool call. The hook appends one line to `~/.nanofarm/tokens.jsonl`.
3. Each line is a `HookLine` JSON record: `{ "t": <ms-since-epoch>, "tool": "<tool-name>", "v": 1 }`.
4. The game tick calls `tokens.drain()` once per second. Drain reads the file via a `FileSystemFileHandle` (persisted across reloads in IndexedDB), parses each line, sums them, and atomically truncates the file by writing an empty body through a writable stream.
5. The reducer applies the materials bonus on the next tick. Hook tokens distribute evenly across `wood`, `iron`, `stone`, and `water`.

Shape on disk:

```ts
// shared/src/hook.ts
export interface HookLine {
  t: number;          // ms since epoch
  tool: string;       // claude code tool name, e.g. "Bash", "Edit", "Read"
  v: 1;               // schema version
}
```

Reasons for the file-on-disk approach instead of a websocket or named pipe:

- Claude Code hooks can run any command, including shell scripts that just `echo` a line to a file. Trivial to install on any OS.
- The game can be closed and still earn from a coding session; on next launch, the drainer catches up.
- No extra process to manage. No network port. No firewall prompts.

Trade-offs:

- The bonus is tied to Claude Code specifically. Other AI tools (Copilot, Cursor, Codeium) do not produce hook lines.
- File System Access API is Chrome / Edge / Brave only today. Firefox and Safari users see "hook unavailable" and play without it.

The hook does not read code, tool inputs, or tool outputs. It writes one line per tool call and nothing else.

## Save format and versioning

A save is a single JSON blob:

```ts
// shared/src/save.ts
export interface SaveBlob {
  version: SaveVersion;     // bumped on schema change
  savedAt: number;          // ms since epoch
  state: GameState;         // resources, buildings, events, map (seed + placed + roads)
}
```

Versioning:

- `version` starts at 1.
- Breaking schema changes bump the version and add a migration step.
- Older saves are forward-migrated by `hydrateMissingFields` on load: missing `map`, missing `roads`, missing main building, missing material subtypes, all get sensible defaults.
- Export / import lets the player carry a save between browser and VS Code surfaces. The blob is the same shape on both sides.

## Storage adapter

`adapter/storage.ts` exposes a small interface:

```ts
export interface StorageAdapter {
  load(): Promise<SaveBlob | null>;
  save(blob: SaveBlob): Promise<void>;
  clear(): Promise<void>;
}
```

Two implementations:

- **Standalone**: reads / writes `localStorage["nanofarm.save"]`. Synchronous under the hood but wrapped in promises for parity.
- **Extension** (phase 3): posts messages to the host. The host writes through `extensionContext.workspaceState` (default) or `globalState` (a settings toggle).

The game core does not know which adapter it has. Detection happens once at boot via `window.acquireVsCodeApi`.

## VS Code extension host

Phase 3. The extension does three things:

1. Registers a command (`nanofarm.openPanel`) that creates a `WebviewPanel`.
2. Loads `app/dist/index.html` into the panel's webview, rewriting asset URLs via `webview.asWebviewUri(...)` and setting a strict CSP.
3. Forwards messages between the webview and `extensionContext.workspaceState`.

Build flow:

- `pnpm --filter @nanofarm/app build` produces `app/dist/`.
- The extension package step bundles `app/dist/` into the `.vsix` under `media/`.
- The extension reads from `media/` at runtime via `vscode.Uri.joinPath(context.extensionUri, "media", ...)`.

## Message channel

Shared envelope shape in `shared/src/messages.ts`:

```ts
export type HostMessage =
  | { kind: "load" }
  | { kind: "save"; blob: SaveBlob }
  | { kind: "clear" };

export type WebviewMessage =
  | { kind: "loaded"; blob: SaveBlob | null }
  | { kind: "saved" }
  | { kind: "cleared" }
  | { kind: "error"; message: string };
```

No other messages cross the boundary. No `eval`, no command dispatch from inside the game.

## What is intentionally not in scope

- No server. No shared state across devices.
- No cloud save. The export / import JSON is the only cross-device path.
- No analytics, no crash reporter, no remote config.
- No anti-cheat. Memory-editing your own save is allowed.
- No tactical combat. Wars resolve via a stat-comparison formula, never a battle map.
- No multiplayer.
- No microtransactions, no ads, no in-app purchases.
- No read of code or tool I/O by the hook. Only counts.
