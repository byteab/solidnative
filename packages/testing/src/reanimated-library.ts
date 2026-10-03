/**
 * What a test gets for `react-native-reanimated`, whose source Node cannot load.
 *
 * An animation finishes the moment it is assigned: `withTiming(100)` is `100`, and its callback
 * is called with `true` at once, so a test sees where an animation ends and what ends it does.
 * `interpolate` and `Extrapolation` are the library's own arithmetic; `Easing` curves are the
 * identity, since nothing in a test is between its ends.
 *
 * ponytail: the functions apps call from components, not the React hooks; add one when an app
 * under test imports it.
 */

/** A value both runtimes can see; here there is one runtime, so it is a value with listeners. */
export interface SharedValue<T = number> {
  value: T;
  get(): T;
  set(value: T | ((current: T) => T)): void;
  addListener(id: number, listener: (value: T) => void): void;
  removeListener(id: number): void;
}

type Done = ((finished?: boolean) => void) | undefined;

const settle = <T>(to: T, callback: Done): T => {
  callback?.(true);
  return to;
};

export function makeMutable<T>(initial: T): SharedValue<T> {
  let current = initial;
  const listeners = new Map<number, (value: T) => void>();
  const write = (next: T) => {
    current = next;
    for (const listener of [...listeners.values()]) listener(next);
  };
  return {
    get value() {
      return current;
    },
    set value(next: T) {
      write(next);
    },
    get: () => current,
    set: (next) => write(typeof next === 'function' ? (next as (current: T) => T)(current) : next),
    addListener: (id, listener) => void listeners.set(id, listener),
    removeListener: (id) => void listeners.delete(id),
  };
}

export function withTiming<T>(to: T, _config?: object, callback?: Done): T {
  return settle(to, callback);
}

export function withSpring<T>(to: T, _config?: object, callback?: Done): T {
  return settle(to, callback);
}

export function withDecay(_config: { velocity?: number }, callback?: Done): number {
  return settle(0, callback);
}

export function withDelay<T>(_delay: number, animation: T): T {
  return animation;
}

export function withSequence<T>(...animations: T[]): T {
  return animations[animations.length - 1]!;
}

export function withRepeat<T>(
  animation: T,
  _times?: number,
  _reverse?: boolean,
  callback?: Done,
): T {
  return settle(animation, callback);
}

export function cancelAnimation(_value: unknown): void {}

const mappers = new Map<number, readonly SharedValue<unknown>[]>();
let nextMapper = 0;

/**
 * What `@solidnative/components/reanimated` starts a worklet style with: run now, and again whenever
 * a shared value it was given changes, as the UI runtime's mapper does.
 */
export function startMapper(worklet: () => void, inputs: unknown[] = []): number {
  const id = ++nextMapper;
  const values = inputs.filter(
    (input): input is SharedValue<unknown> =>
      typeof (input as SharedValue<unknown> | null)?.addListener === 'function',
  );
  mappers.set(id, values);
  for (const value of values) value.addListener(id, () => worklet());
  worklet();
  return id;
}

export function stopMapper(id: number): void {
  for (const value of mappers.get(id) ?? []) value.removeListener(id);
  mappers.delete(id);
}

export const Extrapolation = { IDENTITY: 'identity', CLAMP: 'clamp', EXTEND: 'extend' } as const;
type Extrapolate = (typeof Extrapolation)[keyof typeof Extrapolation];

/** Past an end of the input range: the end's output, the input itself, or `undefined` to extend. */
function beyond(x: number, output: number, how: Extrapolate | undefined): number | undefined {
  if (how === 'clamp') return output;
  if (how === 'identity') return x;
  return undefined;
}

export function interpolate(
  x: number,
  input: readonly number[],
  output: readonly number[],
  extrapolate?: Extrapolate | { extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate },
): number {
  const left = typeof extrapolate === 'object' ? extrapolate.extrapolateLeft : extrapolate;
  const right = typeof extrapolate === 'object' ? extrapolate.extrapolateRight : extrapolate;
  const last = input.length - 1;
  const outside =
    x < input[0]!
      ? beyond(x, output[0]!, left)
      : x > input[last]!
        ? beyond(x, output[last]!, right)
        : undefined;
  if (outside !== undefined) return outside;
  let i = 0;
  while (i < last - 1 && x > input[i + 1]!) i++;
  const [a, b, p, q] = [input[i]!, input[i + 1]!, output[i]!, output[i + 1]!];
  return b === a ? p : p + ((x - a) / (b - a)) * (q - p);
}

const identity = (t: number) => t;
const curve = () => identity;
export const Easing = {
  linear: identity,
  ease: identity,
  quad: identity,
  cubic: identity,
  sin: identity,
  circle: identity,
  exp: identity,
  bounce: identity,
  poly: curve,
  elastic: curve,
  back: curve,
  bezier: curve,
  bezierFn: curve,
  in: (easing: (t: number) => number) => easing,
  out: (easing: (t: number) => number) => easing,
  inOut: (easing: (t: number) => number) => easing,
};

export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' } as const;

export function runOnJS<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return fn;
}

export function runOnUI<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return fn;
}
