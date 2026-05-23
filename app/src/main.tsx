// Side-effect import: installs Pixi's non-eval shader/uniform
// polyfills before any Pixi code runs. The default Pixi v8 path uses
// `new Function()` for shader codegen, which is blocked by the VS
// Code webview CSP. Must come before any module that imports pixi.js.
import "pixi.js/unsafe-eval";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
