/*
 * @jsxImportSource @solid-native/platform/solid
 *
 * The CSS engine, shown with ordinary component CSS: layered gradients, a
 * descendant selector reaching `<Text>`, an attribute selector for the chosen plan, `:active`
 * with a transition, and a `prefers-color-scheme` query - this is the dark screen it picks. It
 * is compiled at build time into rules the engine matches against the native tree: there is no
 * DOM and no stylesheet at runtime.
 */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { For, withNativeStyles } from '@solid-native/platform/solid';
import sheet from './plans.native.css';

const PERKS = ['Unlimited projects', 'Sync across every device', 'Priority support'];
const PLANS = [
  { name: 'Monthly', detail: 'Cancel anytime', price: '£9.99' },
  { name: 'Yearly', detail: 'Save 40% · £5.99 a month', price: '£71.88' },
];

export default function Plans() {
  const [chosen, setChosen] = createSignal('Yearly');
  return withNativeStyles(sheet, () => (
    <View class="screen">
      <View class="glow" />
      <View class="badge">
        <Text class="badge-mark">✦</Text>
      </View>
      <Text class="title">Go Pro</Text>
      <Text class="lede">Unlimited projects, instant sync and priority support.</Text>

      <For each={PERKS}>
        {(perk) => (
          <View class="perk">
            <View class="tick">
              <Text>✓</Text>
            </View>
            <Text class="perk-label">{perk}</Text>
          </View>
        )}
      </For>

      <For each={PLANS}>
        {(plan) => (
          <Pressable
            class="plan"
            data-selected={chosen() === plan.name ? '' : undefined}
            onPress={() => setChosen(plan.name)}
          >
            <View>
              <Text class="name">{plan.name}</Text>
              <Text class="detail">{plan.detail}</Text>
            </View>
            <Text class="price">{plan.price}</Text>
          </Pressable>
        )}
      </For>

      <Pressable class="cta">
        <Text>Start free trial</Text>
      </Pressable>

      <View class="quote">
        <Text class="stars">★★★★★</Text>
        <Text class="quote-text">
          “We shipped our app in a month, in the Solid we already knew.”
        </Text>
        <Text class="quote-by">Grace, CTO at Northwind</Text>
      </View>
      <Text class="footer">Restore purchase · Terms · Privacy</Text>
    </View>
  ));
}
