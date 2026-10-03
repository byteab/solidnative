/** @jsxImportSource @solidnative/platform/solid */
import { View, Text, TextInput, Pressable } from '@solidnative/components/solid';
import sheet from './css-demo.native.css';
import { withNativeStyles, setNativeStyleHost } from '@solidnative/platform/solid';

export function CssDemo() {
  return withNativeStyles(sheet, () => (
    <>
      <view ref={(node) => setNativeStyleHost(node, sheet)}>
        {/* SELECTORS */}
        <View class="section sel">
          <Text class="section-title">Selectors</Text>
          <Text nativeID="by-id">id selector: green</Text>
          <Text class="descendant">descendant: green</Text>
          <Text class="child">child (direct): green</Text>
          <View class="nested">
            <Text class="descendant-only">nested descendant: red</Text>
          </View>
          <Text data-flag="yes">attribute present: green</Text>
          <Text data-kind="alpha">attribute equals: green</Text>
          <Text data-kind="beta">attribute prefix: green</Text>
          <Text class="pick one">:is(.one, .two): green and italic</Text>
          <Text class="pick three">:not(.one, .two): red</Text>
          <Text class="cap">a red line above means that selector matched correctly</Text>
        </View>

        {/* CASCADE */}
        <View class="section">
          <Text class="section-title">Cascade</Text>
          <Text class="cascade wins">specificity: two classes beat one, green</Text>
          <Text class="later">source order: the later rule wins, green</Text>
          <Text class="shout shout-loser">!important beats a later rule, green</Text>
        </View>

        {/* INHERITANCE */}
        <View class="section inherits">
          <Text class="section-title">Inheritance</Text>
          <Text>this text sets no colour of its own and is green</Text>
          <Text class="cap">letter-spacing and font-size come down the tree too</Text>
        </View>

        {/* TOKENS */}
        <View class="section">
          <Text class="section-title">Tokens (var)</Text>
          <View class="row">
            <View class="token-swatch"></View>
            <Text>--accent from the app's global sheet: blue</Text>
          </View>
          <View class="row token-local">
            <View class="token-swatch"></View>
            <Text>--accent redefined on this row: green</Text>
          </View>
          <Text class="token-fallback">var() fallback when undefined: green</Text>
        </View>

        {/* MEDIA */}
        <View class="section">
          <Text class="section-title">Media queries</Text>
          <Text class="media-note">min-width 300px: green on a phone</Text>
          <Text class="portrait-only">orientation portrait: green upright, grey rotated</Text>
          <Text class="scheme">prefers-color-scheme dark: green in dark mode</Text>
          <Text class="cap">rotate the device, or switch appearance, and these change live</Text>
        </View>

        {/* STATE */}
        <View class="section">
          <Text class="section-title">Pseudo-state</Text>
          <Pressable class="press">
            <Text>press and hold me: turns green</Text>
          </Pressable>
          <Text class="off" disabled={true}>
            :disabled reads a prop: red
          </Text>
          <TextInput
            class="input"
            placeholder="focus me: border turns green"
            placeholderTextColor="#6c6c78"
          />
        </View>

        {/* UNITS */}
        <View class="section">
          <Text class="section-title">Units</Text>
          <View class="row">
            <View class="bar u-px"></View>
            <Text class="cap">40px</Text>
          </View>
          <View class="row">
            <View class="bar u-rem"></View>
            <Text class="cap">2.5rem = 40</Text>
          </View>
          <View class="row">
            <View class="bar u-em"></View>
            <Text class="cap">3em of 16 = 48</Text>
          </View>
          <View class="row">
            <View class="bar u-calc"></View>
            <Text class="cap">calc(2rem + 8px) = 40</Text>
          </View>
          <View class="row">
            <View class="bar u-vw"></View>
            <Text class="cap">12vw</Text>
          </View>
          <View class="row">
            <View class="bar u-pct"></View>
            <Text class="cap">25%</Text>
          </View>
          <Text class="cap">the first, second and fourth bars must be the same length</Text>
        </View>

        {/* PROPERTIES */}
        <View class="section">
          <Text class="section-title">Properties</Text>
          <View class="row">
            <View class="panel">
              <Text>border + shadow</Text>
            </View>
            <View class="panel tilted">
              <Text>transform</Text>
            </View>
          </View>
          <Text class="struck">text-decoration shorthand</Text>
          <Text class="fonted">font shorthand</Text>
          <Text class="shadowed-text">text-shadow</Text>
          <View class="logical">
            <Text>padding-inline (logical)</Text>
          </View>
        </View>
      </view>
    </>
  ));
}
