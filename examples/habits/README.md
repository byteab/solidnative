# Habits

A small habit tracker built with solidnative and Solid: four habits with a couple of months of history,
so every screen has something to show on first launch.

| Screen                                                     | What it shows                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Today (`src/app/today/today.solid.tsx`)                    | A progress bar for the day, and a checklist done a tap or a long press, with a CSS `@keyframes` animation and a haptic on completion                   |
| Habit (`src/app/habit-detail/habit-detail.solid.tsx`)      | A streak count and a calendar grid of the last ten weeks, laid out in CSS, with edit and delete                                                        |
| New/edit habit (`src/app/habit-form/habit-form.solid.tsx`) | A form over a name (required and unique), a colour and a reminder time, presented as a modal                                                           |
| Settings (`src/app/settings/settings.solid.tsx`)           | Daily reminders through `expo-notifications`, with the `Notifications` service covering the request and the denied state, and every streak at a glance |

Habits and their completions are kept in SQLite through `database()` from
`@solidnative/expo/solid/database`, written through best-effort: the signals in
`src/app/data/habits.solid.ts` are the source of truth for the UI, and persistence happens in the
background, so a device with no SQLite module - Node under the tests - falls back to the seeded
data rather than breaking anything.

## Run it

From the repository root, after `pnpm install`:

```sh
cd examples/habits
pnpm start     # press i or a, or scan the QR code with Expo Go
pnpm test      # Solid tests in Node against a fake Fabric, no simulator
```

`solid-tests/app.test.ts` drives the whole app the way a person would: checks a habit off, undoes
one, and creates a new one through the form. `solid-tests/habits-model.test.ts` covers the streak
and completion logic on its own, with no screen in the picture.
