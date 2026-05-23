import { useState } from "react";
import type { CityId, GameState } from "@nanofarm/shared";
import { CITY_IDS } from "@nanofarm/shared";
import { CITY_DEFS, legacyBonus } from "../game/cities";

interface Props {
  state: GameState;
  onTravel: (city: CityId) => void;
  onClose: () => void;
}

// Hex grid layout. Each city occupies one flat-top hexagon of uniform
// size; centers are picked so the cluster reads as a country shape
// (peak at top, starter at the south, midlands in between).
const HEX_R = 38;
const HEX_CENTERS: Record<CityId, { x: number; y: number }> = {
  aether_spire:   { x: 180, y: 92 },
  skyhold:        { x: 122, y: 125 },
  iron_reach:     { x: 238, y: 125 },
  stonehaven:     { x: 180, y: 158 },
  frostpeak:      { x: 122, y: 191 },
  pinewood:       { x: 238, y: 191 },
  verdant_valley: { x: 180, y: 224 },
  greenmarsh:     { x: 122, y: 257 }
};

const BIOMES: Record<CityId, { fill: string; icon: React.ReactNode }> = {
  verdant_valley: {
    fill: "#2e8a1a",
    icon: <text fontSize="14" textAnchor="middle">🌳</text>
  },
  pinewood: {
    fill: "#1e5a18",
    icon: <PineIcon />
  },
  greenmarsh: {
    fill: "#3a6a4a",
    icon: <ReedIcon />
  },
  stonehaven: {
    fill: "#6a5a3a",
    icon: <MountainIcon />
  },
  frostpeak: {
    fill: "#788898",
    icon: <SnowPeakIcon />
  },
  iron_reach: {
    fill: "#525864",
    icon: <SmokestackIcon />
  },
  skyhold: {
    fill: "#3a4a70",
    icon: <ObservatoryIcon />
  },
  aether_spire: {
    fill: "#4a3870",
    icon: <SpireIcon />
  }
};

