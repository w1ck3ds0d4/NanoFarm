# Roadmap

phased plan from "empty repo" to "playable civilization in a side tab while i code". each phase is a target, not a deadline. a phase ships when it is fun enough to play for ten minutes without obvious dead ends.

## phase 1: the click + hook loop

scope: one city, one tile grid, two buildings, click to harvest, idle accrual, claude code hook awarding bonus materials, two event popups, localStorage save. no neighbors yet, no nations, no combat, no prestige, no vs code extension.

deliverables:

- `app/` scaffolded with vite + react + ts + pixi.
- nano-credits resource with a clickable "harvest" button for manual gain.
- two buildings: farm (produces credits) and mine (produces materials).
- buy buildings on the tile grid; placements persist in state.
- claude code hook script (`hooks/post-tool-use.sh` and `.ps1`) plus `hooks/INSTALL.md` install guide.
- in-app drainer (`game/tokens.ts`) that reads `~/.nanofarm/tokens.jsonl` each second and grants bonus materials.
- two event-decision popups: one fires on a milestone (first 1k credits), one fires on a time trigger (ten minutes since save start).
- localStorage save / load on a 5-second interval and on tab close.
- export / import save buttons.
- placeholder pixel-art sprites for farm, mine, and tile background.

exit criteria: open the tab, click harvest, buy a farm, buy a mine. start a claude code session. watch the materials counter accelerate noticeably. the first event fires. close the tab, reopen, save survives.

## phase 2: research tree + event content

scope: introduce the research currency, the lab building, and a hand-authored tech tree. expand event content from two to about fifteen entries with the first multi-step chain.

deliverables:

- research resource and lab building.
- tech tree with 10-15 nodes, each costing research and granting a rate multiplier or unlock.
- new building unlocked by tech: market (trade resources at fixed rates).
- expand `game/events.ts` to about 15 events, including one chain of 3-5 follow-ups gated by an early decision.
- replace placeholder sprites with itch.io asset pack sprites (one consistent pack).
- balance pass: the first half-hour of play should feel like clear progression rather than a flat grind.
- raf-based tick loop with throttled react re-renders (formalize the 4 hz cap).

exit criteria: a casual half-hour reaches at least one tech node, one new building unlock, and one branching event chain.

## phase 3: nation layer + vs code extension wrapper

scope: lift the game from "one city" to "one nation". introduce neighboring city-states, auto-resolve combat, diplomacy events. ship the vs code extension that loads the same bundle in a webview.

deliverables:

- multiple cities on a regional map. one player nation, several npc city-states.
- barracks building producing military units.
- auto-resolve combat: stat comparison plus a small luck factor, reported in a "war outcome" dialog.
- diplomacy events: trade pacts, demands, alliances.
- `extension/` scaffolded with the `vscode` api and a `nanofarm.openPanel` command.
- build pipeline: `pnpm --filter app build` produces `app/dist/`; `pnpm --filter extension package` bundles it.
- storage adapter detection (`acquireVsCodeApi` vs `localStorage`).
- `postMessage` bridge for save / load / clear.
- a setting to switch between `workspaceState` (per-project) and `globalState` (per-install).

exit criteria: play in vs code as a side panel. close vs code. reopen. save is restored. start a war with a neighbor. see the outcome dialog. accept or reject a trade pact.

## phase 4: planet layer + offline progress

scope: build out the full planet view: weather effects, terraforming, late-game event chains. add offline progress so closing the tab for hours produces a meaningful chunk on return.

deliverables:

- influence resource (nation-tier).
- planet view: weather conditions (drought, flood, eclipse) that modulate building output.
- terraformer building that slowly shifts long-term conditions.
- offline progress calculator: on load, replay elapsed time against last-saved rates, capped at 8 hours initially.
- "while you were away" banner on reopen.
- expand event content to about 40 entries with several chains.
- visual polish: building idle / working / upgraded states.

exit criteria: a fresh session after eight hours away shows meaningful (but not silly) progress. weather visibly changes the rate. a long chain pays off with a notable unlock.

## phase 5: prestige and multi-planet

scope: long-loop content. discover space, colonize new planets, prestige by settling.

deliverables:

- spaceport building. produces exploration capacity.
- space discovery view: scout neighboring planets, pick a colonization target.
- settling a planet is the prestige reset: spend the current planet's progress, earn starseed tokens, restart locally with permanent multipliers carried.
- prestige upgrade tree: multipliers on farm output, mine output, research rate, military strength, offline cap.
- a small set of distinct planet types (lush, arid, ice, tidally locked). each starts you with different conditions.

exit criteria: a fresh prestige run feels meaningfully faster than the first run. picking a planet type changes the early game enough to feel like a different playthrough.

## phase 6: polish, theming, accessibility

scope: visuals, sound (maybe), readability, and a way to skin the world.

deliverables:

- a curated set of styled sprite states (idle, working, upgraded, damaged) for every building.
- color theme tokens. a default theme plus at least one alt.
- optional vs code theme integration: pick up `--vscode-*` css variables so the panel matches the editor's theme when running as an extension.
- accessibility pass: keyboard navigation for build / buy / events, focus rings, readable contrast, reduced-motion mode.
- optional audio (event chimes, button feedback) gated behind a sound toggle.

exit criteria: the game is pleasant to look at for a sustained session and respects the host editor theme when inside vs code.

## things explicitly not on the roadmap

- multiplayer or shared worlds.
- cloud sync (export / import json is the cross-device story).
- mobile-optimized layout (the game runs fine in a mobile browser, but no native app).
- a marketplace, currency purchases, or ads.
- analytics or crash reporting.
- tactical combat. wars stay auto-resolved.
- reading code, tool inputs, or tool outputs through the hook. it only counts.

## open questions

- whether the vs code extension should pre-bundle `app/dist/` at publish time or fetch it from a sibling workspace folder during development. (current lean: pre-bundle for shipped builds, sibling-folder symlink during dev.)
- offline cap default. 8 hours is a starting guess; will revisit after phase 4 playtesting.
- whether other ai tools (copilot, cursor, codeium) deserve hook adapters in a later phase, or whether claude code stays the only supported one.
- how strong the early-game "without the hook" experience needs to be. the additive bonus should not feel like the only way to progress, but balance needs playtesting.
- whether to add a "time skip" prestige upgrade or rely solely on rate multipliers.
- whether to add audio at all in phase 6 or push it indefinitely.
