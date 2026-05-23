# Roadmap

Phased plan from "empty repo" to "playable civilization in a side tab while I code". Each phase is a target, not a deadline. A phase ships when it is fun enough to play for ten minutes without obvious dead ends.

## Phase 1 - playable prototype (shipped)

Scope: a 150x150 procgen world, a placement-driven build flow, the Claude Code hook (standalone), and a HUD overlay layout. No combat, no events, no prestige, no VS Code extension.

Delivered:

- `app/` and `shared/` scaffolded with Vite 6 + React 19 + TypeScript + PixiJS 8 + pnpm workspaces.
- 150x150 procgen iso map regenerated from a saved seed. Six biomes via value noise.
- Viewport-culled iso rendering (~250 tiles drawn at a time regardless of map size).
- Mouse drag-to-pan, scroll-wheel zoom, click-to-select then click-to-place.
- Main building + roads + BFS connectivity. Disconnected buildings render dimmed and produce zero.
- Farm + mine buildings with terrain-aware production.
- Material subtypes (wood, iron, stone, water, potatoes) with a toggleable floating pie chart.
- Claude Code `PostToolUse` hook scripts + install guide. In-app drainer.
- HUD overlay layout positioned absolute inside the canvas wrap.
- `localStorage` save / load with forward migration.

## Phase 2 - SimCity-style economy rebuild (shipped)

Scope: rebuild the per-tick simulation so resources, people, services, and money form a real economy with closed loops. Bigger building roster, expanded tech tree, prestige loop.

Delivered:

- **17 buildings** across six categories with `BuildingOps` blocks declaring consumes / produces / upkeep / powerNeed / waterNeed / supply / boost.
- **`game/simulate.ts` simulation engine** computing services + production + needs + happiness + training in seven ordered passes per tick.
- **Resources**: credits, research, wood, iron, stone, food, goods, tools. Tools loop closed (Workshop produces, harvest buildings optionally consume for +60% boost). Goods chain closed (Factory produces, Market sells, Residents buy).
- **Services**: power and water as computed-each-tick supply vs demand with free baselines (4 power, 5 water) for tiny cities. Producers linearly scale by `supply / demand`.
- **Population by job**: idle / worker / researcher / military with schools / academies / barracks for training.
- **Resident needs** (food / water / power / goods / jobs) drive happiness, which drives rent multiplier + grow/leave rate.
- **Rent + market sales as money sources**. No more "this building creates credits".
- **7-node tech tree** spanning the economy chain.
- **8-city world map + prestige loop**: each city has a milestone, travel between cities wipes local map but keeps techs and earns +5%/legacy production bonus.
- **Wonder** (3x3 multi-tile capstone) grants +5 legacy on completion.
- Save format bumped to v2.

## Phase 3 - VS Code extension + polish (shipped)

Scope: ship the VS Code extension wrapper so the game runs in a `WebviewPanel` next to your editor. Bridge the hook through the extension's Node fs since the webview iframe can't reach the File System Access API. Polish the moment-to-moment UX.

Delivered:

- **`extension/`** scaffolded with the `vscode` API. Single command (`nanofarm.open`) creates a `WebviewPanel`.
- **VSIX packaging** via `@vscode/vsce`. Self-contained bundle (`extension/dist/` carries the built game). `pnpm --filter nanofarm-extension reinstall` does build + package + install in one shot.
- **Storage bridge** through postMessage to `extensionContext.workspaceState` so each VS Code workspace gets its own city.
- **Hook bridge** through postMessage: the extension reads + truncates `~/.nanofarm/tokens.jsonl` itself and ships lines to the webview. Standalone `BrowserTokenDrainer` still works; new `VsCodeTokenDrainer` is preferred when in the webview.
- **Multi-tile buildings** (2x2, 3x3) with footprint-aware rendering, placement preview, hover outline, and connectivity.
- **Per-building pause toggle** in the inspector.
- **Inspector run-ratio + bottleneck label** ("short on workers / power / iron stockpile").
- **Live flow ticker** on credits + research + materials overlay.
- **Mutually exclusive HUD panels** (single panel open at a time).
- **Themed scrollbars** matching the dark olive theme.
- **Bootstrap fixes**: free baselines, cheaper school, +0.5 cr/s main, upkeep scales with run ratio, rent has 30% floor.
- **Save format gains `appVersion`** (read from package.json at build time).
- **Settings panel** with hook status, manual save now + last-saved timestamp, recenter, reset zoom, new run, app version.
- **Hover outline** on placed buildings.
- **Sandbox CSP fixes** to make PixiJS + Vite-bundled code run inside the VS Code webview.