function hexPoints(cx: number, cy: number, r: number): string {
  const dx = r * 0.5;
  const dy = (r * Math.sqrt(3)) / 2;
  return [
    [cx + r, cy],
    [cx + dx, cy + dy],
    [cx - dx, cy + dy],
    [cx - r, cy],
    [cx - dx, cy - dy],
    [cx + dx, cy - dy]
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

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
          viewBox="0 0 360 320"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background grid hint - faint dotted texture so the
              empty space outside the country reads as "unexplored"
              rather than a screen border. */}
          <rect width={360} height={320} fill="#0a1828" />

          {/* Prereq lines: faint connectors between each city and
              its prerequisites, drawn under the hexes. */}
          {CITY_IDS.map((id) => {
            const def = CITY_DEFS[id];
            const me = HEX_CENTERS[id];
            return def.prereqs.map((p) => {
              const from = HEX_CENTERS[p];
              const bothReachable =
                statusFor(id, world) !== "locked" &&
                statusFor(p, world) !== "locked";
              return (
                <line
                  key={`${p}-${id}`}
                  x1={from.x}
                  y1={from.y}
                  x2={me.x}
                  y2={me.y}
                  stroke={bothReachable ? "#88aacc" : "#2a3a4a"}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
              );
            });
          })}

          {/* Hex tiles */}
          {CITY_IDS.map((id) => {
            const c = HEX_CENTERS[id];
            const biome = BIOMES[id];
            const status = statusFor(id, world);
            const isSelected = selectedCity === id;
            const isLocked = status === "locked";
            const fill = isLocked ? "#262626" : biome.fill;
            const stroke = isSelected
              ? "#ffe066"
              : status === "current"
                ? "#ccff44"
                : status === "settled"
                  ? "#88aacc"
                  : "#e8e8f0";
            const strokeWidth = isSelected || status === "current" ? 3 : 1.5;
            return (
              <g
                key={id}
                className={`wm-hex${isLocked ? " locked" : ""}`}
                onClick={() => {
                  setSelectedCity(id);
                  setConfirming(null);
                }}
              >
                <polygon
                  points={hexPoints(c.x, c.y, HEX_R)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  opacity={isLocked ? 0.55 : 1}
                />
                {/* Biome icon, centered above the label */}
                {!isLocked && (
                  <g transform={`translate(${c.x - 10}, ${c.y - 22})`}>
                    {biome.icon}
                  </g>
                )}
                {/* City label */}
                <text
                  x={c.x}
                  y={c.y + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {CITY_DEFS[id].label}
                </text>
                {/* Status tag */}
                <text
                  x={c.x}
                  y={c.y + 17}
                  textAnchor="middle"
                  fontSize={8}
                  fill={
                    status === "current"
                      ? "#ccff44"
                      : status === "settled"
                        ? "#88aacc"
                        : status === "reachable"
                          ? "#ffcc44"
                          : "#888"
                  }
                  stroke="#000"
                  strokeWidth={2}
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {status}
                </text>
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

// ─── Tiny SVG biome icons ────────────────────────────────────────────────────
// Each icon is drawn inside a 20x20 box and gets translated above
// the city label in the hex.

function PineIcon() {
  return (
    <g>
      <polygon points="10,2 4,14 16,14" fill="#1a4010" stroke="#000" strokeWidth={0.5} />
      <polygon points="10,7 5,17 15,17" fill="#1a4010" stroke="#000" strokeWidth={0.5} />
      <rect x={9} y={16} width={2} height={3} fill="#3a2810" />
    </g>
  );
}

function ReedIcon() {
  return (
    <g stroke="#000" strokeWidth={0.5}>
      <line x1={5} y1={18} x2={5} y2={4} stroke="#7aa848" strokeWidth={1.5} />
      <line x1={10} y1={18} x2={10} y2={2} stroke="#7aa848" strokeWidth={1.5} />
      <line x1={15} y1={18} x2={15} y2={5} stroke="#7aa848" strokeWidth={1.5} />
      <ellipse cx={5} cy={4} rx={1.5} ry={2.5} fill="#c8a050" />
      <ellipse cx={10} cy={2} rx={1.5} ry={2.5} fill="#c8a050" />
      <ellipse cx={15} cy={5} rx={1.5} ry={2.5} fill="#c8a050" />
    </g>
  );
}

function MountainIcon() {
  return (
    <g stroke="#000" strokeWidth={0.5}>
      <polygon points="3,17 8,5 13,17" fill="#a89070" />
      <polygon points="10,17 14,9 18,17" fill="#8a7858" />
    </g>
  );
}

function SnowPeakIcon() {
  return (
    <g stroke="#000" strokeWidth={0.5}>
      <polygon points="2,17 10,3 18,17" fill="#a8b0c0" />
      <polygon points="6,11 10,3 14,11" fill="#ffffff" />
    </g>
  );
}

function SmokestackIcon() {
  return (
    <g stroke="#000" strokeWidth={0.5}>
      <rect x={4} y={8} width={4} height={11} fill="#2a2a30" />
      <rect x={11} y={5} width={4} height={14} fill="#2a2a30" />
      <circle cx={6} cy={6} r={2} fill="#ff8830" />
      <circle cx={13} cy={3} r={2} fill="#ff8830" />
    </g>
  );
}

function ObservatoryIcon() {
  return (
    <g stroke="#000" strokeWidth={0.5}>
      <rect x={4} y={11} width={12} height={8} fill="#d8c890" />
      <ellipse cx={10} cy={11} rx={6} ry={4} fill="#88a0c8" />
      <line x1={10} y1={2} x2={10} y2={8} stroke="#88a0c8" strokeWidth={1} />
      <circle cx={10} cy={2} r={1.5} fill="#ffffff" />
    </g>
  );
}

function SpireIcon() {
  return (
    <g stroke="#000" strokeWidth={0.5}>
      <polygon points="10,1 7,18 13,18" fill="#aa88ff" />
      <circle cx={10} cy={1} r={1.5} fill="#ddccff" stroke="none" />
      <circle cx={4} cy={6} r={1} fill="#ffffff" stroke="none" />
      <circle cx={16} cy={9} r={1} fill="#ffffff" stroke="none" />
    </g>
  );
}
