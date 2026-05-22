import type { BuildingId, GameState } from "@nanofarm/shared";
import { BUILDING_DEFS, ROAD_COST, costFor } from "../game/buildings";

export type Placeable = BuildingId | "road";

interface Props {
  state: GameState;
  selected: Placeable | null;
  onSelect: (id: Placeable | null) => void;
}

export function BuildPalette({ state, selected, onSelect }: Props) {
  return (
    <div className="build-palette">
      {(Object.keys(BUILDING_DEFS) as BuildingId[]).map((id) => {
        const def = BUILDING_DEFS[id];
        const owned = state.buildings[id].count;
        const atCap = def.maxCount !== undefined && owned >= def.maxCount;
        const cost = costFor(def, owned);
        const unlocked =
          !def.unlock || state.resources[def.unlock.resource] >= def.unlock.gte;
        const canAfford = state.resources.credits >= cost;
        const isSelected = selected === id;
        if (!unlocked) return null;
        return (
          <button
            key={id}
            onClick={() => onSelect(isSelected ? null : id)}
            disabled={(atCap || !canAfford) && !isSelected}
            className={`build-button${isSelected ? " selected" : ""}`}
          >
            <span className="bb-label">{def.label}</span>
            <span className="bb-count">
              {def.maxCount !== undefined ? `${owned}/${def.maxCount}` : `x${owned}`}
            </span>
            <span className="bb-cost">{atCap ? "—" : `${cost} cr`}</span>
          </button>
        );
      })}
      {/* road is not a building but lives in the same palette */}
      <RoadButton
        selected={selected === "road"}
        credits={state.resources.credits}
        onSelect={(open) => onSelect(open ? "road" : null)}
      />
      {selected && (
        <div className="bp-hint">
          {selected === "main" && "click a green tile to place your main building."}
          {selected === "road" && "click tiles to lay roads. they branch out from main."}
          {(selected === "farm" || selected === "mine") &&
            "click a green tile adjacent to a road or main building."}
        </div>
      )}
    </div>
  );
}

function RoadButton({
  selected,
  credits,
  onSelect
}: {
  selected: boolean;
  credits: number;
  onSelect: (open: boolean) => void;
}) {
  const canAfford = credits >= ROAD_COST;
  return (
    <button
      onClick={() => onSelect(!selected)}
      disabled={!canAfford && !selected}
      className={`build-button${selected ? " selected" : ""}`}
    >
      <span className="bb-label">Road</span>
      <span className="bb-count">∞</span>
      <span className="bb-cost">{ROAD_COST} cr</span>
    </button>
  );
}
