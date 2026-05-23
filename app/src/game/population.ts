import type { GameState, JobId, PopulationByJob } from "@nanofarm/shared";
import { totalPopulation } from "@nanofarm/shared";
import {
  ACADEMY_TRAIN_RATE,
  BARRACKS_TRAIN_RATE,
  HOUSE_CAPACITY,
  POP_DECAY_RATE,
  POP_FOOD_RATE,
  POP_GROWTH_RATE,
  SCHOOL_TRAIN_RATE
} from "./buildings";

export interface PopulationTick {
  /** Change in total population (idle bucket grows / shrinks). */
  populationDelta: number;
  /** Potatoes consumed this tick. */
  foodConsumed: number;
  /** How much idle pop to convert into each trained job this tick.
   * Always non-negative; reducer clamps against available idle. */
  training: { worker: number; researcher: number; military: number };
}

/**
 * Computes the population delta, food consumption, and training
 * conversions for a single tick.
 *
 * Population grows toward capacity (sum of connected houses *
 * HOUSE_CAPACITY) at POP_GROWTH_RATE per second when there is enough
 * food. New growth always lands in the `idle` bucket - the player
 * needs schools / academies / barracks to convert idle citizens
 * into trained jobs.
 *
 * Hungry populations shrink at POP_DECAY_RATE per second. Shrinkage
 * is taken from the idle bucket first, then proportionally from
 * trained jobs.
 */
export function computePopulation(
  state: GameState,
  connected: Set<string>,
  dtSec: number
): PopulationTick {
  let connectedHouses = 0;
  let schools = 0;
  let academies = 0;
  let barracks = 0;
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (!connected.has(key)) continue;
    if (id === "house") connectedHouses++;
    else if (id === "school") schools++;
    else if (id === "academy") academies++;
    else if (id === "barracks") barracks++;
  }

  const capacity = connectedHouses * HOUSE_CAPACITY;
  const pop = totalPopulation(state.meta.population);
  const food = state.resources.potatoes;

  const desiredFood = pop * POP_FOOD_RATE * dtSec;
  let populationDelta = 0;
  let foodConsumed = desiredFood;

  if (food < desiredFood && pop > 0) {
    populationDelta = -Math.min(pop, POP_DECAY_RATE * dtSec);
    foodConsumed = food;
  } else if (pop < capacity) {
    populationDelta = Math.min(POP_GROWTH_RATE * dtSec, capacity - pop);
  } else if (pop > capacity) {
    populationDelta = -Math.min(POP_DECAY_RATE * dtSec, pop - capacity);
  }

  return {
    populationDelta,
    foodConsumed,
    training: {
      worker: schools * SCHOOL_TRAIN_RATE * dtSec,
      researcher: academies * ACADEMY_TRAIN_RATE * dtSec,
      military: barracks * BARRACKS_TRAIN_RATE * dtSec
    }
  };
}

/**
 * Apply a population tick to a PopulationByJob. New growth goes
 * into idle. Shrinkage drains idle first, then trained jobs
 * proportionally. Training moves idle citizens into the named job
 * bucket (capped by available idle).
 */
export function applyPopulationTick(
  current: PopulationByJob,
  tick: PopulationTick
): PopulationByJob {
  let next: PopulationByJob = { ...current };

  // Apply growth / shrinkage to idle first.
  const total = totalPopulation(next);
  if (tick.populationDelta >= 0) {
    next.idle += tick.populationDelta;
  } else {
    let remaining = -tick.populationDelta;
    const takeIdle = Math.min(next.idle, remaining);
    next.idle -= takeIdle;
    remaining -= takeIdle;
    if (remaining > 0 && total > next.idle) {
      // Trained jobs decay proportionally to their share of the
      // trained population.
      const trainedTotal = next.worker + next.researcher + next.military;
      if (trainedTotal > 0) {
        const scale = Math.min(1, remaining / trainedTotal);
        next.worker = Math.max(0, next.worker - next.worker * scale);
        next.researcher = Math.max(0, next.researcher - next.researcher * scale);
        next.military = Math.max(0, next.military - next.military * scale);
      }
    }
  }

  // Training conversions: pull from idle, push to job. Cap at
  // available idle so we never go negative.
  const trainOrder: Array<["worker" | "researcher" | "military", number]> = [
    ["worker", tick.training.worker],
    ["researcher", tick.training.researcher],
    ["military", tick.training.military]
  ];
  for (const [job, want] of trainOrder) {
    const take = Math.min(next.idle, Math.max(0, want));
    next.idle -= take;
    next[job] += take;
  }

  // Clamp tiny negatives caused by float math.
  for (const k of Object.keys(next) as JobId[]) {
    if (next[k] < 0) next[k] = 0;
  }
  return next;
}

export function populationCapacity(
  state: GameState,
  connected: Set<string>
): number {
  let houses = 0;
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (id !== "house") continue;
    if (!connected.has(key)) continue;
    houses++;
  }
  return houses * HOUSE_CAPACITY;
}
