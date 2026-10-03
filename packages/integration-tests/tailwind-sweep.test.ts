/**
 * Every Tailwind 4 utility, swept: see `tailwind-sweep-suite.ts` for the checks and
 * `fixtures/tailwind-sweep.ts` for the cases. Update the refusal snapshot with
 *
 *   TAILWIND_SWEEP_UPDATE=1 node --import @solidnative/testing/register --test tailwind-sweep.test.ts
 */
import { defineSweep, type Accounted } from './tailwind-sweep-suite.ts';
import { buildFor, measuredIn, sweep, WORLDS } from './fixtures/tailwind-sweep.ts';

/** Differences that are design decisions: native does not match, on purpose. */
const DELIBERATE: readonly Accounted[] = [
  {
    world: 'web',
    property: /./,
    case: /(^|:)(ios|android|native|web):/,
    reason:
      'A platform variant applies on its own platform: `ios:` and `native:` on a phone, `web:` on ' +
      'the web host. The web world is held to what a phone resolves.',
  },
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
    property: /^border-(top|right|bottom|left)-width$/,
    case: /^divide-[xy]-\(--x\)!?$/,
    browser: /^3px$/,
    reason:
      'The sweep never sets `--x`. A browser drops a width that reads an unset token and draws ' +
      "the initial one, `medium`; native draws none. An app's own token is set.",
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
    property: /^cursor$/,
    browser: /^default$/,
    reason: "The arrow a pointer draws over anything that is not a link: native's auto.",
  },
  {
    property: /^display$/,
    browser: /^(inline-flex|flow-root|inline-block|inline|block|-webkit-box)$/,
    reason:
      'Yoga lays out flex boxes and nothing else; block and flow-root are read as flex, and an ' +
      'inline box as the flex box it sits in (ADR 0001).',
  },
  {
    property: /^(justify-content|align-content|align-items|align-self)$/,
    browser: /^safe /,
    reason:
      'Yoga has no safe alignment, which keeps overflowing content from spilling off the start; ' +
      'the alignment itself is kept.',
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
];

/**
 * Known gaps: native does something the browser does not, and should not. Each is an open issue;
 * the test fails when one stops happening, so this list cannot outlive the bug.
 */
const KNOWN: readonly Accounted[] = [];

/**
 * Where Yoga itself lays out differently from a browser: nothing the engine writes can change it.
 * The layout half of the sweep runs the npm release of Yoga, which may trail the one React Native
 * vendors, so each of these wants confirming on a device before it is taken as what a phone does.
 */
const YOGA: readonly Accounted[] = [
  {
    property: /^layout /,
    case: /^(m|my|mt|mb|mbs|mbe)(-safe)?-96!?$/,
    reason:
      'Yoga caps a box at the room left after its margins, and a margin larger than its container ' +
      'leaves none: the box is 0 high where a browser keeps its content height and overflows.',
  },
  {
    property: /^layout /,
    case: /^min-(h|block)-(full|11\/12|\[37%\])!?$/,
    reason:
      "Yoga 3.2 resolves a percentage min-height against the grandparent's height rather than " +
      "the parent's: in the scene, the root's; on device, min-h-1/2 in a 40-high box inside an " +
      '80-high one is 40 high, not 20.',
  },
  {
    property: /^layout /,
    case: /^gap(-y)?-\[37%\]!?$/,
    reason:
      'A percentage gap along an axis with no size of its own is circular: a browser resolves it ' +
      'against the size it ends up with, and Yoga grows the box by it.',
  },
];

/** Cases that compile to nothing with nothing to say, and why that is right. */
const SILENT_BY_DESIGN: readonly (readonly [RegExp, string])[] = [
  [
    /^snap-(mandatory|proximity)!?$/,
    'Sets only the slot `snap-x` and `snap-y` read, which are refused.',
  ],
  [/^mask-/, 'Sets only a slot the mask utilities read, which are refused.'],
  [
    /^(duration|ease|text-shadow)-initial!?$/,
    'Resets a slot to its default, which is what an element without the class already has.',
  ],
];

/** Cases that compile to nothing and should not: open issues, as KNOWN is. */
const SILENT_KNOWN: readonly (readonly [RegExp, string])[] = [];

/** Props React Native does not declare, which the engine writes on purpose. */
const UNDECLARED: readonly Accounted[] = [];

defineSweep({
  title: 'every Tailwind utility',
  sweep,
  buildFor: (cases) => buildFor(cases),
  worlds: WORLDS,
  measuredIn,
  snapshot: 'tailwind-sweep-drops.json',
  oracle: 'tailwind-sweep-oracle.json',
  deliberate: DELIBERATE,
  known: KNOWN,
  yoga: YOGA,
  silentByDesign: SILENT_BY_DESIGN,
  silentKnown: SILENT_KNOWN,
  undeclared: UNDECLARED,
});
