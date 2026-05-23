import { useState } from "react";
import type { CityId, GameState } from "@nanofarm/shared";
import { CITY_IDS } from "@nanofarm/shared";
import { CITY_DEFS, legacyBonus } from "../game/cities";

interface Props {
  state: GameState;
  onTravel: (city: CityId) => void;
  onClose: () => void;
}

// Spatial layout for each city on the SVG world map. Coordinates are
// in SVG user-space (the viewBox is 0 0 460 260). Chosen so the chain
// reads from the lush starter at bottom-left up to the endgame peak
// at top-right.
const CITY_POS: Record<CityId, { x: number; y: number; biome: string }> = {
  verdant_valley: { x: 80, y: 200, biome: "#2a5a1a" },
  stonehaven: { x: 180, y: 150, biome: "#5a4a2a" },
  iron_reach: { x: 290, y: 95, biome: "#444a52" },
  aether_spire: { x: 400, y: 50, biome: "#3a2a5a" }
};

const CITY_RADIUS = 12;

export function WorldMapPanel({ state, onTravel, onClose }: Props) {
  const world = state.world;
  const [selectedCity, setSelectedCity] = useState<CityId>(world.currentCity);
  const [confirming, setConfirming] = useState<CityId | null>(null);
  const bonusPct = Math.round((legacyBonus(world.legacy) - 1) * 100);

  const sel = CITY_DEFS[selectedCity];
  const selStatus = statusFor(selectedCity, world, state);
  const selProgress = sel.progress(state);
  const selPrereqsMet = sel.prereqs.every((p) =>
    world.completedCities.includes(p),
  );
  const selIsReachable = selPrereqsMet || selStatus === "current" || selStatus === "settled";
  const selMilestoneMet = sel.isMilestoneMet(state);
  const willSettle =
    selectedCity === world.currentCity &&
    selMilestoneMet &&
    !world.completedCities.includes(selectedCity);

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

      <svg
        className="wm-svg"
        viewBox="0 0 460 260"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Decorative biome blobs behind each city for visual flavor */}
        {CITY_IDS.map((id) => {
          const p = CITY_POS[id];
          return (
            <circle
              key={`bg-${id}`}
              cx={p.x}
              cy={p.y}
              r={36}
              fill={p.biome}
              opacity={0.5}
            />
          );
        })}

        {/* Path between consecutive cities. Solid when both endpoints
            are unlocked, dashed otherwise. */}
        {CITY_IDS.slice(1).map((id, i) => {
          const prev = CITY_IDS[i];
          const a = CITY_POS[prev];
          const b = CITY_POS[id];
          const fromUnlocked =
            world.completedCities.includes(prev) || world.currentCity === prev;
          const toUnlocked =
            world.completedCities.includes(id) ||
            world.currentCity === id ||
            CITY_DEFS[id].prereqs.every((p) => world.completedCities.includes(p));
          const both = fromUnlocked && toUnlocked;
          return (
            <line
              key={`line-${id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={both ? "#88aacc" : "#3a4a5a"}
              strokeWidth={2}
              strokeDasharray={both ? "" : "4 4"}
            />
          );
        })}

        {/* City markers, drawn last so they sit on top of paths */}
        {CITY_IDS.map((id) => {
          const p = CITY_POS[id];
          const status = statusFor(id, world, state);
          const ring = ringColorFor(status);
          const isSelected = selectedCity === id;
          return (
            <g
              key={id}
              className="wm-marker"
              onClick={() => {
                setSelectedCity(id);
                setConfirming(null);
              }}
              transform={`translate(${p.x}, ${p.y})`}
            >
              <circle
                r={CITY_RADIUS + (isSelected ? 4 : 0)}
                fill="#0a1018"
                stroke={ring}
                strokeWidth={isSelected ? 3 : 2}
              />
              <circle r={CITY_RADIUS - 4} fill={ring} />
              <text
                x={0}
                y={CITY_RADIUS + 14}
                textAnchor="middle"
                fontSize={11}
                fill="#cce0ff"
                style={{ pointerEvents: "none" }}
              >
                {CITY_DEFS[id].label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="wm-detail">
        <div className="wm-detail-head">
          <span className="wm-detail-title">{sel.label}</span>
          <span className={`wm-card-status ${selStatus}`}>{selStatus}</span>
        </div>
        <div className="wm-card-desc">{sel.description}</div>
        <div className="wm-milestone">
          milestone: {sel.milestoneLabel}
          {selMilestoneMet && selStatus === "current" && (
            <span className="wm-met"> ✓ ready to settle</span>
          )}
        </div>
        <div className="wm-progress">
          <div
            className="wm-progress-fill"
            style={{ width: `${Math.round(selProgress * 100)}%` }}
          />
        </div>

        {selStatus === "current" && (
          <div className="wm-locked-reason">
            you are here. travel to a different city to settle this one.
          </div>
        )}

        {!selIsReachable && (
          <div className="wm-locked-reason">
            locked. requires:{" "}
            {sel.prereqs
              .map(
                (p) =>
                  CITY_DEFS[p].label +
                  (world.completedCities.includes(p) ? " ✓" : ""),
              )
              .join(", ")}
          </div>
        )}

        {selIsReachable && selectedCity !== world.currentCity && (
          <>
            {confirming === selectedCity ? (
              <div className="wm-confirm">
                <div className="wm-confirm-msg">
                  travel to {sel.label}? this wipes your current map and
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
                      onTravel(selectedCity);
                    }}
                  >
                    yes
                  </button>
                  <button
                    className="wm-btn"
                    onClick={() => setConfirming(null)}
                  >
                    no
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="wm-btn"
                onClick={() => setConfirming(selectedCity)}
              >
                capture this city
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type Status = "current" | "settled" | "reachable" | "locked";

function statusFor(
  id: CityId,
  world: GameState["world"],
  _state: GameState,
): Status {
  if (world.currentCity === id) return "current";
  if (world.completedCities.includes(id)) return "settled";
  const prereqsMet = CITY_DEFS[id].prereqs.every((p) =>
    world.completedCities.includes(p),
  );
  return prereqsMet ? "reachable" : "locked";
}

function ringColorFor(status: Status): string {
  if (status === "current") return "#ccff44";
  if (status === "settled") return "#88aacc";
  if (status === "reachable") return "#aacc88";
  return "#444";
}
