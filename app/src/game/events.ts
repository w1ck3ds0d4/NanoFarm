import type { EventDef, EventEffect, GameState } from "@nanofarm/shared";

export const EVENT_DEFS: EventDef[] = [
  {
    id: "first-thousand-credits",
    title: "A growing town",
    body: "your settlement has reached one thousand nano-credits in trade. the elders gather to decide what to invest in first.",
    trigger: { kind: "milestone", resource: "credits", gte: 1000 },
    oncePerRun: true,
    choices: [
      {
        label: "Build a school",
        effects: [
          { kind: "deduct", resource: "credits", amount: 200 },
          { kind: "grant", resource: "research", amount: 5 }
        ]
      },
      {
        label: "Build a hospital",
        effects: [
          { kind: "deduct", resource: "credits", amount: 200 },
          { kind: "grant", resource: "materials", amount: 20 }
        ]
      }
    ]
  },
  {
    id: "ten-minutes-in",
    title: "A traveler arrives",
    body: "a stranger appears at the edge of the settlement carrying a small bundle. they offer to teach a useful trick.",
    trigger: { kind: "time", minutesSinceStart: 10 },
    oncePerRun: true,
    choices: [
      {
        label: "Listen carefully",
        effects: [{ kind: "grant", resource: "research", amount: 3 }]
      },
      {
        label: "Offer food and send them on",
        effects: [
          { kind: "deduct", resource: "materials", amount: 5 },
          { kind: "grant", resource: "credits", amount: 50 }
        ]
      }
    ]
  }
];

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
