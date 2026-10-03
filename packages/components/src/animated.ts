/**
 * React Native's `Animated`, for a browser: values, interpolation, timing, spring and the
 * composites that sequence them, stepped by `requestAnimationFrame`.
 *
 * A browser build cannot load React Native's own graph. It is Flow source a web bundler will not
 * parse, and it pulls in the rest of React Native behind it. So `solid/animations-web.ts` hands out
 * this instead, under the same names, and an app's `new Animated.Value(0)` and `Animated.timing(...)`
 * run here in a browser and in React Native on a device, from one import.
 *
 * The arithmetic is React Native's, formula for formula - `TimingAnimation`, `SpringAnimation`,
 * `SpringConfig` and `AnimatedInterpolation` in `Libraries/Animated` - so a curve lands in the
 * same place at the same moment on both. What is left out is what a browser has no use for or
 * nothing here needs yet: the native driver (every value here is JavaScript-driven, and
 * `useNativeDriver` is accepted and ignored), decay, loops, `ValueXY`, events and the arithmetic
 * nodes. Anything else a device build calls on `Animated` is simply not here, and fails loudly.
 *
 * Time is the frame's own timestamp rather than `Date.now()`, which is the clock a browser paints
 * on. The one visible difference that makes: an animation's first frame is its start, at the value
 * it starts from, where React Native's first frame is already one frame in.
 */
import { interpolate as mix, tween } from '@solidnative/fabric';
import type { AnimatedPropsHandle, AnimationBackend } from './solid/animation-types.ts';
import { Easing, type EasingFunction } from './easing.ts';

export interface EndResult {
  finished: boolean;
}
export type EndCallback = (result: EndResult) => void;

/** What `Animated.timing` and the rest hand back, as React Native's do. */
export interface CompositeAnimation {
  start(callback?: EndCallback): void;
  stop(): void;
  reset(): void;
}

type Extrapolate = 'extend' | 'clamp' | 'identity';

export interface InterpolationConfig {
  inputRange: readonly number[];
  outputRange: readonly (number | string)[];
  easing?: EasingFunction;
  extrapolate?: Extrapolate;
  extrapolateLeft?: Extrapolate;
  extrapolateRight?: Extrapolate;
}

/** Anything a style can hold where a plain value would go. */
export abstract class AnimatedNode {
  abstract __getValue(): unknown;
  /** The values this one is computed from: the things that actually change. */
  abstract __roots(): Iterable<AnimatedValue>;

  interpolate(config: InterpolationConfig): AnimatedInterpolation {
    return new AnimatedInterpolation(this, config);
  }
}

export class AnimatedValue extends AnimatedNode {
  private value: number;
  private offset = 0;
  private readonly startingValue: number;
  private animation: Driver | null = null;
  private readonly listeners = new Map<string, (state: { value: number }) => void>();
  private nextListener = 0;
  /** The `AnimatedStyle` handles reading this value, told once per change. */
  readonly __observers = new Set<() => void>();

  constructor(value = 0) {
    super();
    this.value = this.startingValue = value;
  }

  __getValue(): number {
    return this.value + this.offset;
  }

  __roots(): Iterable<AnimatedValue> {
    return [this];
  }

  setValue(value: number): void {
    this.stopAnimation();
    this.update(value);
  }

  setOffset(offset: number): void {
    this.offset = offset;
  }

  flattenOffset(): void {
    this.value += this.offset;
    this.offset = 0;
  }

  extractOffset(): void {
    this.offset += this.value;
    this.value = 0;
  }

  addListener(callback: (state: { value: number }) => void): string {
    const id = String(this.nextListener++);
    this.listeners.set(id, callback);
    return id;
  }

  removeListener(id: string): void {
    this.listeners.delete(id);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  stopAnimation(callback?: (value: number) => void): void {
    const animation = this.animation;
    this.animation = null;
    animation?.stop();
    callback?.(this.__getValue());
  }

  resetAnimation(callback?: (value: number) => void): void {
    this.stopAnimation(callback);
    this.value = this.startingValue;
  }

  /** Run one animation on this value, stopping whatever was running on it. */
  __animate(animation: Driver, callback?: EndCallback): void {
    const previous = this.animation;
    this.animation = null;
    previous?.stop();
    this.animation = animation;
    animation.start(
      this.value,
      (value) => this.update(value),
      (result) => {
        if (this.animation === animation) this.animation = null;
        callback?.(result);
      },
      previous,
    );
  }

  private update(value: number): void {
    this.value = value;
    for (const observer of this.__observers) observer();
    for (const listener of this.listeners.values()) listener({ value: this.__getValue() });
  }
}

export class AnimatedInterpolation extends AnimatedNode {
  private readonly parent: AnimatedNode;
  private readonly config: InterpolationConfig;

