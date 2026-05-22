import type { BuildingId, ResourceId, ResourceMap, TerrainType } from "@nanofarm/shared";

export interface BuildingDef {
  id: BuildingId;
  label: string;
  baseCost: number;
  costGrowth: number;
  /** Optional hard cap on placements (e.g. 1 for the main building). */
  maxCount?: number;
  unlock?: { resource: ResourceId; gte: number };
}

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  main: {
    id: "main",
    label: "Main Building",
    baseCost: 0,
    costGrowth: 1,
    maxCount: 1
  },
  farm: {
    id: "farm",
    label: "Farm",
    baseCost: 10,
    costGrowth: 1.15
  },
  mine: {
    id: "mine",
    label: "Mine",
    baseCost: 100,
    costGrowth: 1.2,
    unlock: { resource: "credits", gte: 50 }
  }
};

export const ROAD_COST = 2;

export function costFor(def: BuildingDef, currentCount: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentCount));
}

function countNeighbor(neighbors: TerrainType[], kind: TerrainType): number {
  let n = 0;
  for (const t of neighbors) if (t === kind) n++;
  return n;
}

/**
 * Per-second production rates for a single building of `id`, given its
 * 8-neighbour terrain. Output is a partial resource map. Subtypes (wood /
 * iron / stone / water) come from adjacent terrain features.
 *
 * The main building does not produce anything on its own; it only enables
 * connectivity for the rest of the network.
 */
export function productionFor(
  id: BuildingId,
  neighbors: TerrainType[]
): Partial<ResourceMap> {
  const out: Partial<ResourceMap> = {};
  const forests = countNeighbor(neighbors, "forest");
  const waters = countNeighbor(neighbors, "water");
  const deposits = countNeighbor(neighbors, "mine_deposit");
  const mountains = countNeighbor(neighbors, "mountain");

  if (id === "farm") {
    out.credits = 1;
    out.potatoes = 0.5;
    if (forests > 0) out.wood = 0.15 * forests;
    if (waters > 0) {
      out.water = 0.15 * waters;
      out.potatoes = (out.potatoes ?? 0) + 0.2 * waters;
    }
  } else if (id === "mine") {
    out.iron = 0.25 + deposits * 0.4;
    out.stone = 0.25 + mountains * 0.4;
  }

  return out;
}
