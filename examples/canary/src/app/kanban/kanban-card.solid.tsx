/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, onCleanup } from 'solid-js';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { Text, View } from '@solid-native/components/solid';
import { NativeGesture } from '@solid-native/components/solid/gestures';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import { TAG_TONES, type Card } from './kanban-model.solid.ts';
import sheet from './kanban-card.native.css';
export interface Hold {
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
}
export interface KanbanCardProps {
  card: Card;
  class?: string;
  chosen?: boolean;
  lifted?: boolean;
  outer?: GestureType;
  onTapped(): void;
  onLift(hold: Hold): void;
  onDrag(hold: Hold): void;
  onDrop(hold: Hold): void;
  onCancel(): void;
}
export function KanbanCard(props: KanbanCardProps) {
  const front = useService(SCREEN_IN_FRONT);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const hold = (event: { absoluteX: number; absoluteY: number; x: number; y: number }): Hold => ({
    x: event.absoluteX,
    y: event.absoluteY,
    offsetX: event.x,
    offsetY: event.y,
  });
  const gesture = createMemo(() => {
    const outer = props.outer;
    if (!front()) return null;
    let current = true,
      dragging = false;
    onCleanup(() => {
      current = false;
      if (active && dragging) props.onCancel();
    });
    const owns = () => active && current && front();
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(250)
      .onStart((event) => {
        if (owns()) {
          dragging = true;
          props.onLift(hold(event));
        }
      })
      .onUpdate((event) => {
        if (owns() && dragging) props.onDrag(hold(event));
      })
      .onEnd((event) => {
        if (owns() && dragging) props.onDrop(hold(event));
      })
      .onFinalize(() => {
        if (owns() && dragging) props.onCancel();
        dragging = false;
      });
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        if (owns() && !dragging) props.onTapped();
      });
    return outer
      ? Gesture.Exclusive(
          pan.simultaneousWithExternalGesture(outer),
          tap.simultaneousWithExternalGesture(outer),
        )
      : Gesture.Exclusive(pan, tap);
  });
  const ref = NativeGesture(() => (front() ? gesture() : null));
  // The slot belongs to the board sheet; the ticket owns its own sheet below it.
  return (
    <View class={props.class}>
      {withNativeStyles(sheet, () => (
        <View
          class={`ticket${props.chosen ? ' chosen' : ''}${props.lifted ? ' lifted' : ''}`}
          style={{ '--tag': TAG_TONES[props.card.tag] }}
          collapsable={false}
          ref={ref}
          accessibilityRole="button"
          accessibilityLabel={`${props.card.title}, ${props.card.points} points, ${props.card.owner}`}
          accessibilityState={{ selected: !!props.chosen }}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={props.onTapped}
        >
          <View class="top">
            <View class="tag">
              <Text class="tag-label">{props.card.tag}</Text>
            </View>
            <Text class="points">{props.card.points} pt</Text>
          </View>
          <Text class="title">{props.card.title}</Text>
          <View class="foot">
            <View class="avatar">
              <Text class="avatar-initial">{props.card.owner[0]}</Text>
            </View>
            <Text class="owner">{props.card.owner}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
