import { state } from './state.js';
import { byId } from './environment.js';
import { scheduleIdle } from './ambient.js';
import { focusElement, focusHome } from './focus.js';

/**
 * Overlay stack, focus navigation and shared menu/message primitives.
 */
export function openOverlay(o, replace) {
  if (state.activeOverlay && !replace) state.overlayStack.push(state.activeOverlay);
  state.activeOverlay = o;
  state.activeOverlay.index = o.index || 0;
  byId('overlay').hidden = false;
  byId('overlay').innerHTML = o.html;
  document.body.classList.add('overlay-open');
  o.buttons = byId('overlay').querySelectorAll('[data-oi]');
  focusOverlay(o.index);
  scheduleIdle();
}

export function focusOverlay(i) {
  if (!state.activeOverlay || !state.activeOverlay.items.length) return;
  state.activeOverlay.index = Math.max(0, Math.min(i, state.activeOverlay.items.length - 1));
  focusElement(state.activeOverlay.buttons[state.activeOverlay.index]);
  if (state.activeOverlay.type === 'inputs') {
    var offset = Math.max(0, state.activeOverlay.index * 328 - 1280);
    byId('input-track').style.transform = 'translate3d(' + -offset + 'px,0,0)';
  }
  if (state.activeOverlay.type === 'menu') {
    var sc = byId('menu-scroll');
    if (sc)
      sc.style.transform = 'translateY(' + -Math.max(0, state.activeOverlay.index - 5) * 78 + 'px)';
  }
}

export function navigateOverlay(dx, dy) {
  if (state.activeOverlay.type === 'text' && document.activeElement === byId('name-field')) {
    if (dy) focusOverlay(dy > 0 ? 1 : 0);
    return;
  }
  var it = state.activeOverlay.items[state.activeOverlay.index],
    next = state.activeOverlay.index,
    best = Infinity,
    j,
    c;
  if (dx) {
    for (j = 0; j < state.activeOverlay.items.length; j++) {
      c = state.activeOverlay.items[j];
      if (c.row === it.row && (c.x - it.x) * dx > 0 && Math.abs(c.x - it.x) < best) {
        best = Math.abs(c.x - it.x);
        next = j;
      }
    }
  } else if (dy) {
    var r = it.row + dy;
    for (j = 0; j < state.activeOverlay.items.length; j++) {
      c = state.activeOverlay.items[j];
      if (c.row === r && Math.abs(c.x - it.x) < best) {
        best = Math.abs(c.x - it.x);
        next = j;
      }
    }
  }
  focusOverlay(next);
}

export function closeOverlay() {
  if (state.overlayStack.length) {
    var o = state.overlayStack.pop();
    openOverlay(o, true);
    return;
  }
  byId('overlay').hidden = true;
  byId('overlay').innerHTML = '';
  state.activeOverlay = null;
  document.body.classList.remove('overlay-open');
  focusHome(state.homeFocus.row, state.homeFocus.index, true);
  scheduleIdle();
}

export function closeAllOverlays() {
  state.overlayStack = [];
  if (state.activeOverlay) closeOverlay();
}
