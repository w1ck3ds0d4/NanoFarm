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
  buildingSize,
  canAffordMaterials,
  costFor,
  productionFor,
  type NeighborBuildings
} from "./buildings";
import { applyPopulationTick, type PopulationTick } from "./population";

export type Action =
  | { type: "hydrate"; state: GameState }
  | {
      type: "tick";
      now: number;
      produced: ResourceMap;
      popTick: PopulationTick;
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
  return { credits: 0, research: 0, electricity: 0, wood: 0, iron: 0, stone: 0, water: 0, potatoes: 0 };
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
        r.potatoes + action.produced.potatoes - action.popTick.foodConsumed
      );
      const nextPopulation = applyPopulationTick(state.meta.population, action.popTick);
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
          electricity: r.electricity + action.produced.electricity,
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
      if (def.requiresTech && !state.techs[def.requiresTech]) return state;
      const cost = costFor(def, owned);
      if (state.resources.credits < cost) return state;
      if (!canAffordMaterials(def, state.resources as unknown as Record<string, number>)) return state;
      // Footprint covers (ox..ox+size-1, oy..oy+size-1). For size=1
      // this is a single tile, matching the legacy code path.
      const size = buildingSize(action.building);
      const footprint: Array<[number, number, string]> = [];
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const fx = action.x + dx;
          const fy = action.y + dy;
          footprint.push([fx, fy, `${fx},${fy}`]);
        }
      }
      // Every footprint tile must be in-bounds, unoccupied, and not a
      // road. We check bounds against map width/height.
      for (const [fx, fy, fkey] of footprint) {
        if (fx < 0 || fx >= state.map.width) return state;
        if (fy < 0 || fy >= state.map.height) return state;
        if (state.map.placed[fkey]) return state;
        if (state.map.roads[fkey]) return state;
      }
      // Connectivity: any of the footprint tiles must touch main or a
      // road on a 4-cardinal neighbour. Tiles INSIDE the footprint
      // do not count as neighbours of each other (would be self-
      // satisfying for size >= 2). Main is the exception - it places
      // anywhere.
      if (action.building !== "main") {
        const footprintKeys = new Set(footprint.map(([, , k]) => k));
        const connectsToNetwork = footprint.some(([fx, fy]) => {
          const around: Array<[number, number]> = [
            [fx - 1, fy], [fx + 1, fy], [fx, fy - 1], [fx, fy + 1]
          ];
          return around.some(([nx, ny]) => {
            const nKey = `${nx},${ny}`;
            if (footprintKeys.has(nKey)) return false;
            if (state.map.roads[nKey]) return true;
            if (state.map.placed[nKey]) return true; // main or any building
            return false;
          });
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
      const nextPlaced = { ...state.map.placed };
      const nextOrigins = { ...(state.map.multiTileOrigin ?? {}) };
      const originKey = `${action.x},${action.y}`;
      for (const [, , fkey] of footprint) {
        nextPlaced[fkey] = action.building;
        if (fkey !== originKey) nextOrigins[fkey] = originKey;
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
          placed: nextPlaced,
          multiTileOrigin: nextOrigins
        }
      };
    }
    case "remove-building": {
      const rKey = `${action.x},${action.y}`;
      const id = state.map.placed[rKey];
      if (!id) return state;
      if (id === "main") return state;
      const def = BUILDING_DEFS[id];
      const count = state.buildings[id].count;
      if (count <= 0) return state;
      // Resolve the origin tile - the caller may have clicked any
      // tile within a multi-tile footprint. From the origin, we
      // re-derive the full footprint by building size.
      const origins = state.map.multiTileOrigin ?? {};
      const originKey = origins[rKey] ?? rKey;
      const [oxStr, oyStr] = originKey.split(",");
      const ox = Number(oxStr);
      const oy = Number(oyStr);
      const size = buildingSize(id);
      const lastCost = costFor(def, count - 1);
      const refund = Math.floor(lastCost * 0.5);
      const nextPlaced: typeof state.map.placed = { ...state.map.placed };
      const nextOrigins: Record<string, string> = { ...origins };
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const fk = `${ox + dx},${oy + dy}`;
          delete nextPlaced[fk];
          delete nextOrigins[fk];
        }
      }
      const refundedResources: ResourceMap = {
        ...state.resources,
        credits: state.resources.credits + refund
      };
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
        map: { ...state.map, placed: nextPlaced, multiTileOrigin: nextOrigins }
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
  const legacyMult = legacyBonus(state.world?.legacy ?? 0);

  // Total demand for each staff type, summed across connected,
  // staff-needing buildings. Disconnected buildings are idle so they
  // do not draw staff. Multi-tile buildings only count their origin
  // tile - every footprint tile shares the same BuildingId in
  // `placed`, so we have to skip the non-origin entries here.
  const origins = state.map.multiTileOrigin ?? {};
  let workerDemand = 0;
  let researcherDemand = 0;
  let militaryDemand = 0;
  for (const [key, id] of Object.entries(state.map.placed) as [string, BuildingId][]) {
    if (id === "main") continue;
    if (origins[key]) continue; // non-origin footprint tile
    if (!connected.has(key)) continue;
    const need = BUILDING_DEFS[id]?.staffNeed;
    if (!need) continue;
    workerDemand += need.worker ?? 0;
    researcherDemand += need.researcher ?? 0;
    militaryDemand += need.military ?? 0;
  }
  const pop = state.meta.population;
  const workerRatio =
    workerDemand === 0 ? 1 : Math.min(1, pop.worker / workerDemand);
  const researcherRatio =
    researcherDemand === 0 ? 1 : Math.min(1, pop.researcher / researcherDemand);
  const militaryRatio =
    militaryDemand === 0 ? 1 : Math.min(1, pop.military / militaryDemand);

  for (const [key, id] of Object.entries(state.map.placed) as [string, BuildingId][]) {
    if (id === "main") continue;
    if (origins[key]) continue; // non-origin footprint tile - already counted via origin
    if (!connected.has(key)) continue;
    const [x, y] = key.split(",").map(Number);
    const rules = productionFor(id, neighborsAt(x, y), neighborBuildingsAt(state, x, y));
    // Buildings with multiple staff types are scaled by the
    // worst-staffed type, so an understaffed lab pulls every output
    // down equally.
    const need = BUILDING_DEFS[id]?.staffNeed;
    let staffMult = 1;
    if (need?.worker) staffMult = Math.min(staffMult, workerRatio);
    if (need?.researcher) staffMult = Math.min(staffMult, researcherRatio);
    if (need?.military) staffMult = Math.min(staffMult, militaryRatio);
    for (const k of Object.keys(rules) as ResourceId[]) {
      const v = rules[k] ?? 0;
      out[k] += v * dtSec * legacyMult * staffMult;
    }
  }
  return out;
}
