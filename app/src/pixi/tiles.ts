import { Graphics } from "pixi.js";
import type { TerrainType, BuildingId } from "@nanofarm/shared";

export interface IsoBuildingSprite {
  graphics: Graphics;
  kind: BuildingId;
}

export const TILE_W = 32;
export const TILE_H = 16;
export const BUILDING_HEIGHT = 18;
export const MAIN_BUILDING_HEIGHT = 26;
/** Visually-tall buildings (factory, lab) use this taller silhouette so
 * the player can tell at a glance that the building is industrial scale. */
export const TALL_BUILDING_HEIGHT = 38;

function drawDiamond(g: Graphics, color: number, alpha = 1): void {
  g.poly([
    TILE_W / 2, 0,
    TILE_W, TILE_H / 2,
    TILE_W / 2, TILE_H,
    0, TILE_H / 2
  ]);
  g.fill({ color, alpha });
}

const GRASS_COLORS = [0x1f3a16, 0x244218, 0x1c3414];
const WATER_COLORS = [0x1a3a5a, 0x1e4268, 0x183458];

export function drawTerrainTile(
  g: Graphics,
  terrain: TerrainType,
  x: number,
  y: number,
  selectable: boolean,
  hovered: boolean
): void {
  g.clear();
  const variant = (((x * 31 + y * 17) % 3) + 3) % 3;

  switch (terrain) {
    case "grass": {
      drawDiamond(g, GRASS_COLORS[variant]);
      const dots = (x * 7 + y * 13) % 3;
      for (let i = 0; i < dots; i++) {
        const dx = 8 + ((x * 13 + i * 7) % 16);
        const dy = 4 + ((y * 19 + i * 11) % 8);
        g.rect(dx, dy, 1, 1);
        g.fill({ color: 0x2e5224 });
      }
      break;
    }
    case "water": {
      drawDiamond(g, WATER_COLORS[variant]);
      g.rect(TILE_W / 2 - 5, TILE_H / 2 - 1, 4, 1);
      g.fill({ color: 0x4a7a9a });
      g.rect(TILE_W / 2 + 2, TILE_H / 2 + 2, 4, 1);
      g.fill({ color: 0x4a7a9a });
      break;
    }
    case "forest": {
      drawDiamond(g, 0x1a2e10);
      g.circle(TILE_W / 2, TILE_H / 2 - 2, 4);
      g.fill({ color: 0x2e5018 });
      g.circle(TILE_W / 2 - 6, TILE_H / 2 + 2, 3);
      g.fill({ color: 0x244218 });
      g.circle(TILE_W / 2 + 6, TILE_H / 2 + 1, 3);
      g.fill({ color: 0x244218 });
      g.rect(TILE_W / 2 - 1, TILE_H / 2 + 1, 2, 2);
      g.fill({ color: 0x3a2810 });
      break;
    }
    case "mountain": {
      drawDiamond(g, 0x4a4a4a);
      g.poly([
        TILE_W / 2, 1,
        TILE_W * 0.72, TILE_H / 2,
        TILE_W / 2, TILE_H - 1,
        TILE_W * 0.28, TILE_H / 2
      ]);
      g.fill({ color: 0x6a6a6a });
      g.poly([
        TILE_W / 2, 2,
        TILE_W * 0.58, TILE_H / 2 - 2,
        TILE_W * 0.42, TILE_H / 2 - 2
      ]);
      g.fill({ color: 0xc8c8d0 });
      break;
    }
    case "mine_deposit": {
      drawDiamond(g, 0x3a3a3a);
      g.rect(TILE_W / 2 - 5, TILE_H / 2 - 1, 3, 2);
      g.fill({ color: 0xddaa44 });
      g.rect(TILE_W / 2 + 2, TILE_H / 2 + 1, 3, 2);
      g.fill({ color: 0xddaa44 });
      g.rect(TILE_W / 2 - 1, TILE_H / 2 + 3, 2, 1);
      g.fill({ color: 0xbb8833 });
      break;
    }
    case "sand": {
      drawDiamond(g, 0xb8a868);
      const dots = (x * 7 + y * 13) % 3;
      for (let i = 0; i < dots; i++) {
        const dx = 8 + ((x * 13 + i * 7) % 16);
        const dy = 4 + ((y * 19 + i * 11) % 8);
        g.rect(dx, dy, 1, 1);
        g.fill({ color: 0xa89858 });
      }
      break;
    }
  }

  if (hovered) {
    drawDiamond(g, 0xccff44, 0.4);
  } else if (selectable) {
    drawDiamond(g, 0xccff44, 0.12);
  }
}

