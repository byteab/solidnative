/** @jsxImportSource solid-js */
/**
 * The landing page: an engineer's notebook, in which Solid code becomes a native app.
 *
 * Outside the documentation shell on purpose - the shell renders this route with no sidebar and
 * no docs header - and styled by `landing.css`, which `styles.css` imports so the prerendered
 * page is styled on its first paint rather than once this chunk arrives.
 *
 * Every phone on the page is a screenshot from the iOS simulator or the Android emulator running
 * the source shown beside it. Every source is the file's own text, highlighted at build
 * time. The facts live in `content.ts`; `README.md` says how to retake the screenshots.
 *
 * Each section is composed differently on purpose - a sheet with devices laid beside it, a row of
 * four, a push from one screen to the next, a before and after - so the page reads as a notebook
 * of worked examples rather than one template repeated.
 */
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { html as planSource } from '../examples/plans.native.css?excerpt';
import { html as settingsSource } from '../examples/settings.solid.tsx?excerpt';
import { html as testSource } from '@solidnative/template/src/app/app.test.ts?source';
import { applySeo } from '../seo.ts';
import { GITHUB_REPO, SITE_NAME } from '../site.ts';
import { LandingCode } from './code-sheet.tsx';
import { EXPO_APIS, INDEPENDENCE_NOTE, LANDMARKS, LINKS } from './content.ts';
import { LandingExpoGlyph } from './expo-glyph.tsx';
import { LandingFinalCta } from './final-cta.tsx';
import { LandingHeader } from './header.tsx';
import { LandingHero } from './hero.tsx';
import { arrow } from './ink.ts';
import { LandingMark } from './mark.tsx';
import { LandingMore } from './more.tsx';
import { LandingPhone } from './phone.tsx';
import { reveal } from './reveal.ts';
import { html as navigationSource } from './showcase/navigation.solid.tsx?excerpt';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'doc-home': HTMLAttributes<HTMLElement>;
    }
  }
}

export const LANDING_TITLE = `${SITE_NAME} - Build native apps with Solid`;
export const LANDING_DESCRIPTION =
  'Build iOS and Android apps with Solid, powered by Expo: Solid components rendered as real native views, with a real CSS engine, Tailwind and native navigation.';

const VARIANTS = [
  {
    name: 'ios:  android:',
    body: 'Per-platform styles in one class string.',
    example: 'ios:text-3xl android:rounded-full',
  },
  {
    name: 'dark:',
    body: 'Follows the system theme, or your own switcher.',
    example: 'bg-white dark:bg-zinc-950',
  },
  {
    name: 'hover:  press:',
    body: 'The press state on touch; real hover on an iPad trackpad.',
    example: 'bg-red-600 hover:bg-red-700',
  },
  {
    name: 'web:  native:',
    body: 'Styles for the browser only, or the device only.',
    example: 'web:max-w-md native:flex-1',
  },
  {
    name: 'pt-safe',
    body: 'Padding and margins clear of the notch and home indicator.',
    example: 'pt-safe pb-safe-4',
  },
  {
    name: 'h-hairline',
    body: 'The thinnest line the screen can draw.',
    example: 'h-hairline bg-zinc-200',
  },
];

const TAILWIND_SHOTS = [
  { platform: 'ios', scheme: 'light', label: 'iOS', alt: 'Settings on iOS, light' },
  { platform: 'android', scheme: 'light', label: 'Android', alt: 'Settings on Android, light' },
  { platform: 'ios', scheme: 'dark', label: 'iOS · dark', alt: 'Settings on iOS, dark' },
  {
    platform: 'android',
    scheme: 'dark',
    label: 'Android · dark',
    alt: 'Settings on Android, dark',
  },
] as const;

/** From the list to the pushed screen. */
const PUSH_ARROW = arrow({ x: 0, y: 10 }, { x: 60, y: 44 }, 51, 0.3);

const HOT_STEPS = [
  'Save a component or its stylesheet.',
  'Metro rebuilds it and the app reloads on the device.',
  'Every root and effect is disposed first, so nothing stale runs.',
];

/** The edit the hot-reload section plays: the code line typed over, in `landing.css`'s `hot-*`. */
const HOT_CODE = `<span class="hot-dim">&lt;View class="screen"&gt;</span>
  <span class="hot-line">&lt;Text class="title"&gt;Hello, <span class="hot-old">native</span><span class="hot-new">hot reload</span><span class="hot-caret"></span>&lt;/Text&gt;</span>
  <span class="hot-dim">&lt;Text class="lede"&gt;One component, both platforms.&lt;/Text&gt;</span>
  <span class="hot-dim">&lt;Pressable class="button" onPress={() =&gt; setTaps(taps() + 1)}&gt;</span>
    <span class="hot-dim">&lt;Text class="label"&gt;Tapped {taps()} times&lt;/Text&gt;</span>
  <span class="hot-dim">&lt;/Pressable&gt;</span>
<span class="hot-dim">&lt;/View&gt;</span>`;

