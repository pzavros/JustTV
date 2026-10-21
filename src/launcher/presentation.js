import { byId, root } from './environment.js';
import { state } from './state.js';

/**
 * Transient feedback and canvas scaling; never read layout during navigation.
 */
export function showToast(text) {
  byId('toast').textContent = text;
  byId('toast').classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(function () {
    byId('toast').classList.remove('visible');
  }, 3000);
}

/** Staggered home entrance on boot and wake; ends early on the next key. */
export function playIntro() {
  endIntro();
  if (state.activeProfile.motion) return;
  root.classList.add('intro');
  state.introTimer = setTimeout(endIntro, 1100);
}

export function endIntro() {
  if (!state.introTimer) return;
  clearTimeout(state.introTimer);
  state.introTimer = 0;
  root.classList.remove('intro');
}

export function fitCanvas() {
  state.canvasScale = Math.min(innerWidth / 1920, innerHeight / 1080);
  root.style.transform = 'scale(' + state.canvasScale + ')';
}
