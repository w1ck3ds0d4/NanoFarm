# Roadmap

Phased plan from "empty repo" to "playable civilization in a side tab while I code". Each phase is a target, not a deadline. A phase ships when it is fun enough to play for ten minutes without obvious dead ends.

## Phase 1 - playable prototype (shipped)

Scope: a 150x150 procgen world, a placement-driven build flow, the Claude Code hook, and a HUD overlay layout. No combat yet, no events, no prestige, no VS Code extension.

Delivered:

- `app/` and `shared/` scaffolded with Vite 6 + React 19 + TypeScript + PixiJS 8 + pnpm workspaces.
- 150x150 procgen iso map regenerated from a saved seed. Six biomes (grass, sand, water, forest, mountain, mine_deposit) via value noise.
- Viewport-culled iso rendering (~250 tiles drawn at a time regardless of map size).
- Mouse drag-to-pan, scroll-wheel zoom, click-to-select then click-to-place.
- Main building (max 1, free) + roads (2 credits each) + BFS connectivity from main. Disconnected buildings render dimmed and produce zero.
- Farm and mine buildings with terrain-aware production: forest -> wood, water -> water + potato boost, mine_deposit -> iron boost, mountain -> stone boost.
- Material subtypes (wood, iron, stone, water, potatoes) with a toggleable floating pie chart over the canvas showing the breakdown.
- Claude Code `PostToolUse` hook scripts (bash + powershell) + install guide. In-app drainer that reads `~/.nanofarm/tokens.jsonl` via the File System Access API.
- HUD overlay layout: header, resource bar, materials pie, stage hint, cam + zoom meta, and a floating BUILD panel all positioned absolute inside the canvas wrap.
- `localStorage` save / load on a 5-second interval and on tab close, with forward migration for older save shapes.

Random events are temporarily disabled while the road / connectivity system stabilises.

## Phase 2 - research + content + balance

Scope: introduce the research tier, the lab building, a hand-authored tech tree, and refill the event system with content tuned for the road-based flow.

Deliverables:

- **Research resource** + lab building (produces research from materials, gated by tech).
- **Tech tree** with 10-15 nodes, each costing research and granting a rate multiplier or unlock.
- **Market building** unlocked via tech: trade resources at fixed rates.
- **Event content**: 15 hand-authored events including one branching chain (cure cancer / weaponize the research / etc).
- **Population** mechanic with potato consumption, basic happiness, and growth.
- **Visual polish**: replace placeholder iso sprites with itch.io asset pack art for grass, forest, mountain, building types, road segments.
- **Balance pass**: the first half-hour of play should feel like clear progression rather than a flat grind.

Exit criteria: a casual half-hour reaches at least one tech node, one new building unlock, and one branching event chain.

## Phase 3 - nation layer + VS Code extension wrapper

Scope: lift the game from "one city" to "one nation". Multiple cities, neighbors, auto-resolve combat, diplomacy. Ship the VS Code extension that loads the same bundle in a webview.

Deliverables:

- **Multiple cities** on a regional map. One player nation, several NPC city-states.
- **Barracks** building producing military units.
- **Auto-resolve combat**: stat comparison plus a small luck factor, reported in a "war outcome" dialog. No tactical layer.
- **Diplomacy events**: trade pacts, demands, alliances.
- `extension/` scaffolded with the `vscode` API and a `nanofarm.openPanel` command.
- **Build pipeline**: `pnpm --filter app build` produces `app/dist/`, packaged into the `.vsix` under `media/`.
- **Storage adapter detection** (`acquireVsCodeApi` vs `localStorage`) and `postMessage` bridge for save / load / clear.
- A setting to switch between `workspaceState` (per-project) and `globalState` (per-install).

Exit criteria: play in VS Code as a side panel. Close VS Code. Reopen. Save is restored. Start a war with a neighbor. See the outcome dialog. Accept or reject a trade pact.

## Phase 4 - planet layer + offline progress

Scope: build out the full planet view (weather effects, terraforming, late-game event chains). Add offline progress so closing the tab for hours produces a meaningful chunk on return.

Deliverables:

- **Influence resource** (nation tier).
- **Planet view**: weather conditions (drought, flood, eclipse) that modulate building output.
- **Terraformer** building that slowly shifts long-term conditions.
- **Offline progress calculator**: on load, replay elapsed time against last-saved rates, capped at 8 hours initially.
- "While you were away" banner on reopen.
- Expand event content to about 40 entries with several chains.

Exit criteria: a fresh session after eight hours away shows meaningful (but not silly) progress. Weather visibly changes the rate. A long chain pays off with a notable unlock.

## Phase 5 - prestige and multi-planet

Scope: long-loop content. Discover space, colonize new planets, prestige by settling.

Deliverables:

- **Spaceport** building producing exploration capacity.
- **Space discovery view**: scout neighboring planets, pick a colonization target.
- **Settling a planet is the prestige reset**: spend the current planet's progress, earn starseed tokens, restart locally with permanent multipliers carried.
- **Prestige upgrade tree**: multipliers on farm output, mine output, research rate, military strength, offline cap.
- A small set of distinct **planet types** (lush, arid, ice, tidally locked). Each starts you with different conditions.

Exit criteria: a fresh prestige run feels meaningfully faster than the first run. Picking a planet type changes the early game enough to feel like a different playthrough.

## Phase 6 - polish, theming, accessibility

Scope: visuals, sound (maybe), readability, and a way to skin the world.

Deliverables:

- A curated set of styled sprite states (idle, working, upgraded, damaged) for every building.
- Color theme tokens. A default theme plus at least one alternative.
- Optional VS Code theme integration: pick up `--vscode-*` CSS variables so the panel matches the editor's theme when running as an extension.
- Accessibility pass: keyboard navigation for build / buy / events, focus rings, readable contrast, reduced-motion mode.
- Optional audio (event chimes, button feedback) gated behind a sound toggle.

Exit criteria: the game is pleasant to look at for a sustained session and respects the host editor theme when inside VS Code.

## Things explicitly not on the roadmap

- Multiplayer or shared worlds.
- Cloud sync (export / import JSON is the cross-device story).
- Mobile-optimized layout (the game runs fine in a mobile browser, but no native app).
- A marketplace, currency purchases, or ads.
- Analytics or crash reporting.
- Tactical combat. Wars stay auto-resolved.
- Reading code, tool inputs, or tool outputs through the hook. It only counts.

## Open questions

- Whether the VS Code extension should pre-bundle `app/dist/` at publish time or fetch it from a sibling workspace folder during development. Current lean: pre-bundle for shipped builds, sibling-folder symlink during dev.
- Offline cap default. 8 hours is a starting guess; will revisit after phase 4 playtesting.
- Whether other AI tools (Copilot, Cursor, Codeium) deserve hook adapters in a later phase, or whether Claude Code stays the only supported one.
- How strong the early-game "without the hook" experience needs to be. The additive bonus should not feel like the only way to progress, but balance needs playtesting.
- Whether to add a "time skip" prestige upgrade or rely solely on rate multipliers.
- Whether to add audio at all in phase 6 or push it indefinitely.
