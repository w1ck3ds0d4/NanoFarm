import type { GameState, TechId } from "@nanofarm/shared";
import { TECH_IDS } from "@nanofarm/shared";
import { BUILDING_DEFS, TECH_DEFS } from "../game/buildings";

interface Props {
  state: GameState;
  onResearch: (tech: TechId) => void;
  onClose: () => void;
}

export function ResearchPanel({ state, onResearch, onClose }: Props) {
  const research = Math.floor(state.resources.research * 10) / 10;

  return (
    <div className="research-panel">
      <div className="rp-header">
        <span className="rp-title">RESEARCH</span>
        <span className="rp-balance">{research} rp available</span>
        <button className="rp-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="rp-hint">
        Build a Research Lab to generate research points, then unlock new
        buildings and bonuses below.
      </div>
      <div className="rp-grid">
        {TECH_IDS.map((id) => {
          const def = TECH_DEFS[id];
          const done = state.techs[id];
          const prereqsMet = def.prereqs.every((p) => state.techs[p]);
          const canAfford = state.resources.research >= def.cost;
          const buildings = def.unlocks
            .map((b) => BUILDING_DEFS[b]?.label ?? b)
            .join(", ");
          return (
            <div
              key={id}
              className={`rp-card${done ? " researched" : ""}${!prereqsMet ? " locked" : ""}`}
            >
              <div className="rp-card-head">
                <span className="rp-card-title">{def.label}</span>
                <span className="rp-card-cost">
                  {done ? "researched" : `${def.cost} rp`}
                </span>
              </div>
              <div className="rp-card-desc">{def.description}</div>
              <div className="rp-card-unlocks">unlocks: {buildings}</div>
              {def.prereqs.length > 0 && (
                <div className="rp-card-prereqs">
                  requires:{" "}
                  {def.prereqs
                    .map((p) => TECH_DEFS[p].label + (state.techs[p] ? " ✓" : ""))
                    .join(", ")}
                </div>
              )}
              {!done && (
                <button
                  className="rp-research-btn"
                  disabled={!prereqsMet || !canAfford}
                  onClick={() => onResearch(id)}
                >
                  {!prereqsMet ? "locked" : !canAfford ? "need more rp" : "research"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
