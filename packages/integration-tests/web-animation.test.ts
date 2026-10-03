/**
 * The animation graph a browser build gets in place of React Native's.
 *
 * `@solid-native/components/animations` hands a device React Native's own `Animated`, and a
 * browser this one, so the same component animates on both. What has to hold is that the numbers
 * agree: a timing curve lands where React Native's lands at the same moment, a spring settles the
 * way the same spring settles there, and an interpolation maps a value through the same ranges.
 * Each expected value below is React Native's own formula worked by hand, not this code's output
 * written down.
 *
 * Frames are driven by hand, with a timestamp each, so nothing here depends on a real clock.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Animated, animationBackend } from '../components/src/animated.ts';
import { Easing } from '../components/src/easing.ts';

const global = globalThis as {
  requestAnimationFrame?: (cb: (time: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
};

let queue = new Map<number, (time: number) => void>();
let next = 1;
let clock = 0;

/** Runs every frame that was asked for, `ms` after the last, and whatever those ask for waits. */
function frame(ms = 16): void {
  clock += ms;
  const due = queue;
  queue = new Map();
  for (const cb of due.values()) cb(clock);
}

/** Frames until nothing is waiting for one, with a limit so a spring that never rests fails. */
function run(ms = 16, limit = 1000): number {
  let frames = 0;
  while (queue.size > 0) {
    if (++frames > limit) throw new Error('still animating');
    frame(ms);
  }
  return frames;
}

beforeEach(() => {
  queue = new Map();
  clock = 1000;
  global.requestAnimationFrame = (cb) => {
    queue.set(next, cb);
    return next++;
  };
  global.cancelAnimationFrame = (id) => queue.delete(id);
});

afterEach(() => {
  delete global.requestAnimationFrame;
  delete global.cancelAnimationFrame;
});

describe('Easing', () => {
  it("matches React Native's curves at the points that tell them apart", () => {
    assert.equal(Easing.linear(0.3), 0.3);
    assert.equal(Easing.quad(0.5), 0.25);
    assert.equal(Easing.cubic(0.5), 0.125);
    assert.equal(Easing.poly(4)(0.5), 0.0625);
    assert.ok(Math.abs(Easing.sin(0.5) - (1 - Math.cos(Math.PI / 4))) < 1e-12);
    assert.ok(Math.abs(Easing.circle(0.5) - (1 - Math.sqrt(0.75))) < 1e-12);
    assert.equal(Easing.exp(1), 1);
    assert.equal(Easing.bounce(1), 1);
    assert.ok(Math.abs(Easing.bounce(0.5) - (7.5625 * (0.5 - 1.5 / 2.75) ** 2 + 0.75)) < 1e-12);
    assert.ok(Easing.back()(0.2) < 0, 'back pulls behind the start');
    assert.equal(Easing.elastic()(1), 1);
    assert.equal(Easing.step0(0), 0);
    assert.equal(Easing.step0(0.01), 1);
    assert.equal(Easing.step1(0.99), 0);
    assert.equal(Easing.step1(1), 1);
  });

  it('bounces with the first arc React Native draws', () => {
    assert.equal(Math.round(Easing.bounce(0.2) * 1e4) / 1e4, 0.3025);
  });

  it('composes in, out and inOut as React Native does', () => {
    assert.equal(Easing.in(Easing.quad)(0.5), 0.25);
    assert.equal(Easing.out(Easing.quad)(0.5), 0.75);
    assert.equal(Easing.inOut(Easing.quad)(0.25), 0.125);
    assert.equal(Easing.inOut(Easing.quad)(0.75), 0.875);
  });

  it('solves a bezier, with ease as the one React Native names', () => {
    const ease = Easing.bezier(0.42, 0, 1, 1);
    assert.equal(Easing.ease(0.5), ease(0.5));
    assert.ok(ease(0.5) > 0.3 && ease(0.5) < 0.33, `ease-in at the midpoint, got ${ease(0.5)}`);
    assert.equal(Easing.bezier(0, 0, 1, 1)(0.4), 0.4);
  });
});

describe('Animated.Value', () => {
  it('holds a value, an offset on top, and tells its listeners when the value moves', () => {
    const value = new Animated.Value(2);
    const heard: number[] = [];
    const id = value.addListener(({ value }) => heard.push(value));
    value.setValue(5);
    value.setOffset(10);
    assert.equal(value.__getValue(), 15);
    value.flattenOffset();
    assert.equal(value.__getValue(), 15);
    value.removeListener(id);
    value.setValue(0);
    // An offset moves nothing by itself in React Native either; only the value reports.
    assert.deepEqual(heard, [5]);
  });
});

