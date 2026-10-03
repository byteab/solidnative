/**
 * Keyboard avoidance: a view whose padding tracks the keyboard, driven through a fake keyboard
 * source so no device is needed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createNativeRoot } from '@solidnative/platform/solid';
import type { NativeLayoutAnimation } from '@solidnative/device';
import { createClock, createFakeFabric } from '@solidnative/testing';
import { createKeyboardFixture, type Behavior } from './ui-keyboard-fixture.tsx';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(options: Parameters<typeof createKeyboardFixture>[0]) {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  const fixture = createKeyboardFixture(options);
  root.render(fixture.View);
  const flush = async () => {
    await settle();
    clock.flushMicrotasks();
    root.flush();
  };
  const avoider = () => fabric.committed[0]!;
  return { fabric, root, avoider, emit: fixture.emit, flush };
}

describe('keyboard-avoiding-view', () => {
  it('insets by the keyboard height, less the caller offset', async () => {
    const app = mount({ shape: 'offset' });
    await app.flush();
    assert.equal(app.avoider().props['paddingBottom'], undefined, 'no inset while hidden');

    app.emit({ height: 300 });
    await app.flush();
    // 300 tall, minus the fixture's keyboardVerticalOffset of 20.
    assert.equal(app.avoider().props['paddingBottom'], 280);

    app.emit({ height: 0 });
    await app.flush();
    assert.equal(app.avoider().props['paddingBottom'], null, 'inset removed, not stale');
    app.root.dispose();
  });

  it('configures a layout animation with the keyboard event before the inset commits', async () => {
    // RN's own KeyboardAvoidingView calls LayoutAnimation.configureNext with the keyboard
    // event's duration and easing, right before the state change that moves the view, so the
    // adjustment eases in alongside the keyboard rather than landing in one step.
    let paddingWhenConfigured: unknown;
    const state = { configured: null as object | null };
    const layout: NativeLayoutAnimation = {
      configureNext(config) {
        state.configured = config;
        paddingWhenConfigured = app.avoider().props['paddingBottom'];
      },
    };
    const app = mount({ shape: 'offset', layout });
    await app.flush();

    app.emit({ height: 300, duration: 250, easing: 'easeOut' });
    await app.flush();

    assert.ok(state.configured, 'the layout animation was configured');
    const configured = state.configured as { duration: number; update: { type: string } };
    assert.equal(configured.duration, 250);
    assert.equal(configured.update.type, 'easeOut');
    assert.equal(paddingWhenConfigured, undefined, 'configured before the new inset committed');
    assert.equal(app.avoider().props['paddingBottom'], 280, 'and the inset still lands');
    app.root.dispose();
  });

  it("moves on the keyboard's own curve, which is what iOS reports", async () => {
    // UIKit animates its keyboard on a private curve, and RN names it 'keyboard'. Left out, the
    // view eases on a different curve from the keyboard it is meant to be moving with.
    const configured: { update: { type: string } }[] = [];
    const layout: NativeLayoutAnimation = {
      configureNext: (config) => configured.push(config as { update: { type: string } }),
    };
    const app = mount({ shape: 'offset', layout });
    await app.flush();

    app.emit({ height: 300, duration: 250, easing: 'keyboard' });
    await app.flush();
    // And back down with it: iOS reports the hide's timing too.
    app.emit({ height: 0, duration: 250, easing: 'keyboard' });
    await app.flush();

    assert.deepEqual(
      configured.map((config) => config.update.type),
      ['keyboard', 'keyboard'],
    );
    app.root.dispose();
  });

  it('does not configure a layout animation when the keyboard reports no duration', async () => {
    // Android's own keyboard event always has duration 0 - the platform animates the keyboard
    // itself, and nothing here should ask native to animate an update it never asked to run.
    const order: string[] = [];
    const layout: NativeLayoutAnimation = { configureNext: () => order.push('configure') };
    const app = mount({ shape: 'offset', layout });
    await app.flush();

    app.emit({ height: 300, duration: 0, easing: 'keyboard' });
    await app.flush();

    assert.deepEqual(order, []);
    assert.equal(app.avoider().props['paddingBottom'], 280);
    app.root.dispose();
  });
});

/**
 * A keyboard-avoiding view on a screen under a navigation bar, which is where an editor lives.
 * `(layout)` puts its top at zero, in the screen's coordinates; the window has it a bar's height
 * down, and the keyboard's `screenY` is in the window's.
 */
