import type { EventDef, EventEffect, GameState } from "@nanofarm/shared";

// random events are temporarily disabled while the road / main-building system
// is in development. the trigger and effect infrastructure stays in place so
// content can be re-added later without re-wiring everything.
export const EVENT_DEFS: EventDef[] = [];

export const EVENT_BY_ID = new Map<string, EventDef>(EVENT_DEFS.map((e) => [e.id, e]));

export function evaluateTriggers(state: GameState, now: number): string[] {
  const fired = new Set(state.events.firedIds);
  const queued = new Set(state.events.queuedIds);
  const active = state.events.activeId;
  const minutesElapsed = (now - state.meta.startedAt) / 60000;
  const out: string[] = [];

  for (const def of EVENT_DEFS) {
    if (fired.has(def.id)) continue;
    if (queued.has(def.id)) continue;
    if (active === def.id) continue;

    const t = def.trigger;
    let firesNow = false;
    if (t.kind === "milestone") {
      firesNow = state.resources[t.resource] >= t.gte;
    } else if (t.kind === "time") {
      firesNow = minutesElapsed >= t.minutesSinceStart;
    } else if (t.kind === "ai-tokens") {
      firesNow = state.meta.totalAiTokensEarned >= t.gte;
    } else if (t.kind === "after") {
      firesNow = state.events.scheduled.some(
        (s) => s.eventId === def.id && s.fireAt <= now
      );
    }

    if (firesNow) out.push(def.id);
  }

  return out;
}

export function effectsFor(eventId: string, choiceIndex: number): EventEffect[] {
  const def = EVENT_BY_ID.get(eventId);
  if (!def) return [];
  const choice = def.choices[choiceIndex];
  if (!choice) return [];
  return choice.effects;
}
