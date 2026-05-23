import { useState } from "react";
import type { BuildingId, GameState } from "@nanofarm/shared";
import {
  BUILDING_CATEGORIES,
  BUILDING_DEFS,
  CATEGORY_LABEL,
  ROAD_COST,
  canAffordMaterials,
  costFor,
  type BuildingCategory
} from "../game/buildings";

export type Placeable = BuildingId | "road";

interface Props {
  state: GameState;
  selected: Placeable | null;
  onSelect: (id: Placeable | null) => void;
}

// "infra" is a synthetic sidebar entry that holds the road button (not
// a building, but the player still places it the same way).
type SidebarKey = BuildingCategory | "infra";

const SIDEBAR_LABEL: Record<SidebarKey, string> = {
  ...CATEGORY_LABEL,
  infra: "Roads"
};

export function BuildPalette({ state, selected, onSelect }: Props) {
  const mainPlaced = state.buildings.main.count > 0;
  const [activeTab, setActiveTab] = useState<SidebarKey>("core");

  // Pre-compute which buildings appear in each category so we can hide
  // sidebar tabs that have nothing the player has unlocked yet.
  const visibleByCategory: Record<BuildingCategory, BuildingId[]> = {
    core: [],
    harvest: [],
    industry: [],
    commerce: [],
    people: [],
    tech: []
  };
  for (const id of Object.keys(BUILDING_DEFS) as BuildingId[]) {
    const def = BUILDING_DEFS[id];
    const resourceUnlocked =
      !def.unlock || state.resources[def.unlock.resource] >= def.unlock.gte;
    const techUnlocked = !def.requiresTech || state.techs[def.requiresTech];
    if (resourceUnlocked && techUnlocked) {
      visibleByCategory[def.category].push(id);
    }
  }

  const sidebarTabs: SidebarKey[] = [
    ...BUILDING_CATEGORIES.filter((c) => visibleByCategory[c].length > 0),
    "infra"
  ];

  return (
    <div className="build-palette">
      <aside className="bp-sidebar">
        {sidebarTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={"bp-tab" + (activeTab === tab ? " active" : "")}
          >
            {SIDEBAR_LABEL[tab]}
          </button>
        ))}
      </aside>

      <div className="bp-cards">
        {activeTab === "infra" ? (
          <RoadCard
            selected={selected === "road"}
            credits={state.resources.credits}
            mainPlaced={mainPlaced}
            onSelect={(open) => onSelect(open ? "road" : null)}
          />
        ) : (
          visibleByCategory[activeTab].map((id) => (
            <BuildingCard
              key={id}
              id={id}
              state={state}
              selected={selected === id}
              mainPlaced={mainPlaced}
              onSelect={(open) => onSelect(open ? id : null)}
            />
          ))
        )}
        {!mainPlaced && activeTab !== "infra" && (
          <div className="bp-hint">
            place your main building first. everything else unlocks once main exists.
          </div>
        )}
      </div>
    </div>
  );
}

function BuildingCard({
  id,
  state,
  selected,
  mainPlaced,
  onSelect
}: {
  id: BuildingId;
  state: GameState;
  selected: boolean;
  mainPlaced: boolean;
  onSelect: (open: boolean) => void;
}) {
  const def = BUILDING_DEFS[id];
  const owned = state.buildings[id].count;
  const atCap = def.maxCount !== undefined && owned >= def.maxCount;
  const cost = costFor(def, owned);
  const canAffordCredits = state.resources.credits >= cost;
  const hasMaterials = canAffordMaterials(
    def,
    state.resources as unknown as Record<string, number>
  );
  const canAfford = canAffordCredits && hasMaterials;
  const needsMain = id !== "main" && !mainPlaced;
  const materialEntries = def.materialCost
    ? (Object.entries(def.materialCost) as Array<[string, number]>)
    : [];

  // Short summary of what the building does on a single line:
  // "+0.6 food, -1 wt" or "+0.3 tools, -0.3 stone -0.3 iron".
  // Skip houses and main (they have non-flow ops).
  const ops = def.ops;
  const opsBits: string[] = [];
  if (ops.produces) {
    for (const [res, amt] of Object.entries(ops.produces)) {
      if (amt) opsBits.push(`+${amt.toFixed(2)} ${res.slice(0, 4)}`);
    }
  }
  if (ops.consumes) {
    for (const [res, amt] of Object.entries(ops.consumes)) {
      if (amt) opsBits.push(`-${amt.toFixed(2)} ${res.slice(0, 4)}`);
    }
  }
  if (ops.powerSupply) opsBits.push(`+${ops.powerSupply} pw`);
  if (ops.waterSupply) opsBits.push(`+${ops.waterSupply} wt`);
  if (ops.powerNeed) opsBits.push(`-${ops.powerNeed} pw`);
  if (ops.waterNeed) opsBits.push(`-${ops.waterNeed} wt`);

  return (
    <button
      type="button"
      onClick={() => onSelect(!selected)}
      disabled={(atCap || !canAfford || needsMain) && !selected}
      className={"bp-card" + (selected ? " selected" : "")}
    >
      <div className="bp-card-head">
        <span className="bp-card-label">{def.label}</span>
        <span className="bp-card-count">
          {def.maxCount !== undefined ? `${owned}/${def.maxCount}` : `x${owned}`}
        </span>
      </div>
      <div className="bp-card-cost">
        {atCap ? (
          <span className="bp-cost-empty">—</span>
        ) : (
          <>
            <span className={"bp-cost-pill" + (canAffordCredits ? "" : " missing")}>
              {cost} cr
            </span>
            {materialEntries.map(([mat, amt]) => {
              const have =
                (state.resources as unknown as Record<string, number>)[mat] ?? 0;
              const ok = have >= amt;
              return (
                <span
                  key={mat}
                  className={"bp-cost-pill bp-cost-mat" + (ok ? "" : " missing")}
                >
                  {amt} {mat.slice(0, 4)}
                </span>
              );
            })}
          </>
        )}
      </div>
      {(opsBits.length > 0 || ops.upkeep) && (
        <div className="bp-card-ops">
          {opsBits.join("  ")}
          {ops.upkeep ? (
            <span className="bp-card-upkeep"> &middot; upkeep {ops.upkeep.toFixed(2)} cr/s</span>
          ) : null}
        </div>
      )}
    </button>
  );
}

function RoadCard({
  selected,
  credits,
  mainPlaced,
  onSelect
}: {
  selected: boolean;
  credits: number;
  mainPlaced: boolean;
  onSelect: (open: boolean) => void;
}) {
  const canAfford = credits >= ROAD_COST;
  return (
    <button
      type="button"
      onClick={() => onSelect(!selected)}
      disabled={(!canAfford || !mainPlaced) && !selected}
      className={"bp-card" + (selected ? " selected" : "")}
    >
      <div className="bp-card-head">
        <span className="bp-card-label">Road</span>
        <span className="bp-card-count">∞</span>
      </div>
      <div className="bp-card-cost">
        <span className={"bp-cost-pill" + (canAfford ? "" : " missing")}>
          {ROAD_COST} cr
        </span>
      </div>
    </button>
  );
}
