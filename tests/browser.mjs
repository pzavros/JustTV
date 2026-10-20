import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { root } from '../scripts/compiler.mjs';
import { normalizeBranding, PRODUCT_NAME } from '../scripts/branding.mjs';

const artifacts = path.join(root, '.local/test-artifacts');
await fs.mkdir(artifacts, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2'
};
const server = http.createServer(async (request, response) => {
  try {
    const [variant, ...parts] = new URL(request.url, 'http://localhost').pathname
      .slice(1)
      .split('/');
    if (!['before', 'after', 'source'].includes(variant) || parts.some((part) => part === '..'))
      throw Error('Bad path');
    const name = parts.join('/') || 'index.html';
    let file = path.join(root, variant === 'before' ? 'tests/fixtures/before' : 'dist', name);
    if (variant === 'before') {
      try {
        await fs.access(file);
      } catch {
        file = path.join(root, 'dist', name);
      }
    }
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream'
    });
    if (variant === 'source' && name.startsWith('src/')) file = path.join(root, name);
    let body = await fs.readFile(file);
    if (variant === 'source' && name === 'index.html') {
      body = body
        .toString()
        .replace(
          '<script src="platform.js"></script><script src="app.js"></script>',
          '<script type="module">await import("./src/platform.js");await import("./src/app.js");</script>'
        );
    }
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: process.env.JUSTTV_BROWSER_CHANNEL || 'chrome',
  headless: true
});
const hashes = {},
  reports = {},
  domSnapshots = {},
  visualComparisons = {};

