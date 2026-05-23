# How It Works

NanoFarm is a SimCity-style idle game where you grow a city on a 150x150 iso map. You place a main building, run roads, set up a production chain (raw materials → intermediates → consumer goods → credits via market sales), keep residents fed and watered and employed, and eventually research your way through a tech tree until you can build the Wonder and prestige into a new city.

Connected buildings produce; disconnected ones sit idle and dim. Buildings that lack staff or utilities scale down their output. Buildings with optional tool boosts get a +60% bump when tools are in stock. With Claude Code wired up, every tool call your coding session makes feeds bonus raw materials into the city.

## What you do, in one paragraph

You start with 120 credits, 15 wood, 15 food, and a procgen 150x150 map. Place the Main Building, drop a Farm (10 cr), build a House (30 cr + 2 wood), then a School (60 cr + 2 wood). The Farm produces food from the free water baseline (5 supply). Residents move in (capacity 10 per house) and start paying rent. The School converts idle residents into workers. Once you have your first worker, place a Lumber Mill in a forest — it produces wood. From there: Mine → iron, Workshop → tools (boosts mills/mines), Academy → researchers, Lab → research points, tech tree → unlocks Factory (goods), Market (sells goods for big credits), Power Plant, eventually Wonder.

## Resources

Eight stockpiled resources:

- **Credits** — currency. Earned by **markets selling goods** and **residents paying rent**. Spent on construction and ongoing upkeep. Main building provides a small `+0.5/s` baseline so an empty city always has a trickle.
- **Research** — long-term progression. Produced by labs (staffed by researchers). Spent on tech tree nodes.
- **Wood** — raw material. From Lumber Mills. Spent on most construction.
- **Iron** — raw material. From Mines. Spent on industrial / late-game construction.
- **Stone** — raw material. From Mines (small byproduct) or Quarries (specialist). Spent on industrial construction.
- **Food** — consumed by residents (0.02/sec each). Produced by Farms and Granaries. Empty stockpile → unhappy residents → they leave.
- **Goods** — manufactured. Produced by Factories from wood + iron. Consumed by Markets (turned into credits) and Residents (consumed at 0.01/sec each).
- **Tools** — manufactured. Produced by Workshops from stone + iron. Optional boost (+60%) for Mines / Quarries / Lumber Mills when in stock.

Two **services** that are NOT stockpiled (computed live each tick):

- **Power** — supplied by Windmills, Power Plants, and a free baseline (4). Demanded by every industrial building + every resident (0.02/sec each).
- **Water** — supplied by Wells, Water Pumps, and a free baseline (5). Demanded by Farms + every resident (0.02/sec each).

When demand exceeds supply, every consumer scales output by `supply / demand`. So a city short on power has every industrial building running at the same fraction.

## Buildings (17 total)

### Core
- **Main Building** — anchor + civic income (+0.5 cr/s, upkeep 0.1). Free, max 1.
- **House** — 30 cr + 2 wood. Provides 10 pop capacity. No staff. Residents consume food/water/power/goods and pay rent.
- **Road** — free. Mandatory connectivity from main; non-connected buildings stop producing.

### Harvest (raw materials)
- **Farm** — 10 cr. Produces 0.6 food/s. Needs 1 water. Granary neighbors give +50% food each (capped +200%).
- **Lumber Mill** — 50 cr + 2 wood, 1 worker, 1 power. Produces 0.5 wood/s. Tools boost +60%.
- **Mine** — 100 cr + 3 wood, 2 workers, 1 power. Produces 0.4 iron + 0.1 stone (byproduct) per sec. Tools boost +60%.
- **Quarry** — 150 cr + 5 wood, 2 workers, 1 power. Produces 0.5 stone/s. Tools boost +60%. Requires Industry tech.
- **Well** — 60 cr + 3 wood, 1 worker. Supplies 4 water/s. Early-game water source.
- **Water Pump** — 90 cr + 2 wood + 1 iron, 1 worker, 2 power. Supplies 8 water/s. Requires Engineering tech.
- **Granary** — 80 cr + 5 wood, 1 worker. Produces 0.2 food/s + buffs adjacent farms. Requires Agriculture tech.

