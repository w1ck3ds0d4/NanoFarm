// Copies the built app under app/dist into extension/dist so the
// VSIX ships a self-contained game bundle. Without this step the
// installed extension would point at a path that does not exist on
// the consumer's machine.

import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(here, "..");
const appDist = resolve(extensionRoot, "..", "app", "dist");
const bundledDist = join(extensionRoot, "dist");

if (!existsSync(join(appDist, "index.html"))) {
  console.error(`bundle-dist: app build missing at ${appDist}`);
  process.exit(1);
}

rmSync(bundledDist, { recursive: true, force: true });
cpSync(appDist, bundledDist, { recursive: true });
console.log(`bundle-dist: copied ${appDist} -> ${bundledDist}`);
