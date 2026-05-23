import type {
  BuildingId,
  ResourceId,
  ResourceMap,
  TechId,
  TerrainType
} from "@nanofarm/shared";

export interface BuildingDef {
  id: BuildingId;
  label: string;
  baseCost: number;
  costGrowth: number;
  /** Optional hard cap on placements (e.g. 1 for the main building). */
  maxCount?: number;
  /** Resource-amount gate (legacy / soft unlock). Visible only after met. */
  unlock?: { resource: ResourceId; gte: number };
  /** Tech-tree gate. Building is hidden in the palette until the tech is
   * researched. Stackable with `unlock`. */
  requiresTech?: TechId;
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
  house: {
    id: "house",
    label: "House",
    baseCost: 30,
    costGrowth: 1.18
  },
  mine: {
    id: "mine",
    label: "Mine",
    baseCost: 100,
    costGrowth: 1.2,
    unlock: { resource: "credits", gte: 50 }
  },
  lab: {
    id: "lab",
    label: "Research Lab",
    baseCost: 80,
    costGrowth: 1.25,
    unlock: { resource: "credits", gte: 60 }
  },
  lumber_mill: {
    id: "lumber_mill",
    label: "Lumber Mill",
    baseCost: 120,
    costGrowth: 1.2,
    requiresTech: "agriculture"
  },
  granary: {
    id: "granary",
    label: "Granary",
    baseCost: 80,
    costGrowth: 1.18,
    requiresTech: "agriculture"
  },
  quarry: {
    id: "quarry",
    label: "Quarry",
    baseCost: 150,
    costGrowth: 1.22,
    requiresTech: "industry"
  },
  market: {
    id: "market",
    label: "Market",
    baseCost: 200,
    costGrowth: 1.25,
    requiresTech: "commerce"
  },
  factory: {
    id: "factory",
    label: "Factory",
    baseCost: 500,
    costGrowth: 1.3,
    requiresTech: "heavy_industry"
  }
};

export interface TechDef {
  id: TechId;
  label: string;
  description: string;
  cost: number;
  /** Other techs that must be researched first. */
  prereqs: TechId[];
  /** Buildings this tech makes available. */
  unlocks: BuildingId[];
}

export const TECH_DEFS: Record<TechId, TechDef> = {
  agriculture: {
    id: "agriculture",
    label: "Agriculture",
    description:
      "Better land management. Unlocks the Lumber Mill (forest yields) and Granary (boosts adjacent farms).",
    cost: 10,
    prereqs: [],
    unlocks: ["lumber_mill", "granary"]
  },
  industry: {
    id: "industry",
    label: "Industry",
    description: "Mechanised extraction. Unlocks the Quarry, a stone-focused alternative to the Mine.",
    cost: 25,
    prereqs: [],
    unlocks: ["quarry"]
  },
  commerce: {
    id: "commerce",
    label: "Commerce",
    description:
      "Trade routes. Unlocks the Market, a passive credit source that scales with adjacent buildings.",
    cost: 40,
    prereqs: ["agriculture"],
    unlocks: ["market"]
  },
  heavy_industry: {
    id: "heavy_industry",
    label: "Heavy Industry",
    description:
      "Industrial-scale production. Unlocks the Factory, a tall building that converts wood + iron into credits at a high rate.",
    cost: 80,
    prereqs: ["industry"],
    unlocks: ["factory"]
  }
};

export const HOUSE_CAPACITY = 10;
export const POP_GROWTH_RATE = 0.5;
export const POP_DECAY_RATE = 0.2;
export const POP_FOOD_RATE = 0.05;

export const ROAD_COST = 2;

export function costFor(def: BuildingDef, currentCount: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentCount));
}

function countNeighbor(neighbors: TerrainType[], kind: TerrainType): number {
  let n = 0;
  for (const t of neighbors) if (t === kind) n++;
  return n;
}

/** Extra context for productionFor: counts of adjacent building types that
 * confer district-style bonuses (e.g. granary -> adjacent farm). */
export interface NeighborBuildings {
  granary: number;
  market: number;
}

export const EMPTY_NEIGHBOR_BUILDINGS: NeighborBuildings = {
  granary: 0,
  market: 0
};

/**
 * Per-second production rates for a single building of `id`, given its
 * 8-neighbour terrain and (optionally) its 4-cardinal neighbour buildings
 * for district bonuses. Output is a partial resource map.
 *
 * The main building does not produce anything on its own; it only enables
 * connectivity for the rest of the network.
 */
export function productionFor(
  id: BuildingId,
  neighbors: TerrainType[],
  buildingNeighbors: NeighborBuildings = EMPTY_NEIGHBOR_BUILDINGS
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
    // Granary district bonus: each adjacent granary doubles potato output
    // up to a cap of +200%.
    if (buildingNeighbors.granary > 0) {
      const mult = 1 + Math.min(2, buildingNeighbors.granary);
      out.potatoes = (out.potatoes ?? 0) * mult;
    }
  } else if (id === "mine") {
    out.iron = 0.25 + deposits * 0.4;
    out.stone = 0.25 + mountains * 0.4;
  } else if (id === "lab") {
    // Research is slow on purpose: tech is the long-term goal, not a
    // short-loop reward. Adjacent forests give a tiny boost (libraries
    // need paper).
    out.research = 0.1 + forests * 0.02;
  } else if (id === "lumber_mill") {
    // Forests-only producer with a much steeper multiplier than the farm.
    // A mill in the middle of a forest is the canonical "go-to wood
    // factory" once agriculture is researched.
    out.wood = 0.3 + forests * 0.5;
  } else if (id === "quarry") {
    // Stone-specialist counterpart to the mine. Higher base stone, no
    // iron, mountain-dominant.
    out.stone = 0.5 + mountains * 0.7;
  } else if (id === "granary") {
    // Granary itself produces a small steady potato output on top of its
    // adjacency bonus to neighboring farms.
    out.potatoes = 0.2;
  } else if (id === "market") {
    // Markets passive-earn credits; a market with 4 adjacent buildings is
    // worth roughly 3 farms in pure cr/s. Scales with adjacent producers
    // so placement matters.
    out.credits = 1 + buildingNeighbors.market * 0.5;
  } else if (id === "factory") {
    // Heavy-industry capstone. Strong credits but expensive to place and
    // gated behind two tech tiers, so it's a midgame goal.
    out.credits = 4;
    out.stone = 0.1;
    out.iron = 0.1;
  }

  return out;
}
