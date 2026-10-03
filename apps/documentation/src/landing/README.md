# The landing page

An engineering notebook in which Solid code becomes a native app: ink on white and a blue accent,
with a worked example on each page of it. Everything here is ordinary Solid over the DOM; what
is inside a device frame is a screenshot from a simulator or emulator.

## Where things live

| File                            | What it is                                                                |
| ------------------------------- | ------------------------------------------------------------------------- |
| `content.ts`                    | Every fact the page states: commands, versions, links, landmarks          |
| `landing.tsx`                   | The page: the contents and each feature section, header state, the footer |
| `landing.css`                   | Ink, devices, the phone, code sheets, the edit loop, the reveal, motion   |
| `hero.tsx`                      | The claim, and three apps fanned beside it                                |
| `final-cta.tsx`                 | The way onward                                                            |
| `phone.tsx`                     | The phone around every capture: metal edge, bezel, buttons, shadow        |
| `code-sheet.tsx`                | A highlighted source file                                                 |
| `ink.ts`                        | The drawing hand: lines, circles, arrows, routes, outlines                |
| `reveal.ts`                     | Rises a block into place the first time it scrolls into view              |
| `showcase/navigation.solid.tsx` | The navigation showcase, which is native-only and so never mounted here   |
| `showcase/hot-reload.solid.tsx` | The dev-loop showcase, photographed before and after an edit              |
| `../examples/*.solid.tsx`       | The other showcases - shown as source and photographed                    |
| `public/showcase/*.webp`        | The screenshots                                                           |

## The rule

Every phone is a screenshot from the iOS simulator or the Android emulator, of the source file
shown beside it, unchanged. Every source is the file's own text. Do not edit a showcase without retaking its screenshots.

## Changing the hero's apps

The hero fans three apps: `src/examples/vault.solid.tsx` (a bank) and `player.solid.tsx` (a music
player) on the iOS simulator, and `fitness.solid.tsx` (a fitness tracker) on the Android emulator. Each is one
screen, drawn entirely with Tailwind classes, views and Lucide icons - no images - so it can be
changed like any component. Edit the file and retake its screenshot; `hero.tsx` says which
platform each slot shows.

## Retaking the screenshots

The captures come from `examples/wallet`, with the showcase copied in as the app's root, running
as a development build on both platforms (a development build rather than Expo Go, which draws its
own tools button over the app). The wallet app already has Tailwind, the router and the icon
packages the showcases use.

1. Build it once per platform: `npx expo run:ios --no-bundler` and
   `npx expo run:android --no-bundler` in `examples/wallet` (Android needs a JDK 17 on
   `JAVA_HOME`).
2. Copy a showcase in as `examples/wallet/src/app/showcase.solid.tsx`, and in
   `src/bootstrap.solid.tsx` mount its `App` in place of the app's own. Put both back afterwards.
3. Clean the status bars: `xcrun simctl status_bar booted override --time 9:41` on iOS, and
   Android's system UI demo mode (`clock -e hhmm 0941`).
4. Run Metro, relaunch the app and screenshot it:
   `xcrun simctl io booted screenshot` and `adb exec-out screencap -p`. For dark, set
   `xcrun simctl ui booted appearance dark` and `adb shell cmd uimode night yes` first.
5. Resize to 560 wide and save as WebP, named `<showcase>-<ios|android>-<light|dark>.webp` in
   `public/showcase`. `phone.tsx` builds the path from those three parts.

The hot-reload pair is `showcase/hot-reload.solid.tsx` before and after its heading is edited. The section plays that edit on a loop - the code line typed over, then the
device crossfading from one capture to the other - in `landing.css`'s `hot-*` keyframes.

## Changing a fact

Versions, commands, links, the landmarks and the Expo APIs are in `content.ts`.
Anything still unconfirmed there is marked `TODO: VERIFY` - the release number and the trademark
wording, at the time of writing.

## Motion

Nothing is tied to scroll position. The hero draws itself in once on first load; each section's
blocks rise into place once as they arrive (`reveal.ts`), and are then left alone; the hero's
phones tilt a couple of degrees with the pointer. Strokes ink in from `--draw`. Under
`prefers-reduced-motion: reduce` every drawing is finished and nothing moves - `landing.css`'s last
block is that design.

## Fonts and the social image

The three faces are OFL-licensed woff2 files in `public/fonts`, copied from the
`@fontsource-variable` packages of the same names, with their licenses beside them.
`build/prerender.ts` preloads the display and body faces on every page. The social image is
`public/og.png`, a 1280 x 640 card that is also the GitHub repository's social preview, rendered
with headless Chrome from `og.html` in this folder (as is
`public/apple-touch-icon.png`, from `apple-touch-icon.html` beside it). The favicon is
`public/favicon.svg`, the same drawing as `mark.tsx`.
