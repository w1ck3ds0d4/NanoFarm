import type { HookLine } from "@nanofarm/shared";

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

export function createDrainer(): TokenDrainer {
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
