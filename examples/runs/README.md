# Runs

A small run tracker built with solidnative and Solid: a live map, GPS tracking with splits, and a GPX
export, all built to run in the simulator without a real GPS.

| Screen                                                 | What it shows                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Run (`src/app/run/run.solid.tsx`)                      | A live map that follows the route, big tabular numbers for time, distance and pace, and start/pause/finish controls |
| History (`src/app/history/history.solid.tsx`)          | Every past run, newest first, with its date, duration and pace                                                      |
| Run detail (`src/app/run-detail/run-detail.solid.tsx`) | The finished route on a map, splits per kilometre, and an export to GPX shared through the system share sheet       |
| Settings (`src/app/settings/settings.solid.tsx`)       | Kilometres or miles, persisted with `Storage`, and - in development - a switch to the simulated location source     |

## The two location sources

Every screen talks to `Tracking` (`src/app/tracking/tracking.solid.ts`) through one `LocationSource`
interface (`src/app/tracking/location-source.ts`), never knowing which it has:

- `RealLocationSource` follows the device's GPS through `Location`.
- `SimulatedLocationSource` replays a recorded loop around Regent's Park
  (`src/app/tracking/simulated-route.ts`) on a timer, so the app - and its screenshots - show a
  run moving without a device or a permission dialog.

`LocationSourceSetting` (`src/app/settings/location-source-setting.solid.ts`) picks between them: on by
default everywhere except a release build, and always available to flip in Settings.

The Run and detail screens draw the route with [Maps](/packages/expo/maps)' `<expo-map>`: a
polyline through the recorded fixes, a marker at the runner, and a camera that follows them.

## Run it

From the repository root, after `pnpm install`:

```sh
cd examples/runs
pnpm ios       # or pnpm android: a development build, since Expo Go has no native map view
pnpm test      # Solid tests in Node against a fake Fabric, no simulator
```

`solid-tests/screens.test.ts` drives every screen the way a person would.
`solid-tests/geo.test.ts` covers the haversine distance, pace and per-kilometre splits on their
own, and `solid-tests/models.test.ts` drives `Tracking` itself against a fake location source,
including a pause and resume. `solid-tests/gpx.test.ts` checks the GPX file a run exports.
