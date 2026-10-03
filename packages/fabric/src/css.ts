/**
 * Runtime half of the CSS system: selector matching and the cascade.
 *
 * All the expensive work happened at build time (parsing, longhand expansion, value conversion,
 * specificity maths, sorting), so this only walks a pre-sorted rule list and merges. It is
 * framework-agnostic.
 */
import { type HueMethod, type MixSpace, mixColours } from './color-mix.ts';
import { type Channel, relativeColour } from './relative-colour.ts';
import type { Keyframe } from './transition.ts';

/** One `[name]` or `[name op "value"]` test. */
export interface AttributeTest {
  readonly name: string;
  /** Absent means a presence test. */
  readonly operator?: 'equal' | 'prefix' | 'suffix' | 'substring' | 'includes' | 'dash-match';
  readonly value?: string;
  /** The `i` flag: the value is compared without case, and is written here in lower case. */
  readonly insensitive?: true;
}

export interface Compound {
  readonly type?: string;
  readonly id?: string;
  /** `:root`: the node at the top of the tree. */
  readonly root?: true;
  readonly classes: readonly string[];
  readonly attributes?: readonly AttributeTest[];
  /** `:is()` / `:where()` arguments: the compound matches if any of these do. */
  readonly is?: readonly (readonly Compound[])[];
  /** `:not()` arguments: the compound matches only if none of these do. */
  readonly not?: readonly Compound[];
  /** `:host`: the node must be the host of the component whose sheet is being evaluated. */
  readonly host?: true;
  /** `:host-context()`: the host, or one of its ancestors, must match one of these. */
  readonly hostContext?: readonly Compound[];
  /**
   * `:is(<compound> *)`: every one of these must match some ancestor, the node itself excluded.
   * What Tailwind's `group-*` variants compile to.
   */
  readonly ancestors?: readonly Compound[];
  /** Interaction state the engine tracks: `:focus` and `:active`. */
  readonly pseudo?: readonly ('focus' | 'active')[];
  /**
   * `:first-child` and its family, reduced to the counting tests CSS defines them as. More than
   * one because `:only-child` is two: first from the start and first from the end.
   */
  readonly nth?: readonly NthTest[];
  /** `:empty`: no children at all, text included. */
  readonly empty?: true;
}

/** `an + b`, counted from the start unless `fromEnd`. */
export interface NthTest {
  readonly a: number;
  readonly b: number;
  readonly fromEnd?: true;
}

export type Combinator = 'descendant' | 'child' | 'next-sibling' | 'later-sibling';

export interface StyleRule {
  readonly compounds: readonly Compound[];
  /** Between compounds; length is `compounds.length - 1`. */
  readonly combinators: readonly Combinator[];
  readonly specificity: number;
  readonly order: number;
  readonly declarations: Readonly<Record<string, unknown>>;
  readonly important?: Readonly<Record<string, unknown>>;
  /** Custom properties this rule defines, pre-converted into every form a use site might want. */
  readonly tokens?: Readonly<Record<string, TokenValue>>;
  /** Declarations whose value is a `var()`, resolved once the token map is known. */
  readonly deferred?: readonly DeferredDeclaration[];
  /** The media query guarding this rule, if any. */
  readonly condition?: MediaCondition;
  /** Memo of the last condition evaluation, and the conditions version it was made against. */
  activeAt?: number;
  active?: boolean;
}

export type MediaCondition =
  | { readonly all: readonly MediaCondition[] }
  | { readonly any: readonly MediaCondition[] }
  | {
      readonly feature: 'width' | 'height';
      readonly op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
      readonly value: number;
    }
  | {
      readonly feature: 'orientation' | 'prefers-color-scheme' | 'prefers-reduced-motion';
      readonly value: string;
    };

/** What media queries are evaluated against. Pushed in by the host: the engine imports no RN. */
export interface Conditions {
  readonly width: number;
  readonly height: number;
  readonly colorScheme: 'light' | 'dark';
  /**
   * The user asked for less animation. Optional because it is a preference rather than a
   * measurement: an app that never asks the platform gets `no-preference`, which is what a
   * platform that cannot answer means anyway.
   */
  readonly reducedMotion?: boolean;
}

/** A custom property's value, in each form it can legally take. Absent forms are unusable. */
export interface TokenValue {
  readonly length?: number | string;
  /** An angle, in degrees whatever unit it was written in. */
  readonly angle?: number;
  /** A time, in milliseconds whatever unit it was written in. */
  readonly time?: number;
  readonly color?: string;
  readonly keyword?: string;
  readonly number?: number;
  /** A font weight, as the string `fontWeight` takes. */
  readonly weight?: string;
  /** The first family of a font stack. A single word is read from `keyword` instead. */
  readonly family?: string;
  /**
   * A bare number as a line-height: a multiple of the font size, settled where it is used. A
   * length is read from `length` instead.
   */
  readonly lineHeight?: { readonly __defer: DeferredDeclaration['compute'] };
  /** A whole shadow list, in the processed shape `boxShadow` takes. */
  readonly shadow?: readonly unknown[];
  /** One filter function, as the one-entry list `filter` takes: a slot of Tailwind's filters. */
  readonly filter?: readonly unknown[];
  /** One transform function, as the one-entry list `transform` takes: a 3D rotation or skew. */
  readonly transform?: readonly unknown[];
  /** One font variant, as the one-entry list `fontVariant` takes: a numeric variant's slot. */
  readonly fontVariant?: readonly string[];
  /** Bare colour channels, `13, 110, 253`, for an `rgba(var(--x), <alpha>)` to finish. */
  readonly channels?: readonly number[];
  /**
   * Defined as `rgba(var(--channels), <alpha>)`: a colour made of a channels token and an alpha
   * written or tokened. Settled on the node that defines it, as an `hsl` one is.
   */
  readonly deferredColour?: Extract<ColourExpression, { channels: unknown }>;
  /**
   * Defined as another token, `var(--name)`. Resolved on the node that defines it, against the
   * tokens in scope there, and passed down resolved - which is what a browser does.
   */
  readonly alias?: string;
  /** What an alias becomes when the token it names is not defined. */
  readonly fallback?: TokenValue;
  /**
   * Defined as `hsl(var(--h), var(--s), var(--l))`, or `hsla()` with an alpha: how Bulma writes
   * every colour. Resolved into `color` on the node that defines it, alongside its aliases, so a
   * use site never has to know a token was ever built this way.
   */
  readonly hsl?: {
    readonly h: HslChannel;
    readonly s: HslChannel;
    readonly l: HslChannel;
    readonly alpha?: HslChannel;
  };
}

/** One channel of an `hsl()` token: settled at build time, or a token to read at match time. */
export type HslChannel = number | { readonly reference: string; readonly fallback?: number };

/** The forms a token can be read in: one per kind of value a use site can need. */
export type TokenKind =
  | 'length'
  | 'color'
  | 'keyword'
  | 'number'
  | 'weight'
  | 'family'
  | 'lineHeight'
  | 'shadow'
  | 'filter'
  | 'transform'
  | 'fontVariant'
  | 'channels';

/**
 * Where a form a token does not have can be read from instead. A length is already a
 * line-height and a single word is already a family, so neither is stored twice in every token
 * that happens to be one. The compiler reads fallbacks with the same table.
 */
const STAND_IN: Partial<Record<TokenKind, TokenKind>> = { lineHeight: 'length', family: 'keyword' };

function formOf(token: TokenValue | undefined, kind: TokenKind): unknown {
  if (!token) return undefined;
  const stand = STAND_IN[kind];
  return token[kind] ?? (stand ? token[stand] : undefined);
}

export interface DeferredDeclaration {
  /**
   * The React Native style properties this lands in. Usually one, but a four-sided shorthand is
   * unambiguous given a single-valued token, so `padding: var(--gap)` writes all four.
   */
  readonly props: readonly string[];
  /** A `var()` reference. Exactly one of this and `compute` is present. */
  readonly kind?: TokenKind;
  readonly reference?: string;
  /**
   * The tokens a fallback that is itself a `var()` names, tried in turn when `reference` is not
   * defined: `var(--a, var(--b, green))` is `--a`, then `--b`, then `green`.
   */
  readonly alternatives?: readonly string[];
  readonly fallback?: unknown;
  /**
   * What to write when the reference resolves, whatever it resolves to: `flex: var(--grow)` sets a
   * shrink of 1 and a basis of 0%, but only when there is a grow for them to go with.
   */
  readonly whenSet?: unknown;
  /**
   * What to write when the reference resolves to nothing: the property's initial value, which is
   * what a browser gives a property whose `var()` cannot be substituted. Only where it differs
   * from leaving the property out: `flex-shrink` starts at 1 in CSS and at 0 in Yoga.
   */
  readonly unset?: unknown;
  /**
   * For a colour built from `channels`, the token its alpha comes from:
   * `rgba(var(--bs-primary-rgb), var(--bs-bg-opacity))`. A written alpha is an `adjust` instead.
   */
  readonly alpha?: { readonly reference: string; readonly fallback?: number };
  /**
   * A gradient whose stops are custom properties, filled in once a node's tokens are known. What
   * a utility framework's `from-*` and `to-*` classes compile to, since the class that paints the
   * gradient is not the class that supplies its colours.
   */
  readonly gradient?: GradientTemplate | readonly GradientTemplate[];
  /**
   * Arithmetic around the reference, settled at build time. `value * scale + offset`, then no
   * smaller than `floor`. What `calc(var(--x) + 12px)` and `max(var(--x), 16px)` become.
   */
  readonly adjust?: {
    readonly scale?: number;
    readonly offset?: number;
    readonly floor?: number;
    /**
     * A fraction to multiply the resolved colour's alpha by. What
     * `color-mix(in oklab, var(--x) 90%, transparent)` becomes, which is Tailwind's `/90`.
     */
    readonly alpha?: number;
  };
  /** Declared `!important`: ranked with the important declarations, not the plain ones. */
  readonly important?: true;
  /**
   * A length relative to the viewport or to the font size in scope, plus an absolute `offset`
   * when it came from a sum: `calc(1.375rem + 1.5vw)` is 1.5vw with 22 added.
   */
  readonly compute?: {
    readonly unit: 'em' | 'vw' | 'vh' | 'vmin' | 'vmax';
    readonly factor: number;
    readonly offset?: number;
  };
  /**
   * A structured value - a transform list, a shadow, a filter - with lengths like `compute`'s
   * somewhere inside it, each marked `{ __defer: compute }`. Filled in where it is used.
   */
  readonly within?: unknown;
}

