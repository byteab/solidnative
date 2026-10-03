/**
 * What a test gets for `react-native-worklets`, whose source Node cannot load. There is one
 * runtime in a test, so scheduling a function on either runtime calls it at once.
 */
export function scheduleOnRN<A extends unknown[]>(fn: (...args: A) => unknown, ...args: A): void {
  fn(...args);
}

export function scheduleOnUI<A extends unknown[]>(fn: (...args: A) => unknown, ...args: A): void {
  fn(...args);
}

export function runOnUISync<A extends unknown[], R>(fn: (...args: A) => R, ...args: A): R {
  return fn(...args);
}

export function runOnJS<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return fn;
}

export function runOnUI<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return fn;
}

export function isWorkletFunction(_value: unknown): boolean {
  return false;
}
