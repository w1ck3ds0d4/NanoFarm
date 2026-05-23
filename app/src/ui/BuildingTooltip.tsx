import type { BuildingId, GameState, ResourceId } from "@nanofarm/shared";
import { neighborTerrains } from "@nanofarm/shared";
import { BUILDING_DEFS, HOUSE_CAPACITY, productionFor } from "../game/buildings";
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

// Abbreviated resource labels for the compact tooltip body so we
// can fit a 3-4 resource summary on one line without wrapping.
const SHORT: Record<ResourceId, string> = {
  credits: "cr",
  research: "rs",
  wood: "wd",
  iron: "ir",
  stone: "st",
  water: "wt",
  potatoes: "pot",
};

export function BuildingTooltip({
  state,
  terrain,
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

  // Build a one-line production summary so the tooltip can stay tiny.
  let summary: string;
  if (id === "main") {
    summary = "anchor";
  } else if (id === "house") {
    summary = `+${HOUSE_CAPACITY} pop`;
  } else {
    const neighbors = neighborTerrains(terrain, state.map.width, state.map.height, tx, ty);
    const rates = productionFor(id, neighbors);
    summary = (Object.entries(rates) as [ResourceId, number][])
      .filter(([, r]) => r > 0)
      .map(([k, r]) => `+${r.toFixed(1)} ${SHORT[k]}`)
      .join("  ");
    if (!summary) summary = "no output";
  }

  // Anchor the tooltip to the top of the tile diamond. Pointer-events
  // are disabled in CSS so the tooltip never eats clicks meant for
  // the building underneath.
  const { sx, sy } = tileToScreen(tx, ty, cameraX, cameraY, canvasW, canvasH, zoom);
  const left = sx + (TILE_W * zoom) / 2;
  const top = sy - 6;

  return (
    <div
      className="building-tooltip"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <span className={`bt-label ${isConnected ? "ok" : "stranded"}`}>{def.label}</span>
      <span className="bt-sep">·</span>
      <span className="bt-summary">
        {isConnected ? summary : "stranded"}
      </span>
    </div>
  );
}
