import { Application, Container, Graphics } from "pixi.js";
import type { GameState, BuildingId } from "@nanofarm/shared";
import { isBuildable, terrainAt } from "@nanofarm/shared";
import { buildingSize } from "../game/buildings";
import {
  drawIsoBuildingSized,
  drawIsoRoad,
  drawTerrainTile,
  TILE_W,
  TILE_H
} from "./tiles";

export interface Scene {
  app: Application;
  root: Container;
  ground: Container;
  roadsLayer: Container;
  buildingsLayer: Container;
  groundPool: Map<string, Graphics>;
  roadsPool: Map<string, Graphics>;
  buildingsPool: Map<string, Graphics>;
  /** Single overlay graphic that draws an outline on the inspected
   * tile. Lives above buildings so the outline is never occluded. */
  selectionOverlay: Graphics;
  /** Lighter outline drawn when the cursor hovers a placed building
   * (suppressed during placement mode and when inspector is open
   * so the rings do not stack). */
  hoverOverlay: Graphics;
}

export interface RenderParams {
  state: GameState;
  terrain: Uint8Array;
  connected: Set<string>;
  cameraX: number;
  cameraY: number;
  zoom: number;
  hoverX: number | null;
  hoverY: number | null;
  /** What kind of placeable is currently selected for placement, or null. */
  selectMode: "building" | "road" | null;
  /** Footprint side length of the placeable being placed. 1 for road
   * and 1x1 buildings; > 1 for multi-tile buildings so the hover
   * highlight expands to the correct NxN footprint. */
  placingSize: number;
  /** Tile key (e.g. "12,7") for the inspected building, or null. */
  inspectKey: string | null;
  canvasW: number;
  canvasH: number;
}

export function mountScene(app: Application): Scene {
  const root = new Container();
  const ground = new Container();
  const roadsLayer = new Container();
  const buildingsLayer = new Container();
  buildingsLayer.sortableChildren = true;
  const selectionOverlay = new Graphics();
  selectionOverlay.visible = false;
  const hoverOverlay = new Graphics();
  hoverOverlay.visible = false;
  root.addChild(ground);
  root.addChild(roadsLayer);
  root.addChild(buildingsLayer);
  root.addChild(hoverOverlay);
  root.addChild(selectionOverlay);
  app.stage.addChild(root);
  return {
    app,
    root,
    ground,
    roadsLayer,
    buildingsLayer,
    groundPool: new Map(),
    roadsPool: new Map(),
    buildingsPool: new Map(),
    selectionOverlay,
    hoverOverlay
  };
}

export function tileToScreen(
  wx: number,
  wy: number,
  cx: number,
  cy: number,
  W: number,
  H: number,
  zoom: number
): { sx: number; sy: number } {
  const dx = wx - cx;
  const dy = wy - cy;
  const tw = TILE_W * zoom;
  const th = TILE_H * zoom;
  return {
    sx: W / 2 - tw / 2 + (dx - dy) * (tw / 2),
    sy: H / 2 - th / 2 + (dx + dy) * (th / 2)
  };
}

export function screenToTile(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  W: number,
  H: number,
  zoom: number
): { tx: number; ty: number } {
  const tw = TILE_W * zoom;
  const th = TILE_H * zoom;
  const rx = sx - W / 2;
  const ry = sy - H / 2;
  const a = rx / (tw / 2);
  const b = ry / (th / 2);
  const dxC = (a + b) / 2;
  const dyC = (b - a) / 2;
  return {
    tx: Math.round(cx + dxC),
    ty: Math.round(cy + dyC)
  };
}

export function screenDeltaToTileDelta(
  dx: number,
  dy: number,
  zoom: number
): { dtx: number; dty: number } {
  const tw = TILE_W * zoom;
  const th = TILE_H * zoom;
  return {
    dtx: dx / tw + dy / th,
    dty: dy / th - dx / tw
  };
}

