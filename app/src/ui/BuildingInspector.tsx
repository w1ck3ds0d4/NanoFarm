import type { BuildingId, GameState, ResourceId, TerrainType } from "@nanofarm/shared";
import { neighborTerrains } from "@nanofarm/shared";
import { BUILDING_DEFS, HOUSE_CAPACITY, productionFor } from "../game/buildings";

interface Props {
  state: GameState;
  terrain: Uint8Array;
  connected: Set<string>;
  inspectKey: string;
  onClose: () => void;
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

export function BuildingInspector({ state, terrain, connected, inspectKey, onClose }: Props) {
  const id = state.map.placed[inspectKey] as BuildingId | undefined;
  if (!id) return null;

  const [xStr, yStr] = inspectKey.split(",");
  const x = Number(xStr);
  const y = Number(yStr);
  const def = BUILDING_DEFS[id];
  const isConnected = connected.has(inspectKey);
  const neighbors = neighborTerrains(terrain, state.map.width, state.map.height, x, y);
  const rates = productionFor(id, neighbors);

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

      {(id === "farm" || id === "mine") && (
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
    </div>
  );
}
