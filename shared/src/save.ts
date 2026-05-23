import { BUILDING_IDS, TECH_IDS, type BuildingId, type GameState, type TechId } from "./state";
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
  // Backfill any BuildingId added since the save was written (lab,
  // lumber_mill, quarry, granary, market, factory all arrived after
  // the initial release).
  let buildingsPatch: typeof next.buildings | null = null;
  for (const id of BUILDING_IDS) {
    if (!next.buildings[id]) {
      if (!buildingsPatch) buildingsPatch = { ...next.buildings };
      buildingsPatch[id] = { id: id as BuildingId, count: 0 };
    }
  }
  if (buildingsPatch) {
    next = { ...next, buildings: buildingsPatch };
  }
  // Backfill the tech tree state for saves from before research was a
  // thing. Everything starts un-researched.
  if (!next.techs) {
    const techs = {} as Record<TechId, boolean>;
    for (const t of TECH_IDS) techs[t] = false;
    next = { ...next, techs };
  } else {
    let techsPatch: typeof next.techs | null = null;
    for (const t of TECH_IDS) {
      if (next.techs[t] === undefined) {
        if (!techsPatch) techsPatch = { ...next.techs };
        techsPatch[t] = false;
      }
    }
    if (techsPatch) {
      next = { ...next, techs: techsPatch };
    }
  }
  // Population migration: legacy `population: number` -> new
  // PopulationByJob record. Treat the old count as already-trained
  // workers so live saves keep their producers running.
  const meta = next.meta as unknown as { population?: unknown };
  if (typeof meta.population === "number") {
    next = {
      ...next,
      meta: {
        ...next.meta,
        population: {
          idle: 0,
          worker: meta.population,
          researcher: 0,
          military: 0
        }
      }
    };
  } else if (meta.population && typeof meta.population === "object") {
    // Already a record; backfill any missing job buckets.
    const p = meta.population as Partial<Record<string, number>>;
    next = {
      ...next,
      meta: {
        ...next.meta,
        population: {
          idle: p.idle ?? 0,
          worker: p.worker ?? 0,
          researcher: p.researcher ?? 0,
          military: p.military ?? 0
        }
      }
    };
  } else {
    next = {
      ...next,
      meta: {
        ...next.meta,
        population: { idle: 0, worker: 0, researcher: 0, military: 0 }
      }
    };
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
  // Backfill the world / prestige slice. Pre-world saves drop into
  // the starter city with no legacy.
  if (!next.world) {
    next = {
      ...next,
      world: {
        currentCity: "verdant_valley",
        completedCities: [],
        legacy: 0
      }
    };
  }
  return next;
}
