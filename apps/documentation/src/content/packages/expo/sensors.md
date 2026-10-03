---
title: Sensors
summary: Accelerometer, gyroscope, magnetometer, device motion, barometer and light, one shape.
---

# Sensors

Six motion and environment sensors, bound to `expo-sensors`: `Accelerometer`, `Gyroscope`,
`Magnetometer`, `DeviceMotion`, `Barometer` and `LightSensor`. They share one shape
(`addListener`, `setUpdateInterval`, `isAvailableAsync`), so each export is a distinct service token
resolving to a `Sensor<T>` for its own reading type.

## Install

```sh
npx expo install expo-sensors
```

```ts
import {
  Accelerometer,
  Gyroscope,
  Magnetometer,
  DeviceMotion,
  Barometer,
  LightSensor,
} from '@solid-native/expo/solid/sensors';
```

## The smallest useful example

```tsx
import { Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Accelerometer } from '@solid-native/expo/solid/sensors';

export function ShakeDetector() {
  const motion = useService(Accelerometer);
  motion.start(50);

  return <Text>z: {motion.reading().z.toFixed(2)}</Text>;
}
```

Nothing is subscribed until `start`. Choose the interval for the use - a compass wants a tenth of a
second, a shake detector less - since every event is a reactive update and a fast sensor keeps the
phone from idling. A `start` inside a component is released when the component is disposed.

## What each one reports

- **`Accelerometer`** - `{ x, y, z }` in g, including gravity (lying flat reads about `1` on `z`).
- **`Gyroscope`** - `{ x, y, z }`, rotation in radians per second.
- **`Magnetometer`** - `{ x, y, z }`, the magnetic field in microteslas; the basis of a compass.
- **`DeviceMotion`** - `acceleration`, `accelerationIncludingGravity`, `rotation`, `rotationRate`,
  `orientation`, `interval`.
- **`Barometer`** - `{ pressure, relativeAltitude }`, pressure in hectopascals. Present on fewer
  devices; check `available` first.
- **`LightSensor`** - `{ illuminance }` in lux. Android only.

Each is read the same way:

- **`reading`** - accessor: the most recent value, or the stated zero until the sensor reports.
- **`available`** - `boolean | null`, null until the platform answers (always one turn away, since
  `isAvailableAsync` is async). An accessor rather than a promise, because a promise in JSX
  (`<Show when={barometer.available()}>`) is truthy on every frame.
- **`start(intervalMs = 100)`** - claims the sensor at that interval and returns a release
  function. Concurrent claims run the listener at the fastest interval and stop when the last is
  released. A claim under a Solid owner is released when the owner is disposed. A non-positive or
  non-finite interval throws a `RangeError`.
- **`stop()`** - releases every claim and removes the listener.

## Without the module

On iOS and Android, a missing `expo-sensors` (never installed, or not rebuilt since) throws a
`MissingModuleError` when a sensor first reaches for it, naming the module and the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

On the web, and in a test with no fake, `available` resolves to `false`, `reading` stays at the
stated zero (all axes `0`, or the rest state for `DeviceMotion`), and `start()` returns a no-op. A
test provides a `NativeSensor` fake with `provideService(Accelerometer.SOURCE, () => fake)`.

## Reference

`Sensor` and the six sensor tokens are exported from `@solid-native/expo/solid/sensors`.

<!-- api: Sensor -->
