/** @jsxImportSource @solid-native/platform/solid */
// An image referenced the React Native way, `require('./logo.png')`, which Metro turns into an
// asset id. An ES module under Node has no `require`, so the register stands in `{ testUri }`, as
// React Native's Jest preset does, rather than let the module throw as it is evaluated.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Image } from '@solid-native/components';
import { render, screen } from '@solid-native/testing';

const logo = require('./assets/logo.png');

test('a required image renders, with the path it was required by', () => {
  render(() => <Image testID="logo" source={logo} />);
  assert.deepEqual(logo, { testUri: './assets/logo.png' });
  assert.ok(screen.getByTestId('logo'));
});