/**
 * A colour a deferred value is made of: settled at build time, a token, or a `color-mix()` of two
 * such, worked out once the tokens are known. What a gradient stop, a shadow's colour or a colour
 * property with a `var()` in a mix becomes.
 */
export type ColourExpression =
  | { readonly color: string }
  | {
      readonly reference: string;
      readonly alternatives?: readonly string[];
      readonly fallback?: string;
    }
  | {
      /** A token of bare channels, as `rgba(var(--channels), <alpha>)` reads it. */
      readonly channels: { readonly reference: string; readonly fallback?: readonly number[] };
      readonly alpha?: number | { readonly reference: string; readonly fallback?: number };
    }
  | { readonly hsl: NonNullable<TokenValue['hsl']> }
  | {
      /** `oklch(from <colour> <channel> <channel> <channel> [/ <alpha>])`. */
      readonly relative: {
        readonly space: MixSpace;
        readonly from: ColourExpression;
        readonly channels: readonly [Channel, Channel, Channel];
        readonly alpha?: Channel;
      };
    }
  | {
      readonly mix: {
        readonly space: MixSpace;
        readonly hue?: HueMethod;
        readonly a: ColourExpression;
        readonly aPercentage?: number;
        readonly b: ColourExpression;
        readonly bPercentage?: number;
      };
    };

/** One component's compiled styles, pre-sorted by specificity then source order. */
/**
 * A gradient with holes in it: everything but the stop colours is settled at build time.
 *
 * The shape is React Native's own processed one, so filling it in is a copy with the references
 * resolved rather than a translation.
 */
export interface GradientTemplate {
  readonly type: 'linear-gradient' | 'radial-gradient';
  readonly colorStops: readonly {
    /** The custom property holding this stop's colour. A stop with no colour is not painted. */
    readonly reference?: string;
    /** A colour made from tokens and literals instead, such as a `color-mix()` of one. */
    readonly colour?: ColourExpression;
    readonly positionReference?: string;
    readonly position?: string | number;
  }[];
  /**
   * A radial gradient's centre, by the edges native measures from: each offset written, or a
   * token with what is written beside its name to use when it is not set.
   */
  readonly position?: Readonly<
    Record<
      string,
      string | number | { readonly reference: string; readonly fallback?: string | number }
    >
  >;
}

export interface StyleSheet {
  readonly rules: readonly StyleRule[];
  /**
   * `@keyframes` by name. Global within a sheet, as they are within a document; the engine keeps
   * one registry across every sheet it sees, so a name defined in a global stylesheet is usable
   * from a component's.
   */
  readonly keyframes?: Readonly<Record<string, readonly Keyframe[]>>;
  /**
   * Whether any rule here asks about a node's position among its siblings.
   *
   * Said on the sheet because what these cost is not matching but invalidation: adding a row
   * changes what its neighbours match while nothing about those neighbours moved, so the engine
   * has to re-resolve a whole child list when it changes. It only does that where a sheet asks.
   */
  readonly structural?: true;
}

/**
 * What one node resolved to. `style` is what it renders with; `inherited` is what its children
 * start from, which is the parent's own `inherited` plus whatever inheritable values this node
 * set. Keeping the two apart is what lets resolution go downwards.
 */
export interface StyleCache {
  epoch: number;
  /**
   * Identity token standing for "the ancestor chain, as far as matching is concerned". A node
   * mints a fresh one whenever it recomputes, and reuses its previous one when it does not, so a
   * descendant can tell whether anything above it moved with a single reference comparison.
   *
   * It has to cover more than the inherited values. `.wrap.dark .label` and
   * `:host-context(.dark) .label` both change what a descendant matches when a class toggles on
   * an ancestor, while nothing inherited changes at all, so watching the inherited map alone
   * leaves those stale.
   */
  context: object;
  /** The parent's `context` this was computed from. */
  parentContext: object;
  /** The conditions version this was resolved under. */
  generation: number;
  style: Record<string, unknown>;
  inherited: Record<string, unknown>;
  /**
   * Custom properties in scope for this node and its descendants. Cascades exactly as inherited
   * values do, and by the same copy-on-write rule, so a subtree that defines none shares one map.
   */
  tokens: Readonly<Record<string, TokenValue>>;
  /** The rules that matched, in cascade order, when it was cascaded: what `resolve` reuses by. */
  rules?: readonly StyleRule[];
}

/** What the matcher needs of a node. The engine's node satisfies this structurally. */
export interface StyleTarget {
  readonly name: string;
  readonly parent: StyleTarget | null;
  /**
   * Needed only by the selectors that ask about a node's place among its siblings, which is why
   * it is read through the parent rather than kept as an index: an index would have to be right
   * after every insertion and removal, and this is right by construction.
   */
  readonly children?: readonly StyleTarget[];
  /**
   * Only elements are counted by the selectors that ask about position. Text is not one, and
   * neither is an anchor (`Engine.createAnchor`), a placeholder a renderer may leave where
   * conditional content goes - the same reason a browser does not count a comment. Absent means
   * element, so a hand-built target needs nothing extra.
   */
  readonly kind?: string;
  readonly classes: ReadonlySet<string> | null;
  readonly props: Readonly<Record<string, unknown>>;
  /**
   * The sheet this node's own rules come from, which is the sheet of the component whose renderer
   * created it. Read from the node rather than passed in, because a node's ancestors usually
   * belong to other components and must be matched against their own sheets, not this one's.
   */
  readonly sheet: StyleSheet | null;
  /**
   * The sheet of the component this node is the *host* of, if it is one. Distinct from `sheet`,
   * which is the sheet of the component that *created* it: a host node is created by the parent,
   * so those two are always different sheets and `:host` needs the second.
   */
  hostSheet: StyleSheet | null;
  /**
   * Custom properties set on the node itself, `[style.--tint]` or `style="--tint: red"`, already
   * converted (`inline-token.ts`). In scope for its own rules and its descendants', and stronger
   * than any rule's, as inline style is on the web. Absent on a hand-built target.
   */
  readonly customProperties?: Readonly<Record<string, TokenValue>> | null;
  /** Memo slot, owned by the resolver. */
  styleCache: StyleCache | null;
  /** Set when something that could change what this node matches has changed. */
  styleDirty: boolean;
  /**
   * Set once a selector has read where this node stands among its siblings (`:nth-*`,
   * `:first-child`, a sibling combinator), its own or a descendant's. Only such a node can match
   * differently when its parent's child list changes, so only it is marked then
   * (`Engine.markStructure`). Never cleared: a stale mark costs a resolve, a missing one a bug.
   */
  positionRead?: boolean;
  /**
   * Whether anything a selector reads of this node itself has changed since its last commit:
   * classes, props, `:focus`, `:active`. False lets a node marked only because its child list
   * moved keep its context when it matches as before (`resolve`); absent never does.
   */
  readonly propsDirty?: boolean;
  /** `:focus`. Set by the engine from the native focus and blur events. */
  focused?: boolean;
  /**
   * `:active`. Set by the engine on the responder and every one of its ancestors, because a press
   * activates the whole chain on the web too, not only the deepest element under the finger.
   */
  active?: boolean;
}

/**
 * Properties CSS inherits that mean something on native.
 *
 * RN does not inherit these: a `color` on a view has no effect on a text inside it, only a text
 * inside a text inherits. CSS authors expect otherwise, and a stylesheet written against that
 * expectation would silently lose every colour, so the cascade emulates inheritance for exactly
 * this set. NativeScript does the same.
 */
const INHERITED = new Set([
  'color',
  // Yoga inherits it for layout already; carried here as well so a paragraph can align by it.
  'direction',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textAlign',
  'textTransform',
  'textDecorationLine',
  'writingDirection',
  // CSS inherits a text shadow, and `user-select: auto` takes the parent's, so a card's
  // `text-shadow-md` or `select-none` reaches the text inside it.
  'textShadowOffset',
  'textShadowRadius',
  'textShadowColor',
  'selectable',
]);

/**
 * `border-style: none`, which the compiler writes as a style native does not have. On the web it
 * makes every border width 0, whichever rule set the width, so `border-hidden border-x` draws no
 * side. Settled here, once the cascade has picked a style, and not sent on.
 */
function drawNoBorder(own: Record<string, unknown>): void {
  delete own['borderStyle'];
  for (const key of Object.keys(own)) if (/^border\w*Width$/.test(key)) own[key] = 0;
  own['borderWidth'] = 0;
}

/**
 * Deterministic work counters for the matcher.
 *
 * Wall-clock is noise; a compound comparison is not. Asserting on these catches an algorithmic
 * regression (a walk that became quadratic, a cache that stopped hitting) in a way that a timing
 * assertion never could without being flaky. `test/css-cost.test.ts` holds the baselines.
 *
 * The cost is one integer increment per comparison, against a Set lookup and several property
 * reads, so it does not distort what it measures.
 */
export const styleStats = {
  /** Calls to `matchesCompound`, the innermost unit of matching work. */
  compoundTests: 0,
  /** Rules considered, i.e. calls to `matches`. */
  ruleTests: 0,
  /** Nodes cascaded, as opposed to handed back from the memo. */
  nodesResolved: 0,
};

export function resetStyleStats(): void {
  styleStats.compoundTests = 0;
  styleStats.ruleTests = 0;
  styleStats.nodesResolved = 0;
}

/** A prop's value as an attribute test compares it: in lower case, under the i flag. */
const attributeText = (actual: unknown, test: AttributeTest): string =>
  test.insensitive ? String(actual).toLowerCase() : String(actual);

/**
 * `[disabled]`, and the value operators.
 *
 * A prop set to `false` or `null` counts as absent, matching the web, where an attribute is either
 * present or not and a `disabled` binding that evaluates false removes it. Everything else is
 * compared as a string, so `[tabIndex="0"]` works against a numeric prop.
 */
