# Contributing

Read `src/app.js`, then the relevant module. Edit `src/`; `dist/` is generated.

## Common edits

- Change home rows/actions in `launcher/home-model.js`.
- Change tile markup in `launcher/views/tiles.js`, row rendering in `views/home.js`, and overlays in the corresponding view module.
- Change navigation in `launcher/focus.js`, key behavior in `remote.js`, and stack behavior in `overlays.js`.
- Change persisted profiles/settings through `preferences.js` and `customization.js`; retain existing keys, migration and debounce behavior.
- Add native reads/commands in `platform/`, with an honest unsupported fallback and a contract test.
- Keep text in `strings.js`, device catalogue data in `device.js`, styles in `styles/launcher.css`, and static markup/artwork/configuration in `public/`.

## Add a module

1. Create a file with named exports and explicit relative named imports. Do not rely on variables from neighboring files. Avoid new top-level side effects before startup.
2. Import it from its caller/entry and add it to the correct bundle's `order` in `scripts/manifest.json`. Initialization order is explicit to protect the deployed behavior.
3. Read/mutate an existing `state` field through an explicit property. Add new state fields to the owning declaration and `LauncherState` contract. Do not pass the whole state object; the linker deliberately removes it from the TV build.
4. Use distinct names for bundle-level definitions. The build validates missing imports/exports, duplicate bindings and unsupported state access. Function-local names remain private.
5. Keep runtime bodies compatible with ES5. The source may use module declarations and the explicitly lowered `const` state declarations; arbitrary new language transforms are not part of the build.

For example, the existing focus code imports `{ state }` and `{ schedulePreferencesSave }` explicitly. Source references are readable; the linker restores the original local-variable accesses in the TV bundle.

## Verify

```sh
npm run format
npm run verify
npm run format:check
```

`verify` builds, checks executable/CSS equivalence and byte budgets, runs compiler/adapter tests, then exercises the baseline, compiled build and direct source modules in a local browser. It makes no TV connection. Browser tests use installed Chrome by default; see README for Chromium setup.

The frozen equivalence baseline is intentional. A new feature changes behavior and requires explicit review of its baseline and byte-budget changes; do not rewrite fixtures just to silence failures. Add tests at observable boundaries, not copies of implementation details. Keep logging, geometry probes and diagnostics off the release navigation path.

## Release boundary

Building/testing does not sign, install or deploy an app. TV installation, startup changes, Home routing, native helpers and cleanup are separate work requiring an explicit request. The earlier startup experiment stays archived and unresolved. Credentials, signing material and device backups belong only in the ignored local archive.

Branding-only changes must retain installed identity and saved-settings keys. Review explicit display-field/icon exceptions in `scripts/branding.mjs`, and keep historical fixtures unchanged.
