/** @jsxImportSource solid-js */
/**
 * `/examples/<slug>`: one example app - its screens, what it shows, its code and how to run it.
 */
import { For, Show, createEffect, createMemo } from 'solid-js';
import { LandingPhone } from '../landing/phone.tsx';
import { applyNotFound, applySeo } from '../seo.ts';
import { GITHUB_REPO, SITE_NAME } from '../site.ts';
import { ExampleCodeBrowser } from './code-browser.tsx';
import { exampleApp, type ExampleApp, type ExampleScreenshot } from './registry.ts';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'example-app-page': HTMLAttributes<HTMLElement>;
    }
  }
}

function caption(shot: ExampleScreenshot): string {
  const platform = shot.platform === 'ios' ? 'iOS' : 'Android';
  return `${shot.screen}, ${platform}, ${shot.scheme}`;
}

function describePage(app: ExampleApp | undefined): void {
  if (!app) {
    applyNotFound();
    return;
  }
  applySeo({
    title: `${app.title} example - ${SITE_NAME}`,
    description: app.pitch,
    path: `/examples/${app.slug}`,
    type: 'article',
    breadcrumbs: [
      { title: 'Home', path: '/' },
      { title: 'Examples', path: '/examples' },
      { title: app.title, path: `/examples/${app.slug}` },
    ],
  });
}

/** `slug` comes from the route and changes in place, so it is read reactively. */
export function ExampleAppPage(props: { slug: string }) {
  const app = createMemo(() => exampleApp(props.slug));
  createEffect(() => describePage(app()));

  return (
    <example-app-page>
      <div class="mx-auto max-w-6xl px-5 pt-10 pb-24">
        <a
          href="/examples"
          class="text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Examples
        </a>
        <Show
          when={app()}
          keyed
          fallback={
            <>
              <h1 class="mt-2 font-display text-4xl font-semibold tracking-tight text-fg">
                No such example
              </h1>
              <p class="mt-5 text-fg-secondary">
                There is no example app at this address.{' '}
                <a href="/examples" class="text-fg underline underline-offset-2">
                  See them all
                </a>
                .
              </p>
            </>
          }
        >
          {(app) => (
            <>
              <div class="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <h1 class="font-display text-4xl font-semibold tracking-tight text-fg">
                  {app.title}
                </h1>
                <a
                  class="inline-flex h-9 items-center rounded-md border border-border-default px-3.5 text-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-raised"
                  href={`${GITHUB_REPO}/tree/main/${app.sourceRoot}`}
                >
                  View on GitHub
                </a>
              </div>
              <p class="mt-5 max-w-3xl text-[1.0625rem] leading-relaxed text-fg-secondary">
                {app.summary}
              </p>

              <ul
                class="-mx-5 mt-8 flex snap-x scroll-px-5 gap-8 overflow-x-auto px-5 pt-4 pb-16 sm:gap-9"
                aria-label="Screenshots"
              >
                <For each={app.screenshots}>
                  {(shot, i) => (
                    <li class="w-44 shrink-0 snap-start sm:w-48">
                      <figure>
                        <LandingPhone
                          platform={shot.platform}
                          src={shot.src}
                          alt={`${app.title}, ${caption(shot)}`}
                          eager={i() === 0}
                        />
                        <figcaption class="mt-4 text-center text-xs text-fg-tertiary">
                          {caption(shot)}
                        </figcaption>
                      </figure>
                    </li>
                  )}
                </For>
              </ul>

              <div class="mt-4 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <section aria-labelledby="shows">
                  <h2 id="shows" class="font-display text-xl font-semibold tracking-tight text-fg">
                    What it shows
                  </h2>
                  <ul class="mt-5 flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
                    <For each={app.features}>
                      {(feature) => (
                        <li>
                          <a
                            href={feature.docs}
                            class="group flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-6"
                          >
                            <span class="shrink-0 text-sm font-medium text-fg transition-colors group-hover:text-brand sm:w-36">
                              {feature.label}
                            </span>
                            <span class="text-sm text-fg-secondary">{feature.detail}</span>
                          </a>
                        </li>
                      )}
                    </For>
                  </ul>
                </section>

                <section aria-labelledby="run">
                  <h2 id="run" class="font-display text-xl font-semibold tracking-tight text-fg">
                    Run it
                  </h2>
                  <p class="mt-3 text-sm text-fg-secondary">
                    Clone the repository and start the app with Expo. Press i for the iOS simulator,
                    a for the Android emulator, or scan the code with Expo Go.
                  </p>
                  <pre class="shiki mt-4" data-commands>
                    <code>
                      <For
                        each={[
                          `git clone ${GITHUB_REPO}.git`,
                          'cd solid-native && pnpm install',
                          `cd ${app.sourceRoot} && pnpm start`,
                        ]}
                      >
                        {(line) => (
                          <span class="block">
                            <span class="mr-2 opacity-50 select-none" aria-hidden="true">
                              $
                            </span>
                            {line}
                          </span>
                        )}
                      </For>
                    </code>
                  </pre>
                </section>
              </div>

              <section class="mt-16" aria-labelledby="code">
                <h2 id="code" class="font-display text-xl font-semibold tracking-tight text-fg">
                  The code
                </h2>
                <p class="mt-3 mb-5 text-sm text-fg-secondary">
                  Every file in the app, as it is in the repository.
                </p>
                <ExampleCodeBrowser slug={app.slug} sourceRoot={app.sourceRoot} entry={app.entry} />
              </section>
            </>
          )}
        </Show>
      </div>
    </example-app-page>
  );
}
