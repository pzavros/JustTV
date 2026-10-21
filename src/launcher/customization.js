import { openMenu } from './views/menu.js';
import { platform, root, strings } from './environment.js';
import { listAllApps, listFavoriteApps } from './catalogue.js';
import { state } from './state.js';
import { contextMenu, launchApp, getSourceName } from './actions.js';
import { showToast } from './presentation.js';
import { closeAllOverlays } from './overlays.js';
import { renderHome } from './views/home.js';
import { focusHome } from './focus.js';
import { schedulePreferencesSave } from './preferences.js';
import { applyMotionPreferences, setScene } from './scene.js';
import { updateClock } from './weather.js';
import { textDialog } from './views/text-dialog.js';

/**
 * App order/visibility, text entry, profiles and remote shortcut editors.
 */
export function openAllApps() {
  openMenu(
    strings.allApps,
    listAllApps().map(function (a) {
      return {
        label: state.activeProfile.renames[a.id] || a.name,
        action: function () {
          launchApp(a.id);
        },
        hold: function () {
          contextMenu({ id: a.id, name: a.name, app: a });
        }
      };
    }),
    strings.holdOptions
  );
}

export function startReorder(id) {
  if (!state.activeProfile.order)
    state.activeProfile.order = listFavoriteApps().map(function (a) {
      return a.id;
    });
  if (!state.activeProfile.order.length) {
    showToast(strings.noApps);
    return;
  }
  closeAllOverlays();
  renderHome();
  var idx = 1;
  state.rows[0].items.forEach(function (a, i) {
    if (id === a.id) idx = i;
  });
  focusHome(0, idx);
  state.moving = state.rows[0].items[idx].id;
  root.classList.add('moving');
  showToast(strings.moveHint);
}

export function moveApp(dx) {
  var from = state.activeProfile.order.indexOf(state.moving),
    to = from + dx;
  if (from < 0 || to < 0 || to >= state.activeProfile.order.length) return;
  var a = state.activeProfile.order.splice(from, 1)[0];
  state.activeProfile.order.splice(to, 0, a);
  schedulePreferencesSave();
  renderHome();
  var idx = state.rows[0].items
    .map(function (x) {
      return x.id;
    })
    .indexOf(state.moving);
  focusHome(0, idx, true);
  root.classList.add('moving');
}

export function openShowHide(selected) {
  openMenu(
    strings.showHide,
    listAllApps().map(function (a) {
      var shownIds = listFavoriteApps().map(function (x) {
          return x.id;
        }),
        on = shownIds.indexOf(a.id) >= 0;
      return {
        label: state.activeProfile.renames[a.id] || a.name,
        sub: on ? strings.shown : strings.hidden,
        action: function () {
          if (!state.activeProfile.order)
            state.activeProfile.order = listFavoriteApps().map(function (x) {
              return x.id;
            });
          if (on) {
            if (state.activeProfile.hidden.indexOf(a.id) < 0) state.activeProfile.hidden.push(a.id);
          } else {
            state.activeProfile.hidden = state.activeProfile.hidden.filter(function (id) {
              return id !== a.id;
            });
            if (state.activeProfile.order && state.activeProfile.order.indexOf(a.id) < 0)
              state.activeProfile.order.push(a.id);
          }
          schedulePreferencesSave();
          closeAllOverlays();
          renderHome();
          openShowHide(
            listAllApps()
              .map(function (x) {
                return x.id;
              })
              .indexOf(a.id)
          );
        }
      };
    }),
    strings.hideHint,
    selected
  );
}

export function openSourceVisibility(selected) {
  openMenu(
    strings.manageInputs,
    platform.sources.map(function (a, i) {
      var on = state.activeProfile.sourceHidden.indexOf(a.id) < 0;
      return {
        label: getSourceName(a),
        sub: on ? strings.shown : strings.hidden,
        action: function () {
          if (on) state.activeProfile.sourceHidden.push(a.id);
          else
            state.activeProfile.sourceHidden = state.activeProfile.sourceHidden.filter(
              function (id) {
                return id !== a.id;
              }
            );
          schedulePreferencesSave();
          closeAllOverlays();
          renderHome();
          openSourceVisibility(i);
        }
      };
    }),
    strings.holdRename,
    selected
  );
}

export function openProfiles() {
  var options = state.preferences.profiles.map(function (p, i) {
    return {
      label: p.name,
      sub: i === state.preferences.active ? strings.on : '',
      action: function () {
        state.preferences.active = i;
        state.activeProfile = p;
        state.homeFocus = { row: 0, index: 0, last: {} };
        schedulePreferencesSave();
        closeAllOverlays();
        setScene();
        renderHome();
        updateClock();
        applyMotionPreferences();
      },
      hold: function () {
        textDialog(strings.renameProfile, p.name, function (v) {
          p.name = v;
          schedulePreferencesSave();
          closeAllOverlays();
          renderHome();
          updateClock();
          openProfiles();
        });
      }
    };
  });
  if (state.preferences.profiles.length < 5)
    options.push({
      label: strings.addProfile,
      action: function () {
        textDialog(strings.profileName, '', function (v) {
          state.preferences.profiles.push({
            name: v,
            order: null,
            hidden: [],
            renames: {},
            sourceHidden: [],
            scene: 0,
            saver: 1,
            motion: false,
            shortcuts: {}
          });
          schedulePreferencesSave();
          closeAllOverlays();
          openProfiles();
        });
      }
    });
  openMenu(strings.profiles, options, strings.localProfile + ' · ' + strings.holdOptions);
}

export function openShortcuts() {
  openMenu(
    strings.shortcuts,
    [strings.red, strings.green, strings.yellow, strings.blue].map(function (name, i) {
      var id = state.activeProfile.shortcuts[i],
        a = platform.apps.filter(function (a) {
          return a.id === id;
        })[0];
      return {
        label: name,
        sub: id === 'samsung' ? strings.samsung : a ? a.name : strings.noShortcut,
        action: function () {
          openMenu(
            strings.chooseShortcut + name,
            [
              {
                label: strings.samsung,
                action: function () {
                  state.activeProfile.shortcuts[i] = 'samsung';
                  schedulePreferencesSave();
                  closeAllOverlays();
                  openShortcuts();
                }
              }
            ]
              .concat(
                listAllApps().map(function (a) {
                  return {
                    label: a.name,
                    action: function () {
                      state.activeProfile.shortcuts[i] = a.id;
                      schedulePreferencesSave();
                      closeAllOverlays();
                      openShortcuts();
                    }
                  };
                })
              )
              .concat([
                {
                  label: strings.removeShortcut,
                  action: function () {
                    state.activeProfile.shortcuts[i] = null;
                    schedulePreferencesSave();
                    closeAllOverlays();
                    openShortcuts();
                  }
                }
              ])
          );
        }
      };
    }),
    strings.focusHint
  );
}
