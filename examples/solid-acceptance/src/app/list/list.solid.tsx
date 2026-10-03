/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Pressable, SafeAreaView, Text, View, VirtualList } from '@solid-native/components';
import { useNavigation } from '@solid-native/router';

const ROW_HEIGHT = 56;
const ROWS = Array.from({ length: 200 }, (_, i) => ({ id: String(i + 1) }));

/** Two hundred rows that recycle as they scroll, with pull-to-refresh. A row opens its detail. */
export function List() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshes, setRefreshes] = createSignal(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const refresh = () => {
    setRefreshing(true);
    // Stands in for a fetch.
    timer = setTimeout(() => {
      setRefreshes((n) => n + 1);
      setRefreshing(false);
    }, 600);
  };
  return (
    <SafeAreaView class="flex-1 bg-white dark:bg-black" edges={['top']}>
      <View class="border-b-hairline border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <Text class="text-2xl font-bold text-zinc-900 dark:text-white" accessibilityRole="header">
          List
        </Text>
        <Text testID="refresh-count" class="text-sm text-zinc-500">
          Refreshed {refreshes()} times
        </Text>
      </View>
      <VirtualList
        testID="list"
        class="flex-1"
        items={ROWS}
        itemHeight={ROW_HEIGHT}
        keyExtractor={(row) => row.id}
        refreshControl={{
          get refreshing() {
            return refreshing();
          },
          onRefresh: refresh,
        }}
        renderItem={(row) => (
          <Pressable
            testID={`row-${row().id}`}
            accessibilityRole="button"
            accessibilityLabel={`Row ${row().id}`}
            class="justify-center border-b-hairline border-zinc-200 px-5 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
            style={{ height: ROW_HEIGHT }}
            onPress={() => void navigation.push(`/detail/${row().id}`)}
          >
            <Text class="text-base text-zinc-900 dark:text-white">Row {row().id}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
