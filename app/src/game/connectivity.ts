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
  // reachable road set is connected. For multi-tile buildings, we
  // first decide if any footprint tile is adjacent, then mark every
  // footprint tile so the renderer / production code sees a uniform
  // status across the building.
  const origins = state.map.multiTileOrigin ?? {};
  // Group footprint tiles by origin.
  const footprintsByOrigin = new Map<string, string[]>();
  for (const key of Object.keys(state.map.placed)) {
    if (state.map.placed[key] === "main") continue;
    const origin = origins[key] ?? key;
    const list = footprintsByOrigin.get(origin);
    if (list) list.push(key);
    else footprintsByOrigin.set(origin, [key]);
  }
  for (const [, footprint] of footprintsByOrigin) {
    const anyAdjacent = footprint.some((fkey) => {
      const [x, y] = fkey.split(",").map(Number);
      for (const [dx, dy] of NEIGHBOR_DELTAS) {
        const nKey = `${x + dx},${y + dy}`;
        if (nKey === mainKey || reachable.has(nKey)) return true;
        // Also: any neighbour that's a placed building outside our
        // own footprint counts (matches the place-building rule).
        if (
          state.map.placed[nKey] &&
          !footprint.includes(nKey)
        ) {
          return true;
        }
      }
      return false;
    });
    if (anyAdjacent) for (const fk of footprint) connected.add(fk);
  }

  return connected;
}
