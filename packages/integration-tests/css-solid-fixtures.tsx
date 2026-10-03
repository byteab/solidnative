/** @jsxImportSource @solidnative/platform/solid */
/**
 * The component trees the CSS suites mount, each with its stylesheet compiled as Metro compiles a
 * `.native.css` import.
 */
import { createRequire } from 'node:module';
import { createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import {
  For,
  Show,
  createElement,
  insert,
  setNativeStyleHost,
  setProp,
  withNativeStyles,
} from '@solidnative/platform/solid';
import type { EngineNode, StyleSheet } from '@solidnative/fabric';
import {
  Pressable,
  ScrollView,
  Text,
  View as NativeView,
  WorkletScroll,
  WorkletStyle,
  workletScroll,
  workletStyle,
  type WorkletBackend,
  type WorkletScrollSpec,
  type WorkletStyleSpec,
} from '@solidnative/components/solid';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(css: string, file?: string, options?: object): StyleSheet;
};

/** A host element by a name no JSX type declares: a bare primitive, or a typo. */
function bare(name: string, props: Record<string, unknown> = {}, children?: unknown) {
  const node = createElement(name);
  for (const [key, value] of Object.entries(props)) setProp(node, key, value);
  if (children !== undefined) insert(node, children as never);
  return node;
}

export const sheet = (css: string, options?: object): StyleSheet =>
  compileCss(css, 'fixture.native.css', options);

export function styled() {
  const [raised, setRaised] = createSignal(false);
  const css = sheet(`
    view { flex: 1; }
    .card {
      background-color: red;
      padding: 12px 8px;
      /* Inherited by any text inside that does not set its own. */
      color: rgb(1, 2, 3);
      font-size: 11px;
    }
    .card .label { color: blue; font-size: 20px; }
    #main .card { border-radius: 6px; }
    .card.raised { background-color: green; }
    .locked { background-color: black !important; }
  `);
  const View = () =>
    withNativeStyles(css, () => (
      <view nativeID="main">
        <view class="card" classList={{ raised: raised() }}>
          <text class="label">styled</text>
          <text nativeID="inheriting">no rule of its own</text>
        </view>
      </view>
    ));
  return { View, setRaised };
}

/** Custom properties set from bindings and a static style, and rules that read them. */
export function styleCustomProperty() {
  const [tint, setTint] = createSignal('rgb(0, 0, 255)');
  const [gap, setGap] = createSignal<string | null>('4px');
  const css = sheet(`
    .tinted {
      background-color: var(--tint, rgb(0, 0, 0));
      padding-top: var(--brandGap, 1px);
    }
    .inside {
      border-color: var(--tint);
      opacity: var(--columns);
    }
  `);
  const View = () =>
    withNativeStyles(css, () => (
      <view>
        <view
          nativeID="bound"
          class="tinted"
          style={{ '--tint': tint(), '--brandGap': gap(), '--columns': 3 }}
        >
          <view nativeID="inside" class="inside" />
        </view>
        <view
          nativeID="static"
          class="tinted"
          // @ts-expect-error a declaration string, which the renderer parses as CSS does
          style="--tint: rgb(0, 128, 0)"
        />
        <view nativeID="unset" class="tinted" />
      </view>
    ));
  return { View, setTint, setGap };
}

/** A token faded with color-mix, in a child component and under a themed ancestor. */
export function mixHost() {
  const kid = sheet(`
    #mixed { background-color: color-mix(in oklab, var(--brand) 90%, transparent); }
    #fallback-mixed {
      background-color: color-mix(in oklab, var(--missing, rgb(1, 2, 3)) 50%, transparent);
    }
  `);
  const themed = sheet(`
    #themed-mixed { background-color: color-mix(in oklab, var(--brand) 90%, transparent); }
  `);
  const host = sheet(`.themed { --brand: rgb(40, 50, 60); }`);
  const MixKid = () =>
    withNativeStyles(kid, () => [<view nativeID="mixed" />, <view nativeID="fallback-mixed" />]);
  const MixThemed = () => withNativeStyles(themed, () => <view nativeID="themed-mixed" />);
  return () =>
    withNativeStyles(host, () => [
      <view>
        <MixKid />
      </view>,
      <view class="themed">
        <MixThemed />
      </view>,
    ]);
}

interface Row {
  id: number;
  label: string;
}

