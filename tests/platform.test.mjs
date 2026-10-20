import assert from 'node:assert/strict';
import vm from 'node:vm';
import { test } from 'node:test';
import { read } from '../scripts/compiler.mjs';

async function environment({ native = true, cache, apps = [], rejectSources = false } = {}) {
  const values = new Map(Object.entries(cache || {}));
  const calls = [];
  let volume = 16,
    mute = false;
  const application = {
    getCurrentApplication: () => ({
      appInfo: { id: 'CodexHub01.Home' },
      hide: () => calls.push(['hide'])
    }),
    getAppsInfo: (done) => done(apps),
    getAppsContext: (done) => done([{ appId: 'org.tizen.netflix-app' }]),
    launch: (id, done) => {
      calls.push(['launch', id]);
      done();
    },
    launchAppControl: (control, id, done) => {
      calls.push(['control', id, control]);
      done();
    }
  };
  const tizen = {
    application,
    ApplicationControl: function (operation, uri, mime, category, data) {
      Object.assign(this, { operation, uri, mime, category, data });
    },
    ApplicationControlData: function (key, value) {
      Object.assign(this, { key, value });
    },
    tvinputdevice: {
      getKey: (name) => {
        if (name === 'Settings') throw { name: 'NotSupportedError' };
        return { code: 1000 + name.length };
      },
      registerKey: (name) => calls.push(['registerKey', name])
    },
    systeminfo: {
      getPropertyValue: (name, done) =>
        done({
          connected: [{ type: 'TV', number: 1 }],
          disconnected: [{ type: 'HDMI', number: 2 }]
        })
    },
    tvwindow: {
      setSource: (source, done, fail) => {
        calls.push(['source', source]);
        rejectSources ? fail({ name: 'NotSupportedError' }) : done();
      }
    },
    tvaudiocontrol: {
      getVolume: () => volume,
      isMute: () => mute,
      setVolumeUp: () => volume++,
      setVolumeDown: () => volume--,
      setMute: (value) => {
        mute = value;
      }
    }
  };
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  });
  context.window = context;
  if (native) context.tizen = tizen;
  for (const name of ['strings.js', 'device.js', 'platform.js'])
    vm.runInContext(await read('dist/' + name), context);
  return { adapter: context.CoastPlatform, calls, values, tizen };
}

test('discovery excludes internal packages, keeps manuals and accepts new ordinary widgets', async () => {
  const env = await environment({
    apps: [
      { id: 'CodexHub01.Home', name: 'JustTV' },
      { id: 'org.tizen.netflix-app', name: 'Netflix', iconPath: 'javascript:bad' },
      { id: 'org.tizen.primevideo', name: 'Prime Video', iconPath: '/broken/icon.png' },
      { id: 'jPPp4KCHp4.emanual', name: 'e-Manual' },
      { id: 'LzU5yAFXeg.emanual', name: 'e-Manual' },
      { id: 'org.tizen.internal-service', name: 'Internal', show: true },
      { id: 'NewApp0001.Home', name: 'New ordinary app' },
      { id: 'NewApp0002.Home', name: 'Hidden app', show: false }
    ]
  });
  env.adapter.refreshApps();
  assert.deepEqual(
    Array.from(env.adapter.apps, (app) => app.name),
    ['Netflix', 'Prime Video', 'e-Manual', 'e-Manual', 'New ordinary app']
  );
  assert.equal(env.adapter.apps[0].icon, '');
  assert.equal(env.adapter.apps[1].icon, 'assets/icons/app-0.png');
  assert.equal(JSON.parse(env.values.get('coast.apps')).length, 5);
});

test('cached discovery rejects internal IDs and tolerates corrupt storage', async () => {
  const cached = await environment({
    cache: {
      'coast.apps': JSON.stringify([
        { id: 'org.tizen.internal', name: 'Internal' },
        { id: 'NewApp0001.Home', name: 'App' }
      ])
    }
  });
  assert.equal(cached.adapter.apps.length, 1);
  const broken = await environment({ cache: { 'coast.apps': '{bad' } });
  assert.equal(broken.adapter.apps.length, 0);
});

test('native settings retains its verified menu URI and Samsung Home escape route', async () => {
  const { adapter, calls } = await environment();
  let completions = 0;
  adapter.settings((error) => {
    assert.equal(error, undefined);
    completions++;
  });
  const call = calls[0];
  assert.equal(call[1], 'org.tizen.menu');
  assert.equal(call[2].operation, 'http://tizen.org/appcontrol/operation/view');
  assert.equal(call[2].uri, '/opt/apps/org.tizen.menu/res/json/ATSC/menu.json');
  assert.equal(call[2].data[0].value[0], call[2].uri);
  adapter.samsung(() => completions++);
  assert.deepEqual(calls[1], ['launch', 'com.samsung.tv.csfs']);
  assert.equal(completions, 2);
});

test('source switching preserves raw native data and hides only after success', async () => {
  const { adapter, calls } = await environment();
  const raw = { type: 'HDMI', number: 2 };
  adapter.switchSource({ raw }, () => calls.push(['complete']));
  assert.deepEqual(
    calls.map((call) => call[0]),
    ['source', 'complete', 'hide']
  );
  assert.equal(calls[0][1], raw);
  const fallback = await environment({ rejectSources: true });
  fallback.adapter.switchSource({ raw }, () => {});
  assert.equal(fallback.calls[1][0], 'control');
  assert.equal(fallback.calls[1][2].data[0].value[0], 'source_key');
  assert.ok(!fallback.calls.some((call) => call[0] === 'hide'));
});

test('volume commands and unavailable APIs report truthful results', async () => {
  const { adapter } = await environment();
  adapter.refreshInfo();
  adapter.volume(1);
  assert.equal(adapter.info.volume, 17);
  adapter.volume(-1);
  assert.equal(adapter.info.volume, 16);
  adapter.volume(0);
  assert.equal(adapter.info.mute, true);
  assert.equal(adapter.report.reads.network.ok, false);
  const preview = await environment({ native: false });
  preview.adapter.launch('app', (error) => assert.equal(error.name, 'Preview'));
  preview.adapter.volume(1, (error) => assert.equal(error.name, 'Unsupported'));
});

test('key registration continues when a model does not expose Settings', async () => {
  const { adapter, calls } = await environment();
  adapter.init();
  assert.equal(adapter.report.keys.Settings, 'NotSupportedError');
  assert.ok(calls.some((call) => call[0] === 'registerKey' && call[1] === 'Tools'));
  assert.equal(adapter.sources.length, 2);
  assert.equal(adapter.sources[0].connected, true);
  assert.equal(adapter.sources[1].connected, false);
  assert.equal(adapter.running['org.tizen.netflix-app'], true);
});