  constructor(parent: AnimatedNode, config: InterpolationConfig) {
    super();
    this.parent = parent;
    this.config = config;
  }

  __getValue(): unknown {
    return interpolateRange(this.parent.__getValue() as number, this.config);
  }

  __roots(): Iterable<AnimatedValue> {
    return this.parent.__roots();
  }
}

/** React Native's segment lookup: the last range whose end is at or past the input. */
function findRange(input: number, inputRange: readonly number[]): number {
  let i;
  for (i = 1; i < inputRange.length - 1; ++i) if (inputRange[i]! >= input) break;
  return i - 1;
}

/** One segment of an interpolation's ranges, and what to do past either end of it. */
interface Segment {
  readonly inMin: number;
  readonly inMax: number;
  readonly easing: EasingFunction;
  readonly left: Extrapolate;
  readonly right: Extrapolate;
}

function interpolateRange(input: number, config: InterpolationConfig): unknown {
  const range = findRange(input, config.inputRange);
  const segment: Segment = {
    inMin: config.inputRange[range]!,
    inMax: config.inputRange[range + 1]!,
    easing: config.easing ?? Easing.linear,
    left: config.extrapolateLeft ?? config.extrapolate ?? 'extend',
    right: config.extrapolateRight ?? config.extrapolate ?? 'extend',
  };
  const outMin = config.outputRange[range]!;
  const outMax = config.outputRange[range + 1]!;
  if (typeof outMin === 'number' && typeof outMax === 'number') {
    return interpolateNumber(input, segment, outMin, outMax);
  }
  // A string range - an angle, a percentage, a colour - is the same curve from 0 to 1, laid over
  // the two strings by the engine's own tween, which is what CSS transitions interpolate with.
  if (extrapolated(input, segment) === null) return input;
  const t = interpolateNumber(input, segment, 0, 1);
  return tween(outMin, outMax, t) ?? mix(outMin, outMax, t);
}

/** The input, with either end's rule applied past that end. Null where `identity` hands it back. */
function extrapolated(input: number, { inMin, inMax, left, right }: Segment): number | null {
  if (input < inMin) return left === 'identity' ? null : left === 'clamp' ? inMin : input;
  if (input > inMax) return right === 'identity' ? null : right === 'clamp' ? inMax : input;
  return input;
}

const normalise = (value: number, min: number, max: number): number =>
  min === -Infinity ? -value : max === Infinity ? value - min : (value - min) / (max - min);

const project = (value: number, min: number, max: number): number =>
  min === -Infinity ? -value : max === Infinity ? value + min : value * (max - min) + min;

/** `AnimatedInterpolation`'s `interpolate`, step for step. */
function interpolateNumber(
  input: number,
  segment: Segment,
  outMin: number,
  outMax: number,
): number {
  const result = extrapolated(input, segment);
  if (result === null) return input;
  if (outMin === outMax) return outMin;
  if (segment.inMin === segment.inMax) return input <= segment.inMin ? outMin : outMax;
  return project(segment.easing(normalise(result, segment.inMin, segment.inMax)), outMin, outMax);
}

/**
 * One animation on one value: React Native's `Animation`, reduced to what it does here. It asks
 * for frames until it ends, and ends once, whether it finished or was stopped.
 */
abstract class Driver {
  protected update: (value: number) => void = () => {};
  private onEnd: EndCallback = () => {};
  private active = true;
  private frameId: number | null = null;

  start(
    from: number,
    update: (value: number) => void,
    onEnd: EndCallback,
    previous: Driver | null,
  ): void {
    this.update = update;
    this.onEnd = onEnd;
    this.begin(from, previous);
  }

  stop(): void {
    this.end(false);
  }

  protected abstract begin(from: number, previous: Driver | null): void;

