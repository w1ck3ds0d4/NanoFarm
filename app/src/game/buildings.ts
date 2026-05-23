import type {
  BuildingId,
  ResourceId,
  ResourceMap,
  TechId,
  TerrainType
} from "@nanofarm/shared";

// ─── Construction cost shapes ────────────────────────────────────────────────

export type MaterialCost = Partial<Record<"wood" | "iron" | "stone", number>>;

// ─── Operations: what a building does each tick ──────────────────────────────

/** Per-second flows the building participates in while running. All
 * fields scale by the building's actual run ratio (the minimum of
 * staffing, power, water, and input availability ratios). */
export interface BuildingOps {
  /** Per-second consumption of stockpiled resources. The flow is
   * gated by what's actually available - if the city is dry on
   * iron, the factory runs at the iron-available ratio. */
  consumes?: Partial<Record<ResourceId, number>>;
  /** Per-second production. Scales by run ratio. */
  produces?: Partial<Record<ResourceId, number>>;
  /** Flat credit drain per second, applied as long as the building
   * is *connected*. Not gated by staffing or utilities - bills
   * arrive even when the place is empty. */
  upkeep?: number;
  /** Power-service units this building demands per second. The
   * city sums all demand and divides supply across consumers; the
   * resulting ratio multiplies the building's output. */
  powerNeed?: number;
  /** Water-service units demanded per second. Same semantics. */
  waterNeed?: number;
  /** Power-service units this building supplies per second. Only
   * power_plant uses this today. Scales with run ratio (staff,
   * upkeep). */
  powerSupply?: number;
  /** Water-service units supplied per second. Only water_pump. */
  waterSupply?: number;
}

// ─── Job staffing ────────────────────────────────────────────────────────────

export type StaffNeed = Partial<Record<"worker" | "researcher" | "military", number>>;

// ─── Building category for the sidebar ───────────────────────────────────────

export type BuildingCategory =
  | "core"
  | "harvest"
  | "industry"
  | "commerce"
  | "people"
  | "tech";

export const BUILDING_CATEGORIES: readonly BuildingCategory[] = [
  "core",
  "harvest",
  "industry",
  "commerce",
  "people",
  "tech"
] as const;

export const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  core: "Core",
  harvest: "Harvest",
  industry: "Industry",
  commerce: "Commerce",
  people: "People",
  tech: "Tech"
};

// ─── Building definition ─────────────────────────────────────────────────────

export interface BuildingDef {
  id: BuildingId;
  label: string;
  category: BuildingCategory;
  /** One-time construction credit cost (grows with placement count). */
  baseCost: number;
  costGrowth: number;
  /** One-time construction material cost (does NOT grow). */
  materialCost?: MaterialCost;
  maxCount?: number;
  unlock?: { resource: ResourceId; gte: number };
  requiresTech?: TechId;
  staffNeed?: StaffNeed;
  size?: number;
  /** What this building does each tick while operating. */
  ops: BuildingOps;
}

