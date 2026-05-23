// VS Code webview gives the document exactly one call to
// `window.acquireVsCodeApi()`. A second call throws. Both the
// storage adapter and the token drainer want to send postMessages,
// so they share the handle through this singleton.

export interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

let cached: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  if (typeof window.acquireVsCodeApi !== "function") return null;
  cached = window.acquireVsCodeApi();
  return cached;
}
