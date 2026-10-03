/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, createRenderEffect, onCleanup } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { For, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { Example, Section } from '../example.solid.tsx';
import { page } from '../screen-styles.ts';
import sheet from './scrolling.native.css';

export function ScrollingPage() {
  const many = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const pages = ['#3b6ef5', '#c83ca0', '#2fbf9f'];
  const [offset, setOffset] = createSignal(0);
  const [blocked, setBlocked] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshes, setRefreshes] = createSignal(0);

  const stripContent = {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    alignItems: 'center',
  };
  const tallContent = { padding: 8, gap: 8 };
  const pager = { height: 110, borderRadius: 8, overflow: 'hidden' };
  const tile = {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#3b6ef5',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const front = useService(SCREEN_IN_FRONT);
  let active = true;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let blockTimer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(refreshTimer);
    clearTimeout(blockTimer);
  };
  createRenderEffect(() => {
    if (!front()) {
      cancel();
      setRefreshing(false);
      setBlocked(false);
    }
  });
  onCleanup(() => {
    active = false;
    cancel();
  });
  const reload = () => {
    if (!active || !front()) return;
    clearTimeout(refreshTimer);
    setRefreshing(true);
    refreshTimer = setTimeout(() => {
      if (!active || !front()) return;
      setRefreshes((count) => count + 1);
      setRefreshing(false);
    }, 800);
  };
  const block = () => {
    if (!active || !front() || blocked()) return;
    setBlocked(true);
    blockTimer = setTimeout(() => {
      if (!active || !front()) return;
      // Deliberate one-second JS stall: the original screen demonstrates native-thread scrolling.
      const until = Date.now() + 1000;
      while (Date.now() < until) {
        /* hold the thread */
      }
      setBlocked(false);
    }, 0);
  };

  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Scrolling" />
      <ScrollView
        class="screen"
        contentContainerStyle={page.content}
        refreshControl={{ refreshing: refreshing(), onRefresh: reload }}
      >
        <Text class="hint">
          Native scrolling. The offsets below come back as events; the scroll itself never waits for
          JavaScript.
        </Text>
        <Text nativeID="refresh-count" class="body">
          Pull the page down to refresh: {refreshes()} so far.
        </Text>

        <Section title="Direction">
          <Example
            title="Horizontal"
            note="One row, scrolled sideways. The content container is what takes the padding and
                the gap, not the scroll view."
            code={'horizontal={true}'}
          >
            <ScrollView
              horizontal={true}
              class="strip"
              contentContainerStyle={stripContent}
              showsHorizontalScrollIndicator={false}
            >
              <For each={many}>
                {(n) => (
                  <>
                    <View style={tile}>
                      <Text class="strong">{n}</Text>
                    </View>{' '}
                  </>
                )}
              </For>
            </ScrollView>
          </Example>

          <Example
            title="Paging"
            note="Each swipe settles on a whole page rather than anywhere. The platform does the
                snapping."
            code={'pagingEnabled={true}'}
          >
            <ScrollView
              horizontal={true}
              pagingEnabled={true}
              style={pager}
              showsHorizontalScrollIndicator={false}
            >
              <For each={pages}>
                {(colour) => (
                  <>
                    <View
                      style={{
                        width: 300,
                        height: 110,
                        backgroundColor: colour,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text class="strong">swipe</Text>
                    </View>{' '}
                  </>
                )}
              </For>
            </ScrollView>
          </Example>
        </Section>

        <Section title="Reading the offset">
          <Example
            title="(scroll)"
            note="The number updates as you drag. scrollEventThrottle decides how often native
                bothers to tell us - it is a budget, not a nicety."
            code={'onScroll scrollEventThrottle={16}'}
          >
            <ScrollView
              class="strip"
              contentContainerStyle={tallContent}
              scrollEventThrottle={16}
              onScroll={(event) => setOffset(Math.round(event.nativeEvent.contentOffset.y))}
            >
              <For each={many}>
                {() => (
                  <>
                    <View class="bar"></View>{' '}
                  </>
                )}
              </For>
            </ScrollView>
            <Text class="body">offset {offset()}px</Text>
          </Example>
        </Section>

        <Section title="Behaviour">
          <Example
            title="Bounce, off"
            note="iOS rubber-bands past the end by default. Turning it off is what makes a scroll
                view feel like a list rather than a page."
            code={'bounces={false}'}
          >
            <ScrollView class="strip" bounces={false} contentContainerStyle={tallContent}>
              <For each={many}>
                {() => (
                  <>
                    <View class="bar"></View>{' '}
                  </>
                )}
              </For>
            </ScrollView>
          </Example>

          <Example
            title="Scroll indicators, hidden"
            note="The content is the same; only the indicator has gone."
            code={'showsVerticalScrollIndicator={false}'}
          >
            <ScrollView
              class="strip"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={tallContent}
            >
              <For each={many}>
                {() => (
                  <>
                    <View class="bar"></View>{' '}
                  </>
                )}
              </For>
            </ScrollView>
          </Example>
        </Section>

        <Section title="Nesting">
          <Example
            title="A horizontal strip inside a vertical page"
            note="Drag sideways and the page does not move; drag down and the strip does not. The
                responder negotiation is native, which is why it feels right."
            code={'a horizontal scroll-view inside this vertical one'}
          >
            <ScrollView horizontal={true} class="strip" contentContainerStyle={stripContent}>
              <For each={many}>
                {(n) => (
                  <>
                    <View style={tile}>
                      <Text class="strong">{n}</Text>
                    </View>{' '}
                  </>
                )}
              </For>
            </ScrollView>
            <Text class="hint"> Both directions work without either stealing from the other. </Text>
          </Example>
        </Section>

        <Section title="Under load">
          <Example
            title="Block the JS thread and scroll"
            note="The button spins for a second in JavaScript. Scroll anything on this screen while
                it does: it keeps moving, because the scroll never needed us."
            code={'a 1s busy loop on the JS thread'}
          >
            <Pressable class="button" onPress={block}>
              <Text class="button-label">{blocked() ? 'blocking...' : 'Block JS for 1s'}</Text>
            </Pressable>
          </Example>
        </Section>
      </ScrollView>
    </>
  ));
}
