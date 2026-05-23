import type { BuildingId, GameState } from "@nanofarm/shared";
import { BUILDING_DEFS, ROAD_COST, costFor } from "../game/buildings";

export type Placeable = BuildingId | "road";

interface Props {
  state: GameState;
  selected: Placeable | null;
  onSelect: (id: Placeable | null) => void;
}

export function BuildPalette({ state, selected, onSelect }: Props) {
  const mainPlaced = state.buildings.main.count > 0;

  return (
    <div className="build-palette">
      {(Object.keys(BUILDING_DEFS) as BuildingId[]).map((id) => {
        const def = BUILDING_DEFS[id];
        const owned = state.buildings[id].count;
        const atCap = def.maxCount !== undefined && owned >= def.maxCount;
        const cost = costFor(def, owned);
        const resourceUnlocked =
          !def.unlock || state.resources[def.unlock.resource] >= def.unlock.gte;
        const techUnlocked =
          !def.requiresTech || state.techs[def.requiresTech];
        const unlocked = resourceUnlocked && techUnlocked;
        const canAfford = state.resources.credits >= cost;
        const isSelected = selected === id;
        // gate everything except `main` behind a placed main building.
        const needsMain = id !== "main" && !mainPlaced;
        if (!unlocked) return null;
        return (
          <button
            key={id}
            onClick={() => onSelect(isSelected ? null : id)}
            disabled={(atCap || !canAfford || needsMain) && !isSelected}
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
        mainPlaced={mainPlaced}
        onSelect={(open) => onSelect(open ? "road" : null)}
      />
      {!mainPlaced && (
        <div className="bp-hint">
          place your main building first. everything else unlocks once main exists.
        </div>
      )}
      {/* per-selection placement hint moved to App.tsx so it survives the
          build-panel auto-close. */}
    </div>
  );
}

function RoadButton({
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
      onClick={() => onSelect(!selected)}
      disabled={(!canAfford || !mainPlaced) && !selected}
      className={`build-button${selected ? " selected" : ""}`}
    >
      <span className="bb-label">Road</span>
      <span className="bb-count">∞</span>
      <span className="bb-cost">{ROAD_COST} cr</span>
    </button>
  );
}
