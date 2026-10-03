/**
 * Where Yoga puts things: the layout half of the Tailwind sweep.
 *
 * Every case is laid out in one scene, the same in Chrome (with `@solid-native/web`'s reset, which is
 * what a component meets on the web) and in Yoga (configured as React Native configures it): a
 * container of a fixed size holding a box, the case, and another box, with three boxes inside the
 * case. The case is an item in the first and a container of the second, so a margin, a size, an
 * inset, a gap or an alignment all move something that is measured.
 */
import Yoga, {
  Align,
  BoxSizing,
  Direction,
  Display,
  Edge,
  Errata,
  FlexDirection,
  Gutter,
  Justify,
  Overflow,
  PositionType,
  Wrap,
  type Node,
} from 'yoga-layout';

/** The scene, as sizes. The same numbers build it in Chrome. */
export const SCENE = {
  container: { width: 400, height: 300 },
  before: { width: 50, height: 50 },
  after: { width: 50, height: 50 },
  inside: [
    { width: 30, height: 20 },
    { width: 40, height: 30 },
    { width: 20, height: 10 },
  ],
} as const;

/** A box, relative to the container's top left. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The boxes measured: the case, the boxes on either side of it, and the three inside it. */
export const MEASURED = ['case', 'before', 'after', 'inside0', 'inside1', 'inside2'] as const;
export type Measured = Record<(typeof MEASURED)[number], Box>;

/** React Native's own Yoga setup: its legacy errata, and a screen's pixel grid to round to. */
const config = Yoga.Config.create();
config.setErrata(Errata.All);
config.setPointScaleFactor(3);

/** The scene laid out by Yoga, with the case's resolved style on the case. */
export function layOut(
  style: Readonly<Record<string, unknown>>,
  viewport: { width: number; height: number },
  insideStyles: readonly Readonly<Record<string, unknown>>[] = [],
): Measured {
  const fixed = (size: { width: number; height: number }) => {
    const node = Yoga.Node.create(config);
    node.setWidth(size.width);
    node.setHeight(size.height);
    return node;
  };
  const container = fixed(SCENE.container);
  const before = fixed(SCENE.before);
  const after = fixed(SCENE.after);
  const target = Yoga.Node.create(config);
  apply(target, style);
  // Each box inside with what the case hands down to it: `space-x-2`'s margin, say.
  const inside = SCENE.inside.map((size, i) => {
    const node = fixed(size);
    apply(node, insideStyles[i] ?? {});
    return node;
  });
  inside.forEach((node, i) => target.insertChild(node, i));
  [before, target, after].forEach((node, i) => container.insertChild(node, i));
  // The container sits in a viewport-sized root, as a screen's root view does, so a viewport
  // unit and a percentage of the root mean the same on both sides.
  const root = Yoga.Node.create(config);
  root.setWidth(viewport.width);
  root.setHeight(viewport.height);
  root.insertChild(container, 0);
  root.calculateLayout(undefined, undefined, Direction.LTR);
  const box = (node: Node, offset = { left: 0, top: 0 }): Box => {
    const { left, top, width, height } = node.getComputedLayout();
    return { left: left + offset.left, top: top + offset.top, width, height };
  };
  const caseBox = box(target);
  const measured = {
    case: caseBox,
    before: box(before),
    after: box(after),
    inside0: box(inside[0]!, caseBox),
    inside1: box(inside[1]!, caseBox),
    inside2: box(inside[2]!, caseBox),
  };
  root.freeRecursive();
  return measured;
}

type Value = number | 'auto' | `${number}%` | undefined;
const value = (v: unknown): Value =>
  typeof v === 'number' || v === 'auto' || (typeof v === 'string' && /^-?[\d.]+%$/.test(v))
    ? (v as Value)
    : undefined;

/**
 * Each edge prop React Native reads, and the Yoga edge it sets: the broadest first, so a more
 * specific one, applied after it, wins as it does in React Native.
 */
const EDGES: readonly (readonly [string, Edge])[] = [
  ['', Edge.All],
  ['Horizontal', Edge.Horizontal],
  ['Vertical', Edge.Vertical],
  ['Block', Edge.Vertical],
  ['Inline', Edge.Horizontal],
  ['Top', Edge.Top],
  ['Right', Edge.Right],
  ['Bottom', Edge.Bottom],
  ['Left', Edge.Left],
  ['Start', Edge.Start],
  ['End', Edge.End],
  ['BlockStart', Edge.Top],
  ['BlockEnd', Edge.Bottom],
];

