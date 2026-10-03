/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text } from '@solidnative/components/solid';
import { NativeHeader, NativeHeaderItem, useNavigation } from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';

export function Detail() {
  const nav = useNavigation();
  const done = { color: '#3b6ef5', fontSize: 16, fontWeight: '600' };
  const close = () => {
    void nav.back();
  };
  return (
    <>
      <NativeHeader title="Detail" backTitle="Back">
        <NativeHeaderItem type="right">
          <Pressable
            onPress={() => {
              close();
            }}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={done}>Done</Text>
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="body">
          Presented as a sheet this drags to dismiss, and the dismissal reaches the router as a back
          rather than leaving the URL pointing at a screen that is gone.
        </Text>
      </ScrollView>
    </>
  );
}
