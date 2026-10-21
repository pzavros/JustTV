import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { root } from './compiler.mjs';
const variant = process.argv[2] || 'dist';
const directory = path.resolve(root, variant);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2'
};
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(
      directory,
      '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html')
    );
    if (!file.startsWith(directory + path.sep)) throw Error('path');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.JUSTTV_BROWSER_CHANNEL || 'chrome' });
try {
  const reports = [];
  for (const motion of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.route('**/*', (route) =>
      route.request().url().startsWith(origin) ? route.continue() : route.abort()
    );
    await page.addInitScript(
      ({ motion }) => {
        localStorage.setItem(
          'coast.apps',
          JSON.stringify(
            ['YouTube', 'Netflix', 'Prime Video', 'Spotify', 'Browser', 'HBO Max'].map(
              (name, i) => ({ id: 'DemoApp001.app' + i, name, icon: '' })
            )
          )
        );
        localStorage.setItem(
          'coast.settings',
          JSON.stringify({
            active: 0,
            fastDefaults: 1,
            profiles: [
              {
                name: 'Performance',
                order: null,
                hidden: [],
                renames: {},
                sourceHidden: [],
                scene: 1,
                saver: 3,
                motion,
                shortcuts: {}
              }
            ]
          })
        );
      },
      { motion }
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('LayerTree.enable');
    let layers = [];
    cdp.on('LayerTree.layerTreeDidChange', (event) => {
      if (event.layers) layers = event.layers;
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.Coast);
    await page.evaluate(() => {
      Coast.platform.sources = [
        { id: 'HDMI:1', name: 'HDMI 1', type: 'HDMI', number: 1, raw: { type: 'HDMI', number: 1 } }
      ];
      Coast.render();
      document.getElementById('root').setAttribute('data-quality', '4');
    });
    await page.waitForTimeout(500);
    const before = (await cdp.send('Performance.getMetrics')).metrics;
    await page.evaluate(() => {
      window.perfMutations = 0;
      new MutationObserver((records) => {
        window.perfMutations += records.length;
      }).observe(document.getElementById('root'), { subtree: true, attributes: true });
    });
    for (const key of [
      'ArrowRight',
      'ArrowRight',
      'ArrowRight',
      'ArrowDown',
      'ArrowDown',
      'ArrowDown',
      'ArrowDown',
      'ArrowUp',
      'ArrowUp',
      'ArrowUp',
      'Escape'
    ]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(85);
    }
    await page.waitForTimeout(500);
    const after = (await cdp.send('Performance.getMetrics')).metrics;
    const val = (metrics, name) => metrics.find((metric) => metric.name === name)?.value || 0;
    const nav = await page.evaluate(() => ({
      firstUsableMs: Coast.metrics.firstUsableMs,
      mutations: window.perfMutations,
      nav: Coast.metrics.nav,
      willChange: [...document.querySelectorAll('#root *')].filter(
        (el) => getComputedStyle(el).willChange !== 'auto'
      ).length
    }));
    // Settle at the left boundary before measuring repeated, ineffective input.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(85);
    }
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.perfStorageWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'coast.settings') window.perfStorageWrites++;
        return original.call(this, key, value);
      };
    });
    const edgeBefore = await page.evaluate(() => window.perfMutations);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(85);
    }
    await page.waitForTimeout(400);
    const edgeMutations = (await page.evaluate(() => window.perfMutations)) - edgeBefore;
    const edgeStorageWrites = await page.evaluate(() => window.perfStorageWrites);
    if (variant === 'dist') {
      assert.equal(edgeStorageWrites, 0, 'Repeated boundary presses must not write preferences');
      assert.ok(edgeMutations <= 2, 'Boundary presses may only toggle the navigation pause class');
      if (motion)
        assert.equal(nav.willChange, 0, 'Reduced motion must release explicit layer hints');
    }
    await page.evaluate(() => {
      window.duplicateRefreshRebuilds = 0;
      const rows = document.getElementById('rows');
      window.duplicateRefreshObserver = new MutationObserver((records) => {
        records.forEach((record) => {
          if (record.target === rows) window.duplicateRefreshRebuilds++;
        });
      });
      window.duplicateRefreshObserver.observe(rows, { childList: true });
      for (let i = 0; i < 20; i++) Coast.platform.onChange('info');
    });
    await page.waitForTimeout(180);
    const duplicateRefreshRebuilds = await page.evaluate(() => {
      window.duplicateRefreshObserver.disconnect();
      return window.duplicateRefreshRebuilds;
    });
    if (variant === 'dist')
      assert.equal(duplicateRefreshRebuilds, 0, 'Duplicate native data must not rebuild the home');
    const sorted = nav.nav.slice().sort((a, b) => a - b);
    reports.push({
      motionReduced: motion,
      cpuSlowdown: 4,
      firstUsableMs: nav.firstUsableMs,
      navigationP95Ms: sorted[Math.floor(sorted.length * 0.95)],
      navigationTaskMs: (val(after, 'TaskDuration') - val(before, 'TaskDuration')) * 1000,
      layoutCount: val(after, 'LayoutCount') - val(before, 'LayoutCount'),
      mutations: nav.mutations,
      edgeMutations,
      edgeStorageWrites,
      duplicateRefreshRebuilds,
      willChangeElements: nav.willChange,
      compositorLayers: layers.length || null,
      layerBackingMiB: layers.length
        ? layers.reduce((sum, l) => sum + (l.drawsContent ? l.width * l.height * 4 : 0), 0) /
          1048576
        : null
    });
    await context.close();
  }
  const bytes = {};
  for (const file of ['app.js', 'platform.js', 'strings.js', 'device.js', 'style.css'])
    bytes[file] = (await fs.stat(path.join(directory, file))).size;
  const result = {
    variant,
    localOnly: true,
    note: 'Desktop Chrome, 4x CPU slowdown; null layer counts mean the headless layer tree was unavailable; any backing estimate is not measured TV GPU memory.',
    bytes,
    reports
  };
  await fs.mkdir(path.join(root, '.local/reports'), { recursive: true });
  await fs.writeFile(
    path.join(
      root,
      '.local/reports/performance-' + (variant === 'dist' ? 'after' : 'before') + '.json'
    ),
    JSON.stringify(result, null, 2) + '\n'
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
