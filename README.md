<p align="center">
  <img src="assets/banner.svg" alt="NanoFarm" />
</p>

a tiny idle / incremental game about running a microscopic farm. culture colonies, split cells, harvest compounds, prestige and start over. designed to run either as a standalone browser app or as a vs code extension that loads the same game in a side panel so you can play it while you code.

`Status: early prototype (pre-code)`

## what this is

NanoFarm is a side-project. the whole point is something modest you can leave running in a tab while you work and check on occasionally. nano-scale theme: the resources are biological / cellular / molecular (colonies, cells, nano-credits, compounds). offline progress so it keeps ticking when you close the tab. an upgrade tree and a prestige reset for the long loop.

no servers. no accounts. no telemetry. the save lives on the device.

## two ways to play it

- **standalone web app** - `app/` is a vite + typescript + react bundle. open the built `app/dist/index.html` in any modern browser, or run the vite dev server. save state goes to `localStorage`.
- **vs code extension** - `extension/` is a thin vs code extension that opens a `WebviewPanel` and loads the exact same vite bundle from `app/dist/`. save state goes to `extensionContext.workspaceState` (per-workspace) or `globalState` (per-install) instead of `localStorage`. you can pin the panel to a side tab and tend the farm between commits.

both surfaces play the same game off the same source. the only difference is where the save lives and how the bundle is served.

## vision feature list

planned for the first playable version:

- single-resource clicker (nano-credits) with a few baseline generators (colony, splitter, harvester)
- upgrade tree that unlocks new generators and multipliers
- idle loop: tick on `requestAnimationFrame`, accrue resources over time
- offline progress: on load, compute elapsed time since last save and award resources for the gap (capped)
- prestige reset: spend a run to earn a permanent multiplier currency that carries to the next farm
- save / load: versioned json blob, migrated forward on schema bumps
- vs code wrapper: command to open the farm panel, persistent save in `workspaceState`
- modest visual polish: small, readable, no animations that eat cpu

things that are explicitly out of scope: multiplayer, cloud sync, leaderboards, anti-cheat, monetization.

## status

early prototype, pre-code. this repo currently holds vision docs only. the source layout described below is the planned shape, not what exists today.

## license

MIT. see [LICENSE](LICENSE) and [COMMERCIAL.md](COMMERCIAL.md).

---

more detail in [ARCHITECTURE.md](ARCHITECTURE.md).
