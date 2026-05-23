import { useState } from "react";
import type { CityId, GameState } from "@nanofarm/shared";
import { CITY_IDS } from "@nanofarm/shared";
import { CITY_DEFS, legacyBonus } from "../game/cities";

interface Props {
  state: GameState;
  onTravel: (city: CityId) => void;
  onClose: () => void;
}

// Single-country layout. All cities live inside one chunky landmass
// outline; biome blobs hint at the local terrain around each city,
// and a single road snakes through them in prereq order.
//
// Coords assume an SVG viewBox of 0 0 600 320.

const COUNTRY_OUTLINE =
  "55,150 70,110 100,80 145,65 200,55 260,55 320,50 380,55 440,65 490,85 530,115 555,160 555,210 530,250 480,275 420,285 350,288 280,285 215,280 160,270 110,250 75,215 55,180";

interface CityPin {
  x: number;
  y: number;
  /** A few decorative shapes drawn inside the city's biome blob to
   * telegraph what kind of place it is. */
  decor: React.ReactNode;
  /** Base biome tint (a soft elliptical wash beneath the marker) */
  biome: string;
}

const CITY_PINS: Record<CityId, CityPin> = {
  verdant_valley: {
    x: 145,
    y: 215,
    biome: "#2e5a1a",
    decor: (
      <g key="vv-decor" opacity={0.8}>
        {[
          [95, 200], [115, 235], [165, 240], [180, 200],
          [200, 230], [125, 180], [80, 220]
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={3} fill="#4a8a2a" />
        ))}
      </g>
    )
  },
  stonehaven: {
    x: 290,
    y: 165,
    biome: "#6a5a3a",
    decor: (
      <g key="sh-decor" opacity={0.85}>
        {[[260, 145], [290, 130], [320, 145]].map(([cx, cy], i) => (
          <polygon
            key={i}
            points={`${cx},${cy - 14} ${cx - 10},${cy + 4} ${cx + 10},${cy + 4}`}
            fill="#8a7a5a"
            stroke="#3a2a10"
            strokeWidth={1}
          />
        ))}
      </g>
    )
  },
  iron_reach: {
    x: 420,
    y: 145,
    biome: "#4a5260",
    decor: (
      <g key="ir-decor" opacity={0.9}>
        {[[390, 130], [440, 125]].map(([cx, cy], i) => (
          <g key={i}>
            <rect x={cx - 3} y={cy - 14} width={6} height={14} fill="#1a1e22" />
            <circle cx={cx} cy={cy - 18} r={4} fill="#ff8830" opacity={0.7} />
          </g>
        ))}
      </g>
    )
  },
  aether_spire: {
    x: 500,
    y: 105,
    biome: "#3a2a5a",
    decor: (
      <g key="as-decor" opacity={0.85}>
        <polygon points="500,80 495,108 505,108" fill="#aa88ff" />
        <circle cx={500} cy={76} r={3} fill="#ddccff" />
        {[[475, 95], [525, 95], [490, 75], [520, 115]].map(([cx, cy], i) => (
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
        viewBox="0 0 600 320"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean */}
        <rect width={600} height={320} fill="#0a1828" />
        {/* sparse wave ticks across the ocean */}
        {Array.from({ length: 28 }).map((_, i) => {
          const x = (i % 14) * 44 + 10;
          const y = Math.floor(i / 14) * 280 + 25;
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x + 5}
              y2={y}
              stroke="#1a3858"
              strokeWidth={1}
            />
          );
        })}

        {/* Country shadow (offset down + right for depth) */}
        <polygon
          points={COUNTRY_OUTLINE}
          fill="#000000"
          opacity={0.35}
          transform="translate(4, 4)"
        />
        {/* Country landmass */}
        <polygon
          points={COUNTRY_OUTLINE}
          fill="#3a4628"
          stroke="#6a7a44"
          strokeWidth={2}
        />

        {/* Subtle biome wash around each city. Drawn before decor so
            decor shapes sit on top of the tint. */}
        {CITY_IDS.map((id) => {
          const pin = CITY_PINS[id];
          const status = statusFor(id, world);
          if (status === "locked") return null;
          return (
            <ellipse
              key={`biome-${id}`}
              cx={pin.x}
              cy={pin.y}
              rx={62}
              ry={42}
              fill={pin.biome}
              opacity={0.55}
            />
          );
        })}

        {/* Per-city biome decor */}
        {CITY_IDS.map((id) => {
          const status = statusFor(id, world);
          if (status === "locked") return null;
          return CITY_PINS[id].decor;
        })}

        {/* Roads connecting cities in prereq order. Solid when both
            endpoints are at least reachable, dashed otherwise. */}
        {CITY_IDS.slice(1).map((id, i) => {
          const prev = CITY_IDS[i];
          const a = CITY_PINS[prev];
          const b = CITY_PINS[id];
          const fromOk =
            world.completedCities.includes(prev) || world.currentCity === prev;
          const toOk =
            statusFor(id, world) !== "locked";
          const both = fromOk && toOk;
          // Quadratic curve for a slightly winding road
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 14;
          return (
            <path
              key={`road-${id}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke={both ? "#aa9866" : "#3a3a3a"}
              strokeWidth={2}
              strokeDasharray={both ? "" : "5 4"}
            />
          );
        })}

        {/* City pins. Each is a small fort-style marker: rect base +
            triangular roof + flag color matching status. */}
        {CITY_IDS.map((id) => {
          const pin = CITY_PINS[id];
          const status = statusFor(id, world);
          const flag = flagColorFor(status);
          const isSelected = selectedCity === id;
          const isLocked = status === "locked";

          return (
            <g
              key={id}
              className={`wm-region${isLocked ? " locked" : ""}`}
              onClick={() => {
                setSelectedCity(id);
                setConfirming(null);
              }}
            >
              {/* Hit target: invisible rect bigger than the pin so the
                  click area is generous. */}
              <rect
                x={pin.x - 30}
                y={pin.y - 30}
                width={60}
                height={60}
                fill="transparent"
              />
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={22}
                  fill="none"
                  stroke={flag}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  opacity={0.9}
                />
              )}
              {/* Fort base */}
              <rect
                x={pin.x - 9}
                y={pin.y - 4}
                width={18}
                height={12}
                fill={isLocked ? "#2a2a2a" : "#d8c890"}
                stroke="#3a2a10"
                strokeWidth={1}
              />
              {/* Crenellations */}
              <rect
                x={pin.x - 9}
                y={pin.y - 7}
                width={4}
                height={3}
                fill={isLocked ? "#2a2a2a" : "#d8c890"}
                stroke="#3a2a10"
                strokeWidth={1}
              />
              <rect
                x={pin.x - 2}
                y={pin.y - 7}
                width={4}
                height={3}
                fill={isLocked ? "#2a2a2a" : "#d8c890"}
                stroke="#3a2a10"
                strokeWidth={1}
              />
              <rect
                x={pin.x + 5}
                y={pin.y - 7}
                width={4}
                height={3}
                fill={isLocked ? "#2a2a2a" : "#d8c890"}
                stroke="#3a2a10"
                strokeWidth={1}
              />
              {/* Flagpole + flag */}
              <line
                x1={pin.x}
                y1={pin.y - 7}
                x2={pin.x}
                y2={pin.y - 20}
                stroke="#3a2a10"
                strokeWidth={1.5}
              />
              <polygon
                points={`${pin.x},${pin.y - 20} ${pin.x + 10},${pin.y - 17} ${pin.x},${pin.y - 14}`}
                fill={flag}
              />
              {/* Label */}
              <text
                x={pin.x}
                y={pin.y + 22}
                textAnchor="middle"
                fontSize={11}
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
                  x={pin.x}
                  y={pin.y + 33}
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
                  x={pin.x}
                  y={pin.y + 33}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#88aacc"
                  style={{ pointerEvents: "none" }}
                >
                  settled
                </text>
              )}
              {status === "locked" && (
                <text
                  x={pin.x}
                  y={pin.y + 33}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#666"
                  style={{ pointerEvents: "none" }}
                >
                  locked
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
            you are here. capture another city to settle this one.
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
