/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { UiDatePicker, UiHost, UiPicker } from '@solid-native/expo/expo-ui-components';

/** A booking form: a date and a choice, both controlled fields on SwiftUI/Compose controls. */
export function expoUiFormFixture() {
  const [arrival, setArrival] = createSignal<Date | null>(new Date('2026-10-01T09:00:00.000Z'));
  const [room, setRoom] = createSignal<string | number>('double');
  const [locked, setLocked] = createSignal(false);
  const touched = { arrival: 0, room: 0 };
  const rooms = [
    { value: 'single', label: 'Single' },
    { value: 'double', label: 'Double' },
    { value: 'suite', label: 'Suite' },
  ];
  const View = () => (
    <UiHost>
      <UiDatePicker
        nativeID="date"
        title="Arrival"
        value={arrival()}
        onValueChange={setArrival}
        onTouch={() => touched.arrival++}
        disabled={locked()}
      />
      <UiPicker
        nativeID="room"
        label="Room"
        pickerStyle="menu"
        options={rooms}
        value={room()}
        onValueChange={setRoom}
        onTouch={() => touched.room++}
      />
    </UiHost>
  );
  return { View, arrival, setArrival, room, setLocked, touched };
}

/** Pickers disabled outside a form, by a bare `disabled`. */
export const ExpoUiDisabled = () => (
  <UiHost>
    <UiDatePicker nativeID="bare-date" disabled />
    <UiPicker nativeID="bare-room" disabled options={[{ value: 'single', label: 'Single' }]} />
  </UiHost>
);

/** Hosts sized to their SwiftUI content, both ways and one way. */
export const ExpoUiHosts = () => (
  <>
    <UiHost nativeID="both" matchContents />
    <UiHost nativeID="tall" matchContents={{ vertical: true }} />
  </>
);
