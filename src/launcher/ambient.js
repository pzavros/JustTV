import { schedulePlatformRefresh } from './refresh.js';
import { state } from './state.js';
import { byId, root, strings } from './environment.js';
import { updateClock } from './weather.js';
import { focusHome } from './focus.js';

/**
 * Idle scheduling and ambient wake; preserve focus and consume the wake key.
 */
export function scheduleIdle() {
  clearTimeout(state.idleTimer);
  var mins = [2, 5, 15, 0][state.activeProfile.saver == null ? 1 : state.activeProfile.saver];
  if (mins && !document.hidden && !state.ambient && !state.activeOverlay)
    state.idleTimer = setTimeout(showAmbient, mins * 60000);
}

export function showAmbient() {
  if (state.activeOverlay || document.hidden) return;
  state.ambient = true;
  root.classList.add('ambient-on');
  byId('ambient').hidden = false;
  byId('wake-hint').textContent = strings.wake;
  updateClock();
}

export function wake() {
  state.ambient = false;
  byId('ambient').hidden = true;
  root.classList.remove('ambient-on');
  focusHome(state.homeFocus.row, state.homeFocus.index, true);
  scheduleIdle();
  schedulePlatformRefresh();
}

export const frameSampling = { sampling: false, sampleCooldown: 0 };
