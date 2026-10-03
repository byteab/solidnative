/** @jsxImportSource solid-js */
/**
 * `/examples`: every example app, as a card with a screenshot from a device.
 */
import { For, Show } from 'solid-js';
import { LandingPhone } from '../landing/phone.tsx';
import { applySeo } from '../seo.ts';
import { SITE_NAME } from '../site.ts';
import { EXAMPLE_APPS } from './registry.ts';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'example-gallery-page': HTMLAttributes<HTMLElement>;
    }
  }
}

const DESCRIPTION = `Complete apps built with ${SITE_NAME}, running on iOS and Android, with their source and the commands to run them.`;

export function ExampleGalleryPage() {
  applySeo({
    title: `Examples - ${SITE_NAME}`,
    description: DESCRIPTION,
    path: '/examples',
    type: 'website',
    breadcrumbs: [
      { title: 'Home', path: '/' },
      { title: 'Examples', path: '/examples' },
    ],
  });

  return (
    <example-gallery-page>
      <div class="mx-auto max-w-5xl px-5 pt-10 pb-24">
        <p class="text-sm font-medium text-brand">Examples</p>
        <h1 class="mt-2 font-display text-4xl font-semibold tracking-tight text-fg">
          Apps built with {SITE_NAME}
        </h1>
        <div class="prose mt-5 max-w-2xl">
          <p>
            Complete apps, each a folder in the repository: Solid components on native screens, with
            the router, forms, storage and device services a real app needs. Read the code here, or
            clone it and run it on your own phone.
          </p>
        </div>

        <ul class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <For each={EXAMPLE_APPS}>
            {(app) => (
              <li>
                <a
                  href={`/examples/${app.slug}`}
                  class="group flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle transition-colors hover:border-border-strong"
                  data-example={app.slug}
                >
                  <Show when={app.screenshots[0]}>
                    {(shot) => (
                      <div class="flex h-80 justify-center overflow-hidden border-b border-border-subtle bg-surface-sunken px-10 pt-9 transition-colors group-hover:bg-surface-raised">
                        <LandingPhone
                          class="w-48 shrink-0 transition-transform duration-300 group-hover:-translate-y-1"
                          platform={shot().platform}
                          src={shot().src}
                          alt={`${app.title}, ${shot().screen} screen`}
                        />
                      </div>
                    )}
                  </Show>
                  <div class="flex flex-1 flex-col p-5">
                    <h2 class="font-display text-lg font-semibold tracking-tight text-fg">
                      {app.title}
                    </h2>
                    <p class="mt-1.5 text-sm text-fg-secondary">{app.pitch}</p>
                    <ul class="mt-4 flex flex-wrap gap-1.5" aria-label="What it shows">
                      <For each={app.features}>
                        {(feature) => (
                          <li class="rounded-full border border-border-subtle px-2.5 py-0.5 text-xs text-fg-secondary">
                            {feature.label}
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </example-gallery-page>
  );
}
