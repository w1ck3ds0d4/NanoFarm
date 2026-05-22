import { Application, Container, Graphics } from "pixi.js";
import type { GameState } from "@nanofarm/shared";
import { drawTile, type TileSprite } from "./tiles";

const TILE_SIZE = 32;
const GRID_W = 12;
const GRID_H = 8;

export interface Scene {
  root: Container;
  tiles: TileSprite[];
}

export function mountScene(app: Application): Scene {
  const root = new Container();
  const tiles: TileSprite[] = [];

  const bg = new Graphics();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      bg.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      bg.fill({ color: (x + y) % 2 === 0 ? 0x1a2010 : 0x1f2614 });
    }
  }
  root.addChild(bg);

  app.stage.addChild(root);
  return { root, tiles };
}

export function updateScene(scene: Scene, state: GameState): void {
  const desired: { kind: "farm" | "mine"; x: number; y: number }[] = [];
  let slot = 0;

  const maxSlots = GRID_W * GRID_H;
  const farmCount = Math.min(state.buildings.farm.count, maxSlots);
  for (let i = 0; i < farmCount; i++) {
    const x = slot % GRID_W;
    const y = Math.floor(slot / GRID_W);
    desired.push({ kind: "farm", x, y });
    slot++;
  }
  const mineCount = Math.min(state.buildings.mine.count, maxSlots - slot);
  for (let i = 0; i < mineCount; i++) {
    const x = slot % GRID_W;
    const y = Math.floor(slot / GRID_W);
    desired.push({ kind: "mine", x, y });
    slot++;
  }

  while (scene.tiles.length < desired.length) {
    const t = drawTile("farm");
    scene.tiles.push(t);
    scene.root.addChild(t.graphics);
  }
  while (scene.tiles.length > desired.length) {
    const t = scene.tiles.pop();
    if (t) t.graphics.destroy();
  }

  for (let i = 0; i < desired.length; i++) {
    const d = desired[i];
    const t = scene.tiles[i];
    t.kind = d.kind;
    t.graphics.position.set(d.x * TILE_SIZE, d.y * TILE_SIZE);
    drawTile(d.kind, t.graphics);
  }
}
