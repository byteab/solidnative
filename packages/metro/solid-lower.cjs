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

/** @param {{ types: import('@babel/types') }} babel */
module.exports = function lowerPrimitives({ types: t }, options = {}) {
  // Text's `accessible` default differs by platform; without one, Text stays a component.
  const accessible =
    options.platform === 'ios' ? true : options.platform === 'android' ? false : undefined;
  const visitor = {
    JSXElement(path) {
      const opening = path.node.openingElement;
      if (opening.name.type !== 'JSXIdentifier') return;
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
    },
  };
  return {
    name: 'solidnative-lower-primitives',
    visitor: {
      // Ahead of the Solid compiler, which turns JSX into calls on its own visit.
      Program(path) {
        path.traverse(visitor);
      },
    },
  };
};
