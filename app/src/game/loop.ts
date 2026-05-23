import type { GameState } from "@nanofarm/shared";
import type { Action } from "./state";
import { computeConnected } from "./connectivity";
import { simulateTick } from "./simulate";
import { evaluateTriggers } from "./events";
import type { TokenDrainer } from "./tokens";

const MAX_DT_MS = 1000;
const HOOK_DRAIN_INTERVAL_MS = 1000;
const EVENT_CHECK_INTERVAL_MS = 1000;

export interface LoopDeps {
  getState: () => GameState;
  getTerrain: () => Uint8Array;
  dispatch: (a: Action) => void;
  drainer: TokenDrainer;
}

export class GameLoop {
  private deps: LoopDeps;
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private lastHookDrain = 0;
  private lastEventCheck = 0;

  constructor(deps: LoopDeps) {
    this.deps = deps;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameAt = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private frame = (timestamp: number): void => {
    const dtMs = Math.min(timestamp - this.lastFrameAt, MAX_DT_MS);
    this.lastFrameAt = timestamp;

    const now = Date.now();
    const dtSec = dtMs / 1000;
    const state = this.deps.getState();

    const connected = computeConnected(state);
    const result = simulateTick(state, connected, dtSec);

    this.deps.dispatch({ type: "tick", now, result });

    if (now - this.lastHookDrain >= HOOK_DRAIN_INTERVAL_MS) {
      this.lastHookDrain = now;
      void this.doHookDrain(now);
    }

    if (now - this.lastEventCheck >= EVENT_CHECK_INTERVAL_MS) {
      this.lastEventCheck = now;
      this.doEventCheck(now);
    }

    this.rafId = requestAnimationFrame(this.frame);
  };

  private async doHookDrain(now: number): Promise<void> {
    if (!this.deps.drainer.isConnected()) return;
    try {
      const lines = await this.deps.drainer.drain();
      if (lines.length === 0) return;
      this.deps.dispatch({
        type: "grant-ai-tokens",
        tools: lines.map((l) => l.tool),
        now
      });
    } catch {
      // ignore: file may have moved, permission revoked, etc.
    }
  }

  private doEventCheck(now: number): void {
    const triggered = evaluateTriggers(this.deps.getState(), now);
    for (const id of triggered) {
      this.deps.dispatch({ type: "queue-event", eventId: id });
    }
  }
}
