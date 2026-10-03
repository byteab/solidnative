/**
 * Numbers, into CSS values that a browser will actually accept.
 *
 * React Native styles are unitless - `top: 116` is 116 points and Yoga wants nothing more. CSS is
 * not, and `top: 116` is not a length: the browser rejects the declaration and silently keeps
 * whatever was there. Every numeric `[style]` binding in the library was being dropped that way.
 *
 * It hid behind the one property that really is valid unitless, and which happens to be bound
 * right beside the others. A popover writes `{ top, left, opacity }` in one object; `opacity: 1`
 * applied, so the card appeared exactly on time, in the corner of the screen. That reads as a
 * positioning bug, and it took opening the page and reading the element's inline style to see
 * that `top` had simply never been set.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssValue } from './css-units.ts';

describe('a style value on its way to the DOM', () => {
  it('gives a length its units', () => {
    assert.equal(cssValue('top', 116), '116px');
    assert.equal(cssValue('height', 42.5), '42.5px');
  });

  it('leaves a genuinely unitless property alone', () => {
    // The one that masked the bug, and the ones that would have been broken the other way round:
    // `opacity: 1px` and `z-index: 3px` are as invalid as `top: 116`.
    assert.equal(cssValue('opacity', 1), '1');
    assert.equal(cssValue('z-index', 3), '3');
    assert.equal(cssValue('flex-grow', 2), '2');
    assert.equal(cssValue('aspect-ratio', 1.5), '1.5');
  });

  it('treats line-height as a length, which is where the two style languages disagree', () => {
    // Unitless in CSS, where a bare number multiplies the font size, and points in React Native,
    // where `lineHeight: 24` is 24. Following CSS here would turn every line height in the
    // library into a multiplier - a 16px font with `lineHeight: 24` would lay out at 384px.
    assert.equal(cssValue('line-height', 24), '24px');
  });

  it('passes a string through untouched, units and keywords alike', () => {
    assert.equal(cssValue('width', '100%'), '100%');
    assert.equal(cssValue('top', '50vh'), '50vh');
    assert.equal(cssValue('position', 'absolute'), 'absolute');
  });

  it('gives zero units too, rather than keeping a second rule for it', () => {
    assert.equal(cssValue('top', 0), '0px');
  });

  it('turns a React Native transform list into a CSS transform', () => {
    assert.equal(
      cssValue('transform', [
        { translateX: 4 },
        { translateY: -2 },
        { scaleX: 2 },
        { rotate: '90deg' },
        { skewX: '10deg' },
        { perspective: 800 },
      ]),
      'translateX(4px) translateY(-2px) scaleX(2) rotate(90deg) skewX(10deg) perspective(800px)',
    );
    assert.equal(
      cssValue('transform', [{ matrix: [1, 0, 0, 1, 5, 6] }]),
      'matrix(1, 0, 0, 1, 5, 6)',
    );
    assert.equal(cssValue('transform', []), 'none');
  });
});

describe('a sixteen-value matrix', () => {
  it('is written as matrix3d, which is the only function that takes sixteen', () => {
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 0, 1];
    assert.equal(cssValue('transform', [{ matrix }]), `matrix3d(${matrix.join(', ')})`);
  });
});
