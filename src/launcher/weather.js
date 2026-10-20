import { byId, platform, root, strings } from './environment.js';
import { state } from './state.js';
import { describeWeatherCondition, getSceneMode, setScene } from './scene.js';
import { renderIcon } from './views/html.js';

/**
 * Clock, weather cache/request lifecycle and minute-aligned updates.
 */
export function formatDateText() {
  var d = new Date(),
    days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
}

export function updateClock() {
  var d = new Date(),
    h = d.getHours(),
    m = d.getMinutes(),
    text = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m,
    nodes = root.querySelectorAll('.clock');
  for (var i = 0; i < nodes.length; i++)
    if (nodes[i].textContent !== text) nodes[i].textContent = text;
  byId('greeting').textContent =
    (h < 12 ? strings.goodMorning : h < 18 ? strings.goodAfternoon : strings.goodEvening) +
    (state.activeProfile.name ? ', ' + state.activeProfile.name : '');
  byId('avatar').textContent = (state.activeProfile.name || 'P').charAt(0).toUpperCase();
  byId('location-date').textContent = strings.location + ', ' + formatDateText();
  byId('ambient-date').textContent = formatDateText();
  setScene();
  updateWeatherUI();
  clearTimeout(state.clockTimer);
  if (!document.hidden)
    state.clockTimer = setTimeout(
      updateClock,
      60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 10
    );
}

export function updateWeatherUI() {
  var valid = state.weather && Date.now() - state.weather.at < 3600000;
  byId('weather').hidden = !valid;
  if (valid) {
    byId('weather').innerHTML =
      renderIcon(getSceneMode() === 'night' ? 'moon' : 'sun') +
      '<span>' +
      Math.round(state.weather.temp) +
      '°</span>';
    byId('ambient-weather').textContent =
      describeWeatherCondition(getSceneMode()) +
      ' · ' +
      Math.round(state.weather.temp) +
      '° ' +
      strings.location;
  } else byId('ambient-weather').textContent = describeWeatherCondition(getSceneMode());
}

export function fetchWeather() {
  if (document.hidden) return;
  var x = new XMLHttpRequest();
  state.weatherRequest = x;
  x.open(
    'GET',
    'https://api.open-meteo.com/v1/forecast?latitude=35.1856&longitude=33.3823&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto',
    true
  );
  x.timeout = 5000;
  x.onload = function () {
    try {
      if (x.status !== 200) throw new Error('HTTP ' + x.status);
      var d = JSON.parse(x.responseText),
        c = d.current;
      if (!c || typeof c.temperature_2m !== 'number') return;
      state.weather = {
        at: Date.now(),
        temp: c.temperature_2m,
        code: c.weather_code,
        sunrise: d.daily.sunrise[0],
        sunset: d.daily.sunset[0]
      };
      localStorage.setItem('coast.weather', JSON.stringify(state.weather));
      platform.report.reads.weather = { ok: true };
      setScene();
      updateWeatherUI();
    } catch (e) {
      platform.report.reads.weather = { ok: false, detail: e.message };
    }
  };
  x.onerror = x.ontimeout = function () {
    platform.report.reads.weather = { ok: false, detail: 'unavailable' };
  };
  x.send();
  clearTimeout(state.weatherTimer);
  state.weatherTimer = setTimeout(fetchWeather, 1800000);
}