// ─── Building definitions ────────────────────────────────────────────────────
//
// Design goals:
//   - main + farm + house + lumber_mill are buildable from a fresh start
//     with the bootstrap budget (50 cr, 8 wood).
//   - food + water are the first survival loop (farm + water_pump).
//   - workers come from schools, which come from credits.
//   - Once you have raw materials, workshop produces tools to boost
//     extraction, factory produces goods, market sells them for big
//     credits.
//   - Power gates the industrial tier so the player has to commit
//     to a power_plant before scaling.
//
// Numbers are starting points. Tune as needed.

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  main: {
    id: "main",
    label: "Main Building",
    category: "core",
    baseCost: 0,
    costGrowth: 1,
    maxCount: 1,
    ops: { upkeep: 0.1 }
  },
  house: {
    id: "house",
    label: "House",
    category: "core",
    baseCost: 30,
    costGrowth: 1.18,
    materialCost: { wood: 2 },
    // Houses don't have their OWN ops here - the per-resident
    // demand (food, water, power, goods) is added to the citywide
    // totals inside simulateTick based on population, not building
    // count. Houses just *cap* how many residents can exist.
    ops: { upkeep: 0.05 }
  },
  farm: {
    id: "farm",
    label: "Farm",
    category: "harvest",
    baseCost: 10,
    costGrowth: 1.15,
    ops: {
      produces: { food: 0.6 },
      waterNeed: 1,
      upkeep: 0.05
    }
  },
  lumber_mill: {
    id: "lumber_mill",
    label: "Lumber Mill",
    category: "harvest",
    baseCost: 50,
    costGrowth: 1.2,
    materialCost: { wood: 2 },
    unlock: { resource: "credits", gte: 30 },
    staffNeed: { worker: 1 },
    ops: {
      produces: { wood: 0.5 },
      powerNeed: 1,
      upkeep: 0.2
    }
  },
  mine: {
    id: "mine",
    label: "Mine",
    category: "harvest",
    baseCost: 100,
    costGrowth: 1.2,
    materialCost: { wood: 3 },
    unlock: { resource: "credits", gte: 50 },
    staffNeed: { worker: 2 },
    ops: {
      produces: { iron: 0.4 },
      powerNeed: 1,
      upkeep: 0.3
    }
  },
  quarry: {
    id: "quarry",
    label: "Quarry",
    category: "harvest",
    baseCost: 150,
    costGrowth: 1.22,
    materialCost: { wood: 5, stone: 2 },
    requiresTech: "industry",
    staffNeed: { worker: 2 },
    ops: {
      produces: { stone: 0.5 },
      powerNeed: 1,
      upkeep: 0.3
    }
  },
  water_pump: {
    id: "water_pump",
    label: "Water Pump",
    category: "harvest",
    baseCost: 90,
    costGrowth: 1.2,
    materialCost: { wood: 2, iron: 1 },
    requiresTech: "engineering",
    staffNeed: { worker: 1 },
    ops: {
      waterSupply: 8,
      powerNeed: 2,
      upkeep: 0.2
    }
  },
  power_plant: {
    id: "power_plant",
    label: "Power Plant",
    category: "industry",
    baseCost: 600,
    costGrowth: 1.3,
    materialCost: { wood: 4, stone: 10, iron: 6 },
    requiresTech: "heavy_industry",
    staffNeed: { worker: 4 },
    size: 2,
    ops: {
      powerSupply: 20,
      upkeep: 1.0
    }
  },
  workshop: {
    id: "workshop",
    label: "Workshop",
    category: "industry",
    baseCost: 200,
    costGrowth: 1.22,
    materialCost: { wood: 4, iron: 2 },
    requiresTech: "industry",
    staffNeed: { worker: 2 },
    ops: {
      consumes: { stone: 0.3, iron: 0.3 },
      produces: { tools: 0.3 },
      powerNeed: 1,
      upkeep: 0.3
    }
  },
  factory: {
    id: "factory",
    label: "Factory",
    category: "industry",
    baseCost: 400,
    costGrowth: 1.25,
    materialCost: { wood: 4, stone: 6, iron: 4 },
    requiresTech: "heavy_industry",
    staffNeed: { worker: 4 },
    ops: {
      consumes: { wood: 0.5, iron: 0.5 },
      produces: { goods: 0.6 },
      powerNeed: 2,
      upkeep: 0.5
    }
  },
  market: {
    id: "market",
    label: "Market",
    category: "commerce",
    baseCost: 200,
    costGrowth: 1.22,
    materialCost: { wood: 4, stone: 2 },
    requiresTech: "commerce",
    staffNeed: { worker: 2 },
    ops: {
      consumes: { goods: 1.0 },
      produces: { credits: 6.0 },
      powerNeed: 1,
      upkeep: 0.2
    }
  },
  school: {
    id: "school",
    label: "School",
    category: "people",
    baseCost: 80,
    costGrowth: 1.18,
    materialCost: { wood: 2 },
    unlock: { resource: "credits", gte: 50 },
    ops: { upkeep: 0.3, powerNeed: 1 }
    // Training is handled in simulateTick (idle -> worker), not via
    // a resource flow. Keeping it out of `produces` keeps the
    // pie-chart UI clean.
  },
  academy: {
    id: "academy",
    label: "Academy",
    category: "people",
    requiresTech: "education",
    baseCost: 150,
    costGrowth: 1.22,
    materialCost: { wood: 4, stone: 2 },
    ops: { upkeep: 0.5, powerNeed: 1 }
  },
  barracks: {
    id: "barracks",
    label: "Barracks",
    category: "people",
    baseCost: 120,
    costGrowth: 1.2,
    materialCost: { wood: 3, iron: 2 },
    unlock: { resource: "credits", gte: 80 },
    ops: { upkeep: 0.4, powerNeed: 1 }
  },
  lab: {
    id: "lab",
    label: "Research Lab",
    category: "tech",
    baseCost: 120,
    costGrowth: 1.25,
    materialCost: { wood: 4 },
    unlock: { resource: "credits", gte: 100 },
    staffNeed: { researcher: 1 },
    ops: {
      produces: { research: 0.15 },
      powerNeed: 1,
      upkeep: 0.4
    }
  },
  granary: {
    id: "granary",
    label: "Granary",
    category: "harvest",
    baseCost: 80,
    costGrowth: 1.18,
    materialCost: { wood: 5 },
    requiresTech: "agriculture",
    staffNeed: { worker: 1 },
    ops: {
      produces: { food: 0.2 },
      upkeep: 0.15
    }
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
    size: 3,
    ops: {
      produces: { research: 0.5 },
      upkeep: 0
    }
  }
};