function matchesAttribute(node: StyleTarget, test: AttributeTest): boolean {
  const actual = node.props[test.name];
  if (actual === undefined || actual === null || actual === false) return false;
  if (test.operator === undefined) return true;

  const value = attributeText(actual, test);
  switch (test.operator) {
    case 'equal':
      return value === test.value;
    case 'prefix':
      return value.startsWith(test.value!);
    case 'suffix':
      return value.endsWith(test.value!);
    case 'substring':
      return value.includes(test.value!);
    case 'includes':
      // `~=` matches one whole word of a space-separated list.
      return value.split(/\s+/).includes(test.value!);
    case 'dash-match':
      // `|=` matches the value itself or the value followed by a hyphen, as `lang` uses.
      return value === test.value || value.startsWith(`${test.value}-`);
  }
}

/*
 * Exempt from the complexity limit deliberately. This is a flat conjunction of independent
 * guards, not nested logic: cyclomatic complexity scores the two the same, and they are not the
 * same thing. It is also the hottest function in the matcher, called tens of thousands of times
 * per commit, so splitting each guard into its own call would cost more than it reads better.
 */
// eslint-disable-next-line complexity
function matchesCompound(node: StyleTarget, compound: Compound, sheet: StyleSheet | null): boolean {
  styleStats.compoundTests++;
  if (compound.host !== undefined && node.hostSheet !== sheet) return false;
  if (compound.root !== undefined && node.parent !== null) return false;
  if (compound.pseudo !== undefined) {
    for (const state of compound.pseudo) {
      if (state === 'focus' ? !node.focused : !node.active) return false;
    }
  }
  if (compound.type !== undefined && compound.type !== node.name) return false;
  if (compound.id !== undefined && node.props['nativeID'] !== compound.id) return false;
  for (const className of compound.classes) {
    if (!node.classes?.has(className)) return false;
  }
  if (compound.attributes) {
    for (const test of compound.attributes) {
      if (!matchesAttribute(node, test)) return false;
    }
  }
  // An anchor is a comment on the web, and :empty does not see comments.
  if (compound.empty !== undefined && node.children?.some((child) => child.kind !== 'anchor')) {
    return false;
  }
  if (compound.nth !== undefined) {
    for (const test of compound.nth) {
      if (!matchesNth(node, test)) return false;
    }
  }
  if (compound.not) {
    for (const excluded of compound.not) {
      if (matchesCompound(node, excluded, sheet)) return false;
    }
  }
  if (compound.is) {
    for (const alternatives of compound.is) {
      if (!alternatives.some((option) => matchesCompound(node, option, sheet))) return false;
    }
  }
  if (compound.ancestors) {
    for (const ancestor of compound.ancestors) {
      let found = false;
      // From the parent: a descendant combinator never matches the node against itself.
      for (let n = node.parent; n && !found; n = n.parent) {
        found = matchesCompound(n, ancestor, sheet);
      }
      if (!found) return false;
    }
  }
  if (compound.hostContext) {
    // The host itself counts, as it does on the web.
    let found = false;
    for (let n: StyleTarget | null = node; n && !found; n = n.parent) {
      found = compound.hostContext.some((option) => matchesCompound(n!, option, sheet));
    }
    if (!found) return false;
  }
  return true;
}

/**
 * Right-to-left matching, as every CSS engine does it: the rightmost compound is the cheapest
 * filter and rejects almost everything immediately.
 */
export function matches(
  node: StyleTarget,
  rule: StyleRule,
  sheet: StyleSheet | null = null,
): boolean {
  styleStats.ruleTests++;
  const last = rule.compounds.length - 1;
  const subject = rule.compounds[last]!;
  // From the sheet of the component this node hosts, only a :host rule reaches it. Its other
  // rules are for the elements inside that component, which is how emulated encapsulation scopes
  // them on the web; without this, a class the parent puts on the host picks up the child's rule
  // of the same name.
  if (
    sheet !== null &&
    sheet === node.hostSheet &&
    sheet !== node.sheet &&
    subject.host === undefined
  ) {
    return false;
  }
  // `.space-x-3 > :not(:last-child)`: the parent's classes settle it for nearly every node, and
  // cheaply, where the subject alone would read each node's position first.
  const gate = parentGate(rule);
  if (gate !== null) {
    const classes = node.parent?.classes;
    if (!classes) return false;
    for (let i = 0; i < gate.length; i++) if (!classes.has(gate[i]!)) return false;
  }
  if (!matchesCompound(node, subject, sheet)) return false;
  return matchPrefix(node, rule, last - 1, sheet);
}

