import {
  type GameState,
  type BuildingId,
  type EventEffect,
  makeInitialState
} from "@nanofarm/shared";
import { BUILDING_DEFS, costFor } from "./buildings";

export type Action =
  | { type: "hydrate"; state: GameState }
  | { type: "harvest" }
  | { type: "tick"; dt: number; now: number }
  | { type: "buy-building"; building: BuildingId }
  | { type: "queue-event"; eventId: string }
  | { type: "open-event"; eventId: string }
  | { type: "resolve-event"; eventId: string }
  | { type: "apply-effects"; effects: EventEffect[] }
  | { type: "grant-ai-tokens"; tools: string[]; now: number }
  | { type: "schedule-event"; eventId: string; fireAt: number }
  | { type: "reset"; now: number };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "hydrate": {
      return action.state;
    }
    case "harvest": {
      return {
        ...state,
        resources: { ...state.resources, credits: state.resources.credits + 1 }
      };
    }
    case "tick": {
      const { dt, now } = action;
      const next: Record<string, number> = { ...state.resources };
      for (const id of Object.keys(state.buildings) as BuildingId[]) {
        const def = BUILDING_DEFS[id];
        const owned = state.buildings[id].count;
        if (owned <= 0) continue;
        const out = def.produces;
        next[out.resource] = (next[out.resource] ?? 0) + out.ratePerSecond * owned * dt;
      }
      return {
        ...state,
        meta: { ...state.meta, lastTickAt: now },
        resources: next as GameState["resources"]
      };
    }
    case "buy-building": {
      const def = BUILDING_DEFS[action.building];
      const owned = state.buildings[action.building].count;
      const cost = costFor(def, owned);
      if (state.resources.credits < cost) return state;
      return {
        ...state,
        resources: { ...state.resources, credits: state.resources.credits - cost },
        buildings: {
          ...state.buildings,
          [action.building]: { id: action.building, count: owned + 1 }
        }
      };
    }
    case "queue-event": {
      if (state.events.firedIds.includes(action.eventId)) return state;
      if (state.events.queuedIds.includes(action.eventId)) return state;
      if (state.events.activeId === action.eventId) return state;
      return {
        ...state,
        events: {
          ...state.events,
          queuedIds: [...state.events.queuedIds, action.eventId]
        }
      };
    }
    case "open-event": {
      const queue = state.events.queuedIds.filter((id) => id !== action.eventId);
      return {
        ...state,
        events: { ...state.events, activeId: action.eventId, queuedIds: queue }
      };
    }
    case "resolve-event": {
      return {
        ...state,
        events: {
          ...state.events,
          activeId: null,
          firedIds: [...state.events.firedIds, action.eventId]
        }
      };
    }
    case "apply-effects": {
      let next = state;
      for (const eff of action.effects) {
        if (eff.kind === "grant") {
          next = {
            ...next,
            resources: {
              ...next.resources,
              [eff.resource]: next.resources[eff.resource] + eff.amount
            }
          };
        } else if (eff.kind === "deduct") {
          next = {
            ...next,
            resources: {
              ...next.resources,
              [eff.resource]: Math.max(0, next.resources[eff.resource] - eff.amount)
            }
          };
        }
      }
      return next;
    }
    case "grant-ai-tokens": {
      const amount = action.tools.length;
      return {
        ...state,
        meta: {
          ...state.meta,
          hookDrainedAt: action.now,
          totalAiTokensEarned: state.meta.totalAiTokensEarned + amount
        },
        resources: {
          ...state.resources,
          materials: state.resources.materials + amount
        }
      };
    }
    case "schedule-event": {
      return {
        ...state,
        events: {
          ...state.events,
          scheduled: [
            ...state.events.scheduled,
            { eventId: action.eventId, fireAt: action.fireAt }
          ]
        }
      };
    }
    case "reset": {
      return makeInitialState(action.now);
    }
  }
}