describe('keyboard-avoiding-view under a navigation bar', () => {
  /*
   * These read the window-measured frame. The view's own `onLayout` writes the frame signal its
   * binding reads; a listener ran under that binding's effect, so the re-run cancelled the measure
   * it had just requested. Listeners now run under the node's own owner.
   */

  /** iPhone 17 Pro: an 874 point window, a 116 point bar, and a keyboard 335 tall. */
  async function open(behavior: 'padding' | 'height', frame = { y: 116, height: 758 }) {
    const app = mount({ shape: 'editor', behavior });
    await app.flush();
    app.fabric.frames.set('avoider', { x: 0, width: 402, ...frame });
    app.fabric.emit(app.avoider(), 'topLayout', {
      layout: { x: 0, y: 0, width: 402, height: frame.height },
    });
    await app.flush();
    return app;
  }

  it('pads by the whole overlap, measured in the window, not by less a bar height', async () => {
    const app = await open('padding');
    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    // The view's bottom is at 116 + 758 = 874, the keyboard's top at 539.
    assert.equal(app.avoider().props['paddingBottom'], 335);
    const [body, bar] = app.avoider().children;
    assert.equal(body!.viewName, 'ScrollView', 'the body is still there to shrink');
    assert.equal(bar!.props['height'], 44, 'and the bar is still there to sit on the keyboard');
    app.root.dispose();
  });

  it('shrinks by the whole overlap in height mode', async () => {
    const app = await open('height');
    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    assert.equal(app.avoider().props['height'], 758 - 335);
    assert.equal(app.avoider().props['flex'], 0);
    app.root.dispose();
  });

  it('never pads a view by more than its own height', async () => {
    // A short view low on the screen: the keyboard covers all of it and then some.
    const app = await open('padding', { y: 780, height: 94 });
    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    assert.equal(app.avoider().props['paddingBottom'], 94);
    app.root.dispose();
  });

  it("falls back to the layout's own frame where the window cannot be measured", async () => {
    const app = await open('padding');
    app.fabric.frames.clear();
    app.fabric.emit(app.avoider(), 'topLayout', {
      layout: { x: 0, y: 0, width: 402, height: 758 },
    });
    await app.flush();

    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    // What RN computes: the frame's top taken as the window's.
    assert.equal(app.avoider().props['paddingBottom'], 758 - 539);
    app.root.dispose();
  });
});

/**
 * RN composes the adjustment over the caller's style, so it wins: a view told `flex: 1` still
 * gets its `flex: 0` in height mode, and a bound padding still gives way to the keyboard's. The
 * caller's other properties stay where they were.
 */
describe('keyboard-avoiding-view over a style of its own', () => {
  async function open(behavior: Behavior) {
    const app = mount({ shape: 'styled', behavior });
    await app.flush();
    app.fabric.frames.set('avoider', { x: 0, y: 0, width: 402, height: 874 });
    app.fabric.emit(app.avoider(), 'topLayout', {
      layout: { x: 0, y: 0, width: 402, height: 874 },
    });
    await app.flush();
    return app;
  }

  it('pads by the overlap over a bound and a class padding', async () => {
    const app = await open('padding');
    assert.equal(app.avoider().props['paddingBottom'], 12, "the caller's own padding at rest");

    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    assert.equal(app.avoider().props['paddingBottom'], 335);
    assert.equal(app.avoider().props['flex'], 1, "the caller's flex is left alone");
    assert.equal(app.avoider().props['borderTopWidth'], 2, "and so is the class's border");

    app.emit({ height: 0 });
    await app.flush();
    assert.equal(app.avoider().props['paddingBottom'], 12, "the caller's padding back once hidden");
    app.root.dispose();
  });

  it('shrinks with flex 0 in height mode over a bound flex 1', async () => {
    const app = await open('height');
    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    assert.equal(app.avoider().props['height'], 874 - 335);
    assert.equal(app.avoider().props['flex'], 0);
    assert.equal(
      app.avoider().props['paddingBottom'],
      12,
      'height mode leaves padding to the caller',
    );
    assert.ok(app.avoider().props['backgroundColor'], "the caller's colour still applies");

    app.emit({ height: 0 });
    await app.flush();
    assert.equal(app.avoider().props['flex'], 1, "the caller's flex back once hidden");
    assert.equal(app.avoider().props['height'], 900);
    app.root.dispose();
  });

  it('moves the content by the overlap over its own bottom in position mode', async () => {
    const app = await open('position');
    app.emit({ height: 335, screenY: 539 });
    await app.flush();

    const content = app.avoider().children[0]!;
    assert.equal(content.props['bottom'], 335);
    assert.equal(content.props['flex'], 1, "the content container's other styles still apply");
    assert.equal(app.avoider().props['paddingBottom'], 12, 'the outer view is left as it was');
    assert.equal(app.avoider().props['flex'], 1);
    app.root.dispose();
  });
});
