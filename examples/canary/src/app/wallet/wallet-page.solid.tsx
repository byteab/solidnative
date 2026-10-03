/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { For, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import {
  CARDS,
  CATEGORY_NAMES,
  CATEGORY_TONES,
  CURRENCIES,
  Wallet,
  type Transaction,
} from './wallet-model.solid.ts';
import sheet from './wallet-page.native.css';
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export function WalletPage() {
  const wallet = useService(Wallet);
  const [revealed, setRevealed] = createSignal(false),
    [picked, setPicked] = createSignal(6);
  const tallest = createMemo(() => Math.max(1, ...wallet.days()));
  const dayName = (index: number) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return index === 6 ? 'Today' : WEEKDAY.format(date);
  };
  const whenOf = (one: Transaction) => {
    if (one.daysAgo === 0) return 'Today';
    if (one.daysAgo === 1) return 'Yesterday';
    const date = new Date();
    date.setDate(date.getDate() - one.daysAgo);
    return DAY.format(date);
  };
  const chosenDay = createMemo(
    () => `${dayName(picked())}, ${wallet.format(wallet.days()[picked()] ?? 0)}`,
  );
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Wallet" hidden />
      <ScrollView class="page" contentInsetAdjustmentBehavior="never" stickyHeaderIndices={[1]}>
        <View class="hero" style={{ '--card': wallet.card().tone }}>
          <View class="drift">
            <ScrollView
              class="cards"
              horizontal
              pagingEnabled={false}
              snapToInterval={314}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={32}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              onMomentumScrollEnd={(event) => {
                const index = Math.round((event.nativeEvent.contentOffset?.x ?? 0) / 314);
                const card = CARDS[Math.max(0, Math.min(CARDS.length - 1, index))];
                if (card) wallet.setCard(card);
              }}
            >
              <For each={CARDS}>
                {(card) => (
                  <View
                    class="card"
                    style={{ '--card': card.tone }}
                    accessibilityRole="summary"
                    accessibilityLabel={`${card.name} card ending ${card.last4}`}
                  >
                    <View class="card-top">
                      <Text class="card-name">{card.name}</Text>
                      <Text class="card-network">VISA</Text>
                    </View>
                    <View class="chip">
                      <View class="chip-line" />
                      <View class="chip-line" />
                    </View>
                    <Text class="card-number">
                      {revealed() ? '4000 1234 5678 ' + card.last4 : '•••• •••• •••• ' + card.last4}
                    </Text>
                    <Text class="card-holder">{card.holder}</Text>
                  </View>
                )}
              </For>
            </ScrollView>
            <Pressable
              class="reveal"
              accessibilityRole="button"
              accessibilityLabel={revealed() ? 'Hide card number' : 'Show card number'}
              onPress={() => setRevealed(!revealed())}
            >
              <Text class="reveal-label">{revealed() ? 'Hide number' : 'Show number'}</Text>
            </Pressable>
          </View>
          <View class="balance-block">
            <Text class="balance-label">Balance</Text>
            <Text class="balance" accessibilityRole="header">
              {wallet.format(wallet.balance())}
            </Text>
          </View>
        </View>
        <View class="compact" style={{ '--card': wallet.card().tone }}>
          <Text class="compact-title">{wallet.card().name}</Text>
          <Text class="compact-balance">{wallet.format(wallet.balance())}</Text>
        </View>
        <View class="currencies" accessibilityRole="tablist">
          <For each={CURRENCIES}>
            {(code) => (
              <Pressable
                class="currency"
                classList={{ on: wallet.currency() === code }}
                accessibilityRole="tab"
                accessibilityLabel={code}
                accessibilityState={{ selected: wallet.currency() === code }}
                onPress={() => wallet.setCurrency(code)}
              >
                <Text class="currency-label">{code}</Text>
              </Pressable>
            )}
          </For>
        </View>
        <View class="panel">
          <View class="panel-head">
            <Text class="panel-title">This week</Text>
            <Text class="panel-note">{chosenDay()}</Text>
          </View>
          <View class="chart">
            <For each={[0, 1, 2, 3, 4, 5, 6]}>
              {(index) => (
                <Pressable
                  class="column"
                  classList={{ picked: picked() === index }}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayName(index)}, ${wallet.format(wallet.days()[index] ?? 0)}`}
                  onPress={() => setPicked(index)}
                >
                  <View class="track">
                    <View
                      class="bar"
                      style={{
                        '--amount': Math.max(
                          6,
                          Math.round(((wallet.days()[index] ?? 0) / tallest()) * 140),
                        ),
                        '--i': index,
                      }}
                    />
                  </View>
                  <Text class="day">{dayName(index)}</Text>
                </Pressable>
              )}
            </For>
          </View>
        </View>
        <View class="panel">
          <Text class="panel-title">Where it went</Text>
          <View class="split">
            <For each={wallet.categories()}>
              {(part) => (
                <View
                  class="segment"
                  style={{ '--share': part.share, '--tone': CATEGORY_TONES[part.category] }}
                />
              )}
            </For>
          </View>
          <View class="legend">
            <For each={wallet.categories()}>
              {(part) => (
                <View class="legend-row" style={{ '--tone': CATEGORY_TONES[part.category] }}>
                  <View class="legend-dot" />
                  <Text class="legend-name">{CATEGORY_NAMES[part.category]}</Text>
                  <Text class="legend-amount">{wallet.format(part.pence)}</Text>
                </View>
              )}
            </For>
          </View>
        </View>
        <View class="panel">
          <Text class="panel-title">Activity</Text>
          <For each={wallet.transactions().map((one) => one.id)}>
            {(id) => {
              const one = () => wallet.transactions().find((item) => item.id === id)!;
              return (
                <View
                  class="row"
                  style={{ '--tone': CATEGORY_TONES[one().category] }}
                  accessible
                  accessibilityLabel={`${one().merchant}, ${wallet.format(one().amount)}`}
                >
                  <View class="avatar">
                    <Text class="avatar-initial">{one().merchant[0]}</Text>
                  </View>
                  <View class="row-text">
                    <Text class="merchant">{one().merchant}</Text>
                    <Text class="when">{whenOf(one())}</Text>
                  </View>
                  <Text class="amount" classList={{ income: one().amount > 0 }}>
                    {wallet.format(one().amount)}
                  </Text>
                </View>
              );
            }}
          </For>
        </View>
      </ScrollView>
    </view>
  ));
}
