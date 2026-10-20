import { adapter, deviceConfig, tizen } from './state.js';
import { browser } from '../browser.js';

/**
 * Key capability registration, initial discovery and cached app startup.
 */
adapter.init = function () {
  if (!tizen) return;
  var names = [
      'ColorF0Red',
      'ColorF1Green',
      'ColorF2Yellow',
      'ColorF3Blue',
      'MediaPlayPause',
      'Info',
      'ChannelUp',
      'ChannelDown',
      'Source',
      'Tools',
      'Settings'
    ],
    i;
  for (i = 0; i < names.length; i++)
    (function (name) {
      try {
        var key = tizen.tvinputdevice.getKey(name);
        if (!key) {
          adapter.report.keys[name] = 'unavailable';
          return;
        }
        tizen.tvinputdevice.registerKey(name);
        adapter.keys[key.code] = name;
        adapter.report.keys[name] = key.code;
      } catch (e) {
        adapter.report.keys[name] = e.name;
      }
    })(names[i]);
  adapter.refreshApps();
  adapter.refresh();
};

try {
  var cache = JSON.parse(localStorage.getItem('coast.apps') || '[]');
  if (Array.isArray(cache))
    adapter.apps = cache.filter(function (a) {
      return deviceConfig.launchableAppIds.indexOf(a.id) >= 0 || /^[a-zA-Z0-9]{10}\./.test(a.id);
    });
} catch (e) {}

browser.CoastPlatform = adapter;
