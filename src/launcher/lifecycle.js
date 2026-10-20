import { state } from './state.js';
import { fetchWeather, updateClock } from './weather.js';
import { scheduleIdle, showAmbient, wake } from './ambient.js';
import { byId, platform, root, strings } from './environment.js';
import { focusHome } from './focus.js';
import { handleVolumeResult, openAbout, openControls } from './views/controls.js';
import { renderHome } from './views/home.js';
import { loadPreferences } from './preferences.js';
import { fitCanvas } from './presentation.js';
import { escapeHtml } from './views/html.js';
import { handleKeyDown, handleKeyUp } from './remote.js';
import { browser } from '../browser.js';
import { activateHome } from './actions.js';
import { closeAllOverlays, focusOverlay } from './overlays.js';
import { openInputs } from './views/inputs.js';

/**
 * Visibility lifecycle, adapter change handling and the ordered application bootstrap.
 */
export function handleVisibilityChange() {
  document.body.classList.toggle('paused', document.hidden);
  if (document.hidden) {
    clearTimeout(state.idleTimer);
    clearTimeout(state.clockTimer);
    clearTimeout(state.weatherTimer);
    clearTimeout(state.resumeRefreshTimer);
    if (state.weatherRequest) state.weatherRequest.abort();
    return;
  }
  state.launchInProgress = false;
  updateClock();
  scheduleIdle();
  clearTimeout(state.resumeRefreshTimer);
  state.resumeRefreshTimer = setTimeout(function () {
    if (!document.hidden) platform.refresh();
  }, 100);
  // A Home launch routed to an already-running app returns to its top.
  if (!state.activeOverlay) focusHome(0, state.homeFocus.last[0] || 0, true);
  if (!state.weather || Date.now() - state.weather.at > 1800000) fetchWeather();
}

platform.onChange = function (what) {
  if (what === 'volume') {
    handleVolumeResult();
    return;
  }
  if (what === 'running') {
    state.rows.forEach(function (r) {
      if (r.kind !== 'apps') return;
      r.items.forEach(function (a, i) {
        var dot = r.buttons[i].querySelector('.running-dot');
        if (dot) dot.hidden = !platform.running[a.id];
      });
    });
    return;
  }
  clearTimeout(state.platformRefreshTimer);
  state.platformRefreshTimer = setTimeout(function () {
    if (!state.activeOverlay && !state.moving) renderHome();
  }, 60);
};

// Restore preferences before constructing the first home view.
loadPreferences();

fitCanvas();

// Probe flex-gap support once; the TV browser uses the margin fallback.
var gapTest = document.createElement('div');

gapTest.style.cssText =
  'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';

gapTest.innerHTML = '<i></i><i></i>';

document.body.appendChild(gapTest);

if (gapTest.scrollHeight !== 1) root.classList.add('no-flex-gap');

document.body.removeChild(gapTest);

try {
  state.weather = JSON.parse(localStorage.getItem('coast.weather') || 'null');
} catch (e) {}

byId('end-message').innerHTML =
  escapeHtml(strings.end) +
  ' <b class="keycap">' +
  strings.home +
  '</b> ' +
  escapeHtml(strings.endTail);

byId('corner-hint').textContent = strings.holdOptions;

renderHome();

updateClock();

scheduleIdle();

// One listener pair owns remote input; views never register competing key handlers.
document.addEventListener('keydown', handleKeyDown);

document.addEventListener('keyup', handleKeyUp);

document.addEventListener('visibilitychange', handleVisibilityChange);

browser.addEventListener('resize', fitCanvas);

document.addEventListener('click', function (e) {
  var el = e.target;
  while (el && el !== root && !el.hasAttribute('data-row') && !el.hasAttribute('data-oi'))
    el = el.parentNode;
  if (!el || el === root) return;
  if (el.hasAttribute('data-row')) {
    focusHome(+el.getAttribute('data-row'), +el.getAttribute('data-index'));
    activateHome(false);
  } else if (state.activeOverlay) {
    focusOverlay(+el.getAttribute('data-oi'));
    state.activeOverlay.items[state.activeOverlay.index].action();
  }
});

browser.addEventListener('appcontrol', function () {
  if (state.ambient) wake();
  closeAllOverlays();
  focusHome(0, state.homeFocus.last[0] || 0, true);
});

// Preserve the public adapter/debug interface used by existing local tooling.
browser.Coast = {
  metrics: state.performanceMetrics,
  platform: platform,
  home: state.homeFocus,
  openInputs: openInputs,
  openControls: openControls,
  showAmbient: showAmbient,
  wake: wake,
  openAbout: openAbout,
  render: renderHome,
  settings: function () {
    return state.preferences;
  },
  debugState: function () {
    return {
      row: state.homeFocus.row,
      index: state.homeFocus.index,
      overlay: state.activeOverlay && state.activeOverlay.type,
      ambient: state.ambient,
      quality: state.sceneQuality,
      apps: platform.apps.length,
      version: '2.1.0'
    };
  }
};

// Keep native discovery and weather after the first usable frame.
requestAnimationFrame(function () {
  state.performanceMetrics.firstUsableMs = performance.now() - browser.COAST_BOOT;
  setTimeout(function () {
    if (platform.tv) {
      var script = document.createElement('script');
      script.src = '$WEBAPIS/webapis/webapis.js';
      script.onload = function () {
        platform.refreshInfo();
      };
      document.head.appendChild(script);
      platform.init();
    }
    fetchWeather();
  }, 80);
});
