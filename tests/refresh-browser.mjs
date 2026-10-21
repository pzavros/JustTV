import assert from 'node:assert/strict';

/** Exercise real callbacks/DOM in both classic and direct-module builds. */
export async function verifyRefreshBehavior(page) {
  await page.evaluate(() => {
    window.refreshRow = document.getElementById('row0');
    window.refreshRoot = document.getElementById('rows');
    window.refreshRebuilds = 0;
    window.refreshObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.target === window.refreshRoot) window.refreshRebuilds++;
      });
    });
    window.refreshObserver.observe(window.refreshRoot, { childList: true });
    for (let i = 0; i < 20; i++) {
      Coast.platform.onChange('apps');
      Coast.platform.onChange('sources');
      Coast.platform.onChange('info');
      Coast.platform.onChange('running');
    }
  });
  await page.waitForTimeout(140);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    0,
    'Duplicate native updates must preserve DOM'
  );

  await page.evaluate(() => {
    Coast.platform.running[Coast.platform.apps[0].id] = true;
    Coast.platform.onChange('running');
    Coast.platform.info.network = { type: 1, connected: true, ip: '192.0.2.2' };
    Coast.platform.onChange('info');
  });
  await page.waitForTimeout(140);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    1,
    'Changed network label must update'
  );
  // The post-reload adapter initially has no network label; repeat with only IP changed.
  await page.evaluate(() => {
    window.refreshRebuilds = 0;
    Coast.platform.info.network.ip = '192.0.2.3';
    Coast.platform.onChange('info');
  });
  await page.waitForTimeout(140);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    0,
    'IP-only changes do not affect the home'
  );

  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    Coast.platform.apps[0].icon = 'assets/icons/app-0.png';
    Coast.platform.onChange('apps');
  });
  await page.waitForTimeout(120);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    0,
    'Navigation must retain its DOM'
  );
  await page.waitForTimeout(380);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    1,
    'Deferred updates resume after navigation'
  );

  await page.evaluate(() => {
    window.refreshRebuilds = 0;
    Coast.openControls();
    Coast.platform.sources = [
      {
        id: 'HDMI:1',
        name: 'HDMI 1',
        type: 'HDMI',
        number: 1,
        connected: true,
        raw: { type: 'HDMI', number: 1, handle: 1 }
      }
    ];
    Coast.platform.onChange('sources');
  });
  await page.waitForTimeout(160);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    0,
    'Menus retain pending updates'
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    1,
    'Closing a menu applies pending data'
  );

  await page.evaluate(() => {
    window.refreshRebuilds = 0;
    Coast.showAmbient();
    Coast.platform.sources[0].connected = false;
    Coast.platform.onChange('sources');
  });
  await page.waitForTimeout(140);
  assert.equal(await page.evaluate(() => window.refreshRebuilds), 0);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    1,
    'Wake applies deferred changes'
  );

  await page.evaluate(() => {
    window.refreshRebuilds = 0;
    Coast.platform.sources = [
      { ...Coast.platform.sources[0], raw: { type: 'HDMI', number: 1, handle: 2 } }
    ];
    Coast.platform.onChange('sources');
    window.refreshOriginalSwitch = Coast.platform.switchSource;
    Coast.platform.switchSource = (source, done) => {
      window.selectedHandle = source.raw.handle;
      done();
    };
  });
  await page.waitForTimeout(140);
  assert.equal(
    await page.evaluate(() => window.refreshRebuilds),
    0,
    'Fresh native handles preserve cards'
  );
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(350);
  await page.locator('#row1 [data-index="0"]').click();
  assert.equal(
    await page.evaluate(() => window.selectedHandle),
    2,
    'HDMI activation uses the latest handle'
  );
  assert.equal(await page.evaluate(() => Coast.debugState().overlay), null);
  await page.evaluate(() => {
    Coast.platform.switchSource = window.refreshOriginalSwitch;
    window.refreshObserver.disconnect();
  });
}

/** Set only the adapter's TV flag for the test; native APIs remain absent. */
export async function verifyTierFourSampling(browser, origin, variant) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage();
    await page.route('**/*', (route) =>
      route
        .request()
        .url()
        .startsWith(origin + '/')
        ? route.continue()
        : route.abort()
    );
    await page.addInitScript(() => {
      Object.defineProperty(window, 'CoastPlatform', {
        configurable: true,
        set(adapter) {
          adapter.tv = true;
          Object.defineProperty(window, 'CoastPlatform', {
            value: adapter,
            writable: true,
            configurable: true
          });
        }
      });
      localStorage.setItem(
        'coast.apps',
        JSON.stringify([{ id: 'DemoApp001.youtube', name: 'YouTube', icon: '' }])
      );
      localStorage.setItem(
        'coast.settings',
        JSON.stringify({
          active: 0,
          fastDefaults: 1,
          profiles: [
            {
              name: 'Test',
              order: null,
              hidden: [],
              renames: {},
              sourceHidden: [],
              scene: 1,
              saver: 3,
              motion: false,
              shortcuts: {}
            }
          ]
        })
      );
    });
    await page.goto(origin + '/' + variant + '/index.html');
    await page.waitForFunction(() => window.Coast);
    assert.equal(await page.evaluate(() => Coast.debugState().quality), 4);
    assert.equal(
      await page.locator('#root').evaluate((root) => root.classList.contains('reduce-motion')),
      false,
      'Full motion stays enabled'
    );
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.samplingFrames = 0;
      const original = window.requestAnimationFrame;
      window.requestAnimationFrame = function (callback) {
        window.samplingFrames++;
        return original.call(window, callback);
      };
    });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(950);
    assert.equal(
      await page.evaluate(() => window.samplingFrames),
      0,
      'Quality 4 must not start the JS frame sampler'
    );
    assert.equal(await page.evaluate(() => Coast.metrics.frames.length), 0);
    assert.equal(
      await page
        .locator('.tile:not(.focus) .face')
        .first()
        .evaluate((face) => getComputedStyle(face).transitionDuration.split(',')[0]),
      '0.2s',
      'Quality 4 keeps the full focus motion'
    );
  } finally {
    await context.close();
  }
}
