# Architecture

NanoFarm is a tiny pixel-art idle game with two delivery surfaces off the same source: a standalone vite web app and a vs code extension that hosts the same bundle in a `WebviewPanel`. there is no server. game state is computed entirely in the browser / webview and persisted locally.

this document describes the planned shape. phase 1 is in progress; parts of this doc reference layers that are still pending.

## tech stack

- game: typescript + react 18, vite for dev server and bundling
- render: [pixi.js v8](https://pixijs.com/) on a canvas for the tile grid and pixel-art sprites. react owns the ui chrome (panels, dialogs, hud). the two coexist: pixi for the world, react for everything around it.
- extension: typescript, the `vscode` extension api, esbuild or tsc for the host module
- shared types: a small `shared/` package re-exported from both sides
- claude code hook: a tiny shell / powershell script that appends one line per tool call to a jsonl file. the game tick reads and drains that file.
- package manager: pnpm workspaces (one lockfile, three packages)
- no backend, no database, no auth, no network calls at runtime

## monorepo layout

```
NanoFarm/
  app/                          standalone game (vite + react + ts + pixi)
    src/
      main.tsx                  entry, mounts <App />
      App.tsx                   game shell, layout
      game/
        state.ts                GameState shape + reducer
        loop.ts                 raf tick: accrual, hook drain, event check
        save.ts                 serialize + migrate + persist
        buildings.ts            building definitions (farm, mine, ...)
        events.ts               event-decision definitions + trigger logic
        tokens.ts               claude code hook drainer
      pixi/
        Stage.tsx               react component that hosts the pixi app
        scene.ts                pixi scene graph (tile grid, sprites)
        tiles.ts                tile rendering + placement
      ui/
        ResourcePanel.tsx       credits / materials / research readout
        BuildPalette.tsx        building picker
        EventDialog.tsx         decision popup
        SettingsPanel.tsx       reset save, export, import, hook status
      adapter/
        storage.ts              storage adapter interface + localStorage impl
    public/
      assets/                   pixel-art sprites (sourced from itch.io packs)
    index.html
    vite.config.ts
    package.json
  extension/                    vs code extension wrapper (phase 3)
    src/
      extension.ts              activate(), command registration
      panel.ts                  WebviewPanel host, message bridge
      storage.ts                workspaceState / globalState wrapper
    package.json
    tsconfig.json
  shared/                       shared types
    src/
      state.ts                  GameState, ResourceMap, BuildingId
      events.ts                 EventDef, EventChoice, EventTrigger
      save.ts                   SaveBlob, SaveVersion, migration types
      messages.ts               extension <-> webview message envelopes
      hook.ts                   HookLine, the jsonl record shape
    package.json
  hooks/                        claude code hook scripts and install docs
    post-tool-use.sh
    post-tool-use.ps1
    INSTALL.md
  pnpm-workspace.yaml
  package.json                  root scripts (build all, lint all)
  LICENSE
  README.md
  ARCHITECTURE.md
  HOW_IT_WORKS.md
  ROADMAP.md
  SECURITY.md
  CONTRIBUTING.md
  COMMERCIAL.md
```

## app architecture in layers

the game runs in clear layers, each one calling into the layer below:

1. **state** (`game/state.ts`). a plain typescript object plus a reducer. all gameplay mutations go through reducer actions. no side effects inside reducers.
2. **tick** (`game/loop.ts`). the `requestAnimationFrame` driver. computes `dt`, accrues resources, drains the hook file, checks event triggers, throttles react re-renders.
3. **render** (`pixi/scene.ts`). reads state, paints the tile grid, sprites, animated icons. updates only what changed.
4. **ui** (`ui/*.tsx`). react components for the resource hud, build palette, event dialog. drive actions via reducer dispatch.
5. **persist** (`game/save.ts` + `adapter/storage.ts`). writes the current `SaveBlob` through the storage adapter on a 5-second interval and on visibility change.

state is the only source of truth. render and ui both read from it. the tick layer is the only mutator that runs on its own; everything else mutates in response to a user action or a tick event.

## game tick loop

the loop is fully client-side. there is no server-authoritative state. cheating your own save is uninteresting and we do not try to prevent it.

planned model:

1. `loop.ts` schedules a `requestAnimationFrame` callback.
2. each frame computes `dt = now - lastTickAt`, clamped to 1 second per frame so a thawed background tab does not jump.
3. accrual: for each owned building, `resource += building.ratePerSecond * dt`.
4. hook drain: once per second (not every frame), call `tokens.drain()`. it reads new lines from `~/.nanofarm/tokens.jsonl`, converts them to bonus materials, and atomically truncates the file.
5. event check: once per second, run trigger evaluation. milestone, time, and ai-token-based triggers each get their own pass. if any fires and no dialog is already open, push the next event onto the ui queue.
6. react state updates are throttled to about 4 hz so the dom does not re-render every frame.
7. on visibility change or every n seconds, `save.ts` writes the current `SaveBlob` through the storage adapter.

building purchases, event choices, and prestige resets are reducer actions dispatched from ui, not from the tick loop.

## claude code hook integration

the hook is what makes NanoFarm distinctive. it lets real-world claude code usage show up in the game.

flow:

1. user installs the hook by adding a `PostToolUse` entry to `~/.claude/settings.json` (global) or the project's `.claude/settings.json`. see [hooks/INSTALL.md](hooks/INSTALL.md).
2. claude code fires the hook on every tool call. the hook is a tiny script that appends one line to `~/.nanofarm/tokens.jsonl`.
3. each line is a `HookLine` json record: `{ "t": <ms-since-epoch>, "tool": "<tool-name>", "v": 1 }`.
4. the game tick calls `tokens.drain()` once per second. drain opens the file, reads all lines, parses them, sums them into a `materialsBonus`, then atomically truncates the file (via a temp-file swap).
5. the reducer applies the materials bonus on the next state tick. the ui shows a small "+N materials from coding" floater so the player sees the hook firing.

shape on disk:

```ts
// shared/src/hook.ts
export interface HookLine {
  t: number;          // ms since epoch
  tool: string;       // claude code tool name, e.g. "Bash", "Edit", "Read"
  v: 1;               // schema version
}
```

reasons for the file-on-disk approach instead of a websocket or named pipe:
- claude code hooks can run any command, including shell scripts that just `echo` a line to a file. trivial to install on any os.
- the game can be closed and still earn from a coding session; on next launch, the drainer catches up.
- no extra process to manage. no network port. no firewall prompts.

trade-offs:
- the bonus is tied to claude code specifically. other ai tools (copilot, cursor, codeium) do not produce hook lines. a future phase may add adapters.
- the file lives in user-home, so saves are tied to a machine and not portable across machines. the export / import json moves the game state, but the unread hook lines stay behind.

what the hook does **not** do:
- it does not read your code.
- it does not read tool inputs or outputs.
- it does not send anything over the network.
- it writes one line per tool call and nothing else.

the bonus is **additive**. without the hook the game works fine as a regular idle clicker. with the hook installed the rate of materials accrual is meaningfully higher during active claude code sessions.

## event system

events are the active layer in an otherwise idle game.

an event has:

```ts
// shared/src/events.ts
export interface EventDef {
  id: string;
  title: string;
  body: string;
  trigger: EventTrigger;        // milestone, time, ai-tokens, or "after:<eventId>"
  choices: EventChoice[];       // typically 2-3
  oncePerRun?: boolean;         // most are one-shot
}

export interface EventChoice {
  label: string;
  effects: EventEffect[];        // grant / deduct resources, unlock building, set flag
  followUp?: string;             // event id to queue n minutes later (for chains)
}

export type EventTrigger =
  | { kind: "milestone"; resource: string; gte: number }
  | { kind: "time"; minutesSinceStart: number }
  | { kind: "ai-tokens"; gte: number }
  | { kind: "after"; eventId: string; afterMinutes: number };
```

resolution:

1. each tick, the engine evaluates triggers for not-yet-fired events. the first match queues for display.
2. only one dialog is open at a time. additional triggers wait in a queue.
3. picking a choice applies its effects through the reducer.
4. if the choice has a `followUp`, that event is scheduled with an `after` trigger.

most events are self-contained one-shot dilemmas. a small set of pivotal choices (cure cancer, weapons program, defend or invade) open chains of 3 to 5 follow-up events. event content is hand-authored, not procedural.

content lives in `game/events.ts` as a flat array. new events are pull-request-sized contributions.

## save format and versioning

a save is a single json blob:

```ts
// shared/src/save.ts
export interface SaveBlob {
  version: number;          // SaveVersion, bumped on schema change
  savedAt: number;          // ms since epoch, used for offline progress
  state: GameState;         // resources, buildings, event history, prestige currency
}
```

versioning:

- `version` starts at 1.
- breaking schema changes bump the version and add a migration step in `save.ts::migrate(blob)`.
- migrations are forward-only: a v1 save loads into the current build by running through every migration in order. an older build cannot load a newer save; it shows a "save is from a newer version" notice and refuses to clobber.
- export / import lets the player carry a save between browser and vs code surfaces. the blob is the same shape on both sides.

## storage adapter

`adapter/storage.ts` exposes a small interface:

```ts
export interface StorageAdapter {
  load(): Promise<SaveBlob | null>;
  save(blob: SaveBlob): Promise<void>;
  clear(): Promise<void>;
}
```

two implementations:

- **standalone**: reads / writes `localStorage["nanofarm.save"]`. synchronous under the hood but wrapped in promises for parity.
- **extension** (phase 3): posts messages to the host (`{ kind: "save", blob }`, `{ kind: "load" }`, `{ kind: "clear" }`). the host writes through `extensionContext.workspaceState` (default) or `globalState` (a settings toggle).

the game core does not know which adapter it has. detection happens once at boot:

- if `window.acquireVsCodeApi` exists, install the extension adapter.
- otherwise install the localStorage adapter.

## vs code extension host

the extension is intentionally thin. it does three things:

1. registers a command (`nanofarm.openPanel`) that creates a `WebviewPanel`.
2. loads `app/dist/index.html` into the panel's webview, rewriting asset urls to `webview.asWebviewUri(...)` and setting a strict csp.
3. forwards messages between the webview and `extensionContext.workspaceState`.

the panel is set to `retainContextWhenHidden: false` by default. the game's offline-progress logic handles the gap when the panel is reopened, so retaining the dom is not required.

build flow:

- `pnpm --filter app build` produces `app/dist/`.
- `pnpm --filter extension package` runs `vsce package` and bundles `app/dist/` into the `.vsix` under `media/`.
- the extension reads from `media/` at runtime via `vscode.Uri.joinPath(context.extensionUri, "media", ...)`.

## message channel

shared envelope shape in `shared/src/messages.ts`:

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

- the webview sends `HostMessage` via `vscode.postMessage`.
- the extension host responds with `WebviewMessage` via `panel.webview.postMessage`.
- request / response correlation is by message kind plus a sequence number on each request (added in the storage adapter, not shown above).

no other messages cross the boundary. no eval, no command dispatch from inside the game.

## what is intentionally not in scope

- no server. no shared state across devices.
- no cloud save. the export / import json is the only cross-device path.
- no analytics, no crash reporter, no remote config.
- no anti-cheat. memory editing your own save is allowed.
- no tactical combat. wars resolve via a stat-comparison formula, never a battle map.
- no multiplayer.
- no microtransactions, no ads, no in-app purchases.
- no read of code or tool i/o by the hook. only counts.
