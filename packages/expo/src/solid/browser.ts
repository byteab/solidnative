import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';
type Expo = typeof import('expo-web-browser');

/** The slice of `expo-web-browser` this needs. */
export interface NativeBrowser {
  openBrowserAsync(url: string): Promise<{ type: string }>;
  openAuthSessionAsync(
    url: string,
    redirectUrl?: string | null,
  ): Promise<{ type: 'success'; url: string } | { type: string }>;
}

export interface Browser {
  open(url: string): Promise<void>;
  signIn(url: string, redirectUrl: string): Promise<string | null>;
}
export const Browser = sourcedService<Browser, NativeBrowser | null>(
  'expo.browser',
  () => expoModule('expo-web-browser', () => require('expo-web-browser') as Expo),
  (native) => {
    const requests = ownedRequests();
    return {
      open: (url) =>
        requests.run(undefined, async () => {
          await native?.openBrowserAsync(url);
        }),
      signIn: (url, redirectUrl) =>
        requests.run<string | null>(null, async () => {
          const result = await native?.openAuthSessionAsync(url, redirectUrl);
          return result?.type === 'success' && 'url' in result ? result.url : null;
        }),
    };
  },
);
