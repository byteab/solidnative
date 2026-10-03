/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, SafeAreaView, Text, View } from '@solidnative/components';
import { withNativeStyles } from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router';
import sheet from './home.native.css';

/** The starter's counter, plus the ways out of it: a pushed detail screen and a form. */
export function Home() {
  const navigation = useNavigation();
  const [count, setCount] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <SafeAreaView class="screen" edges={['top']}>
      <View class="body">
        <Text class="title" accessibilityRole="header">
          Solid, natively
        </Text>
        <Text class="hint">Real native views. React is never in the render path.</Text>

        <Pressable
          testID="counter"
          accessibilityRole="button"
          class="button"
          onPress={() => setCount(count() + 1)}
        >
          <Text class="label">Tapped {count()} times</Text>
        </Pressable>
        <Pressable
          testID="open-detail"
          accessibilityRole="link"
          class="button secondary"
          onPress={() => void navigation.push(`/detail/${count()}`)}
        >
          <Text class="label">Open detail {count()}</Text>
        </Pressable>
        <Pressable
          testID="open-form"
          accessibilityRole="link"
          class="button secondary"
          onPress={() => void navigation.push('/form')}
        >
          <Text class="label">Open the form</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  ));
}
