import type {
  BuildingId,
  ResourceId,
  ResourceMap,
  TechId,
  TerrainType
} from "@nanofarm/shared";

export type MaterialCost = Partial<Record<"wood" | "iron" | "stone" | "water", number>>;

export type BuildingCategory = "core" | "harvest" | "tech" | "people";

export const BUILDING_CATEGORIES: readonly BuildingCategory[] = ["core", "harvest", "tech", "people"] as const;

export const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  core: "Core",
  harvest: "Harvest",
  tech: "Tech",
  people: "People"
};

/** Staffing requirement for a building. Production scales linearly
 * with the ratio of available workers / required workers (capped at
 * 1). A building with no entry needs no staff and always runs at
 * 100%. */
export type StaffNeed = Partial<Record<"worker" | "researcher" | "military", number>>;

export interface BuildingDef {
  id: BuildingId;
  label: string;
  category: BuildingCategory;
  baseCost: number;
  costGrowth: number;
  /** Flat material cost in addition to credits. Does not scale with
   * placement count - placing the 5th lab costs the same wood as the
   * first, even though the credit price has grown. */
  materialCost?: MaterialCost;
  /** Optional hard cap on placements (e.g. 1 for the main building). */
  maxCount?: number;
  /** Resource-amount gate (legacy / soft unlock). Visible only after met. */
  unlock?: { resource: ResourceId; gte: number };
  /** Tech-tree gate. Building is hidden in the palette until the tech is
   * researched. Stackable with `unlock`. */
  requiresTech?: TechId;
  /** Per-building staffing demand. If the city's trained pop of that
   * job type cannot cover the global total, every building of this
   * type produces at the available/needed ratio. */
  staffNeed?: StaffNeed;
  /** Footprint side length in tiles. 1 (default) = single-tile.
   * 2 = 2x2 footprint, 3 = 3x3, 5 = 5x5. The origin tile is the
   * north-most tile of the footprint; the footprint extends to
   * (ox+size-1, oy+size-1). */
  size?: number;
}

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  main: {
    id: "main",
    label: "Main Building",
    category: "core",
    baseCost: 0,
    costGrowth: 1,
    maxCount: 1
  },
  house: {
    id: "house",
    label: "House",
    category: "core",
    baseCost: 30,
    costGrowth: 1.18,
    materialCost: { wood: 2 }
  },
  farm: {
    id: "farm",
    label: "Farm",
    category: "harvest",
    baseCost: 10,
    costGrowth: 1.15
  },
  lumber_mill: {
    id: "lumber_mill",
    label: "Lumber Mill",
    category: "harvest",
    baseCost: 50,
    costGrowth: 1.2,
    unlock: { resource: "credits", gte: 30 },
    staffNeed: { worker: 1 }
  },
  mine: {
    id: "mine",
    label: "Mine",
    category: "harvest",
    baseCost: 100,
    costGrowth: 1.2,
    materialCost: { wood: 3 },
    unlock: { resource: "credits", gte: 50 },
    staffNeed: { worker: 2 }
  },
  quarry: {
    id: "quarry",
    label: "Quarry",
    category: "harvest",
    baseCost: 150,
    costGrowth: 1.22,
    materialCost: { wood: 6, stone: 2 },
    requiresTech: "industry",
    staffNeed: { worker: 2 }
  },
  granary: {
    id: "granary",
    label: "Granary",
    category: "harvest",
    baseCost: 80,
    costGrowth: 1.18,
    materialCost: { wood: 5 },
    requiresTech: "agriculture",
    staffNeed: { worker: 1 }
  },
  lab: {
    id: "lab",
    label: "Research Lab",
    category: "tech",
    baseCost: 80,
    costGrowth: 1.25,
    materialCost: { wood: 4 },
    unlock: { resource: "credits", gte: 60 },
    staffNeed: { researcher: 1 }
  },
  market: {
    id: "market",
    label: "Market",
    category: "tech",
    baseCost: 200,
    costGrowth: 1.25,
    materialCost: { wood: 5, stone: 3 },
    requiresTech: "commerce",
    staffNeed: { worker: 1 }
  },
  factory: {
    id: "factory",
    label: "Factory",
    category: "tech",
    baseCost: 500,
    costGrowth: 1.3,
    materialCost: { wood: 4, stone: 8, iron: 5 },
    requiresTech: "heavy_industry",
    staffNeed: { worker: 4 }
  },
  school: {
    id: "school",
    label: "School",
    category: "people",
    baseCost: 60,
    costGrowth: 1.18,
    unlock: { resource: "credits", gte: 40 }
  },
  academy: {
    id: "academy",
    label: "Academy",
    category: "people",
    baseCost: 120,
    costGrowth: 1.22,
    materialCost: { wood: 4 },
    unlock: { resource: "credits", gte: 100 }
  },
  barracks: {
    id: "barracks",
    label: "Barracks",
    category: "people",
    baseCost: 100,
    costGrowth: 1.2,
    materialCost: { wood: 3 },
    unlock: { resource: "credits", gte: 80 }
  },
  power_plant: {
    id: "power_plant",
    label: "Power Plant",
    category: "tech",
    baseCost: 1200,
    costGrowth: 1.3,
    materialCost: { wood: 6, stone: 12, iron: 8 },
    requiresTech: "heavy_industry",
    staffNeed: { worker: 8 },
    size: 2
  },
  wonder: {
    id: "wonder",
    label: "Wonder",
    category: "tech",
    baseCost: 5000,
    costGrowth: 1.5,
    materialCost: { wood: 20, stone: 40, iron: 30 },
    requiresTech: "heavy_industry",
    maxCount: 1,
    size: 3
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
      "Better land management. Unlocks the Granary, which adds a strong potato bonus to every adjacent farm.",
    cost: 10,
    prereqs: [],
    unlocks: ["granary"]
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

/** Trained-citizens-per-second produced by each training building. */
export const SCHOOL_TRAIN_RATE = 0.2;
export const ACADEMY_TRAIN_RATE = 0.15;
export const BARRACKS_TRAIN_RATE = 0.15;

export const ROAD_COST = 2;

export function costFor(def: BuildingDef, currentCount: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentCount));
}

/** True iff the given resource map covers every entry in materialCost. */
export function canAffordMaterials(
  def: BuildingDef,
  resources: Record<string, number>
): boolean {
  if (!def.materialCost) return true;
  for (const [mat, amt] of Object.entries(def.materialCost)) {
    if ((resources[mat] ?? 0) < (amt ?? 0)) return false;
  }
  return true;
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
  } else if (id === "power_plant") {
    // 2x2 industrial complex. Big credits + iron + stone but eats
    // 8 workers, so it only pays off late game with full schools.
    out.credits = 12;
    out.iron = 0.3;
    out.stone = 0.3;
  } else if (id === "wonder") {
    // 3x3 vanity. Token research per second; the real reward is
    // legacy / vanity, not the per-second income.
    out.research = 0.5;
    out.credits = 2;
  }

  return out;
}

/** Helper: footprint size for a building (defaults to 1). */
export function buildingSize(id: BuildingId): number {
  return BUILDING_DEFS[id]?.size ?? 1;
}
