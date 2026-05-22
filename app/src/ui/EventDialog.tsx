import type { GameState } from "@nanofarm/shared";
import { EVENT_BY_ID } from "../game/events";

interface Props {
  state: GameState;
  onChoose: (eventId: string, choiceIndex: number) => void;
}

export function EventDialog({ state, onChoose }: Props) {
  const activeId = state.events.activeId;
  if (!activeId) return null;
  const def = EVENT_BY_ID.get(activeId);
  if (!def) return null;

  return (
    <div className="event-dialog-backdrop">
      <div className="event-dialog">
        <h2>{def.title}</h2>
        <p>{def.body}</p>
        <div className="event-choices">
          {def.choices.map((choice, i) => (
            <button key={i} onClick={() => onChoose(def.id, i)}>
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
