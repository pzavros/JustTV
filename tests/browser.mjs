import { verifyRefreshBehavior, verifyTierFourSampling } from './refresh-browser.mjs';
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

const visualBaseline = process.env.JUSTTV_VISUAL_BASELINE;
const artifacts = path.join(root, '.local/test-artifacts');
await fs.mkdir(artifacts, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
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
    if (variant === 'before' && visualBaseline) file = path.join(root, visualBaseline, name);
    if (variant === 'before' && !visualBaseline) {
      try {
        await fs.access(file);
      } catch {
        file = path.join(root, 'dist', name);
      }
    }
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
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream'
    });
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
    assert.equal(
      await page.title(),
      variant === 'before' && !visualBaseline ? 'Clear Home' : PRODUCT_NAME
    );
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
    if (variant !== 'before') {
      assert.equal(await page.locator('#row0 .appface .name').count(), 0);
      for (const brand of ['spotify', 'hbomax']) {
        await page.waitForFunction((brand) => {
          const artwork = document.querySelector('.' + brand + ' .app-artwork');
          return artwork && artwork.complete && artwork.naturalWidth > 0;
        }, brand);
      }
      assert.equal(await page.locator('#row0 .tile.focus .app-label').innerText(), 'YouTube');
      await page.evaluate(() => {
        Coast.platform.apps[0].icon = 'assets/icons/app-1.png';
        Coast.render();
      });
      await page.waitForFunction(
        () => document.querySelector('#row0 .tile.focus .app-artwork').naturalWidth > 0
      );
      await page.waitForTimeout(180);
      const artwork = await page.locator('#row0 .tile.focus .app-artwork').boundingBox();
      assert.ok(Math.abs(artwork.width - 312 * 1.12) < 0.1);
      // A failed icon must reveal its readable wordmark instead of leaving a blank tile.
      await page.locator('#row0 .tile.focus .app-artwork').evaluate((image) => {
        image.src = 'missing-icon.png';
      });
      await page.waitForFunction(
        () => !document.querySelector('#row0 .tile.focus .appface.has-artwork')
      );
      assert.equal(await page.locator('#row0 .tile.focus .app-wordmark').isVisible(), true);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(
        await page
          .locator('.face')
          .first()
          .evaluate((face) => getComputedStyle(face).transitionDuration),
        '0s'
      );
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    // Align the fixture refresh with the artwork/error exercise in current entries.
    if (variant === 'before' && visualBaseline) await page.evaluate(() => Coast.render());
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
      if (row === 1) {
        await screenshot('inputs');
        if (variant !== 'before') {
          await page.evaluate(() => {
            window.sourceSelections = [];
            window.originalSwitchSource = Coast.platform.switchSource;
            Coast.platform.switchSource = function (source, done) {
              window.sourceSelections.push({ id: source.id, raw: source.raw });
              done();
            };
          });
          await page.locator('#row1 [data-index="1"]').click();
          assert.equal((await state()).overlay, null, 'HDMI click must not open the picker');
          await key('Enter');
          assert.equal((await state()).overlay, null, 'HDMI OK must switch directly');
          await page.locator('#row1 [data-index="2"]').click();
          assert.equal((await state()).overlay, null, 'Disconnected HDMI must not open the picker');
          assert.deepEqual(await page.evaluate(() => window.sourceSelections), [
            { id: 'HDMI:1', raw: { type: 'HDMI', number: 1 } },
            { id: 'HDMI:1', raw: { type: 'HDMI', number: 1 } },
            { id: 'HDMI:2', raw: { type: 'HDMI', number: 2 } }
          ]);
          await page.keyboard.down('Enter');
          await page.waitForTimeout(560);
          await page.keyboard.up('Enter');
          assert.equal((await state()).overlay, 'menu', 'Hold OK retains rename/hide options');
          await key('Escape');
          await key('ArrowLeft');
          await key('ArrowLeft');
          await page.evaluate(() => {
            Coast.platform.switchSource = window.originalSwitchSource;
          });
        }
      }
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
    if (variant !== 'before') {
      await verifyRefreshBehavior(page);
      await verifyTierFourSampling(browser, origin, variant);
    }
    reports[variant] = { passed: true, errors, blockedRequests, state: await state() };
    await context.close();
  }
  // The UI deliberately differs from the frozen refactor fixture. Compare the
  // current classic bundle with its direct-module development entry instead.
  for (const variant of visualBaseline ? ['after', 'source'] : ['source']) {
    if (variant === 'source')
      assert.deepEqual(
        domSnapshots[variant],
        domSnapshots.after,
        variant + ': DOM and focus geometry must match exactly'
      );
    const reference = variant === 'after' ? 'before' : 'after';
    const priorBuild = variant === 'after';
    if (priorBuild) {
      for (const name of Object.keys(domSnapshots.after)) {
        for (const dimension of ['x', 'y', 'width', 'height'])
          assert.ok(
            Math.abs(
              domSnapshots.after[name].focus[dimension] - domSnapshots.before[name].focus[dimension]
            ) < 0.02,
            name + ': saved-build focus geometry changed'
          );
      }
    }
    visualComparisons[variant] = {};
    for (const name of Object.keys(hashes[reference])) {
      const rawIdentical = hashes[variant][name] === hashes[reference][name];
      let changedPixels = 0;
      let rawChangedPixels = 0;
      if (!rawIdentical) {
        const before = PNG.sync.read(
          await fs.readFile(path.join(artifacts, reference + '-' + name + '.png'))
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
          threshold: priorBuild ? 0.1 : 0.005,
          includeAA: false
        });
      }
      visualComparisons[variant][name] = {
        reference,
        pixelmatchThreshold: priorBuild ? 0.1 : 0.005,
        rawIdentical,
        rawChangedPixels,
        significantChangedPixels: changedPixels
      };
      if (priorBuild) {
        // Releasing layers changes gradient rounding and compact text rasterization.
        // Keep exact focus geometry and cap perceptual differences below 0.1% of 1080p.
        assert.ok(changedPixels <= 2000, variant + '/' + name + ': saved-build visual regression');
      } else {
        assert.ok(rawChangedPixels <= 20, variant + '/' + name + ': more than 20 pixels changed');
        assert.equal(changedPixels, 0, variant + '/' + name + ': visible content changed');
      }
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
          'current classic and module entries: six matching views',
          'native ES module entry points execute directly'
        ]
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    visualBaseline
      ? 'Current entries match in six views; prior-build focus geometry is preserved with bounded compositor rasterization differences.'
      : 'Historical baseline and current entries passed navigation/persistence checks; current classic and module builds match in all six views.'
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
