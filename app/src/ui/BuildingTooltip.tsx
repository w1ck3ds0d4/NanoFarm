import type { BuildingId, GameState, ResourceId } from "@nanofarm/shared";
import { BUILDING_DEFS, HOUSE_CAPACITY } from "../game/buildings";
import { tileToScreen } from "../pixi/scene";
import { TILE_W } from "../pixi/tiles";

interface Props {
  state: GameState;
  terrain: Uint8Array;
  connected: Set<string>;
  tx: number;
  ty: number;
  cameraX: number;
  cameraY: number;
  zoom: number;
  canvasW: number;
  canvasH: number;
}

const SHORT: Record<ResourceId, string> = {
  credits: "cr",
  research: "rs",
  wood: "wd",
  iron: "ir",
  stone: "st",
  food: "fd",
  goods: "gd",
  tools: "tl",
};

export function BuildingTooltip({
  state,
  connected,
  tx,
  ty,
  cameraX,
  cameraY,
  zoom,
  canvasW,
  canvasH,
}: Props) {
  const key = `${tx},${ty}`;
  const id = state.map.placed[key] as BuildingId | undefined;
  if (!id) return null;

  const def = BUILDING_DEFS[id];
  const isConnected = connected.has(key);
  const isDisabled = !!state.map.disabled?.[key];
  const ops = def.ops;

  // Estimate the building's current run ratio so the tooltip's
  // numbers reflect actual production, matching the inspector.
  // Same approximation: read staffing + service ratios from the
  // persisted snapshots and use stockpile-empty as a 0-input flag.
  const pop = state.meta.population;
  const services = state.meta.services;
  function ratioOrOne(s: number, d: number): number {
    return d <= 0 ? 1 : Math.min(1, s / d);
  }
  let workerD = 0, researcherD = 0, militaryD = 0;
  const origins = state.map.multiTileOrigin ?? {};
  for (const [k2, oid] of Object.entries(state.map.placed) as [string, BuildingId][]) {
    if (origins[k2]) continue;
    if (oid !== "main" && !connected.has(k2)) continue;
    const n = BUILDING_DEFS[oid]?.staffNeed;
    if (!n) continue;
    workerD += n.worker ?? 0;
    researcherD += n.researcher ?? 0;
    militaryD += n.military ?? 0;
  }
  const wR = ratioOrOne(pop.worker, workerD);
  const rR = ratioOrOne(pop.researcher, researcherD);
  const mR = ratioOrOne(pop.military, militaryD);
  const pR = ratioOrOne(services.powerSupply, services.powerDemand);
  const waR = ratioOrOne(services.waterSupply, services.waterDemand);

  let staffR = 1;
  if (def.staffNeed?.worker) staffR = Math.min(staffR, wR);
  if (def.staffNeed?.researcher) staffR = Math.min(staffR, rR);
  if (def.staffNeed?.military) staffR = Math.min(staffR, mR);
  let runRatio = isConnected && !isDisabled ? staffR : 0;
  if (runRatio > 0) {
    if (ops?.powerNeed) runRatio = Math.min(runRatio, pR);
    if (ops?.waterNeed) runRatio = Math.min(runRatio, waR);
    if (ops?.consumes) {
      for (const [res] of Object.entries(ops.consumes)) {
        if ((state.resources[res as ResourceId] ?? 0) <= 0) {
          runRatio = 0;
          break;
        }
      }
    }
  }

  let summary: string;
  if (id === "main") {
    summary = "anchor";
  } else if (id === "house") {
    summary = `+${HOUSE_CAPACITY} pop`;
  } else if (!isConnected) {
    summary = "stranded";
  } else if (isDisabled) {
    summary = "paused";
  } else if (ops?.produces) {
    summary = (Object.entries(ops.produces) as [ResourceId, number][])
      .filter(([, r]) => r > 0)
      .map(([k, r]) => `+${(r * runRatio).toFixed(1)} ${SHORT[k]}`)
      .join("  ");
    if (!summary) summary = "no output";
  } else {
    summary = "no output";
  }

  const { sx, sy } = tileToScreen(tx, ty, cameraX, cameraY, canvasW, canvasH, zoom);
  const left = sx + (TILE_W * zoom) / 2;
  const top = sy - 6;

  const statusClass = !isConnected
    ? "stranded"
    : isDisabled
      ? "paused"
      : runRatio === 0
        ? "stranded"
        : runRatio < 1
          ? "warn"
          : "ok";

  return (
    <div
      className="building-tooltip"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <span className={`bt-label ${statusClass}`}>{def.label}</span>
      <span className="bt-sep">·</span>
      <span className="bt-summary">{summary}</span>
    </div>
  );
}
