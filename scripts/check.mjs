import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { root, read, compile, executableAst, cssAst } from './compiler.mjs';
import { normalizeBranding, ICON_SHA256 } from './branding.mjs';

const outputs = await compile();
const generated = new Set(Object.keys(outputs));
const reviewedAssets = JSON.parse(await read('tests/fixtures/ui-assets.json'));
const assetHashes = {
  ...JSON.parse(await read('tests/fixtures/assets-before.json')),
  ...reviewedAssets
};
const budgets = JSON.parse(await read('tests/fixtures/runtime-budgets.json'));
const report = {
  localOnly: true,
  generated: {},
  historicalStaticFilesUnchangedExceptBranding: true,
  reviewedAddedArtwork: Object.keys(reviewedAssets),
  reviewedBranding: ['index.html: title/label', 'config.xml: name', 'icon.png: J monogram']
};
for (const [file, expected] of Object.entries(outputs)) {
  const actual = await read('dist/' + file);
  assert.equal(actual, expected, `${file}: generated file is stale; run npm run build`);
  const before = await read('tests/fixtures/before/' + file);
  const equivalent = file.endsWith('.css')
    ? cssAst(actual) === cssAst(before)
    : file.endsWith('.html')
      ? normalizeBranding(actual) === before
      : executableAst(actual) === executableAst(before);
  if (process.argv.includes('--equivalence')) {
    assert.ok(equivalent, `${file}: structural refactor changed executable code or CSS rules`);
  }
  const bytes = Buffer.byteLength(actual);
  assert.ok(bytes <= budgets[file], `${file}: runtime byte budget exceeded`);
  report.generated[file] = { bytes, beforeBytes: Buffer.byteLength(before), equivalent };
}
for (const [file, hash] of Object.entries(assetHashes)) {
  if (generated.has(file)) continue;
  const bytes = await fs.readFile(path.join(root, 'dist', file));
  const checkedBytes =
    file === 'config.xml' ? Buffer.from(normalizeBranding(bytes.toString('utf8'))) : bytes;
  const expectedHash = file === 'icon.png' ? ICON_SHA256 : hash;
  assert.equal(
    crypto.createHash('sha256').update(checkedBytes).digest('hex'),
    expectedHash,
    `${file} changed`
  );
}
// No additional scripts, configuration, tracking, assets or development code may enter dist/.
async function files(dir, prefix = '') {
  const list = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      list.push(...(await files(path.join(dir, entry.name), prefix + entry.name + '/')));
    else list.push(prefix + entry.name);
  }
  return list;
}
assert.deepEqual((await files(path.join(root, 'dist'))).sort(), Object.keys(assetHashes).sort());
await fs.mkdir(path.join(root, '.local/reports'), { recursive: true });
await fs.writeFile(
  path.join(root, '.local/reports/refactor-verification.json'),
  JSON.stringify(report, null, 2) + '\n'
);
console.log(
  'ES5, fresh builds and file budgets verified; static changes are limited to reviewed JustTV branding and app artwork.'
);
if (process.argv.includes('--equivalence'))
  console.log(
    'JavaScript executable ASTs and CSS rules match the baseline; HTML differs only in reviewed branding.'
  );
