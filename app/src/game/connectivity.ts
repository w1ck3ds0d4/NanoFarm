import type { GameState } from "@nanofarm/shared";

const NEIGHBOR_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

/**
 * Returns the set of building tile keys (in `state.map.placed`) that are
 * road-connected to the main building. The main itself is always in the
 * returned set if it exists.
 *
 * Connectivity rule: BFS from main through orthogonally adjacent road tiles.
 * Any non-main building with at least one of its 4 cardinal neighbours in the
 * reachable set is considered connected.
 */
export function computeConnected(state: GameState): Set<string> {
  const connected = new Set<string>();

  let mainKey: string | null = null;
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (id === "main") {
      mainKey = key;
      break;
    }
  }
  if (!mainKey) return connected;

  connected.add(mainKey);

  // BFS through roads, starting from tiles orthogonally adjacent to main.
  const reachable = new Set<string>();
  const queue: string[] = [];

  const [mx, my] = mainKey.split(",").map(Number);
  for (const [dx, dy] of NEIGHBOR_DELTAS) {
    const nKey = `${mx + dx},${my + dy}`;
    if (state.map.roads[nKey]) {
      reachable.add(nKey);
      queue.push(nKey);
    }
  }

  while (queue.length > 0) {
    const key = queue.shift()!;
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of NEIGHBOR_DELTAS) {
      const nKey = `${x + dx},${y + dy}`;
      if (reachable.has(nKey)) continue;
      if (state.map.roads[nKey]) {
        reachable.add(nKey);
        queue.push(nKey);
      }
    }
  }

  // Any non-main building adjacent to main (no road needed) or to the
  // reachable road set is connected.
  for (const [key, id] of Object.entries(state.map.placed)) {
    if (id === "main") continue;
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of NEIGHBOR_DELTAS) {
      const nKey = `${x + dx},${y + dy}`;
      if (nKey === mainKey || reachable.has(nKey)) {
        connected.add(key);
        break;
      }
    }
  }

  return connected;
}
