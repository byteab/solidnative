/** @jsxImportSource @solid-native/platform/solid */
import { Image, Text, View } from '@solid-native/components/solid';
import { user } from '../flock.solid.ts';

/** A profile photo, over initials on the account's colour for while it loads (or if offline). */
export function Avatar(props: { handle: string; size?: number }) {
  const size = () => props.size ?? 48;
  const initials = () =>
    user(props.handle)
      .name.split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2);
  return (
    <View
      class="items-center justify-center overflow-hidden rounded-full"
      style={{ width: size(), height: size(), backgroundColor: user(props.handle).color }}
    >
      <Text class="font-bold text-white" style={{ fontSize: size() * 0.38 }}>
        {initials()}
      </Text>
      <Image
        class="absolute inset-0"
        source={{ uri: user(props.handle).photo }}
        resizeMode="cover"
      />
    </View>
  );
}
