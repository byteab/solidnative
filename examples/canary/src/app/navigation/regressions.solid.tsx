/** @jsxImportSource @solid-native/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeRef,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import {
  Show,
  useHostAdapter,
  withNativeStyles,
  type NativeChild,
} from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  useNavigation,
  useRoute,
} from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import sheet from './regressions.native.css';
export function Regressions() {
  const nav = useNavigation(),
    [failures, setFailures] = createSignal(0);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const recordFailure = () => {
    if (active) setFailures((value) => value + 1);
  };
  const openBroken = () => {
    void nav.push('/regressions/broken').then((accepted) => {
      if (!accepted && nav.error()) recordFailure();
    }, recordFailure);
  };
  return (
    <>
      <NativeHeader title="Regressions" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Pressable
          class="card"
          testID="open-header"
          onPress={() => void nav.push('/regressions/header')}
        >
          <Text class="button-label">Header behind an if</Text>
          <Text class="hint">Hide takes the whole bar away, Show brings it back.</Text>
        </Pressable>
        <Pressable
          class="card"
          testID="open-item"
          onPress={() => void nav.push('/regressions/item/1')}
        >
          <Text class="button-label">Detail to detail</Text>
          <Text class="hint">Each Next is a new screen, and back walks down them.</Text>
        </Pressable>
        <Pressable
          class="card"
          testID="open-modal"
          onPress={() => void nav.present('/regressions/modal')}
        >
          <Text class="button-label">Push from a modal</Text>
          <Text class="hint">The pushed screen shows over the modal.</Text>
        </Pressable>
        <Pressable class="card" testID="open-broken" onPress={openBroken}>
          <Text class="button-label">A page that throws</Text>
          <Text class="hint">Nothing is pushed. Failures: {failures()}</Text>
        </Pressable>
        <Pressable
          class="card"
          testID="open-text"
          onPress={() => void nav.push('/regressions/text')}
        >
          <Text class="button-label">Static text</Text>
          <Text class="hint">Change the text size with this open.</Text>
        </Pressable>
        <Pressable class="card" testID="open-rtl" onPress={() => void nav.push('/regressions/rtl')}>
          <Text class="button-label">Right to left text</Text>
          <Text class="hint">Text in a direction rtl box starts at the right.</Text>
        </Pressable>
        <Pressable
          class="card"
          testID="open-dates"
          onPress={() => void nav.push('/regressions/dates')}
        >
          <Text class="button-label">Dates in a timezone</Text>
          <Text class="hint">14:30 UTC in each zone the formatter reads.</Text>
        </Pressable>
        <Pressable
          class="card"
          testID="open-defer"
          onPress={() => void nav.push('/regressions/defer')}
        >
          <Text class="button-label">Defer triggers</Text>
          <Text class="hint">Interaction, hover and viewport each load their block.</Text>
        </Pressable>
        <Pressable
          class="card"
          testID="open-hidden-modal"
          onPress={() => void nav.push('/regressions/hidden-modal')}
        >
          <Text class="button-label">Hidden modal</Text>
          <Text class="hint">A modal with visible false leaves the screen usable.</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
export function RegressionHeader() {
  const nav = useNavigation(),
    [shown, setShown] = createSignal(true);
  return (
    <>
      <Show when={shown()}>
        <NativeHeader title="Header shown">
          <NativeHeaderItem type="right">
            <Text class="hint">Item</Text>
          </NativeHeaderItem>
        </NativeHeader>
      </Show>
      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={page.content}
      >
        <Pressable class="button" testID="toggle-header" onPress={() => setShown(!shown())}>
          <Text class="button-label">{shown() ? 'Hide' : 'Show'} the header</Text>
        </Pressable>
        <Pressable class="button" testID="header-back" onPress={() => void nav.back()}>
          <Text class="button-label">Back</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
export function RegressionItem() {
  const route = useRoute(),
    id = () => String(route.params['id'] ?? '');
  const nav = useNavigation();
  return (
    <>
      <NativeHeader title={'Item ' + id()} />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="body">Item {id()}</Text>
        <Pressable
          class="button"
          testID="next-item"
          onPress={() => void nav.push(`/regressions/item/${Number(id()) + 1}`)}
        >
          <Text class="button-label">Next</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
export function RegressionModal() {
  const nav = useNavigation();
  return (
    <ScrollView class="screen" contentContainerStyle={page.content}>
      <View style={{ height: 40 }} />
      <Text class="heading">A modal with no stack</Text>
      <Pressable
        class="button"
        testID="modal-push"
        onPress={() => void nav.push('/regressions/item/1')}
      >
        <Text class="button-label">Push Item 1</Text>
      </Pressable>
      <Pressable class="button" testID="modal-close" onPress={() => void nav.back()}>
        <Text class="button-label">Close</Text>
      </Pressable>
    </ScrollView>
  );
}
/** Deliberately fails after resource acquisition, exercising navigation mount rollback. */
export function RegressionBroken(): NativeChild {
  const timer = setInterval(() => console.log('[regressions] broken page still running'), 1000);
  onCleanup(() => clearInterval(timer));
  throw new Error('The regressions page fails to mount on purpose.');
}
export function RegressionText() {
  return (
    <>
      <NativeHeader title="Static text" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="heading">Services</Text>
        <Text class="body">
          This text never changes. At a larger text size it has to grow with its glyphs rather than
          keep the box it was first measured in.
        </Text>
        <Text class="hint">A hint that never changes either.</Text>
      </ScrollView>
    </>
  );
}
export function RegressionHiddenModal() {
  const [taps, setTaps] = createSignal(0),
    [open, setOpen] = createSignal(false),
    [dismissals, setDismissals] = createSignal(0);
  return (
    <>
      <NativeHeader title="Hidden modal" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Pressable class="button" testID="hidden-modal-tap" onPress={() => setTaps(taps() + 1)}>
          <Text class="button-label">Taps: {taps()}</Text>
        </Pressable>
        <Pressable class="button" testID="hidden-modal-show" onPress={() => setOpen(true)}>
          <Text class="button-label">Show the modal</Text>
        </Pressable>
        <Text class="hint">Dismissals: {dismissals()}</Text>
      </ScrollView>
      <Modal
        visible={open()}
        transparent
        animationType="slide"
        onDismiss={() => setDismissals(dismissals() + 1)}
      >
        <View style={{ marginTop: 300, padding: 24, backgroundColor: '#ddeeff' }}>
          <Pressable class="button" testID="hidden-modal-close" onPress={() => setOpen(false)}>
            <Text class="button-label">Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
/** Owned interaction, pointer and measured viewport triggers replace framework-specific defer hooks. */
export function RegressionDefer() {
  const adapter = useHostAdapter(),
    front = useService(SCREEN_IN_FRONT);
  const [interaction, setInteraction] = createSignal(false),
    [hover, setHover] = createSignal(false),
    [viewport, setViewport] = createSignal(false);
  let active = true,
    epoch = 0,
    measurement = 0,
    scrollRef: NativeRef | undefined,
    target: NativeRef | undefined;
  let viewportHeight = 0,
    offset = 0,
    targetY: number | undefined,
    targetHeight = 0;
  const visible = () => {
    if (
      active &&
      front() &&
      targetY !== undefined &&
      viewportHeight > 0 &&
      targetY + targetHeight > offset &&
      targetY < offset + viewportHeight
    )
      setViewport(true);
  };
  const measure = () => {
    visible();
    if (viewport() || !front() || !scrollRef || !target) return;
    const request = epoch,
      id = ++measurement;
    scrollRef.measure((scroll) =>
      target?.measure((box) => {
        if (
          active &&
          front() &&
          request === epoch &&
          id === measurement &&
          scroll.height > 0 &&
          box.height > 0 &&
          box.y + box.height > scroll.y &&
          box.y < scroll.y + scroll.height
        )
          setViewport(true);
      }),
    );
  };
  createRenderEffect(() => {
    front();
    epoch++;
    if (front()) adapter.afterCommit(measure);
  });
  onCleanup(() => {
    active = false;
    epoch++;
  });
  const hoverRef = (ref: NativeRef) => {
    onCleanup(
      adapter.engine.setEventListener(ref.node, 'topPointerEnter', () => {
        if (active && front()) setHover(true);
      }),
    );
  };
  return (
    <>
      <NativeHeader title="Defer triggers" />
      <ScrollView
        ref={(ref) => {
          scrollRef = ref;
        }}
        class="screen"
        testID="defer-scroll"
        contentContainerStyle={page.content}
        onLayout={(event) => {
          viewportHeight = event.nativeEvent.layout.height;
          measure();
        }}
        onScroll={(event) => {
          offset = event.nativeEvent.contentOffset?.y ?? offset;
          viewportHeight = event.nativeEvent.layoutMeasurement?.height ?? viewportHeight;
          measure();
        }}
      >
        <Pressable class="button" testID="defer-press" onPress={() => setInteraction(true)}>
          <Text class="button-label">Press to load</Text>
        </Pressable>
        <Show when={interaction()} fallback={<Text class="hint">Waiting for a press</Text>}>
          <Text class="body" testID="defer-interaction">
            Loaded on interaction
          </Text>
        </Show>
        <Show
          when={hover()}
          fallback={
            <Text ref={hoverRef} class="hint" onPress={() => setHover(true)}>
              Hover or press here
            </Text>
          }
        >
          <Text class="body" testID="defer-hover">
            Loaded on hover or a press
          </Text>
        </Show>
        <View style={{ height: 1600 }} />
        <Show
          when={viewport()}
          fallback={
            <View
              ref={(ref) => {
                target = ref;
              }}
              onLayout={(event) => {
                targetY = event.nativeEvent.layout.y;
                targetHeight = event.nativeEvent.layout.height;
                measure();
              }}
            >
              <Text class="hint">Scrolled into view loads this</Text>
            </View>
          }
        >
          <Text class="body" testID="defer-viewport">
            Loaded on viewport
          </Text>
        </Show>
      </ScrollView>
    </>
  );
}
/** Preserve DatePipe's fixed-offset rules and its local fallback for unsupported named zones. */
export function regressionTime(when: Date, zone: string): string {
  const offsets: Record<string, number> = { UTC: 0, '+0000': 0, '+0500': 300, EST: -300 };
  if (zone in offsets) {
    const shifted = new Date(when.getTime() + offsets[zone]! * 60000);
    return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(when);
}
export function RegressionDates() {
  const when = new Date(Date.UTC(2026, 8, 25, 14, 30));
  const tokyo = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    timeStyle: 'short',
  }).format(when);
  return (
    <>
      <NativeHeader title="Dates in a timezone" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="body" testID="date-utc">
          UTC {regressionTime(when, 'UTC')}
        </Text>
        <Text class="body" testID="date-zero">
          +0000 {regressionTime(when, '+0000')}
        </Text>
        <Text class="body" testID="date-five">
          +0500 {regressionTime(when, '+0500')}
        </Text>
        <Text class="body" testID="date-est">
          EST {regressionTime(when, 'EST')}
        </Text>
        <Text class="body" testID="date-named">
          Europe/Paris {regressionTime(when, 'Europe/Paris')}
        </Text>
        <Text class="body" testID="date-intl">
          Intl Asia/Tokyo {tokyo}
        </Text>
      </ScrollView>
    </>
  );
}
export function RegressionRtl() {
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Right to left text" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <View class="rtl">
          <View class="row">
            <Text class="box">1</Text>
            <Text class="box">2</Text>
            <Text class="box">3</Text>
          </View>
          <Text class="line" testID="rtl-latin">
            latin, no alignment
          </Text>
          <Text class="line" testID="rtl-arabic">
            نص عربي قصير
          </Text>
          <Text class="line start" testID="rtl-start">
            start
          </Text>
          <Text class="line end" testID="rtl-end">
            end
          </Text>
          <Text class="line left" testID="rtl-left">
            left stays left
          </Text>
        </View>
        <View style={{ direction: 'rtl' }}>
          <Text class="line" testID="rtl-inline">
            inline direction rtl
          </Text>
        </View>
        <Text class="line end" testID="ltr-end">
          end, in left to right
        </Text>
      </ScrollView>
    </>
  ));
}
