import type { GameState, JobId } from "@nanofarm/shared";
import { JOB_IDS } from "@nanofarm/shared";

const JOB_COLOR: Record<JobId, string> = {
  idle: "#888888",
  worker: "#d4a058",
  researcher: "#5acce0",
  military: "#cc5544"
};

const JOB_LABEL: Record<JobId, string> = {
  idle: "idle",
  worker: "workers",
  researcher: "researchers",
  military: "military"
};

interface Props {
  state: GameState;
}

export function PopulationOverlay({ state }: Props) {
  const data = JOB_IDS.map((id) => ({
    id,
    value: state.meta.population[id],
    color: JOB_COLOR[id]
  }));
  const realTotal = data.reduce((s, d) => s + d.value, 0);
  const empty = realTotal === 0;
  const totalForRender = empty ? data.length : realTotal;

  const cx = 50;
  const cy = 50;
  const r = 42;
  let angle = -Math.PI / 2;

  const wedges = data.map((d) => {
    const slice = empty ? 1 : d.value;
    const a = (slice / totalForRender) * 2 * Math.PI;
    const start = angle;
    const end = start + a;
    angle = end;

    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = a > Math.PI ? 1 : 0;

    const path =
      a >= 2 * Math.PI - 0.001
        ? `M ${cx - r},${cy} a ${r},${r} 0 1 0 ${2 * r},0 a ${r},${r} 0 1 0 ${-2 * r},0`
        : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large} 1 ${x2},${y2} Z`;

    const pct = empty ? 0 : (d.value / realTotal) * 100;
    return { id: d.id, path, color: d.color, value: d.value, pct };
  });

  return (
    <div className="materials-pie">
      <svg
        className="mp-svg"
        viewBox="0 0 100 100"
        width="84"
        height="84"
        aria-hidden="true"
      >
        {wedges.map((w) => (
          <path
            key={w.id}
            d={w.path}
            fill={w.color}
            opacity={empty ? 0.28 : 1}
            stroke="#0a0e05"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mp-legend">
        {wedges.map((w) => (
          <div key={w.id} className="mp-row">
            <span className="mp-swatch" style={{ background: w.color }} />
            <span className="mp-name">{JOB_LABEL[w.id]}</span>
            <span className="mp-val">{Math.floor(w.value)}</span>
            <span className="mp-pct">{Math.floor(w.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
