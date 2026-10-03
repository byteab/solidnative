/**
 * `ui-form.test.ts`'s date picker on Android, in a file of its own because a process that has
 * rendered Android components stays Android.
 */
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { registerPlatformComponents } from '@solidnative/fabric';
import { registerExpoUiViews } from '@solidnative/expo';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createFakeFabric, type FakeFabricNode as FakeNode } from '@solidnative/testing';
import { expoUiFormFixture } from './expo-ui-form-fixture.tsx';

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('a date picker in a form, on Android', () => {
  after(() => {
    registerPlatformComponents('ios');
    registerExpoUiViews('ios');
  });

  it('speaks Compose s dialect: milliseconds in, and its own event out', () => {
    registerPlatformComponents('android');
    registerExpoUiViews('android');
    const form = expoUiFormFixture();
    const fabric = createFakeFabric();
    const root = createNativeRoot({ fabric, rootTag: 1 });
    root.render(form.View);
    const date = flatten(fabric.committed).find((node) => node.props['nativeID'] === 'date')!;
    assert.equal(date.props['initialDate'], Date.parse('2026-10-01T09:00:00.000Z'));
    fabric.emit(date, 'topDateSelected', { date: Date.parse('2027-01-02T00:00:00.000Z') });
    root.flush();
    assert.equal(form.arrival()!.toISOString(), '2027-01-02T00:00:00.000Z');
    root.dispose();
  });
});
