import { schedulePlatformRefresh } from './refresh.js';
import { frameSampling, scheduleIdle, wake } from './ambient.js';
import { state } from './state.js';
import { applyMotionPreferences } from './scene.js';
import { byId, platform, root, strings } from './environment.js';
import { closeAllOverlays, closeOverlay, focusOverlay, navigateOverlay } from './overlays.js';
import { focusHome, navigateHome } from './focus.js';
import { activateHome, holdCurrent, launchApp, handleLaunchResult } from './actions.js';
import { endIntro, showToast } from './presentation.js';
import { openShortcuts } from './customization.js';
import { openAbout, openControls } from './views/controls.js';
import { openInputs } from './views/inputs.js';

/**
 * Frame sampling and remote key handling, including hold/repeat semantics.
 */
export function sampleFrames() {
  if (
    frameSampling.sampling ||
    state.sceneQuality >= 4 ||
    state.activeProfile.motion ||
    Date.now() < frameSampling.sampleCooldown ||
    document.hidden
  )
    return;
  frameSampling.sampling = true;
  var start = performance.now(),
    last = start,
    deltas = [];
  function frame(t) {
    if (document.hidden || state.sceneQuality >= 4 || state.activeProfile.motion) {
      frameSampling.sampling = false;
      return;
    }
    if (t - last > 1) deltas.push(t - last);
    last = t;
    if (t - start < 800) {
      requestAnimationFrame(frame);
      return;
    }
    frameSampling.sampling = false;
    frameSampling.sampleCooldown = Date.now() + 6000;
    if (deltas.length < 8) return;
    var sorted = deltas.slice().sort(function (a, b) {
        return a - b;
      }),
      p90 = sorted[Math.floor(sorted.length * 0.9)],
      fps =
        1000 /
        (deltas.reduce(function (a, b) {
          return a + b;
        }, 0) /
          deltas.length);
    state.performanceMetrics.frames.push({
      fps: Math.round(fps),
      p90ms: Math.round(p90),
      quality: state.sceneQuality
    });
    if (state.performanceMetrics.frames.length > 12) state.performanceMetrics.frames.shift();
    if ((fps < 50 || p90 > 28) && state.sceneQuality < 4) {
      state.sceneQuality++;
      state.performanceMetrics.quality = state.sceneQuality;
      applyMotionPreferences();
    }
  }
  requestAnimationFrame(frame);
}

export function pauseForNavigation() {
  if (!state.navigating) {
    state.navigating = true;
    root.classList.add('navigating');
  }
  clearTimeout(state.navMotionTimer);
  state.navMotionTimer = setTimeout(function () {
    state.navigating = false;
    root.classList.remove('navigating');
    schedulePlatformRefresh();
  }, 320);
}

export function handleKeyDown(e) {
  var k = e.keyCode,
    name = platform.keys[k],
    t = performance.now();
  if (state.ambient) {
    wake();
    state.wakeConsumed = true;
    e.preventDefault();
    return;
  }
  scheduleIdle();
  endIntro();
  if (state.wakeConsumed) {
    e.preventDefault();
    return;
  }
  if (
    state.activeOverlay &&
    state.activeOverlay.type === 'text' &&
    e.target === byId('name-field') &&
    k !== 10009 &&
    k !== 27 &&
    k !== 40 &&
    k !== 38
  ) {
    if (k === 13) {
      e.preventDefault();
      focusOverlay(1);
    }
    return;
  }
  if (k >= 37 && k <= 40) {
    e.preventDefault();
    clearTimeout(state.enterTimer);
    state.enterDown = false;
    if (t - state.lastDirection < 65) return;
    state.lastDirection = t;
    pauseForNavigation();
    var dx = k === 37 ? -1 : k === 39 ? 1 : 0,
      dy = k === 38 ? -1 : k === 40 ? 1 : 0;
    if (state.activeOverlay) navigateOverlay(dx, dy);
    else navigateHome(dx, dy);
    state.performanceMetrics.nav.push(performance.now() - t);
    if (state.performanceMetrics.nav.length > 100) state.performanceMetrics.nav.shift();
    return;
  }
  if (k === 13) {
    e.preventDefault();
    if (!state.enterDown) {
      state.enterDown = true;
      state.held = false;
      state.enterTimer = setTimeout(holdCurrent, 500);
    }
    return;
  }
  if (k === 10009 || k === 27) {
    e.preventDefault();
    if (state.activeOverlay) {
      closeOverlay();
      return;
    }
    if (state.moving) {
      state.moving = null;
      root.classList.remove('moving');
      schedulePlatformRefresh();
      showToast(strings.done);
      return;
    }
    if (state.homeFocus.row) {
      focusHome(0, state.homeFocus.last[0] || 0);
      return;
    }
    if (Date.now() - state.lastBackAt < 1600) {
      platform.samsung(handleLaunchResult);
      state.lastBackAt = 0;
    } else {
      state.lastBackAt = Date.now();
      showToast(strings.backAgain);
    }
    return;
  }
  if (k === 36 || k === 10182) {
    e.preventDefault();
    closeAllOverlays();
    focusHome(0, state.homeFocus.last[0] || 0);
    return;
  }
  var colours = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];
  if (colours.indexOf(name) >= 0) {
    e.preventDefault();
    var ci = colours.indexOf(name),
      id = state.activeProfile.shortcuts[ci];
    if (id === 'samsung') platform.samsung(handleLaunchResult);
    else if (id) launchApp(id);
    else openShortcuts();
    return;
  }
  if (name === 'Tools' || name === 'Settings' || k === 67) {
    e.preventDefault();
    openControls();
  } else if (name === 'Source' || k === 73) {
    e.preventDefault();
    openInputs();
  } else if (name === 'Info') {
    e.preventDefault();
    openAbout();
  } else if (name === 'ChannelUp' || name === 'ChannelDown') {
    e.preventDefault();
    navigateHome(0, name === 'ChannelUp' ? -1 : 1);
  }
}

export function handleKeyUp(e) {
  if (state.wakeConsumed) {
    state.wakeConsumed = false;
    state.enterDown = false;
    clearTimeout(state.enterTimer);
    return;
  }
  if (e.keyCode !== 13) return;
  e.preventDefault();
  clearTimeout(state.enterTimer);
  if (state.enterDown && !state.held) {
    if (state.activeOverlay) {
      var f = state.activeOverlay.items[state.activeOverlay.index];
      f && f.action && f.action();
    } else activateHome(false);
  }
  state.enterDown = false;
  state.held = false;
}
