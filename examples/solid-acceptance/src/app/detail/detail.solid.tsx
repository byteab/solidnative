/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solid-native/components';
import { NativeHeader, useNavigation, useRoute } from '@solid-native/router';

/** A pushed screen that reads its `id` route param. */
export function Detail() {
  const navigation = useNavigation();
  const route = useRoute();
  const id = () => String(route.inputs['id']);
  return (
    <>
      <NativeHeader title={`Item ${id()}`} backTitle="Back" />
      <ScrollView
        class="flex-1 bg-zinc-100 dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View class="gap-3 p-6">
          <Text testID="detail-title" class="text-2xl font-bold text-zinc-900 dark:text-white">
            Detail {id()}
          </Text>
          <Text class="text-base text-zinc-500">
            Pushed onto a native stack, with the platform's own transition and back gesture.
          </Text>
          <Pressable
            testID="detail-back"
            accessibilityRole="button"
            class="items-center rounded-xl bg-indigo-600 p-4 active:opacity-80"
            onPress={() => void navigation.back()}
          >
            <Text class="text-base font-semibold text-white">Go back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
