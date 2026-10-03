import { reactNative, type ReactNative } from '../react-native.ts';
import { createRequests } from './requests.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface ShareRequest {
  readonly message?: string;
  readonly url?: string;
  readonly title?: string;
}

export interface NativeSharing {
  share(request: ShareRequest): Promise<{ action: string; activityType?: string | null }>;
}

export function sharingSource(
  native: Pick<ReactNative, 'Platform' | 'Share'> | null = reactNative(),
): NativeSharing | null {
  if (!native) return null;
  return {
    share: (request) => {
      // Android ignores url: include it in the message without changing the caller's object.
      const content =
        native.Platform.OS === 'android' && request.url
          ? {
              title: request.title,
              message: request.message ? `${request.message}\n${request.url}` : request.url,
            }
          : request;
      return native.Share.share(content);
    },
  };
}

export interface Sharing {
  /** Dismissal, native failure and owner disposal all resolve false. */
  share(request: ShareRequest): Promise<boolean>;
}

const SOURCE = createServiceToken('native.sharingSource', sharingSource);
export const Sharing = Object.freeze({
  ...createServiceToken<Sharing>('native.sharing', () => {
    const native = useService(SOURCE);
    const requests = createRequests();
    return {
      share: (request) =>
        requests
          .run(false, (resolve) => {
            if (!native || (!request.message && !request.url)) return resolve(false);
            void Promise.resolve(native.share({ ...request }))
              .then(({ action }) => resolve(action === 'sharedAction'))
              .catch(() => resolve(false));
          })
          .catch(() => false),
    };
  }),
  SOURCE,
});
