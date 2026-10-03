import { render, screen } from '@solidnative/testing';
import { expect } from 'vitest';
import { check, parentOf } from '../../check.ts';
import { App } from './solution/app.tsx';

check(
  1,
  'The title is large and bold',
  () => {
    render(App);
    const title = screen.getByText('Today');
    expect(title.props['fontSize']).toBeGreaterThanOrEqual(24);
    expect(['700', '800', '900', 'bold']).toContain(title.props['fontWeight']);
  },
  'Give the Today text class="title", and add a .title rule to app.native.css with font-size: 30px and font-weight: 700.',
  { readsStyles: true },
);

check(
  2,
  'The habit and its status sit side by side',
  () => {
    const { fabric } = render(App);
    const row = parentOf(fabric.committed, screen.getByText('Drink water'));
    expect(row?.props['flexDirection']).toBe('row');
    expect(row?.props['justifyContent']).toBe('space-between');
    expect(parentOf(fabric.committed, screen.getByText('To do'))).toBe(row);
  },
  'Put both texts in a <View class="habit">, and give .habit flex-direction: row and justify-content: space-between.',
  { readsStyles: true },
);

check(
  2,
  'The row is a card',
  () => {
    const { fabric } = render(App);
    const row = parentOf(fabric.committed, screen.getByText('Drink water'));
    expect(row?.props['backgroundColor']).toBeDefined();
    expect(row?.props['borderTopLeftRadius']).toBeGreaterThan(0);
  },
  'Give .habit a background-color and a border-radius.',
  { readsStyles: true },
);

check(
  2,
  'The card stands out from the screen',
  () => {
    const { fabric } = render(App);
    const screenView = parentOf(fabric.committed, screen.getByText('Today'));
    const row = parentOf(fabric.committed, screen.getByText('Drink water'));
    expect(screenView?.props['backgroundColor']).toBeDefined();
    expect(row?.props['backgroundColor']).not.toEqual(screenView?.props['backgroundColor']);
  },
  'Give .screen background-color: #f4f4f5 and .habit background-color: #ffffff, so the card shows against the screen.',
  { readsStyles: true },
);

check(
  3,
  'The screen puts space between its children',
  () => {
    const { fabric } = render(App);
    const screenView = parentOf(fabric.committed, screen.getByText('Today'));
    expect(screenView?.props['rowGap']).toBeGreaterThan(0);
  },
  'Add gap: 8px to the .screen rule.',
  { readsStyles: true },
);
