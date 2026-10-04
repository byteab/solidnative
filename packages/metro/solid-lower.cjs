/**
 * Lower `<View>` and `<Text>` from `@solidnative/components` to the `<view>` and `<text>`
 * intrinsics they render, where nothing the components do is needed.
 *
 * Both components are a host element plus a spread of their props: View's props as they are, and
 * Text's with the platform's `accessible` default. Written that way the compiler applies each
 * prop with `setProp` in one effect for the element and inserts static children directly, where
 * the component costs a spread effect, its state, a host-props object per pass and an effect for
 * its children. An element is lowered only when every attribute is a plain one the component
 * forwards unchanged: no spread, no `ref` (the component hands out a native ref, not the node),
 * no alias it rewrites (`id`, `role`, `tabIndex`, `aria-*`, the accessibility state and value),
 * no namespaced attribute, and on Text nothing that makes it pressable or disabled.
 *
 * A lowered element's literal attributes, its style among them, are then taken out of the JSX
 * into one module-level object, its style flattened as the platform would at run time, and handed
 * to `createElement` as its second argument: one copy per node instead of a `setProp` apiece, and
 * a style the platform never flattens again.
 */

const SOURCES = new Set(['@solidnative/components', '@solidnative/components/solid']);

/** What View rewrites rather than forwards (`host-props.ts`). */
const VIEW_KEEPS = new Set([
  'ref',
  'children',
  'id',
  'role',
  'tabIndex',
  'accessibilityState',
  'accessibilityValue',
]);

/** What Text also acts on: its press behaviour, and the defaults it computes (`primitive.ts`). */
const TEXT_KEEPS = new Set([
  ...VIEW_KEEPS,
  'disabled',
  'cancelable',
  'pressRetentionOffset',
  'delayPressIn',
  'delayPressOut',
  'delayLongPress',
  'minPressDuration',
  'onPress',
  'onPressIn',
  'onPressOut',
  'onLongPress',
  'suppressHighlighting',
  'accessible',
]);

/** The component an identifier names, when it is View or Text imported from the components. */
function primitiveOf(path, name) {
  const binding = path.scope.getBinding(name);
  if (!binding || binding.kind !== 'module') return null;
  const specifier = binding.path;
  if (!specifier.isImportSpecifier()) return null;
  if (!SOURCES.has(specifier.parentPath.node.source.value)) return null;
  const imported = specifier.node.imported;
  const original = imported.type === 'Identifier' ? imported.name : imported.value;
  return original === 'View' || original === 'Text' ? original : null;
}

function lowerable(attributes, keeps) {
  for (const attribute of attributes) {
    if (attribute.type !== 'JSXAttribute' || attribute.name.type !== 'JSXIdentifier') return false;
    const name = attribute.name.name;
    if (keeps.has(name) || name.startsWith('aria-')) return false;
  }
  return true;
}

/**
 * The intrinsics an app writes directly, which get the same statics as a lowered View or Text.
 * Only when every attribute is a plain one: a spread applied after the statics would override a
 * literal written after it.
 */
const INTRINSICS = new Set(['view', 'text']);

function plainAttribute(attribute) {
  return attribute.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier';
}

/** Attributes the platform routes elsewhere than the node's props (`properties.ts`, `styles.ts`). */
const ROUTED = new Set(['class', 'className', 'classList', 'responder']);
/** The attribute that carries the statics from the JSX pass to the rewrite after the compiler. */
const STATICS = '$statics';
const NONE = Symbol('none');
const NUMERIC_STYLE = /^-?(?:\d*\.)?\d+(?:px)?$/;

/** An expression's value when it is a literal, or a list or object of them; NONE otherwise. */
function literalOf(node) {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'UnaryExpression':
      return node.operator === '-' && node.argument.type === 'NumericLiteral'
        ? -node.argument.value
        : NONE;
    case 'ArrayExpression':
      return literalList(node.elements);
    case 'ObjectExpression':
      return literalObject(node.properties);
    default:
      return NONE;
  }
}

function literalList(elements) {
  const list = [];
  for (const element of elements) {
    const value = element ? literalOf(element) : NONE;
    if (value === NONE) return NONE;
    list.push(value);
  }
  return list;
}

function literalObject(properties) {
  const object = {};
  for (const property of properties) {
    if (property.type !== 'ObjectProperty' || property.computed) return NONE;
    const key = property.key;
    const name =
      key.type === 'Identifier' ? key.name : key.type === 'StringLiteral' ? key.value : null;
    const value = name === null ? NONE : literalOf(property.value);
    if (value === NONE) return NONE;
    object[name] = value;
  }
  return object;
}

/** A value as `styles.ts` writes it out: `'12px'` and `'12'` become 12, all the way down. */
function styleValue(value) {
  if (typeof value === 'string')
    return NUMERIC_STYLE.test(value.trim()) ? parseFloat(value) : value;
  if (Array.isArray(value)) return value.map(styleValue);
  if (value && typeof value === 'object') {
    const copy = {};
    for (const name in value) copy[name] = styleValue(value[name]);
    return copy;
  }
  return value;
}

