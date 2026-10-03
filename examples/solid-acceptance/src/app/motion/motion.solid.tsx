/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { cancelAnimation, withTiming } from 'react-native-reanimated';
import { Pressable, SafeAreaView, ScrollView, Switch, Text, View } from '@solidnative/components';
import { WorkletStyle, sharedValue, workletStyle } from '@solidnative/components/reanimated';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './motion.native.css';

/**
 * Two kinds of motion. A CSS @keyframes animation the engine plays when a class lands, and a
 * Reanimated worklet style that slides and fades a box on the UI thread when it is pressed, which
 * the switch enables.
 */
export function Motion() {
  const front = useService(SCREEN_IN_FRONT);
  const [pulsing, setPulsing] = createSignal(false);
  const [enabled, setEnabled] = createSignal(true);
  const [out, setOut] = createSignal(false);
  const progress = sharedValue(0);
  const slide = workletStyle([progress], (p) => {
    'worklet';
    return { opacity: 1 - p.value * 0.6, transform: [{ translateX: p.value * 160 }] };
  });
  // Off the UI thread's books while another tab or screen covers this one.
  const boxRef = WorkletStyle(() => (front() ? slide : null));
  onCleanup(() => cancelAnimation(progress));

  const toggleBox = () => {
    setOut(!out());
    progress.value = withTiming(out() ? 1 : 0, { duration: 400 });
  };
  const enable = (value: boolean) => {
    setEnabled(value);
    if (value) return;
    // Disabling sends the box home.
    setOut(false);
    progress.value = withTiming(0, { duration: 200 });
  };

  return withNativeStyles(sheet, () => (
    <SafeAreaView class="screen" edges={['top']}>
      <ScrollView>
        <View class="body">
          <Text class="title" accessibilityRole="header">
            Motion
          </Text>

          <Text class="hint">A @keyframes animation from the component's stylesheet.</Text>
          <View class="stage">
            <View testID="pulse" class="pulse" classList={{ on: pulsing() }} />
          </View>
          <Pressable
            testID="toggle-pulse"
            accessibilityRole="button"
            class="button"
            onPress={() => setPulsing(!pulsing())}
          >
            <Text class="label">{pulsing() ? 'Stop pulsing' : 'Start pulsing'}</Text>
          </Pressable>

          <Text class="hint">A worklet style, on the UI thread. Press the box.</Text>
          <View class="row">
            <Text class="row-label">Box enabled</Text>
            <Switch
              testID="box-switch"
              accessibilityLabel="Box enabled"
              value={enabled()}
              onValueChange={enable}
            />
          </View>
          <View class="track">
            <Pressable
              testID="animated-box"
              accessibilityRole="button"
              accessibilityLabel={out() ? 'Bring the box back' : 'Slide the box'}
              accessibilityState={{ disabled: !enabled() }}
              disabled={!enabled()}
              data-disabled={enabled() ? undefined : ''}
              class="box"
              ref={boxRef}
              onPress={toggleBox}
            >
              <Text class="box-label">{out() ? 'back' : 'slide'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  ));
}
