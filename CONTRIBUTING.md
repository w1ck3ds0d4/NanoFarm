# Contributing

NanoFarm is a hobby project with one maintainer. Drive-by PRs are welcome but review will be slow and opinionated. If you are about to spend more than an hour on a change, open an issue first so we can confirm it fits the scope in [ROADMAP.md](ROADMAP.md) before you write code.

## Ground rules

- **No em dashes (`—`)** anywhere. Use a hyphen with spaces (` - `), a colon, or rephrase.
- **No AI / Claude attribution** in commits, PR titles, PR bodies, or repo files. No `Co-Authored-By: Claude` line, no "Generated with Claude Code" footer.
- **Commit prefix**: every commit message starts with a `(type)` prefix. Lowercase type in parens, then a lowercase description. Examples: `(feat) add splitter generator`, `(fix) clamp dt to 1s in tick loop`, `(docs) explain offline cap`, `(refactor) extract storage adapter`, `(chore) bump vite to 6.x`, `(test) cover migrate from v1 to v2`.
- **Small commits**. One logical change per commit. Do not bundle a refactor and a feature.
- **Small PRs**. One feature or fix per PR. Match the granularity of recent PRs in this repo. Sequential merging is preferred: push one PR, get it merged, then push the next.
- **No scope creep**. Features that are not on the roadmap need an issue + a yes from the maintainer before they ship.

## Branch naming

`<type>/<short-kebab-desc>`. Examples:

- `feat/research-tree`
- `fix/connectivity-bfs-off-by-one`
- `docs/architecture-hook-flow`
- `chore/bump-pixi-8.7`

## Build commands

```bash
# install once at the repo root
pnpm install

# start the vite dev server on http://localhost:5173
pnpm dev

# build the app for production (output: app/dist/)
pnpm build

# preview a production build
pnpm preview

# typecheck everything
pnpm typecheck
```

When the extension package lands (phase 3) it will add:

```bash
# build the vs code extension (consumes app/dist/)
pnpm --filter @nanofarm/extension build

# package the extension into a .vsix
pnpm --filter @nanofarm/extension package
```

## Project layout

The repo is a pnpm workspace with three packages:

- `app/` - the standalone Vite + React + PixiJS game.
- `shared/` - cross-package types (`GameState`, `MapState`, `SaveBlob`, hook record shape, message envelopes).
- `extension/` - the VS Code extension wrapper (planned, phase 3).

Documentation lives at the repo root: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [HOW_IT_WORKS.md](HOW_IT_WORKS.md), [ROADMAP.md](ROADMAP.md), [SECURITY.md](SECURITY.md), [COMMERCIAL.md](COMMERCIAL.md), [CHANGELOG.md](CHANGELOG.md).

## Style notes

- Backticks around code identifiers, file paths, environment variables, and UI labels.
- Headings use sentence case (e.g. `## Tech stack`, `## Game tick loop`).
- Bullet items take the form `- **Bold label** - lowercase description`. The separator is a single hyphen with spaces, never an em dash.
- Code blocks for actual code or shell snippets. No bash prompts (`$`) unless they are part of the example.

## PR checklist

- The change is in scope per [ROADMAP.md](ROADMAP.md), or there is an issue agreeing it is.
- `pnpm typecheck` passes.
- If you touched the save schema, you added a migration in `hydrateMissingFields` and a note in [CHANGELOG.md](CHANGELOG.md) under `## [Unreleased]`.
- Commits follow the `(type)` prefix rule.
- No em dashes anywhere in code, docs, or commit messages.
- No AI / Claude attribution in commits or PR text.

## Reporting bugs

Open an issue with:

- What you did.
- What you expected.
- What happened.
- Where you saw it (standalone browser + version, or VS Code + OS + extension version).
- If possible, an export of the save that reproduces it (or "starts on a fresh save").

## Reporting security issues

Do not open a public issue. Email `daniel.svs@outlook.com`. See [SECURITY.md](SECURITY.md) for the threat model and what counts as in scope.

## License of contributions

NanoFarm is MIT-licensed. By opening a PR you agree that your contribution may be redistributed under the MIT license. See [LICENSE](LICENSE).
