# How It Works

NanoFarm is a tiny pixel-art idle game. you grow a civilization in the corner of your editor. you click on things to get started, then mostly watch numbers tick up. occasionally an event popup asks you to make a choice. when you have enough of the late resource, you settle a new planet, reset your local progress, and keep a permanent multiplier.

this doc describes the planned player experience. phase 1 is in progress; later layers (combat, multi-planet) are not yet playable.

## what you do, in one paragraph

you start with a small patch of land and a small pile of credits. you click "harvest" a few times to get going, then spend credits on your first farm, which generates more credits over time. farms unlock mines, mines produce materials, materials unlock research, research unlocks bigger buildings. every so often an event pops up asking you to pick between two paths. eventually you build cities, then a nation, then go to space. settling a new planet resets your local civilization but you keep a permanent multiplier for the next run.

while you do all of this, if you have claude code installed and the hook wired up, your tool calls feed extra materials into the game. the more you code, the faster the city grows.

## resources

planned tiers for phase 1 and early phase 2:

- **nano-credits**: the basic currency. earned by every building. spent on most things in the early game. starts at zero; first harvest click awards a small amount.
- **materials**: mid-tier. produced by mines once you build one. also the resource granted by the claude code hook. used for bigger buildings and unit production.
- **research**: gated tier. produced by labs once research is unlocked. spent on tech tree nodes that change rates, unlock new buildings, or open event chains.

later phases introduce two more:

- **influence**: nation-tier. earned by population growth and event outcomes. spent on diplomacy and military.
- **starseed**: prestige currency. earned only by settling a new planet. spent on permanent multipliers that survive resets.

## buildings

each building owns a tier of resource. owning more of a building scales its output linearly; upgrades and tech nodes scale it multiplicatively.

phase 1 buildings:

- **farm**: produces nano-credits per second. first building unlocked.
- **mine**: produces materials. unlocks once you own n farms.

phase 2 adds:

- **lab**: produces research from materials. unlocks via the first major event choice.
- **barracks**: produces military units, spent in auto-resolve combat.
- **market**: trades one resource for another at a fixed rate.

phase 3 adds nation-tier buildings (capital, monument), and phase 4 adds space-tier (spaceport, terraformer).

## the click loop

clicking the harvest button awards a small flat amount of nano-credits. early game, this is how you afford your first farm. later, clicks are a footnote; passive income from buildings dwarfs them.

clicks are not throttled. you can mash if you want. the rate is balanced so that clicks alone can carry the very early game but stop being meaningful within a few minutes of playing.

## the idle loop

the game ticks every animation frame. between frames it counts how long passed and adds the right amount of each resource. you do not have to keep clicking. if you switch tabs the loop keeps going. if the browser throttles the tab, the loop accumulates the missed time on the next visible frame so you do not lose progress.

throttled background tabs are normal; everything is clamped so you never see a single tick larger than one second of accrued time.

## the claude code hook

if you install the hook (see [hooks/INSTALL.md](hooks/INSTALL.md)), every tool call your claude code session makes is recorded to a small file. the game reads that file every second and converts the new entries into bonus materials.

the bonus is **additive**. without the hook, the game is a regular idle clicker; clicks and buildings carry you. with the hook installed and an active coding session, your material accrual rate goes up noticeably. heavy sessions (lots of edits, reads, bash commands) can outpace passive income by several multiples.

the hook does not read your code, your tool inputs, or your tool outputs. it only counts that a tool call happened.

a small "+N materials from coding" floater appears in the corner each time the drainer awards a batch, so you can see the loop working.

## the event system

every so often, an event popup appears. it gives you a paragraph of context and two or three choices. picking one applies an immediate effect and may set up later events.

events fire from three kinds of triggers:

- **milestone**: "your city reached 1,000 population." fires once the threshold is crossed.
- **time**: "ten minutes since you started this run." simple wall-clock.
- **ai-tokens**: "you have earned 100k materials from coding." encourages real-world progress.

