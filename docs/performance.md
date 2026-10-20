# Performance contract

This is a local source/module refactor. No TV connection, deployment, startup experiment or new on-device benchmark is part of it.

## Preserved runtime

- Same four external JavaScript files, one stylesheet and HTML entry.
- Same controller/adapter closures. Imports, exports and declared state objects are resolved at build time; no module loader, runtime store or per-feature wrappers ship.
- Same operations, function bodies, call sites, branches, native calls, timers, debounce intervals, events and storage schema.
- Same cached focus geometry and old/new DOM updates. No new layout reads or state-object property indirection on arrow navigation.
- Same ordered CSS rules, specificity, artwork, fonts, configuration and app identity.
- Same deferred native discovery and weather work after the first frame.
- Formatted source HTML compiles to the original document apart from reviewed JustTV title/label fields, including its early boot timestamp.

## Evidence

`npm run check:equivalence` parses release JavaScript as ES5 and compares executable trees with the frozen baseline. Hoisted function declaration placement and adjacent `var` grouping are normalized because splitting a file changes their placement, without adding operations or changing initialization order. Tests verify that changed operations, property names and initialization order still fail. Duplicate hoisted function definitions are rejected.

CSS comparisons preserve rule/declaration order and parse custom properties, while normalizing equivalent numeric/color spelling. Static asset hashes and the complete runtime file list remain checked. The reviewed rebrand changes only document labels, the config display name and icon; `scripts/branding.mjs` limits normalization to those display fields and pins the new icon hash. The frozen historical fixtures are unchanged. `tests/fixtures/runtime-budgets.json` caps each output at its size immediately before this module refactor. Reports are in `.local/reports/refactor-verification.json`.

The browser suite runs the baseline, compiled build and direct ES module entries using isolated storage, fixed time, local fixtures and blocked external requests. It tests every row's focus bounds, edge stopping, overlays, held OK, ambient wake and rename persistence. Capture waits for navigation to settle and disables CSS animations in the screenshot runner only. DOM markup hashes and focus geometry must match exactly for all six views. PNG comparisons allow at most 20 differing pixels out of 2,073,600 and require Pixelmatch to find zero significant differences with a 0.005 threshold and antialias detection; raw PNG hashes are still recorded, so edge-rasterization differences are not reported as byte-identical. Reports are in `.local/reports/refactor-browser-checks.json`.

Adapter tests mock Tizen APIs. Module tests protect import/export validation, scope shadowing, static state lowering, non-escaping state and equivalence normalization. Build-only tools and declarations stay outside `dist/`.

## Limits

These checks protect the executable work and payload; they are not new measurements of TV latency, frame rate or memory. Native ES module execution is a development/test path; the TV continues to receive classic ES5 bundles. Historical TV reports describe earlier deployed builds, not this undeployed change.
