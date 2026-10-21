import assert from 'node:assert/strict';
import vm from 'node:vm';
import { test } from 'node:test';
import { linkModules } from '../scripts/link-modules.mjs';
import { read } from '../scripts/compiler.mjs';

async function fixture() {
  const files = {
    'src/browser.js': 'export var browser = window;',
    'src/launcher/environment.js': `import { browser } from '../browser.js';
      export var platform = browser.platform, strings = { network: 'Network', connected: 'Connected', unknown: 'Unknown' };`,
    'src/launcher/state.js': `export var state = { pendingPlatformChanges: 0, platformRefreshTimer: 0,
      renderedPlatformData: null, activeProfile: { sourceHidden: [] }, rows: [] };`,
    'src/launcher/catalogue.js': `import { platform } from './environment.js';
      export function listFavoriteApps() { return platform.apps.filter(function(app) { return app.favorite; }); }
      export function appBrand(app) { return ['', '', '', app.artwork]; }`,
    'src/launcher/views/home.js': `import { browser } from '../../browser.js';
      export function renderHome() { browser.rebuilds++; }`,
    'src/launcher/refresh.js': await read('src/launcher/refresh.js'),
    'src/expose.js': `import { browser } from './browser.js';
      import { state } from './launcher/state.js';
      import { queuePlatformRefresh, schedulePlatformRefresh, homeDataSignature } from './launcher/refresh.js';
      browser.test = { state: state, queue: queuePlatformRefresh, schedule: schedulePlatformRefresh, signature: homeDataSignature };`
  };
  files['src/app.js'] = "import './expose.js';";
  const code = await linkModules(
    {
      entry: 'src/app.js',
      browserModule: 'src/browser.js',
      parameter: 'browser',
      stateObjects: {},
      order: Object.keys(files).filter((file) => file !== 'src/browser.js' && file !== 'src/app.js')
    },
    (file) => files[file]
  );
  const timers = new Map();
  let next = 1;
  const context = vm.createContext({
    document: { hidden: false },
    rebuilds: 0,
    platform: {
      apps: [{ id: 'app1', name: 'YouTube', icon: 'icon.png', favorite: true }],
      sources: [
        {
          id: 'HDMI:1',
          name: 'HDMI 1',
          type: 'HDMI',
          number: 1,
          connected: true,
          raw: { handle: 1 }
        }
      ],
      info: { network: { type: 1, connected: true, ip: 'old' } },
      running: {},
      refresh() {
        context.reads++;
      }
    },
    reads: 0,
    setTimeout(callback) {
      const id = next++;
      timers.set(id, callback);
      return id;
    }
  });
  context.window = context;
  vm.runInContext('(function(browser){' + code + '})(window);', context);
  const state = context.test.state;
  const dot = { hidden: true };
  const tile = { id: 'HDMI:1', source: context.platform.sources[0] };
  state.rows = [
    { items: [{ id: 'app1' }], buttons: [{ querySelector: () => dot }] },
    { items: [tile] }
  ];
  state.renderedPlatformData = context.test.signature();
  function tick() {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
  }
  return { context, state, timers, tick, dot, tile };
}

test('unchanged native events coalesce without a rebuild; non-visible data is ignored', async () => {
  const f = await fixture();
  f.context.platform.info.model = 'new model';
  f.context.platform.info.network.ip = 'new ip';
  f.context.platform.apps.push({ id: 'other', name: 'Other', favorite: false });
  for (let i = 0; i < 20; i++) f.context.test.queue(false);
  assert.equal(f.timers.size, 1);
  f.tick();
  assert.equal(f.context.rebuilds, 0);
  assert.equal(f.state.pendingPlatformChanges, 0);
  assert.equal(f.timers.size, 0);
});

test('visible app, artwork, source status and network-label changes require a refresh', async () => {
  for (const change of [
    (f) => (f.context.platform.apps[0].name = 'New name'),
    (f) => (f.context.platform.apps[0].icon = 'new.png'),
    (f) => (f.context.platform.sources[0].connected = false),
    (f) => (f.context.platform.info.network.type = 2)
  ]) {
    const f = await fixture();
    change(f);
    f.context.test.queue(false);
    f.tick();
    assert.equal(f.context.rebuilds, 1);
  }
});

test('interaction deferral retains work without polling and resumes after each blocker', async () => {
  for (const blocker of [
    'navigating',
    'activeOverlay',
    'moving',
    'ambient',
    'enterDown',
    'hidden'
  ]) {
    const f = await fixture();
    const target = blocker === 'hidden' ? f.context.document : f.state;
    target[blocker] = true;
    f.context.platform.apps[0].icon = 'changed.png';
    f.context.test.queue(false);
    f.context.test.queue(true);
    assert.equal(f.timers.size, 0, blocker);
    assert.equal(f.context.rebuilds, 0);
    assert.equal(f.context.reads, 0);
    target[blocker] = false;
    f.context.test.schedule();
    assert.equal(f.timers.size, 1);
    f.tick();
    assert.equal(f.context.reads, 1);
    assert.equal(f.context.rebuilds, 1);
  }
});

test('navigation beginning during the debounce retains the pending batch', async () => {
  const f = await fixture();
  f.context.test.queue(false);
  f.state.navigating = true;
  f.tick();
  assert.equal(f.context.rebuilds, 0);
  assert.equal(f.state.pendingPlatformChanges, 1);
  assert.equal(f.timers.size, 0);
  f.state.navigating = false;
  f.context.test.schedule();
  f.tick();
  assert.equal(f.state.pendingPlatformChanges, 0);
});

test('equal cards retain their DOM while source handles and running dots are refreshed', async () => {
  const f = await fixture();
  const latest = { ...f.context.platform.sources[0], raw: { handle: 2 } };
  f.context.platform.sources = [latest];
  f.context.platform.running.app1 = true;
  f.context.test.queue(false);
  f.tick();
  assert.equal(f.context.rebuilds, 0);
  assert.equal(f.tile.source, latest);
  assert.equal(f.dot.hidden, false);
});
