/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text, View } from '@solidnative/components';

/** A full-width button inside a view, counting its presses. */
export function createActive() {
  const state = { presses: 0 };
  function Active() {
    return (
      <View nativeID="outer">
        <Pressable nativeID="btn" onPress={() => state.presses++}>
          <Text nativeID="inner">tap</Text>
        </Pressable>
      </View>
    );
  }
  return { Active, state };
}

/** Pressables configured the less usual ways, counting each callback by name. */
export function createPressOptions() {
  const counts: Record<string, number> = {};
  const count = (name: string) => () => void (counts[name] = (counts[name] ?? 0) + 1);
  function PressOptions() {
    return (
      <>
        <Pressable nativeID="wide" pressRetentionOffset={100} onPress={count('wide')}>
          <Text>wide</Text>
        </Pressable>
        <Pressable nativeID="left" hitSlop={{ left: 50 }} onPress={count('left')}>
          <Text>left</Text>
        </Pressable>
        <Pressable nativeID="below" hitSlop={{ bottom: 50 }} onPress={count('below')}>
          <Text>below</Text>
        </Pressable>
        <Pressable
          nativeID="slow"
          delayPressIn={100}
          onPressIn={count('slowIn')}
          onLongPress={count('slowLong')}
        >
          <Text>slow</Text>
        </Pressable>
        <Pressable nativeID="front" android_ripple={{ color: '#ff0000', foreground: true }}>
          <Text>front</Text>
        </Pressable>
        <Pressable nativeID="behind" android_ripple={{ borderless: true, radius: 12 }}>
          <Text>behind</Text>
        </Pressable>
      </>
    );
  }
  return { PressOptions, counts };
}

/** A pressable logging its press-in, press and press-out, with `minPressDuration` as given. */
export function createPressTiming(minPressDuration?: number) {
  const log: string[] = [];
  function PressTiming() {
    return (
      <Pressable
        nativeID="timed"
        minPressDuration={minPressDuration}
        onPressIn={() => log.push('in')}
        onPress={() => log.push('press')}
        onPressOut={() => log.push('out')}
      >
        <Text>timed</Text>
      </Pressable>
    );
  }
  return { PressTiming, log };
}
