/** @jsxImportSource @solidnative/web/solid */
import { createSignal, onCleanup } from 'solid-js';
import {
  View,
  Text,
  TextInput,
  Switch,
  Pressable,
  ScrollView,
  VirtualList,
} from '@solidnative/components/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/web/solid';
import sheet from './host.native.css';

export function HostFixture(props: {
  label: string;
  onChange?: (value: string) => void;
  cleanup?: () => void;
}) {
  const [value, setValue] = createSignal('initial');
  const [enabled, setEnabled] = createSignal(false);
  const [items, setItems] = createSignal(['one', 'two', 'three']);
  onCleanup(() => props.cleanup?.());
  return withNativeStyles(sheet, () => (
    <view ref={(node) => setNativeStyleHost(node, sheet)}>
      <View class="row">
        <Text class="label">{props.label}</Text>
      </View>
      <TextInput
        nativeID="input"
        value={value()}
        onValueChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
      />
      <TextInput nativeID="reject" value="fixed" onValueChange={() => {}} />
      <Switch nativeID="switch" value={enabled()} onValueChange={setEnabled} />
      <Pressable nativeID="reverse" onPress={() => setItems([...items()].reverse())}>
        <Text>Reverse</Text>
      </Pressable>
      <For each={items()}>{(item) => <Text nativeID={item}>{item}</Text>}</For>
      <Show when={enabled()}>
        <Text nativeID="conditional">{value()}</Text>
      </Show>
      <ScrollView nativeID="scroll">
        <Text>Scroll contents</Text>
      </ScrollView>
      <VirtualList
        items={items()}
        itemHeight={40}
        keyExtractor={(item) => item}
        renderItem={(item) => <Text>{item()}</Text>}
      />
    </view>
  ));
}
