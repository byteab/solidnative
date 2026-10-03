import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, userEvent } from '@solidnative/testing';
import { startApp } from '../start-app.ts';

afterEach(cleanup);

async function openMotion(scheme: 'light' | 'dark' = 'light') {
  const app = await startApp({ scheme });
  await app.selectTab('motion');
  await app.until(() => app.getByTestId('animated-box'));
  return app;
}

const classesOf = (node: { instanceHandle: unknown }) =>
  (node.instanceHandle as { classes?: Set<string> }).classes;

test('the button starts and stops the @keyframes pulse', async () => {
  const app = await openMotion();
  assert.equal(classesOf(app.getByTestId('pulse'))?.has('on'), false);

  await userEvent.press(app.getByTestId('toggle-pulse'));
  assert.equal(classesOf(app.getByTestId('pulse'))?.has('on'), true);
  assert.ok(app.getByText('Stop pulsing'));

  await userEvent.press(app.getByTestId('toggle-pulse'));
  assert.equal(classesOf(app.getByTestId('pulse'))?.has('on'), false);
  assert.ok(app.getByText('Start pulsing'));
});

test('pressing the box slides and fades it on the worklet, and again brings it back', async () => {
  const app = await openMotion();
  const box = () => app.getByTestId('animated-box');
  assert.equal(box().props['opacity'], 1);

  await userEvent.press(box());
  assert.equal(box().props['opacity'], 0.4);
  assert.deepEqual(box().props['transform'], [{ translateX: 160 }]);
  assert.equal(box().props['accessibilityLabel'], 'Bring the box back');

  await userEvent.press(box());
  assert.equal(box().props['opacity'], 1);
  assert.deepEqual(box().props['transform'], [{ translateX: 0 }]);
  assert.deepEqual(app.errors, []);
});

test('the switch disables the box and sends it home', async () => {
  const app = await openMotion();
  const box = () => app.getByTestId('animated-box');
  await userEvent.press(box());

  await fireEvent(app.getByTestId('box-switch'), 'topChange', { value: false });
  assert.equal(app.getByTestId('box-switch').props['value'], false);
  assert.deepEqual(box().props['transform'], [{ translateX: 0 }]);
  assert.equal(box().props['backgroundColor'], 'rgb(154, 154, 165)');

  await userEvent.press(box());
  assert.deepEqual(box().props['transform'], [{ translateX: 0 }]);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: the motion screen follows the colour scheme`, async () => {
    const app = await openMotion(scheme);
    assert.equal(
      app.getByText('Box enabled').props['color'],
      scheme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(16, 16, 20)',
    );
  });
}
