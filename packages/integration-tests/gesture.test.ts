/**
 * A gesture bound to a view through the real native gesture backend, over the test stand-ins for
 * `react-native-gesture-handler`'s internals: attached by the view's react tag, swapped when the
 * binding changes, and dropped with the view.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Gesture } from 'react-native-gesture-handler';
import { cleanup, gestureOf, render } from '@solid-native/testing';
import { GestureHost } from './ui-gesture-fixture.tsx';

afterEach(cleanup);

describe('native gesture', () => {
  it('attaches to the react tag of the element it sits on', () => {
    const pan = Gesture.Pan();
    const app = render(GestureHost, { props: { gesture: pan } });
    app.flush();
    assert.equal(gestureOf(app.getByTestId('target')), pan);
    assert.equal(app.getByTestId('root').viewName, 'RCTView', "iOS's root is a plain view");
  });

  it('drops the old gesture when the bound one is replaced', () => {
    const pan = Gesture.Pan();
    const tap = Gesture.Tap();
    const app = render(GestureHost, { props: { gesture: pan } });
    app.flush();
    app.setProps({ gesture: tap });
    app.flush();
    assert.equal(gestureOf(app.getByTestId('target')), tap);
  });

  it('drops the gesture when the element goes away', () => {
    const app = render(GestureHost, { props: { gesture: Gesture.Pan() } });
    app.flush();
    const target = app.getByTestId('target');
    app.setProps({ shown: false });
    app.flush();
    assert.throws(() => gestureOf(target), /no gesture attached/);
  });
});