const SCALE_CSS = `
  .list { flex-grow: 1; background-color: #101014; color: #ffffff; }
  .static { padding: 8px; }
  .row { padding: 10px; background-color: #1c1c24; }
  .list .label { font-size: 15px; color: #c8c8d0; }
  .row .label { letter-spacing: 0.2px; }
  ${Array.from({ length: 20 }, (_, i) => `.a${i + 1} { opacity: 1; }`).join('\n')}
`;

/**
 * A list of pressable rows, each carrying a listener so removal exercises destroyNode as well as
 * the commit; with `styled`, the same tree under a stylesheet the shape a component library
 * produces (several matching rules, many that do not, a descendant selector), so the two can be
 * measured against each other to price the CSS path. Rows are reconciled by id, as a keyed list is.
 */
export function scaleList(styled: boolean) {
  const [state, setState] = createStore<{ rows: Row[] }>({ rows: [] });
  let hits = 0;
  const css = styled ? sheet(SCALE_CSS) : null;
  const View = () =>
    withNativeStyles(css, () => (
      <view class={styled ? 'list' : undefined}>
        <view class={styled ? 'static' : undefined}>
          <text>never changes</text>
        </view>
        <For each={state.rows}>
          {(row) =>
            // The bare host primitive, so the tree is the engine's alone.
            bare(
              'pressable',
              { class: styled ? 'row' : undefined, onTouchEnd: () => hits++ },
              <text class={styled ? 'label' : undefined}>{row.label}</text>,
            )
          }
        </For>
      </view>
    ));
  return {
    View,
    setRows: (rows: Row[]) => setState('rows', reconcile(rows, { key: 'id' })),
    hits: () => hits,
  };
}

/** Rules reading the tokens the device supplies: safe-area insets and the hairline. */
export function deviceTokenHost() {
  const css = sheet(`
    #bar { padding-top: var(--safe-area-inset-top); }
    #button { margin-bottom: var(--safe-area-inset-bottom, 16px); }
    /* Clear the home indicator, and leave a gap above it. */
    #gap { padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 12px); }
    /* Whichever is larger: the indicator, or the padding this design wanted anyway. */
    #atleast { padding-bottom: max(var(--safe-area-inset-bottom, 0px), 16px); }
    #double { padding-top: calc(var(--safe-area-inset-top, 0px) * 2); }
    /* The thinnest line the screen can draw, which on a 3x phone is a third of a point. */
    #divider { border-bottom-width: var(--hairline, 1px); }
  `);
  return () =>
    withNativeStyles(css, () =>
      ['bar', 'button', 'gap', 'atleast', 'double', 'divider'].map((id) => <view nativeID={id} />),
    );
}

/** A component with a stylesheet of its own, for the global sheet to cascade with. */
export function globalStyled() {
  const css = sheet(`
    .box { padding: 2px; }
    .box .label { color: rgb(1, 1, 1); }
  `);
  return () =>
    withNativeStyles(css, () => [
      <view class="box" nativeID="box">
        <text class="label">labelled</text>
      </view>,
      <view class="plain" nativeID="plain">
        <text nativeID="plain-text">plain</text>
      </view>,
    ]);
}

/** Repeated siblings with no styles of their own, so a global sheet is the only thing acting. */
export function globalRows(count = 3) {
  const rows = Array.from({ length: count }, (_, i) => i);
  return () => (
    <view nativeID="list">
      <For each={rows}>{(n) => <view class="row" nativeID={`row${n}`} />}</For>
    </view>
  );
}

/** A gradient with literal stops. */
export function gradientHost() {
  const css = sheet(`#hero { background-image: linear-gradient(to bottom right, red, blue 60%); }`);
  return () => withNativeStyles(css, () => <view nativeID="hero" />);
}

/** A gradient whose stops come from custom properties. */
export function themedGradient() {
  const css = sheet(`
    #themed {
      background-image: linear-gradient(to right, var(--start), var(--middle) 50%, var(--end));
    }
  `);
  return () => withNativeStyles(css, () => <view nativeID="themed" />);
}

/**
 * A child component with `:host` rules, used twice by a parent that themes them. The kid's host
 * element is created in the parent's sheet, as a component host is, and marked as the host of the
 * kid's sheet; what is inside it belongs to the kid's sheet.
 */