most events are one-shot dilemmas with a small immediate effect: build a school, build a hospital, both nudge stats in different directions and that is the end of it. a small set of pivotal choices open chains. for example, "cure cancer" might pull in three follow-up events over the next twenty minutes; "weaponize the research" pulls in a different three.

content is hand-authored. there is no procedural event generator.

## combat

combat is auto-resolved. you do not control units on a battlefield. when a war happens (typically from an event), the game compares your military stat to the opponent's, applies a small luck factor, and reports an outcome: win or lose, plus the resource transfer.

scale of "war" depends on the layer:

- **phase 2**: skirmishes between cities you own and neighboring city-states.
- **phase 3**: full nation-scale conflicts.
- **phase 4**: space-scale conflicts over planet resources.

if you do not want combat, you can ignore the military path entirely. nothing forces you to build a barracks. some event chains are easier with a strong military; others are easier without one.

## offline progress

when you close the tab or close vs code, the game writes the current state and the wall-clock timestamp to storage. when you reopen it, NanoFarm reads the timestamp, computes how long was elapsed, and awards the resources you would have earned during that gap.

planned rules:

- offline progress is capped (initial cap: 8 hours of real time; raisable via a prestige upgrade).
- offline accrual uses the rate at the moment the save was written, not the current rate. you do not retroactively benefit from buildings bought after closing.
- a banner on reopen tells you "while you were away you earned X credits, Y materials over Z minutes".

claude code tool calls that happened while the game was closed still count. the next drainer pass picks up the queued lines from the hook file.

## the long loop: city, nation, planet, prestige

NanoFarm grows in layers. each layer unlocks once the one below it is established.

1. **city**: phase 1. one tile grid, a handful of building types, click + idle + hook + events.
2. **nation**: phase 2 and 3. multiple cities, neighbors, diplomacy, auto-resolve skirmishes, the research tree, broader event chains.
3. **planet**: late phase 3. one planet, fully built out. weather, terraforming, late-game events.
4. **multi-planet**: phase 4. space discovery, then colonization. **settling a new planet is the prestige reset.** you spend the current planet's progress to earn starseed currency, then start over on a new planet with a permanent multiplier.

the prestige loop is the long-term motivator. the next planet starts faster because of the carried multipliers. each run pushes a little further in less time.

## the standalone web app

run from a built `dist/index.html` or via the vite dev server. the save lives in `localStorage["nanofarm.save"]`. clearing browser data wipes the save. there is an export button that downloads the save as json, and an import button that restores one.

the claude code hook on this surface writes to `~/.nanofarm/tokens.jsonl` (or `%USERPROFILE%\.nanofarm\tokens.jsonl` on windows).

## the vs code extension

planned for phase 3. the extension contributes a single command:

- `NanoFarm: Open Panel`. opens a `WebviewPanel` and loads the game.

the panel can be dragged to a side group so it stays open next to your editor. closing the panel does not delete your save; the save lives in `extensionContext.workspaceState`. a per-workspace save means each project has its own farm; a settings toggle lets you switch to `globalState` so one farm follows you across workspaces.

the hook integration is the same in both surfaces. the file path does not change. the extension panel reads the same `~/.nanofarm/tokens.jsonl`.

## what your save looks like

a single json blob, versioned. structure described in [ARCHITECTURE.md](ARCHITECTURE.md). saves from older versions auto-migrate forward. you can copy the export json from the browser, paste it into the extension, and pick up where you left off (or vice versa).

unread hook lines stay in `~/.nanofarm/tokens.jsonl` and are not part of the save export. moving to a new machine means you start fresh on the hook history, but your in-game progress comes with you.

## what NanoFarm does not do

- no leaderboards, no online ranking, no friends list.
- no microtransactions, no ads, no cosmetic shop.
- no cloud sync. the export / import json is the only cross-device path.
- no telemetry. NanoFarm makes no network calls at runtime.
- no anti-cheat. it is your save; do whatever you want with it.
- no tactical combat. wars are stat comparisons, not battle maps.
- no read of your code or tool i/o by the hook. only counts.
