import { createSignal, onCleanup, type Accessor, type Setter } from 'solid-js';
import { expoModule } from '../native.ts';
import { callerCleanup, ownedRequests, silence, sourcedService } from './owned.ts';

export interface Vector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface VectorMeasurement extends Vector {
  readonly timestamp: number;
}
export interface RotationMeasurement {
  readonly alpha: number;
  readonly beta: number;
  readonly gamma: number;
  readonly timestamp: number;
}
export interface DeviceMotionMeasurement {
  readonly acceleration: VectorMeasurement | null;
  readonly accelerationIncludingGravity: VectorMeasurement;
  readonly rotation: RotationMeasurement;
  readonly rotationRate: RotationMeasurement | null;
  readonly orientation: 0 | 90 | 180 | -90;
  readonly interval: number;
}
export interface BarometerMeasurement {
  readonly pressure: number;
  readonly relativeAltitude?: number;
  readonly timestamp: number;
}
export interface LightSensorMeasurement {
  readonly illuminance: number;
  readonly timestamp: number;
}
export interface NativeSensor<T> {
  addListener(listener: (reading: T) => void): { remove(): void };
  setUpdateInterval(intervalMs: number): void;
  isAvailableAsync(): Promise<boolean>;
}

/** Shared sensor subscription, with one caller-owned claim per start and the fastest interval. */
export class Sensor<T> {
  readonly reading: Accessor<T>;
  readonly available: Accessor<boolean | null>;
  private readonly setReading: Setter<T>;
  private readonly requests = ownedRequests();
  private readonly native: NativeSensor<T> | null;
  private readonly claims = new Set<{ interval: number }>();
  private subscription: { remove(): void } | null = null;
  private revision = 0;
  private generation = 0;
  private syncing = false;
  private disposed = false;

  constructor(native: NativeSensor<T> | null, zero: T) {
    this.native = native;
    [this.reading, this.setReading] = createSignal(zero);
    const [available, setAvailable] = createSignal<boolean | null>(null);
    this.available = available;
    onCleanup(() => {
      this.disposed = true;
      this.stop();
    });
    void this.requests
      .run(false, () => native?.isAvailableAsync() ?? false, setAvailable)
      .catch(() => {
        if (this.requests.active()) setAvailable(false);
      });
  }

  start(intervalMs = 100): () => void {
    if (!this.active()) return () => {};
    if (!Number.isFinite(intervalMs) || intervalMs <= 0)
      throw new RangeError('Sensor interval must be positive and finite.');
    const claim = { interval: intervalMs };
    this.claims.add(claim);
    this.revision++;
    const release = () => {
      if (!this.claims.delete(claim)) return;
      this.revision++;
      silence(() => this.sync());
    };
    callerCleanup(release);
    try {
      this.sync();
    } catch (error) {
      release();
      throw error;
    }
    return release;
  }

  stop(): void {
    this.claims.clear();
    this.revision++;
    this.generation++;
    const held = this.subscription;
    this.subscription = null;
    if (held) silence(() => held.remove());
    if (this.active() && this.claims.size) this.sync();
  }

  private sync(): void {
    if (this.syncing) return;
    this.syncing = true;
    try {
      this.synchronize();
    } finally {
      this.syncing = false;
    }
  }

  private synchronize(): void {
    for (;;) {
      if (!this.active() || !this.claims.size) {
        this.stop();
        // A native remover may synchronously start a newer claim.
        if (!this.active() || !this.claims.size) return;
      }
      if (!this.native) return;
      const revision = this.revision;
      this.native.setUpdateInterval(Math.min(...[...this.claims].map((claim) => claim.interval)));
      if (!this.active()) continue;
      if (revision !== this.revision) continue;
      if (!this.subscription) this.subscribe();
      if (revision === this.revision) return;
    }
  }

  private active(): boolean {
    return !this.disposed && this.requests.active();
  }

  private subscribe(): void {
    const generation = ++this.generation;
    const held = this.native!.addListener((reading) => {
      if (this.active() && this.claims.size && generation === this.generation)
        this.setReading(() => reading);
    });
    if (!this.active() || !this.claims.size || generation !== this.generation) {
      silence(() => held.remove());
    } else this.subscription = held;
  }
}

export const ORIGIN: Vector = Object.freeze({ x: 0, y: 0, z: 0 });
const STILL: VectorMeasurement = Object.freeze({ ...ORIGIN, timestamp: 0 });
type Sensors = typeof import('expo-sensors');
function sensorToken<T>(name: string, pick: (source: Sensors) => NativeSensor<T>, zero: T) {
  return sourcedService<Sensor<T>, NativeSensor<T> | null>(
    `expo.${name}`,
    () => {
      const source = expoModule('expo-sensors', () => require('expo-sensors') as Sensors);
      return source ? pick(source) : null;
    },
    (source) => new Sensor(source, zero),
  );
}
export const Accelerometer = sensorToken<VectorMeasurement>(
  'accelerometer',
  (source) => source.Accelerometer,
  STILL,
);
export type Accelerometer = Sensor<VectorMeasurement>;
export const Gyroscope = sensorToken<VectorMeasurement>(
  'gyroscope',
  (source) => source.Gyroscope,
  STILL,
);
export type Gyroscope = Sensor<VectorMeasurement>;
export const Magnetometer = sensorToken<VectorMeasurement>(
  'magnetometer',
  (source) => source.Magnetometer,
  STILL,
);
export type Magnetometer = Sensor<VectorMeasurement>;
export const DeviceMotion = sensorToken<DeviceMotionMeasurement>(
  'deviceMotion',
  (source) => source.DeviceMotion,
  {
    acceleration: null,
    accelerationIncludingGravity: STILL,
    rotation: { alpha: 0, beta: 0, gamma: 0, timestamp: 0 },
    rotationRate: null,
    orientation: 0,
    interval: 0,
  },
);
export type DeviceMotion = Sensor<DeviceMotionMeasurement>;
export const Barometer = sensorToken<BarometerMeasurement>(
  'barometer',
  (source) => source.Barometer,
  { pressure: 0, relativeAltitude: 0, timestamp: 0 },
);
export type Barometer = Sensor<BarometerMeasurement>;
export const LightSensor = sensorToken<LightSensorMeasurement>(
  'lightSensor',
  (source) => source.LightSensor,
  { illuminance: 0, timestamp: 0 },
);
export type LightSensor = Sensor<LightSensorMeasurement>;
