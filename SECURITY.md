# Security

## posture

NanoFarm is a single-player offline idle game. it runs entirely on the device. it makes no network calls at runtime. there is no backend, no account system, no telemetry, and no remote configuration channel.

state lives in one of two places, never both at once:

- **standalone web app**: `localStorage["nanofarm.save"]` in the host browser.
- **vs code extension**: `extensionContext.workspaceState` (per workspace) or `extensionContext.globalState` (per install), depending on a user-toggled setting.

the save format is a versioned json blob. see [ARCHITECTURE.md](ARCHITECTURE.md) for the schema.

## threat model

in scope:

- accidental save loss from a schema change. mitigated by versioning the save blob and writing forward-only migrations.
- a malformed save (corrupted, truncated, tampered) loading into a build that does not expect it. mitigated by validating the blob shape on load and falling back to a fresh save with a notice rather than crashing.
- the vs code webview talking to anything other than its own extension host. mitigated by a strict content security policy on the panel and by restricting `postMessage` handling to the small message set in `shared/messages.ts`.

out of scope:

- a user who edits their own save. cheating your own idle game is uninteresting and we do not block it. memory edit, json edit, export / re-import - all fine.
- a user with local code execution on the device. anyone with read access to the save can read or modify it; that is the nature of `localStorage` and of vs code workspace state. nothing security-relevant lives in the save.
- attacks on the host browser or vs code itself. engine vulnerabilities are the platform's responsibility.
- supply-chain attacks against vite, react, or the `vscode` extension api at install time. mitigated only by pinning major versions in `package.json` and using a committed `pnpm-lock.yaml`.

## what NanoFarm does not collect

- no analytics.
- no crash reporting.
- no remote config or feature flags.
- no user account, no email, no identifier.
- no network calls at all during gameplay.

the only outbound traffic from this repo is the user's own `pnpm install` and the vs code marketplace download path (if you install the extension that way). neither is initiated by the game at runtime.

## the vs code extension specifically

- the `WebviewPanel` is created with `enableScripts: true` (the game needs js) but with `localResourceRoots` limited to `media/` inside the extension dir. the webview cannot reach any other file on disk through the standard webview resource path.
- a content security policy header is set on the loaded html: `default-src 'none'; img-src ${webview.cspSource}; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`. no inline scripts, no remote scripts, no remote anything.
- the message channel between webview and host accepts only the kinds enumerated in `shared/messages.ts`. unknown messages are ignored.
- the extension does not read or write any file outside `extensionContext.storageUri` and the immutable extension install dir.

## save tampering

NanoFarm is built around the assumption that the player owns their save. you can:

- export the save as json and edit any field.
- import an edited save.
- copy a save from the browser to the extension or vice versa.

there is no signing, no checksum, no integrity check that we will enforce. the only validation on load is "does this blob match a known schema version, and if so, does the shape parse." if you set `nanoCredits` to a quadrillion in a text editor, the game will load it and let you play with a quadrillion nano-credits. this is fine. it is a single-player idle game.

## dependencies

- `package.json` files at the workspace root and in each package pin major versions; `pnpm-lock.yaml` records resolved versions.
- the planned dep set is small: vite, react, typescript, and `@types/vscode` for the extension. anything beyond that lands with a written justification in the pr that adds it.
- dependabot (or renovate, tbd) is planned but not configured yet.

## vulnerability disclosure

NanoFarm is a hobby project maintained by one person. if you find something that meaningfully affects users (for example, the extension reading or writing outside its own state, or the webview escaping its csp), email the maintainer at `daniel.svs@outlook.com`. please include:

- a reproducer or minimum failing case.
- affected commit hash.
- platform (browser + version, or vs code + os).
- impact assessment.

coordinated disclosure is preferred. there is no bug bounty.

## license

mit. see [LICENSE](LICENSE) and [COMMERCIAL.md](COMMERCIAL.md).
