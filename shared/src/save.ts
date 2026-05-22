import type { GameState } from "./state";

export type SaveVersion = 1;

export const CURRENT_SAVE_VERSION: SaveVersion = 1;

export interface SaveBlob {
  version: SaveVersion;
  savedAt: number;
  state: GameState;
}
