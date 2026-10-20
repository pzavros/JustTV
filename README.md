# JustTV

The Samsung TV launcher. Edit `src/`; build and test locally. These commands never connect to or deploy to the TV.

## Start here

Open **`src/app.js`** for the readable launcher entry and **`src/platform.js`** for the Samsung adapter entry. Files use real imports/exports; dependencies are explicit. Mutable data lives in `src/launcher/state.js`, and view builders live in `src/launcher/views/`.

## Where to work

| Folder | What belongs here |
| --- | --- |
| `src/launcher/` | Focus, actions, profiles, lifecycle and explicit state |
| `src/launcher/views/` | Tile/home markup, menus, inputs, controls and text entry |
| `src/platform/` | Samsung/Tizen API adapter and fallbacks |
| `src/styles/` | Editable stylesheet |
| `src/public/` | HTML entry, TV config, icons, fonts and artwork |
| `src/device.js`, `src/strings.js`, `src/types.d.ts` | Device catalogue, copy and data contracts |
| `scripts/` | Build, validation and ordered source manifest |
| `tests/` | Regression tests and frozen comparison fixtures |
| `docs/` | Architecture, research, performance and contribution guide |

Use `src/launcher/home-model.js` for the five home rows, `src/launcher/views/tiles.js` for tile markup, `src/launcher/remote.js` for remote events, and `src/launcher/lifecycle.js` for startup. Styles and assets have one editable home in `src/`.

## Build and verify

Use Node 20 or newer:

```sh
npm ci
npm run build
npm run verify
```

`dist/` is disposable generated TV output. Its compact `app.js` is a build product; edit the readable files in `src/launcher/` instead. The build recreates `dist/` from source and retains the same runtime bundles, behavior and asset bytes.

Browser checks use installed Chrome. Alternatively run `npx playwright install chromium` and then `JUSTTV_BROWSER_CHANNEL=chromium npm run test:browser`.

`npm run format` formats source and tools; `npm run format:check` checks formatting. `npm run verify` includes frozen baseline equivalence, ES5/size checks, module/adapter tests and browser comparisons of both the release build and directly loaded source modules. The source HTML is readable too; its build output remains byte-identical. An intentional behavior change requires explicit review of the baseline.

## Documentation

- [Architecture and state ownership](docs/architecture.md)
- [Samsung TV research](docs/research.md)
- [Performance guarantees and limits](docs/performance.md)
- [Adding features and contributing](docs/contributing.md)

## Local history

`.local/archive/` holds old widgets, source ZIPs, screenshots, device experiments and rollback material, plus the previous Codex session's work/output folders. These are preserved reference material, not current source. Some historical scripts contain old absolute paths; do not execute them as current tooling. Signing material, device tokens and backups remain local and excluded from Git.

Current verification reports are in `.local/reports/`; browser screenshots are in `.local/test-artifacts/`. The archive index is `.local/archive/INDEX.md`.

VS Code hides `dist/`, `node_modules/` and `.local/` from its Explorer and search to keep normal editing focused. They remain on disk and can be shown by changing `.vscode/settings.json`.

No TV settings or installed apps were changed during this reorganization. The earlier failed startup experiment is preserved for later review; reliable cold-start autolaunch remains unverified.

## Branding and installed-TV compatibility

The project folder and public name are **JustTV**. The icon uses a J monogram. The app/package/widget IDs, `coast.*` storage keys and `Coast`/`COAST_*` tooling interfaces deliberately retain their existing values so a later update can preserve installed identity, Home routing and saved preferences. Historical builds and frozen test fixtures keep their original names. No installation or deployment is part of this rename.