const TAILWIND_SETUP = `<span>@import 'tailwindcss/theme.css';</span>
<span>@import 'tailwindcss/utilities.css';</span>
<span class="is-ours">@import '@solidnative/tailwind/native.css';</span>`;

/** A contents entry's number: 01, 02 and so on. */
const number = (index: number) => String(index + 1).padStart(2, '0');

export function Home() {
  const links = LINKS;
  const [scrolled, setScrolled] = createSignal(false);
  const [pastHero, setPastHero] = createSignal(false);

  applySeo({
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    path: '/',
    type: 'website',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: SITE_NAME,
      description: LANDING_DESCRIPTION,
      codeRepository: GITHUB_REPO,
      programmingLanguage: 'TypeScript',
      license: 'https://opensource.org/licenses/MIT',
    },
  });

  onMount(() => {
    const watch = (selector: string, set: (past: boolean) => void) => {
      const marker = document.querySelector(selector);
      if (!marker) return;
      const observer = new IntersectionObserver(([entry]) =>
        set(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      );
      observer.observe(marker);
      onCleanup(() => observer.disconnect());
    };
    watch('.landing-sentinel', setScrolled);
    watch('.landing main > .h-px', setPastHero);
  });

  const entry = (item: (typeof LANDMARKS)[number], i: number) => (
    <>
      <span class="pt-1 font-code text-sm text-brand-ink">{number(i)}</span>
      <span>
        <span class="landing-display block text-xl group-hover:text-brand-ink">{item.title}</span>
        <span class="mt-1.5 block text-[0.9375rem] text-ink/70">{item.body}</span>
      </span>
    </>
  );

  return (
    <doc-home>
      <div class="landing">
        <a
          href="#main"
          class="sr-only z-50 rounded bg-ink px-4 py-2 text-paper-light focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <div class="landing-sentinel absolute top-0 h-2 w-px" aria-hidden="true" />
        <LandingHeader solid={scrolled()} ruled={pastHero()} />

        <main id="main">
          <LandingHero />
          <div class="h-px" />

          {/* ================================================ Contents: the landmark features */}
          <section class="border-t border-ink/15" aria-labelledby="contents-title">
            <div class="mx-auto max-w-[80rem] px-[var(--gutter)] py-24">
              <div class="reveal max-w-[46rem]" ref={reveal}>
                <p class="landing-eyebrow">Features</p>
                <h2
                  id="contents-title"
                  class="landing-display mt-4 text-[clamp(2.2rem,4vw,3.2rem)]"
                >
                  What is in the box.
                </h2>
                <p class="landing-prose mt-5">
                  Native UI, CSS and Tailwind, navigation, component tests and Expo's modules, in
                  the Solid you already know.
                </p>
              </div>
              <ol class="mt-12 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
                <For each={LANDMARKS}>
                  {(item, i) => (
                    <li class="reveal" ref={reveal} style={{ '--i': i() % 3 }}>
                      <Show
                        when={item.section}
                        fallback={
                          <a class="contents-entry group" href={item.docs}>
                            {entry(item, i())}
                          </a>
                        }
                      >
                        {(section) => (
                          <a class="contents-entry group" href={`#${section()}`}>
                            {entry(item, i())}
                          </a>
                        )}
                      </Show>
                    </li>
                  )}
                </For>
              </ol>
            </div>
          </section>

          {/* ================================================ CSS: a sheet with devices beside it */}
          <section id="css" class="scroll-mt-20 border-t border-ink/15" aria-labelledby="css-title">
            <div class="mx-auto grid grid-cols-1 max-w-[80rem] items-center gap-14 px-[var(--gutter)] py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div class="reveal" ref={reveal}>
                <p class="landing-eyebrow">Styling</p>
                <h2 id="css-title" class="landing-display mt-4 text-[clamp(2.2rem,4vw,3.4rem)]">
                  A CSS engine, compiled at build time.
                </h2>
                <p class="landing-prose mt-5">
                  Write component styles in plain CSS files. They compile when Metro bundles, then
                  cascade over the native views the way a browser applies CSS to the DOM.
                </p>
                <p class="landing-prose mt-4">
                  Selectors and combinators, <code>:host</code>, specificity and inheritance, custom
                  properties, <code>@media</code>, transitions, keyframes, gradients, shadows and
                  filters.
                </p>
                <LandingMore class="mt-7" link={links.supportedCss} topic="the CSS engine" />
              </div>

              <div class="reveal relative" ref={reveal} style="--i: 1">
                <div class="relative z-10 lg:mr-[30%] lg:-rotate-[0.5deg]">
                  <LandingCode file="plans.native.css" html={planSource} />
                </div>
                <div class="mt-8 grid grid-cols-2 gap-5 lg:absolute lg:top-6 lg:right-[9%] lg:mt-0 lg:block lg:w-[31%]">
                  <LandingPhone
                    platform="ios"
                    shot="plans"
                    scheme="dark"
                    alt="An upgrade screen on the iOS simulator in dark mode, styled with component CSS"
                    class="relative z-20 lg:-rotate-[3deg]"
                  />
                  <LandingPhone
                    platform="android"
                    shot="plans"
                    scheme="dark"
                    alt="The same screen on the Android emulator"
                    class="lg:absolute lg:top-16 lg:left-[46%] lg:w-full lg:rotate-[6deg]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ================================================ Tailwind: the variants, then a row of four */}
          <section
            id="tailwind"
            class="scroll-mt-20 border-t border-ink/15 bg-paper-light/60"
            aria-labelledby="tailwind-title"
          >
            <div class="mx-auto max-w-[80rem] px-[var(--gutter)] py-28">
              <div class="grid grid-cols-1 items-start gap-14 lg:grid-cols-[0.95fr_1.05fr]">
                <div class="reveal" ref={reveal}>
                  <p class="landing-eyebrow">Tailwind CSS v4</p>
                  <h2
                    id="tailwind-title"
                    class="landing-display mt-4 text-[clamp(2.4rem,4.6vw,3.8rem)]"
                  >
                    Tailwind, on iOS and Android.
                  </h2>
                  <p class="landing-prose mt-5">
                    Use the Tailwind you know. Layout, spacing, color, type, borders and gradients
                    compile to native styles, and the same classes work on the web.
                  </p>
                  <p class="landing-prose mt-4">
                    Add the native preset and connect Tailwind to Metro. A utility native can't draw
                    is reported at build time, with the line it came from.
                  </p>
                  <div class="mt-8 max-w-[30rem]">
                    <div class="code-sheet">
                      <div class="code-sheet-head">
                        <span class="code-sheet-file">styles.css</span>
                      </div>
                      <pre class="setup-body" innerHTML={TAILWIND_SETUP} />
                    </div>
                  </div>
                  <LandingMore class="mt-8" link={links.tailwind} topic="Tailwind" />
                </div>

                <div class="reveal" ref={reveal} style="--i: 1">
                  <p class="landing-eyebrow">Plus the variants a device needs</p>
                  <ul class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <For each={VARIANTS}>
                      {(variant, i) => (
                        <li
                          class="reveal rounded-md bg-paper-light p-5 shadow-[var(--sheet-shadow)]"
                          ref={reveal}
                          style={{ '--i': i() % 2 }}
                        >
                          <p class="font-code text-lg text-brand-ink">{variant.name}</p>
                          <p class="mt-2 text-[0.9375rem] text-ink/75">{variant.body}</p>
                          <p class="mt-3 font-code text-xs text-graphite">{variant.example}</p>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </div>

              <div class="mt-20 grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
                <For each={TAILWIND_SHOTS}>
                  {(shot, i) => (
                    <figure class="reveal" ref={reveal} style={{ '--i': i() }}>
                      <div class="device-crop" style="--crop: 0.62">
                        <LandingPhone
                          platform={shot.platform}
                          shot="settings"
                          scheme={shot.scheme}
                          alt={shot.alt}
                        />
                      </div>
                      <figcaption class="device-label">{shot.label}</figcaption>
                    </figure>
                  )}
                </For>
              </div>
              <p class="mx-auto mt-10 max-w-[40rem] text-center text-[0.9375rem] text-ink/70">
                One component, four screens: iOS and Android, light and dark, from the{' '}
                <code>ios:</code>, <code>android:</code> and <code>dark:</code> classes below.
              </p>

              <div class="reveal mx-auto mt-10 max-w-[52rem]" ref={reveal}>
                <LandingCode file="settings.solid.tsx" html={settingsSource} />
              </div>
            </div>
          </section>

          {/* ================================================ Navigation: a push, devices first */}
          <section
            id="navigation"
            class="scroll-mt-20 border-t border-ink/15"
            aria-labelledby="navigation-title"
          >
            <div class="mx-auto grid grid-cols-1 max-w-[80rem] items-center gap-14 px-[var(--gutter)] py-28 lg:grid-cols-[1fr_1fr]">
              <div class="reveal relative order-2 lg:order-1" ref={reveal}>
                <div class="mx-auto grid max-w-[30rem] grid-cols-2 items-start gap-10">
                  <figure>
                    <LandingPhone
                      platform="ios"
                      shot="nav-list"
                      alt="A trips list of gradient postcards in a native stack with a large title, on the iOS simulator"
                    />
                    <figcaption class="device-label">The stack</figcaption>
                  </figure>
                  <figure class="mt-16">
                    <LandingPhone
                      platform="ios"
                      shot="nav-detail"
                      alt="The pushed trip's itinerary, with the native back button"
                    />
                    <figcaption class="device-label">After a push</figcaption>
                  </figure>
                </div>
                <svg
                  class="pointer-events-none absolute top-[38%] left-1/2 hidden h-20 w-16 -translate-x-1/2 overflow-visible sm:block"
                  aria-hidden="true"
                >
                  <path class="ink-accent" d={PUSH_ARROW[0]} />
                  <path class="ink-accent" d={PUSH_ARROW[1]} />
                </svg>
              </div>

              <div class="reveal order-1 min-w-0 lg:order-2" ref={reveal} style="--i: 1">
                <p class="landing-eyebrow">Navigation</p>
                <h2
                  id="navigation-title"
                  class="landing-display mt-4 text-[clamp(2.2rem,4vw,3.4rem)]"
                >
                  A Solid router, on native navigation.
                </h2>
                <p class="landing-prose mt-5">
                  Your routes, guards, resolvers and route inputs, rendered as a native stack with
                  the platform's header, large titles and back gesture. Tabs, sheets and modals are
                  native too, and deep links and Android's back button are real navigations.
                </p>
                <LandingCode class="mt-8" file="navigation.solid.tsx" html={navigationSource} />
                <LandingMore class="mt-7" link={links.router} topic="the native router" />
              </div>
            </div>
          </section>

          {/* ================================================ Hot reload: the edit, playing */}
          <section
            id="hot-reload"
            class="scroll-mt-20 border-t border-ink/15"
            aria-labelledby="hot-reload-title"
          >
            <div class="hot-demo mx-auto grid max-w-[80rem] grid-cols-1 items-center gap-14 px-[var(--gutter)] py-28 lg:grid-cols-[0.75fr_1.25fr]">
              <div class="reveal" ref={reveal}>
                <p class="landing-eyebrow">Developer experience</p>
                <h2
                  id="hot-reload-title"
                  class="landing-display mt-4 text-[clamp(2.2rem,4vw,3.4rem)]"
                >
                  Save a file, and the device reloads it cleanly.
                </h2>
                <p class="landing-prose mt-5">
                  Save a component or a stylesheet and Metro rebuilds it, then the app reloads on
                  the device. Every Solid root and effect is disposed first, so nothing from the old
                  code keeps running.
                </p>
                <ol class="mt-9 flex flex-col gap-4">
                  <For each={HOT_STEPS}>
                    {(step, i) => (
                      <li class="hot-step flex items-center gap-4" data-step={i() + 1}>
                        <span class="hot-step-number flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] font-code text-sm">
                          {i() + 1}
                        </span>
                        <span class="text-[0.9375rem]">{step}</span>
                      </li>
                    )}
                  </For>
                </ol>
                <LandingMore class="mt-8" link={links.devLoop} topic="the dev loop" />
              </div>

              <div
                class="reveal grid grid-cols-1 items-center gap-8 sm:grid-cols-[minmax(0,1fr)_15rem]"
                ref={reveal}
                style="--i: 1"
                aria-label="A component edit on Android: the heading changes from Hello, native to Hello, hot reload"
                role="img"
              >
                <div class="code-sheet min-w-0">
                  <div class="code-sheet-head">
                    <span class="code-sheet-file">hot-reload.solid.tsx</span>
                    <span class="hot-saved ml-auto font-code text-xs">Saved</span>
                  </div>
                  <pre class="hot-code" aria-hidden="true" innerHTML={HOT_CODE} />
                </div>
                <figure class="mx-auto w-full max-w-[15rem]">
                  <div class="device-crop" style="--crop: 0.75">
                    <LandingPhone platform="android" shot="hot-reload" swap="hot-reload-after" />
                  </div>
                  <figcaption class="device-label">Android emulator</figcaption>
                </figure>
              </div>
            </div>
          </section>

          {/* ================================================ Testing: two sheets on the desk */}
          <section
            id="testing"
            class="scroll-mt-20 border-t border-ink/15 bg-paper-light/60"
            aria-labelledby="testing-title"
          >
            <div class="mx-auto max-w-[80rem] px-[var(--gutter)] py-28">
              <div
                class="reveal grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr] lg:items-start"
                ref={reveal}
              >
                <div>
                  <p class="landing-eyebrow">Testing</p>
                  <h2
                    id="testing-title"
                    class="landing-display mt-4 text-[clamp(2.2rem,4vw,3.4rem)]"
                  >
                    Component tests in Node. No simulator.
                  </h2>
                </div>
                <div class="lg:pt-9">
                  <p class="landing-prose">
                    <code>@solidnative/testing</code> renders a component in Node, against a fake
                    native layer. Find it by role or text, press it, and read back what changed.
                  </p>
                  <p class="landing-prose mt-4">
                    The starter app includes a test, and it runs in under a second with{' '}
                    <code>node --test</code>. For flows that need a real device, use Maestro.
                  </p>
                  <LandingMore class="mt-6" link={links.testing} topic="testing" />
                </div>
              </div>

              <div class="reveal mt-14 lg:mx-auto lg:max-w-[48rem]" ref={reveal} style="--i: 1">
                <LandingCode file="app.test.ts" html={testSource} maxHeight="22rem" />
              </div>
            </div>
          </section>

          {/* ================================================ Expo: index cards */}
          <section
            id="expo"
            class="scroll-mt-20 border-t border-ink/15 bg-paper-light/60"
            aria-labelledby="expo-title"
          >
            <div class="mx-auto max-w-[80rem] px-[var(--gutter)] py-28">
              <div
                class="reveal grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr] lg:items-start"
                ref={reveal}
              >
                <div>
                  <p class="landing-eyebrow">The platform</p>
                  <h2 id="expo-title" class="landing-display mt-4 text-[clamp(2.2rem,4vw,3.4rem)]">
                    Built on Expo.
                  </h2>
                </div>
                <p class="landing-prose lg:pt-9">
                  Develop in Expo Go, then build with <code>npx expo run:ios</code>,{' '}
                  <code>npx expo run:android</code> or EAS, and use Expo's modules as Solid
                  services, with signals wherever the device has a value to watch.
                </p>
              </div>
              <ul class="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <For each={EXPO_APIS}>
                  {(api, i) => (
                    <li
                      class="reveal min-w-0 rounded-md bg-paper-light p-6 shadow-[var(--sheet-shadow)]"
                      ref={reveal}
                      style={{ '--i': i() % 3 }}
                    >
                      <LandingExpoGlyph class="size-14" name={api.glyph} />
                      <h3 class="landing-display mt-5 text-xl">{api.name}</h3>
                      <p class="mt-2 text-[0.9375rem] text-ink/70">{api.body}</p>
                    </li>
                  )}
                </For>
              </ul>
              <LandingMore class="mt-10" link={links.expo} topic="Expo modules" />
            </div>
          </section>

          <div class="border-t border-ink/15">
            <LandingFinalCta />
          </div>
        </main>

        <footer class="border-t border-ink/15">
          <div class="mx-auto grid grid-cols-1 max-w-[80rem] gap-10 px-[var(--gutter)] py-14 md:grid-cols-[1fr_auto]">
            <div class="max-w-[30rem]">
              <a href="/" class="flex items-center gap-2.5">
                <LandingMark class="size-6" />
                <span class="landing-display text-lg">{SITE_NAME}</span>
              </a>
              <p class="mt-4 text-sm text-graphite">{INDEPENDENCE_NOTE}</p>
            </div>
            <nav aria-label="Footer">
              <ul class="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
                <li>
                  <a class="hover:text-brand-ink" href={links.docs}>
                    Docs
                  </a>
                </li>
                <li>
                  <a class="hover:text-brand-ink" href={links.examples}>
                    Examples
                  </a>
                </li>
                <li>
                  <a class="hover:text-brand-ink" href={links.github}>
                    GitHub
                  </a>
                </li>
                <li>
                  <a class="hover:text-brand-ink" href={links.releases}>
                    Releases
                  </a>
                </li>
                <li>
                  <a class="hover:text-brand-ink" href={links.issues}>
                    Issues
                  </a>
                </li>
                <li>
                  <a class="hover:text-brand-ink" href={links.license}>
                    MIT license
                  </a>
                </li>
                <li>
                  <a class="hover:text-brand-ink" href={links.sponsor}>
                    Sponsor
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </doc-home>
  );
}
