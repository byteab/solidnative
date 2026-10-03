/**
 * React Native's `Easing`, for the browser build of `animations.ts`.
 *
 * The same functions under the same names, each the same formula as React Native's
 * `Libraries/Animated/Easing.js`, so a curve an app names eases identically on both platforms. The
 * one piece of real arithmetic, solving a cubic bezier, is the engine's own: CSS transitions
 * already need it, and two solvers would be two chances to disagree.
 */
import { bezier } from '@solid-native/fabric';

export type EasingFunction = (t: number) => number;

let ease: EasingFunction | undefined;

export const Easing = {
  step0: (n: number): number => (n > 0 ? 1 : 0),
  step1: (n: number): number => (n >= 1 ? 1 : 0),
  linear: (t: number): number => t,
  /** CSS's `ease-in`, which is what React Native calls `ease`. */
  ease: (t: number): number => (ease ??= Easing.bezier(0.42, 0, 1, 1))(t),
  quad: (t: number): number => t * t,
  cubic: (t: number): number => t * t * t,
  poly:
    (n: number): EasingFunction =>
    (t) =>
      Math.pow(t, n),
  sin: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
  circle: (t: number): number => 1 - Math.sqrt(1 - t * t),
  exp: (t: number): number => Math.pow(2, 10 * (t - 1)),
  elastic: (bounciness = 1): EasingFunction => {
    const p = bounciness * Math.PI;
    return (t) => 1 - Math.pow(Math.cos((t * Math.PI) / 2), 3) * Math.cos(t * p);
  },
  back:
    (s = 1.70158): EasingFunction =>
    (t) =>
      t * t * ((s + 1) * t - s),
  bounce: (t: number): number => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) {
      const t2 = t - 1.5 / 2.75;
      return 7.5625 * t2 * t2 + 0.75;
    }
    if (t < 2.5 / 2.75) {
      const t2 = t - 2.25 / 2.75;
      return 7.5625 * t2 * t2 + 0.9375;
    }
    const t2 = t - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  },
  bezier: (x1: number, y1: number, x2: number, y2: number): EasingFunction => {
    const points = [x1, y1, x2, y2];
    return (t) => bezier(points, t);
  },
  in: (easing: EasingFunction): EasingFunction => easing,
  out:
    (easing: EasingFunction): EasingFunction =>
    (t) =>
      1 - easing(1 - t),
  inOut:
    (easing: EasingFunction): EasingFunction =>
    (t) =>
      t < 0.5 ? easing(t * 2) / 2 : 1 - easing((1 - t) * 2) / 2,
};
