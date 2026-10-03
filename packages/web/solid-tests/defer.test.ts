/** `Defer` over the browser host: the fallback first, the children once a frame has passed. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, Defer, insert } from '../src/solid/index.ts';
import { boot, settle } from './boot.ts';

describe('Defer, in the browser', () => {
  it('shows its fallback first and mounts its children a frame later, once', async () => {
    let made = 0;
    const { element, root } = boot(() => {
      const page = createElement('view');
      insert(page, () =>
        Defer({
          fallback: 'loading',
          get children() {
            made++;
            return 'body';
          },
        }),
      );
      return page;
    });
    assert.equal(element.textContent, 'loading');
    for (let i = 0; i < 3 && made === 0; i++) await settle();
    assert.equal(element.textContent, 'body');
    await settle();
    assert.equal(made, 1);
    root.dispose();
  });

  it('never mounts its children when disposed before the frame', async () => {
    let made = 0;
    const { root } = boot(() =>
      Defer({
        get children() {
          made++;
          return 'body';
        },
      }),
    );
    // The commit's microtask has run and asked for the frame, which has not come yet.
    await Promise.resolve();
    await Promise.resolve();
    root.dispose();
    await settle();
    await settle();
    assert.equal(made, 0);
  });
});
