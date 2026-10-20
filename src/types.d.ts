/** Developer documentation only. This file is never bundled or loaded by the TV. */
interface LauncherApp {
  id: string;
  name: string;
  icon: string;
}
interface NativeFailure {
  name: string;
}
type Completion = (error?: NativeFailure) => void;
interface TvSource {
  id: string;
  name: string;
  type: string;
  number: number;
  connected: boolean | null;
  raw: { type: string; number: number; signal?: unknown };
}
interface HomeFocus {
  row: number;
  index: number;
  last: { [row: number]: number };
}
interface Profile {
  name: string;
  order: string[] | null;
  hidden: string[];
  renames: { [id: string]: string };
  sourceHidden: string[];
  scene: number;
  saver: number;
  motion: boolean;
  shortcuts: { [color: number]: string | null };
  focus?: HomeFocus;
}
interface Preferences {
  active: number;
  profiles: Profile[];
  fastDefaults?: number;
}
interface HomeTile {
  id?: string;
  name: string;
  value?: string;
  sub?: string;
  hint?: string;
  icon?: string;
  image?: string;
  bg?: string;
  fg?: string;
  connected?: boolean | null;
  app?: LauncherApp;
  source?: TvSource;
  action?: () => void;
  hold?: () => void;
}
interface HomeRow {
  title: string;
  kind: 'apps' | 'inputs' | 'quick' | 'custom' | 'tv';
  items: HomeTile[];
  el?: HTMLElement;
  track?: HTMLElement;
  buttons?: NodeListOf<HTMLElement>;
  offset?: number;
  drawnOffset?: number;
}
interface OverlayItem {
  row: number;
  x: number;
  action: () => void;
  hold?: () => void;
}
interface OverlayState {
  type: 'inputs' | 'controls' | 'menu' | 'text';
  html: string;
  items: OverlayItem[];
  index?: number;
  buttons?: NodeListOf<HTMLElement>;
}

interface WeatherSnapshot {
  at: number;
  temp: number;
  code: number;
  sunrise: string;
  sunset: string;
}
interface LauncherMetrics {
  firstUsableMs: number;
  nav: number[];
  frames: { fps: number; p90ms: number; quality: number }[];
  quality: number;
}
interface LauncherState {
  rows: HomeRow[];
  homeFocus: HomeFocus;
  activeOverlay: OverlayState | null;
  overlayStack: OverlayState[];
  canvasScale: number;
  preferencesSaveTimer: number;
  idleTimer: number;
  toastTimer: number;
  enterTimer: number;
  enterDown: boolean;
  held: boolean;
  wakeConsumed: boolean;
  ambient: boolean;
  launchInProgress: boolean;
  lastBackAt: number;
  clockTimer: number;
  weatherTimer: number;
  weatherRequest: XMLHttpRequest | null;
  platformRefreshTimer: number;
  resumeRefreshTimer: number;
  sceneQuality: number;
  performanceMetrics: LauncherMetrics;
  activeProfile: Profile | undefined;
  preferences: Preferences | undefined;
  weather: WeatherSnapshot | null;
  moving: string | null;
  lastDirection: number;
  lastRenderedLevel: number;
  lastActiveRow: number;
  focusedElement: HTMLElement | null;
  navMotionTimer: number;
  navigating: boolean;
}
