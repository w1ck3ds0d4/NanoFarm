import type { BuildingId, GameState, ResourceId, TerrainType } from "@nanofarm/shared";
import { neighborTerrains } from "@nanofarm/shared";
import { BUILDING_DEFS, HOUSE_CAPACITY, costFor, productionFor } from "../game/buildings";

interface Props {
  state: GameState;
  terrain: Uint8Array;
  connected: Set<string>;
  inspectKey: string;
  onClose: () => void;
  onRemove: () => void;
}

// Short labels for the resource lines. The full names are noisier
// than the inspector needs at this size.
const RESOURCE_LABEL: Record<ResourceId, string> = {
  credits: "cr",
  research: "rs",
  wood: "wood",
  iron: "iron",
  stone: "stone",
  water: "water",
  potatoes: "pot",
};

const TERRAIN_LABEL: Record<TerrainType, string> = {
  grass: "grass",
  water: "water",
  forest: "forest",
  mountain: "mountain",
  mine_deposit: "deposit",
  sand: "sand",
};

export function BuildingInspector({
  state,
  terrain,
  connected,
  inspectKey,
  onClose,
  onRemove,
}: Props) {
  const id = state.map.placed[inspectKey] as BuildingId | undefined;
  if (!id) return null;

  const [xStr, yStr] = inspectKey.split(",");
  const x = Number(xStr);
  const y = Number(yStr);
  const def = BUILDING_DEFS[id];
  const isConnected = connected.has(inspectKey);
  const neighbors = neighborTerrains(terrain, state.map.width, state.map.height, x, y);
  // 4-cardinal building neighbors drive granary/market adjacency
  // bonuses, mirroring computeProduction in game/state.ts.
  const bn = { granary: 0, market: 0 };
  for (const [nx, ny] of [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]) {
    const nid = state.map.placed[`${nx},${ny}`];
    if (nid === "granary") bn.granary++;
    else if (nid === "market") bn.market++;
  }
  const rates = productionFor(id, neighbors, bn);

  // Count each terrain type in the 8 neighbors so the player can see
  // "this farm hits 3 forests + 1 water" without doing the eyeballing.
  const counts: Partial<Record<TerrainType, number>> = {};
  for (const t of neighbors) {
    counts[t] = (counts[t] ?? 0) + 1;
  }

  return (
    <div className="inspector-panel">
      <header className="ip-header">
        <span className="ip-title">{def.label}</span>
        <span className="ip-coord">
          ({x}, {y})
        </span>
        <button
          type="button"
          className="ip-close"
          onClick={onClose}
          aria-label="close inspector"
        >
          x
        </button>
      </header>

      <div className={`ip-status ${isConnected ? "ok" : "stranded"}`}>
        {isConnected ? "connected" : "stranded - build a road to main"}
      </div>

      {def.staffNeed && (() => {
        const need = def.staffNeed;
        const lines: string[] = [];
        if (need.worker) lines.push(`${need.worker} worker${need.worker > 1 ? "s" : ""}`);
        if (need.researcher) lines.push(`${need.researcher} researcher${need.researcher > 1 ? "s" : ""}`);
        if (need.military) lines.push(`${need.military} military`);
        return (
          <div className="ip-note">staffing: {lines.join(" + ")}</div>
        );
      })()}

      {id === "main" && (
        <div className="ip-note">network anchor. no production.</div>
      )}

      {id === "house" && (
        <div className="ip-rates">
          <div className="ip-rate">
            <span className="ip-rate-val">+{HOUSE_CAPACITY}</span>
            <span className="ip-rate-key">pop capacity</span>
          </div>
          {!isConnected && (
            <div className="ip-warn">no capacity contributed while disconnected.</div>
          )}
        </div>
      )}

      {id !== "main" && id !== "house" && (
        <>
          <div className="ip-rates">
            {(Object.entries(rates) as [ResourceId, number][]).map(([resource, rate]) =>
              rate > 0 ? (
                <div key={resource} className="ip-rate">
                  <span className="ip-rate-val">+{rate.toFixed(2)}</span>
                  <span className="ip-rate-key">{RESOURCE_LABEL[resource]}/s</span>
                </div>
              ) : null,
            )}
          </div>
          {!isConnected && (
            <div className="ip-warn">disconnected: actual production is 0/s.</div>
          )}
          {Object.keys(counts).length > 0 && (
            <div className="ip-neighbors">
              neighbors:{" "}
              {(Object.entries(counts) as [TerrainType, number][])
                .map(([t, n]) => `${n}x ${TERRAIN_LABEL[t]}`)
                .join(", ")}
            </div>
          )}
        </>
      )}

      {/* Main is the network anchor and is hidden from removal; for
          everything else the button refunds 50% of the most-recent
          placement cost (which equals what the just-built one paid). */}
      {id !== "main" && (() => {
        const count = state.buildings[id].count;
        const lastCost = costFor(def, count - 1);
        const refund = Math.floor(lastCost * 0.5);
        const matRefunds = def.materialCost
          ? (Object.entries(def.materialCost) as Array<[string, number]>)
              .map(([m, a]) => `${Math.floor(a * 0.5)} ${m.slice(0, 3)}`)
              .filter((s) => !s.startsWith("0 "))
          : [];
        const refundStr = [`${refund} cr`, ...matRefunds].join(" + ");
        return (
          <button
            type="button"
            className="ip-remove"
            onClick={onRemove}
            title="remove this building and refund half its last placement cost"
          >
            remove (refund: {refundStr})
          </button>
        );
      })()}
    </div>
  );
}
