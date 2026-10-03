import type { Accessor } from 'solid-js';
import { createServiceToken } from './service-scope.ts';

/** Native outlets override this per retained route. Outside an outlet, content is in front. */
export const SCREEN_IN_FRONT = createServiceToken<Accessor<boolean>>(
  'native.screenInFront',
  () => () => true,
);
