# Security

## Posture

NanoFarm is a single-player offline idle game. It runs entirely on the device. It makes no network calls at runtime. There is no backend, no account system, no telemetry, and no remote configuration channel.

State lives in one of two places, never both at once:

- **Standalone web app**: `localStorage["nanofarm.save"]` in the host browser.
- **VS Code extension**: `extensionContext.workspaceState` under key `nanofarm.save`. Per-workspace (different VS Code workspace = different city).

The save format is a versioned JSON blob (`SaveBlob`, currently `version: 2`). See [ARCHITECTURE.md](ARCHITECTURE.md) for the schema.

The Claude Code hook integration reads one local file (`~/.nanofarm/tokens.jsonl`):

- **Standalone**: via the File System Access API after the user explicitly grants permission. The file handle is persisted in IndexedDB so the user does not have to re-grant on every page load, but the browser still enforces the same-origin permission model.
- **VS Code extension**: by the extension's Node `fs.promises` reading the path directly (default `~/.nanofarm/tokens.jsonl`). The path can be overridden via the `hook.set-path` postMessage but only by code running inside the webview (i.e. the bundled game). The extension does not read any other file on disk.

## Threat model

In scope:

- **Accidental save loss from a schema change** - mitigated by versioning the save blob and writing forward-only migrations in `hydrateMissingFields`. Older saves load with missing fields backfilled to sensible defaults.
- **A malformed save** (corrupted, truncated, tampered) loading into a build that does not expect it - mitigated by validating the blob shape on load and falling back to a fresh save with a notice rather than crashing.
- **The VS Code webview talking to anything other than its own extension host** - mitigated by a strict content security policy on the panel and by restricting `postMessage` handling to the small message set in `shared/messages.ts`.
- **The hook script writing outside its intended file** - mitigated by hard-coding the output path inside the shipped scripts to `~/.nanofarm/tokens.jsonl` and refusing to follow symlinks. Users who manually edit the script are out of scope.
- **The hook drainer reading user content it should not** - mitigated by parsing only well-formed `HookLine` JSON. The hook script writes only the tool name and a timestamp; it never writes tool inputs or outputs.

Out of scope:

- **A user who edits their own save** - cheating your own idle game is uninteresting and we do not block it. Memory edit, JSON edit, export / re-import: all fine.
- **A user with local code execution on the device** - anyone with read access to the save can read or modify it; that is the nature of `localStorage` and of VS Code workspace state. Nothing security-relevant lives in the save.
- **Attacks on the host browser or VS Code itself** - engine vulnerabilities are the platform's responsibility.
- **Supply-chain attacks against Vite, React, PixiJS, or the `vscode` extension api at install time** - mitigated only by pinning major versions in `package.json` and using a committed `pnpm-lock.yaml`.

## What NanoFarm does not collect

- No analytics.
- No crash reporting.
- No remote config or feature flags.
- No user account, no email, no identifier.
- No network calls at all during gameplay.

The only outbound traffic from this repo is the user's own `pnpm install` and the VS Code marketplace download path (if you install the extension that way). Neither is initiated by the game at runtime.

## What the hook records

Per Claude Code tool call:

- `t` - milliseconds since epoch.
- `tool` - the tool name (`Bash`, `Edit`, `Read`, etc).
- `v` - schema version (`1`).

That is the entire record. No code, no tool input, no tool output, no file paths, no command arguments, no responses. The file is grep-friendly JSONL and you can `cat` it yourself any time to audit.

## The VS Code extension specifically

- The `WebviewPanel` is created with `enableScripts: true` (the game needs JS) but with `localResourceRoots` limited to the bundled `dist/` folder inside the extension dir. The webview cannot reach any other file on disk through the standard webview resource path.
- A content security policy meta tag is stamped onto the loaded HTML:

  ```
  default-src 'none';
  img-src ${cspSource} https: data: blob:;
  script-src ${cspSource} 'unsafe-inline' 'wasm-unsafe-eval';
  style-src ${cspSource} 'unsafe-inline';
  font-src ${cspSource} data:;
  worker-src ${cspSource} blob:;
  connect-src ${cspSource} blob: data:;
  ```

  No remote scripts, no remote anything. `'wasm-unsafe-eval'` is required for PixiJS v8's renderer codegen.

- The message channel between webview and host accepts only the kinds enumerated in `extension/src/extension.ts`:
  - `storage.load` / `storage.save` / `storage.clear` - persist the save through `workspaceState`.
  - `hook.status` / `hook.connect` / `hook.drain` / `hook.set-path` - read + truncate `~/.nanofarm/tokens.jsonl`.

  Unknown message types are ignored.

- The extension's file system access is limited to:
  - `extensionContext.workspaceState` (managed by VS Code, not raw file I/O).
  - Reading + truncating `~/.nanofarm/tokens.jsonl` (or a workspace-state-overridden path via `hook.set-path`).
  - Reading the bundled `dist/` folder inside the extension install dir.

  Nothing else is touched.

## Save tampering

NanoFarm is built around the assumption that the player owns their save. You can:

- Export the save as JSON and edit any field.
- Import an edited save.
- Copy a save from the browser to the extension or vice versa.

There is no signing, no checksum, no integrity check that we will enforce. The only validation on load is "does this blob match a known schema version, and if so, does the shape parse." If you set `credits` to a quadrillion in a text editor, the game will load it and let you play with a quadrillion credits. This is fine. It is a single-player idle game.

## Dependencies

- `package.json` files at the workspace root and in each package pin major versions; `pnpm-lock.yaml` records resolved versions.
- The current dep set is small: Vite, React, PixiJS, TypeScript, `vite-tsconfig-paths`. Anything beyond that lands with a written justification in the PR that adds it.
- Dependabot is configured in `.github/dependabot.yml` for weekly GitHub Actions updates. The npm + cargo ecosystems are commented out and ready to enable when manifests land.

## Vulnerability disclosure

NanoFarm is a hobby project maintained by one person. If you find something that meaningfully affects users (for example, the extension reading or writing outside its own state, or the webview escaping its CSP), email the maintainer at `daniel.svs@outlook.com`. Please include:

- A reproducer or minimum failing case.
- Affected commit hash.
- Platform (browser + version, or VS Code + OS).
- Impact assessment.

Coordinated disclosure is preferred. There is no bug bounty.

## License

Dual-licensed under AGPL v3 + a commercial license. See [LICENSE](LICENSE) and [COMMERCIAL.md](COMMERCIAL.md).
