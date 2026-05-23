/**
 * NanoFarm VS Code extension.
 *
 * Registers a single command (`nanofarm.open`) that opens the game
 * in a `WebviewPanel`. The HTML + JS + CSS come from the standalone
 * Vite build under `app/dist/`; the extension reads the built
 * `index.html`, rewrites asset URLs to the webview-safe form via
 * `asWebviewUri`, and serves the result.
 *
 * Save state is bridged through `postMessage`:
 *   webview -> extension : { type: "storage.load" | "storage.save" | "storage.clear", reqId, blob? }
 *   extension -> webview : { type: "storage.result", reqId, blob? }
 *
 * Persisted in `context.workspaceState` under key `nanofarm.save`,
 * scoped per workspace so two open VS Code windows have independent
 * farms.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const STORAGE_KEY = "nanofarm.save";

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand("nanofarm.open", () => {
    openPanel(context);
  });
  context.subscriptions.push(cmd);
}

export function deactivate(): void {
  // intentionally empty - the panel hooks its own dispose
}

let currentPanel: vscode.WebviewPanel | undefined;

function openPanel(context: vscode.ExtensionContext): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Active);
    return;
  }

  // The Vite app's build output. With the workspace layout the
  // extension lives at `extension/`, the app at `app/`, so the
  // built bundle is two dirs up + `app/dist`. When this extension
  // ships as a VSIX the bundled assets live next to `out/`, so we
  // also probe a fallback relative to the extension root.
  const distCandidates = [
    path.join(context.extensionPath, "..", "app", "dist"),
    path.join(context.extensionPath, "dist"),
  ];
  const distPath = distCandidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (!distPath) {
    void vscode.window.showErrorMessage(
      "NanoFarm: built app not found. Run `pnpm build` in the repo root first.",
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "nanofarm.game",
    "NanoFarm",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(distPath)],
    },
  );

  currentPanel = panel;
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });

  panel.webview.html = buildHtml(panel.webview, distPath);

  panel.webview.onDidReceiveMessage(async (msg: WebviewToExtension) => {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "storage.load") {
      const blob = context.workspaceState.get<unknown>(STORAGE_KEY) ?? null;
      panel.webview.postMessage({ type: "storage.result", reqId: msg.reqId, blob });
    } else if (msg.type === "storage.save") {
      await context.workspaceState.update(STORAGE_KEY, msg.blob ?? null);
      panel.webview.postMessage({ type: "storage.result", reqId: msg.reqId });
    } else if (msg.type === "storage.clear") {
      await context.workspaceState.update(STORAGE_KEY, undefined);
      panel.webview.postMessage({ type: "storage.result", reqId: msg.reqId });
    }
  });
}

/**
 * Read the Vite-built `index.html` and rewrite every `src=` and
 * `href=` whose value starts with `./` (Vite's relative-base output)
 * into a `vscode-webview:`-friendly URI via `asWebviewUri`. Also
 * stamps a CSP meta tag so the webview accepts inline styles and
 * the rewritten asset origin.
 */
function buildHtml(webview: vscode.Webview, distPath: string): string {
  const indexPath = path.join(distPath, "index.html");
  const raw = fs.readFileSync(indexPath, "utf8");
  const cspSource = webview.cspSource;

  // Resolve `./foo/bar.js` -> `vscode-webview://.../foo/bar.js`.
  let rewritten = raw.replace(/(src|href)="\.\/([^"]+)"/g, (_full, attr, rel) => {
    const onDisk = vscode.Uri.file(path.join(distPath, rel));
    return `${attr}="${webview.asWebviewUri(onDisk)}"`;
  });

  // Vite emits `<script ... crossorigin>` and `<link ... crossorigin>`.
  // In the webview the document origin and the asset origin differ, and
  // vscode-resource responses don't include CORS headers, so the
  // crossorigin attribute makes the browser refuse to execute the
  // script. Strip it.
  rewritten = rewritten.replace(/\s+crossorigin(="[^"]*")?/g, "");

  // CSP for the webview. Pixi.js 8 needs wasm-unsafe-eval for some
  // codepaths and may spin up worker scripts for async asset loading.
  const csp =
    `default-src 'none'; ` +
    `img-src ${cspSource} https: data: blob:; ` +
    `script-src ${cspSource} 'unsafe-inline' 'wasm-unsafe-eval'; ` +
    `style-src ${cspSource} 'unsafe-inline'; ` +
    `font-src ${cspSource} data:; ` +
    `worker-src ${cspSource} blob:; ` +
    `connect-src ${cspSource} blob: data:;`;

  // On-screen status banner. Visible without devtools so we can see
  // how far the boot got: "html-parsed" means HTML loaded, "js-ran"
  // means inline scripts can execute, "mounted" (set by main.tsx)
  // means React mounted. If the banner stays at "html-parsed" the
  // CSP is still blocking scripts.
  const statusBanner = `
    <div id="nf-boot-status" style="position:fixed;bottom:6px;right:8px;font:11px ui-monospace,monospace;color:#9f9;background:#0008;padding:4px 8px;border-radius:4px;z-index:99999;pointer-events:none">html-parsed</div>
    <script>
      window.addEventListener("error", function(e){
        var s=document.getElementById("nf-boot-status");
        if(s){s.style.color="#f99";s.textContent="error: "+(e.message||"unknown");}
      });
      var s=document.getElementById("nf-boot-status");
      if(s){s.textContent="js-ran";}
      console.log("nanofarm: html booted, inline script ran");
    </script>`;

  // Inject CSP into <head>, inject status banner just inside <body>.
  let out = rewritten.replace(
    /<head>/,
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );
  out = out.replace(/<body([^>]*)>/, `<body$1>${statusBanner}`);
  return out;
}

// ─── Message protocol ────────────────────────────────────────────────────────

type WebviewToExtension =
  | { type: "storage.load"; reqId: string }
  | { type: "storage.save"; reqId: string; blob: unknown }
  | { type: "storage.clear"; reqId: string };
