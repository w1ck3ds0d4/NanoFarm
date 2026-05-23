/**
 * SimCity-style per-tick simulation.
 *
 * Each tick we run three phases in order:
 *
 *   1. SUPPLY/DEMAND - sum citywide power supply (power_plant outputs),
 *      water supply (water_pump outputs, gated by power), staffing
 *      demand by job type, and per-resource consumption demand
 *      (intermediate goods + resident needs). Compute service ratios.
 *
 *   2. PRODUCTION - for each connected building, compute its run
 *      ratio (the minimum of staffing, power, water, and per-input
 *      ratios). Consume inputs and produce outputs scaled by that
 *      ratio. Apply upkeep regardless of ratio.
 *
 *   3. PEOPLE - residents eat food, drink water (service), use power
 *      (service), buy goods. Happiness is the average of those need
 *      satisfaction ratios + job availability. Rent is paid scaled
 *      by happiness. Population grows when happy and housed; shrinks
 *      otherwise.
 *
 * Returns a TickResult the reducer applies in one shot.
 */

import type {
  BuildingId,
  GameState,
  JobId,
  PopulationByJob,
  ResourceId
} from "@nanofarm/shared";
import { totalPopulation } from "@nanofarm/shared";
import {
  ACADEMY_TRAIN_RATE,
  BARRACKS_TRAIN_RATE,
  BUILDING_DEFS,
  FREE_POWER_BASELINE,
  FREE_WATER_BASELINE,
  HOUSE_CAPACITY,
  POP_DECAY_RATE,
  POP_DEMAND,
  POP_GROWTH_RATE,
  RENT_PER_RESIDENT,
  SCHOOL_TRAIN_RATE,
  TECH_PRODUCTION_BONUS
} from "./buildings";
import { legacyBonus } from "./cities";

/** Citywide service status. Persisted on the result so HUD can render
 * "power 12/18 supply" or similar without re-deriving. */
export interface ServiceStatus {
  powerSupply: number;
  powerDemand: number;
  powerRatio: number;
  waterSupply: number;
  waterDemand: number;
  waterRatio: number;
}

/** Resident-needs breakdown for the happiness panel. Each ratio is
 * 0..1, where 1 = fully met. */
export interface NeedsStatus {
  food: number;
  water: number;
  power: number;
  goods: number;
  jobs: number;
}

export interface TickResult {
  /** Resource deltas to apply to the stockpile. Signed: consumption
   * is negative, production positive. */
  resourceDeltas: Partial<Record<ResourceId, number>>;
  /** Population deltas: idle growth/shrink + trained conversions. */
  populationDelta: number;
  training: { worker: number; researcher: number; military: number };
  /** Forced layoffs: when staffed jobs disappear (building removed,
   * unstaffed by shortage), trained workers return to idle. Today
   * we just track gross conversions; future could shift layoffs back
   * to idle. */
  /** Computed happiness for the HUD (0..100). */
  happiness: number;
  /** Service snapshot (for HUD display). */
  services: ServiceStatus;
  /** Needs snapshot (for happiness drilldown). */
  needs: NeedsStatus;
  /** Citywide totals (for stats / debugging / future achievements). */
  jobsAvailable: number;
  jobSeekers: number;
}

function emptyDeltas(): Partial<Record<ResourceId, number>> {
  return {};
}

function add(
  bag: Partial<Record<ResourceId, number>>,
  res: ResourceId,
  amt: number
): void {
  bag[res] = (bag[res] ?? 0) + amt;
}

