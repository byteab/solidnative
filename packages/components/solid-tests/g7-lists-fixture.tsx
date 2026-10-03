/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { VirtualList } from '../src/solid/virtual-list.ts';
import { SectionList } from '../src/solid/section-list.ts';
import { Text, View } from '../src/solid/primitive.ts';

export function compiledListFixture() {
  const [items, setItems] = createSignal([
    { id: 'one', label: 'First' },
    { id: 'two', label: 'Second' },
  ]);
  const [refreshing, setRefreshing] = createSignal(false);
  const cleanups: string[] = [];
  function Scene() {
    return (
      <View>
        <VirtualList
          testID="list"
          items={items()}
          itemHeight={56}
          keyExtractor={(item) => item.id}
          refreshControl={{
            testID: 'refresh',
            refreshing: refreshing(),
            onRefresh: () => setRefreshing(true),
          }}
          renderItem={(item, index) => {
            const id = item().id;
            onCleanup(() => cleanups.push(id));
            return (
              <Text testID={item().id}>
                {item().label}:{index()}:{0}
              </Text>
            );
          }}
        />
        <SectionList
          testID="sections"
          sections={[{ key: 'all', data: items() }]}
          itemHeight={56}
          keyExtractor={(item) => item.id}
          renderItem={(item, index) => (
            <Text testID={'section-' + item().id}>
              {item().label}:{index()}
            </Text>
          )}
        />
      </View>
    );
  }
  return { Scene, setItems, cleanups };
}