function visibleRange(
  cx: number,
  cy: number,
  W: number,
  H: number,
  zoom: number
): { x0: number; y0: number; x1: number; y1: number } {
  const corners = [
    screenToTile(0, 0, cx, cy, W, H, zoom),
    screenToTile(W, 0, cx, cy, W, H, zoom),
    screenToTile(0, H, cx, cy, W, H, zoom),
    screenToTile(W, H, cx, cy, W, H, zoom)
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.tx < minX) minX = c.tx;
    if (c.tx > maxX) maxX = c.tx;
    if (c.ty < minY) minY = c.ty;
    if (c.ty > maxY) maxY = c.ty;
  }
  return {
    x0: Math.floor(minX) - 1,
    y0: Math.floor(minY) - 2,
    x1: Math.ceil(maxX) + 1,
    y1: Math.ceil(maxY) + 1
  };
}

export function renderScene(scene: Scene, p: RenderParams): void {
  const w = p.state.map.width;
  const h = p.state.map.height;
  const vis = visibleRange(p.cameraX, p.cameraY, p.canvasW, p.canvasH, p.zoom);

  // Pre-compute whether the entire NxN hover footprint is a legal
  // placement. Used to color-code the hover overlay: green when the
  // whole footprint is buildable + free, red when any tile would
  // block the placement. Roads always hover as 1x1.
  const size = Math.max(1, p.placingSize);
  let hoverFootprintValid = false;
  if (p.selectMode !== null && p.hoverX !== null && p.hoverY !== null) {
    hoverFootprintValid = true;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const fx = p.hoverX + dx;
        const fy = p.hoverY + dy;
        if (fx < 0 || fx >= w || fy < 0 || fy >= h) {
          hoverFootprintValid = false;
          break;
        }
        const fkey = `${fx},${fy}`;
        const ft = terrainAt(p.terrain, w, h, fx, fy);
        const fOccupied = !!p.state.map.placed[fkey] || !!p.state.map.roads[fkey];
        if (!isBuildable(ft) || fOccupied) {
          hoverFootprintValid = false;
          break;
        }
      }
      if (!hoverFootprintValid) break;
    }
  }

  const wantedGround = new Set<string>();
  for (let wy = vis.y0; wy <= vis.y1; wy++) {
    for (let wx = vis.x0; wx <= vis.x1; wx++) {
      if (wx < 0 || wx >= w || wy < 0 || wy >= h) continue;
      const key = `${wx},${wy}`;
      wantedGround.add(key);
      const t = terrainAt(p.terrain, w, h, wx, wy);
      const occupied = !!p.state.map.placed[key] || !!p.state.map.roads[key];
      const selectable = p.selectMode !== null && isBuildable(t) && !occupied;
      // A tile is part of the hover footprint when it falls inside
      // the NxN square anchored at the hover origin. For 1x1 this
      // collapses to a single-tile check, matching the old behavior.
      const inHoverFootprint =
        p.selectMode !== null &&
        p.hoverX !== null &&
        p.hoverY !== null &&
        wx >= p.hoverX &&
        wx < p.hoverX + size &&
        wy >= p.hoverY &&
        wy < p.hoverY + size;
      const hovered = inHoverFootprint && hoverFootprintValid;
      const hoveredInvalid = inHoverFootprint && !hoverFootprintValid;

      let g = scene.groundPool.get(key);
      if (!g) {
        g = new Graphics();
        scene.ground.addChild(g);
        scene.groundPool.set(key, g);
      }
      drawTerrainTile(g, t, wx, wy, selectable, hovered, hoveredInvalid);
      const { sx, sy } = tileToScreen(wx, wy, p.cameraX, p.cameraY, p.canvasW, p.canvasH, p.zoom);
      g.position.set(sx, sy);
      g.scale.set(p.zoom);
    }
  }
  for (const key of Array.from(scene.groundPool.keys())) {
    if (!wantedGround.has(key)) {
      const g = scene.groundPool.get(key)!;
      g.destroy();
      scene.groundPool.delete(key);
    }
  }

  // ============ roads layer ============
  const wantedRoads = new Set<string>();
  for (const key of Object.keys(p.state.map.roads)) {
    const [wx, wy] = key.split(",").map(Number);
    if (wx < vis.x0 - 1 || wx > vis.x1 || wy < vis.y0 - 1 || wy > vis.y1) continue;
    wantedRoads.add(key);

    let g = scene.roadsPool.get(key);
    if (!g) {
      g = new Graphics();
      scene.roadsLayer.addChild(g);
      scene.roadsPool.set(key, g);
    }
    drawIsoRoad(g);
    const { sx, sy } = tileToScreen(wx, wy, p.cameraX, p.cameraY, p.canvasW, p.canvasH, p.zoom);
    g.position.set(sx, sy);
    g.scale.set(p.zoom);
  }
  for (const key of Array.from(scene.roadsPool.keys())) {
    if (!wantedRoads.has(key)) {
      const g = scene.roadsPool.get(key)!;
      g.destroy();
      scene.roadsPool.delete(key);
    }
  }

  // ============ buildings layer ============
  // When the player has a placeable selected and is hovering an empty
  // tile, fade any building that would visually sit on top of the
  // hover position so the placement target stays visible. In this iso
  // projection a building at (bx, by) is drawn in front of tile
  // (hx, hy) when bx >= hx and by >= hy (it has a higher iso depth
  // sum and shares the same screen column band). Limit the fade to a
  // small wedge so the rest of the city stays opaque.
  const fadeActive =
    p.selectMode !== null && p.hoverX !== null && p.hoverY !== null;
  const FADE_RADIUS = 4;
  const FADE_ALPHA = 0.25;

  const origins = p.state.map.multiTileOrigin ?? {};
  const wantedBuildings = new Set<string>();
  for (const [key, id] of Object.entries(p.state.map.placed) as [string, BuildingId][]) {
    // Skip non-origin footprint tiles: only the origin draws the
    // multi-tile sprite. (For 1x1 buildings every tile is its own
    // origin and origins[key] is undefined, so this is a no-op.)
    if (origins[key]) continue;
    const [wx, wy] = key.split(",").map(Number);
    const size = buildingSize(id);
    // Cull using the building's south-east corner so a multi-tile
    // building stays in the pool even when its origin tile scrolls
    // out of view but its body is still visible.
    if (
      wx + size - 1 < vis.x0 - 1 || wx > vis.x1 ||
      wy + size - 1 < vis.y0 - 1 || wy > vis.y1
    ) continue;
    wantedBuildings.add(key);

    let g = scene.buildingsPool.get(key);
    if (!g) {
      g = new Graphics();
      scene.buildingsLayer.addChild(g);
      scene.buildingsPool.set(key, g);
    }
    const isDisconnected = id !== "main" && !p.connected.has(key);
    const isPaused = !!p.state.map.disabled?.[key];
    drawIsoBuildingSized(g, id, size, isDisconnected || isPaused);
    const { sx, sy } = tileToScreen(wx, wy, p.cameraX, p.cameraY, p.canvasW, p.canvasH, p.zoom);
    g.position.set(sx, sy);
    g.scale.set(p.zoom);
    // zIndex from the south-east corner so a multi-tile sprite
    // draws after any 1x1 tile that lives inside or behind its
    // footprint.
    g.zIndex = (wx + size - 1) + (wy + size - 1);

    let alpha = 1;
    if (fadeActive) {
      // Compare hover to any footprint tile (use closest corner).
      const dxRaw = wx - (p.hoverX as number);
      const dyRaw = wy - (p.hoverY as number);
      const dx = Math.max(0, dxRaw);
      const dy = Math.max(0, dyRaw);
      const isInFront = dxRaw >= 0 && dyRaw >= 0 && (dxRaw > 0 || dyRaw > 0);
      const occludes =
        isInFront &&
        dx <= FADE_RADIUS &&
        dy <= FADE_RADIUS;
      if (occludes) alpha = FADE_ALPHA;
    }
    g.alpha = alpha;
  }
  for (const key of Array.from(scene.buildingsPool.keys())) {
    if (!wantedBuildings.has(key)) {
      const g = scene.buildingsPool.get(key)!;
      g.destroy();
      scene.buildingsPool.delete(key);
    }
  }

  // ============ inspector selection highlight ============
  // Single diamond outline on the inspected tile so the player can
  // tell at a glance which building the inspector panel is showing.
  // The graphic lives at the top of the scene's z-order, so the
  // outline never hides behind a tall building sprite. Hidden when
  // nothing is inspected.
  const sel = scene.selectionOverlay;
  if (p.inspectKey && p.state.map.placed[p.inspectKey]) {
    const [ixStr, iyStr] = p.inspectKey.split(",");
    const ix = Number(ixStr);
    const iy = Number(iyStr);
    const inspectedId = p.state.map.placed[p.inspectKey];
    const inspectedSize = buildingSize(inspectedId);
    sel.clear();
    // NxN footprint diamond corners (relative to origin tile's
    // top-left). Same math as the multi-tile body drawing in
    // tiles.ts, inset by 1px so the outline sits on the tile edge.
    const N = inspectedSize;
    sel.poly([
      TILE_W / 2,              1,
      ((N + 1) * TILE_W) / 2 - 1, (N * TILE_H) / 2,
      TILE_W / 2,              N * TILE_H - 1,
      -((N - 1) * TILE_W) / 2 + 1, (N * TILE_H) / 2,
    ]);
    sel.stroke({ width: 2, color: 0xccff44, alpha: 1 });
    const { sx, sy } = tileToScreen(
      ix,
      iy,
      p.cameraX,
      p.cameraY,
      p.canvasW,
      p.canvasH,
      p.zoom,
    );
    sel.position.set(sx, sy);
    sel.scale.set(p.zoom);
    sel.visible = true;
  } else {
    sel.visible = false;
  }

  // ============ hover highlight ============
  // Thin white-ish outline around the building under the cursor,
  // so the player can see which building they're about to interact
  // with. Suppressed during placement mode (the placement preview
  // is doing the work there) and when the inspector is already
  // showing the same building (the gold dashed ring is enough).
  const hov = scene.hoverOverlay;
  const hoverKeyRaw =
    p.hoverX !== null && p.hoverY !== null
      ? `${p.hoverX},${p.hoverY}`
      : null;
  const hoverOrigins = p.state.map.multiTileOrigin ?? {};
  const hoverOriginKey =
    hoverKeyRaw && p.state.map.placed[hoverKeyRaw]
      ? hoverOrigins[hoverKeyRaw] ?? hoverKeyRaw
      : null;
  const showHover =
    hoverOriginKey !== null &&
    p.selectMode === null &&
    hoverOriginKey !== p.inspectKey;
  if (showHover && hoverOriginKey) {
    const id = p.state.map.placed[hoverOriginKey];
    const N = buildingSize(id);
    const [hxStr, hyStr] = hoverOriginKey.split(",");
    const hx = Number(hxStr);
    const hy = Number(hyStr);
    hov.clear();
    hov.poly([
      TILE_W / 2, 1,
      ((N + 1) * TILE_W) / 2 - 1, (N * TILE_H) / 2,
      TILE_W / 2, N * TILE_H - 1,
      -((N - 1) * TILE_W) / 2 + 1, (N * TILE_H) / 2,
    ]);
    hov.stroke({ width: 1.5, color: 0xffffff, alpha: 0.85 });
    const { sx, sy } = tileToScreen(
      hx,
      hy,
      p.cameraX,
      p.cameraY,
      p.canvasW,
      p.canvasH,
      p.zoom,
    );
    hov.position.set(sx, sy);
    hov.scale.set(p.zoom);
    hov.visible = true;
  } else {
    hov.visible = false;
  }
}
