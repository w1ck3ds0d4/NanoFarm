# How It Works

NanoFarm is a microscopic idle game. you operate a farm at nano scale: colonies of cells, splitters, harvesters, compounds. you click some things to get started, then mostly watch numbers go up. when the numbers get big enough you reset for a permanent multiplier and start over.

this doc describes the planned player experience. there is no playable build yet.

## what you do, in one paragraph

you start with an empty petri dish and a small pile of nano-credits. you spend credits on your first colony, which generates more credits over time. you spend those on a second colony, then a splitter that doubles cell yield, then a harvester that turns cells into compounds. when compound output stalls, you buy the prestige upgrade and reset the farm: all credits, colonies, and upgrades vanish, but you keep a permanent multiplier currency that makes the next run faster. then you do it again.

## resources

planned tiers:

- **nano-credits**: the basic currency. earned by every generator. used to buy everything in the early game.
- **cells**: mid-tier. produced by upgraded colonies once you cross the first threshold.
- **compounds**: late-tier. harvested from cells. needed for prestige.
- **prestige tokens**: permanent. earned only by resetting. spent on persistent multipliers that carry across runs.

## generators

each generator owns a tier of resource. owning more of a generator scales its output linearly; upgrades scale it multiplicatively.

- **colony**: produces nano-credits per second. first generator unlocked.
- **splitter**: divides a colony's output into more cells. unlocks once you own n colonies.
- **harvester**: turns cells into compounds. unlocks once you have m cells.
- (more tiers reserved for later phases; see [ROADMAP.md](ROADMAP.md).)

## the upgrade tree

upgrades are bought with the resource one tier above the thing they affect: cell upgrades cost nano-credits, compound upgrades cost cells, prestige upgrades cost compounds. the tree is small and hand-authored. no procedural generation.

each upgrade has:

- a flat cost.
- a one-time effect (unlock a generator, double a multiplier, increase offline cap).
- a prereq list of other upgrades.

once bought, an upgrade is permanent for the run.

## the idle loop

the game ticks every animation frame. between frames it counts how long passed and adds the right amount of each resource. you do not have to keep clicking. if you switch tabs the loop keeps going. if the browser throttles the tab, the loop accumulates the missed time on the next visible frame so you do not lose progress.

## offline progress

when you close the tab or close vs code, the game writes the current state and the wall-clock timestamp to storage. when you reopen it, NanoFarm reads the timestamp, computes how long was elapsed, and awards the resources you would have earned during that gap.

planned rules:

- offline progress is capped (initial cap: 8 hours of real time; raisable via an upgrade).
- offline accrual uses the rate at the moment the save was written, not the current rate. you do not retroactively benefit from upgrades bought after closing.
- a banner on reopen tells you "while you were away you earned X nano-credits over Y minutes".

## prestige

when you have enough compounds, the prestige button unlocks. confirming the reset:

1. clears all nano-credits, cells, compounds, owned generators, and bought upgrades.
2. awards prestige tokens proportional to compounds spent at reset.
3. carries the prestige token balance and any prestige-tier upgrades forward.

the next run starts faster: prestige upgrades feed multipliers into colony output, splitter yield, harvester rate, and so on. with enough tokens, the early game collapses from hours to minutes.

## the standalone web app

run from a built `dist/index.html` or via the vite dev server. the save lives in `localStorage["nanofarm.save"]`. clearing browser data wipes the farm. there is an export button that downloads the save as json, and an import button that restores one.

## the vs code extension

the extension contributes a single command:

- `NanoFarm: Open Panel` - opens a `WebviewPanel` and loads the game.

the panel can be dragged to a side group so it stays open next to your editor. closing the panel does not delete your save; the save lives in `extensionContext.workspaceState`. a per-workspace save means each project has its own farm; a settings toggle lets you switch to `globalState` so one farm follows you across workspaces.

inside the panel the game is identical to the standalone build. it just talks to the extension host through `postMessage` for save / load instead of touching `localStorage`.

## what your save looks like

a single json blob, versioned. structure described in [ARCHITECTURE.md](ARCHITECTURE.md). saves from older versions auto-migrate forward. you can copy the export json from the browser, paste it into the extension, and pick up where you left off (or vice versa).

## what NanoFarm does not do

- no leaderboards, no online ranking, no friends list.
- no microtransactions, no ads, no cosmetic shop.
- no cloud sync. the export / import json is the only cross-device path.
- no telemetry. NanoFarm makes no network calls at runtime.
- no anti-cheat. it is your save; do whatever you want with it.