  protected request(step: (time: number) => void): void {
    if (!this.active) return;
    this.frameId = requestAnimationFrame((time) => {
      this.frameId = null;
      step(time);
    });
  }

  /** Whether a listener stopped this from inside the last update. */
  protected get stopped(): boolean {
    return !this.active;
  }

  protected end(finished: boolean): void {
    if (!this.active) return;
    this.active = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.onEnd({ finished });
  }
}

export interface TimingConfig {
  toValue: number;
  duration?: number;
  easing?: EasingFunction;
  delay?: number;
  useNativeDriver?: boolean;
}

/** React Native's default timing curve. Made once, because a bezier is solved per call anyway. */
const easeInOut = Easing.inOut(Easing.ease);

class Timing extends Driver {
  private readonly to: number;
  private readonly duration: number;
  private readonly easing: EasingFunction;
  private readonly delay: number;
  private from = 0;
  private startTime = 0;

  constructor(config: TimingConfig) {
    super();
    this.to = config.toValue;
    this.duration = config.duration ?? 500;
    this.easing = config.easing ?? easeInOut;
    this.delay = config.delay ?? 0;
  }

  protected begin(from: number): void {
    this.from = from;
    if (this.duration === 0 && this.delay === 0) {
      this.update(this.to);
      this.end(true);
      return;
    }
    this.request((time) => {
      this.startTime = time + this.delay;
      this.step(time);
    });
  }

  private step(time: number): void {
    const elapsed = time - this.startTime;
    if (elapsed < 0) return this.request((t) => this.step(t));
    if (elapsed >= this.duration) {
      this.update(
        this.duration === 0 ? this.to : this.from + this.easing(1) * (this.to - this.from),
      );
      this.end(true);
      return;
    }
    this.update(this.from + this.easing(elapsed / this.duration) * (this.to - this.from));
    this.request((t) => this.step(t));
  }
}

export interface SpringConfig {
  toValue: number;
  overshootClamping?: boolean;
  restDisplacementThreshold?: number;
  restSpeedThreshold?: number;
  velocity?: number;
  delay?: number;
  bounciness?: number;
  speed?: number;
  tension?: number;
  friction?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  useNativeDriver?: boolean;
}

const stiffnessFromOrigami = (value: number): number => (value - 30) * 3.62 + 194;
const dampingFromOrigami = (value: number): number => (value - 8) * 3 + 25;

/** `SpringConfig.fromBouncinessAndSpeed`, as React Native converts Origami's two knobs. */
function fromBouncinessAndSpeed(
  bounciness: number,
  speed: number,
): { stiffness: number; damping: number } {
  const normalize = (value: number, start: number, end: number) => (value - start) / (end - start);
  const projectNormal = (n: number, start: number, end: number) => start + n * (end - start);
  const linear = (t: number, start: number, end: number) => t * end + (1 - t) * start;
  const quadraticOut = (t: number, start: number, end: number) => linear(2 * t - t * t, start, end);
  const noBounce = (tension: number): number => {
    if (tension <= 18) return 0.0007 * tension ** 3 - 0.031 * tension ** 2 + 0.64 * tension + 1.28;
    if (tension <= 44) return 0.000044 * tension ** 3 - 0.006 * tension ** 2 + 0.36 * tension + 2;
    return 0.00000045 * tension ** 3 - 0.000332 * tension ** 2 + 0.1078 * tension + 5.84;
  };

  const b = projectNormal(normalize(bounciness / 1.7, 0, 20), 0, 0.8);
  const s = normalize(speed / 1.7, 0, 20);
  const tension = projectNormal(s, 0.5, 200);
  const friction = quadraticOut(b, noBounce(tension), 0.01);
  return { stiffness: stiffnessFromOrigami(tension), damping: dampingFromOrigami(friction) };
}

interface Physics {
  stiffness: number;
  damping: number;
  mass: number;
}

/**
 * The three ways React Native lets a spring be described, reduced to the one it solves. Which one
 * applies is decided the way `SpringAnimation` decides it: stiffness, damping or mass named at all
 * wins, then bounciness or speed, then tension and friction, which are the defaults.
 */
function physics(config: SpringConfig): Physics {
  const { stiffness, damping, mass, bounciness, speed } = config;
  if (stiffness !== undefined || damping !== undefined || mass !== undefined) {
    return { stiffness: stiffness ?? 100, damping: damping ?? 10, mass: mass ?? 1 };
  }
  if (bounciness !== undefined || speed !== undefined) {
    return { ...fromBouncinessAndSpeed(bounciness ?? 8, speed ?? 12), mass: 1 };
  }
  return fromTensionAndFriction(config);
}

const fromTensionAndFriction = ({ tension = 40, friction = 7 }: SpringConfig): Physics => ({
  stiffness: stiffnessFromOrigami(tension),
  damping: dampingFromOrigami(friction),
  mass: 1,
});

/** A frame that arrives after a stall advances at most this far, so a spring never jumps. */
const MAX_STEP_MS = 64;

class Spring extends Driver {
  private readonly to: number;
  private readonly overshootClamping: boolean;
  private readonly restDisplacement: number;
  private readonly restSpeed: number;
  private readonly delay: number;
  private readonly stiffness: number;
  private readonly damping: number;
  private readonly mass: number;
  private initialVelocity: number;
  private startPosition = 0;
  lastPosition = 0;
  lastVelocity: number;
  lastTime: number | null = null;
  private frameTime = 0;

