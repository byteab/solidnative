import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

export interface NativeStoreReview {
  isAvailableAsync(): Promise<boolean>;
  hasAction(): Promise<boolean>;
  requestReview(): Promise<void>;
  storeUrl(): string | null;
}
export interface StoreReview {
  available(): Promise<boolean>;
  hasAction(): Promise<boolean>;
  request(): Promise<void>;
  storeUrl(): string | null;
}
export const StoreReview = sourcedService<StoreReview, NativeStoreReview | null>(
  'expo.storeReview',
  () => expoModule('expo-store-review', () => require('expo-store-review') as NativeStoreReview),
  (native) => {
    const requests = ownedRequests();
    return {
      available: () => requests.run(false, async () => (await native?.isAvailableAsync()) ?? false),
      hasAction: () => requests.run(false, async () => (await native?.hasAction()) ?? false),
      request: () => requests.run(undefined, () => native?.requestReview()),
      storeUrl: () => (requests.active() ? (native?.storeUrl() ?? null) : null),
    };
  },
);
