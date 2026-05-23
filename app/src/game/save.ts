import type { GameState, SaveBlob } from "@nanofarm/shared";
import { CURRENT_SAVE_VERSION, hydrateMissingFields, makeInitialState } from "@nanofarm/shared";
import type { StorageAdapter } from "../adapter/storage";

const SAVE_INTERVAL_MS = 5000;

export class SaveLoop {
  private adapter: StorageAdapter;
  private getState: () => GameState;
  private onSaved?: (savedAt: number) => void;
  private timer: number | null = null;

  constructor(
    adapter: StorageAdapter,
    getState: () => GameState,
    onSaved?: (savedAt: number) => void,
  ) {
    this.adapter = adapter;
    this.getState = getState;
    this.onSaved = onSaved;
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      void this.persist();
    }, SAVE_INTERVAL_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("beforeunload", this.onUnload);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("beforeunload", this.onUnload);
  }

  async persist(): Promise<void> {
    const savedAt = Date.now();
    const blob: SaveBlob = {
      version: CURRENT_SAVE_VERSION,
      savedAt,
      state: this.getState()
    };
    await this.adapter.save(blob);
    this.onSaved?.(savedAt);
  }

  private onVisibility = (): void => {
    if (document.visibilityState === "hidden") void this.persist();
  };

  private onUnload = (): void => {
    void this.persist();
  };
}

export async function loadOrInit(
  adapter: StorageAdapter,
  now: number
): Promise<GameState> {
  const blob = await adapter.load();
  // No save -> fresh start. Old version -> drop on the floor and
  // fresh-start; the v1->v2 jump came with the SimCity economy
  // rebuild and there is no useful migration path. Newer-than-this
  // build is a dev mistake (someone downgraded the extension), so
  // we also start fresh rather than crash the game.
  if (!blob) return makeInitialState(now);
  if (blob.version !== CURRENT_SAVE_VERSION) return makeInitialState(now);
  return hydrateMissingFields(blob.state);
}
