/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { STORIES, Viewer } from './stories-model.solid.ts';
import sheet from './stories-page.native.css';

export function StoriesPage() {
  const viewer = useService(Viewer),
    nav = useNavigation(),
    stories = STORIES,
    trayContent = { paddingHorizontal: 16 };
  const watch = (story: number) => {
    viewer.open(story);
    void nav.present('/stories/view', { as: 'fullScreenModal' });
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Stories" largeTitle={true}></NativeHeader>
      <ScrollView contentInsetAdjustmentBehavior="automatic" class="page">
        <ScrollView
          class="tray"
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={trayContent}
        >
          <For each={stories}>
            {(story, i) => (
              <>
                <Pressable
                  accessibilityRole="button"
                  class={['person', viewer.seen().has(story.id) && 'seen']
                    .filter(Boolean)
                    .join(' ')}
                  accessibilityLabel={
                    story.name + (viewer.seen().has(story.id) ? ', seen' : ', new')
                  }
                  onPress={() => {
                    watch(i());
                  }}
                >
                  <View class="ring">
                    <View class="gap">
                      <View
                        class="avatar"
                        style={{ '--from': story.slides[0].from, '--to': story.slides[0].to }}
                      >
                        <Text class="initial">{story.initial}</Text>
                      </View>
                    </View>
                  </View>
                  <Text class="name">{story.name}</Text>
                </Pressable>
              </>
            )}
          </For>
        </ScrollView>
        <Text class="hint">
          {'Tap a story. Hold to pause, tap either side to step, swipe down to close.'}
        </Text>
      </ScrollView>
    </view>
  ));
}
