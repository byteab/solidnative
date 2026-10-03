/** @jsxImportSource @solidnative/platform/solid */
import { For } from '@solidnative/platform/solid';
import { Text, View } from '@solidnative/components';

export interface CommitReuseProps {
  items: readonly { id: number; label: string }[];
  padding: number;
}

/** A subtree that never changes, beside a node whose props change and a keyed list. */
export function CommitReuse(props: CommitReuseProps) {
  return (
    <View>
      <View nativeID="static">
        <Text>never changes</Text>
      </View>
      <View nativeID="dynamic" style={{ padding: props.padding }} />
      <For each={props.items}>{(item) => <Text>{item.label}</Text>}</For>
    </View>
  );
}