export function hostParent() {
  const [dark, setDark] = createSignal(false);
  const kid = sheet(`
    :host { background-color: rgb(1, 1, 1); }
    :host(.active) { background-color: rgb(2, 2, 2); }
    :host .label { color: rgb(3, 3, 3); }
    :host-context(.dark) .label { letter-spacing: 4px; }
    /* For the kid's own elements: the parent's class="active" on the host must not pick it up. */
    .active { padding: 9px; }
  `);
  const parent = sheet(`.wrap { padding: 3px; }`);
  const HostKid = (props: { class?: string }) => (
    <view class={props.class} ref={(node) => setNativeStyleHost(node, kid)}>
      {withNativeStyles(kid, () => (
        <text class="label">kid</text>
      ))}
    </view>
  );
  const View = () =>
    withNativeStyles(parent, () => (
      <view class="wrap" classList={{ dark: dark() }}>
        <HostKid />
        <HostKid class="active" />
      </view>
    ));
  return { View, setDark };
}

/**
 * A parent and a child component that both declare `.wrap`. The child renders no `.wrap` element:
 * its rule exists to prove the child's sheet is never matched against the *parent's* `.wrap` node.
 */
export function crossParent() {
  const child = sheet(`
    .wrap { color: rgb(0, 0, 255); }
    .own { color: rgb(0, 255, 0); }
  `);
  const parent = sheet(`.wrap { color: rgb(255, 0, 0); font-size: 21px; }`);
  const CrossChild = () =>
    withNativeStyles(child, () => [<text class="label">child</text>, <text class="own">own</text>]);
  return () =>
    withNativeStyles(parent, () => (
      <view class="wrap">
        <CrossChild />
      </view>
    ));
}

/**
 * The child text carries no class of its own and never changes. Only the wrapper's class toggles,
 * so the text's colour can only move if inherited style is re-resolved for a node that is not
 * itself dirty.
 */
export function inheritUpdate() {
  const [dark, setDark] = createSignal(false);
  const css = sheet(`
    .wrap { color: rgb(255, 0, 0); }
    .wrap.dark { color: rgb(0, 0, 255); }
    /* Nothing inheritable changes here, only what a descendant matches. */
    .wrap.dark .deep { letter-spacing: 7px; }
  `);
  const View = () =>
    withNativeStyles(css, () => (
      <view class="wrap" classList={{ dark: dark() }}>
        <text>inherits</text>
        <view>
          <text class="deep">matched by a descendant selector</text>
        </view>
      </view>
    ));
  return { View, setDark };
}

/** Viewport and font-relative lengths. */
export function relativeLengths() {
  const css = sheet(`
    #box { width: 50vw; height: 10vh; font-size: 20px; padding-top: 2em; }
    #label { margin-top: 0.5em; }
    #big { font-size: 1.5em; }
  `);
  return () =>
    withNativeStyles(css, () => (
      <view nativeID="box">
        <text nativeID="label">label</text>
        <text nativeID="big">big</text>
      </view>
    ));
}

/** Rules guarded by media queries on every condition the device reports. */
export function responsive() {
  const css = sheet(`
    view { padding-top: 1px; }
    @media (min-width: 600px) { view { padding-top: 2px; } }
    @media (prefers-color-scheme: dark) { text { color: rgb(9, 9, 9); } }
    @media (min-width: 600px) and (orientation: landscape) { view { padding-bottom: 3px; } }
    @media (max-width: 100px), (min-height: 900px) { view { padding-left: 4px; } }
    .toggle { display: none; }
    @media (min-width: 600px) { .toggle { display: block; } }
    @media (prefers-reduced-motion: reduce) { view { padding-right: 5px; } }
  `);
  return () =>
    withNativeStyles(css, () => (
      <view nativeID="box">
        <text nativeID="label">responsive</text>
        <view nativeID="toggle" class="toggle" />
      </view>
    ));
}

/** A text coloured with the platform's own label colour. */
export function platformColorHost() {
  const css = sheet(`#label { color: platform-color(label); }`);
  return () => withNativeStyles(css, () => <text nativeID="label">system</text>);
}

/** A card with a box shadow, whose colour sits inside a style value. */
export function shadowed() {
  const css = sheet(
    `.card { box-shadow: 0 1px 2px rgb(1, 2, 3); background-color: rgb(4, 5, 6); }`,
  );
  return () =>
    withNativeStyles(css, () => (
      <view class="card">
        <text>shadowed</text>
      </view>
    ));
}