export function drawIsoRoad(g: Graphics): void {
  g.clear();
  // Paved diamond filling the FULL tile, edge to edge. Previous draw
  // inset the polygon by 2px on every side, which left a green
  // border around each road tile - so two adjacent roads visually
  // became two islands with a grass strip between them, matching the
  // "small gap" complaint. Edge-to-edge fill means adjacent road
  // tiles share their edges cleanly and the network reads as one
  // continuous strip.
  g.poly([
    TILE_W / 2, 0,
    TILE_W, TILE_H / 2,
    TILE_W / 2, TILE_H,
    0, TILE_H / 2
  ]);
  g.fill({ color: 0x6a5c40 });
  // Center stripe stays so the road still reads as paved instead of
  // a flat brown polygon. Sits per-tile, so a long road shows a
  // dashed line of stripes along its length.
  g.rect(TILE_W / 2 - 3, TILE_H / 2 - 1, 6, 2);
  g.fill({ color: 0x8a7c5a });
}

interface BuildingPalette {
  top: number;
  right: number;
  left: number;
  accent: number;
}

const FARM_PALETTE: BuildingPalette = {
  top: 0x88aa33,
  right: 0x3a5a18,
  left: 0x2a4012,
  accent: 0xccff44
};

const MINE_PALETTE: BuildingPalette = {
  top: 0x707474,
  right: 0x404444,
  left: 0x2a2c2a,
  accent: 0x222222
};

const MAIN_PALETTE: BuildingPalette = {
  top: 0xe0a838,
  right: 0xa86820,
  left: 0x6a4010,
  accent: 0xffe068
};

const HOUSE_PALETTE: BuildingPalette = {
  top: 0xc06848,
  right: 0x8a4828,
  left: 0x5a3018,
  accent: 0xeed8b8
};

const LAB_PALETTE: BuildingPalette = {
  top: 0x6acccf,
  right: 0x267278,
  left: 0x18484c,
  accent: 0xb8f0ff
};

const LUMBER_MILL_PALETTE: BuildingPalette = {
  top: 0x6a4a28,
  right: 0x4a3018,
  left: 0x2e1c0e,
  accent: 0xb8884a
};

const QUARRY_PALETTE: BuildingPalette = {
  top: 0xa0a8b0,
  right: 0x60686e,
  left: 0x3a4046,
  accent: 0xd8e0e8
};

const GRANARY_PALETTE: BuildingPalette = {
  top: 0xdcb858,
  right: 0x9a7c30,
  left: 0x5e4a18,
  accent: 0xfff0a8
};

const MARKET_PALETTE: BuildingPalette = {
  top: 0xc848a8,
  right: 0x8a2078,
  left: 0x4a1040,
  accent: 0xffc0e8
};

const FACTORY_PALETTE: BuildingPalette = {
  top: 0x707880,
  right: 0x3a4048,
  left: 0x1a1e22,
  accent: 0xff8830
};

const SCHOOL_PALETTE: BuildingPalette = {
  top: 0xe0c878,
  right: 0xa88828,
  left: 0x6e5418,
  accent: 0xfff0a8
};

const ACADEMY_PALETTE: BuildingPalette = {
  top: 0x88a0c8,
  right: 0x3a5878,
  left: 0x1e3650,
  accent: 0xc8e0ff
};

const BARRACKS_PALETTE: BuildingPalette = {
  top: 0xa84838,
  right: 0x6a2a18,
  left: 0x3a1408,
  accent: 0xe88858
};

const POWER_PLANT_PALETTE: BuildingPalette = {
  top: 0x88787a,
  right: 0x4a3a3c,
  left: 0x281a1c,
  accent: 0xffcc44
};

const WONDER_PALETTE: BuildingPalette = {
  top: 0xeec888,
  right: 0xa87838,
  left: 0x603810,
  accent: 0xffee88
};

const PALETTES: Record<BuildingId, BuildingPalette> = {
  main: MAIN_PALETTE,
  farm: FARM_PALETTE,
  mine: MINE_PALETTE,
  house: HOUSE_PALETTE,
  lab: LAB_PALETTE,
  lumber_mill: LUMBER_MILL_PALETTE,
  quarry: QUARRY_PALETTE,
  granary: GRANARY_PALETTE,
  market: MARKET_PALETTE,
  factory: FACTORY_PALETTE,
  school: SCHOOL_PALETTE,
  academy: ACADEMY_PALETTE,
  barracks: BARRACKS_PALETTE,
  power_plant: POWER_PLANT_PALETTE,
  wonder: WONDER_PALETTE
};