try {
  for (const variant of ['before', 'after', 'source']) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      timezoneId: 'Asia/Nicosia'
    });
    const page = await context.newPage();
    const errors = [],
      blockedRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-20T18:00:00Z'));
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(origin + '/')) return route.continue();
      if (url.startsWith('https://api.open-meteo.com/'))
        return route.fulfill({
          json: {
            current: { temperature_2m: 22, weather_code: 0 },
            daily: { sunrise: ['2026-10-20T06:50'], sunset: ['2026-10-20T18:00'] }
          }
        });
      blockedRequests.push(url);
      return route.abort();
    });
    await page.addInitScript(() => {
      const names = [
        'YouTube',
        'Netflix',
        'Prime Video',
        'Spotify',
        'Plex',
        'Browser',
        'HBO Max',
        'Apple TV',
        'e-Manual',
        'e-Manual',
        'Gallery'
      ];
      if (!localStorage.getItem('coast.apps'))
        localStorage.setItem(
          'coast.apps',
          JSON.stringify(
            names.map((name, index) => ({ id: 'DemoApp001.app' + index, name, icon: '' }))
          )
        );
      if (!localStorage.getItem('coast.settings'))
        localStorage.setItem(
          'coast.settings',
          JSON.stringify({
            active: 0,
            fastDefaults: 1,
            profiles: [
              {
                name: 'Test profile',
                order: null,
                hidden: [],
                renames: {},
                sourceHidden: [],
                scene: 1,
                saver: 3,
                motion: true,
                shortcuts: { 3: 'samsung' }
              }
            ]
          })
        );
      localStorage.setItem(
        'coast.weather',
        JSON.stringify({
          at: Date.now(),
          temperature: 22,
          code: 0,
          sunrise: '2026-10-20T06:50',
          sunset: '2026-10-20T18:00'
        })
      );
    });
    await page.goto(origin + '/' + variant + '/index.html');
    assert.equal(await page.title(), variant === 'before' ? 'Clear Home' : PRODUCT_NAME);
    await page.waitForFunction(() => window.Coast && document.querySelector('.tile'));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      Coast.platform.sources = [
        {
          id: 'TV:1',
          name: 'Live TV',
          type: 'TV',
          number: 1,
          connected: true,
          raw: { type: 'TV', number: 1 }
        },
        {
          id: 'HDMI:1',
          name: 'HDMI 1',
          type: 'HDMI',
          number: 1,
          connected: true,
          raw: { type: 'HDMI', number: 1 }
        },
        {
          id: 'HDMI:2',
          name: 'HDMI 2',
          type: 'HDMI',
          number: 2,
          connected: false,
          raw: { type: 'HDMI', number: 2 }
        }
      ];
      Coast.platform.info.volume = 16;
      Coast.platform.info.network = { type: 1, connected: true, ip: '192.0.2.1' };
      Coast.render();
    });
    const key = async (name) => {
      await page.keyboard.press(name);
      await page.waitForTimeout(85);
    };
    const state = () => page.evaluate(() => Coast.debugState());
    async function screenshot(name) {
      await page.waitForFunction(
        () => !document.getElementById('root').classList.contains('navigating')
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );
      await page.waitForTimeout(100);
      // Compare settled frames, independent of CSS transition timing.
      const data = await page.screenshot({
        animations: 'disabled',
        path: path.join(artifacts, variant + '-' + name + '.png')
      });
      (hashes[variant] ||= {})[name] = crypto.createHash('sha256').update(data).digest('hex');
      const html = normalizeBranding(
        await page.locator('#root').evaluate((root) => root.outerHTML)
      );
      (domSnapshots[variant] ||= {})[name] = {
        html: crypto.createHash('sha256').update(html).digest('hex'),
        focus: await page.locator('.focus').boundingBox()
      };
    }
    await key('ArrowRight');
    await screenshot('home');
    for (let row = 0; row < 5; row++) {
      if (row) await key('ArrowDown');
      assert.equal((await state()).row, row, 'Every row must be reachable');
      for (let count = 0; count < 13; count++) await key('ArrowRight');
      let bounds = await page.locator('.tile.focus .face').boundingBox();
      assert.ok(
        bounds.x >= 70 && bounds.x + bounds.width <= 1850,
        'Right focus must fit safe area'
      );
      for (let count = 0; count < 13; count++) await key('ArrowLeft');
      bounds = await page.locator('.tile.focus .face').boundingBox();
      assert.ok(bounds.x >= 70 && bounds.x + bounds.width <= 1850, 'Left focus must fit safe area');
      if (row === 1) await screenshot('inputs');
      if (row === 3) await screenshot('bottom');
    }
    await key('ArrowDown');
    assert.equal((await state()).row, 4, 'Down must stop at bottom');
    await key('Escape');
    assert.equal((await state()).row, 0);
    await page.evaluate(() => Coast.openControls());
    await screenshot('controls');
    await key('Escape');
    assert.equal((await state()).overlay, null);
    await page.evaluate(() => Coast.openInputs('HDMI:1'));
    await screenshot('sources');
    await key('Escape');
    const before = await state();
    await page.evaluate(() => Coast.showAmbient());
    await screenshot('ambient');
    await key('ArrowRight');
    const after = await state();
    assert.equal(after.ambient, false);
    assert.equal(after.index, before.index, 'Wake consumes the first key');
    assert.equal(after.row, before.row);
    assert.equal(await page.locator('.focus').count(), 1);
    await key('ArrowRight');
    await page.keyboard.down('Enter');
    await page.waitForTimeout(560);
    await page.keyboard.up('Enter');
    assert.equal((await state()).overlay, 'menu');
    await key('ArrowDown');
    await key('ArrowDown');
    await key('Enter');
    assert.equal((await state()).overlay, 'text');
    await page.locator('#name-field').fill('My YouTube');
    await key('ArrowDown');
    await key('Enter');
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForTimeout(200);
    assert.ok(
      (await page.locator('#rows').innerText()).includes('My YouTube'),
      'Rename must survive reload'
    );
    assert.equal(await page.locator('.focus').count(), 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(blockedRequests, []);
    reports[variant] = { passed: true, errors, blockedRequests, state: await state() };
    await context.close();
  }
  for (const variant of ['after', 'source']) {
    assert.deepEqual(
      domSnapshots[variant],
      domSnapshots.before,
      variant + ': DOM and focus geometry must match exactly'
    );
    visualComparisons[variant] = {};
    for (const name of Object.keys(hashes.before)) {
      const rawIdentical = hashes[variant][name] === hashes.before[name];
      let changedPixels = 0;
      let rawChangedPixels = 0;
      if (!rawIdentical) {
        const before = PNG.sync.read(
          await fs.readFile(path.join(artifacts, 'before-' + name + '.png'))
        );
        const after = PNG.sync.read(
          await fs.readFile(path.join(artifacts, variant + '-' + name + '.png'))
        );
        assert.equal(after.width, before.width);
        assert.equal(after.height, before.height);
        const left = before.data,
          right = after.data;
        for (let offset = 0; offset < left.length; offset += 4) {
          if (
            left[offset] !== right[offset] ||
            left[offset + 1] !== right[offset + 1] ||
            left[offset + 2] !== right[offset + 2] ||
            left[offset + 3] !== right[offset + 3]
          )
            rawChangedPixels++;
        }
        // Bound Chrome edge/rounding noise: <=20 pixels, with a very small color threshold.
        changedPixels = pixelmatch(before.data, after.data, null, before.width, before.height, {
          threshold: 0.005,
          includeAA: false
        });
      }
      visualComparisons[variant][name] = {
        rawIdentical,
        rawChangedPixels,
        significantChangedPixels: changedPixels
      };
      assert.ok(rawChangedPixels <= 20, variant + '/' + name + ': more than 20 pixels changed');
      assert.equal(changedPixels, 0, variant + '/' + name + ': visible content changed');
    }
  }
  await fs.mkdir(path.join(root, '.local/reports'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.local/reports/refactor-browser-checks.json'),
    JSON.stringify(
      {
        localOnly: true,
        reports,
        identicalScreenshots: Object.values(visualComparisons).every((views) =>
          Object.values(views).every((view) => view.rawIdentical)
        ),
        identicalDomAndFocus: true,
        equivalentScreenshots: true,
        visualComparisons,
        domSnapshots,
        screenshots: hashes,
        tests: [
          'all rows and boundaries',
          'safe focus on every row',
          'overlay Back stack',
          'ambient wake consumption',
          'single focus',
          'long OK and rename persistence',
          'six views with exact DOM/focus and no non-antialiased pixel differences',
          'native ES module entry points execute directly'
        ]
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    'Baseline, compiled build and native ES modules passed navigation/persistence checks; all six views match in DOM, geometry and non-antialiased pixels.'
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
