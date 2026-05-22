import { DEFAULT_MAP_SIZE } from "./map";

export type ResourceId =
  | "credits"
  | "research"
  | "wood"
  | "iron"
  | "stone"
  | "water"
  | "potatoes";

export type ResourceMap = Record<ResourceId, number>;

export const RESOURCE_IDS: readonly ResourceId[] = [
  "credits",
  "research",
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

export type BuildingId = "main" | "farm" | "mine" | "house";

export const BUILDING_IDS: readonly BuildingId[] = ["main", "farm", "mine", "house"] as const;

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
  /** Current population. Fractional internally; displayed floored. */
  population: number;
}

export interface MapState {
  width: number;
  height: number;
  seed: number;
  /** map of "x,y" -> BuildingId. terrain is regenerated from the seed. */
  placed: Record<string, BuildingId>;
  /** set of road tiles, keyed "x,y". value is always true. */
  roads: Record<string, true>;
}

export interface GameState {
  meta: MetaState;
  resources: ResourceMap;
  buildings: BuildingsState;
  events: EventsState;
  map: MapState;
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
      population: 0
    },
    // Starting credits cover: main (free) + first farm (10) + a few roads
    // (2 each) so the player can route the farm to main if they didn't
    // land adjacent. With the previous 10 credits, dropping a farm one
    // tile off main left the player with 0 credits and a disconnected
    // producer - soft-locked.
    resources: { credits: 20, research: 0, wood: 0, iron: 0, stone: 0, water: 0, potatoes: 0 },
    buildings: {
      main: { id: "main", count: 0 },
      farm: { id: "farm", count: 0 },
      mine: { id: "mine", count: 0 },
      house: { id: "house", count: 0 }
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
      roads: {}
    }
  };
}
