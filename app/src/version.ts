// Build-time constant injected by Vite (see vite.config.ts). Falls
// back to "dev" when running under standalone tsc / unit tests
// where the define isn't applied.
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