describe('Animated.Value offsets and resets', () => {
  it('moves the value into the offset with extractOffset, keeping what it reads', () => {
    const value = new Animated.Value(0);
    value.setValue(5);
    value.setOffset(2);
    value.extractOffset();
    assert.equal(value.__getValue(), 7);
    value.setValue(1);
    assert.equal(value.__getValue(), 8, 'the next value adds to the extracted offset');
  });

  it('tells a listener the value with its offset, as React Native does', () => {
    const value = new Animated.Value(0);
    value.setOffset(10);
    const heard: number[] = [];
    value.addListener(({ value }) => heard.push(value));
    value.setValue(1);
    assert.deepEqual(heard, [11]);
  });

  it('goes back to the value it started with on resetAnimation', () => {
    const value = new Animated.Value(3);
    Animated.timing(value, { toValue: 10, duration: 100, useNativeDriver: false }).start();
    frame();
    frame(50);
    value.resetAnimation();
    assert.equal(value.__getValue(), 3);
  });
});

describe('Animated.timing', () => {
  it('follows its easing over its duration, and ends exactly on the target', () => {
    const value = new Animated.Value(0);
    let ended: { finished: boolean } | null = null;
    Animated.timing(value, {
      toValue: 100,
      duration: 160,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start((result) => (ended = result));

    frame(); // The first frame starts the clock, at the start value.
    assert.equal(value.__getValue(), 0);
    frame(80);
    assert.equal(value.__getValue(), 50);
    frame(40);
    assert.equal(value.__getValue(), 75);
    frame(100);
    assert.equal(value.__getValue(), 100);
    assert.deepEqual(ended, { finished: true });
    assert.equal(queue.size, 0, 'and asks for no more frames');
  });

  it("defaults to React Native's 500ms ease-in-out", () => {
    const value = new Animated.Value(0);
    Animated.timing(value, { toValue: 1, useNativeDriver: true }).start();
    frame();
    frame(125);
    assert.equal(value.__getValue(), Easing.inOut(Easing.ease)(0.25));
    frame(375);
    assert.equal(value.__getValue(), 1);
  });

  it('waits out a delay before it moves', () => {
    const value = new Animated.Value(0);
    Animated.timing(value, {
      toValue: 1,
      duration: 100,
      delay: 200,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    frame();
    frame(150);
    assert.equal(value.__getValue(), 0);
    frame(100); // 50ms into the animation proper.
    assert.equal(value.__getValue(), 0.5);
  });

  it('stops where it is, unfinished, when stopped or replaced', () => {
    const value = new Animated.Value(0);
    const results: boolean[] = [];
    const first = Animated.timing(value, {
      toValue: 1,
      duration: 100,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    first.start(({ finished }) => results.push(finished));
    frame();
    frame(50);
    Animated.timing(value, { toValue: 0, duration: 100, useNativeDriver: false }).start(
      ({ finished }) => results.push(finished),
    );
    assert.deepEqual(results, [false], 'a new animation stops the one before it');
    assert.equal(value.__getValue(), 0.5);
    value.stopAnimation();
    assert.deepEqual(results, [false, false]);
    assert.equal(queue.size, 0);
  });

  it('lets setValue interrupt it', () => {
    const value = new Animated.Value(0);
    let finished: boolean | undefined;
    Animated.timing(value, { toValue: 1, useNativeDriver: false }).start(
      (r) => (finished = r.finished),
    );
    frame();
    value.setValue(0.9);
    assert.equal(finished, false);
    run();
    assert.equal(value.__getValue(), 0.9);
  });
});

describe('Animated.spring', () => {
  it('overshoots with its default tension and friction, then rests exactly on the target', () => {
    const value = new Animated.Value(0);
    let peak = 0;
    value.addListener(({ value }) => (peak = Math.max(peak, value)));
    let ended: { finished: boolean } | null = null;
    Animated.spring(value, { toValue: 1, useNativeDriver: false }).start((r) => (ended = r));
    run();
    assert.ok(peak > 1, `an under-damped spring passes its target, peaked at ${peak}`);
    assert.equal(value.__getValue(), 1);
    assert.deepEqual(ended, { finished: true });
  });

  it("uses React Native's default tension of 40 and friction of 7", () => {
    const plain = new Animated.Value(0);
    const explicit = new Animated.Value(0);
    Animated.spring(plain, { toValue: 1, useNativeDriver: false }).start();
    Animated.spring(explicit, {
      toValue: 1,
      tension: 40,
      friction: 7,
      useNativeDriver: false,
    }).start();
    for (let i = 0; i < 6; i++) frame();
    assert.equal(plain.__getValue(), explicit.__getValue());
  });

  it('carries its velocity into a spring that replaces it mid-flight', () => {
    const value = new Animated.Value(0);
    const spring = (toValue: number) =>
      Animated.spring(value, { toValue, stiffness: 100, damping: 20, useNativeDriver: false });
    spring(1).start();
    for (let i = 0; i < 4; i++) frame();
    const at = value.__getValue();
    // Sent back towards 0 while it is moving up: momentum carries it on before it turns.
    spring(0).start();
    frame();
    assert.ok(value.__getValue() > at, 'still moving up, as a thrown object would');
  });

  it("lands where React Native's closed form puts it", () => {
    // stiffness 100, damping 10, mass 1: zeta 0.5, omega0 10, omega1 10 * sqrt(0.75).
    const value = new Animated.Value(0);
    Animated.spring(value, {
      toValue: 1,
      stiffness: 100,
      damping: 10,
      mass: 1,
      useNativeDriver: false,
    }).start();
    frame(); // No time has passed yet.
    frame(16);
    frame(16);
    const t = 0.032;
    const omega1 = 10 * Math.sqrt(0.75);
    const expected =
      1 - Math.exp(-0.5 * 10 * t) * ((5 / omega1) * Math.sin(omega1 * t) + Math.cos(omega1 * t));
    assert.ok(Math.abs(value.__getValue() - expected) < 1e-9, `${value.__getValue()} ${expected}`);
  });

  it('ends the moment it passes the target with overshootClamping, never swinging back', () => {
    const value = new Animated.Value(0);
    const seen: number[] = [];
    value.addListener(({ value }) => seen.push(value));
    Animated.spring(value, {
      toValue: 1,
      overshootClamping: true,
      useNativeDriver: false,
    }).start();
    run();
    // React Native reports the frame that crossed, then snaps to the target and stops.
    const approach = seen.slice(0, -2);
    assert.ok(
      approach.every((v, i) => v <= 1 && (i === 0 || v >= approach[i - 1]!)),
      'straight at the target until then',
    );
    assert.ok(seen.at(-2)! > 1);
    assert.equal(seen.at(-1), 1);
  });

  it('accepts bounciness and speed, as React Native converts them', () => {
    const value = new Animated.Value(0);
    Animated.spring(value, {
      toValue: 1,
      bounciness: 0,
      speed: 20,
      useNativeDriver: false,
    }).start();
    run();
    assert.equal(value.__getValue(), 1);
  });

  it('rests on its speed alone with no stiffness, where it is, as React Native does', () => {
    // With no spring there is no target to be near: React Native counts displacement as met and
    // leaves the value where it came to rest rather than snapping it to `toValue`.
    const value = new Animated.Value(0);
    let ended: { finished: boolean } | null = null;
    Animated.spring(value, {
      toValue: 1,
      stiffness: 0,
      damping: 10,
      useNativeDriver: false,
    }).start((r) => (ended = r));
    run();
    assert.equal(value.__getValue(), 0);
    assert.deepEqual(ended, { finished: true });
  });

  it('catches up at most 64ms per frame after a stall, rather than jumping to the end', () => {
    const value = new Animated.Value(0);
    Animated.spring(value, {
      toValue: 1,
      stiffness: 100,
      damping: 20,
      useNativeDriver: false,
    }).start();
    frame();
    frame(5000);
    assert.ok(
      value.__getValue() < 1,
      `still moving after a five-second stall, at ${value.__getValue()}`,
    );
  });
});

describe('composition', () => {
  const linear = (value: InstanceType<typeof Animated.Value>, toValue: number) =>
    Animated.timing(value, {
      toValue,
      duration: 100,
      easing: Easing.linear,
      useNativeDriver: false,
    });

  it('runs a sequence one after another, and a parallel all at once', () => {
    const a = new Animated.Value(0);
    const b = new Animated.Value(0);
    let done = false;
    Animated.sequence([
      linear(a, 1),
      Animated.delay(100),
      Animated.parallel([linear(a, 0), linear(b, 1)]),
    ]).start(({ finished }) => (done = finished));
    frame();
    frame(100);
    assert.equal(a.__getValue(), 1);
    assert.equal(b.__getValue(), 0);
    run(50);
    assert.equal(a.__getValue(), 0);
    assert.equal(b.__getValue(), 1);
    assert.equal(done, true);
  });

  it('starts a sequence from its first member again when it is run a second time', () => {
    const a = new Animated.Value(0);
    const both = Animated.sequence([linear(a, 1), linear(a, 0)]);
    both.start();
    run(50);
    assert.equal(a.__getValue(), 0);
    both.start();
    frame();
    frame(50);
    assert.equal(a.__getValue(), 0.5, 'on its way up again');
  });

  it('ends a stopped sequence unfinished, without starting what came next', () => {
    const a = new Animated.Value(0);
    const b = new Animated.Value(0);
    let finished: boolean | undefined;
    const both = Animated.sequence([linear(a, 1), linear(b, 1)]);
    both.start((r) => (finished = r.finished));
    frame();
    frame(50);
    both.stop();
    run(50);
    assert.equal(finished, false);
    assert.equal(b.__getValue(), 0);
  });

  it('stops the rest of a parallel when one member is stopped on its own', () => {
    const a = new Animated.Value(0);
    const b = new Animated.Value(0);
    const first = linear(a, 1);
    Animated.parallel([first, linear(b, 1)]).start();
    frame();
    frame(50);
    first.stop();
    run(50);
    assert.equal(b.__getValue(), 0.5, 'stopped together, where it was');
  });

  it('runs a parallel again when it is started a second time', () => {
    const a = new Animated.Value(0);
    const both = Animated.parallel([linear(a, 1)]);
    both.start();
    run(50);
    a.setValue(0);
    let again = false;
    both.start(() => (again = true));
    frame();
    frame(50);
    assert.equal(a.__getValue(), 0.5);
    run(50);
    assert.equal(again, true);
  });

  it('waits out a delay before the next member of a sequence', () => {
    const a = new Animated.Value(0);
    Animated.sequence([Animated.delay(100), linear(a, 1)]).start();
    frame();
    frame(50);
    assert.equal(a.__getValue(), 0);
  });

  it('stops every member of a parallel when it is stopped', () => {
    const a = new Animated.Value(0);
    const b = new Animated.Value(0);
    let finished: boolean | undefined;
    const both = Animated.parallel([linear(a, 1), linear(b, 1)]);
    both.start((r) => (finished = r.finished));
    frame();
    frame(50);
    both.stop();
    assert.equal(finished, false);
    assert.equal(queue.size, 0);
    assert.equal(a.__getValue(), 0.5);
  });
});

describe('interpolate', () => {
  it('maps through every segment of its ranges, extending past them by default', () => {
    const value = new Animated.Value(0);
    const mapped = value.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 10, 0] });
    value.setValue(0.5);
    assert.equal(mapped.__getValue(), 5);
    value.setValue(1.5);
    assert.equal(mapped.__getValue(), 5);
    value.setValue(3);
    assert.equal(mapped.__getValue(), -10);
  });

  it('clamps when told to, on either side', () => {
    const value = new Animated.Value(-1);
    const mapped = value.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 100],
      extrapolateLeft: 'clamp',
      extrapolate: 'extend',
    });
    assert.equal(mapped.__getValue(), 0);
    value.setValue(2);
    assert.equal(mapped.__getValue(), 200);
    const identity = value.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 100],
      extrapolate: 'identity',
    });
    assert.equal(identity.__getValue(), 2);
  });

  it('eases within a segment, and chains', () => {
    const value = new Animated.Value(0.5);
    const eased = value.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      easing: Easing.quad,
    });
    assert.equal(eased.__getValue(), 0.25);
    assert.equal(eased.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }).__getValue(), 1);
  });

  it('interpolates angles, percentages and colours, the strings a style carries', () => {
    const value = new Animated.Value(0.5);
    assert.equal(
      value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }).__getValue(),
      '180deg',
    );
    assert.equal(
      value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] }).__getValue(),
      '25%',
    );
    assert.equal(
      value
        .interpolate({ inputRange: [0, 1], outputRange: ['rgb(0, 0, 0)', 'rgb(200, 100, 0)'] })
        .__getValue(),
      'rgba(100, 50, 0, 1)',
    );
  });
});

describe('the backend [animatedStyle] reads through', () => {
  it('flattens animated values in a style, transforms included, and reports each change', () => {
    const opacity = new Animated.Value(1);
    const slide = new Animated.Value(0);
    let frames = 0;
    const handle = animationBackend.props(
      {
        opacity,
        transform: [
          { translateY: slide },
          { rotate: slide.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
        ],
        flex: 1,
      },
      () => frames++,
    );
    handle.attach();
    assert.deepEqual(handle.read(), {
      opacity: 1,
      transform: [{ translateY: 0 }, { rotate: '0deg' }],
      flex: 1,
    });

    slide.setValue(1);
    opacity.setValue(0.5);
    assert.equal(frames, 2);
    assert.deepEqual(handle.read(), {
      opacity: 0.5,
      transform: [{ translateY: 1 }, { rotate: '90deg' }],
      flex: 1,
    });

    handle.connect(7); // Nothing to hand over in a browser; it must simply not throw.
    handle.detach();
    opacity.setValue(0);
    assert.equal(frames, 2, 'nothing after detach');
  });
});
