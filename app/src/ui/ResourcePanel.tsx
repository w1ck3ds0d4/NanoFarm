import type { GameState } from "@nanofarm/shared";

interface Props {
  state: GameState;
  onHarvest: () => void;
}

export function ResourcePanel({ state, onHarvest }: Props) {
  return (
    <div className="resource-panel">
      <h2>Resources</h2>
      <div className="resources">
        <div>credits: {Math.floor(state.resources.credits)}</div>
        <div>materials: {Math.floor(state.resources.materials)}</div>
        <div>research: {Math.floor(state.resources.research)}</div>
      </div>
      <button className="harvest" onClick={onHarvest}>
        harvest (+1 credit)
      </button>
      <div className="meta">
        ai materials this run: {Math.floor(state.meta.totalAiTokensEarned)}
      </div>
    </div>
  );
}
