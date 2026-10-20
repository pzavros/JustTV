import { parse } from 'acorn';

export function parseModule(source) {
  return parse(source, { ecmaVersion: 2022, sourceType: 'module' });
}

function bindingsIn(node, result = new Set()) {
  if (!node || typeof node !== 'object') return result;
  if (node.type === 'FunctionDeclaration') {
    result.add(node.id.name);
    return result;
  }
  if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return result;
  if (node.type === 'ImportDeclaration') {
    node.specifiers.forEach((specifier) => result.add(specifier.local.name));
    return result;
  }
  if (node.type === 'VariableDeclarator') {
    if (node.id.type !== 'Identifier') throw Error('Use named bindings, not destructuring.');
    result.add(node.id.name);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => bindingsIn(child, result));
    else if (value && typeof value === 'object') bindingsIn(value, result);
  }
  return result;
}

/** Resolve references against function/catch scopes; property names are never bindings. */
export function analyzeModule(source) {
  const ast = parseModule(source);
  const moduleBindings = bindingsIn(ast);
  const references = [];
  function visit(node, scopes, parent, key) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration') return;
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) visit(node.declaration, scopes, node, 'declaration');
      return;
    }
    if (['FunctionDeclaration', 'FunctionExpression'].includes(node.type)) {
      const local = bindingsIn(node.body);
      if (node.id) local.add(node.id.name);
      for (const parameter of node.params) {
        if (parameter.type !== 'Identifier') throw Error('Use named function parameters.');
        local.add(parameter.name);
      }
      visit(node.body, [...scopes, local], node, 'body');
      return;
    }
    if (node.type === 'CatchClause') {
      visit(node.body, [...scopes, new Set([node.param.name])], node, 'body');
      return;
    }
    if (node.type === 'Identifier') {
      const property =
        parent &&
        ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
          (parent.type === 'Property' && key === 'key' && !parent.computed));
      const declaration =
        parent &&
        ((parent.type === 'VariableDeclarator' && key === 'id') ||
          ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement') &&
            key === 'label'));
      if (!property && !declaration) {
        let scope = -1;
        for (let i = scopes.length - 1; i >= 0; i--) {
          if (scopes[i].has(node.name)) {
            scope = i;
            break;
          }
        }
        references.push({ node, parent, key, scope });
      }
      return;
    }
    for (const [childKey, value] of Object.entries(node)) {
      if (Array.isArray(value)) value.forEach((child) => visit(child, scopes, node, childKey));
      else if (value && typeof value === 'object') visit(value, scopes, node, childKey);
    }
  }
  visit(ast, [moduleBindings], null, '');
  return { ast, moduleBindings, references };
}

/** Apply non-overlapping source edits from right to left to retain comments. */
export function editSource(source, edits) {
  let boundary = source.length;
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
    if (end > boundary) throw Error('Overlapping module transforms.');
    source = source.slice(0, start) + replacement + source.slice(end);
    boundary = start;
  }
  return source;
}
