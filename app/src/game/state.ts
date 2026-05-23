import {
  type GameState,
  type BuildingId,
  type CityId,
  type EventEffect,
  type ResourceMap,
  type ResourceId,
  type TechId,
  MATERIAL_IDS,
  makeInitialState
} from "@nanofarm/shared";
import { CITY_DEFS, legacyBonus } from "./cities";
import {
  BUILDING_DEFS,
  ROAD_COST,
  TECH_DEFS,
  canAffordMaterials,
  costFor,
  productionFor,
  type NeighborBuildings
} from "./buildings";

export type Action =
  | { type: "hydrate"; state: GameState }
  | {
      type: "tick";
      now: number;
      produced: ResourceMap;
      populationDelta: number;
      foodConsumed: number;
    }
  | { type: "place-building"; building: BuildingId; x: number; y: number }
  | { type: "remove-building"; x: number; y: number }
  | { type: "place-road"; x: number; y: number }
  | { type: "research-tech"; tech: TechId }
  | { type: "travel-city"; city: CityId; now: number }
  | { type: "queue-event"; eventId: string }
  | { type: "open-event"; eventId: string }
  | { type: "resolve-event"; eventId: string }
  | { type: "apply-effects"; effects: EventEffect[] }
  | { type: "grant-ai-tokens"; tools: string[]; now: number }
  | { type: "schedule-event"; eventId: string; fireAt: number }
  | { type: "reset"; now: number };

