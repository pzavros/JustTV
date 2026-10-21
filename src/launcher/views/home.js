import { homeDataSignature } from '../refresh.js';
import { state } from '../state.js';
import { buildHomeRows } from '../home-model.js';
import { escapeHtml } from './html.js';
import { renderTileMarkup } from './tiles.js';
import { byId, platform } from '../environment.js';
import { focusHome } from '../focus.js';
import { browser } from '../../browser.js';

/**
 * Render rows only when data changes; update individual values without rebuilding.
 */

export function renderHome() {
  var oldid =
    state.rows[state.homeFocus.row] &&
    state.rows[state.homeFocus.row].items[state.homeFocus.index] &&
    state.rows[state.homeFocus.row].items[state.homeFocus.index].id;
  buildHomeRows();
  var html = '';
  state.rows.forEach(function (r, ri) {
    html +=
      '<section class="row" id="row' +
      ri +
      '" aria-label="' +
      escapeHtml(r.title) +
      '"><h2>' +
      escapeHtml(r.title) +
      '</h2><div class="track-scale"><div class="track">' +
      r.items
        .map(function (it, i) {
          return renderTileMarkup(it, ri, i);
        })
        .join('') +
      '</div></div></section>';
  });
  clearTimeout(state.navMotionTimer);
  byId('root').classList.remove('navigating');
  byId('rows').innerHTML = html;
  state.lastRenderedLevel = -1;
  state.lastActiveRow = -1;
  ((state.focusedElement = null), (state.navMotionTimer = 0), (state.navigating = false));
  state.rows.forEach(function (r, ri) {
    r.el = byId('row' + ri);
    r.track = r.el.querySelector('.track');
    r.buttons = r.el.querySelectorAll('.tile');
    r.offset = 0;
  });
  if (oldid) {
    state.rows[state.homeFocus.row].items.some(function (it, i) {
      if (it.id === oldid) {
        state.homeFocus.index = i;
        return true;
      }
      return false;
    });
  }
  state.homeFocus.row = Math.max(0, Math.min(state.homeFocus.row, 4));
  state.homeFocus.index = Math.max(
    0,
    Math.min(state.homeFocus.index, state.rows[state.homeFocus.row].items.length - 1)
  );
  focusHome(state.homeFocus.row, state.homeFocus.index, true);
  state.renderedPlatformData = homeDataSignature();
  var imgs = byId('rows').querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) imgs[i].onerror = iconError;
}

export function iconError() {
  var appid = this.parentNode.parentNode && this.parentNode.parentNode.getAttribute('data-index'),
    item = state.rows[0] && state.rows[0].items[+appid],
    fallback = item && browser.COAST_DEVICE.iconFallbacks[item.id];
  if (fallback && this.getAttribute('src') !== fallback) {
    this.src = fallback;
    return;
  }
  this.parentNode.classList.remove('has-artwork');
  this.parentNode.removeChild(this);
  platform.report.iconFallbacks = (platform.report.iconFallbacks || 0) + 1;
}

export function updateValue(r, i, v) {
  state.rows[r].items[i].value = v;
  var b = state.rows[r].buttons[i];
  if (b) b.querySelector('.value').textContent = v;
  if (r === 3 && i === 2) {
    var sw = b.querySelectorAll('.swatches i');
    for (var j = 0; j < sw.length; j++)
      sw[j].className =
        !state.activeProfile.scene || state.activeProfile.scene === j + 1 ? 'on' : '';
  }
}
