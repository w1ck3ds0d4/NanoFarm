import type { BuildingId, GameState } from "@nanofarm/shared";
import { BUILDING_DEFS, costFor } from "../game/buildings";

interface Props {
  state: GameState;
  onBuy: (id: BuildingId) => void;
}

export function BuildPalette({ state, onBuy }: Props) {
  return (
    <div className="build-palette">
      <h2>Build</h2>
      {(Object.keys(BUILDING_DEFS) as BuildingId[]).map((id) => {
        const def = BUILDING_DEFS[id];
        const owned = state.buildings[id].count;
        const cost = costFor(def, owned);
        const unlocked =
          !def.unlock || state.resources[def.unlock.resource] >= def.unlock.gte;
        const canAfford = state.resources.credits >= cost;
        if (!unlocked) return null;
        return (
          <button
            key={id}
            onClick={() => onBuy(id)}
            disabled={!canAfford}
            className="build-button"
          >
            <span>{def.label}</span>
            <span className="count">x{owned}</span>
            <span className="cost">{cost} cr</span>
          </button>
        );
      })}
    </div>
  );
}