/** `:disabled` from a prop, and `:focus`/`:active` from engine state. */
export function stateful() {
  const css = sheet(`
    view:disabled { opacity: 0.4; }
    view:focus { border-top-width: 2px; }
    view:active { background-color: rgb(5, 5, 5); }
  `);
  return () =>
    withNativeStyles(css, () => [
      <view
        nativeID="a"
        // @ts-expect-error `:disabled` is matched from the prop, whatever the view does with it
        disabled={true}
      >
        <text nativeID="a-label">off</text>
      </view>,
      <view nativeID="b">
        <text nativeID="b-label">on</text>
      </view>,
    ]);
}

/** A pressable inside a view, both styled `:active`, through the real Pressable component. */
export function active() {
  const css = sheet(`
    #btn { background-color: rgb(1, 1, 1); }
    #btn:active { background-color: rgb(2, 2, 2); }
    /* :active applies up the chain on the web, so an ancestor may style itself too. */
    #outer:active { border-top-width: 3px; }
  `);
  let presses = 0;
  const View = () =>
    withNativeStyles(css, () => (
      <NativeView nativeID="outer">
        <Pressable nativeID="btn" onPress={() => presses++}>
          <Text nativeID="inner">tap</Text>
        </Pressable>
      </NativeView>
    ));
  return { View, presses: () => presses };
}

/** A list styled by its rows' places among their siblings. */
export function structuralHost() {
  const [count, setCount] = createSignal(3);
  const rows = () => Array.from({ length: count() }, (_, i) => i);
  const css = sheet(`
    .row:first-child { border-top-width: 2px; }
    .row:last-child { border-bottom-width: 4px; }
    .row:nth-child(odd) { background-color: #eee; }
    .row + .row { margin-top: 8px; }
  `);
  const View = () =>
    withNativeStyles(css, () => (
      <view nativeID="list">
        <For each={rows()}>{(n) => <view class="row" nativeID={`row${n}`} />}</For>
      </view>
    ));
  return { View, setCount };
}

/** A child whose rules read tokens, used plain and under a themed parent that defines some. */
export function tokenHost() {
  const kid = sheet(`
    view { padding-top: var(--pad); background-color: var(--bg); }
    text {
      color: var(--ink, rgb(3, 3, 3));
      font-weight: var(--weight);
      font-size: 20px;
      letter-spacing: var(--ls);
    }
  `);
  const host = sheet(`.themed { --pad: 4px; --bg: rgb(2, 2, 2); }`);
  const TokenKid = () =>
    withNativeStyles(kid, () => (
      <view nativeID="inner">
        <text nativeID="inner-text">kid</text>
      </view>
    ));
  return () =>
    withNativeStyles(host, () => [
      <view nativeID="plain">
        <TokenKid />
      </view>,
      <view nativeID="themed" class="themed">
        <TokenKid />
      </view>,
    ]);
}

/** Custom properties used where nothing defines them, with and without a fallback. */
export function undefinedToken() {
  const css = sheet(`
    .pinned { background-color: var(--backdrop); }
    .fallback { background-color: var(--unset-tint, red); }
    .defined { --tone: blue; background-color: var(--tone); }
    .scoped { --edge: 4px; }
    .inner { padding: var(--edge); }
  `);
  return () =>
    withNativeStyles(css, () => [
      <view class="pinned" nativeID="a" />,
      <view class="pinned" nativeID="b" />,
      <view class="fallback" nativeID="c" />,
      <view class="defined" nativeID="d" />,
      <view class="scoped" nativeID="e">
        <view class="inner" nativeID="f" />
      </view>,
    ]);
}

/** A host view whose own touch listener and a child's both record a bubbling touch. */
export function eventErrors() {
  const bubbled: string[] = [];
  let host!: EngineNode;
  const View = () => (
    <view nativeID="host" ref={(node) => (host = node)} onTouchEnd={() => bubbled.push('host')}>
      <view nativeID="target" onTouchEnd={() => bubbled.push('view')} />
    </view>
  );
  return { View, bubbled, host: () => host };
}

/**
 * A pressable row with a delete button inside it, which is the shape that asks for a press to
 * stay where it landed. The touch listeners are plain element events, which bubble whether or
 * not a responder owns the gesture, so they are where stopping a bubble actually matters.
 */
