---
title: Video and audio player
summary: videoPlayer()/audioPlayer(), released with their Solid owner, with state as an accessor.
---

# Video and audio player

`videoPlayer()` and `audioPlayer()` create a player owned by the current Solid owner, wired to
`expo-video` and `expo-audio`. The player object is the same one `createVideoPlayer` gives; these
functions add what a component cannot otherwise get: the player is _released_ when its owner is
disposed, and its state is _readable_ as an accessor (the player's own properties are plain mutable
fields nothing reactive can watch).

## Install

```sh
npx expo install expo-video expo-audio
```

```ts
import { videoPlayer, audioPlayer } from '@solid-native/expo/solid/player';
```

Install only the one an app needs.

## The smallest useful example

```tsx
import { Pressable, Text } from '@solid-native/components/solid';
import { audioPlayer } from '@solid-native/expo/solid/player';

export function Clip() {
  const player = audioPlayer(require('./assets/clip.mp3'), { timeUpdate: 0.5 });

  return (
    <>
      <Text>
        {player.state().currentTime.toFixed(1)} / {player.state().duration.toFixed(1)}
      </Text>
      <Pressable onPress={() => player.native.play()}>
        <Text>Play</Text>
      </Pressable>
    </>
  );
}
```

## `videoPlayer(source, options?)` and `audioPlayer(source, options?)`

Both must be called under an active Solid owner (a component body, or `createRoot`) and throw
without one. `source` is the module's own `VideoSource` or `AudioSource`; `options.timeUpdate` is
the seconds between `currentTime` updates.

Each returns a `Player<T>`:

- **`native`** - the module's own player object. Call `play()`, `pause()`, `seekBy()`, `replace()`
  and the rest on it directly.
- **`state`** - an accessor updated from the player's change events: `playing`, `status`
  (`'idle'`, `'loading'`, `'readyToPlay'`, `'error'`), `currentTime`, `duration`, `muted`,
  `volume`, and `ended` (set when playback reaches the end, cleared when it starts again). Video
  reports these across several named events; `expo-audio` reports them together on one status
  event.
- **`stop()`** - removes the listeners and releases the player before its owner is disposed. Safe
  to call twice.

`watchPlayer(player, options?)`, from the same entry point, is the video half alone: it returns
`{ state, stop }` for any object with the player's `addListener`, such as a player the app created
itself.

## `timeUpdate`

For video it is off by default, so `currentTime` never moves without it - it is the player's most
frequent event. Pass `{ timeUpdate: 0.5 }` for updates twice a second.

For audio, `currentTime` always moves: `expo-audio` reports status on an interval, 500ms by
default, and `timeUpdate` sets that interval.

## Release

The player is released when its owner is disposed - no `onCleanup` needed. A live player holds its
decoder, its audio session and, on iOS, the now-playing controls.

## The `<expo-video>` view

`ExpoVideo` from `@solid-native/expo/solid` shows a video player. It registers `expo-video`'s
`VideoView` on first use and takes `player.native` as its `player`, passing the native view the
player's shared-object id as `VideoView` does:

```tsx
import { ExpoVideo } from '@solid-native/expo/solid';

<ExpoVideo
  class="aspect-video w-full"
  player={player.native}
  nativeControls
  contentFit="contain"
/>;
```

Its other props are `expo-video`'s `VideoViewProps` - `nativeControls`, `contentFit`,
`fullscreenOptions`, `requiresLinearPlayback`, the picture-in-picture flags, some platform-specific
ones, and the fullscreen, picture-in-picture and first-frame events; see the module's documentation.
Android's `surfaceType="textureView"` is not covered.

Audio has no view: `expo-audio` plays through the device's audio session.

## Testing

`provideService(videoPlayer.SOURCE, () => ({ create }))` or
`provideService(audioPlayer.SOURCE, () => ({ create }))`, inside a `ServiceScope` from
`@solid-native/device/solid`, supplies a fake player factory.

## Without the module installed

With `expo-video` (or `expo-audio`) missing - never installed, or not rebuilt since - the functions
throw a `MissingModuleError` on iOS, Android and the web alike, since a player has no sensible
default state. The message names the module and the fix; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed). In a test
with no fake source they throw a plain error saying the module is not installed.
