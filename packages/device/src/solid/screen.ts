import { createMemo, type Accessor } from 'solid-js';
import { createObserved } from './observed.ts';
import { SafeArea } from './safe-area.ts';
import { createServiceToken, useService } from './service-scope.ts';
import { screenSource, type Size, type Sizes } from './condition-sources.ts';

const NOTHING: Sizes = { window: { width: 0, height: 0 }, screen: { width: 0, height: 0 } };
export const COMPACT_WIDTH = 768;

export interface Screen {
  readonly window: Accessor<Size>;
  readonly display: Accessor<Size>;
  readonly orientation: Accessor<'portrait' | 'landscape'>;
  readonly compact: Accessor<boolean>;
}

const SOURCE = createServiceToken('native.screenSource', screenSource);
export const Screen = Object.freeze({
  ...createServiceToken<Screen>('native.screen', () => {
    const sizes = createObserved(useService(SOURCE), NOTHING);
    const safeArea = useService(SafeArea);
    const window = createMemo(() => {
      const frame = safeArea.frame();
      return frame ? { width: frame.width, height: frame.height } : sizes().window;
    });
    return {
      window,
      display: createMemo(() => sizes().screen),
      orientation: createMemo(() => (window().width > window().height ? 'landscape' : 'portrait')),
      compact: createMemo(() => window().width < COMPACT_WIDTH),
    };
  }),
  SOURCE,
});