const ALIGN: Record<string, Align> = {
  auto: Align.Auto,
  'flex-start': Align.FlexStart,
  center: Align.Center,
  'flex-end': Align.FlexEnd,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
  'space-between': Align.SpaceBetween,
  'space-around': Align.SpaceAround,
  'space-evenly': Align.SpaceEvenly,
};
const JUSTIFY: Record<string, Justify> = {
  'flex-start': Justify.FlexStart,
  center: Justify.Center,
  'flex-end': Justify.FlexEnd,
  'space-between': Justify.SpaceBetween,
  'space-around': Justify.SpaceAround,
  'space-evenly': Justify.SpaceEvenly,
};

/** A React Native style, as the Yoga setters React Native's own props call. */
// eslint-disable-next-line complexity -- one flat case per layout prop
function apply(node: Node, style: Readonly<Record<string, unknown>>): void {
  const size = (key: string, set: (v: Value) => void) => {
    const v = value(style[key]);
    if (v !== undefined) set(v);
  };
  size('width', (v) => node.setWidth(v));
  size('height', (v) => node.setHeight(v));
  // `auto` is no limit, which is where a limit starts: React Native reads it as unset.
  const limit = (set: (v: number) => void) => (v: Value) => v !== 'auto' && set(v as number);
  size(
    'minWidth',
    limit((v) => node.setMinWidth(v)),
  );
  size(
    'minHeight',
    limit((v) => node.setMinHeight(v)),
  );
  size(
    'maxWidth',
    limit((v) => node.setMaxWidth(v)),
  );
  size(
    'maxHeight',
    limit((v) => node.setMaxHeight(v)),
  );
  size('flexBasis', (v) => node.setFlexBasis(v));
  for (const [suffix, edge] of EDGES) {
    size(`margin${suffix}`, (v) => node.setMargin(edge, v));
    size(`padding${suffix}`, (v) => node.setPadding(edge, v as number));
    const border = style[`border${suffix}Width`];
    if (typeof border === 'number') node.setBorder(edge, border);
  }
  for (const [key, edge] of [
    ['top', Edge.Top],
    ['right', Edge.Right],
    ['bottom', Edge.Bottom],
    ['left', Edge.Left],
    ['start', Edge.Start],
    ['end', Edge.End],
  ] as const) {
    size(key, (v) => node.setPosition(edge, v as number));
  }
  const words = style as Record<string, string | number | undefined>;
  if (words['position'] === 'absolute') node.setPositionType(PositionType.Absolute);
  if (words['position'] === 'static') node.setPositionType(PositionType.Static);
  if (words['flexDirection'] !== undefined) {
    node.setFlexDirection(
      {
        row: FlexDirection.Row,
        column: FlexDirection.Column,
        'row-reverse': FlexDirection.RowReverse,
        'column-reverse': FlexDirection.ColumnReverse,
      }[words['flexDirection'] as string]!,
    );
  }
  if (words['flexWrap'] !== undefined) {
    node.setFlexWrap(
      { wrap: Wrap.Wrap, nowrap: Wrap.NoWrap, 'wrap-reverse': Wrap.WrapReverse }[
        words['flexWrap'] as string
      ]!,
    );
  }
  if (typeof words['flex'] === 'number') node.setFlex(words['flex']);
  if (typeof words['flexGrow'] === 'number') node.setFlexGrow(words['flexGrow']);
  if (typeof words['flexShrink'] === 'number') node.setFlexShrink(words['flexShrink']);
  if (words['alignItems'] !== undefined) node.setAlignItems(ALIGN[words['alignItems'] as string]!);
  if (words['alignSelf'] !== undefined) node.setAlignSelf(ALIGN[words['alignSelf'] as string]!);
  if (words['alignContent'] !== undefined)
    node.setAlignContent(ALIGN[words['alignContent'] as string]!);
  if (words['justifyContent'] !== undefined)
    node.setJustifyContent(JUSTIFY[words['justifyContent'] as string]!);
  size('gap', (v) => node.setGap(Gutter.All, v as number));
  size('rowGap', (v) => node.setGap(Gutter.Row, v as number));
  size('columnGap', (v) => node.setGap(Gutter.Column, v as number));
  if (words['display'] === 'none') node.setDisplay(Display.None);
  if (words['display'] === 'contents') node.setDisplay(Display.Contents);
  if (words['overflow'] === 'hidden') node.setOverflow(Overflow.Hidden);
  if (words['overflow'] === 'scroll') node.setOverflow(Overflow.Scroll);
  if (typeof words['aspectRatio'] === 'number') node.setAspectRatio(words['aspectRatio']);
  if (words['boxSizing'] === 'content-box') node.setBoxSizing(BoxSizing.ContentBox);
}
