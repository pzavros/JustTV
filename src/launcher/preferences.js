import { platform, strings } from './environment.js';
import { state } from './state.js';

/**
 * Read profiles and debounce storage writes; keep existing storage keys and migrations.
 */
// Preserve the installed storage schema and apply its existing defaults/migration.
export function loadPreferences() {
  var a;
  try {
    a = JSON.parse(localStorage.getItem('coast.settings') || 'null');
  } catch (e) {}
  if (!a || !a.profiles || !a.profiles.length)
    a = {
      active: 0,
      profiles: [
        {
          name: strings.profileDefault,
          order: null,
          hidden: [],
          renames: {},
          sourceHidden: [],
          scene: 0,
          saver: 1,
          motion: false,
          shortcuts: {}
        }
      ]
    };
  // Full motion became the TV default once focus/scroll motion was compositor-only. This
  // one-time step clears the earlier forced Reduce motion; scene quality stays at tier 4.
  if (platform.tv && !a.fullMotion) {
    a.profiles.forEach(function (p) {
      p.motion = false;
    });
    a.fastDefaults = 1;
    a.fullMotion = 1;
  }
  state.preferences = a;
  state.preferences.active = Math.min(
    state.preferences.active || 0,
    state.preferences.profiles.length - 1
  );
  state.activeProfile = state.preferences.profiles[state.preferences.active];
  state.activeProfile.hidden = state.activeProfile.hidden || [];
  state.activeProfile.renames = state.activeProfile.renames || {};
  state.activeProfile.sourceHidden = state.activeProfile.sourceHidden || [];
  state.activeProfile.shortcuts = state.activeProfile.shortcuts || {};
  if (!Object.prototype.hasOwnProperty.call(state.activeProfile.shortcuts, '3'))
    state.activeProfile.shortcuts[3] = 'samsung';
  if (state.activeProfile.focus) {
    state.homeFocus.row = state.activeProfile.focus.row || 0;
    state.homeFocus.index = state.activeProfile.focus.index || 0;
    state.homeFocus.last = state.activeProfile.focus.last || {};
  }
}

// Coalesce repeated navigation writes; the existing 350 ms delay is intentional.
export function schedulePreferencesSave() {
  clearTimeout(state.preferencesSaveTimer);
  state.preferencesSaveTimer = setTimeout(function () {
    state.activeProfile.focus = {
      row: state.homeFocus.row,
      index: state.homeFocus.index,
      last: state.homeFocus.last
    };
    try {
      localStorage.setItem('coast.settings', JSON.stringify(state.preferences));
    } catch (e) {}
  }, 350);
}
