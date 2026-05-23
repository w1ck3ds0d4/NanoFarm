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
  /** Polygon points (SVG `points` attribute) outlining this region
   * inside the country. Adjacent regions share vertices so their
   * borders abut and the white stroke reads as one continuous
   * subdivision line. */
  points: string;
  /** Where to place the region label + capital marker. */
  capital: { x: number; y: number };
  /** Base biome tint for the region's fill. */
  fill: string;
}

// Country shape inspired by a vertical administrative map (the user
// referenced something like Portugal): four stacked regions, each
// housing one city. Coords assume viewBox 0 0 380 500.
const REGIONS: Record<CityId, RegionShape> = {
  aether_spire: {
    points:
      "130,40 175,30 225,32 260,55 270,90 245,115 200,120 150,115 105,100 95,75",
    capital: { x: 185, y: 75 },
    fill: "#4a3870"
  },
  iron_reach: {
    points:
      "95,75 105,100 150,115 200,120 245,115 270,90 285,130 295,175 270,210 215,225 155,225 105,210 75,180 70,135",
    capital: { x: 185, y: 165 },
    fill: "#525864"
  },
  stonehaven: {
    points:
      "75,180 105,210 155,225 215,225 270,210 295,175 305,225 305,280 285,320 220,335 155,335 95,320 65,275 60,225",
    capital: { x: 185, y: 270 },
    fill: "#6a5a3a"
  },
  verdant_valley: {
    points:
      "65,275 95,320 155,335 220,335 285,320 305,280 315,335 305,395 270,440 215,465 155,465 105,440 75,400 55,345",
    capital: { x: 180, y: 390 },
    fill: "#2e5a1a"
  }
};

// Small biome-flavored ornaments drawn inside each region (a few
// trees, mountains, smokestacks, a spire) so the map reads like a
// real territorial map and not a flat color blob.
const DECOR: Record<CityId, React.ReactNode> = {
  verdant_valley: (
    <g key="vv-decor" opacity={0.8} style={{ pointerEvents: "none" }}>
      {[
        [120, 370], [150, 410], [200, 425], [240, 400], [260, 365],
        [105, 405], [180, 365], [220, 445]
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3} fill="#4a8a2a" />
      ))}
    </g>
  ),
  stonehaven: (
    <g key="sh-decor" opacity={0.85} style={{ pointerEvents: "none" }}>
      {[[140, 250], [185, 240], [230, 250], [165, 300]].map(
        ([cx, cy], i) => (
          <polygon
            key={i}
            points={`${cx},${cy - 13} ${cx - 9},${cy + 4} ${cx + 9},${cy + 4}`}
            fill="#8a7a5a"
            stroke="#3a2a10"
            strokeWidth={1}
          />
        ),
      )}
    </g>
  ),
  iron_reach: (
    <g key="ir-decor" opacity={0.9} style={{ pointerEvents: "none" }}>
      {[[150, 195], [185, 200], [225, 190]].map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx - 3} y={cy - 14} width={6} height={14} fill="#1a1e22" />
          <circle cx={cx} cy={cy - 18} r={4} fill="#ff8830" opacity={0.7} />
        </g>
      ))}
    </g>
  ),
  aether_spire: (
    <g key="as-decor" opacity={0.85} style={{ pointerEvents: "none" }}>
      <polygon points="185,52 180,78 190,78" fill="#aa88ff" />
      <circle cx={185} cy={48} r={3} fill="#ddccff" />
      {[[150, 70], [220, 70], [170, 100], [205, 100]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.5} fill="#ffffff" />
      ))}
    </g>
  )
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

      <div className="wm-map-wrap">
        <svg
          className="wm-svg"
          viewBox="0 0 380 500"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Ocean / outside */}
          <rect width={380} height={500} fill="#0a1828" />

          {/* Country shadow for depth - draws every region as a single
              dark silhouette offset down-right behind the real map. */}
          <g transform="translate(4, 4)" opacity={0.4}>
            {CITY_IDS.map((id) => (
              <polygon key={`shadow-${id}`} points={REGIONS[id].points} fill="#000" />
            ))}
          </g>

          {/* Regions: fill + white subdivision border */}
          {CITY_IDS.map((id) => {
            const r = REGIONS[id];
            const status = statusFor(id, world);
            const isSelected = selectedCity === id;
            const isLocked = status === "locked";
            const fill = isLocked ? "#2a2a2a" : r.fill;
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
                  fill={fill}
                  stroke={isSelected ? "#ffe066" : "#e8e8f0"}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeLinejoin="round"
                  opacity={isLocked ? 0.55 : 1}
                />
              </g>
            );
          })}

          {/* Per-region decor (trees, mountains, etc.). Skipped for
              locked regions so the gray plate stays clean. */}
          {CITY_IDS.map((id) => {
            const status = statusFor(id, world);
            if (status === "locked") return null;
            return DECOR[id];
          })}

          {/* Capital markers + labels. Drawn last so they sit on top
              of biome decor. */}
          {CITY_IDS.map((id) => {
            const r = REGIONS[id];
            const status = statusFor(id, world);
            const isLocked = status === "locked";
            const flag = flagColorFor(status);
            const cx = r.capital.x;
            const cy = r.capital.y;
            return (
              <g
                key={`pin-${id}`}
                style={{ pointerEvents: "none" }}
              >
                {/* Star burst for capital */}
                <circle cx={cx} cy={cy} r={6} fill="#fff" stroke="#000" strokeWidth={1} />
                <circle cx={cx} cy={cy} r={3} fill={flag} />
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {CITY_DEFS[id].label}
                </text>
                {status === "current" && (
                  <text
                    x={cx}
                    y={cy + 18}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#ccff44"
                    stroke="#000"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    you are here
                  </text>
                )}
                {status === "settled" && (
                  <text
                    x={cx}
                    y={cy + 18}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#88aacc"
                    stroke="#000"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    settled
                  </text>
                )}
                {isLocked && (
                  <text
                    x={cx}
                    y={cy + 18}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#888"
                    stroke="#000"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    locked
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

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
            you are here. capture another region to settle this one.
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
                capture this region
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

function flagColorFor(status: Status): string {
  if (status === "current") return "#ccff44";
  if (status === "settled") return "#88aacc";
  if (status === "reachable") return "#ffcc44";
  return "#555";
}
