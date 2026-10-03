/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useRoute } from '@solidnative/router/solid';
import { Basket, PRODUCTS, price, saving } from './shop-model.solid.ts';
import sheet from './product-page.native.css';

export function ProductPage() {
  const route = useRoute(),
    basket = useService(Basket),
    front = useService(SCREEN_IN_FRONT);
  const priceOf = price,
    five = [1, 2, 3, 4, 5];
  const product = createMemo(() => PRODUCTS.find((one) => one.id === String(route.inputs['id'])));
  const [size, setSize] = createSignal<string | null>(null),
    [added, setAdded] = createSignal(false);
  const needsSize = () => !!product()?.sizes && size() === null;
  const buttonLabel = () =>
    added() ? 'Added to basket' : needsSize() ? 'Choose a size' : 'Add to basket';
  let active = true,
    epoch = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  const invalidate = () => {
    epoch++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  onCleanup(() => {
    active = false;
    invalidate();
  });
  createEffect(() => {
    product();
    setSize(null);
    setAdded(false);
    invalidate();
  });
  createEffect(() => {
    if (!front()) {
      invalidate();
      setAdded(false);
    }
  });
  const add = () => {
    const one = product();
    if (!active || !front() || !one || needsSize()) return;
    invalidate();
    const request = epoch;
    basket.add(one, size());
    if (!active || !front() || request !== epoch) return;
    setAdded(true);
    if (!active || !front() || request !== epoch) return;
    timer = setTimeout(() => {
      if (active && front() && request === epoch) {
        timer = undefined;
        setAdded(false);
      }
    }, 1600);
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <Show when={product()}>
        {(product) => (
          <>
            <NativeHeader title={product().name}></NativeHeader>
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              class="page"
              style={{ '--tone': product().tone }}
            >
              <View class="hero">
                <Text class="glyph">{product().glyph}</Text>
                <Show when={product().was}>
                  <View class="badge">
                    <Text class="badge-label">
                      {'Save '}
                      {saving(product())}
                      {'%'}
                    </Text>
                  </View>
                </Show>
              </View>
              <View class="info">
                <Text class="maker">{product().maker}</Text>
                <Text accessibilityRole="header" class="name">
                  {product().name}
                </Text>
                <View class="rating">
                  <View class="stars" accessibilityLabel={product().rating + ' out of 5'}>
                    <View class="star-row">
                      <For each={five}>
                        {(n) => (
                          <>
                            <Text class="star">{'★'}</Text>
                          </>
                        )}
                      </For>
                    </View>
                    <View class="stars-fill" style={{ width: `${product().rating * 20}%` }}>
                      <View class="star-row gold">
                        <For each={five}>
                          {(n) => (
                            <>
                              <Text class="star">{'★'}</Text>
                            </>
                          )}
                        </For>
                      </View>
                    </View>
                  </View>
                  <Text class="reviews">
                    {product().rating}
                    {' · '}
                    {product().reviews}
                    {' reviews'}
                  </Text>
                </View>
                <View class="price-row">
                  <Text class={['price big', product().was && 'on-sale'].filter(Boolean).join(' ')}>
                    {priceOf(product().price)}
                  </Text>
                  <Show when={product().was}>
                    <Text class="was">{priceOf(product().was!)}</Text>
                  </Show>
                </View>
                <Show when={product().sizes}>
                  {(sizes) => (
                    <>
                      <Text class="label">{'Size'}</Text>
                      <View accessibilityRole="radiogroup" class="sizes">
                        <For each={sizes()}>
                          {(one) => (
                            <>
                              <Pressable
                                accessibilityRole="radio"
                                class={['size', size() === one && 'picked']
                                  .filter(Boolean)
                                  .join(' ')}
                                accessibilityLabel={'Size ' + one}
                                accessibilityState={{ checked: size() === one }}
                                onPress={() => {
                                  setSize(one);
                                }}
                              >
                                <Text class="size-label">{one}</Text>
                              </Pressable>
                            </>
                          )}
                        </For>
                      </View>
                    </>
                  )}
                </Show>
                <Pressable
                  accessibilityRole="button"
                  class={['add', added() && 'done'].filter(Boolean).join(' ')}
                  accessibilityLabel={buttonLabel()}
                  accessibilityState={{ disabled: needsSize() }}
                  onPress={() => {
                    add();
                  }}
                >
                  <Text class="add-label">{buttonLabel()}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </>
        )}
      </Show>
    </view>
  ));
}
