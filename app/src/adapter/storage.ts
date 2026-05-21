import type { SaveBlob } from "@nanofarm/shared";

export interface StorageAdapter {
  load(): Promise<SaveBlob | null>;
  save(blob: SaveBlob): Promise<void>;
  clear(): Promise<void>;
}

const LS_KEY = "nanofarm.save";

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<SaveBlob | null> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SaveBlob;
    } catch {
      return null;
    }
  }

  async save(blob: SaveBlob): Promise<void> {
    localStorage.setItem(LS_KEY, JSON.stringify(blob));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(LS_KEY);
  }
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => unknown;
  }
}

export function createStorageAdapter(): StorageAdapter {
  // extension adapter is phase 3; for now always use localStorage
  return new LocalStorageAdapter();
}
