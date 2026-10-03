/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router/solid';
import { Basket, FREE_DELIVERY, price, type Line } from './shop-model.solid.ts';
import sheet from './basket-sheet.native.css';

export function BasketSheet() {
  const basket = useService(Basket),
    nav = useNavigation(),
    priceOf = price;
  const towardsFree = () => Math.min(100, (basket.subtotal() / FREE_DELIVERY) * 100);
  const deliveryNote = () => {
    const left = FREE_DELIVERY - basket.subtotal();
    return left > 0 ? `${price(left)} away from free delivery` : 'Free delivery unlocked';
  };
  const lineLabel = (line: Line) => `${line.quantity} of ${line.product.name}`;
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <View class="sheet">
        <View class="head">
          <Text accessibilityRole="header" class="title">
            {'Basket'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            class="close"
            onPress={() => {
              nav.back();
            }}
          >
            <Text class="close-label">{'Done'}</Text>
          </Pressable>
        </View>
        <Show
          when={basket.lines().length}
          fallback={
            <>
              <View class="empty">
                <Text class="empty-glyph">{'🛍'}</Text>
                <Text class="empty-label">{'Your basket is empty'}</Text>
              </View>
            </>
          }
        >
          <ScrollView class="lines">
            <View class="meter-block">
              <Text class="meter-label">{deliveryNote()}</Text>
              <View class="meter">
                <View class="meter-fill" style={{ width: `${towardsFree()}%` }}></View>
              </View>
            </View>
            <For each={basket.lines().map((line) => `${line.product.id}:${line.size ?? ''}`)}>
              {(key) => {
                const line = () =>
                  basket.lines().find((one) => `${one.product.id}:${one.size ?? ''}` === key)!;
                return (
                  <>
                    <View class="line" style={{ '--tone': line().product.tone }}>
                      <View class="thumb">
                        <Text class="thumb-glyph">{line().product.glyph}</Text>
                      </View>
                      <View class="line-text">
                        <Text class="line-name">{line().product.name}</Text>
                        <Show when={line().size}>
                          <Text class="line-size">
                            {'Size '}
                            {line().size}
                          </Text>
                        </Show>
                        <Text class="price">{priceOf(line().product.price * line().quantity)}</Text>
                      </View>
                      <View class="stepper">
                        <Pressable
                          accessibilityRole="button"
                          class="step"
                          accessibilityLabel={'One fewer ' + line().product.name}
                          onPress={() => {
                            basket.change(line(), -1);
                          }}
                        >
                          <Text class="step-label">{'−'}</Text>
                        </Pressable>
                        <Text class="quantity" accessibilityLabel={lineLabel(line())}>
                          {line().quantity}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          class="step"
                          accessibilityLabel={'One more ' + line().product.name}
                          onPress={() => {
                            basket.change(line(), 1);
                          }}
                        >
                          <Text class="step-label">{'+'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                );
              }}
            </For>
            <View class="totals">
              <View class="total-row">
                <Text class="total-name">{'Subtotal'}</Text>
                <Text class="total-value">{priceOf(basket.subtotal())}</Text>
              </View>
              <View class="total-row">
                <Text class="total-name">{'Delivery'}</Text>
                <Text class="total-value">
                  {basket.delivery() ? priceOf(basket.delivery()) : 'Free'}
                </Text>
              </View>
              <View class="total-row grand">
                <Text class="total-name">{'Total'}</Text>
                <Text accessibilityRole="summary" class="total-value">
                  {priceOf(basket.total())}
                </Text>
              </View>
            </View>
          </ScrollView>
        </Show>
      </View>
    </view>
  ));
}
