import type { NativeRoute } from '@solid-native/router/solid';
import { DomComponentsPage } from './dom-components.solid.tsx';

export const domComponentRoutes: readonly NativeRoute[] = [
  { path: 'dom-components', component: DomComponentsPage },
];
