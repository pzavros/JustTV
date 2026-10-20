import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renameBindings, executableAst } from '../scripts/compiler.mjs';

test('developer aliases never rename the public API or native member names', () => {
  const source =
    '(function(browser){var platform=browser.api;browser.Coast={platform:platform,render:function(){return platform.platform;}};})(window);';
  const output = renameBindings(source, { browser: 'w', platform: 'P' });
  assert.ok(output.includes('w.Coast={platform:P'));
  assert.ok(output.includes('P.platform'));
  assert.equal(
    executableAst(output),
    executableAst(
      '(function(w){var P=w.api;w.Coast={platform:P,render:function(){return P.platform;}};})(window);'
    )
  );
});
