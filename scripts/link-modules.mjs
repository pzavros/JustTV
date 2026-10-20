import path from 'node:path';
import { analyzeModule, editSource } from './module-analysis.mjs';

// Runtime code deliberately targets ES5. Imports/exports and the declared state
// objects are authoring features; all other syntax must survive the ES5 check.
const browserGlobals = new Set([
  'window',
  'document',
  'localStorage',
  'innerWidth',
  'innerHeight',
  'setTimeout',
  'clearTimeout',
  'requestAnimationFrame',
  'XMLHttpRequest',
  'performance',
  'Date',
  'JSON',
  'Math',
  'Object',
  'Array',
  'String',
  'Number',
  'Error',
  'Infinity',
  'undefined'
]);

function dependency(file, request) {
  if (!request.startsWith('.')) throw Error(`${file}: use relative module imports`);
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), request));
  if (!target.startsWith('src/') || !target.endsWith('.js')) {
    throw Error(`${file}: imports must point to JavaScript inside src/`);
  }
  return target;
}

/** Validate the actual ES module graph before performing any source transforms. */
export async function moduleGraph(entry, read) {
  const graph = new Map();
  async function load(file) {
    if (graph.has(file)) return;
    const source = await read(file);
    const analysis = analyzeModule(source);
    const record = {
      file,
      source,
      ...analysis,
      imports: new Map(),
      exports: new Set(),
      dependencies: []
    };
    graph.set(file, record);
    for (const node of record.ast.body) {
      if (node.type === 'ImportDeclaration') {
        const target = dependency(file, node.source.value);
        record.dependencies.push(target);
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            throw Error(`${file}: use explicit named imports`);
          }
          record.imports.set(specifier.local.name, { file: target, name: specifier.imported.name });
        }
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.source) throw Error(`${file}: export declarations from their owning module`);
        if (node.declaration) {
          const declaration = node.declaration;
          if (declaration.type === 'FunctionDeclaration') record.exports.add(declaration.id.name);
          else if (declaration.type === 'VariableDeclaration') {
            declaration.declarations.forEach((item) => record.exports.add(item.id.name));
          } else throw Error(`${file}: unsupported export declaration`);
        } else {
          for (const specifier of node.specifiers) {
            if (specifier.local.name !== specifier.exported.name) {
              throw Error(`${file}: keep export names explicit and stable`);
            }
            record.exports.add(specifier.local.name);
          }
        }
      } else if (node.type.startsWith('Export')) {
        throw Error(`${file}: use named exports`);
      }
    }
    for (const target of record.dependencies) await load(target);
  }
  await load(entry);
  for (const record of graph.values()) {
    for (const [local, imported] of record.imports) {
      if (!graph.get(imported.file).exports.has(imported.name)) {
        throw Error(
          `${record.file}: ${local} imports missing export ${imported.name} from ${imported.file}`
        );
      }
    }
    for (const name of record.exports) {
      if (!record.moduleBindings.has(name))
        throw Error(`${record.file}: missing export binding ${name}`);
    }
    for (const { node, scope } of record.references) {
      if (scope === -1 && !browserGlobals.has(node.name)) {
        throw Error(`${record.file}: ${node.name} needs an explicit import`);
      }
    }
  }
  return graph;
}

function stateDeclarations(record, names) {
  const states = new Map();
  for (const name of names) {
    const statement = record.ast.body.find(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'VariableDeclaration' &&
        node.declaration.declarations.some((item) => item.id.name === name)
    );
    const declarations = statement?.declaration.declarations;
    if (declarations?.length !== 1 || declarations[0].init?.type !== 'ObjectExpression') {
      throw Error(`${record.file}: ${name} must be one exported state object literal`);
    }
    const properties = declarations[0].init.properties;
    const fields = new Set();
    for (const property of properties) {
      if (
        property.type !== 'Property' ||
        property.key.type !== 'Identifier' ||
        property.computed ||
        property.method ||
        property.kind !== 'init' ||
        property.shorthand ||
        fields.has(property.key.name)
      ) {
        throw Error(`${record.file}: ${name} requires unique, explicit data properties`);
      }
      fields.add(property.key.name);
    }
    states.set(name, { statement, properties, fields });
  }
  return states;
}

