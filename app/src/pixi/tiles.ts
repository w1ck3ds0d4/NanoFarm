import { Graphics } from "pixi.js";

export type TileKind = "farm" | "mine";

export interface TileSprite {
  graphics: Graphics;
  kind: TileKind;
}

const TILE_SIZE = 32;

export function drawTile(kind: TileKind, into?: Graphics): TileSprite {
  const g = into ?? new Graphics();
  g.clear();
  if (kind === "farm") {
    g.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.fill({ color: 0x3a5a18 });
    g.rect(6, 6, TILE_SIZE - 12, 8);
    g.fill({ color: 0x88aa33 });
    g.rect(8, 18, 4, 8);
    g.fill({ color: 0xccff44 });
    g.rect(18, 18, 4, 8);
    g.fill({ color: 0xccff44 });
  } else {
    g.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.fill({ color: 0x404444 });
    g.rect(8, 6, TILE_SIZE - 16, 8);
    g.fill({ color: 0x707474 });
    g.rect(12, 18, 8, 4);
    g.fill({ color: 0x222222 });
  }
  return { graphics: g, kind };
}
