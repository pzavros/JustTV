import { platform, strings } from './environment.js';
import { launchApp, handleLaunchResult, handleSettingsResult } from './actions.js';
import { appBrand, listFavoriteApps, listSourceTiles, systemSettingTile } from './catalogue.js';
import { state } from './state.js';
import {
  openAllApps,
  openProfiles,
  openShortcuts,
  openShowHide,
  startReorder
} from './customization.js';
import { openAbout, openControls, openNetwork } from './views/controls.js';
import { schedulePreferencesSave } from './preferences.js';
import { applyMotionPreferences, setScene } from './scene.js';
import { updateValue } from './views/home.js';
import { scheduleIdle } from './ambient.js';
import { showMessage } from './views/menu.js';

/**
 * Build the five row descriptors and bind each tile to its action.
 */
export function buildHomeRows() {
  var apps = [
    {
      id: 'live-source',
      name: strings.live,
      icon: 'tv',
      bg: '#2C3B8F',
      fg: '#fff',
      hint: strings.lastChannel,
      action: function () {
        var live = platform.sources.filter(function (s) {
          return s.type === 'TV';
        })[0];
        if (live) platform.switchSource(live, handleLaunchResult);
        else platform.sourceMenu(handleLaunchResult);
      }
    }
  ];
  listFavoriteApps().forEach(function (a) {
    var b = appBrand(a);
    apps.push({
      id: a.id,
      name: state.activeProfile.renames[a.id] || (/^Spotify/.test(a.name) ? 'Spotify' : a.name),
      originalName: a.name,
      icon: b[2],
      image: a.icon,
      bg: b[0],
      fg: b[1],
      hint: strings.openApps,
      app: a,
      action: function () {
        launchApp(a.id);
      }
    });
  });
  apps.push({
    id: 'all-apps',
    name: strings.allApps,
    icon: 'apps',
    bg: '#2A2D3A',
    fg: '#fff',
    hint: strings.openApps,
    action: openAllApps
  });
  apps.push({
    id: 'samsung-home',
    name: strings.samsung,
    icon: 'home',
    bg: '#1c263b',
    fg: '#fff',
    hint: strings.backAgain,
    action: function () {
      platform.samsung(handleLaunchResult);
    }
  });
  var quick = [
    systemSettingTile(strings.picture, 'picture'),
    systemSettingTile(strings.sound, 'sound'),
    systemSettingTile(strings.sleep, 'moon'),
    systemSettingTile(strings.wifi, 'wifi'),
    systemSettingTile(strings.bluetooth, 'bt'),
    {
      name: strings.controls,
      icon: 'settings',
      value: '',
      hint: strings.focusHint,
      action: openControls
    }
  ];
  if (platform.info.network && platform.info.network.connected)
    quick[3].value = platform.info.network.type === 1 ? 'Wi-Fi' : strings.network;
  var custom = [
    {
      name: strings.appRow,
      value: strings.reorder,
      icon: 'reorder',
      hint: strings.reorderHint,
      action: startReorder
    },
    {
      name: strings.appRow,
      value: strings.showHide,
      icon: 'eye',
      hint: strings.hideHint,
      action: openShowHide
    },
    {
      name: strings.scene,
      value: strings.sceneModes[state.activeProfile.scene || 0],
      icon: 'scene',
      hint: strings.sceneHint,
      scene: true,
      action: function () {
        state.activeProfile.scene = ((state.activeProfile.scene || 0) + 1) % 4;
        schedulePreferencesSave();
        setScene();
        updateValue(3, 2, strings.sceneModes[state.activeProfile.scene]);
      }
    },
    {
      name: strings.saver,
      value: strings.saverModes[state.activeProfile.saver == null ? 1 : state.activeProfile.saver],
      icon: 'moon',
      hint: strings.sceneHint,
      action: function () {
        state.activeProfile.saver =
          ((state.activeProfile.saver == null ? 1 : state.activeProfile.saver) + 1) % 4;
        schedulePreferencesSave();
        scheduleIdle();
        updateValue(3, 3, strings.saverModes[state.activeProfile.saver]);
      }
    },
    {
      name: strings.profiles,
      value: state.activeProfile.name,
      icon: 'profile',
      hint: strings.profileHint,
      action: openProfiles
    },
    {
      name: strings.reduceMotion,
      value: state.activeProfile.motion ? strings.on : strings.off,
      icon: 'motion',
      hint: strings.motionHint,
      action: function () {
        state.activeProfile.motion = !state.activeProfile.motion;
        schedulePreferencesSave();
        applyMotionPreferences();
        updateValue(3, 5, state.activeProfile.motion ? strings.on : strings.off);
      }
    }
  ];
  var tv = [
    { name: strings.shortcuts, icon: 'colour', hint: strings.focusHint, action: openShortcuts },
    {
      name: strings.network,
      icon: 'wifi',
      hint:
        platform.info.network && platform.info.network.connected
          ? strings.connected
          : strings.unknown,
      action: openNetwork
    },
    {
      name: strings.settings,
      icon: 'settings',
      hint: strings.inSamsung,
      action: function () {
        platform.settings(handleSettingsResult);
      }
    },
    { name: strings.about, icon: 'info', hint: strings.model, action: openAbout },
    {
      name: strings.power,
      icon: 'power',
      hint: strings.powerHint,
      action: function () {
        showMessage(strings.power, strings.powerHint);
      },
      hold: function () {
        showMessage(strings.restart, strings.restartHint);
      }
    },
    {
      name: strings.samsung,
      icon: 'home',
      hint: strings.backAgain,
      action: function () {
        platform.samsung(handleLaunchResult);
      }
    }
  ];
  state.rows = [
    { title: strings.apps, kind: 'apps', items: apps },
    { title: strings.inputs, kind: 'inputs', items: listSourceTiles() },
    { title: strings.quick, kind: 'quick', items: quick },
    { title: strings.custom, kind: 'custom', items: custom },
    { title: strings.tv, kind: 'tv', items: tv }
  ];
}
