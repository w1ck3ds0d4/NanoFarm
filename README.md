<p align="center">
  <img src="assets/banner.svg" alt="NanoFarm" />
</p>

a tiny pixel-art idle game about growing a civilization in the corner of your editor. start with one city, expand to a nation, settle other planets. progress comes from two places: clicking on things, and using claude code while you work. the more tool calls your coding session makes, the more your civilization grows.

`Status: early prototype (phase 1 in progress)`

## what this is

NanoFarm is a side-project. the pitch is: leave it open while you code, and your real-world productivity drives in-game growth. every tool call your claude code session makes is fed into the game as bonus materials. when the game is open without claude code, it's still a normal idle clicker. the hook is a multiplier on top, not a gate.

it is also a quiet ambient screen. mostly numbers tick up. occasionally an event popup asks you to make a choice: build a school or a hospital? cure cancer or weaponize the research? defend the border or invade? you pick, the world bends a little, the numbers resume.

aesthetic: 8-bit / 16-bit pixel art tiles on a small canvas. ui chrome stays minimal so it tucks into a side panel without fighting your editor.

no servers. no accounts. no telemetry. the save lives on the device.

## two ways to play it

- **standalone web app** - `app/` is a vite + react + typescript bundle on top of pixijs. open the built `app/dist/index.html` in any modern browser, or run the vite dev server. save state goes to `localStorage`.
- **vs code extension** - `extension/` is a thin vs code extension that opens a `WebviewPanel` and loads the same bundle from `app/dist/`. save state goes to `extensionContext.workspaceState` (per-workspace) or `globalState` (per-install). pin the panel to a side tab and tend the city between commits.

both surfaces play the same game off the same source. the only differences are where the save lives, where the claude code hook drops its data, and how the bundle is served.

## the claude code hook

the standout mechanic. a small script wired into `~/.claude/settings.json` (or a project's `.claude/settings.json`) fires on every claude code tool call. each call writes one line to `~/.nanofarm/tokens.jsonl`. the game tick reads new lines from that file every second, drains them, and converts them to in-game materials.

the bonus is **additive**. without the hook, the game plays as a regular idle clicker. clicks and idle generators do all the work. with the hook, the same clicker accelerates noticeably when you're actively coding with claude. heavy usage sessions can outpace pure clicking by several multiples.

how to install: see [hooks/INSTALL.md](hooks/INSTALL.md). takes about thirty seconds.

## the long loop

| layer | unlocks | scale |
| --- | --- | --- |
| city | first phase. buildings, harvest, basic events. | one tile grid. |
| nation | several cities, neighbors, diplomacy, auto-resolve combat. | one planet. |
| planet | research tree, terraforming, weather, late-game events. | one planet, fully built out. |
| multi-planet | space discovery, colonize new planets. settling a new planet is the prestige reset: keep permanent multipliers, reset the local state. | the cosmos. |

each layer adds a system on top of the one below. the early game stands on its own, so phase 1 is meant to be enjoyable without any of the later layers existing yet.

## vision feature list

planned for the first playable version (phase 1):

- single city on a tile grid, a couple of placeable building types
- click-to-harvest base resource (nano-credits)
- idle generation from owned buildings
- claude code hook → bonus materials
- localStorage save / load with versioned migration
- one or two event-decision popups (one milestone-triggered, one time-triggered)
- visible "the city grew while you were coding" feedback on reopen

later phases bring: more buildings, event chains, research tree, neighboring nations, auto-resolve combat, space discovery, prestige via settling new planets. see [ROADMAP.md](ROADMAP.md).

explicitly out of scope: multiplayer, cloud sync, leaderboards, anti-cheat, microtransactions, tactical combat, telemetry.

## status

early prototype. phase 1 is scaffolded and the loop is being built out. the source layout described in [ARCHITECTURE.md](ARCHITECTURE.md) reflects the planned shape; the parts that exist today are the ones referenced in [ROADMAP.md](ROADMAP.md)'s phase 1.

## license

MIT. see [LICENSE](LICENSE) and [COMMERCIAL.md](COMMERCIAL.md).

---

more detail in [ARCHITECTURE.md](ARCHITECTURE.md) and [HOW_IT_WORKS.md](HOW_IT_WORKS.md).
