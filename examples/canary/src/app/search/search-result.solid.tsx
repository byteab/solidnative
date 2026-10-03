/** @jsxImportSource @solid-native/platform/solid */
import { ScrollView, Text } from '@solid-native/components/solid';
import { NativeHeader, useRoute } from '@solid-native/router/solid';
export function SearchResult() {
  const route = useRoute();
  const title = typeof route.state?.['title'] === 'string' ? route.state['title'] : 'Result';
  return (
    <>
      <NativeHeader title={title} />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text class="heading">{title}</Text>
        <Text class="hint">{String(route.inputs['id'])}</Text>
      </ScrollView>
    </>
  );
}
