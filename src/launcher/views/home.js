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
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].onerror = iconError;
    imgs[i].onload = fitArtwork;
    // Reuse artwork fitted before this rebuild, so cards never flash the letterboxed icon.
    if (fittedArtwork[imgs[i].getAttribute('src')]) fitArtwork.call(imgs[i]);
  }
}

// Fitted card artwork by original icon URL; '' marks icons that are kept as drawn.
var fittedArtwork = {};

/** Fill the wide card with a square or transparent-margined raster icon, once per icon URL. */
export function fitArtwork() {
  var src = this.getAttribute('src'),
    url = fittedArtwork[src];
  if (/^data:|\.svg$/i.test(src)) return;
  if (url == null) url = fittedArtwork[src] = this.naturalWidth ? drawFittedArtwork(this) : '';
  if (!url) return;
  this.parentNode.classList.add('filled');
  this.src = url;
}

/**
 * Trim transparent margins, then edge-extend opaque tiles to the focused card size.
 * Transparent logos are trimmed and centered instead. A tainted canvas keeps the original.
 */
export function drawFittedArtwork(img) {
  var w = img.naturalWidth,
    h = img.naturalHeight,
    k = Math.min(1, 128 / Math.max(w, h)),
    sw = Math.max(1, Math.round(w * k)),
    sh = Math.max(1, Math.round(h * k)),
    canvas = document.createElement('canvas'),
    g = canvas.getContext('2d'),
    data,
    x,
    y,
    left = sw,
    right = -1,
    top = sh,
    bottom = -1;
  canvas.width = sw;
  canvas.height = sh;
  try {
    g.drawImage(img, 0, 0, sw, sh);
    data = g.getImageData(0, 0, sw, sh).data;
  } catch (e) {
    return '';
  }
  for (y = 0; y < sh; y++)
    for (x = 0; x < sw; x++)
      if (data[(y * sw + x) * 4 + 3] > 24) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  if (right < 0) return '';
  function opaque(col) {
    var n = 0;
    for (y = top; y <= bottom; y++) if (data[(y * sw + col) * 4 + 3] > 200) n++;
    return n / (bottom - top + 1) > 0.6;
  }
  // Opaque edges on both sides mean a full-bleed tile; anything else is a transparent logo.
  var tile = opaque(left) && opaque(right),
    bx = left / k,
    by = top / k,
    bw = (right - left + 1) / k,
    bh = (bottom - top + 1) / k,
    // The focused face is 312x176 at scale(1.12). Tiles fill its height; logos keep a margin.
    W = 350,
    H = 198,
    s = tile ? H / bh : Math.min((W * 0.8) / bw, (H * 0.7) / bh),
    dw = bw * s,
    dh = bh * s,
    dx = (W - dw) / 2,
    dy = (H - dh) / 2,
    rowHeight = H / (bottom - top + 1),
    side,
    colour;
  function edgeColour(row, fromRight) {
    for (x = fromRight ? right : left; x >= left && x <= right; x += fromRight ? -1 : 1) {
      var i = (row * sw + x) * 4;
      if (data[i + 3] > 200) return 'rgb(' + data[i] + ',' + data[i + 1] + ',' + data[i + 2] + ')';
    }
    return '';
  }
  canvas.width = W;
  canvas.height = H;
  // Extend each row's outermost opaque pixel under the icon, so rounded corners blend too.
  // The middle row's colour covers antialiased rows that have no opaque pixel.
  if (tile)
    for (side = 0; side < 2; side++) {
      g.fillStyle = edgeColour((top + bottom) >> 1, side) || '#000';
      g.fillRect(side * (W / 2), 0, W / 2, H);
      for (y = top; y <= bottom; y++) {
        colour = edgeColour(y, side);
        if (!colour) continue;
        g.fillStyle = colour;
        g.fillRect(side * (W / 2), (y - top) * rowHeight, W / 2, rowHeight + 1);
      }
    }
  g.drawImage(img, bx, by, bw, bh, dx, dy, dw, dh);
  return canvas.toDataURL(tile ? 'image/jpeg' : 'image/png', 0.92);
}

export function iconError() {
  var appid = this.parentNode.parentNode && this.parentNode.parentNode.getAttribute('data-index'),
    item = state.rows[0] && state.rows[0].items[+appid],
    fallback = item && browser.COAST_DEVICE.iconFallbacks[item.id];
  if (fallback && this.getAttribute('src') !== fallback) {
    this.src = fallback;
    return;
  }
  this.parentNode.classList.remove('has-artwork', 'filled');
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
