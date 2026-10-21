import { state } from './state.js';
import { root } from './environment.js';
import { schedulePreferencesSave } from './preferences.js';
import { sampleFrames } from './remote.js';
import { moveApp } from './customization.js';

/**
 * Single focus owner and geometric navigation. Keep this hot path free of layout reads.
 */
export function updateLayout() {
  var lv = state.homeFocus.row === 0 ? 0 : state.homeFocus.row < 3 ? 1 : 2;
  if (lv !== state.lastRenderedLevel) {
    if (state.lastRenderedLevel >= 0) root.classList.remove('level-' + state.lastRenderedLevel);
    root.classList.add('level-' + lv);
    var y =
      lv === 0
        ? [572, 900, 1230, 1550, 1880]
        : lv === 1
          ? [158, 362, 680, 994, 1322]
          : [-500, -300, 158, 340, 668];
    state.rows.forEach(function (r, i) {
      var compact = (lv === 1 && i === 0) || (lv === 2 && i === 2),
        off = lv === 2 && i < 2;
      r.el.className =
        'row' +
        (i === state.homeFocus.row ? ' active' : '') +
        (compact ? ' compact' : '') +
        (off ? ' offscreen' : '');
      r.el.style.transform = 'translateY(' + y[i] + 'px)';
    });
    state.lastRenderedLevel = lv;
    state.lastActiveRow = state.homeFocus.row;
  } else if (state.lastActiveRow !== state.homeFocus.row) {
    if (state.lastActiveRow >= 0) state.rows[state.lastActiveRow].el.classList.remove('active');
    state.rows[state.homeFocus.row].el.classList.add('active');
    state.lastActiveRow = state.homeFocus.row;
  }
}

export function focusElement(el) {
  if (state.focusedElement === el) return;
  if (state.focusedElement && state.focusedElement !== el) {
    state.focusedElement.classList.remove('focus');
    state.focusedElement.tabIndex = -1;
  }
  state.focusedElement = el;
  if (el) {
    el.classList.add('focus');
    if (!el.id)
      el.id =
        'focus-' +
        (el.getAttribute('data-row') || 'o') +
        '-' +
        (el.getAttribute('data-index') || el.getAttribute('data-oi') || '0');
    root.setAttribute('aria-activedescendant', el.id);
    if (el.tagName === 'INPUT') {
      el.focus();
    } else if (document.activeElement !== root) {
      root.tabIndex = 0;
      root.focus();
    }
  }
}

/**
 * @param {number} r Row index in the five-row home model.
 * @param {number} i Desired item index; clamped before drawing.
 * @param {boolean} [noSample] Skip optional frame sampling during data refresh.
 * Mutates homeFocus and cached row transforms, without measuring layout.
 */
export function focusHome(r, i, noSample) {
  state.homeFocus.row = r;
  state.homeFocus.index = Math.max(0, Math.min(i, state.rows[r].items.length - 1));
  state.homeFocus.last[r] = state.homeFocus.index;
  updateLayout();
  var row = state.rows[r],
    x = state.homeFocus.index * 348,
    margin = 25,
    max = 1728 - 25 - 312;
  // Bounds use geometry, not a layout read on each key.
  if (x - row.offset < margin) row.offset = Math.max(-25, x - margin);
  if (x - row.offset > max) row.offset = x - max;
  if (row.drawnOffset !== row.offset) {
    row.track.style.transform = 'translateX(' + -row.offset + 'px)';
    row.drawnOffset = row.offset;
  }
  focusElement(row.buttons[state.homeFocus.index]);
  schedulePreferencesSave();
  if (!noSample) sampleFrames();
}

export function navigateHome(dx, dy) {
  if (state.moving && dx) {
    moveApp(dx);
    return;
  }
  var r = state.homeFocus.row,
    i = state.homeFocus.index;
  if (dx) i = Math.max(0, Math.min(state.rows[r].items.length - 1, i + dx));
  if (dy) {
    var next = Math.max(0, Math.min(4, r + dy));
    if (next === r) return;
    i =
      state.homeFocus.last[next] != null
        ? state.homeFocus.last[next]
        : Math.min(state.rows[next].items.length - 1, i);
    r = next;
  }
  if (r === state.homeFocus.row && i === state.homeFocus.index) return;
  focusHome(r, i);
}
