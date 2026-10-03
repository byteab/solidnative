import { createMemo, type Accessor } from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { createObserved } from './observed.ts';
import { createServiceToken, useService } from './service-scope.ts';

export type LayoutDirection = 'ltr' | 'rtl';

export interface DirectionSource {
  current(): LayoutDirection | PromiseLike<LayoutDirection>;
  subscribe(listener: (direction: LayoutDirection) => void): () => void;
}

export function directionSource(
  native: Pick<ReactNative, 'I18nManager'> | null = reactNative(),
): DirectionSource {
  return {
    current: () => (native?.I18nManager.isRTL ? 'rtl' : 'ltr'),
    // RN's direction is fixed at startup. Browser/test sources can emit live changes.
    subscribe: () => () => {},
  };
}

export interface DirectionContext {
  readonly current: Accessor<LayoutDirection>;
  readonly rtl: Accessor<boolean>;
}

export type Direction = DirectionContext;
const SOURCE = createServiceToken('native.directionSource', directionSource);
export const Direction = Object.freeze({
  ...createServiceToken<Direction>('native.direction', () => {
    const current = createObserved(useService(SOURCE), 'ltr');
    return { current, rtl: createMemo(() => current() === 'rtl') };
  }),
  SOURCE,
});