function buildingHeight(kind: BuildingId): number {
  if (kind === "main") return MAIN_BUILDING_HEIGHT;
  if (kind === "factory" || kind === "lab" || kind === "academy") return TALL_BUILDING_HEIGHT;
  if (kind === "power_plant") return TALL_BUILDING_HEIGHT + 8;
  if (kind === "wonder") return TALL_BUILDING_HEIGHT + 20;
  return BUILDING_HEIGHT;
}

/**
 * Draws an iso building whose base footprint is an N x N tile diamond
 * anchored at the origin tile's top-left. For N=1 the footprint is a
 * single tile diamond, matching drawIsoBuilding's geometry. For
 * larger N the base diamond grows accordingly and the building body
 * scales up too.
 *
 * Math: tile (ox+dx, oy+dy) sits at iso screen-delta
 *   ((dx - dy) * TILE_W/2, (dx + dy) * TILE_H/2)
 * from the origin tile. The footprint diamond's four extreme corners
 * are at the north corner of (ox, oy), the east corner of
 * (ox+N-1, oy), the south corner of (ox+N-1, oy+N-1), and the west
 * corner of (ox, oy+N-1):
 *   N: (TILE_W/2, 0)
 *   E: ((N+1)*TILE_W/2, N*TILE_H/2)
 *   S: (TILE_W/2, N*TILE_H)
 *   W: (-(N-1)*TILE_W/2, N*TILE_H/2)
 */
export function drawIsoBuildingSized(
  g: Graphics,
  kind: BuildingId,
  size: number,
  dim = false,
): void {
  g.clear();
  if (size <= 1) {
    drawIsoBuildingBody(g, kind, dim);
    return;
  }
  const p = PALETTES[kind];
  const alpha = dim ? 0.45 : 1;
  const H = buildingHeight(kind);
  const N = size;
  // Base diamond corners
  const nx = TILE_W / 2,        ny = 0;
  const ex = ((N + 1) * TILE_W) / 2, ey = (N * TILE_H) / 2;
  const sx = TILE_W / 2,        sy = N * TILE_H;
  const wx_ = -((N - 1) * TILE_W) / 2, wy_ = (N * TILE_H) / 2;

  // Right (SE) face: top-east, base-east, base-south, top-south
  g.poly([ex, ey - H, ex, ey, sx, sy, sx, sy - H]);
  g.fill({ color: p.right, alpha });
  // Left (SW) face: top-south, base-south, base-west, top-west
  g.poly([sx, sy - H, sx, sy, wx_, wy_, wx_, wy_ - H]);
  g.fill({ color: p.left, alpha });
  // Roof diamond at the top
  g.poly([nx, ny - H, ex, ey - H, sx, sy - H, wx_, wy_ - H]);
  g.fill({ color: p.top, alpha });

  if (kind === "power_plant") {
    // 2x2: stack of 3 thick smokestacks across the roof
    const stackY = ny - H + 4;
    for (let i = 0; i < 3; i++) {
      const cx = nx + (i - 1) * 10;
      g.rect(cx - 3, stackY, 6, 10);
      g.fill({ color: p.left, alpha });
      g.circle(cx, stackY - 3, 4);
      g.fill({ color: p.accent, alpha });
    }
    // Glowing core in front face
    g.rect(sx - 6, sy - H / 2, 12, 6);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "wonder") {
    // 3x3: peaked monument with a glowing crown
    const peakY = ny - H - 8;
    g.poly([nx - 8, ny - H, nx + 8, ny - H, nx, peakY]);
    g.fill({ color: p.accent, alpha });
    g.circle(nx, peakY - 4, 4);
    g.fill({ color: p.accent, alpha });
    // Big door at base front
    g.rect(sx - 4, sy - H / 3, 8, H / 3);
    g.fill({ color: p.left, alpha });
  }
}

function drawIsoBuildingBody(g: Graphics, kind: BuildingId, dim: boolean): void {
  // Delegates to the original single-tile draw path so existing
  // accent code for each 1x1 building stays as-is.
  drawIsoBuilding(g, kind, dim);
}

