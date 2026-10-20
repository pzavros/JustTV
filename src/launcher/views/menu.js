import { escapeHtml } from './html.js';
import { strings } from '../environment.js';
import { closeOverlay, openOverlay } from '../overlays.js';

/** Menu and message view composition using the shared overlay controller. */
export function openMenu(title, options, note, selectedIndex) {
  var items = [],
    html =
      '<section class="menu-panel"><h1>' +
      escapeHtml(title) +
      '</h1>' +
      (note ? '<p>' + escapeHtml(note) + '</p>' : '') +
      '<div class="menu-list"><div id="menu-scroll">';
  options.forEach(function (o, i) {
    html +=
      '<button tabindex="-1" data-oi="' +
      i +
      '" class="menu-item"><span>' +
      escapeHtml(o.label) +
      '</span><small>' +
      escapeHtml(o.sub || '') +
      '</small></button>';
    items.push({ row: i, x: 500, action: o.action, hold: o.hold });
  });
  html +=
    '</div></div><div class="menu-note">' +
    strings.back +
    ' · ' +
    strings.close +
    '</div></section>';
  openOverlay({ type: 'menu', html: html, items: items, index: selectedIndex || 0 });
}

export function showMessage(title, text) {
  openMenu(title, [{ label: strings.close, action: closeOverlay }], text);
}
