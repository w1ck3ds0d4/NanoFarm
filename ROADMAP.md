# NanoFarm v1 Roadmap

## What v1 is

A tiny pixel-art idle city builder powered by Claude Code tool usage:
production accelerates from in-editor tool calls logged via a hook bridge.
Ships in two surfaces (standalone Vite web app + VS Code extension) with a
shared game core, isometric 32x16 tile rendering, procgen biome map, and
versioned localStorage saves.

## Current state

Phase 1 (playable prototype) shipped: 150x150 procgen world (grass / sand /
water / forest / mountain / mine_deposit), isometric rendering, main building
+ road connectivity, farms / mines with terrain bonuses, material subtypes
HUD, `PostToolUse` hook draining `~/.nanofarm/tokens.jsonl`, versioned saves,
extension webview wrapper packaged as VSIX 0.1.0. Event system infrastructure
is in tree but `EVENT_DEFS` is empty and there are zero tests.

## v1 acceptance criteria

- [x] Procgen world + isometric rendering + viewport culling
- [x] Build flow with road connectivity (BFS, disconnected dimmed)
- [x] Material subtypes HUD + floating pie chart
- [x] Save / load with versioned migration
- [x] Claude Code `PostToolUse` hook + FSA + IndexedDB drainer
- [x] VS Code extension webview wrapper (VSIX 0.1.0)
- [x] Standalone Vite web app
- [ ] Event system content: at least 5 `EVENT_DEFS` (raid, drought, harvest festival, road wash-out, traveling trader)
- [ ] Test suite (Vitest) covering save migration, BFS connectivity, terrain bonus math
- [ ] CI gates (lint, tsc, build, package) beyond the SecureCheck workflow
- [ ] Extension `activationEvents` populated; an in-editor entry point ("Start NanoFarm" in the activity bar)
- [ ] First VS Code Marketplace listing (preview category if needed)
- [ ] Manual smoke test on a clean VS Code install + a fresh browser tab

## Milestones to v1

### M1. Event system content (S/M)

- [ ] Populate `EVENT_DEFS` with 5 events (trigger, duration, effect, art)
- [ ] Wire event spawning into the main tick loop
- [ ] Test triggers + effects under Vitest

**Acceptance:** during a 10-minute idle session, players see at least one event spawn and resolve.

### M2. Test suite (S)

- [ ] Add Vitest config to `app/` and `shared/`
- [ ] Unit-test `hydrateMissingFields` migration path
- [ ] Unit-test BFS road connectivity edge cases (island, donut, single tile)
- [ ] Unit-test terrain bonus math per building type

**Acceptance:** at least 20 unit tests, `pnpm test` exits 0.

### M3. CI gates (S)

- [ ] Add `.github/workflows/ci.yml` running `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `vsce package`
- [ ] Upload the packaged VSIX as a workflow artifact

**Acceptance:** every PR is gated; main is green; VSIX downloadable per push.

### M4. Extension discoverability (S)

- [ ] Populate `activationEvents` with a startup trigger
- [ ] Add a status-bar entry and an activity-bar icon
- [ ] Add a walkthrough contribution for first-install onboarding

**Acceptance:** a fresh VS Code with NanoFarm installed discovers the game without typing into the command palette.

### M5. Marketplace listing + tag (S/M)

- [ ] Marketplace listing: icon, screenshots, gif, README adaptation
- [ ] `vsce publish` (Preview category if Phase 2 isn't shipped)
- [ ] Tag `v1.0.0` after a clean install smoke test

**Acceptance:** published listing, install link in README, v1.0.0 tagged.

## Beyond v1 (post-1.0 polish)

- Phase 2: research / lab / tech tree
- Phase 3: multiple cities, diplomacy, terrain attack/defense
- Audio + ambient SFX
- Hook drainer ESM path resolution polish for non-PowerShell environments
- Cosmetic skins for buildings / characters

## Out of scope for v1

- Multiplayer
- Real-time saves to a cloud
- Mobile distribution (web app works in mobile browsers but is not optimized)
