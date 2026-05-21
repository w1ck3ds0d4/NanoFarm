export type ResourceId = "credits" | "materials" | "research";

export type ResourceMap = Record<ResourceId, number>;

export const RESOURCE_IDS: readonly ResourceId[] = ["credits", "materials", "research"] as const;

export type BuildingId = "farm" | "mine";

export const BUILDING_IDS: readonly BuildingId[] = ["farm", "mine"] as const;

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
}

export interface GameState {
  meta: MetaState;
  resources: ResourceMap;
  buildings: BuildingsState;
  events: EventsState;
}

export function makeInitialState(now: number): GameState {
  return {
    meta: {
      startedAt: now,
      lastTickAt: now,
      hookDrainedAt: 0,
      totalAiTokensEarned: 0
    },
    resources: { credits: 0, materials: 0, research: 0 },
    buildings: {
      farm: { id: "farm", count: 0 },
      mine: { id: "mine", count: 0 }
    },
    events: {
      firedIds: [],
      queuedIds: [],
      activeId: null,
      scheduled: []
    }
  };
}
