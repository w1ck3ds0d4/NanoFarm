import type { HookLine } from "@nanofarm/shared";
import { getVsCodeApi, type VsCodeApi } from "../adapter/vscode";

export interface TokenDrainer {
  isAvailable(): boolean;
  isConnected(): boolean;
  restore(): Promise<void>;
  connect(): Promise<void>;
  drain(): Promise<HookLine[]>;
}

const IDB_NAME = "nanofarm-hook";
const IDB_STORE = "handles";
const IDB_KEY = "tokens-file";

interface PermissionCapableHandle extends FileSystemFileHandle {
  queryPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

export class BrowserTokenDrainer implements TokenDrainer {
  private handle: PermissionCapableHandle | null = null;
  private connectedFlag = false;

  isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.showOpenFilePicker === "function";
  }

  isConnected(): boolean {
    return this.connectedFlag;
  }

  async restore(): Promise<void> {
    if (!this.isAvailable()) return;
    const handle = await idbGet<PermissionCapableHandle>(IDB_KEY);
    if (!handle) return;
    const perm = handle.queryPermission
      ? await handle.queryPermission({ mode: "readwrite" })
      : "prompt";
    if (perm === "granted") {
      this.handle = handle;
      this.connectedFlag = true;
    }
  }

  async connect(): Promise<void> {
    if (!this.isAvailable()) throw new Error("file system access api not available");
    const picked = await window.showOpenFilePicker!({
      suggestedName: "tokens.jsonl",
      types: [
        {
          description: "NanoFarm hook log",
          accept: { "application/jsonl": [".jsonl"] }
        }
      ]
    });
    const handle = picked[0] as PermissionCapableHandle;
    const perm = handle.requestPermission
      ? await handle.requestPermission({ mode: "readwrite" })
      : "granted";
    if (perm !== "granted") throw new Error("readwrite permission denied");
    await idbSet(IDB_KEY, handle);
    this.handle = handle;
    this.connectedFlag = true;
  }

  async drain(): Promise<HookLine[]> {
    if (!this.handle) return [];
    const file = await this.handle.getFile();
    const text = await file.text();
    if (text.length === 0) return [];
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: HookLine[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as HookLine;
        if (obj && typeof obj.t === "number" && typeof obj.tool === "string") {
          parsed.push(obj);
        }
      } catch {
        // skip malformed lines
      }
    }
    const writable = await this.handle.createWritable();
    await writable.write("");
    await writable.close();
    return parsed;
  }
}

export class NullTokenDrainer implements TokenDrainer {
  isAvailable(): boolean {
    return false;
  }
  isConnected(): boolean {
    return false;
  }
  async restore(): Promise<void> {
    /* no-op */
  }
  async connect(): Promise<void> {
    throw new Error("token drainer not available on this surface");
  }
  async drain(): Promise<HookLine[]> {
    return [];
  }
}

// ─── VS Code extension bridge ───────────────────────────────────────────────
//
// When the game runs inside the NanoFarm VS Code extension, the
// host JS environment doesn't expose showOpenFilePicker (sandboxed
// iframe), so BrowserTokenDrainer is unusable. Instead the extension
// itself reads + truncates the player's tokens.jsonl using Node fs
// APIs and exchanges messages with the webview over postMessage.
//
// Protocol (matches extension/src/extension.ts):
//   webview -> ext: { type: "hook.status|connect|drain|set-path", reqId, path? }
//   ext -> webview: { type: "hook.result", reqId, available, connected, lines?, path?, error? }

interface HookResultPayload {
  type: "hook.result";
  reqId: string;
  available: boolean;
  connected: boolean;
  lines?: HookLine[];
  path?: string;
  error?: string;
}

export class VsCodeTokenDrainer implements TokenDrainer {
  private vscode: VsCodeApi;
  private pending = new Map<string, (msg: HookResultPayload) => void>();
  private nextId = 1;
  private connectedFlag = false;

  constructor(vscode: VsCodeApi) {
    this.vscode = vscode;
    window.addEventListener("message", (e) => {
      const m = e.data as HookResultPayload | undefined;
      if (!m || m.type !== "hook.result" || !m.reqId) return;
      const resolve = this.pending.get(m.reqId);
      if (!resolve) return;
      this.pending.delete(m.reqId);
      resolve(m);
    });
  }

  isAvailable(): boolean {
    return true;
  }

  isConnected(): boolean {
    return this.connectedFlag;
  }

  async restore(): Promise<void> {
    // Ask the extension what its current view of the world is. If
    // the hook file already exists on disk, we light up automatically;
    // the player doesn't have to click 'connect hook' on every reload.
    const res = await this.request("hook.status");
    this.connectedFlag = res.connected;
  }

  async connect(): Promise<void> {
    const res = await this.request("hook.connect");
    this.connectedFlag = res.connected;
    if (!res.connected && res.error) {
      throw new Error(res.error);
    }
  }

  async drain(): Promise<HookLine[]> {
    const res = await this.request("hook.drain");
    // Connection state can flap (file deleted between ticks); keep
    // the flag in sync so the HUD reflects reality.
    this.connectedFlag = res.connected;
    return res.lines ?? [];
  }

  private request(type: "hook.status" | "hook.connect" | "hook.drain"): Promise<HookResultPayload> {
    return new Promise((resolve) => {
      const reqId = `h${this.nextId++}`;
      this.pending.set(reqId, resolve);
      this.vscode.postMessage({ type, reqId });
    });
  }
}

export function createDrainer(): TokenDrainer {
  // VS Code webview: bridge through the extension (preferred -
  // showOpenFilePicker is not available in the sandboxed iframe).
  const vscode = getVsCodeApi();
  if (vscode) return new VsCodeTokenDrainer(vscode);
  // Standalone Chromium (pnpm dev): use the File System Access API.
  if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") {
    return new BrowserTokenDrainer();
  }
  return new NullTokenDrainer();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
