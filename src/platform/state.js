import { browser } from '../browser.js';

/**
 * Tizen adapter state and device-verified configuration; no UI ownership.
 */
('use strict');

export var strings = browser.COAST_STRINGS,
  deviceConfig = browser.COAST_DEVICE,
  tizen = browser.tizen,
  adapter = {
    tv: !!tizen,
    apps: [],
    sources: [],
    running: {},
    keys: {},
    report: { reads: {}, keys: {}, writes: {} },
    system: deviceConfig.verifiedSystemApps,
    info: { model: deviceConfig.model, firmware: null, network: null, volume: null, mute: null },
    onChange: function () {}
  };
