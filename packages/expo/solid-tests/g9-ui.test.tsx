/** @jsxImportSource @solidnative/platform/solid */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createSignal } from 'solid-js';
import { createNativeRoot } from '@solidnative/platform/solid';
import { registerPlatformComponents } from '@solidnative/fabric';
import { registerExpoUiViews } from '@solidnative/expo/views';
import {
  UiHost,
  UiMenu,
  UiButton,
  UiDivider,
  UiSlot,
  UiList,
  UiSwipeActions,
  UiSlider,
  UiVStack,
  UiImage,
  UiText,
  UiDatePicker,
  UiPicker,
  UiToggle,
  UiStepper,
  UiTextField,
  UiColorPicker,
  UiGauge,
  UiProgress,
  UiHStack,
  UiSpacer,
  UiLabeledContent,
  UiForm,
  UiSection,
  type UiPickerOption,
} from '../src/solid/expo-ui-components.ts';
import { AppleSignInButton } from '../src/solid/apple-sign-in.ts';
import type { NativeRef } from '@solidnative/components/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';

const roots: { dispose(): void }[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.dispose();
  registerPlatformComponents('ios');
});
function setup(platform = 'ios') {
  registerPlatformComponents(platform);
  registerExpoUiViews(platform as 'ios' | 'android');
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 901 });
  roots.push(root);
  return { fabric, root, tree: () => fabric.roots.get(901)![0]! };
}
test('all Expo UI wrappers preserve native names, hierarchy, modifiers and reactive events', () => {
  const { fabric, root, tree } = setup();
  const [value, setValue] = createSignal(0.2);
  const [handler, setHandler] = createSignal(true);
  let calls = 0;
  const modifiers = [{ $type: 'padding', all: 8 }];
  root.render(() => (
    <UiHost matchContents={{ vertical: true }} aria-label="Native controls">
      <UiVStack spacing={8}>
        <UiMenu label="Actions">
          <UiButton
            role="destructive"
            label="Delete"
            onButtonPress={handler() ? () => calls++ : undefined}
          />
          <UiDivider />
        </UiMenu>
        <UiList>
          <UiSwipeActions>
            <UiText text="Row" />
            <UiSlot name="actions" extraProps={{ edge: 'trailing' }}>
              <UiButton label="Archive" />
            </UiSlot>
          </UiSwipeActions>
        </UiList>
        <UiSlider
          value={value()}
          min={0}
          max={1}
          steps={4}
          onValueChanged={(e) => setValue(e.nativeEvent.value)}
        />
        <UiImage systemName="heart" size={20} />
        <UiToggle isOn label="Toggle" />
        <UiStepper value={2} min={1} max={5} step={1} />
        <UiTextField text={{ id: 7, get: () => '', set() {}, release() {} }} placeholder="Type" />
        <UiColorPicker selection="#123456" supportsOpacity />
        <UiGauge value={3} min={1} max={5} type="linear" />
        <UiProgress value={value()} />
        <UiHStack alignment="center">
          <UiSpacer />
          <UiLabeledContent label="Count">
            <UiText text="3" />
          </UiLabeledContent>
        </UiHStack>
        <UiForm modifiers={modifiers}>
          <UiSection title="Details">
            <UiText text="Body" />
          </UiSection>
        </UiForm>
      </UiVStack>
    </UiHost>
  ));
  const host = tree();
  const stack = host.children[0]!;
  const button = stack.children[0]!.children[0]!;
  assert.match(host.viewName, /HostView/);
  assert.equal(host.props['matchContentsVertical'], true);
  assert.equal(host.props['accessibilityLabel'], 'Native controls');
  assert.equal(host.props['aria-label'], undefined);
  assert.equal(button.props['role'], 'destructive');
  assert.equal(stack.children[2]!.props['value'], 0.2);
  assert.equal(stack.children[6]!.props['text'], 7);
  assert.deepEqual(stack.children[11]!.props['modifiers'], modifiers);
  fabric.emit(button, 'topButtonPress', {});
  assert.equal(calls, 1);
  fabric.emit(stack.children[2]!, 'topValueChanged', { value: 0.6 });
  root.flush();
  assert.equal(value(), 0.6);
  assert.equal(tree().children[0]!.children[9]!.props['value'], 0.6);
  setHandler(false);
  root.flush();
  fabric.emit(button, 'topButtonPress', {});
  assert.equal(calls, 1);
});
test('UiPicker keeps option identity across label/reorder updates and strips form-only props', () => {
  const { fabric, root, tree } = setup();
  const [options, setOptions] = createSignal<readonly UiPickerOption[]>([
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ]);
  const [value, setValue] = createSignal<string | number | null>('a');
  const [disabled, setDisabled] = createSignal(false);
  let touch = 0;
  root.render(() => (
    <UiPicker
      options={options()}
      value={value()}
      onValueChange={setValue}
      pickerStyle="menu"
      disabled={disabled()}
      onTouch={() => touch++}
    />
  ));
  const picker = tree();
  const rows = picker.children[0]!.children;
  const a = rows[0]!.tag,
    b = rows[1]!.tag;
  assert.equal(picker.props['options'], undefined);
  assert.equal(picker.props['value'], undefined);
  fabric.emit(picker, 'topSelectionChange', { selection: 'b' });
  root.flush();
  assert.equal(value(), 'b');
  assert.equal(touch, 1);
  setOptions([
    { value: 'b', label: 'Bee' },
    { value: 'a', label: 'Ay' },
  ]);
  root.flush();
  const next = tree().children[0]!.children;
  assert.deepEqual(
    next.map((row) => row.tag),
    [b, a],
  );
  assert.equal(next[0]!.props['text'], 'Bee');
  setDisabled(true);
  root.flush();
  fabric.emit(tree(), 'topSelectionChange', { selection: 'a' });
  assert.equal(value(), 'b');
  assert.equal(touch, 1);
  assert.deepEqual(tree().props['modifiers'], [
    { $type: 'pickerStyle', style: 'menu' },
    { $type: 'disabled', disabled: true },
  ]);
});
for (const platform of ['ios', 'android'])
  test(`UiDatePicker preserves ${platform} date mapping and ignores malformed/initial empty reports`, () => {
    const { fabric, root, tree } = setup(platform);
    let count = 0;
    let touched = 0;
    const [date, setDate] = createSignal<Date | null>(null);
    const type = platform === 'ios' ? 'topDateChange' : 'topDateSelected';
    root.render(() => (
      <UiDatePicker
        value={date()}
        onValueChange={(value) => {
          count++;
          setDate(value);
        }}
        onTouch={() => touched++}
      />
    ));
    fabric.emit(tree(), type, { date: null });
    fabric.emit(tree(), type, { date: {} });
    fabric.emit(tree(), type, { date: 'invalid' });
    assert.equal(count, 0);
    fabric.emit(tree(), type, { date: 1000 });
    assert.equal(count, 0);
    fabric.emit(tree(), type, { date: 2000 });
    root.flush();
    assert.equal(count, 1);
    assert.equal(touched, 1);
    assert.equal(date()!.getTime(), 2000);
    assert.equal(
      tree().props[platform === 'ios' ? 'selection' : 'initialDate'],
      platform === 'ios' ? new Date(2000).toISOString() : 2000,
    );
  });
