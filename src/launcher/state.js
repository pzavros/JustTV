import { platform } from './environment.js';

/**
 * Mutable launcher data; state ownership is documented in docs/architecture.md.
 * Use explicit fields. The TV build resolves them to the original local bindings.
 * @type {LauncherState}
 */
export const state = {
  rows: [],
  homeFocus: { row: 0, index: 0, last: {} },
  activeOverlay: null,
  overlayStack: [],
  canvasScale: 1,
  preferencesSaveTimer: 0,
  idleTimer: 0,
  toastTimer: 0,
  enterTimer: 0,
  enterDown: false,
  held: false,
  wakeConsumed: false,
  ambient: false,
  launchInProgress: false,
  lastBackAt: 0,
  clockTimer: 0,
  weatherTimer: 0,
  weatherRequest: null,
  platformRefreshTimer: 0,
  resumeRefreshTimer: 0,
  sceneQuality: platform.tv ? 4 : 0,
  performanceMetrics: { firstUsableMs: 0, nav: [], frames: [], quality: platform.tv ? 4 : 0 },
  activeProfile: undefined,
  preferences: undefined,
  weather: null,
  moving: null,
  lastDirection: 0,
  lastRenderedLevel: -1,
  lastActiveRow: -1,
  focusedElement: null,
  navMotionTimer: 0,
  navigating: false
};
