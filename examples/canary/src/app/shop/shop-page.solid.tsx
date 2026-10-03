/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { Basket, PRODUCTS, price, saving, type Product } from './shop-model.solid.ts';
import sheet from './shop-page.native.css';

export function ShopPage() {
  const basket = useService(Basket),
    nav = useNavigation(),
    front = useService(SCREEN_IN_FRONT);
  const products = PRODUCTS,
    content = { paddingBottom: 120 },
    priceOf = price,
    five = [1, 2, 3, 4, 5];
  const [bumping, setBumping] = createSignal(false);
  createEffect(() => {
    const adds = basket.adds();
    if (!front() || !adds) {
      setBumping(false);
      return;
    }
    let live = true;
    setBumping(false);
    const frame = requestAnimationFrame(() => {
      if (live && front()) setBumping(true);
    });
    onCleanup(() => {
      live = false;
      cancelAnimationFrame(frame);
    });
  });
  const open = (product: Product) => {
    void nav.push(`/shop/${product.id}`);
  };
  const openBasket = () => {
    void nav.present('/shop/basket', { as: 'pageSheet' });
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Shop" largeTitle={true}></NativeHeader>
      <View class="screen">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          class="page"
          contentContainerStyle={content}
        >
          <View class="promo">
            <Text class="promo-title">{'Autumn edit'}</Text>
            <Text class="promo-hint">{'Up to 20% off outdoor, this week only'}</Text>
          </View>
          <View class="grid">
            <For each={products}>
              {(product) => (
                <>
                  <Pressable
                    accessibilityRole="button"
                    class="tile"
                    accessibilityLabel={
                      product.name +
                      ', ' +
                      priceOf(product.price) +
                      (product.was ? ', was ' + priceOf(product.was!) : '')
                    }
                    style={{ '--tone': product.tone }}
                    onPress={() => {
                      open(product);
                    }}
                  >
                    <View class="art">
                      <Text class="glyph">{product.glyph}</Text>
                      <Show when={product.was}>
                        <View class="badge">
                          <Text class="badge-label">
                            {'-'}
                            {saving(product)}
                            {'%'}
                          </Text>
                        </View>
                      </Show>
                    </View>
                    <Text class="maker">{product.maker}</Text>
                    <Text class="name" numberOfLines={1}>
                      {product.name}
                    </Text>
                    <View class="stars" accessibilityLabel={product.rating + ' out of 5'}>
                      <View class="star-row">
                        <For each={five}>
                          {(n) => (
                            <>
                              <Text class="star">{'★'}</Text>
                            </>
                          )}
                        </For>
                      </View>
                      <View class="stars-fill" style={{ width: `${product.rating * 20}%` }}>
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
                    <View class="price-row">
                      <Text class={['price', product.was && 'on-sale'].filter(Boolean).join(' ')}>
                        {priceOf(product.price)}
                      </Text>
                      <Show when={product.was}>
                        <Text class="was">{priceOf(product.was!)}</Text>
                      </Show>
                    </View>
                  </Pressable>
                </>
              )}
            </For>
          </View>
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          class="basket"
          accessibilityLabel={'Basket, ' + basket.count() + ' items'}
          onPress={() => {
            openBasket();
          }}
        >
          <Text class="basket-glyph">{'🛍'}</Text>
          <Show when={basket.count()}>
            <View class={['count', bumping() && 'bump'].filter(Boolean).join(' ')}>
              <Text class="count-label">{basket.count()}</Text>
            </View>
          </Show>
        </Pressable>
      </View>
    </view>
  ));
}
