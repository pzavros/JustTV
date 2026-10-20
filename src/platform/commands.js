import { adapter, tizen } from './state.js';
import { readSafely, recordReadFailure } from './operations.js';

/**
 * App launch, Samsung Home/Settings, source switching and volume commands.
 */
adapter.launch = function (id, done) {
  if (!tizen) {
    done && done({ name: 'Preview' });
    return;
  }
  try {
    tizen.application.launch(
      id,
      function () {
        adapter.report.writes.launch = 'ok';
        done && done();
      },
      function (e) {
        adapter.report.writes.launch = e.name;
        done && done(e);
      }
    );
  } catch (e) {
    recordReadFailure('launch', e);
    done && done(e);
  }
};

adapter.samsung = function (done) {
  adapter.launch(adapter.system.home, done);
};

adapter.settings = function (done) {
  if (!tizen) {
    done && done({ name: 'Preview' });
    return;
  }
  try {
    var uri = adapter.system.settingsUri;
    tizen.application.launchAppControl(
      new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', uri, null, null, [
        new tizen.ApplicationControlData('uri', [uri])
      ]),
      adapter.system.settings,
      function () {
        adapter.report.writes.settings = 'ok';
        done && done();
      },
      function (e) {
        adapter.report.writes.settings = e.name;
        done && done(e);
      }
    );
  } catch (e) {
    done && done(e);
  }
};

adapter.sourceMenu = function (done) {
  if (!tizen) {
    done && done({ name: 'Preview' });
    return;
  }
  readSafely('sourceMenu', function () {
    var data = [new tizen.ApplicationControlData('entry_point', ['source_key'])];
    tizen.application.launchAppControl(
      new tizen.ApplicationControl(
        'http://tizen.org/appcontrol/operation/default',
        null,
        null,
        null,
        data
      ),
      adapter.system.home,
      function () {
        adapter.report.writes.sourceMenu = 'ok';
        done && done();
      },
      function (e) {
        adapter.report.writes.sourceMenu = e.name;
        adapter.samsung(done);
      }
    );
  });
};

adapter.switchSource = function (source, done) {
  if (!tizen || !source.raw) {
    adapter.sourceMenu(done);
    return;
  }
  readSafely('setSource', function () {
    tizen.tvwindow.setSource(
      source.raw,
      function () {
        adapter.report.writes.setSource = 'ok';
        done && done();
        try {
          tizen.application.getCurrentApplication().hide();
        } catch (e) {}
      },
      function (e) {
        adapter.report.writes.setSource = e.name;
        adapter.sourceMenu(done);
      }
    );
  });
};

adapter.volume = function (delta, done) {
  if (!tizen || adapter.info.volume === null) {
    done && done({ name: 'Unsupported' });
    return;
  }
  try {
    if (delta > 0) tizen.tvaudiocontrol.setVolumeUp();
    else if (delta < 0) tizen.tvaudiocontrol.setVolumeDown();
    else tizen.tvaudiocontrol.setMute(!tizen.tvaudiocontrol.isMute());
    adapter.info.volume = tizen.tvaudiocontrol.getVolume();
    adapter.info.mute = tizen.tvaudiocontrol.isMute();
    adapter.report.writes.volume = 'ok';
    adapter.onChange('volume');
    done && done();
  } catch (e) {
    adapter.report.writes.volume = e.name;
    done && done(e);
  }
};
