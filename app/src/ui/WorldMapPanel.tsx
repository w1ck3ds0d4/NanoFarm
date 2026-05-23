import { useState } from "react";
import type { CityId, GameState } from "@nanofarm/shared";
import { CITY_IDS } from "@nanofarm/shared";
import { CITY_DEFS, legacyBonus } from "../game/cities";

interface Props {
  state: GameState;
  onTravel: (city: CityId) => void;
  onClose: () => void;
}

export function WorldMapPanel({ state, onTravel, onClose }: Props) {
  const [confirming, setConfirming] = useState<CityId | null>(null);
  const world = state.world;
  const bonusPct = Math.round((legacyBonus(world.legacy) - 1) * 100);

  return (
    <div className="world-panel">
      <div className="wm-header">
        <span className="wm-title">WORLD MAP</span>
        <span className="wm-legacy">
          legacy {world.legacy} ({bonusPct >= 0 ? "+" : ""}{bonusPct}% production)
        </span>
        <button className="wm-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="wm-hint">
        finish a city's milestone, then travel to the next one. travelling
        wipes the local map but keeps your tech tree and earns a legacy
        point that boosts production forever.
      </div>
      <div className="wm-grid">
        {CITY_IDS.map((id) => {
          const def = CITY_DEFS[id];
          const isCurrent = world.currentCity === id;
          const isSettled = world.completedCities.includes(id);
          const prereqsMet = def.prereqs.every((p) =>
            world.completedCities.includes(p),
          );
          const isReachable = prereqsMet || isCurrent || isSettled;
          const progress = def.progress(state);
          const milestoneMet = def.isMilestoneMet(state);

          let status = "locked";
          if (isCurrent) status = "current";
          else if (isSettled) status = "settled";
          else if (isReachable) status = "reachable";

          const cardClass = `wm-card ${status}` + (confirming === id ? " confirming" : "");

          // Travel target preview lines: what the player gets / loses.
          const willSettle =
            isCurrent && milestoneMet && !world.completedCities.includes(id);

          return (
            <div key={id} className={cardClass}>
              <div className="wm-card-head">
                <span className="wm-card-title">{def.label}</span>
                <span className={`wm-card-status ${status}`}>{status}</span>
              </div>
              <div className="wm-card-desc">{def.description}</div>
              <div className="wm-milestone">
                milestone: {def.milestoneLabel}
                {milestoneMet && isCurrent && (
                  <span className="wm-met"> ✓ ready to settle</span>
                )}
              </div>
              <div className="wm-progress">
                <div
                  className="wm-progress-fill"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              {!isCurrent && isReachable && (
                <>
                  {confirming === id ? (
                    <div className="wm-confirm">
                      <div className="wm-confirm-msg">
                        travel to {def.label}? this wipes your current map and
                        resources.
                        {willSettle && (
                          <span className="wm-confirm-bonus">
                            {" "}you will settle the current city and earn +1 legacy.
                          </span>
                        )}
                      </div>
                      <div className="wm-confirm-actions">
                        <button
                          className="wm-btn danger"
                          onClick={() => {
                            setConfirming(null);
                            onTravel(id);
                          }}
                        >
                          travel
                        </button>
                        <button
                          className="wm-btn"
                          onClick={() => setConfirming(null)}
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="wm-btn"
                      onClick={() => setConfirming(id)}
                    >
                      travel here
                    </button>
                  )}
                </>
              )}
              {!isReachable && (
                <div className="wm-locked-reason">
                  requires:{" "}
                  {def.prereqs
                    .map((p) =>
                      CITY_DEFS[p].label +
                      (world.completedCities.includes(p) ? " ✓" : ""),
                    )
                    .join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