export function drawIsoBuilding(g: Graphics, kind: BuildingId, dim = false): void {
  g.clear();
  const p = PALETTES[kind];
  const H = buildingHeight(kind);
  const alpha = dim ? 0.45 : 1;

  // right (SE) face
  g.poly([
    TILE_W, TILE_H / 2 - H,
    TILE_W / 2, TILE_H - H,
    TILE_W / 2, TILE_H,
    TILE_W, TILE_H / 2
  ]);
  g.fill({ color: p.right, alpha });

  // left (SW) face
  g.poly([
    TILE_W / 2, TILE_H - H,
    0, TILE_H / 2 - H,
    0, TILE_H / 2,
    TILE_W / 2, TILE_H
  ]);
  g.fill({ color: p.left, alpha });

  // top diamond (roof)
  g.poly([
    TILE_W / 2, -H,
    TILE_W, TILE_H / 2 - H,
    TILE_W / 2, TILE_H - H,
    0, TILE_H / 2 - H
  ]);
  g.fill({ color: p.top, alpha });

  if (kind === "farm") {
    g.rect(TILE_W / 2 - 4, TILE_H / 2 - H - 2, 8, 3);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "mine") {
    g.rect(TILE_W / 2 - 5, TILE_H / 2 - H - 1, 10, 2);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "house") {
    g.rect(TILE_W / 2 + 2, TILE_H / 2 - 2, 3, 5);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 4 - 1, TILE_H / 2 - 3, 3, 3);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "lab") {
    // Lab: tall silhouette with a glowing window grid and a satellite
    // dish on top so it reads as research, not a generic tower.
    g.rect(TILE_W / 2 - 4, -H + 2, 8, 2);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 1, -H - 4, 2, 4);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 5, -H + 8, 2, 2);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 + 3, -H + 8, 2, 2);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "lumber_mill") {
    // Lumber mill: pitched accent suggesting a saw or roof peak.
    g.poly([
      TILE_W / 2 - 5, TILE_H / 2 - H + 2,
      TILE_W / 2 + 5, TILE_H / 2 - H + 2,
      TILE_W / 2, TILE_H / 2 - H - 5
    ]);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 4, TILE_H / 2 - 1, 8, 2);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "quarry") {
    // Quarry: stepped stone pile suggesting cut blocks.
    g.rect(TILE_W / 2 - 6, TILE_H / 2 - H - 1, 12, 2);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 3, TILE_H / 2 - H - 4, 6, 3);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "granary") {
    // Granary: short squat silo dot on top.
    g.circle(TILE_W / 2, TILE_H / 2 - H - 1, 4);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 4, TILE_H / 2 - 2, 8, 2);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "market") {
    // Market: striped awning + small flag.
    g.rect(TILE_W / 2 - 6, TILE_H / 2 - H - 1, 12, 2);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 1, TILE_H / 2 - H - 6, 1, 5);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2, TILE_H / 2 - H - 6, 4, 2);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "school") {
    // School: bell-tower silhouette + a chimney
    g.rect(TILE_W / 2 - 2, TILE_H / 2 - H - 6, 4, 6);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 5, TILE_H / 2 - H - 1, 10, 2);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 4, TILE_H / 2 - 2, 8, 2);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "academy") {
    // Academy: pillars + a dome on top
    g.rect(TILE_W / 2 - 7, TILE_H / 2 - H + 2, 2, H - 4);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 + 5, TILE_H / 2 - H + 2, 2, H - 4);
    g.fill({ color: p.accent, alpha });
    g.circle(TILE_W / 2, TILE_H / 2 - H + 1, 5);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "barracks") {
    // Barracks: low blocky structure with a flagpole
    g.rect(TILE_W / 2 - 5, TILE_H / 2 - H - 1, 10, 2);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 1, TILE_H / 2 - H - 8, 1, 7);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2, TILE_H / 2 - H - 8, 4, 3);
    g.fill({ color: p.accent, alpha });
  } else if (kind === "factory") {
    // Factory: two smokestacks puffing out the top of the tall sprite.
    g.rect(TILE_W / 2 - 6, -H, 4, 6);
    g.fill({ color: p.left, alpha });
    g.rect(TILE_W / 2 + 2, -H + 2, 4, 4);
    g.fill({ color: p.left, alpha });
    g.rect(TILE_W / 2 - 5, -H - 3, 2, 3);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 + 3, -H - 1, 2, 3);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 4, TILE_H / 2 - 3, 8, 3);
    g.fill({ color: p.accent, alpha });
  } else {
    // main: peaked accent in center
    g.rect(TILE_W / 2 - 2, TILE_H / 2 - H - 4, 4, 6);
    g.fill({ color: p.accent, alpha });
    g.rect(TILE_W / 2 - 5, TILE_H / 2 - H - 1, 10, 2);
    g.fill({ color: p.accent, alpha });
  }
}