## Phase 4 - events + offline progress + balance

Scope: refill the event system with content tuned for the new economy, add offline progress so closing the tab for a few hours produces a meaningful chunk on return, and run a balance pass on the per-second numbers.

Planned:

- **Event content**: 10-15 hand-authored events (e.g. "merchant caravan offers iron for credits", "fire at the lumber mill", "harvest festival"), including one branching chain. The event infrastructure (`events.ts`, `EventDialog`) is already in the tree; `EVENT_DEFS` is currently empty.
- **Offline progress calculator**: on load, take the difference between `meta.lastTickAt` and now (capped at 8 hours), replay against last-saved rates rather than re-simulating, surface a "while you were away" banner with totals.
- **Pause on tab hidden** to stop the loop while the user is in another tab (saves browser CPU). The fall-back replay handles re-entry.
- **Balance pass**: the first 5 minutes of play should hit a working market chain. The first 30 minutes should hit Heavy Industry. Currently the numbers feel reasonable but haven't been tuned to those targets explicitly.
- **A few more comfort / quality-of-life buildings**: park (small happiness boost area-of-effect), hospital (gates pop growth ceiling), entertainment (goods sink).
- **Wonders for other cities** so prestige feels more rewarding past the first travel.

## Phase 5 - nation layer + auto-resolve conflict

Scope: lift the game from "one city" to "one nation". Multiple cities active at once (not just travel-between), neighbors, auto-resolve combat, diplomacy events.

Planned:

- **Active multi-city play**: simulate every city in your nation in parallel, with a high-level dashboard to see them all.
- **Neighbors**: NPC city-states on the world map outside your control. They have their own economy.
- **Military mechanic**: the `military` job slot stops being vestigial. Barracks output feeds an `army` stat per city. Auto-resolve combat as a stat formula + small luck factor.
- **Diplomacy events**: trade pacts, demands, alliances. Outcomes affect resource flows or unlock joint research.

## Phase 6 - planet layer + multi-planet prestige

Scope: discover space, colonize new planets, prestige by settling. This is the long-loop content the prestige tree (legacy) is currently a small stand-in for.

Planned:

- **Spaceport** building producing exploration capacity.
- **Space discovery view**: scout neighbouring planets, pick a colonization target.
- **Settling a planet is the prestige reset**: spend the current planet's progress, earn starseed tokens, restart on a fresh planet with permanent multipliers.
- **Prestige upgrade tree**: spend starseed on lasting bonuses.
- **A small set of distinct planet types** (lush, arid, ice, tidally locked) with different starting conditions.

## Phase 7 - polish, theming, accessibility

Scope: visuals, sound (maybe), readability, optional VS Code theme integration.

Planned:

- A curated set of styled sprite states (idle, working, upgraded, damaged) for every building.
- Color theme tokens. A default theme plus at least one alternative.
- Optional VS Code theme integration: pick up `--vscode-*` CSS variables so the panel matches the editor's theme.
- Accessibility pass: keyboard navigation for build/buy/events, focus rings, readable contrast, reduced-motion mode.
- Optional audio (event chimes, button feedback) gated behind a sound toggle.

## Things explicitly not on the roadmap

- Multiplayer or shared worlds.
- Cloud sync (local-only is the design).
- Mobile-optimized layout.
- A marketplace, currency purchases, or ads.
- Analytics or crash reporting.
- Tactical combat. Wars stay auto-resolved.
- Reading code, tool inputs, or tool outputs through the hook. Counts only.

## Open questions

- Whether the event system should fire from triggers (resource threshold, building count, time elapsed) or pure random with a cooldown. Lean: triggered.
- How to surface offline progress without it feeling like "the game played itself" — banner + replay, but with what level of detail?
- Whether to support other AI tools (Copilot, Cursor, Codeium) in a later hook-adapter phase, or stay Claude-Code-only.
- Whether the legacy bonus from prestige should cap at some point or scale linearly forever. Today it's linear (+5% per point), no cap.
- Whether to add a "speed up" / "fast-forward" toggle for the simulation, or rely on offline progress for catch-up.
