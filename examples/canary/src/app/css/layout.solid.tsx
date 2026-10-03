/** @jsxImportSource @solid-native/platform/solid */
import { View, Text, ScrollView } from '@solid-native/components/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { Example, Section } from '../example.solid.tsx';
import { page } from '../screen-styles.ts';
import sheet from './layout.native.css';
import { For, withNativeStyles } from '@solid-native/platform/solid';

const box = (color: string, extra: object = {}) => ({
  backgroundColor: color,
  minWidth: 34,
  minHeight: 34,
  borderRadius: 6,
  ...extra,
});

export function LayoutPage() {
  const many = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const blue = '#3b6ef5';
  const pink = '#c83ca0';
  const teal = '#2fbf9f';

  const a = box(blue);
  const b = box(pink);
  const c = box(teal);
  const short = box(blue, { minHeight: 24 });
  const tall = box(pink, { minHeight: 56 });
  const tallA = box(blue, { minHeight: 56, flex: 1 });
  const tallB = box(pink, { flex: 1 });
  const selfStart = box(teal, { minHeight: 56, alignSelf: 'flex-start' });
  const chip = box(blue, { minWidth: 44, minHeight: 20 });

  const rowGap = { flexDirection: 'row', gap: 8 };
  const colGap = { gap: 8 };
  const rowReverse = { flexDirection: 'row-reverse', gap: 8 };
  const between = { flexDirection: 'row', justifyContent: 'space-between' };
  const around = { flexDirection: 'row', justifyContent: 'space-around' };
  const centre = { flexDirection: 'row', justifyContent: 'center', gap: 8 };
  const stretch = { flexDirection: 'row', gap: 8, minHeight: 56 };
  const crossCentre = { flexDirection: 'row', alignItems: 'center', gap: 8 };
  const crossEnd = { flexDirection: 'row', alignItems: 'flex-end', gap: 8 };

  const grow1 = box(blue, { flex: 1 });
  const grow1b = box(pink, { flex: 1 });
  const grow2 = box(blue, { flex: 2 });

  const rowNoWrap = { flexDirection: 'row', gap: 8 };
  const clip = { overflow: 'hidden' };
  const wide = box(blue, { width: 220 });
  const wideB = box(pink, { width: 220 });
  const wideShrink = box(blue, { width: 220, flexShrink: 1 });
  const wideShrinkB = box(pink, { width: 220, flexShrink: 1 });

  const wrap = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 };
  const splitGap = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 20,
  };

  const pinTopRight = box(blue, { position: 'absolute', top: 8, right: 8 });
  const pinBottomLeft = box(pink, { position: 'absolute', bottom: 8, left: 8 });
  const inset = {
    position: 'absolute',
    inset: 10,
    backgroundColor: teal,
    borderRadius: 6,
  };
  const stackTop = box(pink, {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 60,
    height: 60,
    zIndex: 2,
  });
  const stackBottom = box(blue, {
    position: 'absolute',
    top: 40,
    left: 44,
    width: 60,
    height: 60,
  });

  const ratio = { aspectRatio: 3, backgroundColor: blue, borderRadius: 8 };
  const percent = {
    width: '60%',
    height: 34,
    backgroundColor: pink,
    borderRadius: 6,
  };
  const clamped = {
    width: 500,
    maxWidth: '100%',
    minHeight: 44,
    backgroundColor: teal,
    borderRadius: 6,
  };

  const oversize = { width: 400, height: 140, backgroundColor: blue };

  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Layout" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Flexbox through Yoga. The defaults are not the web's, which is where most surprises come
          from.
        </Text>

        <Section title="Direction" note="Column is the default here, not row.">
          <Example
            title="flexDirection: row"
            note="Three boxes left to right."
            code={"{ flexDirection: 'row', gap: 8 }"}
          >
            <View style={rowGap}>
              <View style={a}></View>
              <View style={b}></View>
              <View style={c}></View>
            </View>
          </Example>

          <Example
            title="flexDirection: column"
            note="The default. Nothing has to ask for it."
            code={'{ gap: 8 }'}
          >
            <View style={colGap}>
              {' '}
              <View style={a}></View>
              <View style={b}></View>{' '}
            </View>
          </Example>

          <Example
            title="row-reverse"
            note="Order flips, and so does which edge flex-start means."
            code={"{ flexDirection: 'row-reverse' }"}
          >
            <View style={rowReverse}>
              <View style={a}></View>
              <View style={b}></View>
              <View style={c}></View>
            </View>
          </Example>
        </Section>

        <Section title="Main axis" note="justifyContent, along the direction.">
          <Example title="space-between" code={"{ justifyContent: 'space-between' }"}>
            <View style={between}>
              <View style={a}></View>
              <View style={b}></View>
              <View style={c}></View>
            </View>
          </Example>
          <Example title="space-around" code={"{ justifyContent: 'space-around' }"}>
            <View style={around}>
              <View style={a}></View>
              <View style={b}></View>
              <View style={c}></View>
            </View>
          </Example>
          <Example title="center" code={"{ justifyContent: 'center' }"}>
            <View style={centre}>
              {' '}
              <View style={a}></View>
              <View style={b}></View>{' '}
            </View>
          </Example>
        </Section>

        <Section title="Cross axis" note="alignItems, across the direction.">
          <Example
            title="stretch"
            note="The default: children fill the cross axis unless they say otherwise."
            code={"{ flexDirection: 'row' }"}
          >
            <View style={stretch}>
              <View style={tallA}></View>
              <View style={tallB}></View>
            </View>
          </Example>
          <Example title="center" code={"{ alignItems: 'center' }"}>
            <View style={crossCentre}>
              <View style={short}></View>
              <View style={tall}></View>
              <View style={short}></View>
            </View>
          </Example>
          <Example title="flex-end" code={"{ alignItems: 'flex-end' }"}>
            <View style={crossEnd}>
              <View style={short}></View>
              <View style={tall}></View>
              <View style={short}></View>
            </View>
          </Example>
          <Example
            title="alignSelf overrides it"
            note="The middle box opts out of the row's alignItems."
            code={"{ alignSelf: 'flex-start' }"}
          >
            <View style={crossCentre}>
              <View style={short}></View>
              <View style={selfStart}></View>
              <View style={short}></View>
            </View>
          </Example>
        </Section>

        <Section title="Growing and shrinking">
          <Example
            title="flex: 1 shares the space"
            note="Each takes an equal share of what is left."
            code={'{ flex: 1 }'}
          >
            <View style={rowGap}>
              <View style={grow1}></View>
              <View style={grow1b}></View>
            </View>
          </Example>
          <Example
            title="Different flex values"
            note="Two to one: the first takes twice the remaining space."
            code={'{ flex: 2 } and { flex: 1 }'}
          >
            <View style={rowGap}>
              <View style={grow2}></View>
              <View style={grow1b}></View>
            </View>
          </Example>
          <Example
            title="flexShrink is 0 here, not 1"
            note="The web shrinks by default and this does not, so a row of wide children overflows
                rather than squeezing. The second row asks to shrink."
            code={'{ flexShrink: 1 }'}
          >
            <View style={clip}>
              <View style={rowNoWrap}>
                <View style={wide}></View>
                <View style={wideB}></View>
              </View>
            </View>
            <View style={clip}>
              <View style={rowNoWrap}>
                <View style={wideShrink}></View>
                <View style={wideShrinkB}></View>
              </View>
            </View>
          </Example>
        </Section>

        <Section title="Wrapping and gaps">
          <Example title="flexWrap: wrap" code={"{ flexWrap: 'wrap', gap: 8 }"}>
            <View style={wrap}>
              <For each={many}>
                {(_) => (
                  <>
                    <View style={chip}></View>{' '}
                  </>
                )}
              </For>
            </View>
          </Example>
          <Example
            title="rowGap and columnGap"
            note="Different spacing on each axis, with no margins involved."
            code={'{ rowGap: 4, columnGap: 20 }'}
          >
            <View style={splitGap}>
              <For each={many}>
                {(_) => (
                  <>
                    <View style={chip}></View>{' '}
                  </>
                )}
              </For>
            </View>
          </Example>
        </Section>

        <Section title="Out of flow">
          <Example
            title="position: absolute"
            note="Positioned against the nearest parent, which here is the grey stage."
            code={"{ position: 'absolute', top: 8, right: 8 }"}
          >
            <View class="relative-box">
              <View style={pinTopRight}></View>
              <View style={pinBottomLeft}></View>
            </View>
          </Example>
          <Example
            title="Inset shorthand"
            note="All four edges at once: the child fills its parent with a margin."
            code={"{ position: 'absolute', inset: 10 }"}
          >
            <View class="relative-box">
              <View style={inset}></View>
            </View>
          </Example>
          <Example
            title="zIndex"
            note="The magenta box is written first and still paints on top."
            code={'{ zIndex: 2 }'}
          >
            <View class="relative-box">
              <View style={stackTop}></View>
              <View style={stackBottom}></View>
            </View>
          </Example>
        </Section>

        <Section title="Sizing">
          <Example
            title="aspectRatio"
            note="A width and a ratio; the height follows. Useful where an image's size is not known."
            code={'{ aspectRatio: 3, height: undefined }'}
          >
            <View style={ratio}></View>
          </Example>
          <Example
            title="Percentages"
            note="Resolved during native layout, against the parent."
            code={"{ width: '60%' }"}
          >
            <View style={percent}></View>
          </Example>
          <Example
            title="min and max"
            note="The box wants 500 wide and is capped, then floored by minHeight."
            code={"{ width: 500, maxWidth: '100%', minHeight: 44 }"}
          >
            <View style={clamped}></View>
          </Example>
        </Section>

        <Section title="Overflow">
          <Example
            title="overflow: hidden"
            note="The child is larger than the parent and is clipped, including the rounded corner."
            code={"{ overflow: 'hidden', borderRadius: 12 }"}
          >
            <View class="clip-round">
              <View style={oversize}></View>
            </View>
          </Example>
        </Section>
      </ScrollView>
    </>
  ));
}
