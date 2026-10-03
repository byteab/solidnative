/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, onCleanup } from 'solid-js';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { cancelAnimation, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Pressable, Text, View } from '@solidnative/components/solid';
import { NativeGesture } from '@solidnative/components/solid/gestures';
import { WorkletStyle, sharedValue, workletStyle } from '@solidnative/components/solid/reanimated';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import type { Mail } from './inbox-model.solid.ts';
import sheet from './inbox-row.native.css';
const REVEAL = 160,
  FULL = 260,
  GONE = 480;
const actions = [
  { name: 'archive', label: 'Archive' },
  { name: 'delete', label: 'Delete' },
];
export function InboxRow(props: {
  mail: Mail;
  selected?: boolean;
  outer?: GestureType;
  onOpen: () => void;
  onHold: () => void;
  onArchive: () => void;
  onRemove: () => void;
}) {
  const front = useService(SCREEN_IN_FRONT),
    x = sharedValue(0),
    generation = sharedValue(0);
  let active = true;
  onCleanup(() => {
    active = false;
    generation.value++;
    cancelAnimation(x);
    x.value = 0;
  });
  const slide = workletStyle([x], (offset) => {
    'worklet';
    return { transform: [{ translateX: offset.value }] };
  });
  const gesture = createMemo(() => {
    const id = props.mail.id,
      outer = props.outer;
    const inFront = front();
    const mine = ++generation.value;
    cancelAnimation(x);
    x.value = 0;
    if (!inFront) return null;
    const owns = () => active && front() && props.mail.id === id && generation.value === mine;
    const remove = () => {
      if (owns()) props.onRemove();
    };
    const open = () => {
      if (owns()) props.onOpen();
    };
    const hold = () => {
      if (owns()) props.onHold();
    };
    const pan = Gesture.Pan()
      .activeOffsetX(-12)
      .failOffsetX(12)
      .failOffsetY([-10, 10])
      .onChange((event) => {
        'worklet';
        if (generation.value === mine)
          x.value = Math.max(-GONE, Math.min(0, x.value + event.changeX));
      })
      .onEnd((event) => {
        'worklet';
        if (generation.value !== mine) return;
        if (x.value < -FULL || event.velocityX < -1500)
          x.value = withTiming(-GONE, { duration: 160 }, (finished) => {
            'worklet';
            if (finished && generation.value === mine) scheduleOnRN(remove);
          });
        else x.value = withSpring(x.value < -REVEAL / 2 ? -REVEAL : 0);
      });
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        if (!owns()) return;
        if (x.value !== 0) x.value = withSpring(0);
        else open();
      });
    const press = Gesture.LongPress().minDuration(400).runOnJS(true).onStart(hold);
    return Gesture.Race(
      outer ? pan.blocksExternalGesture(outer) : pan,
      Gesture.Exclusive(press, tap),
    );
  });
  const gestureRef = NativeGesture(gesture),
    styleRef = WorkletStyle(() => (front() ? slide : null));
  return withNativeStyles(sheet, () => (
    <View class="row">
      <View class="actions">
        <Pressable
          class="action archive"
          accessibilityRole="button"
          accessibilityLabel={'Archive ' + props.mail.subject}
          onPress={() => front() && props.onArchive()}
        >
          <Text class="action-label">Archive</Text>
        </Pressable>
        <Pressable
          class="action delete"
          accessibilityRole="button"
          accessibilityLabel={'Delete ' + props.mail.subject}
          onPress={() => front() && props.onRemove()}
        >
          <Text class="action-label">Delete</Text>
        </Pressable>
      </View>
      <View
        class={props.selected ? 'front chosen' : 'front'}
        nativeID={'front-' + props.mail.id}
        collapsable={false}
        ref={(ref) => {
          gestureRef(ref);
          styleRef(ref);
        }}
        accessibilityRole="button"
        accessibilityLabel={props.mail.from + ', ' + props.mail.subject}
        accessibilityActions={actions}
        onAccessibilityAction={(event) => {
          if (!front()) return;
          const name = event.nativeEvent.actionName;
          if (name === 'archive') props.onArchive();
          if (name === 'delete') props.onRemove();
        }}
      >
        <View class="line">
          <Text class={props.mail.unread ? 'from unread' : 'from'}>{props.mail.from}</Text>
          <Show when={props.selected}>
            <Text class="tick">Selected</Text>
          </Show>
        </View>
        <Text class="subject" numberOfLines={1}>
          {props.mail.subject}
        </Text>
        <Text class="hint" numberOfLines={1}>
          {props.mail.preview}
        </Text>
      </View>
    </View>
  ));
}
