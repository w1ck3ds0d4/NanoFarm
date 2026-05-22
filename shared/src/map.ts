export type TerrainType =
  | "grass"
  | "water"
  | "forest"
  | "mountain"
  | "mine_deposit"
  | "sand";

export const TERRAIN_INDEX: Record<TerrainType, number> = {
  grass: 0,
  water: 1,
  forest: 2,
  mountain: 3,
  mine_deposit: 4,
  sand: 5
};

export const TERRAIN_BY_INDEX: readonly TerrainType[] = [
  "grass",
  "water",
  "forest",
  "mountain",
  "mine_deposit",
  "sand"
];

export const DEFAULT_MAP_SIZE = 150;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise2d(seed: number, cellSize: number, w: number, h: number): Float32Array {
  const cellsX = Math.ceil(w / cellSize) + 2;
  const cellsY = Math.ceil(h / cellSize) + 2;
  const rng = mulberry32(seed);
  const cells = new Float32Array(cellsX * cellsY);
  for (let i = 0; i < cells.length; i++) cells[i] = rng() * 2 - 1;

  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / cellSize;
    const cy0 = Math.floor(fy);
    const ty = smoothstep(fy - cy0);
    for (let x = 0; x < w; x++) {
      const fx = x / cellSize;
      const cx0 = Math.floor(fx);
      const tx = smoothstep(fx - cx0);
      const a = cells[cy0 * cellsX + cx0];
      const b = cells[cy0 * cellsX + cx0 + 1];
      const c = cells[(cy0 + 1) * cellsX + cx0];
      const d = cells[(cy0 + 1) * cellsX + cx0 + 1];
      out[y * w + x] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }
  }
  return out;
}

export function generateTerrain(seed: number, w: number, h: number): Uint8Array {
  const elevation = valueNoise2d(seed, 18, w, h);
  const elevationFine = valueNoise2d(seed ^ 0x9e3779b9, 8, w, h);
  const moisture = valueNoise2d(seed ^ 0x1b873593, 14, w, h);
  const resource = valueNoise2d(seed ^ 0xcc9e2d51, 5, w, h);

  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elevation[i] * 0.7 + elevationFine[i] * 0.3;
      const m = moisture[i];
      const r = resource[i];

      let type: TerrainType;
      if (e < -0.32) type = "water";
      else if (e < -0.18) type = "sand";
      else if (e > 0.5) type = "mountain";
      else if (m > 0.18 && e > -0.05) type = "forest";
      else type = "grass";

      if ((type === "grass" || type === "forest") && r > 0.65) {
        type = "mine_deposit";
      }

      out[i] = TERRAIN_INDEX[type];
    }
  }
  return out;
}

export function terrainAt(
  terrain: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number
): TerrainType {
  if (x < 0 || x >= w || y < 0 || y >= h) return "water";
  return TERRAIN_BY_INDEX[terrain[y * w + x]];
}

export function isBuildable(t: TerrainType): boolean {
  return t === "grass" || t === "sand";
}

export function neighborTerrains(
  terrain: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number
): TerrainType[] {
  const out: TerrainType[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      out.push(terrainAt(terrain, w, h, x + dx, y + dy));
    }
  }
  return out;
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseTileKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

/**
 * Find a sensible starting tile for a fresh map: somewhere near the centre,
 * on grass, with no water in the immediate 8-neighbourhood.
 */
export function findSpawn(terrain: Uint8Array, w: number, h: number): { x: number; y: number } {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const maxR = Math.max(w, h);
  for (let r = 0; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if (terrainAt(terrain, w, h, x, y) !== "grass") continue;
        const ns = neighborTerrains(terrain, w, h, x, y);
        if (ns.some((t) => t === "water")) continue;
        return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}
