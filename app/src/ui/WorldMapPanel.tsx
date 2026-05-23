import { useState } from "react";
import type { CityId, GameState } from "@nanofarm/shared";
import { CITY_IDS } from "@nanofarm/shared";
import { CITY_DEFS, legacyBonus } from "../game/cities";

interface Props {
  state: GameState;
  onTravel: (city: CityId) => void;
  onClose: () => void;
}

interface RegionShape {
  /** Polygon points (SVG points attribute) defining the territory's
   * outline in 0 0 600 300 viewBox coords. */
  points: string;
  /** Where the label and any marker should sit, roughly the territory's
   * visual centroid. */
  label: { x: number; y: number };
  /** Base territory fill (before status tint). */
  fill: string;
  /** Per-territory decorative shapes drawn on top of the base fill so
   * each region reads as a distinct biome at a glance. */
  decor: React.ReactNode;
}

// Hand-tuned polygon outlines for each city's territory. The shapes
// are stylized continents, not geographic - each one telegraphs its
// biome via shape, fill, and on-territory decoration.
const REGIONS: Record<CityId, RegionShape> = {
  verdant_valley: {
    points:
      "30,210 60,170 110,150 160,148 200,160 220,195 215,235 180,265 120,272 70,265 28,240",
    label: { x: 122, y: 215 },
    fill: "#2a5a1a",
    decor: (
      <g key="vv-decor" opacity={0.75}>
        {/* tree dots scattered across the forest */}
        {[
          [55, 200], [80, 185], [105, 175], [135, 170], [165, 180],
          [195, 195], [70, 230], [100, 240], [140, 245], [180, 235],
          [85, 255], [125, 260]
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={3} fill="#4a8a2a" />
        ))}
      </g>
    )
  },
  stonehaven: {
    points:
      "240,120 290,95 345,100 385,125 395,165 375,200 335,215 285,210 245,190 230,150",
    label: { x: 312, y: 165 },
    fill: "#5a4a2a",
    decor: (
      <g key="sh-decor" opacity={0.85}>
        {/* mountain triangles */}
        {[
          [275, 165], [310, 155], [345, 170], [300, 185]
        ].map(([cx, cy], i) => (
          <polygon
            key={i}
            points={`${cx},${cy - 14} ${cx - 10},${cy + 4} ${cx + 10},${cy + 4}`}
            fill="#7a6a4a"
            stroke="#3a2a10"
            strokeWidth={1}
          />
        ))}
      </g>
    )
  },
  iron_reach: {
    points:
      "405,160 450,135 510,140 560,160 575,200 555,235 505,250 450,245 410,225 395,195",
    label: { x: 488, y: 200 },
    fill: "#444a52",
    decor: (
      <g key="ir-decor" opacity={0.9}>
        {/* smokestacks */}
        {[[460, 200], [490, 195], [520, 205]].map(([cx, cy], i) => (
          <g key={i}>
            <rect x={cx - 3} y={cy - 18} width={6} height={18} fill="#1a1e22" />
            <circle cx={cx} cy={cy - 24} r={5} fill="#ff8830" opacity={0.7} />
          </g>
        ))}
        {/* factory base */}
        <rect x={445} y={210} width={90} height={18} fill="#2a3038" />
      </g>
    )
  },
  aether_spire: {
    points:
      "460,30 510,18 560,28 580,55 565,80 525,90 485,82 450,60",
    label: { x: 515, y: 60 },
    fill: "#3a2a5a",
    decor: (
      <g key="as-decor" opacity={0.85}>
        {/* single tall spire */}
        <polygon points="515,32 510,75 520,75" fill="#aa88ff" />
        <circle cx={515} cy={28} r={4} fill="#ddccff" />
        {/* stars / sparkles */}
        {[[475, 45], [555, 50], [490, 70], [550, 75]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.5} fill="#ffffff" />
        ))}
      </g>
    )
  }
};

export function WorldMapPanel({ state, onTravel, onClose }: Props) {
  const world = state.world;
  const [selectedCity, setSelectedCity] = useState<CityId>(world.currentCity);
  const [confirming, setConfirming] = useState<CityId | null>(null);
  const bonusPct = Math.round((legacyBonus(world.legacy) - 1) * 100);

  const sel = CITY_DEFS[selectedCity];
  const selStatus = statusFor(selectedCity, world);
  const selProgress = sel.progress(state);
  const selPrereqsMet = sel.prereqs.every((p) =>
    world.completedCities.includes(p),
  );
  const selIsReachable =
    selPrereqsMet || selStatus === "current" || selStatus === "settled";
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
          legacy {world.legacy} ({bonusPct >= 0 ? "+" : ""}
          {bonusPct}% production)
        </span>
        <button className="wm-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>

      <svg
        className="wm-svg"
        viewBox="0 0 600 300"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean background */}
        <rect width={600} height={300} fill="#0a1828" />
        {/* Wave pattern hint - sparse horizontal ticks across the ocean */}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = (i % 10) * 65 + 8;
          const y = Math.floor(i / 10) * 95 + 50;
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x + 6}
              y2={y}
              stroke="#1a3858"
              strokeWidth={1}
            />
          );
        })}

        {/* Territories: shadow polygon first (offset down-right), then
            the base polygon, then per-territory decor, then label.
            Order matters so decor sits on top of the fill. */}
        {CITY_IDS.map((id) => {
          const r = REGIONS[id];
          const status = statusFor(id, world);
          const isSelected = selectedCity === id;
          const isLocked = status === "locked";
          const stroke = strokeFor(status);
          // Locked territories are darker + grayed-out until prereqs
          // are settled. Selected territory gets a thicker stroke and
          // a glow filter to pop forward.
          const tint = isLocked ? "#1a1a1a" : r.fill;
          return (
            <g
              key={id}
              className={`wm-region${isLocked ? " locked" : ""}`}
              onClick={() => {
                setSelectedCity(id);
                setConfirming(null);
              }}
            >
              <polygon
                points={r.points}
                fill={tint}
                stroke={stroke}
                strokeWidth={isSelected ? 3 : 2}
                opacity={isLocked ? 0.55 : 1}
              />
              {!isLocked && r.decor}
              <text
                x={r.label.x}
                y={r.label.y}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {CITY_DEFS[id].label}
              </text>
              {status === "current" && (
                <text
                  x={r.label.x}
                  y={r.label.y + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#ccff44"
                  style={{ pointerEvents: "none" }}
                >
                  you are here
                </text>
              )}
              {status === "settled" && (
                <text
                  x={r.label.x}
                  y={r.label.y + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#88aacc"
                  style={{ pointerEvents: "none" }}
                >
                  settled
                </text>
              )}
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
            you are here. travel to a different territory to settle this one.
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
                  capture {sel.label}? this wipes your current map and
                  resources.
                  {willSettle && (
                    <span className="wm-confirm-bonus">
                      {" "}you will settle the current city and earn +1
                      legacy.
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
                capture this territory
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type Status = "current" | "settled" | "reachable" | "locked";

function statusFor(id: CityId, world: GameState["world"]): Status {
  if (world.currentCity === id) return "current";
  if (world.completedCities.includes(id)) return "settled";
  const prereqsMet = CITY_DEFS[id].prereqs.every((p) =>
    world.completedCities.includes(p),
  );
  return prereqsMet ? "reachable" : "locked";
}

function strokeFor(status: Status): string {
  if (status === "current") return "#ccff44";
  if (status === "settled") return "#88aacc";
  if (status === "reachable") return "#aacc88";
  return "#3a3a3a";
}