  constructor(config: SpringConfig) {
    super();
    this.to = config.toValue;
    this.overshootClamping = config.overshootClamping ?? false;
    this.restDisplacement = config.restDisplacementThreshold ?? 0.001;
    this.restSpeed = config.restSpeedThreshold ?? 0.001;
    this.initialVelocity = this.lastVelocity = config.velocity ?? 0;
    this.delay = config.delay ?? 0;
    ({ stiffness: this.stiffness, damping: this.damping, mass: this.mass } = physics(config));
  }

  protected begin(from: number, previous: Driver | null): void {
    this.startPosition = this.lastPosition = from;
    // A spring replacing a spring carries on from where the last one was going, and how fast.
    if (previous instanceof Spring) {
      this.lastPosition = previous.lastPosition;
      this.lastVelocity = this.initialVelocity = previous.lastVelocity;
      this.lastTime = previous.lastTime;
    }
    this.request((time) => {
      const start = time + this.delay;
      const wait = (t: number): void => {
        if (t < start) return this.request(wait);
        this.lastTime ??= t;
        this.step(t);
      };
      wait(time);
    });
  }

  /** `SpringAnimation.onUpdate`: the damped harmonic oscillator's closed form, at `time`. */
  private step(time: number): void {
    const last = this.lastTime!;
    const now = Math.min(time, last + MAX_STEP_MS);
    this.frameTime += (now - last) / 1000;

    const c = this.damping;
    const m = this.mass;
    const k = this.stiffness;
    const v0 = -this.initialVelocity;
    const zeta = c / (2 * Math.sqrt(k * m));
    const omega0 = Math.sqrt(k / m);
    const omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
    const x0 = this.to - this.startPosition;
    const t = this.frameTime;

    let position: number;
    let velocity: number;
    if (zeta < 1) {
      const envelope = Math.exp(-zeta * omega0 * t);
      position =
        this.to -
        envelope *
          (((v0 + zeta * omega0 * x0) / omega1) * Math.sin(omega1 * t) + x0 * Math.cos(omega1 * t));
      velocity =
        zeta *
          omega0 *
          envelope *
          ((Math.sin(omega1 * t) * (v0 + zeta * omega0 * x0)) / omega1 +
            x0 * Math.cos(omega1 * t)) -
        envelope *
          (Math.cos(omega1 * t) * (v0 + zeta * omega0 * x0) - omega1 * x0 * Math.sin(omega1 * t));
    } else {
      const envelope = Math.exp(-omega0 * t);
      position = this.to - envelope * (x0 + (v0 + omega0 * x0) * t);
      velocity = envelope * (v0 * (t * omega0 - 1) + t * x0 * (omega0 * omega0));
    }

    this.lastTime = now;
    this.lastPosition = position;
    this.lastVelocity = velocity;
    this.update(position);
    if (this.stopped) return;

    // With no stiffness there is no spring pulling towards the target, so React Native asks only
    // that the value has stopped, and leaves it where it stopped rather than snapping it there.
    const sprung = this.stiffness !== 0;
    const overshooting =
      sprung &&
      this.overshootClamping &&
      (this.startPosition < this.to ? position > this.to : position < this.to);
    const resting =
      Math.abs(velocity) <= this.restSpeed &&
      (!sprung || Math.abs(this.to - position) <= this.restDisplacement);
    if (overshooting || resting) {
      if (sprung) {
        this.lastPosition = this.to;
        this.lastVelocity = 0;
        this.update(this.to);
      }
      this.end(true);
      return;
    }
    this.request((next) => this.step(next));
  }
}

function single(value: AnimatedValue, make: () => Driver): CompositeAnimation {
  return {
    start: (callback) => value.__animate(make(), callback),
    stop: () => value.stopAnimation(),
    reset: () => value.resetAnimation(),
  };
}

function timing(value: AnimatedValue, config: TimingConfig): CompositeAnimation {
  return single(value, () => new Timing(config));
}

function spring(value: AnimatedValue, config: SpringConfig): CompositeAnimation {
  return single(value, () => new Spring(config));
}

function sequence(animations: readonly CompositeAnimation[]): CompositeAnimation {
  let current = 0;
  return {
    start(callback) {
      const onComplete = (result: EndResult): void => {
        if (!result.finished) return callback?.(result);
        current++;
        if (current === animations.length) {
          current = 0;
          return callback?.(result);
        }
        animations[current]!.start(onComplete);
      };
      if (animations.length === 0) callback?.({ finished: true });
      else animations[current]!.start(onComplete);
    },
    stop() {
      if (current < animations.length) animations[current]!.stop();
    },
    reset() {
      animations.forEach((animation, i) => i <= current && animation.reset());
      current = 0;
    },
  };
}

function parallel(
  animations: readonly CompositeAnimation[],
  config: { stopTogether?: boolean } = {},
): CompositeAnimation {
  const stopTogether = config.stopTogether ?? true;
  const ended = animations.map(() => false);
  let done = 0;
  const result: CompositeAnimation = {
    start(callback) {
      if (done === animations.length) {
        callback?.({ finished: true });
        return;
      }
      animations.forEach((animation, i) => {
        animation.start((end) => {
          ended[i] = true;
          done++;
          if (done === animations.length) {
            done = 0;
            callback?.(end);
            return;
          }
          if (!end.finished && stopTogether) result.stop();
        });
      });
    },
    stop() {
      animations.forEach((animation, i) => {
        if (!ended[i]) animation.stop();
        ended[i] = true;
      });
    },
    reset() {
      animations.forEach((animation, i) => {
        animation.reset();
        ended[i] = false;
        done = 0;
      });
    },
  };
  return result;
}

function delay(time: number): CompositeAnimation {
  return timing(new AnimatedValue(0), { toValue: 0, delay: time, duration: 0 });
}

export const Animated = {
  Value: AnimatedValue,
  Node: AnimatedNode,
  Interpolation: AnimatedInterpolation,
  timing,
  spring,
  sequence,
  parallel,
  delay,
};

/** A style's animated values swapped for what they hold now, however deep they sit. */
function resolve(value: unknown): unknown {
  if (value instanceof AnimatedNode) return value.__getValue();
  if (Array.isArray(value)) return value.map(resolve);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key in value) out[key] = resolve(value[key]);
    return out;
  }
  return value;
}

function collect(value: unknown, into: Set<AnimatedValue>): void {
  if (value instanceof AnimatedNode) for (const root of value.__roots()) into.add(root);
  else if (Array.isArray(value)) for (const item of value) collect(item, into);
  else if (isPlainObject(value)) for (const key in value) collect(value[key], into);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * `AnimatedStyle`'s graph, for a browser. Every value here is driven in JavaScript, so each
 * change is a frame the binding writes, and there is never a native view to hand a tag to.
 */
export const animationBackend: AnimationBackend = {
  props(style, onFrame): AnimatedPropsHandle {
    const roots = new Set<AnimatedValue>();
    collect(style, roots);
    return {
      attach: () => roots.forEach((root) => root.__observers.add(onFrame)),
      detach: () => roots.forEach((root) => root.__observers.delete(onFrame)),
      read: () => resolve(style) as Record<string, unknown>,
      connect: () => {},
    };
  },
};
