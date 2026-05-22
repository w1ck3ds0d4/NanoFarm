# Contributing

NanoFarm is a hobby project with one maintainer. drive-by prs are welcome but review will be slow and opinionated. if you are about to spend more than an hour on a change, open an issue first so we can confirm it fits the scope in [ROADMAP.md](ROADMAP.md) before you write code.

## ground rules

- **lowercase prose.** docs and comments stay in lowercase. proper nouns and code identifiers keep their natural case.
- **no em dashes (`—`).** use a hyphen with spaces (` - `), a colon, or rephrase.
- **no ai-generated footers.** do not add `Co-Authored-By: <ai assistant>` or "generated with" lines to commits.
- **commit prefix.** every commit message starts with a `(type)` prefix. examples: `(feat) add splitter generator`, `(fix) clamp dt to 1s in tick loop`, `(docs) explain offline cap`, `(refactor) extract storage adapter`, `(chore) bump vite to 6.x`, `(test) cover migrate from v1 to v2`.
- **small commits.** one logical change per commit. do not bundle a refactor and a feature.
- **no scope creep.** features that are not on the roadmap need an issue + a yes from the maintainer before they ship.

## monorepo build commands (planned)

these will land alongside the first phase of code. they describe the intended ergonomics:

```bash
# install once at the repo root
pnpm install

# dev: run the standalone game in a browser
pnpm --filter app dev

# build the game bundle (produces app/dist/)
pnpm --filter app build

# build the vs code extension (consumes app/dist/)
pnpm --filter extension build

# package the extension into a .vsix
pnpm --filter extension package

# lint everything
pnpm -r lint

# typecheck everything
pnpm -r typecheck

# run tests
pnpm -r test
```

before opening a pr, run lint, typecheck, and tests in every affected workspace. if you add a new workspace, wire it into the root scripts so `pnpm -r` covers it.

## pr checklist

- the change is in scope per [ROADMAP.md](ROADMAP.md), or there is an issue agreeing it is.
- `pnpm -r typecheck` passes.
- `pnpm -r lint` passes.
- `pnpm -r test` passes.
- if you touched the save schema, you added a migration and a test that loads a v(n-1) save into the new build.
- commits follow the `(type)` prefix rule.
- no em dashes anywhere in code, docs, or commit messages.
- no ai footers in commits.

## reporting bugs

open an issue with:

- what you did.
- what you expected.
- what happened.
- where you saw it (standalone browser + version, or vs code + os + extension version).
- if possible, an export of the save that reproduces it (or "starts on a fresh save").

## reporting security issues

do not open a public issue. email `daniel.svs@outlook.com`. see [SECURITY.md](SECURITY.md) for the threat model and what counts as in scope.

## license of contributions

NanoFarm is mit-licensed. by opening a pr you agree that your contribution may be redistributed under the mit license. see [LICENSE](LICENSE).
