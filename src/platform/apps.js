import { adapter, deviceConfig, tizen } from './state.js';
import { readSafely, recordReadFailure, recordReadResult } from './operations.js';

/**
 * Installed apps, icon validation and running-app context reads.
 */
export function validateIconPath(path) {
  return typeof path === 'string' && /^(file:|wgt:|widget:|\/)/.test(path) ? path : '';
}

adapter.refreshApps = function (done) {
  if (!tizen) {
    done && done();
    return;
  }
  readSafely('apps', function () {
    tizen.application.getAppsInfo(
      function (list) {
        var own = tizen.application.getCurrentApplication().appInfo.id,
          all = [],
          i,
          a;
        for (i = 0; i < list.length; i++) {
          a = list[i];
          if (a.id === own) continue;
          // System IDs are discovered when available; device-verified fallbacks are retained.
          if (/^(FirstScreen|Smart Hub|Samsung Home)$/i.test(a.name)) adapter.system.home = a.id;
          if (/^(Settings|TV settings|Samsung settings)$/i.test(a.name))
            adapter.system.settings = a.id;
          if (/^(TV|Live TV|TV Viewer)$/i.test(a.name)) adapter.system.tv = a.id;
          if (
            a.show !== false &&
            a.name &&
            a.id &&
            (deviceConfig.launchableAppIds.indexOf(a.id) >= 0 || /^[a-zA-Z0-9]{10}\./.test(a.id))
          )
            all.push({
              id: a.id,
              name: a.name,
              icon:
                (deviceConfig.iconFallbacks && deviceConfig.iconFallbacks[a.id]) ||
                validateIconPath(a.iconPath)
            });
        }
        adapter.apps = all;
        recordReadResult('apps', true, all.length);
        try {
          localStorage.setItem('coast.apps', JSON.stringify(all));
        } catch (e) {}
        adapter.onChange('apps');
        done && done();
      },
      function (e) {
        recordReadFailure('apps', e);
        adapter.onChange('apps');
        done && done();
      }
    );
  });
};

adapter.refreshRunning = function () {
  if (!tizen) return;
  readSafely('runningApps', function () {
    tizen.application.getAppsContext(
      function (list) {
        var ids = {},
          i;
        for (i = 0; i < list.length; i++) ids[list[i].appId] = true;
        adapter.running = ids;
        recordReadResult('runningApps', true, list.length);
        adapter.onChange('running');
      },
      function (e) {
        recordReadFailure('runningApps', e);
      }
    );
  });
};
