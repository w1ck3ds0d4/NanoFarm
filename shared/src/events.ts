import type { ResourceId, BuildingId } from "./state";

export type EventTrigger =
  | { kind: "milestone"; resource: ResourceId; gte: number }
  | { kind: "time"; minutesSinceStart: number }
  | { kind: "ai-tokens"; gte: number }
  | { kind: "after"; eventId: string; afterMinutes: number };

export type EventEffect =
  | { kind: "grant"; resource: ResourceId; amount: number }
  | { kind: "deduct"; resource: ResourceId; amount: number }
  | { kind: "unlock-building"; building: BuildingId }
  | { kind: "set-flag"; flag: string };

export interface EventChoice {
  label: string;
  effects: EventEffect[];
  followUp?: { eventId: string; afterMinutes: number };
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  trigger: EventTrigger;
  choices: EventChoice[];
  oncePerRun?: boolean;
}
