import { describe, expect as vitestExpect, it } from 'vitest';
import { deepEqual, expect, fn } from './expect.ts';

const failure = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('Expected a failure');
};

describe('expect', () => {
  it('passes and fails as Vitest does, with the value in the message', () => {
    expect(2).toBe(2);
    expect({ a: [1, 2] }).toEqual({ a: [1, 2] });
    expect('habits').toContain('bit');
    expect([1, 2, 3]).toHaveLength(3);
    expect('3 of 4 done').toMatch(/of 4/);
    expect(null).toBeNull();
    expect(0).toBeFalsy();
    expect(5).toBeGreaterThan(4);
    vitestExpect(failure(() => expect('Walk').toBe('Run'))).toBe('Expected "Walk" to be "Run"');
    vitestExpect(failure(() => expect([1]).toHaveLength(2))).toBe('Expected a length of 2, got 1');
  });

  it('negates with not', () => {
    expect(1).not.toBe(2);
    vitestExpect(failure(() => expect(null).not.toBeNull())).toBe('Expected not null to be null');
  });

  it('says so when a matcher is not one of its own', () => {
    vitestExpect(failure(() => expect(1).toBeSorted())).toBe('toBeSorted is not available here.');
  });

  it('checks thrown errors', () => {
    expect(() => {
      throw new Error('No habits');
    }).toThrow('habits');
    vitestExpect(failure(() => expect(() => {}).toThrow())).toBe(
      'Expected the function to throw, and it did not',
    );
  });

  it('checks promises with resolves and rejects', async () => {
    await expect(Promise.resolve(3)).resolves.toBe(3);
    await expect(Promise.reject(new Error('gone'))).rejects.toBeInstanceOf(Error);
    await vitestExpect(expect(Promise.resolve(3)).resolves.toBe(4)).rejects.toThrow(
      'Expected 3 to be 4',
    );
  });

  it('records calls on a vi.fn() and checks them', () => {
    const toggled = fn();
    toggled('Walk');
    expect(toggled).toHaveBeenCalled();
    expect(toggled).toHaveBeenCalledTimes(1);
    expect(toggled).toHaveBeenCalledWith('Walk');
    vitestExpect(failure(() => expect(toggled).toHaveBeenCalledWith('Run'))).toBe(
      'Expected a call with ["Run"], got [["Walk"]]',
    );
    vitestExpect(fn().mockReturnValue(4)()).toBe(4);
  });
});

describe('deepEqual', () => {
  it('ignores undefined properties, as toEqual does', () => {
    vitestExpect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    vitestExpect(deepEqual([1, 2], [2, 1])).toBe(false);
    vitestExpect(deepEqual([1], { 0: 1 })).toBe(false);
  });
});
