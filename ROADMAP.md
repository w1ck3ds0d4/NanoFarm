# Roadmap

phased plan from "empty repo" to "playable farm in a side tab while i code". each phase is a target, not a deadline. a phase ships when it is fun enough to play for ten minutes without obvious dead ends.

## phase 1 - first clickable

scope: a single resource, one generator tier, a couple of upgrades, all in the vite app. no vs code extension yet, no prestige, no offline progress.

deliverables:

- `app/` scaffolded with vite + react + ts.
- nano-credits resource with a clickable "harvest" button for manual gain.
- colony generator: buy with credits, generates credits per second.
- two or three upgrades: cheaper colonies, faster colony output, click multiplier.
- `localStorage` save / load on a 5-second interval and on tab close.

exit criteria: numbers go up, save survives a reload, the page does not feel broken.

## phase 2 - second resource and idle tuning

scope: introduce the mid-tier resource and tune the idle loop so closing the tab for an hour produces a meaningful change in numbers.

deliverables:

- cells resource and splitter generator.
- upgrade tree expanded with mid-tier nodes (splitter yield, cell -> credit conversion).
- balance pass on costs and rates so the first ~30 minutes of play has visible progression.
- raf-based tick loop with throttled react re-renders.

exit criteria: a casual session of half an hour reaches at least one new generator and one new upgrade unlock.

## phase 3 - vs code extension wrapper

scope: ship the extension that loads `app/dist/` in a `WebviewPanel`. saves go to `workspaceState`.

deliverables:

- `extension/` scaffolded with the `vscode` api and a `nanofarm.openPanel` command.
- build step that copies `app/dist/` into the packaged extension's `media/` dir.
- storage adapter detection in the game (`acquireVsCodeApi` -> extension adapter, else localStorage adapter).
- `postMessage` bridge for `load` / `save` / `clear`.
- a setting to switch between `workspaceState` (per-project) and `globalState` (per-install).

exit criteria: open the panel in vs code, play, close vs code, reopen, save is restored.

## phase 4 - prestige and offline progress

scope: long-loop content. close the tab and come back to a meaningful chunk of progress; reset for permanent multipliers.

deliverables:

- compounds resource and harvester generator.
- prestige action: reset the run, award prestige tokens.
- prestige upgrade tree (multipliers that survive resets).
- offline progress calculator: on load, replay elapsed time against last-saved rates, capped at 8 hours initially.
- "while you were away" banner on reopen.

exit criteria: a fresh prestige run feels meaningfully faster than the first run.

## phase 5 - polish and theme support

scope: visuals, sound (maybe), readability, and a way to skin the farm.

deliverables:

- a small set of styled visual states for generators (idle, working, upgraded).
- color theme tokens; a default "petri" theme plus at least one alt theme.
- optional vs code theme integration: pick up `--vscode-*` css variables so the panel matches the editor's theme when running as an extension.
- accessibility pass: keyboard navigation for buy / sell, focus rings, readable contrast.

exit criteria: the farm is pleasant to look at for a sustained session and respects the host editor theme when inside vs code.

## things explicitly not on the roadmap

- multiplayer or shared farms.
- cloud sync (export / import json is the cross-device story).
- mobile-optimized layout (the game runs fine in a mobile browser, but no native app).
- a marketplace, currency purchases, or ads.
- analytics or crash reporting.

## open questions

- whether the vs code extension should pre-bundle `app/dist/` at publish time or fetch it from a sibling workspace folder during development. (current lean: pre-bundle for shipped builds, sibling-folder symlink during dev.)
- offline cap default. 8 hours is a starting guess; will revisit after phase 4 playtesting.
- whether to add a "time skip" prestige upgrade or rely solely on rate multipliers.
- whether to add audio at all in phase 5 or push it indefinitely.
