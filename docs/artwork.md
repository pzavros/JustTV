# App artwork

Bundled logos are loaded locally; runtime navigation never fetches brand assets.

- `spotify.svg`: Spotify, [logo with text](https://commons.wikimedia.org/wiki/File:Spotify_logo_with_text.svg), original from Spotify's page source, listed as PD-textlogo by Wikimedia Commons. Includes the circle and wordmark. Saved without modification.
- `hbo-max.svg`: Warner Bros. Discovery, [HBO Max (2025)](https://commons.wikimedia.org/wiki/File:HBO_Max_(2025).svg), vector by LucasJance2006 and Lee6597, listed as PD-textlogo by Wikimedia Commons. Saved without modification.

Both remain trademarks of their respective owners. Asset hashes are pinned separately in `tests/fixtures/ui-assets.json`; historical fixtures remain unchanged.

Spotify and HBO Max/Max get bundled artwork by their original catalogue names, so profile renames preserve the brand. HBO Max appears in favourites when native discovery finds it. The local preview adds a clearly synthetic catalogue identity, `DemoApp001.hbomax`, for UI review; no TV package identity or installation is invented.
