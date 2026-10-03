/**
 * Every Tailwind 3 utility, swept: the same checks as Tailwind 4's (`tailwind-sweep-suite.ts`), on
 * the cases in `fixtures/tailwind-v3-sweep.ts`. Update the refusal snapshot and the oracle with
 *
 *   TAILWIND_SWEEP=v3 pnpm tailwind-oracle
 *   TAILWIND_SWEEP_UPDATE=1 node --import ./register-linker.mjs --test tailwind-v3-sweep.test.ts
 *
 * The lists are Tailwind 3's own: each fails when it goes stale, and an entry that only Tailwind 4
 * triggers would be stale here.
 */
import { defineSweep, type Accounted } from './tailwind-sweep-suite.ts';
import { buildFor, measuredIn, sweep, WORLDS } from './fixtures/tailwind-v3-sweep.ts';

/** Differences that are design decisions: native does not match, on purpose. */
const DELIBERATE: readonly Accounted[] = [
  {
    property: /^align-content$/,
    browser: /^baseline$/,
    reason:
      'Neither engine has a baseline for the lines of a wrapping box: CSS falls back to start, ' +
      'and React Native does not take the word, so it is compiled to the start it comes to.',
  },
  {
    where: 'child',
    property: /^text-wrap-mode$/,
    reason:
      'Truncation is read on the text it is on: a view around the text keeps it to one line on ' +
      'the web and does nothing on native. Put `truncate` or `whitespace-nowrap` on the text; ' +
      'see supported-css.md.',
  },
  {
    where: 'child',
    property: /^(cursor|pointer-events)$/,
    reason:
      "Native applies a view's cursor and its pointer events to everything inside it, so the " +
      'text needs no value of its own for either.',
  },
  {
    property: /^overflow-[xy]$/,
    browser: /^(auto|clip)$/,
    reason:
      'Native has visible, hidden and scroll. `auto` is a scroll container on the web, which is ' +
      'what Yoga lays out for scroll; `clip` hides what overflows, which is hidden.',
  },
  {
    property: /^display$/,
    browser: /^(inline-flex|flow-root|inline-block|inline|block|-webkit-box)$/,
    reason:
      'Yoga lays out flex boxes and nothing else; block and flow-root are read as flex, and an ' +
      'inline box as the flex box it sits in (ADR 0001).',
  },
  {
    property: /^font-weight$/,
    reason:
      'Native draws the nine hundreds and no weight between them, so an arbitrary weight is the ' +
      'nearest one: see `weight()` in values.cjs.',
  },
  {
    property: /^object-fit$/,
    browser: /^scale-down$/,
    reason:
      'Native has no scale-down; contain is what it comes to for any image larger than its box.',
  },
  {
    world: 'dark',
    property: /./,
    case: /^!?ios:dark:/,
    reason:
      'Tailwind 3 writes `ios:dark:` as `.dark .platform-ios .x`, which on the web needs the two ' +
      'classes on two ancestors in that order. `mount` puts both on the root, so the engine takes ' +
      'the two in either order or on one element, as it does for Tailwind 4 (expandStackedVariants).',
  },
  {
    property: /^\(ours only\) experimental_backgroundImage$/,
    case: /^bg-gradient-to-\w+ via-/,
    reason:
      'A `via-*` with no `from-*`: Tailwind 3 reads a `--tw-gradient-from` nothing set, which makes ' +
      'the whole gradient invalid on the web. Native paints the stops it has.',
  },
];

/** Known gaps, as in `tailwind-sweep.test.ts`: each fails the sweep once it stops happening. */
const KNOWN: readonly Accounted[] = [];

/** Where Yoga itself lays out differently from a browser, as in `tailwind-sweep.test.ts`. */
const YOGA: readonly Accounted[] = [
  {
    property: /^layout /,
    case: /^!?(m|my|mt|mb)-56$/,
    reason:
      'As in Tailwind 4: Yoga caps a box at the room left after its margins, and a margin larger ' +
      'than its container leaves none.',
  },
  {
    property: /^layout /,
    case: /^!?min-h-\[37%\]$/,
    reason:
      "As in Tailwind 4: Yoga 3.2 resolves a percentage min-height against the grandparent's height.",
  },
  {
    property: /^layout /,
    case: /^!?gap(-y)?-\[37%\]$/,
    reason:
      'As in Tailwind 4: a percentage gap along an axis with no size of its own is circular, and ' +
      'Yoga grows the box by it.',
  },
];

/** Cases that compile to nothing with nothing to say, and why that is right. */
const SILENT_BY_DESIGN: readonly (readonly [RegExp, string])[] = [
  [
    /^!?snap-(mandatory|proximity)$/,
    'Sets only the slot `snap-x` and `snap-y` read, which are refused.',
  ],
  [
    /^!?placeholder-opacity-/,
    "Sets only the slot a `placeholder-*` colour reads, and `::placeholder` is refused: a text field's placeholder colour is its `placeholderTextColor` prop.",
  ],
];

/** Cases that compile to nothing and should not: open issues, as KNOWN is. */
const SILENT_KNOWN: readonly (readonly [RegExp, string])[] = [];

/** Props committed that React Native does not declare: open issues. */
const UNDECLARED: readonly Accounted[] = [];

defineSweep({
  title: 'every Tailwind 3 utility',
  sweep,
  buildFor,
  worlds: WORLDS,
  measuredIn,
  snapshot: 'tailwind-v3-sweep-drops.json',
  oracle: 'tailwind-v3-sweep-oracle.json',
  deliberate: DELIBERATE,
  known: KNOWN,
  yoga: YOGA,
  silentByDesign: SILENT_BY_DESIGN,
  silentKnown: SILENT_KNOWN,
  undeclared: UNDECLARED,
});