### Industry
- **Windmill** — 120 cr + 5 wood, no staff. Supplies 6 power/s. Early-game power source.
- **Workshop** — 200 cr + 4 wood + 2 iron, 2 workers, 1 power. Consumes 0.3 stone + 0.3 iron per sec, produces 0.3 tools/s. Requires Industry tech.
- **Factory** — 400 cr + 4 wood + 6 stone + 4 iron, 4 workers, 2 power. Consumes 0.5 wood + 0.5 iron per sec, produces 0.6 goods/s. Requires Heavy Industry tech.
- **Power Plant** — 600 cr + 4 wood + 10 stone + 6 iron (2x2 footprint), 4 workers. Supplies 20 power/s. Requires Heavy Industry tech.

### Commerce
- **Market** — 200 cr + 4 wood, 2 workers, 1 power. Consumes 1.0 goods/s, produces 6.0 credits/s. Requires Commerce tech. **Primary income source for a developed city.**

### People (training)
- **School** — 60 cr + 2 wood. Trains 0.2 workers/s from idle pop.
- **Academy** — 150 cr + 4 wood. Trains 0.15 researchers/s.
- **Barracks** — 120 cr + 3 wood + 2 iron. Trains 0.15 military/s. (Military isn't consumed by anything yet — placeholder for future combat.)

### Tech
- **Research Lab** — 120 cr + 4 wood, 1 **researcher**, 1 power. Produces 0.15 research/s (+50% with Education tech).
- **Wonder** — 5000 cr + 20 wood + 40 stone + 30 iron (3x3 footprint, max 1). Produces 0.5 research + 2 credits per sec. **Grants +5 legacy on completion.**

## Tech tree (7 nodes)

Research points are spent in the **Research panel** (click the RS HUD cell):

| Tech | Cost (rp) | Prereqs | Unlocks / effect |
|---|---|---|---|
| Agriculture | 10 | — | Granary |
| Industry | 25 | — | Quarry + Workshop |
| Engineering | 30 | — | Water Pump |
| Commerce | 40 | Agriculture | Market |
| Metallurgy | 80 | Industry | (no building — gates Heavy Industry) |
| Heavy Industry | 120 | Industry + Metallurgy | Power Plant + Factory + Wonder |
| Education | 60 | Agriculture | +50% Research Lab output (passive) |

## Population and happiness

Residents live in Houses (10 capacity each). They split across four job buckets:

- **idle** — newly grown, no training. Don't staff anything.
- **worker** — staff most buildings.
- **researcher** — staff labs. Trained by academies (not schools).
- **military** — trained by barracks. No use yet.

Per resident, per second:
- Eat 0.02 food (stockpile drain)
- Use 0.02 water (adds to citywide water demand)
- Use 0.02 power (adds to citywide power demand)
- Buy 0.01 goods (stockpile drain)
- Want a job (worker/researcher slot)

**Happiness** is computed each tick:
- Survival = (food ratio + water ratio) / 2, weighted 80%
- Comfort = (power ratio + goods ratio + jobs ratio) / 3, weighted 20%
- Empty city = 100

Above 70 → city grows toward house capacity. Below 50 → residents leave. Rent scales linearly with happiness, floored at 30% (even angry residents pay something).

Click the `HPY` HUD cell to open the **needs panel** for a per-need breakdown with progress bars.

## The world map and prestige

Click the **map** button in the bottom-left to open the world map. Eight cities laid out as a hex grid:

```
        AETHER SPIRE
       /            \
   SKYHOLD       IRON REACH
        \         /
        STONEHAVEN
        /          \
   FROSTPEAK     PINEWOOD
        \         /
       VERDANT VALLEY (starter)
            |
         GREENMARSH
```

Each city has a **milestone** (e.g. Verdant Valley = "house 50 residents", Iron Reach = "build 3 factories"). Meeting it lets you **travel** to a connected city, which:

1. Wipes your current city's map + stockpiles
2. Keeps your tech tree (knowledge persists)
3. Awards **+1 legacy** for settling the source city
4. Awards **+5 legacy** if you completed a Wonder before traveling

Legacy = **+5% production per point**, applied citywide, permanently. The intended long loop is: settle Verdant Valley → unlock + build through Wonder → travel to Stonehaven → repeat.

## Building hover + inspect

- **Hover** any tile of a placed building → a thin white outline wraps the full footprint, and a tooltip shows the building's name + current production rate (scaled by run ratio).
- **Click** when nothing is selected → the **Inspector** opens. Shows current run ratio (e.g. "running at 60% — short on workers"), staffing requirement, utility needs, every input/output flow line, the optional tool boost status, and a pause button + a remove button with refund preview.

The placement preview (when a building is selected) renders the same footprint outline: **green** if all tiles are buildable + free, **red** if any tile is blocked.

## Production chain (closes properly)

```
forest --> Lumber Mill --> wood --+
                                  +--> Factory --> goods --> Market --> credits
ore     --> Mine ---------> iron -+                            ^
                          +iron --> Workshop --> tools --> (boosts harvest)
mountain --> Quarry  --> stone --+

field    --> Farm   --> food   --> residents
spring   --> Well/Pump --> water-service --> farms + residents
wind     --> Mill/Plant --> power-service --> industry + residents

residents --> rent --> credits
```

The two terminal outputs are **rent** (from happy residents) and **market sales** (goods → credits). Without markets, your only income is rent — fine for a tiny city, insufficient for a large one.

## Roads and connectivity

1. The main building must exist before any other building functions.
2. A road tile is "reachable" if it touches main or another reachable road.
3. A building is "connected" if **any** footprint tile touches main, a reachable road, or another placed building.
4. Connected buildings function; disconnected buildings render at 45% opacity and produce zero.
5. Multi-tile buildings (Power Plant, Wonder) are treated uniformly — if any footprint tile is adjacent to the network, the whole building is connected.

Connectivity is recomputed each tick by BFS. Bridging two clusters reactivates everything in the merged subgraph instantly.

## The Claude Code hook

If you install the hook (see [hooks/INSTALL.md](hooks/INSTALL.md)), every tool call your Claude Code session makes is recorded to `~/.nanofarm/tokens.jsonl`. The game reads that file every second and converts each line into a basket of raw materials split across wood / iron / stone / food.

The bonus is **additive**. A typical idle city pulls in a steady trickle from production; the hook bumps that rate proportionally to how much you're actually coding.

**In the VS Code extension**: the file is read by the extension's Node process and shipped to the webview over `postMessage`. Zero player setup beyond installing the hook script.

**In standalone Chromium**: you click "connect hook" in Settings, point the file picker at `~/.nanofarm/tokens.jsonl`, and the browser remembers the choice via the File System Access API.

The hook does not read your code, your tool inputs, or your tool outputs. It writes one record per tool call: `{ t: <ms>, tool: "<name>", v: 1 }`.

## Auto-save

The game writes the full state to storage every 5 seconds, plus on tab hide / page unload. Settings → "save now" forces a write. The "saved 12s ago" indicator next to the button updates live so you can see the heartbeat.

Save format includes the app version (read from `package.json` at build time) so future bug reports can identify which build wrote a save.

- **VS Code extension**: save lives in `extensionContext.workspaceState` — per-workspace, persistent across reloads + extension reinstalls
- **Standalone**: save lives in `localStorage["nanofarm.save"]` — per-browser-origin, wiped when you clear site data

Save version is currently 2. Future schema changes that can't auto-migrate will reset the city (the v1 → v2 jump did exactly that when the SimCity economy landed).

## What NanoFarm does not do

- No leaderboards, ranking, social features.
- No microtransactions, no ads, no cosmetic shop.
- No cloud sync. Local-only.
- No telemetry. Zero network calls at runtime.
- No anti-cheat. It's your save; edit it however you want.
- No tactical combat (military is currently vestigial — wars, if added, will be auto-resolved stat comparisons).
- No reading of your code or tool I/O by the hook. Counts only.
