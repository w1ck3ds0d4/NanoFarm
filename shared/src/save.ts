import type { GameState } from "./state";

// Bumped from 1 to 2 with the SimCity-style economy rebuild: resource
// types changed, building set changed, meta gained `happiness`. Old
// saves can't be migrated cleanly, so loadOrInit drops them on the
// floor and starts fresh.
export type SaveVersion = 2;

export const CURRENT_SAVE_VERSION: SaveVersion = 2;

export interface SaveBlob {
  version: SaveVersion;
  savedAt: number;
  state: GameState;
}

/**
 * Old save formats are discarded (the new economy bears no
 * resemblance to v1). This hook exists for future v2->v3 work; for
 * now it just hands the state back unchanged.
 */
export function hydrateMissingFields(state: GameState): GameState {
  return state;
}
