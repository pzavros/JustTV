import { platform, strings } from '../environment.js';
import { state } from '../state.js';
import { contextMenu, handleLaunchResult, getSourceName } from '../actions.js';
import { escapeHtml, renderIcon } from './html.js';
import { closeAllOverlays, openOverlay } from '../overlays.js';

/**
 * Build the source picker from real adapter data.
 */
export function openInputs(id) {
  var list = platform.sources.filter(function (s) {
    return state.activeProfile.sourceHidden.indexOf(s.id) < 0;
  });
  if (!list.length) {
    platform.sourceMenu(handleLaunchResult);
    return;
  }
  var content =
      '<h1 class="overlay-title">' +
      strings.inputTitle +
      '</h1><div class="overlay-track" id="input-track">',
    items = [];
  list.forEach(function (a, i) {
    content +=
      '<button tabindex="-1" class="source-picker" data-oi="' +
      i +
      '"><div class="source-top"><span class="port">' +
      escapeHtml(a.type === 'TV' ? strings.antenna : a.type + ' ' + a.number) +
      '</span><span class="state"><i class="status-dot ' +
      (a.connected ? 'on' : '') +
      '"></i>' +
      escapeHtml(a.connected ? strings.connected : strings.disconnected) +
      '</span></div>' +
      renderIcon(a.type === 'TV' ? 'tv' : 'hdmi') +
      '<div><div class="tile-name">' +
      escapeHtml(getSourceName(a)) +
      '</div><div class="sub">' +
      escapeHtml(a.connected ? strings.switchSource : strings.holdRename) +
      '</div></div></button>';
    items.push({
      row: 0,
      x: i * 328 + 150,
      action: function () {
        platform.switchSource(a, function (e) {
          if (e) handleLaunchResult(e);
          else closeAllOverlays();
        });
      },
      hold: function () {
        contextMenu({ source: a, id: a.id, name: getSourceName(a) });
      }
    });
  });
  content +=
    '</div><div class="overlay-footer"><span><b class="keycap">' +
    strings.ok +
    '</b> ' +
    strings.switchSource +
    '</span><span><b class="keycap">HOLD OK</b> ' +
    strings.holdRename +
    '</span><span><b class="keycap">BACK</b> ' +
    strings.close +
    '</span></div>';
  openOverlay({
    type: 'inputs',
    html: content,
    items: items,
    index: Math.max(
      0,
      list
        .map(function (a) {
          return a.id;
        })
        .indexOf(id)
    )
  });
}
