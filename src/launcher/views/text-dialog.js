import { escapeHtml } from './html.js';
import { byId, strings } from '../environment.js';
import { closeOverlay, openOverlay } from '../overlays.js';

/** Text-entry view with the existing focus and save/cancel actions. */
export function textDialog(title, value, done) {
  var html =
    '<section class="menu-panel"><h1>' +
    escapeHtml(title) +
    '</h1><input id="name-field" data-oi="0" class="field" maxlength="40" value="' +
    escapeHtml(value) +
    '" aria-label="' +
    escapeHtml(title) +
    '"><div class="menu-actions"><button class="control-button" data-oi="1" tabindex="-1">' +
    strings.save +
    '</button><button class="control-button" data-oi="2" tabindex="-1">' +
    strings.cancel +
    '</button></div></section>';
  openOverlay({
    type: 'text',
    html: html,
    items: [
      {
        row: 0,
        x: 450,
        action: function () {
          byId('name-field').focus();
        }
      },
      {
        row: 1,
        x: 200,
        action: function () {
          var v = byId('name-field').value.replace(/^\s+|\s+$/g, '');
          if (v) done(v);
        }
      },
      { row: 1, x: 700, action: closeOverlay }
    ]
  });
}
