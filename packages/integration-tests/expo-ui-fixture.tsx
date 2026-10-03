/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { ExpoImage, SegmentedControl } from '@solidnative/expo';
import {
  UiButton,
  UiColorPicker,
  UiDatePicker,
  UiDivider,
  UiForm,
  UiGauge,
  UiHStack,
  UiHost,
  UiImage,
  UiLabeledContent,
  UiList,
  UiMenu,
  UiProgress,
  UiSection,
  UiSlider,
  UiSlot,
  UiSpacer,
  UiStepper,
  UiSwipeActions,
  UiText,
  UiTextField,
  UiToggle,
  UiVStack,
} from '@solidnative/expo/expo-ui-components';

/** A menu, a date picker and a segmented control, as one SwiftUI screen uses them. */
export function expoUiFixture() {
  const [presses, setPresses] = createSignal(0);
  const [date, setDate] = createSignal('');
  const [index, setIndex] = createSignal(-1);
  const View = () => (
    <>
      <UiHost ignoreSafeArea="container" matchContents>
        <UiMenu aria-label="More" modifiers={[{ $type: 'opacity', value: 0.5 }]}>
          <UiSlot name="label">
            <UiText text="More" />
          </UiSlot>
          <UiButton
            label="Delete"
            role="destructive"
            onButtonPress={() => setPresses(presses() + 1)}
          />
          <UiDivider />
        </UiMenu>
        <UiDatePicker
          selection="2026-01-02T00:00:00Z"
          displayedComponents={['date']}
          onDateChange={(event) => setDate(String(event.nativeEvent.date))}
        />
        <UiImage systemName="star" size={24} color="#ff0000" />
      </UiHost>
      <SegmentedControl
        values={['A', 'B']}
        selectedIndex={0}
        onChange={(event) => setIndex(event.nativeEvent.selectedSegmentIndex)}
      />
    </>
  );
  return { View, presses, date, index };
}

/** A SwiftUI list of rows that swipe, as a mail client's inbox does on iOS. */
export function expoUiListFixture() {
  const [opened, setOpened] = createSignal(0);
  const [level, setLevel] = createSignal(0);
  const View = () => (
    <UiHost style={{ flex: 1 }}>
      <UiList modifiers={[{ $type: 'listStyle', style: 'plain' }]}>
        <UiSwipeActions>
          <UiButton onButtonPress={() => setOpened(opened() + 1)}>
            <UiVStack alignment="leading" spacing={2}>
              <UiText text="Sam" />
              <UiText text="Lunch?" />
            </UiVStack>
          </UiButton>
          <UiSlot name="actions" extraProps={{ edge: 'trailing', allowsFullSwipe: true }}>
            <UiButton label="Delete" role="destructive" />
          </UiSlot>
        </UiSwipeActions>
      </UiList>
      <UiSlider
        value={0.25}
        min={0}
        max={1}
        onValueChanged={(event) => setLevel(event.nativeEvent.value)}
      />
    </UiHost>
  );
  return { View, opened, level };
}

/** The rest of the typed SwiftUI controls, and `expo-image`, as a settings screen uses them. */
export function expoUiControlsFixture() {
  const [on, setOn] = createSignal(false);
  const View = () => (
    <>
      <UiHost style={{ flex: 1 }}>
        <UiForm>
          <UiSection title="Network">
            <UiToggle
              label="Wi-Fi"
              isOn={true}
              onIsOnChange={(event) => setOn(event.nativeEvent.isOn)}
            />
            <UiStepper label="Guests" value={2} min={1} max={8} step={1} />
            <UiTextField placeholder="Name" />
            <UiColorPicker label="Tint" selection="#ff0000" supportsOpacity={false} />
            <UiLabeledContent label="Version">
              <UiText text="1.0" />
            </UiLabeledContent>
            <UiHStack spacing={4}>
              <UiText text="a" />
              <UiSpacer />
              <UiText text="b" />
            </UiHStack>
            <UiGauge value={0.4} min={0} max={1} currentValueLabel="40%" />
            <UiProgress value={0.5} />
          </UiSection>
        </UiForm>
      </UiHost>
      <ExpoImage source={[{ uri: 'a.png' }]} transition={300} />
    </>
  );
  return { View, on };
}
