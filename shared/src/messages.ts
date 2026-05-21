import type { SaveBlob } from "./save";

export type HostMessage =
  | { kind: "load" }
  | { kind: "save"; blob: SaveBlob }
  | { kind: "clear" };

export type WebviewMessage =
  | { kind: "loaded"; blob: SaveBlob | null }
  | { kind: "saved" }
  | { kind: "cleared" }
  | { kind: "error"; message: string };
