# TV launcher architecture research

Reviewed 20 October 2026. These references guide the local refactor; they do not establish that every API or feature is supported on this particular 2021 TV.

| Primary source | Relevant guidance | JustTV decision |
| --- | --- | --- |
| [Samsung Design Principles](https://developer.samsung.com/smarttv/design/design-principles.html) | Visible, consistent focus and predictable directional navigation | One focus owner and one overlay navigation model |
| [Samsung Remote Control](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html) | TV interaction is key-driven, with model-dependent key support | Keep key registration inside the adapter and route events centrally |
| [Samsung Application Performance Improvement](https://developer.samsung.com/smarttv/develop/guides/application-performance-improvement/application-performance-improvement.html) | Limit startup script loading and avoid unnecessary layout/reflow work | Statically link ES modules into existing bundles; preserve the geometric focus path |
| [Samsung Launch Time Optimization](https://developer.samsung.com/smarttv/develop/guides/application-performance-improvement/launch-time-optimization.html) | Treat loading, initialization and first rendering as separate launch costs | Keep first-frame rendering separate from deferred native reads and weather |
| [Samsung Multitasking](https://developer.samsung.com/smarttv/develop/guides/fundamentals/multitasking.html) | Handle visibility changes and refresh connectivity on resume; low-memory devices have limits | Keep lifecycle ownership explicit; make no new warm-resume guarantee |

## Architecture conclusion

The sources support TV-specific constraints, rather than mandating a particular MVC/MVVM framework. For this small launcher, the useful separation is between input/focus, view construction, feature actions, persisted preferences, asynchronous services, and native capabilities. That is our architectural judgment based on those constraints and the existing implementation.

A new framework or reactive state system is unnecessary for this refactor. It would change the runtime being protected. Explicit ES module interfaces and build-time linking provide ownership and readable names without adding per-event dispatch, wrappers or subscriptions to the TV.

The device's existing ES5 compatibility, stationary native focus, raster artwork, native API fallbacks and cached startup behavior come from this project's earlier device verification. They are preserved here, not revalidated through a new TV connection.

## Build-only HTML formatting

The [HTML Minifier Terser documentation](https://github.com/terser/html-minifier-terser#options-quick-reference) describes opt-in whitespace handling and JS/CSS callbacks. This project uses it only during compilation, with equality checks against the unchanged document. It adds no TV dependency.

The browser test uses [Pixelmatch](https://github.com/mapbox/pixelmatch#pixelmatchimg1-img2-output-width-height-options) for antialias-aware image comparison and [PNGJS](https://github.com/pngjs/pngjs#sync-api) for decoding. These are test dependencies only; exact DOM/geometry and structural runtime checks remain separate gates.
