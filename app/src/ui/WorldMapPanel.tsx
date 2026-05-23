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

// Hand-drawn country with four asymmetric regions: a narrow northern
// peninsula (Aether Spire), a wide industrial midsection bulging east
// (Iron Reach), a long western coastal strip (Stonehaven), and a
// southern + eastern lobe (Verdant Valley). Coastline points are
// deliberately bumpy so the shape reads as a country, not a blob.
// Coords assume viewBox 0 0 420 520.
const REGIONS: Record<CityId, RegionShape> = {
  aether_spire: {
    // Narrow peninsula at the top, with a small inlet on the west side.
    points:
      "180,32 200,22 222,18 245,24 258,38 262,55 258,72 254,88 248,100 235,108 218,112 200,114 182,110 168,102 158,90 150,76 145,60 148,48 158,38 168,32",
    capital: { x: 205, y: 70 },
    fill: "#4a3870"
  },
  iron_reach: {
    // Wide industrial midsection, with a pronounced east-coast bulge
    // for a peninsula and a small bay on the western coast.
    points:
      "150,76 158,90 168,102 182,110 200,114 218,112 235,108 248,100 254,88 268,86 285,92 305,102 325,114 342,130 358,148 368,168 372,188 362,208 348,222 328,234 308,242 286,244 262,240 240,232 218,226 198,222 178,224 158,228 138,232 118,230 95,220 75,205 60,185 55,165 60,142 72,122 88,108 105,98 118,90 132,84",
    capital: { x: 215, y: 175 },
    fill: "#525864"
  },
  stonehaven: {
    // Long western coastal strip - tall and narrow, with several
    // coastal bays and a small inland inlet on the east where it
    // meets Verdant Valley.
    points:
      "55,165 60,185 75,205 95,220 118,230 138,232 158,228 178,224 178,260 175,295 172,330 165,365 152,395 132,420 108,435 80,440 58,430 42,412 28,388 18,360 12,325 16,290 28,255 42,225 50,195",
    capital: { x: 108, y: 332 },
    fill: "#6a5a3a"
  },
  verdant_valley: {
    // Largest region: hugs the south + east coast with a deep eastern
    // peninsula and a small southern peninsula extending down.
    points:
      "178,224 198,222 218,226 240,232 262,240 286,244 308,242 328,234 348,222 362,208 372,225 382,250 388,278 388,308 382,340 370,375 352,408 328,438 298,460 268,478 238,488 208,490 188,478 178,455 175,420 178,385 182,350 184,315 182,280 180,255",
    capital: { x: 295, y: 380 },
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
        [225, 350], [255, 395], [295, 420], [330, 400], [310, 360],
        [205, 410], [275, 360], [245, 440], [195, 360], [340, 340]
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3} fill="#4a8a2a" />
      ))}
    </g>
  ),
  stonehaven: (
    <g key="sh-decor" opacity={0.85} style={{ pointerEvents: "none" }}>
      {[[75, 300], [110, 290], [140, 305], [90, 360], [125, 370]].map(
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
      {[[180, 195], [215, 200], [250, 195], [285, 190]].map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx - 3} y={cy - 14} width={6} height={14} fill="#1a1e22" />
          <circle cx={cx} cy={cy - 18} r={4} fill="#ff8830" opacity={0.7} />
        </g>
      ))}
    </g>
  ),
  aether_spire: (
    <g key="as-decor" opacity={0.85} style={{ pointerEvents: "none" }}>
      <polygon points="205,52 200,78 210,78" fill="#aa88ff" />
      <circle cx={205} cy={48} r={3} fill="#ddccff" />
      {[[175, 65], [240, 65], [185, 95], [225, 95]].map(([cx, cy], i) => (
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
          viewBox="0 0 420 520"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Ocean / outside */}
          <rect width={420} height={520} fill="#0a1828" />

          {/* Two small offshore islands for character */}
          <g opacity={0.75}>
            <polygon
              points="378,118 392,112 400,122 398,136 388,142 376,138 370,128"
              fill="#3a4628"
              stroke="#e8e8f0"
              strokeWidth={1}
            />
            <polygon
              points="395,295 408,300 410,312 402,320 392,316"
              fill="#3a4628"
              stroke="#e8e8f0"
              strokeWidth={1}
            />
          </g>

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
