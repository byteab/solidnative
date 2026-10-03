import type * as Apple from 'expo-apple-authentication';
import type * as Sensors from 'expo-sensors';
import type * as Files from 'expo-file-system';
import type { NativeAppleAuthentication } from '../src/solid/apple-sign-in.ts';
import type { NativeFile } from '../src/solid/file-system.ts';
import type {
  NativeSensor,
  VectorMeasurement,
  DeviceMotionMeasurement,
  BarometerMeasurement,
  LightSensorMeasurement,
} from '../src/solid/sensors.ts';

type Satisfies<T, U extends T> = U;
export type AppleContract = Satisfies<NativeAppleAuthentication, typeof Apple>;
export type FileContract = Satisfies<NativeFile, Files.File>;
export type AccelerometerContract = Satisfies<
  NativeSensor<VectorMeasurement>,
  typeof Sensors.Accelerometer
>;
export type GyroscopeContract = Satisfies<
  NativeSensor<VectorMeasurement>,
  typeof Sensors.Gyroscope
>;
export type MagnetometerContract = Satisfies<
  NativeSensor<VectorMeasurement>,
  typeof Sensors.Magnetometer
>;
export type DeviceMotionContract = Satisfies<
  NativeSensor<DeviceMotionMeasurement>,
  typeof Sensors.DeviceMotion
>;
export type BarometerContract = Satisfies<
  NativeSensor<BarometerMeasurement>,
  typeof Sensors.Barometer
>;
export type LightContract = Satisfies<
  NativeSensor<LightSensorMeasurement>,
  typeof Sensors.LightSensor
>;
