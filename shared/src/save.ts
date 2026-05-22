import type { GameState } from "./state";
import { DEFAULT_MAP_SIZE } from "./map";

export type SaveVersion = 1;

export const CURRENT_SAVE_VERSION: SaveVersion = 1;

export interface SaveBlob {
  version: SaveVersion;
  savedAt: number;
  state: GameState;
}

/**
 * Older v1 saves did not have `map`. Backfill a default so the new loader
 * does not have to special-case missing fields.
 */
export function hydrateMissingFields(state: GameState): GameState {
  let next = state;
  if (!next.map) {
    next = {
      ...next,
      map: {
        width: DEFAULT_MAP_SIZE,
        height: DEFAULT_MAP_SIZE,
        seed: Math.floor(Math.random() * 0x7fffffff),
        placed: {},
        roads: {}
      }
    };
  } else if (!next.map.roads) {
    next = { ...next, map: { ...next.map, roads: {} } };
  }
  if (!next.buildings.main) {
    next = {
      ...next,
      buildings: {
        ...next.buildings,
        main: { id: "main", count: 0 }
      }
    };
  }
  if (!next.buildings.house) {
    next = {
      ...next,
      buildings: {
        ...next.buildings,
        house: { id: "house", count: 0 }
      }
    };
  }
  if (typeof next.meta.population !== "number") {
    next = { ...next, meta: { ...next.meta, population: 0 } };
  }
  // old `materials: number` shape: split equally into wood/iron/stone/water
  const r = next.resources as Record<string, number>;
  if (typeof r.materials === "number" && (r.wood === undefined || r.iron === undefined)) {
    const m = r.materials;
    const each = m / 4;
    next = {
      ...next,
      resources: {
        credits: r.credits ?? 0,
        research: r.research ?? 0,
        wood: each,
        iron: each,
        stone: each,
        water: each,
        potatoes: 0
      }
    };
  } else if (r.wood === undefined) {
    next = {
      ...next,
      resources: {
        credits: r.credits ?? 0,
        research: r.research ?? 0,
        wood: 0,
        iron: 0,
        stone: 0,
        water: 0,
        potatoes: 0
      }
    };
  } else if (r.potatoes === undefined) {
    next = {
      ...next,
      resources: {
        ...next.resources,
        potatoes: 0
      }
    };
  }
  return next;
}
