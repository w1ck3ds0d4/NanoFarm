import type { GameState, SaveBlob } from "@nanofarm/shared";
import { CURRENT_SAVE_VERSION, hydrateMissingFields, makeInitialState } from "@nanofarm/shared";
import type { StorageAdapter } from "../adapter/storage";

const SAVE_INTERVAL_MS = 5000;

export class SaveLoop {
  private adapter: StorageAdapter;
  private getState: () => GameState;
  private timer: number | null = null;

  constructor(adapter: StorageAdapter, getState: () => GameState) {
    this.adapter = adapter;
    this.getState = getState;
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
    const blob: SaveBlob = {
      version: CURRENT_SAVE_VERSION,
      savedAt: Date.now(),
      state: this.getState()
    };
    await this.adapter.save(blob);
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
  if (!blob) return makeInitialState(now);
  return hydrateMissingFields(migrate(blob).state);
}

function migrate(blob: SaveBlob): SaveBlob {
  if (blob.version > CURRENT_SAVE_VERSION) {
    throw new Error(
      `save is from a newer version (${blob.version}) than this build (${CURRENT_SAVE_VERSION}).`
    );
  }
  return blob;
}
