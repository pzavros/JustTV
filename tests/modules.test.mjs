import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'acorn';
import { linkModules, moduleGraph } from '../scripts/link-modules.mjs';
import { executableAst } from '../scripts/compiler.mjs';

function project(overrides = {}) {
  const files = {
    'src/browser.js': 'export var browser = window;',
    'src/app.js': "import './state.js'; import './counter.js';",
    'src/state.js': 'export const state = { count: 0, last: undefined };',
    'src/counter.js': `import { state } from './state.js';
      import { browser } from './browser.js';
      export function increment() { state.count++; return state.count; }
      browser.increment = increment;`,
    ...overrides
  };
  return {
    spec: {
      entry: 'src/app.js',
      browserModule: 'src/browser.js',
      parameter: 'browser',
      order: ['src/state.js', 'src/counter.js'],
      stateObjects: { 'src/state.js': ['state'] }
    },
    read: async (file) => {
      assert.ok(Object.hasOwn(files, file), file);
      return files[file];
    }
  };
}

test('module linking removes imports and state indirection without adding runtime operations', async () => {
  const { spec, read } = project();
  const result = await linkModules(spec, read);
  parse(result, { ecmaVersion: 5 });
  assert.equal(
    executableAst(result),
    executableAst(`'use strict';
    var count = 0, last;
    function increment() { count++; return count; }
    browser.increment = increment;`)
  );
  assert.ok(!result.includes('state.count'));
});

test('module graph rejects hidden cross-file globals and missing named exports', async () => {
  for (const code of [
    'browser.increment = missingFunction;',
    "import { absent } from './state.js'; browser.increment = absent;"
  ]) {
    const { spec, read } = project({ 'src/counter.js': code });
    await assert.rejects(moduleGraph(spec.entry, read), /explicit import|missing export/);
  }
});

test('local parameters and catch bindings cannot be mistaken for imported state', async () => {
  const { spec, read } = project({
    'src/counter.js': `import { state } from './state.js';
      import { browser } from './browser.js';
      export function inspect(state) { return state.count; }
      export function caught() { try { throw null; } catch(state) { return state.count; } }
      browser.inspect = inspect; browser.caught = caught; browser.count = state.count;`
  });
  const result = await linkModules(spec, read);
  assert.equal((result.match(/return state.count/g) || []).length, 2);
  assert.ok(result.includes('browser.count = count'));
});

test('state flattening rejects escaped objects, computed fields and unknown fields', async () => {
  for (const expression of ['state', "state['count']", 'state.missing']) {
    const { spec, read } = project({
      'src/counter.js': `import {state} from './state.js'; import {browser} from './browser.js'; browser.value = ${expression};`
    });
    await assert.rejects(linkModules(spec, read), /known explicit field/);
  }
});

test('linking rejects global collisions and silently omitted modules', async () => {
  const { spec, read } = project({
    'src/counter.js': "import {browser} from './browser.js'; var count = 1; browser.count = count;"
  });
  await assert.rejects(linkModules(spec, read), /conflicts/);
  const valid = project();
  await assert.rejects(
    linkModules({ ...valid.spec, order: ['src/counter.js'] }, valid.read),
    /initialization order/
  );
});

test('equivalence allows hoisted declarations and var grouping, but protects operations and initialization order', () => {
  assert.equal(
    executableAst('var a=one(); function f(){return a;} var b=two();'),
    executableAst('function f(){return a;} var a=one(),b=two();')
  );
  assert.notEqual(executableAst('var a=one(),b=two();'), executableAst('var b=two(),a=one();'));
  assert.notEqual(executableAst('value++;'), executableAst('value--;'));
  assert.notEqual(executableAst('x.property=1;'), executableAst('x.other=1;'));
  assert.throws(() => executableAst('function f(){} function f(){}'), /Duplicate/);
});
