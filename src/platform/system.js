import { adapter, tizen } from './state.js';
import { readSafely, recordReadResult } from './operations.js';
import { browser } from '../browser.js';

/**
 * Product, network and volume reads; refresh orchestration.
 */
adapter.refreshInfo = function () {
  if (!tizen) return;
  readSafely('volume', function () {
    adapter.info.volume = tizen.tvaudiocontrol.getVolume();
    adapter.info.mute = tizen.tvaudiocontrol.isMute();
    recordReadResult('volume', true);
  });
  var webapis = browser.webapis;
  readSafely('productInfo', function () {
    if (!webapis || !webapis.productinfo) throw new Error('Unsupported');
    adapter.info.model = webapis.productinfo.getModel();
    adapter.info.firmware = webapis.productinfo.getFirmware();
    recordReadResult('productInfo', true);
  });
  readSafely('network', function () {
    if (!webapis || !webapis.network) throw new Error('Unsupported');
    var n = webapis.network,
      type = n.getActiveConnectionType();
    adapter.info.network = { type: type, connected: type !== 0, ip: type ? n.getIp() : null };
    recordReadResult('network', true);
  });
  adapter.onChange('info');
};

adapter.refresh = function () {
  adapter.refreshRunning();
  adapter.refreshSources();
  adapter.refreshInfo();
};
