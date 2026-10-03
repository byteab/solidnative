import { describe, expect, it } from 'vitest';
import { orderFiles, splitSteps } from './course.ts';

describe('splitSteps', () => {
  it('splits a lesson into its introduction and a step per h2, titles as text', () => {
    const { intro, steps } = splitSteps(
      '<p>Intro</p><h2 id="a">Swap the screen&#39;s <code>styles</code></h2><p>One</p><h2>Two &amp; three</h2><p>Two</p>',
    );
    expect(intro).toBe('<p>Intro</p>');
    expect(steps).toEqual([
      { title: "Swap the screen's styles", html: '<p>One</p>' },
      { title: 'Two & three', html: '<p>Two</p>' },
    ]);
  });
});

describe('orderFiles', () => {
  it('puts the entry first and tests last', () => {
    expect(
      orderFiles({ 'app.spec.tsx': '', 'habit-row.tsx': '', 'app.native.css': '', 'app.tsx': '' }),
    ).toEqual(['app.tsx', 'app.native.css', 'habit-row.tsx', 'app.spec.tsx']);
  });
});
