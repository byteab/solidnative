/**
 * A typo'd element name, reported rather than rendered as an empty view.
 *
 * Every element name reaches the engine the same way, through `createElement`, so the name alone
 * cannot tell `<veiw>` from `<x-card>`: both are names no table has heard of. What tells them
 * apart is the component host mark, so a name is unknown only when no view table, registration or
 * component host accounts for it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine, markComponentHost } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { mountSolid } from './css-solid-harness.ts';
import { typo } from './css-solid-fixtures.tsx';

function capture(run: () => void | Promise<void>): Promise<string[]> {
  const reports: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => reports.push(args.map(String).join(' '));
  return Promise.resolve()
    .then(run)
    .then(
      () => {
        console.error = original;
        return reports;
      },
      (error: unknown) => {
        console.error = original;
        throw error;
      },
    );
}

describe('an element nothing accounts for, on the engine', () => {
  it('is reported once per name in dev, naming the element', async () => {
    const reports = await capture(() => {
      const engine = new Engine(createFakeFabric(), 1, { dev: true });
      engine.appendChild(engine.root, engine.createElement('veiw'));
      engine.appendChild(engine.root, engine.createElement('veiw'));
      engine.commit();
    });
    assert.equal(reports.length, 1);
    assert.match(reports[0]!, /<veiw>/);
    assert.match(reports[0]!, /empty view/);
  });

  // A component host and a release build must stay silent.
  it('is silent for a component host, and outside dev', async () => {
    const reports = await capture(() => {
      const engine = new Engine(createFakeFabric(), 1, { dev: true });
      const card = engine.createElement('x-card');
      markComponentHost(card);
      engine.appendChild(engine.root, card);
      engine.commit();

      const release = new Engine(createFakeFabric(), 1, { dev: false });
      release.appendChild(release.root, release.createElement('veiw'));
      release.commit();
    });
    assert.deepEqual(reports, []);
  });
});

describe('an element nothing accounts for, in an app', () => {
  it('reports a typo on first commit, once', async () => {
    const reports = await capture(() => {
      mountSolid(typo(), { dev: true }).root.dispose();
    });
    assert.equal(reports.length, 1, reports.join('\n'));
    assert.match(reports[0]!, /<veiw>/);
  });
});
