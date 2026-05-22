# Architecture

NanoFarm is a tiny idle game with two delivery surfaces off the same source: a standalone vite web app and a vs code extension that hosts the same bundle in a `WebviewPanel`. there is no server. the game state is computed entirely in the browser / webview and persisted locally.

this document describes the planned shape. there is no code in the tree yet.

## tech stack

- game: typescript + react 18, vite for dev server and bundling
- extension: typescript, the `vscode` extension api, esbuild or tsc for the host module
- shared types: a small `shared/` package re-exported from both sides
- package manager: pnpm workspaces (one lockfile, three packages)
- no backend, no database, no auth, no network calls at runtime

## monorepo layout

```
NanoFarm/
  app/                          standalone game (vite + react + ts)
    src/
      main.tsx                  entry, renders <App />
      App.tsx                   game shell, view router
      game/
        loop.ts                 raf tick + accrual math
        state.ts                game state reducer
        save.ts                 serialize + migrate + persist
        upgrades.ts             upgrade tree definitions
        offline.ts              offline-progress calculator
      ui/
        ResourcePanel.tsx       nano-credits + per-resource readout
        UpgradeTree.tsx         buy / unlock interface
        PrestigePanel.tsx       reset + multiplier display
        SettingsPanel.tsx       reset save, export, import
      adapter/
        storage.ts              localStorage wrapper, swappable
    index.html
    vite.config.ts
    package.json
  extension/                    vs code extension wrapper
    src/
      extension.ts              activate(), command registration
      panel.ts                  WebviewPanel host, message bridge
      storage.ts                workspaceState / globalState wrapper
    package.json                contributes a command + activation event
    tsconfig.json
  shared/                       shared types
    src/
      state.ts                  GameState, ResourceMap, UpgradeId
      save.ts                   SaveBlob, SaveVersion, migration types
      messages.ts               extension <-> webview message envelopes
    package.json
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

## game tick loop

the loop is fully client-side. there is no server-authoritative state. cheating your own save is uninteresting and not something we try to prevent.

planned model:

1. `loop.ts` schedules a `requestAnimationFrame` callback.
2. each frame computes `dt = now - lastTickAt` (clamped to a sane upper bound, e.g. 1 second per frame, to avoid huge jumps when a background tab thaws).
3. accrual: for each active generator, `resource += generator.ratePerSecond * dt`.
4. react state updates are throttled (e.g. 4 hz) so the dom does not re-render every frame; the underlying numeric state is still tracked per-frame for accuracy.
5. on visibility change or every n seconds, `save.ts` writes the current `SaveBlob` through the storage adapter.

prestige and upgrades are handled by reducer actions dispatched from ui buttons, not by the tick loop.

## save format and versioning

a save is a single json blob:

```ts
// shared/src/save.ts
export interface SaveBlob {
  version: number;          // SaveVersion, bumped on schema change
  savedAt: number;          // ms since epoch, used for offline progress
  state: GameState;         // resources, generators owned, upgrades bought, prestige currency
}
```

versioning:

- `version` starts at 1.
- breaking schema changes bump the version and add a migration step in `save.ts::migrate(blob)`.
- migrations are forward-only: a v1 save loads into the current build by running through every migration in order. an older build cannot load a newer save (it shows a "save is from a newer version" notice and refuses to clobber it).
- export / import lets the player carry a save between browser and vs code surfaces. the blob is the same shape on both sides.

## storage adapter

`adapter/storage.ts` exposes a tiny interface:

```ts
export interface StorageAdapter {
  load(): Promise<SaveBlob | null>;
  save(blob: SaveBlob): Promise<void>;
  clear(): Promise<void>;
}
```

two implementations:

- **standalone**: reads / writes `localStorage["nanofarm.save"]`. synchronous under the hood but wrapped in promises for parity.
- **extension**: posts messages to the host (`{ kind: "save", blob }`, `{ kind: "load" }`, `{ kind: "clear" }`). the host writes through `extensionContext.workspaceState` (default) or `globalState` (a settings toggle).

the game core does not know which adapter it has. detection happens once at boot:

- if `window.acquireVsCodeApi` exists, install the extension adapter.
- otherwise install the localStorage adapter.

## vs code extension host

the extension is intentionally thin. it does three things:

1. registers a command (`nanofarm.openPanel`) that creates a `WebviewPanel`.
2. loads `app/dist/index.html` into the panel's webview, rewriting asset urls to `webview.asWebviewUri(...)` and setting a strict csp.
3. forwards messages between the webview and `extensionContext.workspaceState`.

the panel is set to `retainContextWhenHidden: false` by default (cheap idle when the tab is not focused). the game's offline-progress logic handles the gap when the panel is reopened, so retaining the dom is not required.

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
- request / response correlation is by message kind + a sequence number on each request (added in the storage adapter, not shown above).

no other messages cross the boundary. no eval, no command dispatch from inside the game.

## what is intentionally not in scope

- no server. no shared state across devices.
- no cloud save. the export / import json is the only cross-device path.
- no analytics, no crash reporter, no remote config.
- no anti-cheat. memory editing your own save is allowed.
