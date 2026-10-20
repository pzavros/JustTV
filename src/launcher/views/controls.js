import { byId, platform, strings } from '../environment.js';
import { showMessage } from './menu.js';
import { browser } from '../../browser.js';
import { escapeHtml } from './html.js';
import { closeOverlay, openOverlay } from '../overlays.js';
import { handleSettingsResult } from '../actions.js';
import { showToast } from '../presentation.js';

/**
 * Network/About panels, native settings fallbacks and volume controls.
 */
export function openNetwork() {
  var n = platform.info.network;
  showMessage(
    strings.network,
    n
      ? n.connected
        ? strings.connected + (n.ip ? ' · ' + n.ip : '')
        : strings.disconnected
      : strings.noNetwork
  );
}

export function openAbout() {
  showMessage(
    strings.about,
    (browser.COAST_DEVICE.model || platform.info.model || strings.aboutSubtitle) +
      '\n' +
      strings.firmware +
      ': ' +
      (platform.info.firmware || strings.unknownFirmware) +
      '\n' +
      strings.version +
      ': 2.0.0\n' +
      strings.aboutNote
  );
}

export function openControls() {
  var items = [],
    index = 0,
    html = '<aside class="panel"><h1>' + strings.controls + '</h1>';
  function controlButton(label, row, x, fn, cls) {
    var i = index++;
    items.push({ row: row, x: x, action: fn });
    return (
      '<button tabindex="-1" data-oi="' +
      i +
      '" class="control-button ' +
      (cls || '') +
      '">' +
      escapeHtml(label) +
      '</button>'
    );
  }
  html += controlButton('×', 0, 500, closeOverlay, 'close-control');
  var r = 1;
  if (platform.info.volume !== null) {
    html +=
      '<section class="control-block"><h2>' +
      strings.volume +
      '<span class="volume" id="volume-number">' +
      platform.info.volume +
      '</span></h2><div class="control-row">' +
      controlButton(
        '−',
        r,
        0,
        function () {
          platform.volume(-1, handleVolumeResult);
        },
        'volume-button'
      ) +
      '<div class="volume-track"><div id="volume-fill" class="volume-fill" style="transform:scaleX(' +
      platform.info.volume / 100 +
      ')"></div></div>' +
      controlButton(
        '+',
        r,
        500,
        function () {
          platform.volume(1, handleVolumeResult);
        },
        'volume-button'
      ) +
      '</div><div style="margin-top:12px">' +
      controlButton(
        platform.info.mute ? strings.unmute : strings.mute,
        r + 1,
        250,
        function () {
          platform.volume(0, handleVolumeResult);
        },
        'wide'
      ) +
      '</div></section>';
    r += 2;
  }
  [
    [strings.picture, strings.pictureModes],
    [strings.sound, strings.soundOutputs],
    [strings.sleep, strings.sleepModes]
  ].forEach(function (group) {
    html +=
      '<section class="control-block"><h2>' + group[0] + '</h2><div class="settings-fallback">';
    group[1].forEach(function (label, i) {
      html += controlButton(label, r, i * 140, function () {
        platform.settings(handleSettingsResult);
      });
    });
    html += '</div></section>';
    r++;
  });
  html +=
    '<p class="menu-note">' +
    strings.nativeControls +
    '</p><div class="all-settings">' +
    controlButton(
      strings.allSettings,
      r,
      250,
      function () {
        platform.settings(handleSettingsResult);
      },
      'wide'
    ) +
    '</div></aside>';
  openOverlay({ type: 'controls', html: html, items: items });
}

export function handleVolumeResult(e) {
  if (e) {
    showToast(strings.volumeUnavailable);
    return;
  }
  if (byId('volume-number')) byId('volume-number').textContent = platform.info.volume;
  if (byId('volume-fill'))
    byId('volume-fill').style.transform = 'scaleX(' + platform.info.volume / 100 + ')';
}