export function simulateTick(
  state: GameState,
  connected: Set<string>,
  dtSec: number
): TickResult {
  const origins = state.map.multiTileOrigin ?? {};
  const legacyMult = legacyBonus(state.world?.legacy ?? 0);

  // ─── Pass 0: enumerate "live" buildings (connected, origin tile) ────────
  // These are the only ones that participate in supply/demand/production.

  type LiveBuilding = { key: string; id: BuildingId };
  const live: LiveBuilding[] = [];
  const disabled = state.map.disabled ?? {};
  for (const [key, id] of Object.entries(state.map.placed) as [
    string,
    BuildingId,
  ][]) {
    if (origins[key]) continue; // skip non-origin footprint tiles
    if (id !== "main" && !connected.has(key)) continue;
    // Paused buildings still count as connected for adjacency but
    // do nothing operational. Upkeep is applied separately below
    // so the player keeps paying for idle slabs of concrete.
    if (disabled[key]) continue;
    live.push({ key, id });
  }

  // Apply upkeep to disabled-but-connected buildings (they still owe
  // rent; that's part of the cost of pausing rather than removing).
  const upkeepOnlyKeys: string[] = [];
  for (const [key, id] of Object.entries(state.map.placed) as [
    string,
    BuildingId,
  ][]) {
    if (origins[key]) continue;
    if (id === "main") continue;
    if (!connected.has(key)) continue;
    if (!disabled[key]) continue;
    upkeepOnlyKeys.push(key);
  }

  // ─── Pass 1: staffing demand → staffing ratios ──────────────────────────

  let workerDemand = 0;
  let researcherDemand = 0;
  let militaryDemand = 0;
  for (const { id } of live) {
    const need = BUILDING_DEFS[id]?.staffNeed;
    if (!need) continue;
    workerDemand += need.worker ?? 0;
    researcherDemand += need.researcher ?? 0;
    militaryDemand += need.military ?? 0;
  }
  const pop = state.meta.population;
  const workerRatio = ratioOf(pop.worker, workerDemand);
  const researcherRatio = ratioOf(pop.researcher, researcherDemand);
  const militaryRatio = ratioOf(pop.military, militaryDemand);

  // Helper: per-building staffing ratio (min across required job types).
  function staffRatio(id: BuildingId): number {
    const need = BUILDING_DEFS[id]?.staffNeed;
    if (!need) return 1;
    let r = 1;
    if (need.worker) r = Math.min(r, workerRatio);
    if (need.researcher) r = Math.min(r, researcherRatio);
    if (need.military) r = Math.min(r, militaryRatio);
    return r;
  }

  // ─── Pass 2: power supply / demand ──────────────────────────────────────
  // Power plants supply * their staff ratio. Demand comes from every
  // powered building + every resident. Water_pump's power demand is
  // included here, so the pump's water output (next pass) is properly
  // gated by available power.

  // Every city starts with a small baseline (rivers, microgrids,
  // springs) so the player can run a few light buildings before
  // committing to dedicated infrastructure.
  let powerSupply = FREE_POWER_BASELINE;
  for (const { id } of live) {
    const ops = BUILDING_DEFS[id]?.ops;
    if (!ops?.powerSupply) continue;
    powerSupply += ops.powerSupply * staffRatio(id);
  }

  const residents = totalPopulation(pop);
  let powerDemand = residents * POP_DEMAND.power;
  for (const { id } of live) {
    const ops = BUILDING_DEFS[id]?.ops;
    if (ops?.powerNeed) powerDemand += ops.powerNeed;
  }
  const powerRatio = ratioOf(powerSupply, powerDemand);

  // ─── Pass 3: water supply / demand ──────────────────────────────────────

  let waterSupply = FREE_WATER_BASELINE;
  for (const { id } of live) {
    const ops = BUILDING_DEFS[id]?.ops;
    if (!ops?.waterSupply) continue;
    // Pump's water output is gated by both staffing AND power.
    const r = Math.min(staffRatio(id), ops.powerNeed ? powerRatio : 1);
    waterSupply += ops.waterSupply * r;
  }

  let waterDemand = residents * POP_DEMAND.water;
  for (const { id } of live) {
    const ops = BUILDING_DEFS[id]?.ops;
    if (ops?.waterNeed) waterDemand += ops.waterNeed;
  }
  const waterRatio = ratioOf(waterSupply, waterDemand);

  // ─── Pass 4: input availability ratios ──────────────────────────────────
  // For each consumable resource, sum global demand THIS TICK from
  // every consumer building (scaled by staff + utility ratios so we
  // do not overpromise consumption a building can't actually do), then
  // compute how much the stockpile can cover.

  const inputDemand: Partial<Record<ResourceId, number>> = {};
  // Track each live building's "intended" run ratio (without input
  // gating yet) so the input-demand sum reflects only what we'd
  // actually try to consume.
  const intendedRatio = new Map<string, number>();
  for (const lb of live) {
    const ops = BUILDING_DEFS[lb.id]?.ops;
    if (!ops) {
      intendedRatio.set(lb.key, 1);
      continue;
    }
    let r = staffRatio(lb.id);
    if (ops.powerNeed) r = Math.min(r, powerRatio);
    if (ops.waterNeed) r = Math.min(r, waterRatio);
    intendedRatio.set(lb.key, r);
    if (ops.consumes) {
      for (const [res, amt] of Object.entries(ops.consumes)) {
        inputDemand[res as ResourceId] =
          (inputDemand[res as ResourceId] ?? 0) + (amt ?? 0) * r * dtSec;
      }
    }
  }

  // Resident food + goods demand for this tick.
  inputDemand.food = (inputDemand.food ?? 0) + residents * POP_DEMAND.food * dtSec;
  inputDemand.goods = (inputDemand.goods ?? 0) + residents * POP_DEMAND.goods * dtSec;

  const inputRatio: Partial<Record<ResourceId, number>> = {};
  for (const k of Object.keys(inputDemand) as ResourceId[]) {
    const demand = inputDemand[k] ?? 0;
    const have = state.resources[k] ?? 0;
    inputRatio[k] = demand === 0 ? 1 : Math.min(1, have / demand);
  }

  // ─── Pass 5: production + consumption ───────────────────────────────────

  const deltas = emptyDeltas();
  for (const lb of live) {
    const def = BUILDING_DEFS[lb.id];
    if (!def?.ops) continue;
    let runRatio = intendedRatio.get(lb.key) ?? 1;
    if (def.ops.consumes) {
      for (const [res] of Object.entries(def.ops.consumes)) {
        const r = inputRatio[res as ResourceId] ?? 1;
        if (r < runRatio) runRatio = r;
      }
    }
    if (def.ops.consumes) {
      for (const [res, amt] of Object.entries(def.ops.consumes)) {
        add(deltas, res as ResourceId, -(amt ?? 0) * runRatio * dtSec);
      }
    }
    // Optional boost: if every input is in stock, multiply output
     // and drain the input. We check stockpile (not per-tick demand
     // ratio) so the boost auto-enables/disables as resources flow
     // in and out.
    let boostMult = 1;
    if (def.ops.boost) {
      const b = def.ops.boost;
      let boostActive = true;
      for (const [res, amt] of Object.entries(b.consumes)) {
        const need = (amt ?? 0) * runRatio * dtSec;
        if ((state.resources[res as ResourceId] ?? 0) < need) {
          boostActive = false;
          break;
        }
      }
      if (boostActive) {
        boostMult = b.multiplier;
        for (const [res, amt] of Object.entries(b.consumes)) {
          add(deltas, res as ResourceId, -(amt ?? 0) * runRatio * dtSec);
        }
      }
    }
    if (def.ops.produces) {
      // Granary district bonus: each 4-cardinal neighbour granary
      // adds +50% to a farm's food output, capped at +200%.
      const granaryBonus =
        lb.id === "farm" ? farmGranaryBonus(state, lb.key) : 1;
      // Tech-based production bonus (e.g. Education -> +50% lab
      // research). Looks up TECH_PRODUCTION_BONUS for any tech that
      // is researched AND targets this building.
      let techMult = 1;
      for (const [techId, bonus] of Object.entries(TECH_PRODUCTION_BONUS)) {
        if (!bonus) continue;
        if (bonus.building !== lb.id) continue;
        if (state.techs[techId as keyof typeof state.techs]) {
          techMult *= bonus.multiplier;
        }
      }
      for (const [res, amt] of Object.entries(def.ops.produces)) {
        const mult = res === "food" ? granaryBonus : 1;
        add(
          deltas,
          res as ResourceId,
          (amt ?? 0) * runRatio * legacyMult * boostMult * mult * techMult * dtSec,
        );
      }
    }
    if (def.ops.upkeep) {
      // Upkeep scales with run ratio so an idle / understaffed
      // building costs less to keep around. Floor at 30% so even
      // a totally dead building still bleeds something - dropping
      // to zero would make "drop a factory and never connect it"
      // free, which is silly.
      const upkeepMult = Math.max(0.3, runRatio);
      add(deltas, "credits", -def.ops.upkeep * upkeepMult * dtSec);
    }
  }

  // Paused buildings cost half upkeep. Pausing is the player's
  // explicit "shut this down to save money" lever; full upkeep would
  // make it pointless, zero would make it strictly better than the
  // intended use case (removing the building).
  for (const key of upkeepOnlyKeys) {
    const id = state.map.placed[key] as BuildingId;
    const upkeep = BUILDING_DEFS[id]?.ops?.upkeep;
    if (upkeep) add(deltas, "credits", -upkeep * 0.5 * dtSec);
  }

  // Resident consumption: deduct what they actually eat / buy
  // (capped at what's available, computed via inputRatio).
  const foodEaten =
    residents * POP_DEMAND.food * dtSec * (inputRatio.food ?? 1);
  const goodsBought =
    residents * POP_DEMAND.goods * dtSec * (inputRatio.goods ?? 1);
  add(deltas, "food", -foodEaten);
  add(deltas, "goods", -goodsBought);

  // ─── Pass 6: happiness, rent, population ────────────────────────────────

  // Job availability: civilian residents (idle + worker + researcher
  // - military is professional, not job-seeking) versus civilian
  // job slots (worker + researcher demand). When residents
  // outnumber slots, unemployment drags happiness.
  const jobsAvailable = workerDemand + researcherDemand;
  const jobSeekers = pop.idle + pop.worker + pop.researcher;
  const jobsRatio = ratioOf(jobsAvailable, Math.max(1, jobSeekers));

  // Per-need 0..1 ratios.
  const needs: NeedsStatus = {
    food: inputRatio.food ?? 1,
    water: waterRatio,
    power: powerRatio,
    goods: inputRatio.goods ?? 1,
    jobs: jobsRatio
  };
  // Survival vs comfort split:
  //   - Survival (food, water) is the base. Both met -> 80 happiness.
  //     If either is short, happiness drops fast (linear in shortage).
  //   - Comfort (power, goods, jobs) is a bonus. Each one met adds
  //     ~7 happiness, so a fully-served city tops out at ~100.
  // This means bootstrap cities (food + water from baseline supply,
  // no power plant, no factory, no jobs) sit at ~80 happiness - in
  // the growth band - instead of stalling at 30.
  let happiness: number;
  if (residents === 0) {
    happiness = 100;
  } else {
    const survival = (needs.food + needs.water) / 2; // 0..1
    const comfortBonus =
      ((needs.power >= 0.5 ? 1 : needs.power * 2) +
        (needs.goods >= 0.5 ? 1 : needs.goods * 2) +
        (needs.jobs >= 0.5 ? 1 : needs.jobs * 2)) /
      3;
    happiness = Math.round(
      Math.max(0, Math.min(100, survival * 80 + comfortBonus * 20)),
    );
  }

  // Rent: every resident pays per second, scaled by happiness with
  // a 30% floor. Even miserable residents still pay something - they
  // can't easily relocate (you'd see the population leave instead),
  // and the floor prevents a happiness death spiral from also
  // zeroing income.
  const rentMult = Math.max(0.3, happiness / 100);
  const rent = residents * RENT_PER_RESIDENT * rentMult * dtSec;
  add(deltas, "credits", rent);

  // ─── Pass 7: population growth / shrinkage + training ────────────────────

  const capacity = countHouses(state, connected) * HOUSE_CAPACITY;
  let populationDelta = 0;
  if (happiness >= 70 && residents < capacity) {
    populationDelta = Math.min(POP_GROWTH_RATE * dtSec, capacity - residents);
  } else if (happiness < 50 && residents > 0) {
    // Worse than 50 -> people leave. Steeper the lower the happiness.
    const leaveScale = (50 - happiness) / 50;
    populationDelta = -Math.min(residents, leaveScale * POP_DECAY_RATE * dtSec);
  } else if (residents > capacity) {
    // Housing collapsed: bleed off the excess regardless of happiness.
    populationDelta = -Math.min(residents - capacity, POP_DECAY_RATE * dtSec);
  }

  // Training: schools / academies / barracks convert idle into
  // trained jobs.
  let schools = 0;
  let academies = 0;
  let barracks = 0;
  for (const { id } of live) {
    if (id === "school") schools++;
    else if (id === "academy") academies++;
    else if (id === "barracks") barracks++;
  }
  const training = {
    worker: schools * SCHOOL_TRAIN_RATE * dtSec,
    researcher: academies * ACADEMY_TRAIN_RATE * dtSec,
    military: barracks * BARRACKS_TRAIN_RATE * dtSec
  };

  return {
    resourceDeltas: deltas,
    populationDelta,
    training,
    happiness,
    services: {
      powerSupply,
      powerDemand,
      powerRatio,
      waterSupply,
      waterDemand,
      waterRatio
    },
    needs,
    jobsAvailable,
    jobSeekers
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ratioOf(supply: number, demand: number): number {
  if (demand <= 0) return 1;
  return Math.min(1, supply / demand);
}

/** +50% food per adjacent granary, capped at +200%. Single-tile
 * neighbours only - multi-tile granary footprints would need a
 * different lookup. (No multi-tile granary exists today.) */
function farmGranaryBonus(state: GameState, key: string): number {
  const [xs, ys] = key.split(",");
  const x = Number(xs);
  const y = Number(ys);
  let granaries = 0;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    if (state.map.placed[`${x + dx},${y + dy}`] === "granary") granaries++;
  }
  return 1 + Math.min(2, granaries * 0.5);
}

function countHouses(state: GameState, connected: Set<string>): number {
  let n = 0;
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (id !== "house") continue;
    if (!connected.has(key)) continue;
    n++;
  }
  return n;
}

