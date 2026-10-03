/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text, View } from '@solidnative/components/solid';

/** Two pressables, one inside the other, each logging its own press. */
export function nestedPress() {
  const log: string[] = [];
  function Nested() {
    return (
      <Pressable testID="outer" onPress={() => log.push('outer')}>
        <View>
          <Pressable testID="inner" onPress={() => log.push('inner')}>
            <Text testID="label">inner</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }
  return { log, Nested };
}
