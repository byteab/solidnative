/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import {
  nativeState,
  UiButton,
  UiColorPicker,
  UiDatePicker,
  UiDivider,
  UiForm,
  UiGauge,
  UiHStack,
  UiHost,
  UiLabeledContent,
  UiPicker,
  UiProgress,
  UiSection,
  UiSlider,
  UiSlot,
  UiSpacer,
  UiStepper,
  UiText,
  UiTextField,
  UiToggle,
  UiVStack,
} from '@solid-native/expo/solid';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { For } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { Example, Section } from '../example.solid.tsx';
import { page } from '../screen-styles.ts';

export function ExpoUiPage() {
  const [taps, setTaps] = createSignal(0),
    [on, setOn] = createSignal(true),
    [level, setLevel] = createSignal(0.5),
    [guests, setGuests] = createSignal(2),
    [size, setSize] = createSignal('Medium'),
    [typed, setTyped] = createSignal('');
  const name = nativeState(''),
    sizes = ['Small', 'Medium', 'Large'];
  // The installed modifiers are plain data; no React wrapper is needed at runtime.
  const tag = (value: string) => ({ $type: 'tag', tag: value });
  const segmented = [{ $type: 'pickerStyle', style: 'segmented' }];
  const hostRow = {},
    hostFill = {},
    hostForm = { minHeight: 180 };
  return (
    <>
      <NativeHeader title="SwiftUI controls" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Real SwiftUI, with no React in the render path. Each group is inside a host view, which is
          what measures SwiftUI content for React Native's layout.
        </Text>

        <Section title="Controls">
          <Example
            title="Slider"
            note="onValueChanged with a d, which is the one that catches everybody: the React prop
                is onValueChange and the native event is not."
            code={'<UiSlider value={...} onValueChanged={(event) => ...} />'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiSlider
                value={level()}
                min={0}
                max={1}
                onValueChanged={(event) => setLevel(event.nativeEvent.value)}
              ></UiSlider>
            </UiHost>
            <Text class="body">{level().toFixed(2)}</Text>
          </Example>

          <Example
            title="Picker"
            note="Four things, and missing any one draws nothing. The options go in a slot named
                content, each needs a tag modifier so SwiftUI can map the selection to one, the
                picker needs a style because the default collapses outside a form, and the
                selection is the tag value rather than an index."
            code={"modifiers={[pickerStyle('segmented')]}"}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiPicker
                label="Size"
                value={size()}
                modifiers={segmented}
                onSelectionChange={(event) => setSize(String(event.nativeEvent.selection))}
              >
                <UiSlot name="content">
                  <For each={sizes}>
                    {(option) => <UiText text={option} modifiers={[tag(option)]}></UiText>}
                  </For>
                </UiSlot>
              </UiPicker>
            </UiHost>
            <Text class="body">{size()}</Text>
          </Example>

          <Example
            title="Button"
            note="A real UIButton drawn by SwiftUI. The native event is onButtonPress; React's
                wrapper is what calls it onPress."
            code={'<UiButton label="Press me" onButtonPress={(event) => ...} />'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiButton label="Press me" onButtonPress={() => setTaps(taps() + 1)}></UiButton>
            </UiHost>
            <Text class="body">pressed {taps()} times</Text>
          </Example>

          <Example
            title="Button roles"
            note="destructive is red and cancel is the dismissing one, decided by SwiftUI rather
                than by a colour we pick."
            code={'role="destructive"'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiButton label="Delete" role="destructive"></UiButton>
            </UiHost>
          </Example>

          <Example
            title="Toggle"
            note="A UISwitch. onIsOnChange, not onValueChange."
            code={'<UiToggle isOn={on()} onIsOnChange={(event) => ...} />'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiToggle
                label="Wi-Fi"
                isOn={on()}
                onIsOnChange={(event) => setOn(event.nativeEvent.isOn)}
              ></UiToggle>
            </UiHost>
            <Text class="body">{on() ? 'on' : 'off'}</Text>
          </Example>

          <Example
            title="Stepper"
            note="Plus and minus, with the platform's own repeat behaviour when held."
            code={'<UiStepper value={n()} onValueChange={(event) => ...} />'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiStepper
                label="Guests"
                value={guests()}
                min={1}
                max={8}
                step={1}
                onValueChange={(event) => setGuests(event.nativeEvent.value)}
              ></UiStepper>
            </UiHost>
            <Text class="body">{guests()}</Text>
          </Example>

          <Example
            title="Text field"
            note="text is not the text. It names an ObservableState living on the native side, and
            what travels over the prop is that object's id, so binding the string logs
            FieldInvalidTypeException and the field quietly ignores everything you set."
            code={'text={name}'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiTextField
                placeholder="Your name"
                text={name}
                onTextChange={(event) => setTyped(event.nativeEvent.value)}
              ></UiTextField>
            </UiHost>
            <Text class="body">{typed() || '(empty)'}</Text>
            <Pressable class="card" onPress={() => name?.set('Ada Lovelace')}>
              <Text class="button-label">set it from Solid</Text>
            </Pressable>
          </Example>

          <Example
            title="Colour picker"
            note="Opens the system colour panel, which is not something React Native offers."
            code={'<UiColorPicker selection={...} />'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiColorPicker
                label="Tint"
                selection="#3b6ef5"
                supportsOpacity={true}
              ></UiColorPicker>
            </UiHost>
          </Example>

          <Example
            title="Date picker"
            note="The graphical variant is the full calendar; compact is the tappable field."
            code={"modifiers={[datePickerStyle('compact')]}"}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiDatePicker
                title="When"
                modifiers={[{ $type: 'datePickerStyle', style: 'compact' }]}
                displayedComponents={['date']}
              ></UiDatePicker>
            </UiHost>
          </Example>
        </Section>

        <Section title="Indicators" note="Presentational, so nothing has to be wired to them.">
          <Example
            title="Gauge"
            note="A SwiftUI gauge, with the labels it draws at each end."
            code={'<UiGauge value={0.7} type="circular" />'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostRow}>
              <UiGauge
                value={level()}
                min={0}
                max={1}
                currentValueLabel={level().toFixed(2)}
                minimumValueLabel="0"
                maximumValueLabel="1"
              ></UiGauge>
            </UiHost>
          </Example>

          <Example title="Progress" code={'<UiProgress value={0.4} />'}>
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostFill}>
              <UiProgress value={level()}></UiProgress>
            </UiHost>
          </Example>
        </Section>

        <Section title="Layout" note="SwiftUI's own stacks, laid out by SwiftUI rather than Yoga.">
          <Example
            title="hstack and vstack"
            note="Inside the host these are SwiftUI layout containers - the flex properties of the
                surrounding views mean nothing to them."
            code={'<UiHStack><Text /><UiSpacer /><Text /></UiHStack>'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostFill}>
              <UiVStack spacing={8}>
                <UiHStack spacing={12}>
                  <UiText text="Leading"></UiText>
                  <UiSpacer></UiSpacer>
                  <UiText text="Trailing"></UiText>
                </UiHStack>
                <UiDivider></UiDivider>
                <UiLabeledContent label="Version">
                  <UiText text="1.0"></UiText>
                </UiLabeledContent>
              </UiVStack>
            </UiHost>
          </Example>

          <Example
            title="Section in a form"
            note="The grouped list style an iOS settings screen is built from, with none of it drawn
                by us."
            code={'<UiForm><UiSection title="...">...</UiSection></UiForm>'}
          >
            <UiHost ignoreSafeArea="container" matchContents={{ vertical: true }} style={hostForm}>
              <UiForm>
                <UiSection title="Display">
                  <UiSlot name="content">
                    <UiToggle label="Bold text" isOn={on()}></UiToggle>
                    <UiLabeledContent label="Appearance">
                      <UiSlot name="content">
                        <UiText text="Dark"></UiText>
                      </UiSlot>
                    </UiLabeledContent>
                  </UiSlot>
                </UiSection>
              </UiForm>
            </UiHost>
          </Example>
        </Section>

        <Text class="hint">
          Fifty-five SwiftUI elements are registered, and these are the ones worth looking at. The
          rest are the same idea: a name, and the props the SwiftUI view declares.
        </Text>
      </ScrollView>
    </>
  );
}