/**
 * Static linking, with zero runtime module wrappers or state-object indirection.
 * Named imports are checked; the manifest preserves the verified initialization order.
 * State objects may be accessed only by explicit fields and cannot escape as values.
 */
export async function linkModules(spec, read) {
  const graph = await moduleGraph(spec.entry, read);
  const expected = new Set([spec.entry, spec.browserModule, ...spec.order]);
  if (
    expected.size !== spec.order.length + 2 ||
    graph.size !== expected.size ||
    [...graph.keys()].some((name) => !expected.has(name))
  ) {
    throw Error(`${spec.entry}: module graph and initialization order disagree`);
  }
  if (graph.get(spec.entry).ast.body.some((node) => node.type !== 'ImportDeclaration')) {
    throw Error(`${spec.entry}: the entry point declares initialization imports only`);
  }
  const browser = graph.get(spec.browserModule).ast.body;
  const binding = browser[0]?.declaration?.declarations?.[0];
  if (
    browser.length !== 1 ||
    browser[0].type !== 'ExportNamedDeclaration' ||
    binding?.id.name !== spec.parameter ||
    binding.init?.name !== 'window'
  ) {
    throw Error(`${spec.browserModule}: expected the browser boundary only`);
  }

  const states = new Map();
  const symbols = new Map([[spec.parameter, spec.browserModule]]);
  for (const file of spec.order) {
    const record = graph.get(file);
    const state = stateDeclarations(record, spec.stateObjects?.[file] || []);
    states.set(file, state);
    const declared = new Set(
      [...record.moduleBindings].filter((name) => !record.imports.has(name) && !state.has(name))
    );
    for (const { fields } of state.values()) fields.forEach((name) => declared.add(name));
    for (const name of declared) {
      if (symbols.has(name))
        throw Error(`${file}: bundle binding ${name} conflicts with ${symbols.get(name)}`);
      symbols.set(name, file);
    }
  }

  const parts = [];
  for (const file of spec.order) {
    const record = graph.get(file);
    const edits = [];
    const state = states.get(file);
    for (const node of record.ast.body) {
      if (
        node.type === 'ImportDeclaration' ||
        (node.type === 'ExpressionStatement' &&
          node.expression?.type === 'Literal' &&
          node.expression.value === 'use strict')
      ) {
        edits.push([node.start, node.end, '']);
      } else if (node.type === 'ExportNamedDeclaration') {
        const name = node.declaration?.declarations?.[0]?.id.name;
        if (state.has(name)) {
          const declaration = state.get(name).properties.map((property) => {
            const value = property.value;
            const initializer =
              value.type === 'Identifier' && value.name === 'undefined'
                ? ''
                : '=' + record.source.slice(value.start, value.end);
            return property.key.name + initializer;
          });
          edits.push([node.start, node.end, 'var ' + declaration.join(',') + ';']);
        } else if (node.declaration) {
          edits.push([node.start, node.declaration.start, '']);
        } else edits.push([node.start, node.end, '']);
      }
    }
    for (const { node, parent, scope } of record.references) {
      if (scope !== 0) continue;
      const imported = record.imports.get(node.name);
      const owner = imported ? states.get(imported.file) : state;
      const name = imported?.name || node.name;
      const object = owner?.get(name);
      if (object) {
        if (
          parent?.type !== 'MemberExpression' ||
          parent.object !== node ||
          parent.computed ||
          !object.fields.has(parent.property.name)
        ) {
          throw Error(
            `${file}: ${node.name} requires a known explicit field; state objects cannot escape`
          );
        }
        edits.push([parent.start, parent.end, parent.property.name]);
      } else if (imported && imported.name !== node.name) {
        edits.push([node.start, node.end, imported.name]);
      }
    }
    parts.push(`// Module: ${file}\n` + editSource(record.source, edits));
  }
  return `'use strict';\n` + parts.join('\n\n');
}
