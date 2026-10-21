import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { minify } from 'terser';
import * as css from 'css-tree';
import { minify as minifyHtml } from 'html-minifier-terser';
import { linkModules } from './link-modules.mjs';
import { editSource } from './module-analysis.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const read = (name) => fs.readFile(path.join(root, name), 'utf8');
export const manifest = JSON.parse(await read('scripts/manifest.json'));

/** Rename bindings/references, never public object keys or API member names. */
export function renameBindings(source, aliases = {}) {
  const edits = [];
  function visit(node, parent, key) {
    if (!node || typeof node !== 'object') return;
    const propertyName =
      parent &&
      ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
        (parent.type === 'Property' && key === 'key' && !parent.computed));
    if (node.type === 'Identifier' && aliases[node.name] && !propertyName) {
      edits.push([node.start, node.end, aliases[node.name]]);
    }
    for (const name of Object.keys(node)) {
      const value = node[name];
      if (Array.isArray(value)) value.forEach((child) => visit(child, node, name));
      else if (value && typeof value === 'object') visit(value, node, name);
    }
  }
  visit(parse(source, { ecmaVersion: 5 }), null, '');
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
    source = source.slice(0, start) + replacement + source.slice(end);
  }
  return source;
}

/**
 * Compare executable operations, allowing only hoisted function placement, var
 * grouping, quoted property keys and spelling/position metadata to differ.
 * Initialization statements and expression trees remain in their original order.
 */
export function executableAst(source) {
  const tree = parse(source, { ecmaVersion: 5 });
  return JSON.stringify(tree, function (key, value) {
    if (['start', 'end', 'raw'].includes(key)) return undefined;
    if (key === 'body' && Array.isArray(value)) {
      const functions = value.filter((node) => node.type === 'FunctionDeclaration');
      const names = functions.map((node) => node.id.name);
      if (new Set(names).size !== names.length) throw Error('Duplicate hoisted function binding');
      const statements = [];
      for (const node of value) {
        if (node.type === 'FunctionDeclaration') continue;
        const previous = statements[statements.length - 1];
        if (
          node.type === 'VariableDeclaration' &&
          node.kind === 'var' &&
          previous?.type === 'VariableDeclaration' &&
          previous.kind === 'var'
        ) {
          previous.declarations.push(...node.declarations);
        } else
          statements.push(
            node.type === 'VariableDeclaration'
              ? { ...node, declarations: [...node.declarations] }
              : node
          );
      }
      return {
        functions: functions.sort((a, b) => a.id.name.localeCompare(b.id.name)),
        statements
      };
    }
    if (key === 'key' && this.type === 'Property' && !this.computed) {
      return {
        type: 'PropertyName',
        value: value.type === 'Identifier' ? value.name : String(value.value)
      };
    }
    return value;
  });
}

export function cssAst(source) {
  const tree = css.parse(source, { parseCustomProperty: true });
  css.walk(tree, (node) => {
    if (['Number', 'Dimension', 'Percentage'].includes(node.type)) {
      node.value = String(Number(node.value));
    }
    if (node.type === 'Hash' || node.type === 'HexColor') node.value = node.value.toLowerCase();
  });
  return css.generate(tree);
}

/** Joining adjacent var statements changes no initialization order or runtime work. */
function joinAdjacentVariables(source) {
  const edits = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.body)) {
      for (let i = 1; i < node.body.length; i++) {
        const previous = node.body[i - 1],
          current = node.body[i];
        if (
          previous.type === 'VariableDeclaration' &&
          current.type === 'VariableDeclaration' &&
          previous.kind === 'var' &&
          current.kind === 'var'
        ) {
          if (source[previous.end - 1] !== ';')
            throw Error('Terminate var declarations explicitly');
          edits.push([previous.end - 1, previous.end, ',']);
          edits.push([current.start, current.declarations[0].start, '']);
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parse(source, { ecmaVersion: 5 }));
  return editSource(source, edits);
}

export async function compile() {
  const outputs = {};
  for (const [file, spec] of Object.entries(manifest.bundles)) {
    let source = spec.entry
      ? await linkModules(spec, read)
      : (await Promise.all(spec.sources.map(read))).join('\n\n');
    if (spec.parameter) source = `(function (${spec.parameter}) {\n${source}\n})(window);\n`;
    const runtime = renameBindings(joinAdjacentVariables(source), spec.aliases);
    const result = await minify(runtime, {
      ecma: 5,
      compress: false,
      mangle: false,
      format: { comments: false, quote_style: 1, wrap_iife: true }
    });
    if (executableAst(runtime) !== executableAst(result.code)) {
      throw new Error(`${file}: code generation changed executable structure`);
    }
    // Verify the linker/code generator before the reviewed release optimization pass.
    // Rename local bindings only: Samsung APIs, public keys and storage keys are stable.
    const optimized = await minify(result.code, {
      ecma: 5,
      compress: { passes: 2, unsafe: false },
      mangle: { properties: false },
      format: { comments: false, quote_style: 1, wrap_iife: true }
    });
    parse(optimized.code, { ecmaVersion: 5 });
    outputs[file] = optimized.code + '\n';
  }
  for (const [file, sources] of Object.entries(manifest.styles)) {
    const source = (await Promise.all(sources.map(read))).join('\n');
    outputs[file] = css.generate(css.parse(source)) + '\n';
    if (cssAst(source) !== cssAst(outputs[file])) {
      throw new Error(`${file}: CSS generation changed rules or cascade`);
    }
  }
  outputs['index.html'] = await minifyHtml(await read('src/public/index.html'), {
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    removeComments: true,
    minifyJS: async (text) => (await minify(text, { compress: false, mangle: false })).code,
    minifyCSS: (text, type) =>
      css.generate(
        css.parse(text, {
          context:
            type === 'inline'
              ? 'declarationList'
              : type === 'media'
                ? 'mediaQueryList'
                : 'stylesheet'
        })
      )
  });
  return outputs;
}
