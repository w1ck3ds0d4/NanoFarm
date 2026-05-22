import type { BuildingId, ResourceId } from "@nanofarm/shared";

export interface BuildingDef {
  id: BuildingId;
  label: string;
  baseCost: number;
  costGrowth: number;
  produces: { resource: ResourceId; ratePerSecond: number };
  unlock?: { resource: ResourceId; gte: number };
}

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  farm: {
    id: "farm",
    label: "Farm",
    baseCost: 10,
    costGrowth: 1.15,
    produces: { resource: "credits", ratePerSecond: 1 }
  },
  mine: {
    id: "mine",
    label: "Mine",
    baseCost: 100,
    costGrowth: 1.2,
    produces: { resource: "materials", ratePerSecond: 0.5 },
    unlock: { resource: "credits", gte: 50 }
  }
};

export function costFor(def: BuildingDef, currentCount: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentCount));
}
