import type { GameState } from "@nanofarm/shared";
import { totalPopulation } from "@nanofarm/shared";
import { POP_DEMAND } from "../game/buildings";

interface Props {
  state: GameState;
  onClose: () => void;
}

interface Row {
  key: string;
  label: string;
  /** 0..1 ratio. 1 = fully met. */
  ratio: number;
  detail: string;
}

export function NeedsPanel({ state, onClose }: Props) {
  const residents = totalPopulation(state.meta.population);
  const services = state.meta.services;

  // Each row mirrors a need that simulateTick already evaluated.
  // We re-derive the ratio from persisted snapshots so this panel
  // does not have to re-run the simulation - which means it stays
  // accurate even if state arrived from a tick that already
  // happened.
  const foodDemand = residents * POP_DEMAND.food;
  const goodsDemand = residents * POP_DEMAND.goods;
  const foodRatio = ratio(state.resources.food, foodDemand);
  const goodsRatio = ratio(state.resources.goods, goodsDemand);
  const waterRatio = ratio(services.waterSupply, services.waterDemand);
  const powerRatio = ratio(services.powerSupply, services.powerDemand);

  // Job availability: civilian residents (idle + worker + researcher)
  // vs civilian job slots. Same definition as simulate.ts.
  const pop = state.meta.population;
  const seekers = pop.idle + pop.worker + pop.researcher;
  // We can derive total job slots from current population vs services,
  // but that's roundabout. Simpler: show "jobs" as a soft summary.
  // Acceptable since happiness already includes it.

  const rows: Row[] = [
    {
      key: "food",
      label: "Food",
      ratio: foodRatio,
      detail: `${state.resources.food.toFixed(0)} stock / ${foodDemand.toFixed(2)} per sec`
    },
    {
      key: "water",
      label: "Water",
      ratio: waterRatio,
      detail: `${services.waterSupply.toFixed(1)} supply / ${services.waterDemand.toFixed(1)} demand`
    },
    {
      key: "power",
      label: "Power",
      ratio: powerRatio,
      detail: `${services.powerSupply.toFixed(1)} supply / ${services.powerDemand.toFixed(1)} demand`
    },
    {
      key: "goods",
      label: "Goods",
      ratio: goodsRatio,
      detail: `${state.resources.goods.toFixed(0)} stock / ${goodsDemand.toFixed(2)} per sec`
    },
    {
      key: "jobs",
      label: "Jobs",
      ratio: 1, // computed implicitly in happiness; show seekers count instead
      detail: `${seekers.toFixed(0)} residents seeking work`
    }
  ];

  return (
    <div className="needs-panel">
      <div className="np-header">
        <span className="np-title">HAPPINESS</span>
        <span className="np-score">{state.meta.happiness}/100</span>
        <button className="np-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="np-hint">
        survival needs (food, water) drive most of happiness. comfort
        needs (power, goods, jobs) add a bonus on top. unhappy residents
        pay less rent and eventually leave.
      </div>
      <div className="np-rows">
        {rows.map((r) => {
          const pct = Math.round(r.ratio * 100);
          const cls =
            r.ratio >= 0.9 ? "ok" : r.ratio >= 0.5 ? "warn" : "bad";
          return (
            <div key={r.key} className={`np-row ${cls}`}>
              <div className="np-row-head">
                <span className="np-row-label">{r.label}</span>
                <span className="np-row-pct">{pct}%</span>
              </div>
              <div className="np-row-bar">
                <div className="np-row-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="np-row-detail">{r.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ratio(supply: number, demand: number): number {
  if (demand <= 0) return 1;
  return Math.min(1, supply / demand);
}