/** A literal style flattened as `styles.ts` would; NONE when it needs the run-time path. */
function flatStyle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return NONE;
  const style = {};
  for (const name in value) {
    // A custom property or a null goes through the platform's style state, not the props.
    if (name.startsWith('--') || value[name] == null) return NONE;
    const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    style[key] = typeof value[name] === 'number' ? value[name] : styleValue(value[name]);
  }
  return style;
}

/** An attribute's value when it is known at build time; NONE otherwise. */
function staticValue(attribute) {
  const name = attribute.name.name;
  if (ROUTED.has(name) || name.startsWith('style:')) return NONE;
  const node = attribute.value;
  if (node === null) return true;
  if (node.type === 'StringLiteral') return name === 'style' ? NONE : node.value;
  if (node.type !== 'JSXExpressionContainer') return NONE;
  const value = literalOf(node.expression);
  if (name === 'style') return value === NONE ? NONE : flatStyle(value);
  return value;
}

/** Move a lowered element's literal attributes into a module-level object; its identifier. */
function hoistStatics(t, path, opening, program) {
  const statics = {};
  let count = 0;
  opening.attributes = opening.attributes.filter((attribute) => {
    const value = staticValue(attribute);
    if (value === NONE) return true;
    // An empty style sets nothing, as the platform drops one.
    if (attribute.name.name !== 'style' || Object.keys(value).length) {
      statics[attribute.name.name] = value;
      count++;
    }
    return false;
  });
  if (!count) return;
  const id = path.scope.getProgramParent().generateUidIdentifier('statics');
  const imports = program.get('body').filter((statement) => statement.isImportDeclaration());
  const declaration = t.variableDeclaration('const', [
    t.variableDeclarator(id, t.valueToNode(statics)),
  ]);
  if (imports.length) imports[imports.length - 1].insertAfter(declaration);
  else program.unshiftContainer('body', declaration);
  opening.attributes.unshift(
    t.jsxAttribute(t.jsxIdentifier(STATICS), t.jsxExpressionContainer(t.cloneNode(id))),
  );
}

/**
 * After the Solid compiler: `setProp(el, "$statics", s)` becomes the second argument of the
 * `createElement` that declared `el`, so the node is made with them.
 */
function passStatics(path) {
  const args = path.node.arguments;
  if (args.length < 3 || args[1].type !== 'StringLiteral' || args[1].value !== STATICS) return;
  const binding = args[0].type === 'Identifier' && path.scope.getBinding(args[0].name);
  const init = binding && binding.path.isVariableDeclarator() && binding.path.node.init;
  if (
    !init ||
    init.type !== 'CallExpression' ||
    init.arguments.length !== 1 ||
    !path.parentPath.isExpressionStatement()
  )
    throw path.buildCodeFrameError('solidnative: compiled static props in an unexpected shape.');
  init.arguments.push(args[2]);
  path.parentPath.remove();
}

/** @param {{ types: import('@babel/types') }} babel */
module.exports = function lowerPrimitives({ types: t }, options = {}) {
  // Text's `accessible` default differs by platform; without one, Text stays a component.
  const accessible =
    options.platform === 'ios' ? true : options.platform === 'android' ? false : undefined;
  const visitor = {
    JSXElement(path) {
      const opening = path.node.openingElement;
      if (opening.name.type !== 'JSXIdentifier') return;
      if (INTRINSICS.has(opening.name.name)) {
        if (opening.attributes.every(plainAttribute)) hoistStatics(t, path, opening, this.program);
        return;
      }
      const primitive = primitiveOf(path, opening.name.name);
      if (!primitive) return;
      const text = primitive === 'Text';
      if (text && accessible === undefined) return;
      if (!lowerable(opening.attributes, text ? TEXT_KEEPS : VIEW_KEEPS)) return;
      const tag = text ? 'text' : 'view';
      opening.name = t.jsxIdentifier(tag);
      if (path.node.closingElement) path.node.closingElement.name = t.jsxIdentifier(tag);
      if (text) {
        opening.attributes.unshift(
          t.jsxAttribute(
            t.jsxIdentifier('accessible'),
            t.jsxExpressionContainer(t.booleanLiteral(accessible)),
          ),
        );
      }
      hoistStatics(t, path, opening, this.program);
    },
  };
  return {
    name: 'solidnative-lower-primitives',
    visitor: {
      // Ahead of the Solid compiler, which turns JSX into calls on its own visit.
      Program: {
        enter(path) {
          path.traverse(visitor, { program: path });
        },
        // After the compiler's own visit, which turns the JSX into calls on the way in.
        exit(path) {
          path.traverse({ CallExpression: passStatics });
        },
      },
    },
  };
};
