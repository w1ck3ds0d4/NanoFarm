/**
 * NanoFarm VS Code extension.
 *
 * Registers a single command (`nanofarm.open`) that opens the game
 * in a `WebviewPanel`. The HTML + JS + CSS come from the standalone
 * Vite build under `app/dist/`; the extension reads the built
 * `index.html`, rewrites asset URLs to the webview-safe form via
 * `asWebviewUri`, and serves the result.
 *
 * Two postMessage bridges connect the webview to native APIs that
 * the sandboxed iframe can't reach on its own:
 *
 *   storage:  workspaceState-backed save/load, scoped per workspace.
 *     webview -> ext: { type: "storage.load|save|clear", reqId, blob? }
 *     ext -> webview: { type: "storage.result", reqId, blob? }
 *
 *   hook:     Claude Code PostToolUse drainer. Reads/truncates the
 *     player's tokens.jsonl (default ~/.nanofarm/tokens.jsonl) so
 *     the game can convert AI tool calls into bonus materials. The
 *     File System Access API isn't available in webview iframes, so
 *     this bridge replaces the BrowserTokenDrainer used by the
 *     standalone Vite build.
 *     webview -> ext: { type: "hook.status|connect|drain|set-path", reqId, path? }
 *     ext -> webview: { type: "hook.result", reqId, available, connected, lines?, path?, error? }
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const STORAGE_KEY = "nanofarm.save";
const HOOK_PATH_KEY = "nanofarm.hookPath";

/** Default tokens file: ~/.nanofarm/tokens.jsonl. Matches the path
 * the shipped hook scripts write to (see hooks/INSTALL.md). */
function defaultHookPath(): string {
  return path.join(os.homedir(), ".nanofarm", "tokens.jsonl");
}

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
    } else if (msg.type === "hook.status") {
      const hookPath = context.workspaceState.get<string>(HOOK_PATH_KEY) ?? defaultHookPath();
      const exists = fs.existsSync(hookPath);
      panel.webview.postMessage({
        type: "hook.result",
        reqId: msg.reqId,
        available: true,
        connected: exists,
        path: hookPath
      });
    } else if (msg.type === "hook.connect") {
      // Player explicitly asked to (re)connect. If the file doesn't
      // exist yet, surface a hint instead of silently failing - the
      // hook script is what creates it on first tool call.
      const hookPath = context.workspaceState.get<string>(HOOK_PATH_KEY) ?? defaultHookPath();
      const exists = fs.existsSync(hookPath);
      if (!exists) {
        panel.webview.postMessage({
          type: "hook.result",
          reqId: msg.reqId,
          available: true,
          connected: false,
          path: hookPath,
          error: `no file at ${hookPath} - install the Claude Code hook (see hooks/INSTALL.md), then run any tool call in Claude Code to create it`
        });
        return;
      }
      panel.webview.postMessage({
        type: "hook.result",
        reqId: msg.reqId,
        available: true,
        connected: true,
        path: hookPath
      });
    } else if (msg.type === "hook.drain") {
      const hookPath = context.workspaceState.get<string>(HOOK_PATH_KEY) ?? defaultHookPath();
      try {
        // Read-then-truncate. Race with the hook script is benign:
        // the hook appends, we truncate from zero. Anything written
        // between our read and our truncate gets dropped on the
        // floor (rare, low-stakes).
        let text = "";
        try {
          text = await fs.promises.readFile(hookPath, "utf8");
        } catch {
          // file missing or transient error - return no lines
          panel.webview.postMessage({
            type: "hook.result",
            reqId: msg.reqId,
            available: true,
            connected: false,
            lines: []
          });
          return;
        }
        const lines: Array<{ t: number; tool: string }> = [];
        if (text.length > 0) {
          for (const raw of text.split("\n")) {
            const line = raw.trim();
            if (!line) continue;
            try {
              const obj = JSON.parse(line) as { t?: unknown; tool?: unknown };
              if (typeof obj.t === "number" && typeof obj.tool === "string") {
                lines.push({ t: obj.t, tool: obj.tool });
              }
            } catch {
              // skip malformed lines
            }
          }
          await fs.promises.writeFile(hookPath, "", "utf8");
        }
        panel.webview.postMessage({
          type: "hook.result",
          reqId: msg.reqId,
          available: true,
          connected: true,
          lines
        });
      } catch (e) {
        panel.webview.postMessage({
          type: "hook.result",
          reqId: msg.reqId,
          available: true,
          connected: false,
          lines: [],
          error: String(e)
        });
      }
    } else if (msg.type === "hook.set-path") {
      const newPath = (msg.path ?? "").trim();
      if (!newPath) {
        await context.workspaceState.update(HOOK_PATH_KEY, undefined);
      } else {
        await context.workspaceState.update(HOOK_PATH_KEY, newPath);
      }
      const resolved = newPath || defaultHookPath();
      panel.webview.postMessage({
        type: "hook.result",
        reqId: msg.reqId,
        available: true,
        connected: fs.existsSync(resolved),
        path: resolved
      });
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

  return rewritten.replace(
    /<head>/,
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );
}

// ─── Message protocol ────────────────────────────────────────────────────────

type WebviewToExtension =
  | { type: "storage.load"; reqId: string }
  | { type: "storage.save"; reqId: string; blob: unknown }
  | { type: "storage.clear"; reqId: string }
  | { type: "hook.status"; reqId: string }
  | { type: "hook.connect"; reqId: string }
  | { type: "hook.drain"; reqId: string }
  | { type: "hook.set-path"; reqId: string; path?: string };
