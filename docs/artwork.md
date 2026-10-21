# App artwork

Bundled logos are loaded locally; runtime navigation never fetches brand assets.

- `spotify.svg`: Spotify, [logo with text](https://commons.wikimedia.org/wiki/File:Spotify_logo_with_text.svg), original from Spotify's page source, listed as PD-textlogo by Wikimedia Commons. Includes the circle and wordmark. Saved without modification.
- `hbo-max.svg`: Warner Bros. Discovery, [HBO Max (2025)](https://commons.wikimedia.org/wiki/File:HBO_Max_(2025).svg), vector by LucasJance2006 and Lee6597, listed as PD-textlogo by Wikimedia Commons. Saved without modification.

Both remain trademarks of their respective owners. Asset hashes are pinned separately in `tests/fixtures/ui-assets.json`; historical fixtures remain unchanged.

Spotify and HBO Max/Max get bundled artwork by their original catalogue names, so profile renames preserve the brand. HBO Max appears in favourites when native discovery finds it. The local preview adds a clearly synthetic catalogue identity, `DemoApp001.hbomax`, for UI review; no TV package identity or installation is invented.

## Native icons

Native and fallback raster icons are usually square, so `object-fit: contain` left them as a smaller square inside the 312×176 card. After an icon loads, `fitArtwork` in `views/home.js` draws it once into a 350×198 canvas, the focused card size. Transparent margins are trimmed. Opaque tiles fill the card height, and each row's outermost colour is extended to the card edges, so solid colours, gradients and rounded corners blend into the card. Transparent logos are trimmed and centered at up to 70% of the card height over the brand colour. Bundled SVG logos are unchanged. If the canvas is tainted, the original icon is kept. The 104 px bundled fallback icons still upscale softly; higher-resolution files would sharpen them.

HBO Max uses a white card with the unmodified black logo. A live `invert()` filter was costly on the TV's CPU rasterizer. `focus-shadow.png` is a generated 9-slice focus shadow (200×200, card edge 40px inside), not brand artwork.
