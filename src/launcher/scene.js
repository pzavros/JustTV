import { state } from './state.js';
import { byId, root, strings } from './environment.js';

/**
 * Scene selection and motion preferences; no feature-specific focus logic.
 */
export function getSceneMode() {
  var now = new Date(),
    h = now.getHours(),
    m = state.activeProfile.scene || 0;
  if (m) return ['night', 'night', 'sunset', 'day'][m];
  if (state.weather && state.weather.sunset) {
    var t = now.getTime(),
      sunset = Date.parse(state.weather.sunset),
      sunrise = Date.parse(state.weather.sunrise);
    if (t >= sunset - 45 * 60000 && t < sunset + 30 * 60000) return 'sunset';
    return t < sunrise || t >= sunset + 30 * 60000 ? 'night' : 'day';
  }
  return h < 6 || h >= 19 ? 'night' : h >= 17 ? 'sunset' : 'day';
}

export function describeWeatherCondition(mode) {
  if (state.weather && Date.now() - state.weather.at < 3600000) {
    var c = state.weather.code;
    if (c === 0 || c === 1)
      return mode === 'night'
        ? strings.clearNight
        : mode === 'sunset'
          ? strings.sunsetCaption
          : strings.clearDay;
    if (c === 2 || c === 3) return strings.cloudy;
    if (c === 45 || c === 48) return strings.fog;
    if (c >= 95) return strings.storm;
    if (c >= 71 && c <= 86) return strings.snow;
    return strings.rain;
  }
  return mode === 'night'
    ? strings.nightCaption
    : mode === 'sunset'
      ? strings.sunsetCaption
      : strings.dayCaption;
}

export function setScene() {
  var mode = getSceneMode();
  root.classList.remove('scene-night', 'scene-sunset', 'scene-day');
  root.classList.add('scene-' + mode);
  var circles = byId('coast-scene').querySelectorAll('circle[cx="1380"]');
  for (var i = 0; i < circles.length; i++)
    circles[i].setAttribute('cy', mode === 'night' ? '200' : mode === 'sunset' ? '420' : '150');
  byId('condition').textContent = describeWeatherCondition(mode);
  applyMotionPreferences();
}

export function applyMotionPreferences() {
  root.classList.toggle('reduce-motion', !!state.activeProfile.motion);
  root.setAttribute('data-quality', state.sceneQuality);
}
