/**
 * The one framework-neutral rule of native tabs: an icon pair native cannot express is refused.
 *
 * The tabs outlet itself is covered by `packages/router/solid-tests/g5-router-shell` and
 * `g17-root-tabs`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tabIconProps } from '@solidnative/router';

describe('a tab icon pair', () => {
  it('refuses an icon pair native cannot express, rather than dropping half of it', () => {
    // One `iconType` serves both states, so native keeps the unselected icon and says nothing.
    assert.throws(
      () => tabIconProps({ iconType: 'template' }, { iconType: 'sfSymbol' }),
      /same kind/,
    );
    assert.throws(() => tabIconProps({}, { iconType: 'sfSymbol' }), /no icon to select from/);
    assert.doesNotThrow(() => tabIconProps({ iconType: 'sfSymbol' }, {}));
  });

  it('carries the selected half under the names native reads it through', () => {
    assert.deepEqual(
      tabIconProps(
        { iconType: 'template', iconImageSource: { uri: '42' } },
        { iconType: 'template', iconImageSource: { uri: '43' } },
      ),
      {
        iconType: 'template',
        iconImageSource: { uri: '42' },
        selectedIconResourceName: undefined,
        selectedIconImageSource: { uri: '43' },
        selectedDrawableIconResourceName: undefined,
        selectedImageIconResource: undefined,
      },
    );
  });
});
