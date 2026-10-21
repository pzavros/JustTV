# Performance and TV compatibility

All optimization and verification in this pass are local. No TV connection, installation, startup change or on-device benchmark was performed.

## Release payload

| File | Before optimization | After optimization |
| --- | ---: | ---: |
| app.js | 35,343 B | 29,519 B |
| platform.js | 5,720 B | 5,098 B |
| strings.js | 4,162 B | 4,162 B |
| device.js | 782 B | 782 B |
| style.css | 22,520 B | 21,739 B |

The four JavaScript files total 39,561 B, down from 46,007 B (14.0%). JavaScript plus CSS falls by 7,227 B (10.5%). Static artwork and fonts are unchanged during this performance pass. No runtime dependencies or extra release files were added.

The build verifies linker/code-generator structure before a Terser release pass. Compression uses two passes with unsafe transforms disabled; only local identifiers are mangled. Public property names, Samsung APIs, storage keys and widget identity remain stable. The final JavaScript is parsed as ES5, and adapter tests plus direct-module/classic-browser parity exercise the optimized behavior. [Terser options](https://terser.org/docs/options/) document the optimizer controls.

Budgets are tightened to 29,800 B for app.js, 5,200 B for platform.js and 22,000 B for CSS. Historical fixtures remain unchanged. `check:equivalence` is a historical refactor audit and intentionally fails for the subsequent UI and optimization work; it is not the current behavior gate.

## Runtime work

- Arrow presses that cannot move home focus return before focus/ARIA mutations, frame sampling or preference saves. The existing remote throttle and idle wake semantics remain intact.
- Re-selecting the focused element avoids redundant focus mutations. Navigation geometry remains cached, without layout measurements on the arrow path.
- Row and track positioning use two-dimensional transforms. Only the active track explicitly requests promotion. The focused card still has its transform hint while full motion is enabled.
- Reduced motion removes explicit promotion hints from scene, decoration, tracks and focus faces. It continues to disable animation/transition effects. This addresses frozen elements retaining hints; it is not a measured GPU-memory reduction. [Chrome's rendering documentation](https://developer.chrome.com/blog/inside-browser-part3) explains the relationship between layer hints and compositing.
- Minute/weather updates retain the current scene class and weather markup when unchanged. The old SVG-circle query is removed because the shipped scene is raster artwork.
- A home rebuild cancels the prior navigation-pause timeout and clears its class, preventing stale paused decoration after refresh.
- Duplicate overridden CSS declarations and unused SVG scene palettes/rules are removed; the visible artwork, focus scale, 150ms focus, 180ms scroll and 300ms row/scene timings remain intact.

TV defaults remain conservative: scene quality 4. (The Reduce motion default later changed; see the motion pass below.) No preference migration or installed app identity was changed.

## Reproducible local measurements

`npm run test:performance` starts a loopback server, launches headless Chrome at 1920×1080 and applies 4× CPU throttling. It exercises full/reduced motion, row changes and repeated boundary keys. It records file sizes, first-usable time, navigation timing, DOM mutations and explicit `will-change` counts in `.local/reports/performance-after.json`.

The performance check asserts that eight ineffective boundary presses perform no settings writes and at most the two navigation-pause class changes. Reduced motion must leave zero explicit `will-change` hints. In the first optimization pass’s serial run, boundary mutations fell from 18 to 2 and settings writes from 1 to 0. Explicit layer hints in reduced motion fell from 18 to 0 (full motion: 18 to 14). The observed navigation handler p95 was 0.6–0.9ms after versus 1.2–2.1ms before with 4× desktop CPU throttling. These are single-run diagnostics, not hard latency thresholds or TV benchmarks; cold-start timings varied and are not claimed as a reliable improvement.

To compare an earlier copied build: `node scripts/performance.mjs .local/performance-before`. Run timing comparisons serially, without other browser checks competing for CPU. A null compositor-layer count means headless Chrome did not expose the layer tree. No GPU-memory number should be inferred from that result.

`npm run verify` checks a fresh build, ES5 syntax, byte budgets, pinned static assets, compiler/adapter tests and browser navigation/persistence. Six settled views must match between the current classic and direct-module entries. `JUSTTV_VISUAL_BASELINE=.local/performance-before npm run test:browser` also compares those views against the saved build from before this optimization. Releasing compositor layers changes gradient rounding and compact text antialiasing, so that saved-build comparison requires focus geometry within 0.02px and at most 2,000 perceptually differing pixels out of 2,073,600 at Pixelmatch threshold 0.1. Current classic/module parity retains the strict 20 raw pixels / zero significant pixels checks.

## Limits

Desktop Chrome with CPU throttling is not the Samsung TV's browser, CPU or GPU. Local checks cannot establish TV frame rate, GPU memory, cold-start behavior or native source-switch latency. Real hardware validation is still required before claiming perfect TV performance. The performance harness, instrumentation, comparison builds and screenshots stay outside the release bundle.

## Follow-up: native refresh scheduling and sampling

The second pass adds 727 B of minified JavaScript for bounded refresh scheduling and visible-data comparison. CSS, artwork, font files and all animation timings are unchanged from the preceding optimized build. The app remains below the tightened 29,800 B budget.

- Native app/source/info/running notifications coalesce into one 60ms batch. An unchanged visible catalogue, connection state and network label preserve every home row and card node. Non-favourite app changes, model/firmware diagnostics and IP-only changes do not rebuild the home.
- Volume feedback remains immediate. Other pending work is retained while navigating, holding OK, using an overlay, reordering apps, showing ambient mode or hiding the document. Explicit navigation/interaction/lifecycle completion hooks resume the queue; there is no polling loop.
- Resume-time native reads join the same queue. Pending work is not discarded by hiding the document or opening a menu.
- Equal HDMI cards receive updated native source descriptors without replacing DOM nodes. Their activation closures reference the current descriptor, so switching uses the latest native handle.
- At scene quality 4, the optional JavaScript frame sampler does not start: it cannot downgrade quality further. In-flight sampling also stops on reduced motion, quality 4 or document hiding. CSS animation and transition settings are unchanged.

The refresh unit tests cover coalescing, visible versus non-visible changes, each deferral condition and fresh source handles. The browser suite checks real callback/DOM behavior, navigation/menu/ambient resumption, direct HDMI activation with an updated handle, and zero sampling callbacks at quality 4 with full motion enabled. Both classic and direct-module entries execute these checks. A saved-build comparison uses `.local/performance-refresh-before` for this pass.

The repeatable performance script additionally records how often 20 identical native info notifications rebuild the home. The current build asserts zero rebuilds. No runtime performance instrumentation was added to the release bundle.

## Follow-up: style invalidation, stable layers and fitted artwork

This pass raises the app.js budget to 31,200 B (+1.3 KB) for artwork fitting. CSS shrinks slightly.

- Pause rules no longer end in `#underwater *` or `#root *`. A class toggle with a universal descendant selector invalidated style for the whole document. The navigation, level, overlay and hidden-document pauses now name the animated classes. The CSS pause of background animations during navigation is removed: stopping and restarting them on each key burst made the scene stutter. Compositor animations do not compete with main-thread key handling. The `navigating` class and refresh deferral remain.
- Layer hints are stable instead of following focus. The focused face no longer gains `will-change` on each key: that created and rasterized a new layer per press and drew the scaled card from a 1× raster. The focus ring's opacity transition, which promoted a second layer per press, is also removed. Every row track keeps one layer. The scene keeps its layer in reduced motion, so scrolling and focus changes no longer repaint the full-screen artwork behind the cards. Frozen decoration is still flattened into the scene layer. Reduced motion now reports six explicit hints: the scene and five tracks.
- Native icons with a square or margined shape are fitted to the wide card once per icon URL; see [artwork](artwork.md). Rebuilds reuse the fitted image, so cards do not flash the letterboxed original.

Local diagnostic: an 18-key navigation run used headless Chrome with software raster at 6× CPU slowdown, reporting the median of three runs. In reduced motion (the TV default), raster time fell from 154 ms to 115 ms and style-recalculated elements from 2,265 to 847. Whole-document recalculations fell from six to two. In full motion, rasterized tiles fell from 1,646 to 1,366. Returning from a compact row is pixel-identical to the initial row, so the persistent track layers do not blur. These numbers are single-machine diagnostics, not TV measurements.

## Follow-up: motion pass

Motion was retuned to feel quicker and more physical, using only transform and opacity. CSS grows to 23,278 B (budget 23,400 B); app.js grows by about 170 B.

- Focus lifts with a 280ms spring that overshoots slightly, then settles in 200ms. The focused card gains a top-lit gloss and a soft shadow. Pressing OK dips it to 1.05× before it springs back. The selected name follows 60ms after the card.
- Tracks glide in 260ms with an ease-out that starts fast. Rows and compact scaling take 380ms. The scene trails at 560ms, giving parallax depth on level changes. Inputs pickers use the same curve.
- The home has a staggered entrance at boot, on return from an app and after waking from ambient mode. It lasts about one second. Any key ends it immediately, so input is never delayed. Ambient mode fades in with a rising clock.
- Reduce motion disables all of the above. It also drops the blurred focus shadow, the costliest focus paint, so the TV default matches the previous build's raster cost (118 ms vs 127 ms in the 18-key software-raster diagnostic). In full motion, rasterized tiles fell from 1,358 to 1,118. Style work per run rose by about a third because transitions run longer.
- Full motion is now the TV default. New profiles start with Reduce motion off. A one-time `fullMotion` migration clears the Reduce motion setting that `fastDefaults` previously forced on every TV profile. Afterwards the toggle is the user's again, and a later choice to turn it on is kept. Scene quality stays at tier 4, so the camera, cloud, wave and star animations remain frozen on the TV, and the frame sampler stays off. Only focus, scrolling, row, entrance and overlay motion runs.
