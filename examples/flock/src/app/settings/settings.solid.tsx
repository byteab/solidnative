/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, ScrollView, Switch, Text, View } from '@solid-native/components/solid';
import {
  UiColorPicker,
  UiForm,
  UiHost,
  UiLabeledContent,
  UiPicker,
  UiSection,
  UiSlider,
  UiSlot,
  UiStepper,
  UiText,
  UiToggle,
} from '@solid-native/expo/solid';
import { nativePlatform } from '@solid-native/fabric';
import { For, Show } from '@solid-native/platform/solid';
import { useNavigation } from '@solid-native/router/solid';
import {
  accent,
  audience,
  autoplay,
  pushEnabled,
  setAccent,
  setAudience,
  setAutoplay,
  setPushEnabled,
  setTextSize,
  textSize,
} from '../flock.solid.ts';
import { useMuted } from '../ui/post-row.solid.tsx';

const SWATCHES = ['#1d9bf0', '#f91880', '#7856ff', '#ff7a00', '#00ba7c', '#ffd400'];
const AUDIENCES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'People you follow' },
  { value: 'mentioned', label: 'Only mentioned' },
] as const;
type Audience = (typeof AUDIENCES)[number]['value'];

/** iOS: the whole screen is one SwiftUI Form. Every row, toggle and picker is drawn by SwiftUI. */
function SwiftUiSettings() {
  return (
    <UiHost style={{ flex: 1 }}>
      <UiForm>
        <UiSection title="Appearance">
          <UiSlot name="content">
            <UiColorPicker
              label="Accent color"
              selection={accent()}
              supportsOpacity={false}
              onSelectionChange={(event) => setAccent(event.nativeEvent.value)}
            />
            <UiStepper
              label={`Text size: ${textSize()} pt`}
              value={textSize()}
              min={13}
              max={22}
              step={1}
              onValueChange={(event) => setTextSize(event.nativeEvent.value)}
            />
          </UiSlot>
        </UiSection>
        <UiSection title="Notifications">
          <UiSlot name="content">
            <UiToggle
              label="Push notifications"
              isOn={pushEnabled()}
              onIsOnChange={(event) => setPushEnabled(event.nativeEvent.isOn)}
            />
            <UiToggle
              label="Autoplay videos"
              isOn={autoplay()}
              onIsOnChange={(event) => setAutoplay(event.nativeEvent.isOn)}
            />
          </UiSlot>
        </UiSection>
        <UiSection title="Posting">
          <UiSlot name="content">
            <UiPicker
              label="Who can reply"
              options={AUDIENCES}
              value={audience()}
              pickerStyle="menu"
              onValueChange={(value) => setAudience(value as Audience)}
            />
          </UiSlot>
        </UiSection>
        <UiSection title="About">
          <UiSlot name="content">
            <UiLabeledContent label="Version">
              <UiSlot name="content">
                <UiText text="1.0 (Flock)" />
              </UiSlot>
            </UiLabeledContent>
            <UiLabeledContent label="Rendered by">
              <UiSlot name="content">
                <UiText text="Solid → Fabric" />
              </UiSlot>
            </UiLabeledContent>
          </UiSlot>
        </UiSection>
      </UiForm>
    </UiHost>
  );
}

/** Android: Material rows with the platform's own switches and a Compose slider. */
function MaterialSettings() {
  const muted = useMuted();
  const heading = (title: string) => (
    <Text class="px-5 pt-6 pb-2 text-sm font-semibold" style={{ color: accent() }}>
      {title}
    </Text>
  );
  const toggle = (label: string, value: () => boolean, set: (on: boolean) => void) => (
    <View class="flex-row items-center justify-between px-5 py-3">
      <Text class="text-base text-zinc-900 dark:text-white">{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value()}
        onValueChange={set}
        trackColor={{ true: accent() }}
        thumbColor={value() ? '#ffffff' : undefined}
      />
    </View>
  );
  return (
    <ScrollView class="flex-1">
      {heading('Appearance')}
      <Text class="px-5 text-base text-zinc-900 dark:text-white">Accent color</Text>
      <View class="flex-row gap-3 px-5 pt-3 pb-2">
        <For each={SWATCHES}>
          {(color) => (
            <Pressable
              class="size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
              accessibilityRole="button"
              accessibilityLabel={`Accent ${color}`}
              accessibilityState={{ selected: accent() === color }}
              onPress={() => setAccent(color)}
            >
              <Show when={accent() === color}>
                <View class="size-3.5 rounded-full bg-white" />
              </Show>
            </Pressable>
          )}
        </For>
      </View>
      <Text class="px-5 pt-4 text-base text-zinc-900 dark:text-white">
        {`Text size: ${textSize()} sp`}
      </Text>
      <UiHost class="mx-3" style={{ height: 48 }}>
        <UiSlider
          value={(textSize() - 13) / 9}
          colors={{ thumbColor: accent(), activeTrackColor: accent() }}
          onValueChanged={(event) => setTextSize(Math.round(13 + event.nativeEvent.value * 9))}
        />
      </UiHost>
      {heading('Notifications')}
      {toggle('Push notifications', pushEnabled, setPushEnabled)}
      {toggle('Autoplay videos', autoplay, setAutoplay)}
      {heading('Posting')}
      <For each={AUDIENCES}>
        {(option) => (
          <Pressable
            class="flex-row items-center justify-between px-5 py-3 active:bg-black/5"
            accessibilityRole="radio"
            accessibilityState={{ checked: audience() === option.value }}
            onPress={() => setAudience(option.value)}
          >
            <Text class="text-base text-zinc-900 dark:text-white">{option.label}</Text>
            <View
              class="size-5 items-center justify-center rounded-full border-2"
              style={{ borderColor: audience() === option.value ? accent() : muted() }}
            >
              <Show when={audience() === option.value}>
                <View class="size-2.5 rounded-full" style={{ backgroundColor: accent() }} />
              </Show>
            </View>
          </Pressable>
        )}
      </For>
      {heading('About')}
      <Text class="px-5 pb-10 text-base" style={{ color: muted() }}>
        Flock 1.0 · Solid → Fabric
      </Text>
    </ScrollView>
  );
}

/** Presented as a form sheet; changes apply live to the screens behind it. */
export function Settings() {
  const navigation = useNavigation();
  return (
    <View class="flex-1 bg-zinc-100 dark:bg-black android:bg-white android:dark:bg-zinc-950">
      <View class="flex-row items-center justify-between px-5 pt-5 pb-2">
        <Text class="text-2xl font-bold text-zinc-900 dark:text-white">Settings</Text>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => void navigation.back()}>
          <Text class="text-[17px] font-semibold" style={{ color: accent() }}>
            Done
          </Text>
        </Pressable>
      </View>
      <Show when={nativePlatform() === 'ios'} fallback={<MaterialSettings />}>
        <SwiftUiSettings />
      </Show>
    </View>
  );
}
