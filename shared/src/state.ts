import { DEFAULT_MAP_SIZE } from "./map";

export type ResourceId =
  | "credits"
  | "research"
  | "electricity"
  | "wood"
  | "iron"
  | "stone"
  | "water"
  | "potatoes";

export type ResourceMap = Record<ResourceId, number>;

export const RESOURCE_IDS: readonly ResourceId[] = [
  "credits",
  "research",
  "electricity",
  "wood",
  "iron",
  "stone",
  "water",
  "potatoes"
] as const;

export const MATERIAL_IDS: readonly ResourceId[] = [
  "wood",
  "iron",
  "stone",
  "water",
  "potatoes"
] as const;

export function totalMaterials(r: ResourceMap): number {
  return r.wood + r.iron + r.stone + r.water + r.potatoes;
}

export type BuildingId =
  | "main"
  | "farm"
  | "mine"
  | "house"
  | "lab"
  | "lumber_mill"
  | "quarry"
  | "granary"
  | "market"
  | "factory"
  | "school"
  | "academy"
  | "barracks"
  | "power_plant"
  | "wonder"
  | "water_pump";

export const BUILDING_IDS: readonly BuildingId[] = [
  "main",
  "farm",
  "mine",
  "house",
  "lab",
  "lumber_mill",
  "quarry",
  "granary",
  "market",
  "factory",
  "school",
  "academy",
  "barracks",
  "power_plant",
  "wonder",
  "water_pump",
] as const;

export type JobId = "idle" | "worker" | "researcher" | "military";

export const JOB_IDS: readonly JobId[] = ["idle", "worker", "researcher", "military"] as const;

export type PopulationByJob = Record<JobId, number>;

export function totalPopulation(p: PopulationByJob): number {
  return p.idle + p.worker + p.researcher + p.military;
}

export type TechId =
  | "agriculture"
  | "industry"
  | "commerce"
  | "heavy_industry";

export const TECH_IDS: readonly TechId[] = [
  "agriculture",
  "industry",
  "commerce",
  "heavy_industry",
] as const;

export type TechState = Record<TechId, boolean>;

export type CityId =
  | "verdant_valley"
  | "pinewood"
  | "greenmarsh"
  | "stonehaven"
  | "frostpeak"
  | "iron_reach"
  | "skyhold"
  | "aether_spire";

export const CITY_IDS: readonly CityId[] = [
  "verdant_valley",
  "pinewood",
  "greenmarsh",
  "stonehaven",
  "frostpeak",
  "iron_reach",
  "skyhold",
  "aether_spire"
] as const;

export interface WorldState {
  /** Where the player is currently living. The local map is the map
   * of this city. */
  currentCity: CityId;
  /** Cities whose milestone has been completed at least once. Order
   * matters: it's the chronological list of successful prestiges. */
  completedCities: CityId[];
  /** Accumulated prestige currency. Each settled city awards +1.
   * Spent implicitly as a passive production buff via legacyBonus(). */
  legacy: number;
}

export interface BuildingState {
  id: BuildingId;
  count: number;
}

export type BuildingsState = Record<BuildingId, BuildingState>;

export interface ScheduledEvent {
  eventId: string;
  fireAt: number;
}

export interface EventsState {
  firedIds: string[];
  queuedIds: string[];
  activeId: string | null;
  scheduled: ScheduledEvent[];
}

export interface MetaState {
  startedAt: number;
  lastTickAt: number;
  hookDrainedAt: number;
  totalAiTokensEarned: number;
  /** Current population split by job. Fractional internally;
   * displayed floored. Sum is the player-visible population number. */
  population: PopulationByJob;
}

export interface MapState {
  width: number;
  height: number;
  seed: number;
  /** map of "x,y" -> BuildingId. EVERY footprint tile of a building
   * is stamped here, so occupancy checks remain a single lookup
   * regardless of building size. */
  placed: Record<string, BuildingId>;
  /** Footprint tile key -> origin tile key. Only populated for
   * multi-tile buildings; for 1x1 the entry is absent and the
   * caller treats the tile itself as the origin. Used by render +
   * remove + inspector to find the canonical anchor of a building. */
  multiTileOrigin?: Record<string, string>;
  /** set of road tiles, keyed "x,y". value is always true. */
  roads: Record<string, true>;
}

export interface GameState {
  meta: MetaState;
  resources: ResourceMap;
  buildings: BuildingsState;
  events: EventsState;
  map: MapState;
  techs: TechState;
  world: WorldState;
}

function pickSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function makeInitialState(now: number, seed?: number): GameState {
  return {
    meta: {
      startedAt: now,
      lastTickAt: now,
      hookDrainedAt: 0,
      totalAiTokensEarned: 0,
      population: { idle: 0, worker: 0, researcher: 0, military: 0 }
    },
    // Starting credits cover: main (free) + first farm (10) + a few roads
    // (2 each) so the player can route the farm to main if they didn't
    // land adjacent. With the previous 10 credits, dropping a farm one
    // tile off main left the player with 0 credits and a disconnected
    // producer - soft-locked.
    resources: { credits: 20, research: 0, electricity: 0, wood: 0, iron: 0, stone: 0, water: 0, potatoes: 0 },
    buildings: {
      main: { id: "main", count: 0 },
      farm: { id: "farm", count: 0 },
      mine: { id: "mine", count: 0 },
      house: { id: "house", count: 0 },
      lab: { id: "lab", count: 0 },
      lumber_mill: { id: "lumber_mill", count: 0 },
      quarry: { id: "quarry", count: 0 },
      granary: { id: "granary", count: 0 },
      market: { id: "market", count: 0 },
      factory: { id: "factory", count: 0 },
      school: { id: "school", count: 0 },
      academy: { id: "academy", count: 0 },
      barracks: { id: "barracks", count: 0 },
      power_plant: { id: "power_plant", count: 0 },
      wonder: { id: "wonder", count: 0 },
      water_pump: { id: "water_pump", count: 0 }
    },
    events: {
      firedIds: [],
      queuedIds: [],
      activeId: null,
      scheduled: []
    },
    map: {
      width: DEFAULT_MAP_SIZE,
      height: DEFAULT_MAP_SIZE,
      seed: seed ?? pickSeed(),
      placed: {},
      multiTileOrigin: {},
      roads: {}
    },
    techs: {
      agriculture: false,
      industry: false,
      commerce: false,
      heavy_industry: false
    },
    world: {
      currentCity: "verdant_valley",
      completedCities: [],
      legacy: 0
    }
  };
}
