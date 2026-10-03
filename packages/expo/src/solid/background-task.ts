import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

export const BackgroundTaskStatus = { Restricted: 1, Available: 2 } as const;
export type BackgroundTaskStatus = (typeof BackgroundTaskStatus)[keyof typeof BackgroundTaskStatus];
export const BackgroundTaskResult = { Success: 1, Failed: 2 } as const;
export type BackgroundTaskResult = (typeof BackgroundTaskResult)[keyof typeof BackgroundTaskResult];
export interface BackgroundTaskOptions {
  minimumInterval?: number;
}
export interface NativeBackgroundTask {
  getStatusAsync(): Promise<BackgroundTaskStatus>;
  registerTaskAsync(name: string, options?: BackgroundTaskOptions): Promise<void>;
  unregisterTaskAsync(name: string): Promise<void>;
  triggerTaskWorkerForTestingAsync(): Promise<boolean>;
}
export interface BackgroundTask {
  status(): Promise<BackgroundTaskStatus>;
  register(name: string, options?: BackgroundTaskOptions): Promise<void>;
  unregister(name: string): Promise<void>;
  triggerForTesting(): Promise<boolean>;
}
/** Task bodies still belong at the entry module's top level, outside a Solid owner. */
export const BackgroundTask = sourcedService<BackgroundTask, NativeBackgroundTask | null>(
  'expo.backgroundTask',
  () =>
    expoModule(
      'expo-background-task',
      () => require('expo-background-task') as NativeBackgroundTask,
    ),
  (native) => {
    const requests = ownedRequests();
    return {
      status: () =>
        requests.run<BackgroundTaskStatus>(
          BackgroundTaskStatus.Restricted,
          async () => (await native?.getStatusAsync()) ?? BackgroundTaskStatus.Restricted,
        ),
      register: (name, options) =>
        requests.run(undefined, () => native?.registerTaskAsync(name, options)),
      unregister: (name) => requests.run(undefined, () => native?.unregisterTaskAsync(name)),
      triggerForTesting: () =>
        requests.run(
          false,
          async () => (await native?.triggerTaskWorkerForTestingAsync()) ?? false,
        ),
    };
  },
);