// ─── Tech tree ───────────────────────────────────────────────────────────────

export interface TechDef {
  id: TechId;
  label: string;
  description: string;
  cost: number;
  prereqs: TechId[];
  unlocks: BuildingId[];
}

export const TECH_DEFS: Record<TechId, TechDef> = {
  agriculture: {
    id: "agriculture",
    label: "Agriculture",
    description: "Storage and cultivation know-how. Unlocks the Granary, a small food producer that also buffers shortages.",
    cost: 10,
    prereqs: [],
    unlocks: ["granary"]
  },
  industry: {
    id: "industry",
    label: "Industry",
    description: "Mechanised extraction and processing. Unlocks the Quarry (stone) and Workshop (tools from stone + iron).",
    cost: 25,
    prereqs: [],
    unlocks: ["quarry", "workshop"]
  },
  engineering: {
    id: "engineering",
    label: "Engineering",
    description: "Civic infrastructure. Unlocks the Water Pump - critical for growing past ~20 residents.",
    cost: 30,
    prereqs: [],
    unlocks: ["water_pump"]
  },
  commerce: {
    id: "commerce",
    label: "Commerce",
    description: "Trade and currency. Unlocks the Market, the primary credit source for a growing city.",
    cost: 50,
    prereqs: ["agriculture"],
    unlocks: ["market"]
  },
  metallurgy: {
    id: "metallurgy",
    label: "Metallurgy",
    description: "Iron working. Boosts mine + workshop output and is a stepping stone to heavy industry.",
    cost: 80,
    prereqs: ["industry"],
    unlocks: []
  },
  heavy_industry: {
    id: "heavy_industry",
    label: "Heavy Industry",
    description: "Industrial scale. Unlocks the Power Plant, Factory, and the Wonder capstone.",
    cost: 120,
    prereqs: ["industry", "metallurgy"],
    unlocks: ["power_plant", "factory", "wonder"]
  },
  education: {
    id: "education",
    label: "Education",
    description: "Higher learning. Unlocks the Academy, which trains researchers (lab staff).",
    cost: 60,
    prereqs: ["agriculture"],
    unlocks: ["academy"]
  }
};

// ─── Per-resident consumption + rent ────────────────────────────────────────

/** Per-resident per-second demand for each metered need. Drives both
 * the citywide service demand sums (power, water) and the happiness
 * calculation (food, goods). */
export const POP_DEMAND = {
  food: 0.02,
  goods: 0.01,
  power: 0.02,
  water: 0.02
} as const;

/** Rent paid per resident per second. Scaled by happiness in the
 * simulation. */
export const RENT_PER_RESIDENT = 0.1;

export const HOUSE_CAPACITY = 10;
export const POP_GROWTH_RATE = 0.5;
export const POP_DECAY_RATE = 0.4;

/** Per-school trained workers / sec. Schools convert idle -> worker
 * at this rate, capped by available idle. */
export const SCHOOL_TRAIN_RATE = 0.2;
export const ACADEMY_TRAIN_RATE = 0.15;
export const BARRACKS_TRAIN_RATE = 0.15;

export const ROAD_COST = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function costFor(def: BuildingDef, currentCount: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentCount));
}

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

export function buildingSize(id: BuildingId): number {
  return BUILDING_DEFS[id]?.size ?? 1;
}

// Re-export for legacy callers; the production logic now lives in
// simulate.ts but a couple of UI callers still want a quick "what
// does this building do" string.
function _unused_terrain(_: TerrainType[]): number {
  return 0;
}
void _unused_terrain;

/** Approximate per-second production summary for the inspector and
 * tooltip. Does NOT account for staffing, utility, or input
 * availability - just shows the design intent. Adjacency bonuses
 * (e.g. granary -> farm) are folded in via buildingNeighbors. */
export interface NeighborBuildings {
  granary: number;
  market: number;
}

export const EMPTY_NEIGHBOR_BUILDINGS: NeighborBuildings = {
  granary: 0,
  market: 0
};

export function productionFor(
  id: BuildingId,
  _neighbors: TerrainType[],
  buildingNeighbors: NeighborBuildings = EMPTY_NEIGHBOR_BUILDINGS
): Partial<ResourceMap> {
  const def = BUILDING_DEFS[id];
  if (!def?.ops?.produces) return {};
  // Shallow copy so callers can mutate freely.
  const out: Partial<ResourceMap> = { ...def.ops.produces };
  // Granary district bonus: each adjacent granary adds +50% food
  // to a neighbouring farm, capped at +200%.
  if (id === "farm" && buildingNeighbors.granary > 0) {
    const mult = 1 + Math.min(2, buildingNeighbors.granary * 0.5);
    out.food = (out.food ?? 0) * mult;
  }
  return out;
}
