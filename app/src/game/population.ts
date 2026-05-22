import type { GameState } from "@nanofarm/shared";
import {
  HOUSE_CAPACITY,
  POP_DECAY_RATE,
  POP_FOOD_RATE,
  POP_GROWTH_RATE
} from "./buildings";

export interface PopulationTick {
  /** Change in population to apply this tick (positive grows, negative shrinks). */
  populationDelta: number;
  /** Potatoes consumed this tick (always >= 0). Subtracted from the resource. */
  foodConsumed: number;
}

/**
 * Computes the population delta and food consumption for a single tick.
 * - Population grows toward capacity (sum of connected houses * HOUSE_CAPACITY)
 *   at POP_GROWTH_RATE per second when there is enough food.
 * - If food runs out, population shrinks at POP_DECAY_RATE per second.
 * - Food consumption is POP_FOOD_RATE potatoes per person per second.
 *
 * Houses must be in the `connected` set to count toward capacity, matching
 * how other buildings only function when road-connected to main.
 */
export function computePopulation(
  state: GameState,
  connected: Set<string>,
  dtSec: number
): PopulationTick {
  let connectedHouses = 0;
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (id !== "house") continue;
    if (!connected.has(key)) continue;
    connectedHouses++;
  }

  const capacity = connectedHouses * HOUSE_CAPACITY;
  const pop = state.meta.population;
  const food = state.resources.potatoes;

  // hungry population shrinks regardless of capacity.
  const desiredFood = pop * POP_FOOD_RATE * dtSec;
  if (food < desiredFood && pop > 0) {
    // not enough food this tick: shrink, consume what is available.
    const decay = Math.min(pop, POP_DECAY_RATE * dtSec);
    return { populationDelta: -decay, foodConsumed: food };
  }

  // fed. grow toward capacity if there is room, otherwise hold steady.
  let delta = 0;
  if (pop < capacity) {
    delta = Math.min(POP_GROWTH_RATE * dtSec, capacity - pop);
  } else if (pop > capacity) {
    // capacity dropped (e.g. a house was disconnected). bleed off the excess.
    delta = -Math.min(POP_DECAY_RATE * dtSec, pop - capacity);
  }
  return { populationDelta: delta, foodConsumed: desiredFood };
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
