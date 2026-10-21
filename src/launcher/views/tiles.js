import { escapeHtml, renderIcon } from './html.js';
import { platform } from '../environment.js';
import { state } from '../state.js';

/** Tile markup; no listeners, state mutation or native operations. */
export function renderTileMarkup(tile, rowIndex, tileIndex) {
  var face = '',
    name = escapeHtml(tile.name),
    inner;
  if (rowIndex === 0) {
    var brandName = (tile.originalName || tile.name).toLowerCase(),
      brandClass = /netflix/.test(brandName)
        ? ' netflix'
        : /spotify/.test(brandName)
          ? ' spotify'
          : /^(hbo\s*max|max)$/.test(brandName)
            ? ' hbomax'
            : /plex/.test(brandName)
              ? ' plex'
              : '';
    inner = tile.app
      ? '<span class="app-wordmark">' + escapeHtml(tile.originalName || tile.name) + '</span>'
      : renderIcon(tile.icon);
    if (tile.image)
      inner +=
        '<img class="app-artwork" alt="" src="' + escapeHtml(tile.image) + '" decoding="async">';
    face =
      '<div class="face appface' +
      brandClass +
      (tile.image ? ' has-artwork' : '') +
      '" style="background:' +
      tile.bg +
      ';color:' +
      tile.fg +
      '">' +
      inner +
      '<i class="running-dot" ' +
      (platform.running[tile.id] ? '' : 'hidden') +
      '></i></div><span class="app-label">' +
      name +
      '</span>';
  } else if (rowIndex === 1) {
    face =
      '<div class="face source-face' +
      (tile.connected === false ? ' empty' : '') +
      '"><div class="source-top">' +
      renderIcon(tile.icon) +
      '<i class="status-dot ' +
      (tile.connected === true ? 'on' : tile.connected == null ? 'unknown' : '') +
      '"></i></div><div><div class="tile-name">' +
      name +
      '</div><div class="sub">' +
      escapeHtml(tile.sub) +
      '</div></div></div>';
  } else if (rowIndex === 2) {
    face =
      '<div class="face quick-face">' +
      renderIcon(tile.icon) +
      '<div><div class="sub">' +
      name +
      '</div><div class="tile-name value">' +
      escapeHtml(tile.value || '') +
      '</div></div></div>';
  } else if (rowIndex === 3) {
    var sw = tile.scene
      ? '<span class="swatches">' +
        [1, 2, 3]
          .map(function (n) {
            return (
              '<i class="' +
              (!state.activeProfile.scene || state.activeProfile.scene === n ? 'on' : '') +
              '"></i>'
            );
          })
          .join('') +
        '</span>'
      : '';
    face =
      '<div class="face custom-face"><div class="custom-top">' +
      renderIcon(tile.icon) +
      sw +
      '</div><div><div class="sub">' +
      name +
      '</div><div class="tile-name value">' +
      escapeHtml(tile.value) +
      '</div></div></div>';
  } else {
    inner =
      tile.icon === 'colour'
        ? '<span class="colour-squares"><i></i><i></i><i></i><i></i></span>'
        : renderIcon(tile.icon);
    face =
      '<div class="face tv-face">' + inner + '<span class="tile-name">' + name + '</span></div>';
  }
  return (
    '<button type="button" tabindex="-1" class="tile" data-row="' +
    rowIndex +
    '" data-index="' +
    tileIndex +
    '" aria-label="' +
    name +
    '">' +
    face +
    '<span class="hint">' +
    escapeHtml(tile.hint || '') +
    '</span></button>'
  );
}