test('picker proposal disposal cancels touch and raw callbacks and native refs become detached', () => {
  const { fabric, root, tree } = setup();
  let touches = 0,
    raw = 0;
  let ref!: NativeRef;
  root.render(() => (
    <UiPicker
      defaultValue="a"
      ref={(value) => (ref = value)}
      onValueChange={() => root.dispose()}
      onTouch={() => touches++}
      onSelectionChange={() => raw++}
    />
  ));
  fabric.emit(tree(), 'topSelectionChange', { selection: 'b' });
  assert.equal(touches, 0);
  assert.equal(raw, 0);
  assert.equal(ref.isAttached(), false);
});
test('Apple native button maps enums, keeps accessibility and replaces callbacks', () => {
  const { fabric, root, tree } = setup();
  const [style, setStyle] = createSignal<'black' | 'white'>('black');
  const [active, setActive] = createSignal(true);
  let calls = 0;
  root.render(() => (
    <AppleSignInButton
      buttonType="continue"
      buttonStyle={style()}
      cornerRadius={12}
      aria-label="Continue with Apple"
      onButtonPress={active() ? () => calls++ : undefined}
    />
  ));
  assert.match(tree().viewName, /AppleAuthentication/);
  assert.equal(tree().props['buttonType'], 1);
  assert.equal(tree().props['buttonStyle'], 2);
  assert.equal(tree().props['cornerRadius'], 12);
  assert.equal(tree().props['accessibilityLabel'], 'Continue with Apple');
  fabric.emit(tree(), 'topButtonPress', {});
  assert.equal(calls, 1);
  setStyle('white');
  setActive(false);
  root.flush();
  assert.equal(tree().props['buttonStyle'], 0);
  fabric.emit(tree(), 'topButtonPress', {});
  assert.equal(calls, 1);
});
