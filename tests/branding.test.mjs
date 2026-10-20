import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { root, read } from '../scripts/compiler.mjs';
import { PRODUCT_NAME, ICON_SHA256, normalizeBranding } from '../scripts/branding.mjs';

test('JustTV package, document labels and TV app name agree', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(pkg.name, 'justtv');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  for (const file of ['src/public/index.html', 'dist/index.html']) {
    const html = await read(file);
    assert.ok(html.includes('<title>' + PRODUCT_NAME + '</title>'));
    assert.ok(html.includes('aria-label="' + PRODUCT_NAME + '"'));
  }
  assert.ok((await read('src/public/config.xml')).includes('<name>' + PRODUCT_NAME + '</name>'));
});

test('TV identity, startup metadata and privileges are preserved exactly', async () => {
  const before = await read('tests/fixtures/before/config.xml');
  assert.equal(normalizeBranding(await read('src/public/config.xml')), before);
  assert.equal(normalizeBranding(await read('dist/config.xml')), before);
  assert.equal(
    normalizeBranding(await read('dist/index.html')),
    await read('tests/fixtures/before/index.html')
  );
});

test('J monogram retains icon dimensions and stays below the old byte size', async () => {
  const icon = await fs.readFile(path.join(root, 'src/public/icon.png'));
  const before = await fs.readFile(path.join(root, 'tests/fixtures/before/icon.png'));
  const currentImage = PNG.sync.read(icon),
    previousImage = PNG.sync.read(before);
  assert.equal(currentImage.width, previousImage.width);
  assert.equal(currentImage.height, previousImage.height);
  assert.ok(icon.length <= before.length);
  assert.equal(crypto.createHash('sha256').update(icon).digest('hex'), ICON_SHA256);
  assert.notDeepEqual(icon, before);
});
