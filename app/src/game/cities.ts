import type { CityId, GameState } from "@nanofarm/shared";

export interface CityDef {
  id: CityId;
  label: string;
  description: string;
  /** Player-visible label for the milestone, e.g. "100 population". */
  milestoneLabel: string;
  /** True when the player's current game state has completed this
   * city's milestone and could prestige into the next city. */
  isMilestoneMet: (state: GameState) => boolean;
  /** Numeric progress (0..1) of the milestone. Drives the progress
   * bar in the world-map UI. */
  progress: (state: GameState) => number;
  /** Cities that must be settled (or this one is already current)
   * before this city becomes selectable for travel. */
  prereqs: CityId[];
}

export const CITY_DEFS: Record<CityId, CityDef> = {
  verdant_valley: {
    id: "verdant_valley",
    label: "Verdant Valley",
    description:
      "Lush starter biome. Grass and forests everywhere, plenty of room to learn the basics.",
    milestoneLabel: "house a population of 50",
    isMilestoneMet: (s) => s.meta.population >= 50,
    progress: (s) => Math.min(1, s.meta.population / 50),
    prereqs: []
  },
  stonehaven: {
    id: "stonehaven",
    label: "Stonehaven",
    description:
      "Hill country dotted with quarries and ore deposits. The Industry tech tier shines here.",
    milestoneLabel: "research Industry + earn 5,000 credits total this run",
    isMilestoneMet: (s) =>
      s.techs.industry && s.resources.credits >= 5000,
    progress: (s) => {
      const techPart = s.techs.industry ? 0.5 : 0;
      const credPart = Math.min(0.5, s.resources.credits / 10000);
      return techPart + credPart;
    },
    prereqs: ["verdant_valley"]
  },
  iron_reach: {
    id: "iron_reach",
    label: "Iron Reach",
    description:
      "Heavy-industry frontier. Smokestacks, factories, late-game scaling.",
    milestoneLabel: "build 3 factories",
    isMilestoneMet: (s) => s.buildings.factory.count >= 3,
    progress: (s) => Math.min(1, s.buildings.factory.count / 3),
    prereqs: ["stonehaven"]
  },
  aether_spire: {
    id: "aether_spire",
    label: "Aether Spire",
    description:
      "Endgame summit. Research, knowledge, and the final prestige tier.",
    milestoneLabel: "research every tech",
    isMilestoneMet: (s) =>
      s.techs.agriculture &&
      s.techs.industry &&
      s.techs.commerce &&
      s.techs.heavy_industry,
    progress: (s) => {
      const all = [
        s.techs.agriculture,
        s.techs.industry,
        s.techs.commerce,
        s.techs.heavy_industry
      ];
      return all.filter(Boolean).length / all.length;
    },
    prereqs: ["iron_reach"]
  }
};

/** Production multiplier from accumulated legacy points. Each
 * settled city adds 1 legacy = +5% to every producer's per-second
 * output, applied multiplicatively in computeProduction. */
export function legacyBonus(legacy: number): number {
  return 1 + legacy * 0.05;
}
