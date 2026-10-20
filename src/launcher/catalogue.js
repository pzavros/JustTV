import { platform, strings } from './environment.js';
import { state } from './state.js';
import { openInputs } from './views/inputs.js';
import { handleLaunchResult, handleSettingsResult } from './actions.js';
import { openSourceVisibility } from './customization.js';

/**
 * Filtered app/source catalogues and presentation metadata; platform owns native discovery.
 */
export function appBrand(a) {
  var n = a.name.toLowerCase();
  if (/youtube/.test(n)) return ['#E1252B', '#fff', 'play'];
  if (/netflix/.test(n)) return ['#151515', '#fff', 'play'];
  if (/prime/.test(n)) return ['#1A7AB8', '#fff', 'play'];
  if (/spotify/.test(n)) return ['#1ED760', '#0B0B0D', 'sound'];
  if (/plex/.test(n)) return ['#1F1F22', '#F2B230', 'play'];
  if (/browser|internet/.test(n)) return ['#F2F2F4', '#0B0B0D', 'browser'];
  return ['#2A2D3A', '#fff', 'apps'];
}

export function listAllApps() {
  return platform.apps.filter(function (a) {
    return !!a.id && !!a.name;
  });
}

export function listFavoriteApps() {
  var all = listAllApps(),
    map = {},
    list = [],
    i,
    a,
    n,
    used = {};
  all.forEach(function (a) {
    map[a.id] = a;
  });
  if (state.activeProfile.order === null || !state.activeProfile.order) {
    var preferred = [
      /^youtube$/i,
      /^netflix$/i,
      /^prime video$/i,
      /^spotify(?: |$)/i,
      /^plex$/i,
      /^(?:browser|internet)$/i,
      /^(?:hbo max|max)$/i,
      /^apple tv$/i
    ];
    preferred.forEach(function (rx) {
      for (var j = 0; j < all.length; j++)
        if (rx.test(all[j].name) && !used[all[j].id]) {
          list.push(all[j]);
          used[all[j].id] = true;
          break;
        }
    }); /* Live TV is a source, never an invented installed app. */
  } else
    for (i = 0; i < state.activeProfile.order.length; i++) {
      a = map[state.activeProfile.order[i]];
      if (a) list.push(a);
    }
  return list.filter(function (a) {
    return state.activeProfile.hidden.indexOf(a.id) < 0;
  });
}

export function listSourceTiles() {
  var list = platform.sources
    .filter(function (a) {
      return state.activeProfile.sourceHidden.indexOf(a.id) < 0;
    })
    .map(function (a) {
      return {
        id: a.id,
        name: state.activeProfile.renames[a.id] || a.name,
        sub: a.type === 'TV' ? strings.antenna : a.type + (a.number ? ' ' + a.number : ''),
        hint: strings.holdRename,
        icon: a.type === 'TV' ? 'tv' : a.type === 'USB' ? 'usb' : 'hdmi',
        source: a,
        connected: a.connected,
        action: function () {
          openInputs(a.id);
        }
      };
    });
  if (!list.length)
    list.push({
      id: 'sources',
      name: strings.sources,
      sub: '',
      hint: strings.sourceFallback,
      icon: 'hdmi',
      action: openInputs
    });
  list.push({
    id: 'usb-menu',
    name: strings.usb,
    sub: strings.sources,
    hint: strings.sourceFallback,
    icon: 'usb',
    action: function () {
      platform.sourceMenu(handleLaunchResult);
    }
  });
  list.push({
    id: 'share-menu',
    name: strings.share,
    sub: strings.wireless,
    hint: strings.sourceFallback,
    icon: 'share',
    action: function () {
      platform.sourceMenu(handleLaunchResult);
    }
  });
  list.push({
    id: 'manage-sources',
    name: strings.manageInputs,
    sub: '',
    hint: strings.holdRename,
    icon: 'eye',
    action: openSourceVisibility
  });
  return list;
}

export function systemSettingTile(label, icon) {
  return {
    name: label,
    sub: label,
    value: '',
    icon: icon,
    hint: strings.inSamsung,
    action: function () {
      platform.settings(handleSettingsResult);
    }
  };
}
