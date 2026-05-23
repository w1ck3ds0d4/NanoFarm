import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: { port: 5173 },
  // Relative base so the built bundle is portable: the VS Code
  // extension wrapper hosts `dist/` inside a webview sandbox at a
  // `vscode-webview://...` origin and absolute paths would resolve
  // against that origin rather than the bundled assets. With `'./'`
  // every <script src> and <link href> in index.html stays relative
  // to the document, and the extension's `asWebviewUri` rewrite
  // resolves them to the right local file. Standalone dev (`pnpm
  // dev`) and standalone preview still work because Vite's dev
  // server serves from the same origin regardless.
  base: "./",
  build: { target: "es2022", outDir: "dist", sourcemap: true }
});
