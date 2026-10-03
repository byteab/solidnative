import type { NativeRoute } from '@solidnative/router/solid';
import { DomComponentsPage } from './dom-components.solid.tsx';

export const domComponentRoutes: readonly NativeRoute[] = [
  { path: 'dom-components', component: DomComponentsPage },
];
