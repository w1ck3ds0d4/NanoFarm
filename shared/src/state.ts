import { DEFAULT_MAP_SIZE } from "./map";

// Resources are everything the player stockpiles. Utilities (power,
// water) are NOT resources - they are computed live each tick as a
// supply-vs-demand service and never persist between ticks.
export type ResourceId =
  | "credits"
  | "research"
  | "wood"
  | "iron"
  | "stone"
  | "food"
  | "goods"
  | "tools";

export type ResourceMap = Record<ResourceId, number>;

export const RESOURCE_IDS: readonly ResourceId[] = [
  "credits",
  "research",
  "wood",
  "iron",
  "stone",
  "food",
  "goods",
  "tools"
] as const;

/** Stockpiled commodities the player can see in the materials panel.
 * Excludes credits + research, which have their own HUD cells. */
export const MATERIAL_IDS: readonly ResourceId[] = [
  "wood",
  "iron",
  "stone",
  "food",
  "goods",
  "tools"
] as const;

export function totalMaterials(r: ResourceMap): number {
  return r.wood + r.iron + r.stone + r.food + r.goods + r.tools;
}

export type BuildingId =
  | "main"
  | "house"
  | "farm"
  | "lumber_mill"
  | "mine"
  | "quarry"
  | "water_pump"
  | "power_plant"
  | "workshop"
  | "factory"
  | "market"
  | "school"
  | "academy"
  | "barracks"
  | "lab"
  | "granary"
  | "wonder";

export const BUILDING_IDS: readonly BuildingId[] = [
  "main",
  "house",
  "farm",
  "lumber_mill",
  "mine",
  "quarry",
  "water_pump",
  "power_plant",
  "workshop",
  "factory",
  "market",
  "school",
  "academy",
  "barracks",
  "lab",
  "granary",
  "wonder"
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
  | "engineering"
  | "commerce"
  | "metallurgy"
  | "heavy_industry"
  | "education";

export const TECH_IDS: readonly TechId[] = [
  "agriculture",
  "industry",
  "engineering",
  "commerce",
  "metallurgy",
  "heavy_industry",
  "education"
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

export interface ServicesSnapshot {
  powerSupply: number;
  powerDemand: number;
  waterSupply: number;
  waterDemand: number;
}

export interface MetaState {
  startedAt: number;
  lastTickAt: number;
  hookDrainedAt: number;
  totalAiTokensEarned: number;
  /** Current population split by job. Fractional internally;
   * displayed floored. Sum is the player-visible population number. */
  population: PopulationByJob;
  /** Citywide happiness 0-100, averaged across needs. Drives
   * rent multiplier + leave rate. Computed from the previous
   * tick's needs check; persisted so the HUD can display it. */
  happiness: number;
  /** Last-tick power/water supply and demand totals. Lives on meta
   * so the HUD can render the city's utility status without
   * re-running the simulation. */
  services: ServicesSnapshot;
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
      population: { idle: 0, worker: 0, researcher: 0, military: 0 },
      happiness: 100,
      services: { powerSupply: 0, powerDemand: 0, waterSupply: 0, waterDemand: 0 }
    },
    // Bootstrap budget: enough credits + raw materials to build main +
    // farm + house + school in one go, plus reserve for a couple of
    // roads. After that the economy takes over: schools train
    // workers, mills make wood, rent rolls in.
    resources: {
      credits: 120,
      research: 0,
      wood: 15,
      iron: 0,
      stone: 0,
      food: 15,
      goods: 0,
      tools: 0
    },
    buildings: {
      main: { id: "main", count: 0 },
      house: { id: "house", count: 0 },
      farm: { id: "farm", count: 0 },
      lumber_mill: { id: "lumber_mill", count: 0 },
      mine: { id: "mine", count: 0 },
      quarry: { id: "quarry", count: 0 },
      water_pump: { id: "water_pump", count: 0 },
      power_plant: { id: "power_plant", count: 0 },
      workshop: { id: "workshop", count: 0 },
      factory: { id: "factory", count: 0 },
      market: { id: "market", count: 0 },
      school: { id: "school", count: 0 },
      academy: { id: "academy", count: 0 },
      barracks: { id: "barracks", count: 0 },
      lab: { id: "lab", count: 0 },
      granary: { id: "granary", count: 0 },
      wonder: { id: "wonder", count: 0 }
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
      engineering: false,
      commerce: false,
      metallurgy: false,
      heavy_industry: false,
      education: false
    },
    world: {
      currentCity: "verdant_valley",
      completedCities: [],
      legacy: 0
    }
  };
}
