import { state } from './state.js';
import { platform, strings } from './environment.js';
import { appBrand, listFavoriteApps } from './catalogue.js';
import { renderHome } from './views/home.js';

/** Compare visible native data, excluding diagnostics and opaque native source handles. */
export function homeDataSignature() {
  var network = platform.info.network;
  return JSON.stringify([
    listFavoriteApps().map(function (app) {
      return [app.id, app.name, appBrand(app)[3] || app.icon];
    }),
    platform.sources
      .filter(function (source) {
        return state.activeProfile.sourceHidden.indexOf(source.id) < 0;
      })
      .map(function (source) {
        return [source.id, source.name, source.type, source.number, source.connected];
      }),
    network && network.connected ? (network.type === 1 ? 'Wi-Fi' : strings.network) : '',
    network && network.connected ? strings.connected : strings.unknown
  ]);
}

/** One pending batch, resumed by interaction/lifecycle boundaries rather than polling. */
export function schedulePlatformRefresh() {
  if (
    !state.pendingPlatformChanges ||
    state.platformRefreshTimer ||
    document.hidden ||
    state.navigating ||
    state.activeOverlay ||
    state.moving ||
    state.ambient ||
    state.enterDown
  )
    return;
  state.platformRefreshTimer = setTimeout(flushPlatformRefresh, 60);
}

export function queuePlatformRefresh(nativeRead) {
  state.pendingPlatformChanges |= nativeRead ? 2 : 1;
  schedulePlatformRefresh();
}

export function flushPlatformRefresh() {
  state.platformRefreshTimer = 0;
  if (
    document.hidden ||
    state.navigating ||
    state.activeOverlay ||
    state.moving ||
    state.ambient ||
    state.enterDown
  )
    return;
  var pending = state.pendingPlatformChanges;
  state.pendingPlatformChanges = 0;
  if (pending & 2) platform.refresh();
  if (!(pending & 1)) return;
  if (homeDataSignature() !== state.renderedPlatformData) {
    renderHome();
    return;
  }
  // Source handles may change without changing their card; keep activation current.
  state.rows[1].items.forEach(function (tile) {
    if (!tile.source) return;
    for (var i = 0; i < platform.sources.length; i++) {
      if (platform.sources[i].id === tile.id) {
        tile.source = platform.sources[i];
        break;
      }
    }
  });
  state.rows[0].items.forEach(function (tile, index) {
    var dot = state.rows[0].buttons[index].querySelector('.running-dot'),
      hidden = !platform.running[tile.id];
    if (dot && dot.hidden !== hidden) dot.hidden = hidden;
  });
}
