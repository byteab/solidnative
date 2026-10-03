import type { useNavigation } from '@solid-native/router/solid';

type Navigation = ReturnType<typeof useNavigation>;

/** Form sheets with detents: half height first, drag up for the full screen. */
export const openCompose = (navigation: Navigation, replyTo?: string) =>
  void navigation.present(replyTo ? `/compose?replyTo=${replyTo}` : '/compose', {
    as: 'formSheet',
    presentation: { sheetAllowedDetents: [0.55, 1], sheetGrabberVisible: true },
  });

export const openSettings = (navigation: Navigation) =>
  void navigation.present('/settings', {
    as: 'formSheet',
    presentation: { sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true },
  });