/** Apply growth / shrinkage to idle first, then trained jobs
 * proportionally if shrinkage runs out of idle. Then apply
 * training conversions (idle -> trained). */
export function applyPopulationDelta(
  current: PopulationByJob,
  delta: number,
  training: { worker: number; researcher: number; military: number }
): PopulationByJob {
  const next: PopulationByJob = { ...current };

  if (delta >= 0) {
    next.idle += delta;
  } else {
    let remaining = -delta;
    const takeIdle = Math.min(next.idle, remaining);
    next.idle -= takeIdle;
    remaining -= takeIdle;
    if (remaining > 0) {
      const trainedTotal = next.worker + next.researcher + next.military;
      if (trainedTotal > 0) {
        const scale = Math.min(1, remaining / trainedTotal);
        next.worker = Math.max(0, next.worker - next.worker * scale);
        next.researcher = Math.max(0, next.researcher - next.researcher * scale);
        next.military = Math.max(0, next.military - next.military * scale);
      }
    }
  }

  const order: Array<["worker" | "researcher" | "military", number]> = [
    ["worker", training.worker],
    ["researcher", training.researcher],
    ["military", training.military]
  ];
  for (const [job, want] of order) {
    const take = Math.min(next.idle, Math.max(0, want));
    next.idle -= take;
    next[job] += take;
  }

  for (const k of Object.keys(next) as JobId[]) {
    if (next[k] < 0) next[k] = 0;
  }
  return next;
}
