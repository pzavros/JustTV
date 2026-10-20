import { browser } from '../browser.js';

/** Browser handles and read-only references shared by the launcher. */
export var strings = browser.COAST_STRINGS,
  platform = browser.CoastPlatform,
  byId = function (id) {
    return document.getElementById(id);
  },
  root = byId('root');
