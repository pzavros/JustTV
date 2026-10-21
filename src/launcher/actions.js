import { schedulePlatformRefresh } from './refresh.js';
import { state } from './state.js';
import { showToast } from './presentation.js';
import { platform, root, strings } from './environment.js';
import { closeAllOverlays, closeOverlay } from './overlays.js';
import { startReorder } from './customization.js';
import { schedulePreferencesSave } from './preferences.js';
import { renderHome } from './views/home.js';
import { textDialog } from './views/text-dialog.js';
import { openMenu } from './views/menu.js';

/**
 * Launch feedback, short/held OK actions and app/input context menus.
 */
export function handleLaunchResult(e) {
  state.launchInProgress = false;
  if (e) showToast(e.name === 'Preview' ? strings.noPreviewControl : strings.launchFail);
}

export function handleSettingsResult(e) {
  if (e) showToast(e.name === 'Preview' ? strings.noPreviewControl : strings.settingsOpenFail);
}

export function launchApp(id) {
  if (state.launchInProgress) return;
  state.launchInProgress = true;
  showToast(
    strings.opening +
      (
        platform.apps.filter(function (a) {
          return a.id === id;
        })[0] || {}
      ).name
  );
  platform.launch(id, handleLaunchResult);
  setTimeout(function () {
    state.launchInProgress = false;
  }, 2000);
}

export function activateHome(long) {
  var it = state.rows[state.homeFocus.row].items[state.homeFocus.index];
  if (state.moving) {
    state.moving = null;
    root.classList.remove('moving');
    schedulePlatformRefresh();
    showToast(strings.done);
    return;
  }
  if (long && it.hold) {
    it.hold();
    return;
  }
  if (long && (it.app || it.source)) {
    contextMenu(it);
    return;
  }
  if (long) return;
  var el = state.rows[state.homeFocus.row].buttons[state.homeFocus.index];
  el.classList.add('pressed');
  setTimeout(function () {
    el.classList.remove('pressed');
  }, 120);
  it.action && it.action();
}

export function holdCurrent() {
  state.held = true;
  if (state.activeOverlay) {
    var f = state.activeOverlay.items[state.activeOverlay.index];
    if (f && f.hold) f.hold();
  } else activateHome(true);
}

export function contextMenu(it) {
  var options = [];
  if (it.app) {
    options.push({
      label: strings.move,
      action: function () {
        closeOverlay();
        startReorder(it.id);
      }
    });
    options.push({
      label: strings.hide,
      action: function () {
        state.activeProfile.hidden.push(it.id);
        schedulePreferencesSave();
        closeOverlay();
        renderHome();
      }
    });
    options.push({
      label: strings.rename,
      action: function () {
        textDialog(strings.rename, state.activeProfile.renames[it.id] || it.name, function (v) {
          state.activeProfile.renames[it.id] = v;
          schedulePreferencesSave();
          closeAllOverlays();
          renderHome();
        });
      }
    });
  } else if (it.source) {
    options.push({
      label: strings.rename,
      action: function () {
        textDialog(strings.inputName, state.activeProfile.renames[it.id] || it.name, function (v) {
          state.activeProfile.renames[it.id] = v;
          schedulePreferencesSave();
          closeAllOverlays();
          renderHome();
        });
      }
    });
    options.push({
      label: strings.hide,
      action: function () {
        state.activeProfile.sourceHidden.push(it.id);
        schedulePreferencesSave();
        closeAllOverlays();
        renderHome();
      }
    });
  }
  openMenu(it.name, options, strings.holdOptions);
}

export function getSourceName(a) {
  return state.activeProfile.renames[a.id] || a.name;
}
