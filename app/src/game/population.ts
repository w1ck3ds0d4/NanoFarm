import type { GameState } from "@nanofarm/shared";
import { HOUSE_CAPACITY } from "./buildings";

/** Citywide housing capacity: every connected house contributes
 * HOUSE_CAPACITY slots. Drives the pop cap shown in the HUD. */
export function populationCapacity(
  state: GameState,
  connected: Set<string>
): number {
  let houses = 0;
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (id !== "house") continue;
    if (!connected.has(key)) continue;
    houses++;
  }
  return houses * HOUSE_CAPACITY;
}
