/** @jsxImportSource @solid-native/platform/solid */
import { provideService, withServiceScope } from '@solid-native/device/solid';
import { Camera, type CameraRef, type CameraViewFunctions } from '@solid-native/expo/camera';

/** A screen with a camera on it, under a service scope that provides `source` as its module. */
export function expoCameraFixture(source: CameraViewFunctions | null) {
  let ref: CameraRef | undefined;
  const View = () =>
    withServiceScope([provideService(Camera.SOURCE, () => source)], () => (
      <Camera ref={(value) => (ref = value)} />
    ));
  return { View, camera: () => ref! };
}
