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

export function fitCanvas() {
  state.canvasScale = Math.min(innerWidth / 1920, innerHeight / 1080);
  root.style.transform = 'scale(' + state.canvasScale + ')';
}