export function propagation() {
  const state = { log: [] as string[], stop: false };
  const View = () => (
    <NativeView nativeID="list" onTouchEnd={() => state.log.push('list:touchEnd')}>
      <Pressable
        nativeID="row"
        onPress={() => state.log.push('row:press')}
        onTouchEnd={() => state.log.push('row:touchEnd')}
      >
        <Text>Row</Text>
        <Pressable
          nativeID="delete"
          onPress={() => state.log.push('delete:press')}
          onTouchEnd={(event: { stopPropagation(): void }) => {
            state.log.push('delete:touchEnd');
            if (state.stop) event.stopPropagation();
          }}
        >
          <Text>Delete</Text>
        </Pressable>
      </Pressable>
    </NativeView>
  );
  return { View, state };
}

/** Texts inside, outside and across `direction` subtrees. */
export function textDirection() {
  const [inline, setInline] = createSignal<Record<string, string>>({ direction: 'rtl' });
  const css = sheet(`
    .rtl { direction: rtl; }
    .ltr { direction: ltr; }
    .start { text-align: start; }
    .end { text-align: end; }
    .left { text-align: left; }
    .centre { text-align: center; }
  `);
  const View = () =>
    withNativeStyles(css, () => [
      <view class="rtl">
        <text testID="plain">latin</text>
        <text testID="arabic">نص عربي قصير</text>
        <text testID="start" class="start">
          start
        </text>
        <text testID="end" class="end">
          end
        </text>
        <text testID="left" class="left">
          left
        </text>
        <text testID="centre" class="centre">
          centre
        </text>
        <text testID="written" style={{ writingDirection: 'ltr' }}>
          written
        </text>
        <view class="ltr">
          <text testID="back">back to ltr</text>
        </view>
      </view>,
      <view style={inline()}>
        <text testID="inline">inline</text>
      </view>,
      <text testID="none">no direction</text>,
      <text testID="none-end" class="end">
        no direction, end
      </text>,
    ]);
  return { View, setInline };
}

/** Text that names no colour of its own, under a plain block or under `.dark`. */
export function themeForeground(dark: boolean) {
  return () => (
    <view class={dark ? 'dark' : undefined}>
      <text nativeID="plain">plain</text>
    </view>
  );
}

/** A typo: nothing claims `<veiw>`, so it renders as an empty view. */
export function typo() {
  return () => (
    <view>
      {bare('veiw', {}, <text>Lost</text>)}
      {bare('veiw')}
    </view>
  );
}

/** The ways a component can name a style: a static string, a bound string, an object, one key. */
export function styleForms() {
  const bound = () => 'flex: 1; margin-top: 5px';
  const margin = () => '7px';
  return () => [
    // @ts-expect-error a declaration string, which the renderer parses as CSS does
    <view nativeID="static" style="flex: 1; margin-top: 4px" />,
    // @ts-expect-error a declaration string, bound
    <view nativeID="bound-string" style={bound()} />,
    <view nativeID="bound-object" style={{ flex: 1, marginTop: 6 }} />,
    // @ts-expect-error one style key, bound on its own
    <view nativeID="single" style:marginTop={margin()} />,
  ];
}

/** A view whose transform follows a shared value on the UI thread. */
export function sliding(backend: WorkletBackend) {
  const offset = { value: 0 };
  const [style, setStyle] = createSignal<WorkletStyleSpec>(
    workletStyle([offset], (value) => ({ transform: [{ translateX: value.value }] })),
  );
  const [shown, setShown] = createSignal(true);
  const View = () => (
    <Show when={shown()}>
      <NativeView style={{ flex: 1, backgroundColor: 'red' }} ref={WorkletStyle(style, backend)}>
        <NativeView />
      </NativeView>
    </Show>
  );
  return { View, setStyle, setShown };
}

/** A scroll view whose scroll is handled on the UI thread, writing a shared value. */
export function scrolling(backend: WorkletBackend) {
  const offset = { value: 0 };
  const onScroll: WorkletScrollSpec = workletScroll([offset], (event, into) => {
    into.value = event.contentOffset.y;
  });
  const [shown, setShown] = createSignal(true);
  const View = () => (
    <Show when={shown()}>
      <ScrollView ref={WorkletScroll(() => onScroll, backend)}>
        <NativeView />
      </ScrollView>
    </Show>
  );
  return { View, setShown };
}
