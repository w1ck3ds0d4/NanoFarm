# How It Works

NanoFarm is a tiny pixel-art idle game where you grow a civilization on a 150x150 iso map. You drop a main building, chain roads out from it, place farms and mines adjacent to the road network, and watch resources tick up. Connected buildings produce; disconnected ones sit idle and dim. With Claude Code wired up, every tool call your coding session makes feeds bonus materials into the game.

This doc describes the planned player experience. Phase 1 ships the core loop (procgen world, main + roads + connectivity, materials, HUD); later layers (combat, multi-planet, prestige) are pending.

## What you do, in one paragraph

You start with 10 credits and a procgen 150x150 map. Open the BUILD panel, pick "Main Building", click an open tile to place it. Pick "Road" and chain a few tiles out from main. Pick "Farm" and place one adjacent to a road or to main itself; it starts producing credits and potatoes immediately. Drag the map to scout for forest patches (boosts wood) and mine deposits (boosts iron). Place a mine once you have 100 credits. Repeat. Wire up the Claude Code hook if you want your coding to feed the city.

## Resources

Top-level tiers:

- **Credits** - basic currency. Earned by farms. Spent on everything in the early game. Starts at 10 so you can place a first farm right away.
- **Materials** - displayed as a single sum in the resource bar; click it to open a pie chart breakdown of the four building materials and food.
  - **Wood** - from forest tiles adjacent to a farm.
  - **Iron** - from mines, with a bonus for adjacent `mine_deposit` tiles.
  - **Stone** - from mines, with a bonus for adjacent `mountain` tiles.
  - **Water** - from water tiles adjacent to a farm.
  - **Potatoes** - farms produce these to feed the population (population mechanic coming in a later phase). Adjacent water boosts the yield.
- **Research** - gated tier. Produced by labs once research is unlocked (phase 2).
- **AI tokens** - not a stored resource; every Claude Code tool call becomes +0.25 of each building material via the hook drainer.

Later phases introduce **influence** (nation tier, earned by population growth and event outcomes) and **starseed** (prestige currency, earned by settling a new planet).

## Buildings

Phase 1 buildings:

- **Main Building** - the heart of your civilization. Free, max one per game. Required for connectivity. Visually distinct (taller, gold roof).
- **Farm** - produces 1 credit + 0.5 potatoes per second baseline. +0.15 wood per adjacent forest tile, +0.15 water + 0.2 potatoes per adjacent water tile.
- **Mine** - produces 0.25 iron + 0.25 stone per second baseline. +0.4 iron per adjacent `mine_deposit`, +0.4 stone per adjacent `mountain`. Unlocked once you have 50 credits.
- **Road** - not a building; a flat paved tile that extends the connectivity network. 2 credits each. Place chains of them to reach distant ore and forest patches.

Phase 2 adds **lab** (research), **barracks** (military units for auto-resolve combat), and **market** (trade resources at fixed rates).

## The world map

Each new game gets a fresh 150x150 procgen map generated from a saved seed. Terrain types via value noise:

- **Grass** - default buildable.
- **Sand** - shoreline. Buildable.
- **Water** - lakes, rivers, and sea. Not buildable. Boosts adjacent farm output.
- **Forest** - dense clusters. Not buildable. Boosts adjacent farm output (wood).
- **Mountain** - rocky highlands. Not buildable. Boosts adjacent mine output (stone).
- **Mine deposit** - rare grass tiles with visible ore. Not buildable. Heavy boost to adjacent mine output (iron).

The viewport shows ~30 tiles wide of the map at default zoom. Drag the canvas to pan. Scroll the wheel to zoom from 0.6x (overview) up to 3.0x (single-tile detail). Buildings are sorted back-to-front by `x + y` so iso depth reads correctly.

## Roads and connectivity

The road system is the spine of the city. The rules:

1. The main building must exist before any other building produces resources.
2. A road tile is "reachable" if it is orthogonally adjacent to the main building, or to another reachable road tile.
3. A farm or mine is "active" if it is orthogonally adjacent to the main building, or to a reachable road tile.
4. Active buildings produce normally. Inactive buildings render at 45% opacity and produce zero.

Connectivity is recomputed by BFS each tick. Placing a road that bridges two clusters reactivates all the buildings in the newly reachable subgraph instantly.

## The Claude Code hook

If you install the hook (see [hooks/INSTALL.md](hooks/INSTALL.md)), every tool call your Claude Code session makes is recorded to a small file in your home directory. The game reads that file every second and converts new entries into bonus materials, split evenly across wood, iron, stone, and water.

The bonus is **additive**. Without the hook, the game plays as a regular idle clicker; clicks and idle buildings carry you. With the hook installed and an active coding session, your material accrual rate goes up noticeably. Heavy sessions (lots of edits, reads, bash commands) can outpace passive income by several multiples.

The hook does not read your code, your tool inputs, or your tool outputs. It only counts that a tool call happened.

A small "+N materials from coding" floater appears in the corner each time the drainer awards a batch.

## Offline progress

Planned for phase 4. Today the game pauses when the tab is closed. Phase 4 will:

- Write a wall-clock timestamp on every save.
- On reopen, compute elapsed time and replay it against the last-saved rates, capped at 8 hours.
- Show a "while you were away" banner with the totals.
- Pick up queued Claude Code tool calls from the hook file on the next drainer pass.

## The standalone web app

Run from a built `dist/index.html` or via the Vite dev server. The save lives in `localStorage["nanofarm.save"]`. Clearing browser data wipes the save. Export / import buttons (planned) download and restore the save as JSON.

The Claude Code hook writes to `~/.nanofarm/tokens.jsonl` (or `%USERPROFILE%\.nanofarm\tokens.jsonl` on Windows). The browser uses the File System Access API to read it; you grant permission once via a file picker and the browser remembers the choice across sessions.

## The VS Code extension

Phase 3. The extension contributes a single command:

- `NanoFarm: Open Panel` - opens a `WebviewPanel` and loads the game.

The panel can be dragged to a side group so it stays open next to your editor. Closing the panel does not delete your save; the save lives in `extensionContext.workspaceState`. A per-workspace save means each project has its own farm; a settings toggle lets you switch to `globalState` so one farm follows you across workspaces.

The hook integration is the same in both surfaces. The file path does not change.

## The long loop

NanoFarm grows in layers. Each layer unlocks once the one below it is established:

1. **City** (phase 1, shipped) - one tile grid, main building, roads, farms + mines, terrain bonuses.
2. **Nation** (phase 2-3) - multiple cities, neighbors, diplomacy, auto-resolve skirmishes, research tree, broader event chains.
3. **Planet** (late phase 3) - one planet fully built out, weather, terraforming, late-game events.
4. **Multi-planet** (phase 4) - space discovery, then colonization. **Settling a new planet is the prestige reset.** You spend the current planet's progress to earn starseed currency, then start over on a new planet with a permanent multiplier.

The prestige loop is the long-term motivator. Each run pushes a little further in less time.

## What NanoFarm does not do

- No leaderboards, no online ranking, no friends list.
- No microtransactions, no ads, no cosmetic shop.
- No cloud sync. The export / import JSON is the only cross-device path.
- No telemetry. NanoFarm makes no network calls at runtime.
- No anti-cheat. It is your save; do whatever you want with it.
- No tactical combat. Wars are stat comparisons, not battle maps.
- No reading of your code or tool I/O by the hook. Only counts.