function sameRules(a: readonly StyleRule[] | undefined, b: readonly StyleRule[]): boolean {
  if (a === undefined || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Rule memo of `parentGate`: null when the rule asks nothing of the parent's classes. */
const gates = new WeakMap<StyleRule, readonly string[] | null>();

/** The classes a rule's subject's parent must have, when a child combinator joins them. */
function parentGate(rule: StyleRule): readonly string[] | null {
  let gate = gates.get(rule);
  if (gate === undefined) {
    const last = rule.compounds.length - 1;
    const classes =
      last > 0 && rule.combinators[last - 1] === 'child'
        ? requiredClasses(rule.compounds[last - 1]!)
        : [];
    gates.set(rule, (gate = classes.length ? classes : null));
  }
  return gate;
}

/** Classes a node must have to match a compound: its own, and those of a one-option `:is()`. */
function requiredClasses(compound: Compound): string[] {
  const classes = [...compound.classes];
  for (const options of compound.is ?? []) {
    if (options.length === 1) classes.push(...requiredClasses(options[0]!));
  }
  return classes;
}

/**
 * Match the part of a selector to the left of an already-matched compound.
 *
 * `index` is the compound still to match, counting leftwards, and `from` is where to start
 * looking. A descendant combinator tries every ancestor and, crucially, keeps trying when the
 * rest of the selector does not work out from there. Taking the first ancestor that fits and
 * committing to it misses `.a > .b .c` whenever the nearest `.b` fails the child combinator while
 * a further one satisfies it, which is what the browser differential suite caught.
 */
function matchPrefix(
  matched: StyleTarget,
  rule: StyleRule,
  index: number,
  sheet: StyleSheet | null,
): boolean {
  if (index < 0) return true;

  const compound = rule.compounds[index]!;
  // `combinators[index]` joins this compound to the one on its right.
  switch (rule.combinators[index]) {
    case 'child':
      return matchStep(matched.parent, rule, index, compound, sheet);
    case 'next-sibling':
      return matchStep(previousElement(matched), rule, index, compound, sheet);
    case 'later-sibling':
      return matchAny(previousElement(matched), previousElement, rule, index, compound, sheet);
    default:
      return matchAny(matched.parent, (node) => node.parent, rule, index, compound, sheet);
  }
}

/** A combinator with exactly one candidate: the parent, or the sibling immediately before. */
function matchStep(
  candidate: StyleTarget | null,
  rule: StyleRule,
  index: number,
  compound: Compound,
  sheet: StyleSheet | null,
): boolean {
  if (!candidate || !matchesCompound(candidate, compound, sheet)) return false;
  return matchPrefix(candidate, rule, index - 1, sheet);
}

/**
 * A combinator with many candidates: every ancestor, or every earlier sibling.
 *
 * Crucially it keeps trying when the rest of the selector does not work out from a candidate that
 * fits. Taking the first and committing to it misses `.a > .b .c` whenever the nearest `.b` fails
 * the child combinator while a further one satisfies it, which is what the browser differential
 * suite caught.
 */
function matchAny(
  first: StyleTarget | null,
  next: (node: StyleTarget) => StyleTarget | null,
  rule: StyleRule,
  index: number,
  compound: Compound,
  sheet: StyleSheet | null,
): boolean {
  for (let candidate = first; candidate; candidate = next(candidate)) {
    if (
      matchesCompound(candidate, compound, sheet) &&
      matchPrefix(candidate, rule, index - 1, sheet)
    ) {
      return true;
    }
  }
  return false;
}

/** Whether a node is one of the children CSS counts. Text and anchors are children, not elements. */
const isElement = (node: StyleTarget) => node.kind === undefined || node.kind === 'element';

/** The element before this one, skipping everything that is not one. */
function previousElement(node: StyleTarget): StyleTarget | null {
  node.positionRead = true;
  const siblings = node.parent?.children;
  if (!siblings) return null;
  for (let i = siblings.indexOf(node) - 1; i >= 0; i--) {
    if (isElement(siblings[i]!)) return siblings[i]!;
  }
  return null;
}

/**
 * Whether a node's position satisfies `an + b`.
 *
 * ponytail: the general case counts the node's siblings, so a rule like `:nth-child(2n)` over a
 * long list is quadratic in it. The two that matter - first and last - are answered without
 * counting, and the rest wait for a list that is actually slow.
 */
function matchesNth(node: StyleTarget, test: NthTest): boolean {
  node.positionRead = true;
  const siblings = node.parent?.children;
  if (!siblings) return false;

  if (test.a === 0 && test.b === 1) {
    return (test.fromEnd ? lastElement(siblings) : firstElement(siblings)) === node;
  }

  const from = countPosition(node, siblings, test.fromEnd === true);
  if (from === 0) return false;
  // `an + b` for some whole number of steps, which is what CSS counts from.
  if (test.a === 0) return from === test.b;
  const steps = (from - test.b) / test.a;
  return Number.isInteger(steps) && steps >= 0;
}

/** Which element this is among its siblings, counting from one end or the other. Zero if absent. */
/**
 * Drop from the pending deferred set every property a later rule has now set outright.
 *
 * Per property rather than per declaration: one deferred declaration can cover four sides, and a
 * later `padding-left` should take only that side away from it.
 */
function overriddenBy(
  deferred: DeferredDeclaration[],
  declarations: Readonly<Record<string, unknown>>,
  important: boolean,
): DeferredDeclaration[] | null {
  const kept: DeferredDeclaration[] = [];
  for (const declaration of deferred) {
    // A plain declaration cannot take anything from an important one.
    if (declaration.important && !important) {
      kept.push(declaration);
      continue;
    }
    const props = declaration.props.filter((prop) => !(prop in declarations));
    if (props.length === declaration.props.length) kept.push(declaration);
    else if (props.length) kept.push({ ...declaration, props });
  }
  return kept.length ? kept : null;
}

/**
 * The deferred values still standing once `rule` has been applied, plus its own.
 *
 * A plain declaration from this rule beats a `var()` from an earlier one. Deferred values are
 * resolved after the cascade has run, so without this a token would win whatever the cascade
 * said: `.row { background: var(--surface) }` would repaint over
 * `.row:nth-child(odd) { background: ... }`, which is a rule with a pseudo-class on top of the
 * same class and should win. An important one survives a plain declaration, and only an important
 * declaration takes it away.
 */
function carryDeferred(
  deferred: DeferredDeclaration[] | null,
  rule: StyleRule,
): DeferredDeclaration[] | null {
  let kept = deferred;
  if (kept && Object.keys(rule.declarations).length) {
    kept = overriddenBy(kept, rule.declarations, false);
  }
  if (kept && rule.important) kept = overriddenBy(kept, rule.important, true);
  if (rule.deferred) (kept ??= []).push(...rule.deferred);
  return kept;
}

function countPosition(
  node: StyleTarget,
  siblings: readonly StyleTarget[],
  fromEnd: boolean,
): number {
  let position = 0;
  let seen = 0;
  for (const sibling of siblings) {
    if (!isElement(sibling)) continue;
    seen++;
    if (sibling === node) position = seen;
  }
  if (position === 0) return 0;
  return fromEnd ? seen - position + 1 : position;
}

function firstElement(siblings: readonly StyleTarget[]): StyleTarget | null {
  for (const sibling of siblings) if (isElement(sibling)) return sibling;
  return null;
}

function lastElement(siblings: readonly StyleTarget[]): StyleTarget | null {
  for (let i = siblings.length - 1; i >= 0; i--) {
    if (isElement(siblings[i]!)) return siblings[i]!;
  }
  return null;
}

/**
 * How much specificity a component's own rules gain over the application's global sheet.
 *
 * One class, which is what the web's usual scoping schemes grant a component's rules by adding a
 * generated attribute or class to each selector (CSS Modules, Vue's `scoped`, emulated shadow
 * DOM). Matching that keeps the precedence people already have in their fingers rather than
 * inventing a rule for native.
 */
const COMPONENT_SPECIFICITY_BUMP = 1_000;

/** One rule in a cascade: the sheet it came from, which `:host` needs, and its weight here. */
interface RuleEntry {
  readonly rule: StyleRule;
  readonly sheet: StyleSheet;
  readonly weight: number;
}

/**
 * The bucket a rule is filed under: the most selective simple selector in its rightmost compound,
 * which is what a browser calls the key selector.
 *
 * Matching counts leftwards from that compound, so if it cannot match a node then nothing to its
 * left needs looking at. Anything that could match a node whose name, id and classes say nothing -
 * an attribute test, `:host`, `:is()`, a bare pseudo-class, `*` - goes in the universal bucket and
 * is offered to everything, because the alternative is a rule that silently stops applying.
 */
export function ruleKey(rule: StyleRule): string {
  const key = rule.compounds[rule.compounds.length - 1];
  if (!key) return UNIVERSAL;
  if (key.classes.length) return `class:${key.classes[0]}`;
  if (key.id !== undefined) return `id:${key.id}`;
  if (key.type !== undefined) return `type:${key.type}`;
  return UNIVERSAL;
}

const UNIVERSAL = '*';

/** Where a rule sits in the merged, weight-sorted list. The cascade depends on that order. */
interface IndexedEntry {
  readonly entry: RuleEntry;
  readonly at: number;
}

export interface RuleIndex {
  readonly buckets: ReadonlyMap<string, readonly IndexedEntry[]>;
  readonly universal: readonly IndexedEntry[];
}

/** File a merged, sorted rule list by key selector. Done once per sheet pair, not per node. */
export function indexRules(entries: readonly RuleEntry[]): RuleIndex {
  const buckets = new Map<string, IndexedEntry[]>();
  const universal: IndexedEntry[] = [];
  entries.forEach((entry, at) => {
    const key = ruleKey(entry.rule);
    if (key === UNIVERSAL) {
      universal.push({ entry, at });
      return;
    }
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    bucket.push({ entry, at });
  });
  return { buckets, universal };
}

/**
 * The rules worth trying against a node, in the order they were merged in.
 *
 * Each bucket is already in order, so the collected list only needs sorting when more than one
 * contributed - which for a node with one class and a name is the common case, and cheap: the
 * lists are short by construction, which is the entire point of the index.
 */
export function candidateRules(node: StyleTarget, index: RuleIndex): RuleEntry[] {
  const found: IndexedEntry[][] = [];
  if (index.universal.length) found.push(index.universal as IndexedEntry[]);
  const byName = index.buckets.get(`type:${node.name}`);
  if (byName) found.push(byName as IndexedEntry[]);
  const id = node.props['nativeID'];
  if (typeof id === 'string') {
    const byId = index.buckets.get(`id:${id}`);
    if (byId) found.push(byId as IndexedEntry[]);
  }
  if (node.classes) {
    for (const name of node.classes) {
      const byClass = index.buckets.get(`class:${name}`);
      if (byClass) found.push(byClass as IndexedEntry[]);
    }
  }
  if (!found.length) return [];
  if (found.length === 1) return found[0]!.map((indexed) => indexed.entry);
  const merged = found.flat();
  merged.sort((a, b) => a.at - b.at);
  return merged.map((indexed) => indexed.entry);
}

/** What the rules matching one node add up to. */
interface CascadeResult {
  readonly declarations: Record<string, unknown>;
  /** The important declarations alone, which a deferred value that is not important cannot beat. */
  readonly important: Record<string, unknown> | null;
  readonly tokens: Readonly<Record<string, TokenValue>> | null;
  readonly deferred: DeferredDeclaration[] | null;
  readonly rules: readonly StyleRule[];
}

/** What `em` falls back to when nothing in scope has set a font size. The web's default. */
const DEFAULT_FONT_SIZE = 16;

/** Shared empty result. Never handed out anywhere that mutates it. */
const EMPTY: Record<string, unknown> = {};
/** The style of every node no rule reaches, for a caller to skip merging nothing. */
export const EMPTY_STYLE: Readonly<Record<string, unknown>> = EMPTY;

/** Stands in for the parent of a root node, so the comparison needs no null case. */
const ROOT_CONTEXT: object = {};

/**
 * A node that has never resolved, and none of whose children has either: nothing under it holds
 * an answer keyed to its context, so it can take the shared empty one rather than mint its own.
 * A child that resolved elsewhere and moved here does, and still gets a fresh context to notice.
 */
function neverResolved(node: StyleTarget): boolean {
  if (node.styleCache !== null) return false;
  const children = node.children;
  if (children) for (let i = 0; i < children.length; i++) if (children[i]!.styleCache) return false;
  return true;
}

/** Shared empty token map, for the overwhelmingly common case of a subtree defining none. */
const NO_TOKENS: Readonly<Record<string, TokenValue>> = {};

/** Stands in for "created by a component with no sheet" as a cache key. */
const NO_SHEET: StyleSheet = { rules: [] };

/**
 * Conditions generations are unique across every resolver in the process, not merely
 * increasing within one, because the memo they stamp lives on the compiled rule and a sheet is
 * shared by every engine that mounts the component.
 */
let generations = 0;

function emptyCacheFor(epoch: number, generation: number): StyleCache {
  return {
    epoch,
    generation,
    context: ROOT_CONTEXT,
    parentContext: ROOT_CONTEXT,
    style: EMPTY,
    inherited: EMPTY,
    tokens: NO_TOKENS,
  };
}

/**
 * What this node's children inherit: the parent's map, overlaid with any inheritable value the
 * node set itself. Copied on first write only, so a node that sets none hands the same object on
 * and a whole subtree can share it.
 */
function inheritFrom(
  parentInherited: Record<string, unknown>,
  own: Record<string, unknown>,
): Record<string, unknown> {
  let inherited = parentInherited;
  for (const key of Object.keys(own)) {
    if (!INHERITED.has(key)) continue;
    if (inherited === parentInherited) inherited = { ...parentInherited };
    inherited[key] = own[key];
  }
  return inherited;
}

/**
 * The runtime half of CSS for one engine: the global sheet, the conditions media queries are
 * evaluated against, and the memo that makes resolution cost nodes x rules rather than
 * nodes x rules x depth.
 *
 * One per engine rather than module state, so two surfaces in one process (or two engines in
 * one test) cannot overwrite each other's sheet or viewport.
 *
 * Inherited state is pushed **down** rather than walked up: a node takes what its parent already
 * resolved and overlays its own declarations. That is how real CSS engines do it, and it matters
 * for two separate reasons.
 *
 * Correctness first. Walking up meant matching every ancestor against the *starting node's*
 * sheet, but an ancestor almost always belongs to a different component, so a component's rules
 * reached nodes it did not own while a parent's real values never arrived. Reading `sheet` off
 * each node fixes both directions at once.
 *
 * Cost second. Walking up re-derived, for every node, everything its parent had already worked
 * out. Memoising by epoch makes it nodes x rules, and a node that sets no inheritable value hands
 * its parent's map straight on rather than copying it, so the common case allocates nothing.
 */
export class StyleResolver {
  private conditions: Conditions;
  /**
   * Bumped whenever the conditions move. Every cached result and every per-rule condition memo
   * is stamped with it, so a rotation or a theme switch invalidates the lot in one assignment
   * rather than walking the tree.
   */
  private generation = ++generations;
  private emptyCache = emptyCacheFor(-1, -1);
  /**
   * The rules a node is matched against, merged across the global sheet, the sheet of the
   * component it hosts and the sheet that created it, sorted once by weight and then filed by key
   * selector. Keyed by the creating sheet and then the hosted one, so a component's nodes share a
   * single index.
   */
  private readonly merged = new WeakMap<StyleSheet, Map<StyleSheet | null, RuleIndex>>();

  /**
   * The application-level sheet, if any: the one set of rules allowed to match a node whatever
   * component created it, which is what resets, utility classes and `:root` tokens all need.
   */
  private readonly globalSheet: StyleSheet | null;

  /**
   * Custom properties the host supplies rather than the stylesheet: the safe-area insets, and
   * whatever else is a property of the device instead of the design.
   *
   * Seeded rather than forced. They stand in for the root's inherited tokens, so a `:root` rule
   * in the app's own sheet overrides them the way it would override anything it inherited, and an
   * app that wants to pin an inset for a tablet layout or a screenshot still can.
   */
  private tokensOnRoot: Readonly<Record<string, TokenValue>> = NO_TOKENS;

  /** What the host has supplied so far, so a second source can add to it rather than replace it. */
  get rootTokens(): Readonly<Record<string, TokenValue>> {
    return this.tokensOnRoot;
  }

  /**
   * Told of a `var()` that names a custom property nothing in scope defines and has no fallback,
   * which is dropped. Set only in development, where it is how the engine says so.
   */
  onUndefinedToken: ((name: string, props: readonly string[]) => void) | null = null;

  constructor(globalSheet: StyleSheet | null, conditions: Conditions) {
    this.globalSheet = globalSheet;
    this.conditions = conditions;
  }

  setConditions(next: Conditions): void {
    this.conditions = next;
    this.generation = ++generations;
  }

  setRootTokens(next: Readonly<Record<string, TokenValue>>): void {
    this.tokensOnRoot = next;
    this.generation = ++generations;
  }

  /**
   * Resolve a node, memoised for the life of one epoch.
   *
   * `epoch` scopes the memo. The engine bumps it once per commit, so within a commit each node
   * resolves at most once however many descendants ask for its inherited values.
   */
  resolve(node: StyleTarget, epoch: number): StyleCache {
    const cached = node.styleCache;
    // Within one commit a node is asked for its inherited map once per descendant, so this is the
    // hot path and it must not walk anywhere.
    if (cached !== null && cached.epoch === epoch) return cached;

    const parent = node.parent ? this.resolve(node.parent, epoch) : null;
    const parentContext = parent ? parent.context : ROOT_CONTEXT;

    // Across commits: nothing about this node changed and nothing above it moved, so the last
    // answer still holds. Reusing the object, rather than recomputing an equal one, is what lets
    // a descendant tell "unchanged" from "changed" by reference alone.
    if (this.reusable(cached, node, parentContext)) {
      cached.epoch = epoch;
      return cached;
    }

    const parentInherited = parent ? parent.inherited : EMPTY;

    if (this.hasNoRules(node)) {
      return this.unstyled(node, epoch, parent, parentContext, parentInherited);
    }

    styleStats.nodesResolved++;

    const result = this.cascade(node, this.rulesFor(node));

    const kept = this.keptAnswer(node, parentContext, result.rules);
    if (kept) {
      kept.epoch = epoch;
      node.styleDirty = false;
      return kept;
    }

    // Tokens are in scope for this node's own declarations as well as its descendants', so they
    // are merged before any `var()` here is resolved.
    const parentTokens = parent ? parent.tokens : this.tokensOnRoot;
    const tokens = tokensInScope(parentTokens, result.tokens, node.customProperties);

    const own = result.declarations;
    if (result.deferred) {
      this.applyDeferred(result.deferred, own, tokens, parentInherited, result.important);
    }
    if (own['borderStyle'] === 'none') drawNoBorder(own);

    const cache: StyleCache = {
      epoch,
      generation: this.generation,
      context: {},
      parentContext,
      style: { ...parentInherited, ...own },
      inherited: inheritFrom(parentInherited, own),
      tokens,
      rules: result.rules,
    };
    node.styleCache = cache;
    node.styleDirty = false;
    return cache;
  }

  /**
   * The last answer, when a node marked only because its child list moved (`:empty`, a position
   * selector) matches as before: the same rules under the same parent give the same answer, and
   * keeping the old one, context and all, spares every descendant a resolve. A node whose own
   * classes, props or place changed mints a new context even so, as a descendant's selector can
   * read those of it.
   */
  private keptAnswer(
    node: StyleTarget,
    parentContext: object,
    rules: readonly StyleRule[],
  ): StyleCache | null {
    const previous = node.styleCache;
    return previous !== null &&
      node.propsDirty === false &&
      !node.positionRead &&
      previous.parentContext === parentContext &&
      previous.generation === this.generation &&
      sameRules(previous.rules, rules)
      ? previous
      : null;
  }

  /**
   * Whether a node's last answer still stands under a parent that resolved to `parentContext`,
   * without resolving it. What lets a commit step over a clean child in one comparison.
   */
  holds(node: StyleTarget, parentContext: object): boolean {
    return this.reusable(node.styleCache, node, parentContext);
  }

  /**
   * Whether a previous result still stands: nothing about the node changed, nothing above it
   * moved, and the conditions have not.
   */
  private reusable(
    cached: StyleCache | null,
    node: StyleTarget,
    parentContext: object,
  ): cached is StyleCache {
    return (
      cached !== null &&
      !node.styleDirty &&
      cached.parentContext === parentContext &&
      cached.generation === this.generation
    );
  }

  /**
   * Nothing anywhere can match this node, and it sets no custom property of its own, so its style
   * is whatever it inherits.
   */
  private hasNoRules(node: StyleTarget): boolean {
    return (
      node.sheet === null &&
      node.hostSheet === null &&
      this.globalSheet === null &&
      !node.customProperties
    );
  }

  /**
   * A node with no rules anywhere: it renders with what it inherits and passes the same map on.
   *
   * It still mints a context, because a rule further down may match on one of *its* classes.
   * When there is nothing to inherit either, one shared cache object serves every such node, so
   * an application that writes no CSS allocates nothing per node.
   */
  private unstyled(
    node: StyleTarget,
    epoch: number,
    parent: StyleCache | null,
    parentContext: object,
    parentInherited: Record<string, unknown>,
  ): StyleCache {
    if (
      parentInherited === EMPTY &&
      parentContext === ROOT_CONTEXT &&
      (!node.styleDirty || neverResolved(node))
    ) {
      if (this.emptyCache.epoch !== epoch || this.emptyCache.generation !== this.generation) {
        this.emptyCache = emptyCacheFor(epoch, this.generation);
      }
      node.styleCache = this.emptyCache;
      node.styleDirty = false;
      return this.emptyCache;
    }

    const passthrough: StyleCache = {
      epoch,
      generation: this.generation,
      context: {},
      parentContext,
      style: parentInherited,
      inherited: parentInherited,
      tokens: parent ? parent.tokens : this.tokensOnRoot,
    };
    node.styleCache = passthrough;
    node.styleDirty = false;
    return passthrough;
  }

  /**
   * The rules worth trying against a node.
   *
   * The merged list is built once per (creating sheet, hosted sheet) pair and indexed by key
   * selector; what comes back here is only the buckets this node can reach. For a component's own
   * sheet that changes little, but a global utility sheet is hundreds of rules and a screen is a
   * thousand nodes, and the difference is between a million match attempts and a few thousand.
   */
  private rulesFor(node: StyleTarget): readonly RuleEntry[] {
    const creator = node.sheet ?? NO_SHEET;
    let byHost = this.merged.get(creator);
    if (!byHost) this.merged.set(creator, (byHost = new Map()));
    let index = byHost.get(node.hostSheet);
    if (!index) {
      byHost.set(node.hostSheet, (index = indexRules(this.merge(node.sheet, node.hostSheet))));
    }
    return candidateRules(node, index);
  }

  /**
   * Weakest first. A host node is matched against two component sheets: the one belonging to the
   * component it hosts, whose `:host` rules exist to reach exactly this node, and the one that
   * created it. Both carry the bump; the creator comes later and so wins a tie, as the outer
   * document does over `:host` on the web. The sort is stable, so within one sheet source order
   * survives and a later sheet wins equal weight.
   */
  private merge(sheet: StyleSheet | null, hostSheet: StyleSheet | null): RuleEntry[] {
    const entries: RuleEntry[] = [];
    const add = (from: StyleSheet | null, bump: number): void => {
      if (!from) return;
      for (const rule of from.rules) {
        entries.push({ rule, sheet: from, weight: rule.specificity + bump });
      }
    };
    add(this.globalSheet, 0);
    add(hostSheet, COMPONENT_SPECIFICITY_BUMP);
    add(sheet, COMPONENT_SPECIFICITY_BUMP);
    return entries.sort((a, b) => a.weight - b.weight);
  }

  /** The declarations that apply to a node. The list is sorted, so later simply wins. */
  private cascade(node: StyleTarget, entries: readonly RuleEntry[]): CascadeResult {
    const normal: Record<string, unknown> = {};
    const important: Record<string, unknown> = {};
    let hasImportant = false;
    let tokens: Readonly<Record<string, TokenValue>> | null = null;
    let deferred: DeferredDeclaration[] | null = null;
    const rules: StyleRule[] = [];

    for (const { rule, sheet } of entries) {
      if (!this.conditionHolds(rule) || !matches(node, rule, sheet)) continue;
      rules.push(rule);
      Object.assign(normal, rule.declarations);
      if (rule.important) {
        Object.assign(important, rule.important);
        hasImportant = true;
      }
      // One rule's tokens are kept as they are, so a scope built from them can be memoised by
      // identity (`tokensInScope`); a copy only once a second rule adds to them.
      if (rule.tokens) tokens = tokens ? Object.assign({}, tokens, rule.tokens) : rule.tokens;
      deferred = carryDeferred(deferred, rule);
    }

    return {
      declarations: hasImportant ? { ...normal, ...important } : normal,
      important: hasImportant ? important : null,
      tokens,
      deferred,
      rules,
    };
  }

  /**
   * Whether a rule's media query holds, memoised per rule.
   *
   * Conditions are the same for every node, so this is answered once per rule per change rather
   * than once per rule per node.
   */
  private conditionHolds(rule: StyleRule): boolean {
    if (rule.condition === undefined) return true;
    if (rule.activeAt !== this.generation) {
      rule.activeAt = this.generation;
      rule.active = this.evaluate(rule.condition);
    }
    return rule.active!;
  }

  private evaluate(condition: MediaCondition): boolean {
    if ('all' in condition) return condition.all.every((part) => this.evaluate(part));
    if ('any' in condition) return condition.any.some((part) => this.evaluate(part));

    if (!('op' in condition)) return this.preference(condition.feature) === condition.value;

    const { width, height } = this.conditions;
    const actual = condition.feature === 'width' ? width : height;
    const { op, value } = condition;
    if (op === 'gt') return actual > value;
    if (op === 'gte') return actual >= value;
    if (op === 'lt') return actual < value;
    if (op === 'lte') return actual <= value;
    return actual === value;
  }

  /** What the device answers for a feature that is a keyword rather than a measurement. */
  private preference(feature: 'orientation' | 'prefers-color-scheme' | 'prefers-reduced-motion') {
    const { width, height, colorScheme, reducedMotion } = this.conditions;
    if (feature === 'orientation') return width > height ? 'landscape' : 'portrait';
    if (feature === 'prefers-color-scheme') return colorScheme;
    return reducedMotion ? 'reduce' : 'no-preference';
  }

  /** A length relative to the viewport, in points. */
  private viewportLength(unit: 'vw' | 'vh' | 'vmin' | 'vmax', factor: number): number {
    const { width, height } = this.conditions;
    const basis = {
      vw: width,
      vh: height,
      vmin: Math.min(width, height),
      vmax: Math.max(width, height),
    };
    return (factor * basis[unit]) / 100;
  }

  /**
   * Write the declarations that could not be settled at build time: a `var()` reference, or a
   * length relative to the viewport or to the font size in scope.
   *
   * A declaration with no token and no usable fallback is dropped rather than written as
   * undefined, which is what a browser does with a value it cannot resolve.
   */
  private applyDeferred(
    deferred: readonly DeferredDeclaration[],
    own: Record<string, unknown>,
    tokens: Readonly<Record<string, TokenValue>>,
    parentInherited: Record<string, unknown>,
    important: Record<string, unknown> | null,
  ): void {
    for (const declaration of settlingOrder(deferred)) {
      const settled = this.settled(declaration, own, parentInherited, tokens);
      if (settled === undefined && this.onUndefinedToken) {
        this.reportUndefined(declaration, tokens);
      }
      const value = settled ?? declaration.unset;
      if (value === undefined) continue;
      for (const prop of declaration.props) {
        if (!declaration.important && important && prop in important) continue;
        own[prop] = value;
      }
    }
  }

  /** One deferred declaration's value, from the tokens in scope and the node's own style. */
  private settled(
    declaration: DeferredDeclaration,
    own: Record<string, unknown>,
    parentInherited: Record<string, unknown>,
    tokens: Readonly<Record<string, TokenValue>>,
  ): unknown {
    if (declaration.within !== undefined) {
      return this.settledWithin(declaration.within, declaration, own, parentInherited, tokens);
    }
    if (declaration.compute) return this.computed(declaration, own, parentInherited);
    const value = referenced(declaration, tokens);
    if (declaration.whenSet !== undefined)
      return value === undefined ? undefined : declaration.whenSet;
    // A token defined in `em` or a viewport unit cannot be settled where it is defined: a
    // browser substitutes it and works it out where it is used, so the same here.
    const pending = (value as { __defer?: DeferredDeclaration['compute'] } | null)?.__defer;
    if (pending) return this.computed({ ...declaration, compute: pending }, own, parentInherited);
    // A token can hold a structured value with markers of its own: a shadow token whose colour
    // is another token, as Tailwind's rings are.
    return typeof value === 'object' && value !== null
      ? this.settledWithin(value, declaration, own, parentInherited, tokens)
      : value;
  }

  /** A reference with nothing defined for it and nothing to fall back to. */
  private reportUndefined(
    declaration: DeferredDeclaration,
    tokens: Readonly<Record<string, TokenValue>>,
  ): void {
    const name = declaration.reference;
    if (name === undefined || declaration.fallback !== undefined || name in tokens) return;
    if (declaration.alternatives?.some((alternative) => alternative in tokens)) return;
    this.onUndefinedToken!(name, declaration.props);
  }

  /**
   * A structured value with every deferred length and colour inside it settled, or undefined when
   * a colour in it cannot be: a shadow with no colour is not a shadow, as CSS reads it.
   */
  private settledWithin(
    value: unknown,
    declaration: DeferredDeclaration,
    own: Record<string, unknown>,
    parentInherited: Record<string, unknown>,
    tokens: Readonly<Record<string, TokenValue>>,
  ): unknown {
    const filled = this.filledIn(value, declaration, own, parentInherited, tokens);
    if (filled === UNSETTLED) return undefined;
    // As the compiler drops a shadow nobody can see: Tailwind composes five, four of them nothing.
    return declaration.props.includes('boxShadow') && Array.isArray(filled)
      ? filled.filter((shadow) => !invisible((shadow as { color?: unknown }).color))
      : filled;
  }

  /** A structured value with every deferred length and colour inside it settled. */
  private filledIn(
    value: unknown,
    declaration: DeferredDeclaration,
    own: Record<string, unknown>,
    parentInherited: Record<string, unknown>,
    tokens: Readonly<Record<string, TokenValue>>,
  ): unknown {
    if (!needsFilling(value)) return value;
    const fill = (part: unknown) => this.filledIn(part, declaration, own, parentInherited, tokens);
    if (Array.isArray(value)) return this.filledList(value, fill, tokens);
    const marked = settledMarker(value, tokens);
    // `currentcolor` is the colour in scope, which only the node knows: Tailwind's ring default.
    if (marked === 'currentcolor') return own['color'] ?? parentInherited['color'] ?? 'black';
    if (marked !== NOT_A_MARKER) return marked ?? UNSETTLED;
    const pending = (value as { __defer?: DeferredDeclaration['compute'] }).__defer;
    if (pending) return this.computed({ ...declaration, compute: pending }, own, parentInherited);
    const out: Record<string, unknown> = {};
    for (const [key, part] of Object.entries(value)) {
      const filled = fill(part);
      if (filled === UNSETTLED) return UNSETTLED;
      out[key] = filled;
    }
    return out;
  }

  /**
   * A list's parts filled in, a whole shadow or filter token standing for however many entries it
   * holds: none, for an empty filter slot.
   */
  private filledList(
    value: readonly unknown[],
    fill: (part: unknown) => unknown,
    tokens: Readonly<Record<string, TokenValue>>,
  ): unknown {
    const parts: unknown[] = [];
    for (const part of value) {
      const slot = slotOf(part);
      if (!slot) {
        const filled = fill(part);
        if (filled === UNSETTLED) return UNSETTLED;
        parts.push(filled);
        continue;
      }
      const filled = fill(formOf(tokens[slot.marker.reference], slot.kind) ?? slot.marker.fallback);
      if (filled === UNSETTLED || !Array.isArray(filled)) return UNSETTLED;
      parts.push(...filled);
    }
    return parts;
  }

  /** A length relative to the viewport or to the font size in scope. */
  private computed(
    declaration: DeferredDeclaration,
    own: Record<string, unknown>,
    parentInherited: Record<string, unknown>,
  ): unknown {
    const { unit, factor, offset = 0 } = declaration.compute!;
    if (unit !== 'em') return this.viewportLength(unit, factor) + offset;
    // The font size in scope. On `font-size` itself that is the inherited size rather than the
    // one being computed, which is what makes a nested `1.5em` compound as on the web.
    const base = declaration.props.includes('fontSize')
      ? parentInherited['fontSize']
      : (own['fontSize'] ?? parentInherited['fontSize']);
    return factor * (typeof base === 'number' ? base : DEFAULT_FONT_SIZE) + offset;
  }
}

/**
 * The order a node's deferred declarations are settled in.
 *
 * Plain ones first and important ones after, so an important one wins whatever order they matched
 * in; and a plain one never writes over an important declaration. The font size before everything
 * else, because an em anywhere on the node is measured against it, whichever rule it came from:
 * '.x { padding: 1em } .y { font-size: 2em }'. Then the colour, because a `currentcolor` anywhere
 * on the node is the node's own colour: a ring's default, beside a `color: var(--c)`.
 */
function settlingOrder(deferred: readonly DeferredDeclaration[]): readonly DeferredDeclaration[] {
  const byImportance = deferred.some((one) => one.important)
    ? [...deferred.filter((one) => !one.important), ...deferred.filter((one) => one.important)]
    : deferred;
  const rank = (one: DeferredDeclaration) =>
    one.props.includes('fontSize') ? 0 : one.props.includes('color') ? 1 : 2;
  return byImportance.some((one) => rank(one) < 2)
    ? [0, 1, 2].flatMap((wanted) => byImportance.filter((one) => rank(one) === wanted))
    : byImportance;
}

/**
 * The aliases, hsl() colours and channel colours among a node's own definitions, resolved against everything in
 * scope on it. Done once, where they are defined, so a descendant only ever sees values. A name
 * that resolves to nothing - undefined, part of a cycle, or an hsl() missing a channel - is
 * dropped, as a browser treats it as unset.
 *
 * Aliases first: an hsl() channel that names a plain token reads it whichever order these run in,
 * but an alias that names an hsl() token needs the hsl() already turned into a colour.
 */
/**
 * The tokens in scope at a node: its parent's, overlaid with what its rules define, overlaid with
 * what it sets itself, which wins as inline style does.
 */
/**
 * Scopes built from rule tokens alone, by the parent's scope and then the rule tokens. Tailwind's
 * `*` rule gives every element the same tokens under the same parent scope, so a screen resolves
 * them once per distinct scope rather than once per element. Neither key is ever mutated.
 */
const scopes = new WeakMap<object, WeakMap<object, Readonly<Record<string, TokenValue>>>>();

function tokensInScope(
  parentTokens: Readonly<Record<string, TokenValue>>,
  ruleTokens: Readonly<Record<string, TokenValue>> | null,
  custom: Readonly<Record<string, TokenValue>> | null | undefined,
): Readonly<Record<string, TokenValue>> {
  if (custom) {
    const own = { ...ruleTokens, ...custom };
    return resolveAliases(own, { ...parentTokens, ...own });
  }
  if (!ruleTokens) return parentTokens;
  let byRule = scopes.get(parentTokens);
  if (!byRule) scopes.set(parentTokens, (byRule = new WeakMap()));
  let scope = byRule.get(ruleTokens);
  if (!scope) {
    scope = resolveAliases(ruleTokens, { ...parentTokens, ...ruleTokens });
    byRule.set(ruleTokens, scope);
  }
  return scope;
}

function resolveAliases(
  own: Readonly<Record<string, TokenValue>>,
  merged: Record<string, TokenValue>,
): Record<string, TokenValue> {
  const names = Object.keys(own);
  for (const name of names) {
    if (own[name]!.alias) settle(merged, name, followAlias(name, merged, new Set()));
  }
  for (const name of names) {
    const { hsl, deferredColour } = own[name]!;
    if (hsl) settle(merged, name, colourToken(resolveHsl(hsl, merged)));
    if (deferredColour) settle(merged, name, colourToken(channelsColour(deferredColour, merged)));
  }
  // An alias to one of those copied it unsettled above: follow it again, now it is a colour.
  for (const name of names) {
    const target = own[name]!.alias;
    if (!target || !(own[target]?.hsl || own[target]?.deferredColour)) continue;
    settle(merged, name, followAlias(name, { ...merged, [name]: own[name]! }, new Set()));
  }
  return merged;
}

/** A token set to what it resolved to, or removed when it resolved to nothing, as CSS unsets it. */
function settle(
  merged: Record<string, TokenValue>,
  name: string,
  value: TokenValue | undefined,
): void {
  if (value) merged[name] = value;
  else delete merged[name];
}

const colourToken = (color: string | undefined): TokenValue | undefined =>
  color === undefined ? undefined : { color };

/** An `hsl()` token's channels, read from the tokens in scope, as the colour they make. */
function resolveHsl(
  hsl: NonNullable<TokenValue['hsl']>,
  tokens: Readonly<Record<string, TokenValue>>,
): string | undefined {
  const h = hslChannel(hsl.h, tokens);
  const s = hslChannel(hsl.s, tokens);
  const l = hslChannel(hsl.l, tokens);
  const alpha = hsl.alpha === undefined ? 1 : hslChannel(hsl.alpha, tokens);
  if (h === undefined || s === undefined || l === undefined || alpha === undefined) {
    return undefined;
  }
  return hslToRgb(h, s, l, alpha);
}

function hslChannel(
  channel: HslChannel,
  tokens: Readonly<Record<string, TokenValue>>,
): number | undefined {
  return typeof channel === 'number'
    ? channel
    : (tokens[channel.reference]?.number ?? channel.fallback);
}

/**
 * `hsl(h, s, l)` converted to sRGB, printed the same way `fromChannels` prints an rgba() built
 * from tokens: a use site never has to know which of the two ever built a colour.
 *
 * `h` is degrees; `s` and `l` are fractions, which is what a percentage token already reads as
 * (see `formOf`), so nothing here rescales them.
 */
function hslToRgb(h: number, s: number, l: number, alpha: number): string {
  const hue = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - chroma / 2;
  const [r1, g1, b1] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return alpha >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

function followAlias(
  name: string,
  tokens: Readonly<Record<string, TokenValue>>,
  seen: Set<string>,
): TokenValue | undefined {
  const value = tokens[name];
  if (!value?.alias) return value;
  if (seen.has(name)) return undefined;
  seen.add(name);
  return followAlias(value.alias, tokens, seen) ?? value.fallback;
}

/** What a `var()` resolves to: a gradient's stops, or one value with its arithmetic applied. */
function referenced(
  declaration: DeferredDeclaration,
  tokens: Readonly<Record<string, TokenValue>>,
): unknown {
  if (declaration.gradient) return paintLayers(declaration.gradient, tokens);
  let value = formOf(tokens[declaration.reference!], declaration.kind!);
  // `calc(var(--n) * 1px)`: the arithmetic gives a unitless token its unit, which is the usual
  // way to turn a count into a length. So a length with arithmetic reads the bare number too.
  if (value === undefined && declaration.adjust && declaration.kind === 'length') {
    value = tokens[declaration.reference!]?.number;
  }
  for (const alternative of declaration.alternatives ?? []) {
    if (value !== undefined) break;
    value = formOf(tokens[alternative], declaration.kind!);
  }
  value ??= declaration.fallback;
  const base =
    declaration.kind === 'channels' ? fromChannels(value, declaration.alpha, tokens) : value;
  return declaration.adjust ? adjusted(base, declaration.adjust) : base;
}

/** `13, 110, 253` as the colour it is, at the alpha the token beside it says, if one does. */
function fromChannels(
  value: unknown,
  alpha: DeferredDeclaration['alpha'],
  tokens: Readonly<Record<string, TokenValue>>,
): string | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  // An alpha naming a token nothing set, with no fallback, is no colour: CSS drops it.
  const opacity = alpha ? (tokens[alpha.reference]?.number ?? alpha.fallback) : 1;
  if (opacity === undefined) return undefined;
  const [r, g, b] = value as number[];
  return opacity >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Math.round(opacity * 1000) / 1000})`;
}

/** One template, or a layered background of several: every layer painted, or, as CSS would, none. */
function paintLayers(
  gradient: GradientTemplate | readonly GradientTemplate[],
  tokens: Readonly<Record<string, TokenValue>>,
): unknown {
  if (!Array.isArray(gradient)) return paintGradient(gradient as GradientTemplate, tokens);
  const painted: unknown[] = [];
  for (const layer of gradient as readonly GradientTemplate[]) {
    const one = paintGradient(layer, tokens) as unknown[] | undefined;
    if (!one) return undefined;
    painted.push(...one);
  }
  return painted;
}

/**
 * A gradient template with its stops filled in from the cascade.
 *
 * A stop whose colour is not defined anywhere is dropped rather than painted transparent: that is
 * what makes an optional middle colour optional, and it is what a browser does with the same
 * stylesheet. Fewer than two colours is not a gradient, and paints nothing at all.
 */
function paintGradient(
  template: GradientTemplate,
  tokens: Readonly<Record<string, TokenValue>>,
): unknown {
  const colorStops = paintedStops(template, tokens);
  if (colorStops.length < 2) return undefined;
  const position = template.position && placed(template.position, tokens);
  if (position === null) return undefined;
  return [{ ...template, colorStops, ...(position ? { position } : {}) }];
}

/** A template's stops with their tokens read, leaving out any whose colour is not set. */
function paintedStops(
  template: GradientTemplate,
  tokens: Readonly<Record<string, TokenValue>>,
): { color: string; position: string | number | null }[] {
  const colorStops = [];
  for (const stop of template.colorStops) {
    const color = stop.colour ? resolveColour(stop.colour, tokens) : tokens[stop.reference!]?.color;
    if (color === undefined) continue;
    const position = stop.positionReference
      ? (tokens[stop.positionReference]?.length ?? stop.position)
      : stop.position;
    // Written even when there is none: Fabric looks the key up before it looks at the value, and
    // silently skips a stop that has not got one.
    colorStops.push({ color, position: (position as string | number | undefined) ?? null });
  }
  return colorStops;
}

/**
 * A radial gradient's centre with any token in it read, or null when a token it needs is not set
 * and has nothing written beside it: CSS would not paint the gradient then, and neither does this.
 */
function placed(
  position: NonNullable<GradientTemplate['position']>,
  tokens: Readonly<Record<string, TokenValue>>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [edge, offset] of Object.entries(position)) {
    if (offset === null || typeof offset !== 'object') {
      out[edge] = offset;
      continue;
    }
    const { reference, fallback } = offset as { reference: string; fallback?: string | number };
    const value = tokens[reference]?.length ?? fallback;
    if (value === undefined || typeof value === 'object') return null;
    out[edge] = value;
  }
  return out;
}

/**
 * A colour expression with its tokens looked up and any mix in it worked out. Undefined when a
 * token it needs is not defined anywhere and has nothing to fall back to.
 */
function resolveColour(
  expression: ColourExpression,
  tokens: Readonly<Record<string, TokenValue>>,
): string | undefined {
  if ('color' in expression) return expression.color;
  if ('channels' in expression) return channelsColour(expression, tokens);
  if ('hsl' in expression) return resolveHsl(expression.hsl, tokens);
  if ('reference' in expression) return tokenColour(expression, tokens);
  if ('relative' in expression) {
    const { space, from, channels, alpha } = expression.relative;
    const origin = resolveColour(from, tokens);
    return origin === undefined ? undefined : relativeColour(space, origin, channels, alpha);
  }
  const { space, hue, a, aPercentage, b, bPercentage } = expression.mix;
  const first = resolveColour(a, tokens);
  const second = resolveColour(b, tokens);
  if (first === undefined || second === undefined) return undefined;
  return mixColours(
    space,
    { colour: first, percentage: aPercentage },
    { colour: second, percentage: bPercentage },
    hue,
  );
}

/** A length in a structured value that is a token, with the arithmetic around it. */
interface LengthMarker {
  readonly reference: string;
  readonly adjust?: DeferredDeclaration['adjust'];
  readonly fallback?: number;
}

/**
 * Arithmetic with tokens in it, as the compiler leaves it: numbers, token references and
 * `[op, a, b]`, in points, degrees or plain numbers as the slot it fills counts.
 */
type CalcExpression =
  | number
  | { readonly reference: string; readonly fallback?: number }
  | readonly ['+' | '-' | '*' | '/', CalcExpression, CalcExpression];

interface CalcMarker {
  readonly expression: CalcExpression;
  readonly kind: 'length' | 'angle' | 'time' | 'number';
}

/** A calc marker worked out, as its slot takes it; undefined when a token in it is not set. */
function resolveCalc(
  marker: CalcMarker,
  tokens: Readonly<Record<string, TokenValue>>,
): number | string | undefined {
  const percentage = wholePercentage(marker, tokens);
  if (percentage !== undefined) return percentage;
  if (bareNumberAsLength(marker, tokens) || notAnAngle(marker, tokens)) return undefined;
  const value = calculated(marker.expression, marker.kind, tokens);
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value * 1000) / 1000;
  return marker.kind === 'angle' ? `${rounded}deg` : rounded;
}

/**
 * Whether a length is one token holding a bare number other than 0: `--tw-translate-x: 3`, from
 * `translate-x-[3]`, which a browser drops. Inside arithmetic a bare number is a factor, and fine.
 */
function bareNumberAsLength(
  marker: CalcMarker,
  tokens: Readonly<Record<string, TokenValue>>,
): boolean {
  if (marker.kind !== 'length' || typeof marker.expression !== 'object') return false;
  if (Array.isArray(marker.expression)) return false;
  const token = tokens[(marker.expression as { reference: string }).reference];
  return (
    token !== undefined &&
    token.length === undefined &&
    token.number !== undefined &&
    token.number !== 0
  );
}

/**
 * Whether an angle is one token that holds no angle: `--tw-rotate: 3` or `37%`, from
 * `rotate-[3]`, which a browser drops, taking the whole transform with it. A bare 0 is an angle;
 * `0%` is not.
 */
function notAnAngle(marker: CalcMarker, tokens: Readonly<Record<string, TokenValue>>): boolean {
  if (marker.kind !== 'angle' || typeof marker.expression !== 'object') return false;
  if (Array.isArray(marker.expression)) return false;
  const token = tokens[(marker.expression as { reference: string }).reference];
  if (token === undefined || token.angle !== undefined) return false;
  // `0%` has a number 0 as well, and is still a percentage, which no angle is.
  return token.number !== 0 || typeof token.length === 'string';
}

/**
 * A length that is one token holding a percentage, `translate-x-1/2`'s 50%, passed on as it is:
 * a share of a box nobody has laid out yet can be used, but not added to or scaled here.
 */
function wholePercentage(
  marker: CalcMarker,
  tokens: Readonly<Record<string, TokenValue>>,
): string | undefined {
  if (marker.kind !== 'length' || typeof marker.expression !== 'object') return undefined;
  if (Array.isArray(marker.expression)) return undefined;
  const leaf = marker.expression as { reference: string };
  const value = formOf(tokens[leaf.reference], 'length');
  return typeof value === 'string' && value.endsWith('%') ? value : undefined;
}

function calculated(
  expression: CalcExpression,
  kind: CalcMarker['kind'],
  tokens: Readonly<Record<string, TokenValue>>,
): number | undefined {
  if (typeof expression === 'number') return expression;
  if (!Array.isArray(expression)) {
    const leaf = expression as Exclude<CalcExpression, number | readonly unknown[]>;
    return tokenNumber(tokens[leaf.reference], kind) ?? leaf.fallback;
  }
  const [op, a, b] = expression as readonly [string, CalcExpression, CalcExpression];
  const left = calculated(a, kind, tokens);
  const right = calculated(b, kind, tokens);
  if (left === undefined || right === undefined) return undefined;
  if (op === '+') return left + right;
  if (op === '-') return left - right;
  if (op === '*') return left * right;
  return left / right;
}

/** Where each kind of slot reads a token from, before its bare number. */
const FORM_OF_KIND: Record<
  Exclude<CalcMarker['kind'], 'number'>,
  (token: TokenValue) => unknown
> = {
  length: (token) => token.length,
  angle: (token) => token.angle,
  time: (token) => token.time,
};

/**
 * A token as a number in a slot of this kind: its length in points or its angle in degrees, or
 * a bare number, which multiplies (`calc(var(--n) * 1px)`). A length that is not points, a
 * percentage, is not one, and is not read as the bare number it also is.
 */
function tokenNumber(token: TokenValue | undefined, kind: CalcMarker['kind']): number | undefined {
  if (!token) return undefined;
  const own = kind === 'number' ? undefined : FORM_OF_KIND[kind](token);
  if (own !== undefined) return typeof own === 'number' ? own : undefined;
  // An angle is a number of degrees to a hue, and neither a length nor a factor: `30deg` as a
  // translate moved a box thirty points, and as a scale made it thirty times the size, where a
  // browser drops the declaration.
  if (token.angle !== undefined) return undefined;
  return token.number;
}

/** A whole shadow, filter or transform token in a list, and the entries to use when it is unset. */
interface ShadowsMarker {
  readonly reference: string;
  readonly fallback?: readonly unknown[];
}

/** The slot a list entry can be instead of an entry: one per list property that has them. */
const SLOT_KINDS = {
  __shadows: 'shadow',
  __filters: 'filter',
  __transforms: 'transform',
  __variants: 'fontVariant',
} as const satisfies Record<string, TokenKind>;

const SLOT_ENTRIES = Object.entries(SLOT_KINDS);

/** The slot a list entry is, and the form of token that fills it; undefined for an entry. */
function slotOf(part: unknown): { marker: ShadowsMarker; kind: TokenKind } | undefined {
  if (part === null || typeof part !== 'object') return undefined;
  for (const [key, kind] of SLOT_ENTRIES) {
    const marker = (part as Record<string, ShadowsMarker | undefined>)[key];
    if (marker) return { marker, kind };
  }
  return undefined;
}

function resolveLength(
  marker: LengthMarker,
  tokens: Readonly<Record<string, TokenValue>>,
): number | undefined {
  const value = formOf(tokens[marker.reference], 'length') ?? marker.fallback;
  if (typeof value !== 'number') return undefined;
  return marker.adjust ? (adjusted(value, marker.adjust) as number) : value;
}

/** A colour at no opacity at all. */
function invisible(colour: unknown): boolean {
  if (colour === 'transparent') return true;
  const parts = typeof colour === 'string' ? RGB.exec(colour) : null;
  return parts?.[4] !== undefined && Number(parts[4]) === 0;
}

/**
 * Whether a compiled value has something in it to settle: a marker, slot or deferred length at
 * any depth. One with none is used as it is. Asked of values from the sheet, which never change,
 * so the answer is kept: Tailwind's reset fills three of a shadow's five slots with one on every
 * node.
 */
function needsFilling(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false;
  let answer = NEEDS_FILLING.get(value);
  if (answer === undefined) {
    answer = Object.entries(value).some(
      ([key, part]) => key.startsWith('__') || needsFilling(part),
    );
    NEEDS_FILLING.set(value, answer);
  }
  return answer;
}
const NEEDS_FILLING = new WeakMap<object, boolean>();

/** What `settledMarker` says of a part that is not a token's marker at all. */
const NOT_A_MARKER = Symbol('not a marker');

/** A colour, length or calc marker settled from the tokens, or undefined when one cannot be. */
function settledMarker(value: object, tokens: Readonly<Record<string, TokenValue>>): unknown {
  const colour = colourMarker(value);
  if (colour) return resolveColour(colour, tokens);
  // Whether a shadow is inset, from a token that is the word or nothing: `ring-inset`.
  const inset = (value as { __inset?: { reference: string } }).__inset;
  if (inset) return formOf(tokens[inset.reference], 'keyword') === 'inset';
  const token = (value as { __length?: LengthMarker }).__length;
  if (token) return resolveLength(token, tokens);
  const sum = (value as { __calc?: CalcMarker }).__calc;
  if (sum) return resolveCalc(sum, tokens);
  return NOT_A_MARKER;
}

/** What a colour that cannot be settled makes of the whole value it is in. */
const UNSETTLED = Symbol('unsettled');

/** `rgba(var(--channels), <alpha>)`: the token's channels, at the alpha written or tokened. */
function channelsColour(
  expression: Extract<ColourExpression, { channels: unknown }>,
  tokens: Readonly<Record<string, TokenValue>>,
): string | undefined {
  const value =
    formOf(tokens[expression.channels.reference], 'channels') ?? expression.channels.fallback;
  const { alpha } = expression;
  if (typeof alpha !== 'number') return fromChannels(value, alpha, tokens);
  const opaque = fromChannels(value, undefined, tokens);
  return opaque === undefined ? undefined : (faded(opaque, alpha) as string);
}

/** A token's colour, or the first of its alternatives that is defined, or its fallback. */
function tokenColour(
  expression: Extract<ColourExpression, { reference: string }>,
  tokens: Readonly<Record<string, TokenValue>>,
): string | undefined {
  let value = formOf(tokens[expression.reference], 'color');
  for (const alternative of expression.alternatives ?? []) {
    if (value !== undefined) break;
    value = formOf(tokens[alternative], 'color');
  }
  return (value as string | undefined) ?? expression.fallback;
}

/** A marker the compiler leaves in a structured value for a colour only the device can settle. */
function colourMarker(value: unknown): ColourExpression | undefined {
  return (value as { __colour?: ColourExpression } | null)?.__colour;
}

/**
 * A resolved length, moved by the arithmetic that surrounded its `var()`.
 *
 * A non-numeric value is left alone rather than coerced: the token was a keyword or a percentage
 * the app meant, and turning it into NaN would be a silent layout rather than a visible one.
 */
function adjusted(value: unknown, adjust: NonNullable<DeferredDeclaration['adjust']>): unknown {
  if (adjust.alpha !== undefined) return faded(value, adjust.alpha);
  if (typeof value !== 'number') return value;
  const scaled = value * (adjust.scale ?? 1) + (adjust.offset ?? 0);
  return adjust.floor === undefined ? scaled : Math.max(scaled, adjust.floor);
}

/** `rgb(r, g, b)` and `rgba(r, g, b, a)`, which is every colour the compiler emits. */
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

/**
 * A colour at a fraction of its opacity.
 *
 * Multiplied rather than replaced, so a token that was already translucent stays relatively so -
 * `rgba(0, 0, 0, 0.5)` faded to 90% is 45% opaque, which is what a browser computes for the same
 * mix. A value that is not one of ours is returned untouched: it may be a platform colour, and a
 * colour nobody can parse is better painted as it stands than dropped.
 */
function faded(value: unknown, fraction: number): unknown {
  if (typeof value !== 'string') return value;
  const parts = RGB.exec(value);
  if (!parts) return value;
  const alpha = (parts[4] === undefined ? 1 : Number(parts[4])) * fraction;
  return `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, ${Math.round(alpha * 1000) / 1000})`;
}
