import type { SaveBlob } from "@nanofarm/shared";
import { getVsCodeApi, type VsCodeApi } from "./vscode";

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

/**
 * Storage adapter used when the app is running inside the VS Code
 * extension's WebviewPanel. Calls round-trip to the extension host
 * via `postMessage` (correlated by a per-call `reqId`) and the host
 * persists into `workspaceState` so each VS Code workspace has its
 * own independent farm.
 */
export class VsCodeStorageAdapter implements StorageAdapter {
  private vscode: VsCodeApi;
  private pending = new Map<string, (blob: unknown) => void>();
  private nextId = 1;

  constructor(vscode: VsCodeApi) {
    this.vscode = vscode;
    window.addEventListener("message", (e) => {
      const m = e.data as { type?: string; reqId?: string; blob?: unknown };
      if (m?.type === "storage.result" && m.reqId && this.pending.has(m.reqId)) {
        const resolve = this.pending.get(m.reqId)!;
        this.pending.delete(m.reqId);
        resolve(m.blob);
      }
    });
  }

  private request<T>(type: "storage.load" | "storage.save" | "storage.clear", blob?: SaveBlob): Promise<T> {
    return new Promise<T>((resolve) => {
      const reqId = `r${this.nextId++}`;
      this.pending.set(reqId, (b) => resolve(b as T));
      this.vscode.postMessage({ type, reqId, blob });
    });
  }

  async load(): Promise<SaveBlob | null> {
    const raw = await this.request<unknown>("storage.load");
    return (raw as SaveBlob | null) ?? null;
  }

  async save(blob: SaveBlob): Promise<void> {
    await this.request<void>("storage.save", blob);
  }

  async clear(): Promise<void> {
    await this.request<void>("storage.clear");
  }
}

// Cache so re-renders + StrictMode double-mounts share one adapter.
// The vscode API singleton itself lives in ./vscode.ts; this just
// caches the adapter wrapping it.
let cachedAdapter: StorageAdapter | null = null;

export function createStorageAdapter(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;
  const vscode = getVsCodeApi();
  cachedAdapter = vscode
    ? new VsCodeStorageAdapter(vscode)
    : new LocalStorageAdapter();
  return cachedAdapter;
}