function emptyResources(): ResourceMap {
  return { credits: 0, research: 0, wood: 0, iron: 0, stone: 0, water: 0, potatoes: 0 };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "hydrate": {
      return action.state;
    }
    case "tick": {
      const r = state.resources;
      const nextPotatoes = Math.max(
        0,
        r.potatoes + action.produced.potatoes - action.foodConsumed
      );
      const nextPopulation = Math.max(
        0,
        state.meta.population + action.populationDelta
      );
      return {
        ...state,
        meta: {
          ...state.meta,
          lastTickAt: action.now,
          population: nextPopulation
        },
        resources: {
          credits: r.credits + action.produced.credits,
          research: r.research + action.produced.research,
          wood: r.wood + action.produced.wood,
          iron: r.iron + action.produced.iron,
          stone: r.stone + action.produced.stone,
          water: r.water + action.produced.water,
          potatoes: nextPotatoes
        }
      };
    }
    case "place-building": {
      const def = BUILDING_DEFS[action.building];
      const owned = state.buildings[action.building].count;
      if (def.maxCount !== undefined && owned >= def.maxCount) return state;
      // Tech-gated buildings stay un-placeable until their tech is
      // researched, even if the player conjures the action elsewhere.
      if (def.requiresTech && !state.techs[def.requiresTech]) return state;
      const cost = costFor(def, owned);
      if (state.resources.credits < cost) return state;
      if (!canAffordMaterials(def, state.resources as unknown as Record<string, number>)) return state;
      const key = `${action.x},${action.y}`;
      if (state.map.placed[key]) return state;
      if (state.map.roads[key]) return state;
      // Non-main buildings must touch main or a road on a 4-cardinal
      // neighbour. Without this check the player can spend credits on a
      // stranded farm/house/mine that never connects and never produces,
      // which combined with the post-purchase 0-credit state is a
      // soft-lock. The BuildPalette hint already tells the player this;
      // the reducer now enforces it.
      if (action.building !== "main") {
        const neighbors: Array<[number, number]> = [
          [action.x - 1, action.y],
          [action.x + 1, action.y],
          [action.x, action.y - 1],
          [action.x, action.y + 1],
        ];
        const connectsToNetwork = neighbors.some(([nx, ny]) => {
          const nKey = `${nx},${ny}`;
          if (state.map.roads[nKey]) return true;
          if (state.map.placed[nKey] === "main") return true;
          return false;
        });
        if (!connectsToNetwork) return state;
      }
      const nextResources: ResourceMap = {
        ...state.resources,
        credits: state.resources.credits - cost
      };
      if (def.materialCost) {
        for (const [mat, amt] of Object.entries(def.materialCost)) {
          const k = mat as ResourceId;
          nextResources[k] = Math.max(0, nextResources[k] - (amt ?? 0));
        }
      }
      return {
        ...state,
        resources: nextResources,
        buildings: {
          ...state.buildings,
          [action.building]: { id: action.building, count: owned + 1 }
        },
        map: {
          ...state.map,
          placed: { ...state.map.placed, [key]: action.building }
        }
      };
    }
    case "remove-building": {
      const rKey = `${action.x},${action.y}`;
      const id = state.map.placed[rKey];
      if (!id) return state;
      // Main is the network anchor; removing it would orphan every
      // other building and is rarely what the player meant. The
      // inspector hides the remove button for main, but guard at the
      // reducer too so an out-of-UI dispatch can't strand the world.
      if (id === "main") return state;
      const def = BUILDING_DEFS[id];
      const count = state.buildings[id].count;
      if (count <= 0) return state;
      // Refund 50% of the most-recent placement cost. cost grows with
      // count, so the "last" one paid was costFor(def, count - 1).
      // Floor to keep credits as integers.
      const lastCost = costFor(def, count - 1);
      const refund = Math.floor(lastCost * 0.5);
      const nextPlaced: typeof state.map.placed = { ...state.map.placed };
      delete nextPlaced[rKey];
      const refundedResources: ResourceMap = {
        ...state.resources,
        credits: state.resources.credits + refund
      };
      // Materials refund 50% (floored, integer). Materials are flat,
      // not growing with count, so the refund equation is symmetric.
      if (def.materialCost) {
        for (const [mat, amt] of Object.entries(def.materialCost)) {
          const k = mat as ResourceId;
          refundedResources[k] = refundedResources[k] + Math.floor((amt ?? 0) * 0.5);
        }
      }
      return {
        ...state,
        resources: refundedResources,
        buildings: {
          ...state.buildings,
          [id]: { id, count: count - 1 }
        },
        map: { ...state.map, placed: nextPlaced }
      };
    }
    case "place-road": {
      const cost = ROAD_COST;
      if (state.resources.credits < cost) return state;
      const key = `${action.x},${action.y}`;
      if (state.map.placed[key]) return state;
      if (state.map.roads[key]) return state;
      // Roads must extend the existing network: each new road has to
      // touch main, another road, or an already-placed building on a
      // 4-cardinal neighbour. Without this rule the player could drop
      // road tiles in random spots and the connectivity BFS (which
      // starts at main and walks adjacent roads) would never reach
      // them - they cost credits but provide no network. The user
      // reported exactly this: "two roads that don't connect to each
      // other". They now do, by construction.
      const roadNeighbors: Array<[number, number]> = [
        [action.x - 1, action.y],
        [action.x + 1, action.y],
        [action.x, action.y - 1],
        [action.x, action.y + 1],
      ];
      const connectsToNetwork = roadNeighbors.some(([nx, ny]) => {
        const nKey = `${nx},${ny}`;
        if (state.map.roads[nKey]) return true;
        if (state.map.placed[nKey]) return true; // main OR any building
        return false;
      });
      if (!connectsToNetwork) return state;
      return {
        ...state,
        resources: { ...state.resources, credits: state.resources.credits - cost },
        map: {
          ...state.map,
          roads: { ...state.map.roads, [key]: true }
        }
      };
    }
    case "travel-city": {
      const def = CITY_DEFS[action.city];
      if (!def) return state;
      const w = state.world;
      // Prereqs: every previous city must already be in completedCities
      // (so you can only travel to cities you have unlocked).
      for (const p of def.prereqs) {
        if (!w.completedCities.includes(p)) return state;
      }
      // If we are leaving the current city and its milestone is met,
      // mark it settled and award legacy +1. Travelling back to a
      // city we have already settled does not award legacy again.
      let nextCompleted = w.completedCities;
      let nextLegacy = w.legacy;
      const currentDef = CITY_DEFS[w.currentCity];
      const isSettling =
        currentDef &&
        currentDef.isMilestoneMet(state) &&
        !w.completedCities.includes(w.currentCity);
      if (isSettling) {
        nextCompleted = [...w.completedCities, w.currentCity];
        nextLegacy = w.legacy + 1;
      }
      // Travelling wipes the local map and resources (it is a
      // prestige in everything but name) while keeping techs &
      // legacy. Techs persist because they represent player knowledge
      // - it would be cruel to re-research everything every move.
      const fresh = makeInitialState(action.now);
      return {
        ...fresh,
        techs: state.techs,
        world: {
          currentCity: action.city,
          completedCities: nextCompleted,
          legacy: nextLegacy
        }
      };
    }
    case "research-tech": {
      const def = TECH_DEFS[action.tech];
      if (!def) return state;
      if (state.techs[action.tech]) return state; // already researched
      if (state.resources.research < def.cost) return state;
      // Prereqs must all be researched first.
      for (const p of def.prereqs) {
        if (!state.techs[p]) return state;
      }
      return {
        ...state,
        resources: {
          ...state.resources,
          research: state.resources.research - def.cost
        },
        techs: { ...state.techs, [action.tech]: true }
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
      const each = amount / MATERIAL_IDS.length;
      return {
        ...state,
        meta: {
          ...state.meta,
          hookDrainedAt: action.now,
          totalAiTokensEarned: state.meta.totalAiTokensEarned + amount
        },
        resources: {
          ...state.resources,
          wood: state.resources.wood + each,
          iron: state.resources.iron + each,
          stone: state.resources.stone + each,
          water: state.resources.water + each
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

/** Count the 4-cardinal neighbours of (x, y) that are granaries or
 * markets, for district-style adjacency bonuses in productionFor. */
function neighborBuildingsAt(
  state: GameState,
  x: number,
  y: number
): NeighborBuildings {
  const out: NeighborBuildings = { granary: 0, market: 0 };
  const around: Array<[number, number]> = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ];
  for (const [nx, ny] of around) {
    const id = state.map.placed[`${nx},${ny}`];
    if (id === "granary") out.granary++;
    else if (id === "market") out.market++;
  }
  return out;
}

export function computeProduction(
  state: GameState,
  connected: Set<string>,
  neighborsAt: (x: number, y: number) => import("@nanofarm/shared").TerrainType[],
  dtSec: number
): ResourceMap {
  const out = emptyResources();
  // Prestige multiplier: each settled city left behind adds +5% to
  // every producer's output. Applied uniformly so the world map's
  // prestige loop has a tangible global effect.
  const legacyMult = legacyBonus(state.world?.legacy ?? 0);
  for (const [key, id] of Object.entries(state.map.placed) as [string, BuildingId][]) {
    if (id === "main") continue; // main itself does not produce
    if (!connected.has(key)) continue; // disconnected buildings are idle
    const [x, y] = key.split(",").map(Number);
    const rules = productionFor(id, neighborsAt(x, y), neighborBuildingsAt(state, x, y));
    for (const k of Object.keys(rules) as ResourceId[]) {
      const v = rules[k] ?? 0;
      out[k] += v * dtSec * legacyMult;
    }
  }
  return out;
}
