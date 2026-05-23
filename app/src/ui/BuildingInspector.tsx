import type { ReactElement } from "react";
import type { BuildingId, GameState, ResourceId, TerrainType } from "@nanofarm/shared";
import { neighborTerrains } from "@nanofarm/shared";
import { BUILDING_DEFS, HOUSE_CAPACITY, costFor, type BuildingDef } from "../game/buildings";

interface Props {
  state: GameState;
  terrain: Uint8Array;
  connected: Set<string>;
  inspectKey: string;
  onClose: () => void;
  onRemove: () => void;
  onToggleDisabled: () => void;
}

// Short labels for the resource lines. The full names are noisier
// than the inspector needs at this size.
const RESOURCE_LABEL: Record<ResourceId, string> = {
  credits: "cr",
  research: "rs",
  wood: "wood",
  iron: "iron",
  stone: "stone",
  food: "food",
  goods: "goods",
  tools: "tools",
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
  onToggleDisabled,
}: Props) {
  const id = state.map.placed[inspectKey] as BuildingId | undefined;
  if (!id) return null;

  const [xStr, yStr] = inspectKey.split(",");
  const x = Number(xStr);
  const y = Number(yStr);
  const def = BUILDING_DEFS[id];
  const isConnected = connected.has(inspectKey);
  const isDisabled = !!state.map.disabled?.[inspectKey];
  const neighbors = neighborTerrains(terrain, state.map.width, state.map.height, x, y);
  const ops = def.ops;

  // Count each terrain type in the 8 neighbors so the player can see
  // "this farm hits 3 forests + 1 water" without doing the eyeballing.
  const counts: Partial<Record<TerrainType, number>> = {};
  for (const t of neighbors) {
    counts[t] = (counts[t] ?? 0) + 1;
  }

  // Estimate the building's current run ratio from citywide service
  // and staffing snapshots. This is approximate (we don't re-run
  // simulateTick here, we just read what was persisted on meta /
  // population) but accurate enough to tell the player whether the
  // building is at 100% or starved.
  const pop = state.meta.population;
  const services = state.meta.services;

  function ratioOrOne(supply: number, demand: number): number {
    if (demand <= 0) return 1;
    return Math.min(1, supply / demand);
  }

  // Citywide staffing demand totals (for the worker / researcher
  // ratios). This is the same math simulate.ts does, just inlined.
  let workerDemand = 0,
    researcherDemand = 0,
    militaryDemand = 0;
  const origins = state.map.multiTileOrigin ?? {};
  for (const [key, otherId] of Object.entries(state.map.placed) as [
    string,
    BuildingId,
  ][]) {
    if (origins[key]) continue;
    if (otherId !== "main" && !connected.has(key)) continue;
    const need = BUILDING_DEFS[otherId]?.staffNeed;
    if (!need) continue;
    workerDemand += need.worker ?? 0;
    researcherDemand += need.researcher ?? 0;
    militaryDemand += need.military ?? 0;
  }
  const workerRatio = ratioOrOne(pop.worker, workerDemand);
  const researcherRatio = ratioOrOne(pop.researcher, researcherDemand);
  const militaryRatio = ratioOrOne(pop.military, militaryDemand);
  const powerRatio = ratioOrOne(services.powerSupply, services.powerDemand);
  const waterRatio = ratioOrOne(services.waterSupply, services.waterDemand);

  let staffR = 1;
  if (def.staffNeed?.worker) staffR = Math.min(staffR, workerRatio);
  if (def.staffNeed?.researcher) staffR = Math.min(staffR, researcherRatio);
  if (def.staffNeed?.military) staffR = Math.min(staffR, militaryRatio);

  let runRatio = isConnected ? staffR : 0;
  if (isConnected) {
    if (ops?.powerNeed) runRatio = Math.min(runRatio, powerRatio);
    if (ops?.waterNeed) runRatio = Math.min(runRatio, waterRatio);
    // Input ratio approximation: if any required input is at zero in
    // the stockpile, the building runs at zero on inputs. (We can't
    // compute exact per-input ratios without re-running simulate.)
    if (ops?.consumes) {
      for (const [res] of Object.entries(ops.consumes)) {
        if ((state.resources[res as ResourceId] ?? 0) <= 0) {
          runRatio = 0;
          break;
        }
      }
    }
  }
  const runPct = Math.round(runRatio * 100);

  // Render-time helper for a single flow line ("+0.50 wood/s" or
  // "-0.30 iron/s") in the panel body.
  function flowLine(
    sign: "+" | "-",
    res: ResourceId,
    rate: number,
    key: string,
  ): ReactElement {
    return (
      <div key={key} className="ip-rate">
        <span className={`ip-rate-val ${sign === "+" ? "" : "neg"}`}>
          {sign}
          {rate.toFixed(2)}
        </span>
        <span className="ip-rate-key">{RESOURCE_LABEL[res]}/s</span>
      </div>
    );
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
        {isDisabled && " · PAUSED"}
      </div>

      {id !== "main" && id !== "house" && isConnected && !isDisabled && (
        <div className={`ip-runline ${runPct === 100 ? "ok" : runPct > 0 ? "warn" : "bad"}`}>
          running at {runPct}%
          {runPct < 100 && bottleneckLabel(def, pop, services, state.resources)}
        </div>
      )}

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

      {(ops?.powerNeed || ops?.waterNeed || ops?.powerSupply || ops?.waterSupply) && (
        <div className="ip-note">
          {ops.powerNeed ? `needs ${ops.powerNeed} pw` : ""}
          {ops.powerNeed && ops.waterNeed ? " + " : ""}
          {ops.waterNeed ? `${ops.waterNeed} wt` : ""}
          {ops.powerSupply ? `supplies ${ops.powerSupply} pw` : ""}
          {ops.waterSupply ? (ops.powerSupply ? " + " : "") + `supplies ${ops.waterSupply} wt` : ""}
        </div>
      )}

      {ops?.boost && (() => {
        const b = ops.boost;
        const inputs = Object.entries(b.consumes)
          .map(([r, a]) => `${a?.toFixed(2)} ${r}`)
          .join(" + ");
        const active = Object.entries(b.consumes).every(
          ([r]) => (state.resources[r as ResourceId] ?? 0) > 0,
        );
        const pct = Math.round((b.multiplier - 1) * 100);
        return (
          <div className={`ip-boost ${active ? "on" : "off"}`}>
            boost: {inputs} → +{pct}% output {active ? "(active)" : "(stockpile empty)"}
          </div>
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

      {/* In/out flow lines come from the building's ops, scaled
          (visually) by run ratio so the player sees actual rates. */}
      {id !== "main" && id !== "house" && ops && (
        <>
          <div className="ip-rates">
            {ops.produces &&
              Object.entries(ops.produces).map(([res, rate]) =>
                flowLine("+", res as ResourceId, (rate ?? 0) * runRatio, `p-${res}`),
              )}
            {ops.consumes &&
              Object.entries(ops.consumes).map(([res, rate]) =>
                flowLine("-", res as ResourceId, (rate ?? 0) * runRatio, `c-${res}`),
              )}
            {ops.upkeep ? (
              <div className="ip-rate">
                <span className="ip-rate-val neg">-{ops.upkeep.toFixed(2)}</span>
                <span className="ip-rate-key">cr/s upkeep</span>
              </div>
            ) : null}
          </div>
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

      {id !== "main" && id !== "house" && (
        <button
          type="button"
          className={"ip-pause" + (isDisabled ? " on" : "")}
          onClick={onToggleDisabled}
          title="paused buildings still cost upkeep but produce nothing"
        >
          {isDisabled ? "resume" : "pause"}
        </button>
      )}

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

// Helper: figure out WHICH input is throttling the building, so the
// inspector can hint at the bottleneck without making the player
// guess. Returns "" if at 100%. Prefers the worst limiter.
function bottleneckLabel(
  def: BuildingDef | undefined,
  pop: GameState["meta"]["population"],
  services: GameState["meta"]["services"],
  resources: GameState["resources"],
): string {
  if (!def) return "";
  const reasons: Array<{ label: string; ratio: number }> = [];
  if (def.staffNeed?.worker) {
    reasons.push({ label: "workers", ratio: pop.worker > 0 ? 1 : 0 });
  }
  if (def.staffNeed?.researcher) {
    reasons.push({ label: "researchers", ratio: pop.researcher > 0 ? 1 : 0 });
  }
  if (def.ops?.powerNeed && services.powerDemand > services.powerSupply) {
    reasons.push({ label: "power", ratio: services.powerSupply / Math.max(1, services.powerDemand) });
  }
  if (def.ops?.waterNeed && services.waterDemand > services.waterSupply) {
    reasons.push({ label: "water", ratio: services.waterSupply / Math.max(1, services.waterDemand) });
  }
  if (def.ops?.consumes) {
    for (const [res] of Object.entries(def.ops.consumes)) {
      if ((resources[res as ResourceId] ?? 0) <= 0) {
        reasons.push({ label: `${res} stockpile`, ratio: 0 });
      }
    }
  }
  if (reasons.length === 0) return "";
  reasons.sort((a, b) => a.ratio - b.ratio);
  return ` - short on ${reasons[0].label}`;
}
